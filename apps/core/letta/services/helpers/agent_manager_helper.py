import datetime
from typing import List, Literal, Optional

import numpy as np
from sqlalchemy import Select, and_, asc, desc, func, literal, or_, select, union_all
from sqlalchemy.sql.expression import exists

from letta import system
from letta.constants import IN_CONTEXT_MEMORY_KEYWORD, MAX_EMBEDDING_DIM, STRUCTURED_OUTPUT_MODELS
from letta.embeddings import embedding_model
from letta.helpers import ToolRulesSolver
from letta.helpers.datetime_helpers import get_local_time, get_local_time_fast
from letta.orm import AgentPassage, SourcePassage, SourcesAgents
from letta.orm.agent import Agent as AgentModel
from letta.orm.agents_tags import AgentsTags
from letta.orm.errors import NoResultFound
from letta.orm.identity import Identity
from letta.orm.sqlite_functions import adapt_array
from letta.otel.tracing import trace_method
from letta.prompts import gpt_system
from letta.schemas.agent import AgentState, AgentType
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import MessageRole
from letta.schemas.letta_message_content import TextContent
from letta.schemas.memory import Memory
from letta.schemas.message import Message, MessageCreate
from letta.schemas.tool_rule import ToolRule
from letta.schemas.user import User
from letta.settings import settings
from letta.system import get_initial_boot_messages, get_login_event, package_function_response


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


