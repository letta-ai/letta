import datetime
from typing import List, Literal, Optional

from sqlalchemy import and_, asc, desc, exists, or_, select

from letta import system
from letta.constants import IN_CONTEXT_MEMORY_KEYWORD, STRUCTURED_OUTPUT_MODELS
from letta.helpers import ToolRulesSolver
from letta.helpers.datetime_helpers import get_local_time, get_local_time_fast
from letta.orm.agent import Agent as AgentModel
from letta.orm.agents_tags import AgentsTags
from letta.orm.errors import NoResultFound
from letta.orm.identity import Identity
from letta.prompts import gpt_system
from letta.schemas.agent import AgentState, AgentType
from letta.schemas.enums import MessageRole
from letta.schemas.letta_message_content import TextContent
from letta.schemas.memory import Memory
from letta.schemas.message import Message, MessageCreate
from letta.schemas.passage import Passage as PydanticPassage
from letta.schemas.tool_rule import ToolRule
from letta.schemas.user import User
from letta.system import get_initial_boot_messages, get_login_event, package_function_response
from letta.tracing import trace_method


# Static methods
@trace_method
def _process_relationship(
    session, agent: AgentModel, relationship_name: str, model_class, item_ids: List[str], allow_partial=False, replace=True
):
    """
    Generalized function to handle relationships like tools, sources, and blocks using item IDs.

    Args:
        session: The database session.
        agent: The AgentModel instance.
        relationship_name: The name of the relationship attribute (e.g., 'tools', 'sources').
        model_class: The ORM class corresponding to the related items.
        item_ids: List of IDs to set or update.
        allow_partial: If True, allows missing items without raising errors.
        replace: If True, replaces the entire relationship; otherwise, extends it.

    Raises:
        ValueError: If `allow_partial` is False and some IDs are missing.
    """
    current_relationship = getattr(agent, relationship_name, [])
    if not item_ids:
        if replace:
            setattr(agent, relationship_name, [])
        return

    # Retrieve models for the provided IDs
    found_items = session.query(model_class).filter(model_class.id.in_(item_ids)).all()

    # Validate all items are found if allow_partial is False
    if not allow_partial and len(found_items) != len(item_ids):
        missing = set(item_ids) - {item.id for item in found_items}
        raise NoResultFound(f"Items not found in {relationship_name}: {missing}")

    if replace:
        # Replace the relationship
        setattr(agent, relationship_name, found_items)
    else:
        # Extend the relationship (only add new items)
        current_ids = {item.id for item in current_relationship}
        new_items = [item for item in found_items if item.id not in current_ids]
        current_relationship.extend(new_items)


def _process_tags(agent: AgentModel, tags: List[str], replace=True):
    """
    Handles tags for an agent.

    Args:
        agent: The AgentModel instance.
        tags: List of tags to set or update.
        replace: If True, replaces all tags; otherwise, extends them.
    """
    if not tags:
        if replace:
            agent.tags = []
        return

    # Ensure tags are unique and prepare for replacement/extension
    new_tags = {AgentsTags(agent_id=agent.id, tag=tag) for tag in set(tags)}
    if replace:
        agent.tags = list(new_tags)
    else:
        existing_tags = {t.tag for t in agent.tags}
        agent.tags.extend([tag for tag in new_tags if tag.tag not in existing_tags])


def derive_system_message(agent_type: AgentType, enable_sleeptime: Optional[bool] = None, system: Optional[str] = None):
    if system is None:
        # TODO: don't hardcode
        if agent_type == AgentType.voice_convo_agent:
            system = gpt_system.get_system_text("voice_chat")
        elif agent_type == AgentType.voice_sleeptime_agent:
            system = gpt_system.get_system_text("voice_sleeptime")
        elif agent_type == AgentType.memgpt_agent and not enable_sleeptime:
            system = gpt_system.get_system_text("memgpt_chat")
        elif agent_type == AgentType.memgpt_agent and enable_sleeptime:
            system = gpt_system.get_system_text("memgpt_sleeptime_chat")
        elif agent_type == AgentType.sleeptime_agent:
            system = gpt_system.get_system_text("sleeptime")
        else:
            raise ValueError(f"Invalid agent type: {agent_type}")

    return system


# TODO: This code is kind of wonky and deserves a rewrite
def compile_memory_metadata_block(
    memory_edit_timestamp: datetime.datetime,
    previous_message_count: int = 0,
    archival_memory_size: int = 0,
    recent_passages: List[PydanticPassage] = None,
) -> str:
    # Put the timestamp in the local timezone (mimicking get_local_time())
    timestamp_str = memory_edit_timestamp.astimezone().strftime("%Y-%m-%d %I:%M:%S %p %Z%z").strip()

    # Create a metadata block of info so the agent knows about the metadata of out-of-context memories
    memory_metadata_block = "\n".join(
        [
            f"### Current Time: {get_local_time_fast()}" f"### Memory [last modified: {timestamp_str}]",
            f"{previous_message_count} previous messages between you and the user are stored in recall memory (use functions to access them)",
            f"{archival_memory_size} total memories you created are stored in archival memory (use functions to access them)",
            (
                f"Most recent archival passages {len(recent_passages)} recent passages: {[passage.text for passage in recent_passages]}"
                if recent_passages is not None
                else ""
            ),
            "\nCore memory shown below (limited in size, additional information stored in archival / recall memory):",
        ]
    )
    return memory_metadata_block


class PreserveMapping(dict):
    """Used to preserve (do not modify) undefined variables in the system prompt"""

    def __missing__(self, key):
        return "{" + key + "}"


def safe_format(template: str, variables: dict) -> str:
    """
    Safely formats a template string, preserving empty {} and {unknown_vars}
    while substituting known variables.

    If we simply use {} in format_map, it'll be treated as a positional field
    """
    # First escape any empty {} by doubling them
    escaped = template.replace("{}", "{{}}")

    # Now use format_map with our custom mapping
    return escaped.format_map(PreserveMapping(variables))


def compile_system_message(
    system_prompt: str,
    in_context_memory: Memory,
    in_context_memory_last_edit: datetime.datetime,  # TODO move this inside of BaseMemory?
    user_defined_variables: Optional[dict] = None,
    append_icm_if_missing: bool = True,
    template_format: Literal["f-string", "mustache", "jinja2"] = "f-string",
    previous_message_count: int = 0,
    archival_memory_size: int = 0,
    recent_passages: Optional[List[PydanticPassage]] = None,
) -> str:
    """Prepare the final/full system message that will be fed into the LLM API

    The base system message may be templated, in which case we need to render the variables.

    The following are reserved variables:
      - CORE_MEMORY: the in-context memory of the LLM
    """

    if user_defined_variables is not None:
        # TODO eventually support the user defining their own variables to inject
        raise NotImplementedError
    else:
        variables = {}

    # Add the protected memory variable
    if IN_CONTEXT_MEMORY_KEYWORD in variables:
        raise ValueError(f"Found protected variable '{IN_CONTEXT_MEMORY_KEYWORD}' in user-defined vars: {str(user_defined_variables)}")
    else:
        # TODO should this all put into the memory.__repr__ function?
        memory_metadata_string = compile_memory_metadata_block(
            memory_edit_timestamp=in_context_memory_last_edit,
            previous_message_count=previous_message_count,
            archival_memory_size=archival_memory_size,
            recent_passages=recent_passages,
        )
        full_memory_string = memory_metadata_string + "\n" + in_context_memory.compile()

        # Add to the variables list to inject
        variables[IN_CONTEXT_MEMORY_KEYWORD] = full_memory_string

    if template_format == "f-string":
        memory_variable_string = "{" + IN_CONTEXT_MEMORY_KEYWORD + "}"
        # Catch the special case where the system prompt is unformatted
        if append_icm_if_missing:
            if memory_variable_string not in system_prompt:
                # In this case, append it to the end to make sure memory is still injected
                # warnings.warn(f"{IN_CONTEXT_MEMORY_KEYWORD} variable was missing from system prompt, appending instead")
                system_prompt += "\n" + memory_variable_string

        # render the variables using the built-in templater
        try:
            if user_defined_variables:
                formatted_prompt = safe_format(system_prompt, variables)
            else:
                formatted_prompt = system_prompt.replace(memory_variable_string, full_memory_string)
        except Exception as e:
            raise ValueError(f"Failed to format system prompt - {str(e)}. System prompt value:\n{system_prompt}")

    else:
        # TODO support for mustache and jinja2
        raise NotImplementedError(template_format)

    return formatted_prompt