@trace_method
async def _process_relationship_async(
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
    result = await session.execute(select(model_class).where(model_class.id.in_(item_ids)))
    found_items = result.scalars().all()

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

        # MemGPT v1, both w/ and w/o sleeptime
        elif agent_type == AgentType.memgpt_agent and not enable_sleeptime:
            system = gpt_system.get_system_text("memgpt_v2_chat")
        elif agent_type == AgentType.memgpt_agent and enable_sleeptime:
            # NOTE: same as the chat one, since the chat one says that you "may" have the tools
            system = gpt_system.get_system_text("memgpt_v2_chat")

        # MemGPT v2, both w/ and w/o sleeptime
        elif agent_type == AgentType.memgpt_v2_agent and not enable_sleeptime:
            system = gpt_system.get_system_text("memgpt_v2_chat")
        elif agent_type == AgentType.memgpt_v2_agent and enable_sleeptime:
            # NOTE: same as the chat one, since the chat one says that you "may" have the tools
            system = gpt_system.get_system_text("memgpt_v2_chat")

        # Sleeptime
        elif agent_type == AgentType.sleeptime_agent:
            # v2 drops references to specific blocks, and instead relies on the block description injections
            system = gpt_system.get_system_text("sleeptime_v2")

        else:
            raise ValueError(f"Invalid agent type: {agent_type}")

    return system


# TODO: This code is kind of wonky and deserves a rewrite
def compile_memory_metadata_block(
    memory_edit_timestamp: datetime.datetime,
    previous_message_count: int = 0,
    archival_memory_size: int = 0,
) -> str:
    # Put the timestamp in the local timezone (mimicking get_local_time())
    timestamp_str = memory_edit_timestamp.astimezone().strftime("%Y-%m-%d %I:%M:%S %p %Z%z").strip()

    # Create a metadata block of info so the agent knows about the metadata of out-of-context memories
    memory_metadata_block = "\n".join(
        [
            "<memory_metadata>",
            f"- The current time is: {get_local_time_fast()}",
            f"- Memory blocks were last modified: {timestamp_str}",
            f"- {previous_message_count} previous messages between you and the user are stored in recall memory (use tools to access them)",
            f"- {archival_memory_size} total memories you created are stored in archival memory (use tools to access them)",
            "</memory_metadata>",
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
    tool_rules_solver: Optional[ToolRulesSolver] = None,
) -> str:
    """Prepare the final/full system message that will be fed into the LLM API

    The base system message may be templated, in which case we need to render the variables.

    The following are reserved variables:
      - CORE_MEMORY: the in-context memory of the LLM
    """
    # Add tool rule constraints if available
    if tool_rules_solver is not None:
        tool_constraint_block = tool_rules_solver.compile_tool_rule_prompts()
        if tool_constraint_block:  # There may not be any depending on if there are tool rules attached
            in_context_memory.blocks.append(tool_constraint_block)

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
        )
        full_memory_string = in_context_memory.compile() + "\n\n" + memory_metadata_string

        # Add to the variables list to inject
        variables[IN_CONTEXT_MEMORY_KEYWORD] = full_memory_string

    if template_format == "f-string":
        memory_variable_string = "{" + IN_CONTEXT_MEMORY_KEYWORD + "}"
        # Catch the special case where the system prompt is unformatted
        if append_icm_if_missing:
            if memory_variable_string not in system_prompt:
                # In this case, append it to the end to make sure memory is still injected
                # warnings.warn(f"{IN_CONTEXT_MEMORY_KEYWORD} variable was missing from system prompt, appending instead")
                system_prompt += "\n\n" + memory_variable_string

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


def _apply_pagination(
    query, before: Optional[str], after: Optional[str], session, ascending: bool = True, sort_by: str = "created_at"
) -> any:
    # Determine the sort column
    if sort_by == "last_run_completion":
        sort_column = AgentModel.last_run_completion
    else:
        sort_column = AgentModel.created_at

    if after:
        if sort_by == "last_run_completion":
            result = session.execute(select(AgentModel.last_run_completion, AgentModel.id).where(AgentModel.id == after)).first()
        else:
            result = session.execute(select(AgentModel.created_at, AgentModel.id).where(AgentModel.id == after)).first()
        if result:
            after_sort_value, after_id = result
            query = query.where(_cursor_filter(sort_column, AgentModel.id, after_sort_value, after_id, forward=ascending))

    if before:
        if sort_by == "last_run_completion":
            result = session.execute(select(AgentModel.last_run_completion, AgentModel.id).where(AgentModel.id == before)).first()
        else:
            result = session.execute(select(AgentModel.created_at, AgentModel.id).where(AgentModel.id == before)).first()
        if result:
            before_sort_value, before_id = result
            query = query.where(_cursor_filter(sort_column, AgentModel.id, before_sort_value, before_id, forward=not ascending))

    # Apply ordering
    order_fn = asc if ascending else desc
    query = query.order_by(order_fn(sort_column), order_fn(AgentModel.id))
    return query


async def _apply_pagination_async(
    query, before: Optional[str], after: Optional[str], session, ascending: bool = True, sort_by: str = "created_at"
) -> any:
    # Determine the sort column
    if sort_by == "last_run_completion":
        sort_column = AgentModel.last_run_completion
    else:
        sort_column = AgentModel.created_at

    if after:
        if sort_by == "last_run_completion":
            result = (await session.execute(select(AgentModel.last_run_completion, AgentModel.id).where(AgentModel.id == after))).first()
        else:
            result = (await session.execute(select(AgentModel.created_at, AgentModel.id).where(AgentModel.id == after))).first()
        if result:
            after_sort_value, after_id = result
            query = query.where(_cursor_filter(sort_column, AgentModel.id, after_sort_value, after_id, forward=ascending))

    if before:
        if sort_by == "last_run_completion":
            result = (await session.execute(select(AgentModel.last_run_completion, AgentModel.id).where(AgentModel.id == before))).first()
        else:
            result = (await session.execute(select(AgentModel.created_at, AgentModel.id).where(AgentModel.id == before))).first()
        if result:
            before_sort_value, before_id = result
            query = query.where(_cursor_filter(sort_column, AgentModel.id, before_sort_value, before_id, forward=not ascending))

    # Apply ordering
    order_fn = asc if ascending else desc
    query = query.order_by(order_fn(sort_column), order_fn(AgentModel.id))
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


def build_passage_query(
    actor: User,
    agent_id: Optional[str] = None,
    file_id: Optional[str] = None,
    query_text: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    before: Optional[str] = None,
    after: Optional[str] = None,
    source_id: Optional[str] = None,
    embed_query: bool = False,
    ascending: bool = True,
    embedding_config: Optional[EmbeddingConfig] = None,
    agent_only: bool = False,
) -> Select:
    """Helper function to build the base passage query with all filters applied.
    Supports both before and after pagination across merged source and agent passages.

    Returns the query before any limit or count operations are applied.
    """
    embedded_text = None
    if embed_query:
        assert embedding_config is not None, "embedding_config must be specified for vector search"
        assert query_text is not None, "query_text must be specified for vector search"
        embedded_text = embedding_model(embedding_config).get_text_embedding(query_text)
        embedded_text = np.array(embedded_text)
        embedded_text = np.pad(embedded_text, (0, MAX_EMBEDDING_DIM - embedded_text.shape[0]), mode="constant").tolist()

    # Start with base query for source passages
    source_passages = None
    if not agent_only:  # Include source passages
        if agent_id is not None:
            source_passages = (
                select(
                    SourcePassage.file_name,
                    SourcePassage.id,
                    SourcePassage.text,
                    SourcePassage.embedding_config,
                    SourcePassage.metadata_,
                    SourcePassage.embedding,
                    SourcePassage.created_at,
                    SourcePassage.updated_at,
                    SourcePassage.is_deleted,
                    SourcePassage._created_by_id,
                    SourcePassage._last_updated_by_id,
                    SourcePassage.organization_id,
                    SourcePassage.file_id,
                    SourcePassage.source_id,
                    literal(None).label("agent_id"),
                )
                .join(SourcesAgents, SourcesAgents.source_id == SourcePassage.source_id)
                .where(SourcesAgents.agent_id == agent_id)
                .where(SourcePassage.organization_id == actor.organization_id)
            )
        else:
            source_passages = select(
                SourcePassage.file_name,
                SourcePassage.id,
                SourcePassage.text,
                SourcePassage.embedding_config,
                SourcePassage.metadata_,
                SourcePassage.embedding,
                SourcePassage.created_at,
                SourcePassage.updated_at,
                SourcePassage.is_deleted,
                SourcePassage._created_by_id,
                SourcePassage._last_updated_by_id,
                SourcePassage.organization_id,
                SourcePassage.file_id,
                SourcePassage.source_id,
                literal(None).label("agent_id"),
            ).where(SourcePassage.organization_id == actor.organization_id)

        if source_id:
            source_passages = source_passages.where(SourcePassage.source_id == source_id)
        if file_id:
            source_passages = source_passages.where(SourcePassage.file_id == file_id)

    # Add agent passages query
    agent_passages = None
    if agent_id is not None:
        agent_passages = (
            select(
                literal(None).label("file_name"),
                AgentPassage.id,
                AgentPassage.text,
                AgentPassage.embedding_config,
                AgentPassage.metadata_,
                AgentPassage.embedding,
                AgentPassage.created_at,
                AgentPassage.updated_at,
                AgentPassage.is_deleted,
                AgentPassage._created_by_id,
                AgentPassage._last_updated_by_id,
                AgentPassage.organization_id,
                literal(None).label("file_id"),
                literal(None).label("source_id"),
                AgentPassage.agent_id,
            )
            .where(AgentPassage.agent_id == agent_id)
            .where(AgentPassage.organization_id == actor.organization_id)
        )

    # Combine queries
    if source_passages is not None and agent_passages is not None:
        combined_query = union_all(source_passages, agent_passages).cte("combined_passages")
    elif agent_passages is not None:
        combined_query = agent_passages.cte("combined_passages")
    elif source_passages is not None:
        combined_query = source_passages.cte("combined_passages")
    else:
        raise ValueError("No passages found")

    # Build main query from combined CTE
    main_query = select(combined_query)

    # Apply filters
    if start_date:
        main_query = main_query.where(combined_query.c.created_at >= start_date)
    if end_date:
        main_query = main_query.where(combined_query.c.created_at <= end_date)
    if source_id:
        main_query = main_query.where(combined_query.c.source_id == source_id)
    if file_id:
        main_query = main_query.where(combined_query.c.file_id == file_id)

    # Vector search
    if embedded_text:
        if settings.letta_pg_uri_no_default:
            # PostgreSQL with pgvector
            main_query = main_query.order_by(combined_query.c.embedding.cosine_distance(embedded_text).asc())
        else:
            # SQLite with custom vector type
            query_embedding_binary = adapt_array(embedded_text)
            main_query = main_query.order_by(
                func.cosine_distance(combined_query.c.embedding, query_embedding_binary).asc(),
                combined_query.c.created_at.asc() if ascending else combined_query.c.created_at.desc(),
                combined_query.c.id.asc(),
            )
    else:
        if query_text:
            main_query = main_query.where(func.lower(combined_query.c.text).contains(func.lower(query_text)))

    # Handle pagination
    if before or after:
        # Create reference CTEs
        if before:
            before_ref = select(combined_query.c.created_at, combined_query.c.id).where(combined_query.c.id == before).cte("before_ref")
        if after:
            after_ref = select(combined_query.c.created_at, combined_query.c.id).where(combined_query.c.id == after).cte("after_ref")

        if before and after:
            # Window-based query (get records between before and after)
            main_query = main_query.where(
                or_(
                    combined_query.c.created_at < select(before_ref.c.created_at).scalar_subquery(),
                    and_(
                        combined_query.c.created_at == select(before_ref.c.created_at).scalar_subquery(),
                        combined_query.c.id < select(before_ref.c.id).scalar_subquery(),
                    ),
                )
            )
            main_query = main_query.where(
                or_(
                    combined_query.c.created_at > select(after_ref.c.created_at).scalar_subquery(),
                    and_(
                        combined_query.c.created_at == select(after_ref.c.created_at).scalar_subquery(),
                        combined_query.c.id > select(after_ref.c.id).scalar_subquery(),
                    ),
                )
            )
        else:
            # Pure pagination (only before or only after)
            if before:
                main_query = main_query.where(
                    or_(
                        combined_query.c.created_at < select(before_ref.c.created_at).scalar_subquery(),
                        and_(
                            combined_query.c.created_at == select(before_ref.c.created_at).scalar_subquery(),
                            combined_query.c.id < select(before_ref.c.id).scalar_subquery(),
                        ),
                    )
                )
            if after:
                main_query = main_query.where(
                    or_(
                        combined_query.c.created_at > select(after_ref.c.created_at).scalar_subquery(),
                        and_(
                            combined_query.c.created_at == select(after_ref.c.created_at).scalar_subquery(),
                            combined_query.c.id > select(after_ref.c.id).scalar_subquery(),
                        ),
                    )
                )

    # Add ordering if not already ordered by similarity
    if not embed_query:
        if ascending:
            main_query = main_query.order_by(
                combined_query.c.created_at.asc(),
                combined_query.c.id.asc(),
            )
        else:
            main_query = main_query.order_by(
                combined_query.c.created_at.desc(),
                combined_query.c.id.asc(),
            )

    return main_query


def build_source_passage_query(
    actor: User,
    agent_id: Optional[str] = None,
    file_id: Optional[str] = None,
    query_text: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    before: Optional[str] = None,
    after: Optional[str] = None,
    source_id: Optional[str] = None,
    embed_query: bool = False,
    ascending: bool = True,
    embedding_config: Optional[EmbeddingConfig] = None,
) -> Select:
    """Build query for source passages with all filters applied."""

    # Handle embedding for vector search
    embedded_text = None
    if embed_query:
        assert embedding_config is not None, "embedding_config must be specified for vector search"
        assert query_text is not None, "query_text must be specified for vector search"
        embedded_text = embedding_model(embedding_config).get_text_embedding(query_text)
        embedded_text = np.array(embedded_text)
        embedded_text = np.pad(embedded_text, (0, MAX_EMBEDDING_DIM - embedded_text.shape[0]), mode="constant").tolist()

    # Base query for source passages
    query = select(SourcePassage).where(SourcePassage.organization_id == actor.organization_id)

    # If agent_id is specified, join with SourcesAgents to get only passages linked to that agent
    if agent_id is not None:
        query = query.join(SourcesAgents, SourcesAgents.source_id == SourcePassage.source_id)
        query = query.where(SourcesAgents.agent_id == agent_id)

    # Apply filters
    if source_id:
        query = query.where(SourcePassage.source_id == source_id)
    if file_id:
        query = query.where(SourcePassage.file_id == file_id)
    if start_date:
        query = query.where(SourcePassage.created_at >= start_date)
    if end_date:
        query = query.where(SourcePassage.created_at <= end_date)

    # Handle text search or vector search
    if embedded_text:
        if settings.letta_pg_uri_no_default:
            # PostgreSQL with pgvector
            query = query.order_by(SourcePassage.embedding.cosine_distance(embedded_text).asc())
        else:
            # SQLite with custom vector type
            query_embedding_binary = adapt_array(embedded_text)
            query = query.order_by(
                func.cosine_distance(SourcePassage.embedding, query_embedding_binary).asc(),
                SourcePassage.created_at.asc() if ascending else SourcePassage.created_at.desc(),
                SourcePassage.id.asc(),
            )
    else:
        if query_text:
            query = query.where(func.lower(SourcePassage.text).contains(func.lower(query_text)))

    # Handle pagination
    if before or after:
        if before:
            # Get the reference record
            before_subq = select(SourcePassage.created_at, SourcePassage.id).where(SourcePassage.id == before).subquery()
            query = query.where(
                or_(
                    SourcePassage.created_at < before_subq.c.created_at,
                    and_(
                        SourcePassage.created_at == before_subq.c.created_at,
                        SourcePassage.id < before_subq.c.id,
                    ),
                )
            )

        if after:
            # Get the reference record
            after_subq = select(SourcePassage.created_at, SourcePassage.id).where(SourcePassage.id == after).subquery()
            query = query.where(
                or_(
                    SourcePassage.created_at > after_subq.c.created_at,
                    and_(
                        SourcePassage.created_at == after_subq.c.created_at,
                        SourcePassage.id > after_subq.c.id,
                    ),
                )
            )

    # Apply ordering if not already ordered by similarity
    if not embed_query:
        if ascending:
            query = query.order_by(SourcePassage.created_at.asc(), SourcePassage.id.asc())
        else:
            query = query.order_by(SourcePassage.created_at.desc(), SourcePassage.id.asc())

    return query


def build_agent_passage_query(
    actor: User,
    agent_id: str,  # Required for agent passages
    query_text: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    before: Optional[str] = None,
    after: Optional[str] = None,
    embed_query: bool = False,
    ascending: bool = True,
    embedding_config: Optional[EmbeddingConfig] = None,
) -> Select:
    """Build query for agent passages with all filters applied."""

    # Handle embedding for vector search
    embedded_text = None
    if embed_query:
        assert embedding_config is not None, "embedding_config must be specified for vector search"
        assert query_text is not None, "query_text must be specified for vector search"
        embedded_text = embedding_model(embedding_config).get_text_embedding(query_text)
        embedded_text = np.array(embedded_text)
        embedded_text = np.pad(embedded_text, (0, MAX_EMBEDDING_DIM - embedded_text.shape[0]), mode="constant").tolist()

    # Base query for agent passages
    query = select(AgentPassage).where(AgentPassage.agent_id == agent_id, AgentPassage.organization_id == actor.organization_id)

    # Apply filters
    if start_date:
        query = query.where(AgentPassage.created_at >= start_date)
    if end_date:
        query = query.where(AgentPassage.created_at <= end_date)

    # Handle text search or vector search
    if embedded_text:
        if settings.letta_pg_uri_no_default:
            # PostgreSQL with pgvector
            query = query.order_by(AgentPassage.embedding.cosine_distance(embedded_text).asc())
        else:
            # SQLite with custom vector type
            query_embedding_binary = adapt_array(embedded_text)
            query = query.order_by(
                func.cosine_distance(AgentPassage.embedding, query_embedding_binary).asc(),
                AgentPassage.created_at.asc() if ascending else AgentPassage.created_at.desc(),
                AgentPassage.id.asc(),
            )
    else:
        if query_text:
            query = query.where(func.lower(AgentPassage.text).contains(func.lower(query_text)))

    # Handle pagination
    if before or after:
        if before:
            # Get the reference record
            before_subq = select(AgentPassage.created_at, AgentPassage.id).where(AgentPassage.id == before).subquery()
            query = query.where(
                or_(
                    AgentPassage.created_at < before_subq.c.created_at,
                    and_(
                        AgentPassage.created_at == before_subq.c.created_at,
                        AgentPassage.id < before_subq.c.id,
                    ),
                )
            )

        if after:
            # Get the reference record
            after_subq = select(AgentPassage.created_at, AgentPassage.id).where(AgentPassage.id == after).subquery()
            query = query.where(
                or_(
                    AgentPassage.created_at > after_subq.c.created_at,
                    and_(
                        AgentPassage.created_at == after_subq.c.created_at,
                        AgentPassage.id > after_subq.c.id,
                    ),
                )
            )

    # Apply ordering if not already ordered by similarity
    if not embed_query:
        if ascending:
            query = query.order_by(AgentPassage.created_at.asc(), AgentPassage.id.asc())
        else:
            query = query.order_by(AgentPassage.created_at.desc(), AgentPassage.id.asc())

    return query