def initialize_message_sequence(
    agent_state: AgentState,
    memory_edit_timestamp: Optional[datetime.datetime] = None,
    include_initial_boot_message: bool = True,
    previous_message_count: int = 0,
    archival_memory_size: int = 0,
) -> List[dict]:
    if memory_edit_timestamp is None:
        memory_edit_timestamp = get_local_time()

    full_system_message = compile_system_message(
        system_prompt=agent_state.system,
        in_context_memory=agent_state.memory,
        in_context_memory_last_edit=memory_edit_timestamp,
        user_defined_variables=None,
        append_icm_if_missing=True,
        previous_message_count=previous_message_count,
        archival_memory_size=archival_memory_size,
    )
    first_user_message = get_login_event()  # event letting Letta know the user just logged in

    if include_initial_boot_message:
        if agent_state.agent_type == AgentType.sleeptime_agent:
            initial_boot_messages = []
        elif agent_state.llm_config.model is not None and "gpt-3.5" in agent_state.llm_config.model:
            initial_boot_messages = get_initial_boot_messages("startup_with_send_message_gpt35")
        else:
            initial_boot_messages = get_initial_boot_messages("startup_with_send_message")
        messages = (
            [
                {"role": "system", "content": full_system_message},
            ]
            + initial_boot_messages
            + [
                {"role": "user", "content": first_user_message},
            ]
        )

    else:
        messages = [
            {"role": "system", "content": full_system_message},
            {"role": "user", "content": first_user_message},
        ]

    return messages


def package_initial_message_sequence(
    agent_id: str, initial_message_sequence: List[MessageCreate], model: str, actor: User
) -> List[Message]:
    # create the agent object
    init_messages = []
    for message_create in initial_message_sequence:

        if message_create.role == MessageRole.user:
            packed_message = system.package_user_message(
                user_message=message_create.content,
            )
            init_messages.append(
                Message(
                    role=message_create.role,
                    content=[TextContent(text=packed_message)],
                    name=message_create.name,
                    organization_id=actor.organization_id,
                    agent_id=agent_id,
                    model=model,
                )
            )
        elif message_create.role == MessageRole.system:
            packed_message = system.package_system_message(
                system_message=message_create.content,
            )
            init_messages.append(
                Message(
                    role=message_create.role,
                    content=[TextContent(text=packed_message)],
                    name=message_create.name,
                    organization_id=actor.organization_id,
                    agent_id=agent_id,
                    model=model,
                )
            )
        elif message_create.role == MessageRole.assistant:
            # append tool call to send_message
            import json
            import uuid

            from openai.types.chat.chat_completion_message_tool_call import ChatCompletionMessageToolCall as OpenAIToolCall
            from openai.types.chat.chat_completion_message_tool_call import Function as OpenAIFunction

            from letta.constants import DEFAULT_MESSAGE_TOOL

            tool_call_id = str(uuid.uuid4())
            init_messages.append(
                Message(
                    role=MessageRole.assistant,
                    content=None,
                    name=message_create.name,
                    organization_id=actor.organization_id,
                    agent_id=agent_id,
                    model=model,
                    tool_calls=[
                        OpenAIToolCall(
                            id=tool_call_id,
                            type="function",
                            function=OpenAIFunction(name=DEFAULT_MESSAGE_TOOL, arguments=json.dumps({"message": message_create.content})),
                        )
                    ],
                )
            )

            # add tool return
            function_response = package_function_response(True, "None")
            init_messages.append(
                Message(
                    role=MessageRole.tool,
                    content=[TextContent(text=function_response)],
                    name=message_create.name,
                    organization_id=actor.organization_id,
                    agent_id=agent_id,
                    model=model,
                    tool_call_id=tool_call_id,
                )
            )
        else:
            # TODO: add tool call and tool return
            raise ValueError(f"Invalid message role: {message_create.role}")

    return init_messages


def check_supports_structured_output(model: str, tool_rules: List[ToolRule]) -> bool:
    if model not in STRUCTURED_OUTPUT_MODELS:
        if len(ToolRulesSolver(tool_rules=tool_rules).init_tool_rules) > 1:
            raise ValueError("Multiple initial tools are not supported for non-structured models. Please use only one initial tool rule.")
        return False
    else:
        return True


def _cursor_filter(created_at_col, id_col, ref_created_at, ref_id, forward: bool):
    """
    Returns a SQLAlchemy filter expression for cursor-based pagination.

    If `forward` is True, returns records after the reference.
    If `forward` is False, returns records before the reference.
    """
    if forward:
        return or_(
            created_at_col > ref_created_at,
            and_(created_at_col == ref_created_at, id_col > ref_id),
        )
    else:
        return or_(
            created_at_col < ref_created_at,
            and_(created_at_col == ref_created_at, id_col < ref_id),
        )


def _apply_pagination(query, before: Optional[str], after: Optional[str], session, ascending: bool = True) -> any:
    if after:
        result = session.execute(select(AgentModel.created_at, AgentModel.id).where(AgentModel.id == after)).first()
        if result:
            after_created_at, after_id = result
            query = query.where(_cursor_filter(AgentModel.created_at, AgentModel.id, after_created_at, after_id, forward=ascending))

    if before:
        result = session.execute(select(AgentModel.created_at, AgentModel.id).where(AgentModel.id == before)).first()
        if result:
            before_created_at, before_id = result
            query = query.where(_cursor_filter(AgentModel.created_at, AgentModel.id, before_created_at, before_id, forward=not ascending))

    # Apply ordering
    order_fn = asc if ascending else desc
    query = query.order_by(order_fn(AgentModel.created_at), order_fn(AgentModel.id))
    return query


async def _apply_pagination_async(query, before: Optional[str], after: Optional[str], session, ascending: bool = True) -> any:
    if after:
        result = (await session.execute(select(AgentModel.created_at, AgentModel.id).where(AgentModel.id == after))).first()
        if result:
            after_created_at, after_id = result
            query = query.where(_cursor_filter(AgentModel.created_at, AgentModel.id, after_created_at, after_id, forward=ascending))

    if before:
        result = (await session.execute(select(AgentModel.created_at, AgentModel.id).where(AgentModel.id == before))).first()
        if result:
            before_created_at, before_id = result
            query = query.where(_cursor_filter(AgentModel.created_at, AgentModel.id, before_created_at, before_id, forward=not ascending))

    # Apply ordering
    order_fn = asc if ascending else desc
    query = query.order_by(order_fn(AgentModel.created_at), order_fn(AgentModel.id))
    return query


def _apply_tag_filter(query, tags: Optional[List[str]], match_all_tags: bool):
    """
    Apply tag-based filtering to the agent query.

    This helper function creates a subquery that groups agent IDs by their tags.
    If `match_all_tags` is True, it filters agents that have all of the specified tags.
    Otherwise, it filters agents that have any of the tags.

    Args:
        query: The SQLAlchemy query object to be modified.
        tags (Optional[List[str]]): A list of tags to filter agents.
        match_all_tags (bool): If True, only return agents that match all provided tags.

    Returns:
        The modified query with tag filters applied.
    """
    if tags:
        if match_all_tags:
            for tag in tags:
                query = query.filter(exists().where((AgentsTags.agent_id == AgentModel.id) & (AgentsTags.tag == tag)))
            else:
                query = query.where(exists().where((AgentsTags.agent_id == AgentModel.id) & (AgentsTags.tag.in_(tags))))
    return query


def _apply_identity_filters(query, identity_id: Optional[str], identifier_keys: Optional[List[str]]):
    """
    Apply identity-related filters to the agent query.

    This helper function joins the identities relationship and filters the agents based on
    a specific identity ID and/or a list of identifier keys.

    Args:
        query: The SQLAlchemy query object to be modified.
        identity_id (Optional[str]): The identity ID to filter by.
        identifier_keys (Optional[List[str]]): A list of identifier keys to filter agents.

    Returns:
        The modified query with identity filters applied.
    """
    # Join the identities relationship and filter by a specific identity ID.
    if identity_id:
        query = query.join(AgentModel.identities).where(Identity.id == identity_id)
    # Join the identities relationship and filter by a set of identifier keys.
    if identifier_keys:
        query = query.join(AgentModel.identities).where(Identity.identifier_key.in_(identifier_keys))
    return query


def _apply_filters(
    query,
    name: Optional[str],
    query_text: Optional[str],
    project_id: Optional[str],
    template_id: Optional[str],
    base_template_id: Optional[str],
):
    """
    Apply basic filtering criteria to the agent query.

    This helper function adds WHERE clauses based on provided parameters such as
    exact name, partial name match (using ILIKE), project ID, template ID, and base template ID.

    Args:
        query: The SQLAlchemy query object to be modified.
        name (Optional[str]): Exact name to filter by.
        query_text (Optional[str]): Partial text to search in the agent's name (case-insensitive).
        project_id (Optional[str]): Filter for agents belonging to a specific project.
        template_id (Optional[str]): Filter for agents using a specific template.
        base_template_id (Optional[str]): Filter for agents using a specific base template.

    Returns:
        The modified query with the applied filters.
    """
    # Filter by exact agent name if provided.
    if name:
        query = query.where(AgentModel.name == name)
    # Apply a case-insensitive partial match for the agent's name.
    if query_text:
        query = query.where(AgentModel.name.ilike(f"%{query_text}%"))
    # Filter agents by project ID.
    if project_id:
        query = query.where(AgentModel.project_id == project_id)
    # Filter agents by template ID.
    if template_id:
        query = query.where(AgentModel.template_id == template_id)
    # Filter agents by base template ID.
    if base_template_id:
        query = query.where(AgentModel.base_template_id == base_template_id)
    return query
