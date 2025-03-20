from datetime import datetime
from typing import Dict, List, Optional

import numpy as np
from sqlalchemy import Select, and_, func, literal, or_, select, union_all

from letta.constants import BASE_MEMORY_TOOLS, BASE_TOOLS, DATA_SOURCE_ATTACH_ALERT, MAX_EMBEDDING_DIM, MULTI_AGENT_TOOLS
from letta.embeddings import embedding_model
from letta.helpers.datetime_helpers import get_utc_time
from letta.log import get_logger
from letta.orm import Agent as AgentModel
from letta.orm import AgentPassage, AgentsTags
from letta.orm import Block as BlockModel
from letta.orm import Identity as IdentityModel
from letta.orm import Source as SourceModel
from letta.orm import SourcePassage, SourcesAgents
from letta.orm import Tool as ToolModel
from letta.orm.enums import ToolType
from letta.orm.errors import NoResultFound
from letta.orm.sandbox_config import AgentEnvironmentVariable as AgentEnvironmentVariableModel
from letta.orm.sqlalchemy_base import AccessType
from letta.orm.sqlite_functions import adapt_array
from letta.schemas.agent import AgentState as PydanticAgentState
from letta.schemas.agent import AgentType, CreateAgent, UpdateAgent
from letta.schemas.block import Block as PydanticBlock
from letta.schemas.block import BlockUpdate
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.llm_config import LLMConfig
from letta.schemas.memory import Memory
from letta.schemas.message import Message as PydanticMessage
from letta.schemas.message import MessageCreate
from letta.schemas.passage import Passage as PydanticPassage
from letta.schemas.source import Source as PydanticSource
from letta.schemas.tool import Tool as PydanticTool
from letta.schemas.tool_rule import ContinueToolRule as PydanticContinueToolRule
from letta.schemas.tool_rule import TerminalToolRule as PydanticTerminalToolRule
from letta.schemas.tool_rule import ToolRule as PydanticToolRule
from letta.schemas.user import User as PydanticUser
from letta.serialize_schemas import MarshmallowAgentSchema
from letta.serialize_schemas.marshmallow_tool import SerializedToolSchema
from letta.serialize_schemas.pydantic_agent_schema import AgentSchema
from letta.services.block_manager import BlockManager
from letta.services.helpers.agent_manager_helper import (
    _apply_filters,
    _apply_identity_filters,
    _apply_pagination,
    _apply_tag_filter,
    _process_relationship,
    _process_tags,
    check_supports_structured_output,
    compile_system_message,
    derive_system_message,
    initialize_message_sequence,
    package_initial_message_sequence,
)
from letta.services.identity_manager import IdentityManager
from letta.services.message_manager import MessageManager
from letta.services.passage_manager import PassageManager
from letta.services.source_manager import SourceManager
from letta.services.tool_manager import ToolManager
from letta.settings import settings
from letta.utils import enforce_types, united_diff

logger = get_logger(__name__)


# Agent Manager Class
class AgentManager:
    """Manager class to handle business logic related to Agents."""

    def __init__(self):
        from letta.server.db import db_context

        self.session_maker = db_context
        self.block_manager = BlockManager()
        self.tool_manager = ToolManager()
        self.source_manager = SourceManager()
        self.message_manager = MessageManager()
        self.passage_manager = PassageManager()
        self.identity_manager = IdentityManager()

    # ======================================================================================================================
    # Basic CRUD operations
    # ======================================================================================================================
    @enforce_types
    def create_agent(
        self,
        agent_create: CreateAgent,
        actor: PydanticUser,
    ) -> PydanticAgentState:
        system = derive_system_message(agent_type=agent_create.agent_type, system=agent_create.system)

        if not agent_create.llm_config or not agent_create.embedding_config:
            raise ValueError("llm_config and embedding_config are required")

        # create blocks (note: cannot be linked into the agent_id is created)
        block_ids = list(agent_create.block_ids or [])  # Create a local copy to avoid modifying the original
        if agent_create.memory_blocks:
            for create_block in agent_create.memory_blocks:
                block = self.block_manager.create_or_update_block(PydanticBlock(**create_block.model_dump(to_orm=True)), actor=actor)
                block_ids.append(block.id)

        # TODO: Remove this block once we deprecate the legacy `tools` field
        # create passed in `tools`
        tool_names = []
        if agent_create.include_base_tools:
            tool_names.extend(BASE_TOOLS + BASE_MEMORY_TOOLS)
        if agent_create.include_multi_agent_tools:
            tool_names.extend(MULTI_AGENT_TOOLS)
        if agent_create.tools:
            tool_names.extend(agent_create.tools)
        # Remove duplicates
        tool_names = list(set(tool_names))

        # add default tool rules
        if agent_create.include_base_tool_rules:
            if not agent_create.tool_rules:
                tool_rules = []
            else:
                tool_rules = agent_create.tool_rules

            # apply default tool rules
            for tool_name in tool_names:
                if tool_name == "send_message" or tool_name == "send_message_to_agent_async":
                    tool_rules.append(PydanticTerminalToolRule(tool_name=tool_name))
                elif tool_name in BASE_TOOLS:
                    tool_rules.append(PydanticContinueToolRule(tool_name=tool_name))
        else:
            tool_rules = agent_create.tool_rules
        # Check tool rules are valid
        if agent_create.tool_rules:
            check_supports_structured_output(model=agent_create.llm_config.model, tool_rules=agent_create.tool_rules)

        tool_ids = agent_create.tool_ids or []
        for tool_name in tool_names:
            tool = self.tool_manager.get_tool_by_name(tool_name=tool_name, actor=actor)
            if tool:
                tool_ids.append(tool.id)
        # Remove duplicates
        tool_ids = list(set(tool_ids))

        # Create the agent
        agent_state = self._create_agent(
            name=agent_create.name,
            system=system,
            agent_type=agent_create.agent_type,
            llm_config=agent_create.llm_config,
            embedding_config=agent_create.embedding_config,
            block_ids=block_ids,
            tool_ids=tool_ids,
            source_ids=agent_create.source_ids or [],
            tags=agent_create.tags or [],
            identity_ids=agent_create.identity_ids or [],
            description=agent_create.description,
            metadata=agent_create.metadata,
            tool_rules=tool_rules,
            actor=actor,
            project_id=agent_create.project_id,
            template_id=agent_create.template_id,
            base_template_id=agent_create.base_template_id,
            message_buffer_autoclear=agent_create.message_buffer_autoclear,
        )

        # If there are provided environment variables, add them in
        if agent_create.tool_exec_environment_variables:
            agent_state = self._set_environment_variables(
                agent_id=agent_state.id,
                env_vars=agent_create.tool_exec_environment_variables,
                actor=actor,
            )

        return self.append_initial_message_sequence_to_in_context_messages(actor, agent_state, agent_create.initial_message_sequence)

    @enforce_types
    def append_initial_message_sequence_to_in_context_messages(
        self, actor: PydanticUser, agent_state: PydanticAgentState, initial_message_sequence: Optional[List[MessageCreate]] = None
    ) -> PydanticAgentState:
        init_messages = initialize_message_sequence(
            agent_state=agent_state, memory_edit_timestamp=get_utc_time(), include_initial_boot_message=True
        )

        if initial_message_sequence is not None:
            # We always need the system prompt up front
            system_message_obj = PydanticMessage.dict_to_message(
                agent_id=agent_state.id,
                user_id=agent_state.created_by_id,
                model=agent_state.llm_config.model,
                openai_message_dict=init_messages[0],
            )
            # Don't use anything else in the pregen sequence, instead use the provided sequence
            init_messages = [system_message_obj]
            init_messages.extend(
                package_initial_message_sequence(agent_state.id, initial_message_sequence, agent_state.llm_config.model, actor)
            )
        else:
            init_messages = [
                PydanticMessage.dict_to_message(
                    agent_id=agent_state.id, user_id=agent_state.created_by_id, model=agent_state.llm_config.model, openai_message_dict=msg
                )
                for msg in init_messages
            ]

        return self.append_to_in_context_messages(init_messages, agent_id=agent_state.id, actor=actor)

    @enforce_types
    def _create_agent(
        self,
        actor: PydanticUser,
        name: str,
        system: str,
        agent_type: AgentType,
        llm_config: LLMConfig,
        embedding_config: EmbeddingConfig,
        block_ids: List[str],
        tool_ids: List[str],
        source_ids: List[str],
        tags: List[str],
        identity_ids: List[str],
        description: Optional[str] = None,
        metadata: Optional[Dict] = None,
        tool_rules: Optional[List[PydanticToolRule]] = None,
        project_id: Optional[str] = None,
        template_id: Optional[str] = None,
        base_template_id: Optional[str] = None,
        message_buffer_autoclear: bool = False,
    ) -> PydanticAgentState:
        """Create a new agent."""
        with self.session_maker() as session:
            # Prepare the agent data
            data = {
                "name": name,
                "system": system,
                "agent_type": agent_type,
                "llm_config": llm_config,
                "embedding_config": embedding_config,
                "organization_id": actor.organization_id,
                "description": description,
                "metadata_": metadata,
                "tool_rules": tool_rules,
                "project_id": project_id,
                "template_id": template_id,
                "base_template_id": base_template_id,
                "message_buffer_autoclear": message_buffer_autoclear,
            }

            # Create the new agent using SqlalchemyBase.create
            new_agent = AgentModel(**data)
            _process_relationship(session, new_agent, "tools", ToolModel, tool_ids, replace=True)
            _process_relationship(session, new_agent, "sources", SourceModel, source_ids, replace=True)
            _process_relationship(session, new_agent, "core_memory", BlockModel, block_ids, replace=True)
            _process_tags(new_agent, tags, replace=True)
            _process_relationship(session, new_agent, "identities", IdentityModel, identity_ids, replace=True)

            new_agent.create(session, actor=actor)

            # Convert to PydanticAgentState and return
            return new_agent.to_pydantic()

    @enforce_types
    def update_agent(self, agent_id: str, agent_update: UpdateAgent, actor: PydanticUser) -> PydanticAgentState:
        agent_state = self._update_agent(agent_id=agent_id, agent_update=agent_update, actor=actor)

        # If there are provided environment variables, add them in
        if agent_update.tool_exec_environment_variables:
            agent_state = self._set_environment_variables(
                agent_id=agent_state.id,
                env_vars=agent_update.tool_exec_environment_variables,
                actor=actor,
            )

        # Rebuild the system prompt if it's different
        if agent_update.system and agent_update.system != agent_state.system:
            agent_state = self.rebuild_system_prompt(agent_id=agent_state.id, actor=actor, force=True, update_timestamp=False)

        return agent_state

    @enforce_types
    def _update_agent(self, agent_id: str, agent_update: UpdateAgent, actor: PydanticUser) -> PydanticAgentState:
        """
        Update an existing agent.

        Args:
            agent_id: The ID of the agent to update.
            agent_update: UpdateAgent object containing the updated fields.
            actor: User performing the action.

        Returns:
            PydanticAgentState: The updated agent as a Pydantic model.
        """
        with self.session_maker() as session:
            # Retrieve the existing agent
            agent = AgentModel.read(db_session=session, identifier=agent_id, actor=actor)

            # Update scalar fields directly
            scalar_fields = {
                "name",
                "system",
                "llm_config",
                "embedding_config",
                "message_ids",
                "tool_rules",
                "description",
                "metadata",
                "project_id",
                "template_id",
                "base_template_id",
                "message_buffer_autoclear",
            }
            for field in scalar_fields:
                value = getattr(agent_update, field, None)
                if value is not None:
                    if field == "metadata":
                        setattr(agent, "metadata_", value)
                    else:
                        setattr(agent, field, value)

            # Update relationships using _process_relationship and _process_tags
            if agent_update.tool_ids is not None:
                _process_relationship(session, agent, "tools", ToolModel, agent_update.tool_ids, replace=True)
            if agent_update.source_ids is not None:
                _process_relationship(session, agent, "sources", SourceModel, agent_update.source_ids, replace=True)
            if agent_update.block_ids is not None:
                _process_relationship(session, agent, "core_memory", BlockModel, agent_update.block_ids, replace=True)
            if agent_update.tags is not None:
                _process_tags(agent, agent_update.tags, replace=True)
            if agent_update.identity_ids is not None:
                _process_relationship(session, agent, "identities", IdentityModel, agent_update.identity_ids, replace=True)

            # Commit and refresh the agent
            agent.update(session, actor=actor)

            # Convert to PydanticAgentState and return
            return agent.to_pydantic()

    # TODO: Make this general and think about how to roll this into sqlalchemybase
    def list_agents(
        self,
        actor: PydanticUser,
        name: Optional[str] = None,
        tags: Optional[List[str]] = None,
        match_all_tags: bool = False,
        before: Optional[str] = None,
        after: Optional[str] = None,
        limit: Optional[int] = 50,
        query_text: Optional[str] = None,
        project_id: Optional[str] = None,
        template_id: Optional[str] = None,
        base_template_id: Optional[str] = None,
        identity_id: Optional[str] = None,
        identifier_keys: Optional[List[str]] = None,
        include_relationships: Optional[List[str]] = None,
    ) -> List[PydanticAgentState]:
        """
        Retrieves agents with optimized filtering and optional field selection.

        Args:
            actor: The User requesting the list
            name (Optional[str]): Filter by agent name.
            tags (Optional[List[str]]): Filter agents by tags.
            match_all_tags (bool): If True, only return agents that match ALL given tags.
            before (Optional[str]): Cursor for pagination.
            after (Optional[str]): Cursor for pagination.
            limit (Optional[int]): Maximum number of agents to return.
            query_text (Optional[str]): Search agents by name.
            project_id (Optional[str]): Filter by project ID.
            template_id (Optional[str]): Filter by template ID.
            base_template_id (Optional[str]): Filter by base template ID.
            identity_id (Optional[str]): Filter by identifier ID.
            identifier_keys (Optional[List[str]]): Search agents by identifier keys.
            include_relationships (Optional[List[str]]): List of fields to load for performance optimization.

        Returns:
            List[PydanticAgentState]: The filtered list of matching agents.
        """
        with self.session_maker() as session:
            query = select(AgentModel).distinct(AgentModel.created_at, AgentModel.id)
            query = AgentModel.apply_access_predicate(query, actor, ["read"], AccessType.ORGANIZATION)

            # Apply filters
            query = _apply_filters(query, name, query_text, project_id, template_id, base_template_id)
            query = _apply_identity_filters(query, identity_id, identifier_keys)
            query = _apply_tag_filter(query, tags, match_all_tags)
            query = _apply_pagination(query, before, after, session)

            query = query.limit(limit)

            agents = session.execute(query).scalars().all()
            return [agent.to_pydantic(include_relationships=include_relationships) for agent in agents]

    @enforce_types
    def list_agents_matching_tags(
        self,
        actor: PydanticUser,
        match_all: List[str],
        match_some: List[str],
        limit: Optional[int] = 50,
    ) -> List[PydanticAgentState]:
        """
        Retrieves agents in the same organization that match all specified `match_all` tags
        and at least one tag from `match_some`. The query is optimized for efficiency by
        leveraging indexed filtering and aggregation.

        Args:
            actor (PydanticUser): The user requesting the agent list.
            match_all (List[str]): Agents must have all these tags.
            match_some (List[str]): Agents must have at least one of these tags.
            limit (Optional[int]): Maximum number of agents to return.

        Returns:
            List[PydanticAgentState: The filtered list of matching agents.
        """
        with self.session_maker() as session:
            query = select(AgentModel).where(AgentModel.organization_id == actor.organization_id)

            if match_all:
                # Subquery to find agent IDs that contain all match_all tags
                subquery = (
                    select(AgentsTags.agent_id)
                    .where(AgentsTags.tag.in_(match_all))
                    .group_by(AgentsTags.agent_id)
                    .having(func.count(AgentsTags.tag) == literal(len(match_all)))
                )
                query = query.where(AgentModel.id.in_(subquery))

            if match_some:
                # Ensures agents match at least one tag in match_some
                query = query.join(AgentsTags).where(AgentsTags.tag.in_(match_some))

            query = query.distinct(AgentModel.id).order_by(AgentModel.id).limit(limit)

            return list(session.execute(query).scalars())

    @enforce_types
    def get_agent_by_id(self, agent_id: str, actor: PydanticUser) -> PydanticAgentState:
        """Fetch an agent by its ID."""
        with self.session_maker() as session:
            agent = AgentModel.read(db_session=session, identifier=agent_id, actor=actor)
            return agent.to_pydantic()

    @enforce_types
    def get_agent_by_name(self, agent_name: str, actor: PydanticUser) -> PydanticAgentState:
        """Fetch an agent by its ID."""
        with self.session_maker() as session:
            agent = AgentModel.read(db_session=session, name=agent_name, actor=actor)
            return agent.to_pydantic()

    @enforce_types
    def delete_agent(self, agent_id: str, actor: PydanticUser) -> None:
        """
        Deletes an agent and its associated relationships.
        Ensures proper permission checks and cascades where applicable.

        Args:
            agent_id: ID of the agent to be deleted.
            actor: User performing the action.

        Raises:
            NoResultFound: If agent doesn't exist
        """
        with self.session_maker() as session:
            # Retrieve the agent
            agent = AgentModel.read(db_session=session, identifier=agent_id, actor=actor)
            # TODO check if it is managing a group
            agent.hard_delete(session)

    @enforce_types
    def serialize(self, agent_id: str, actor: PydanticUser) -> AgentSchema:
        with self.session_maker() as session:
            # Retrieve the agent
            agent = AgentModel.read(db_session=session, identifier=agent_id, actor=actor)
            schema = MarshmallowAgentSchema(session=session, actor=actor)
            data = schema.dump(agent)
            return AgentSchema(**data)

    @enforce_types
    def deserialize(
        self,
        serialized_agent: AgentSchema,
        actor: PydanticUser,
        append_copy_suffix: bool = True,
        override_existing_tools: bool = True,
        project_id: Optional[str] = None,
    ) -> PydanticAgentState:
        serialized_agent = serialized_agent.model_dump()
        tool_data_list = serialized_agent.pop("tools", [])

        with self.session_maker() as session:
            schema = MarshmallowAgentSchema(session=session, actor=actor)
            agent = schema.load(serialized_agent, session=session)
            if append_copy_suffix:
                agent.name += "_copy"
            if project_id:
                agent.project_id = project_id
            agent = agent.create(session, actor=actor)
            pydantic_agent = agent.to_pydantic()

        # Need to do this separately as there's some fancy upsert logic that SqlAlchemy cannot handle
        for tool_data in tool_data_list:
            pydantic_tool = SerializedToolSchema(actor=actor).load(tool_data, transient=True).to_pydantic()

            existing_pydantic_tool = self.tool_manager.get_tool_by_name(pydantic_tool.name, actor=actor)
            # If the tool exists
            # AND EITHER:
            # 1) override_existing_tools is set to False
            # 2) existing_pydantic_tool is NOT any type of Letta core tool
            if existing_pydantic_tool and (
                existing_pydantic_tool.tool_type in {ToolType.LETTA_CORE, ToolType.LETTA_MULTI_AGENT_CORE, ToolType.LETTA_MEMORY_CORE}
                or not override_existing_tools
            ):
                pydantic_tool = existing_pydantic_tool
            else:
                pydantic_tool = self.tool_manager.create_or_update_tool(pydantic_tool, actor=actor)

            pydantic_agent = self.attach_tool(agent_id=pydantic_agent.id, tool_id=pydantic_tool.id, actor=actor)

        return pydantic_agent

    # ======================================================================================================================
    # Per Agent Environment Variable Management
    # ======================================================================================================================
    @enforce_types
    def _set_environment_variables(
        self,
        agent_id: str,
        env_vars: Dict[str, str],
        actor: PydanticUser,
    ) -> PydanticAgentState:
        """
        Adds or replaces the environment variables for the specified agent.

        Args:
            agent_id: The agent id.
            env_vars: A dictionary of environment variable key-value pairs.
            actor: The user performing the action.

        Returns:
            PydanticAgentState: The updated agent as a Pydantic model.
        """
        with self.session_maker() as session:
            # Retrieve the agent
            agent = AgentModel.read(db_session=session, identifier=agent_id, actor=actor)

            # Fetch existing environment variables as a dictionary
            existing_vars = {var.key: var for var in agent.tool_exec_environment_variables}

            # Update or create environment variables
            updated_vars = []
            for key, value in env_vars.items():
                if key in existing_vars:
                    # Update existing variable
                    existing_vars[key].value = value
                    updated_vars.append(existing_vars[key])
                else:
                    # Create new variable
                    updated_vars.append(
                        AgentEnvironmentVariableModel(
                            key=key,
                            value=value,
                            agent_id=agent_id,
                            organization_id=actor.organization_id,
                            created_by_id=actor.id,
                            last_updated_by_id=actor.id,
                        )
                    )

            # Remove stale variables
            stale_keys = set(existing_vars) - set(env_vars)
            agent.tool_exec_environment_variables = [var for var in updated_vars if var.key not in stale_keys]

            # Update the agent in the database
            agent.update(session, actor=actor)

            # Return the updated agent state
            return agent.to_pydantic()

    # ======================================================================================================================
    # In Context Messages Management
    # ======================================================================================================================
    # TODO: There are several assumptions here that are not explicitly checked
    # TODO: 1) These message ids are valid
    # TODO: 2) These messages are ordered from oldest to newest
    # TODO: This can be fixed by having an actual relationship in the ORM for message_ids
    # TODO: This can also be made more efficient, instead of getting, setting, we can do it all in one db session for one query.
    @enforce_types
    def get_in_context_messages(self, agent_id: str, actor: PydanticUser) -> List[PydanticMessage]:
        message_ids = self.get_agent_by_id(agent_id=agent_id, actor=actor).message_ids
        return self.message_manager.get_messages_by_ids(message_ids=message_ids, actor=actor)

    @enforce_types
    def get_system_message(self, agent_id: str, actor: PydanticUser) -> PydanticMessage:
        message_ids = self.get_agent_by_id(agent_id=agent_id, actor=actor).message_ids
        return self.message_manager.get_message_by_id(message_id=message_ids[0], actor=actor)

    @enforce_types
    def rebuild_system_prompt(self, agent_id: str, actor: PydanticUser, force=False, update_timestamp=True) -> PydanticAgentState:
        """Rebuilds the system message with the latest memory object and any shared memory block updates

        Updates to core memory blocks should trigger a "rebuild", which itself will create a new message object

        Updates to the memory header should *not* trigger a rebuild, since that will simply flood recall storage with excess messages
        """
        agent_state = self.get_agent_by_id(agent_id=agent_id, actor=actor)

        curr_system_message = self.get_system_message(
            agent_id=agent_id, actor=actor
        )  # this is the system + memory bank, not just the system prompt
        curr_system_message_openai = curr_system_message.to_openai_dict()

        # note: we only update the system prompt if the core memory is changed
        # this means that the archival/recall memory statistics may be someout out of date
        curr_memory_str = agent_state.memory.compile()
        if curr_memory_str in curr_system_message_openai["content"] and not force:
            # NOTE: could this cause issues if a block is removed? (substring match would still work)
            logger.debug(
                f"Memory hasn't changed for agent id={agent_id} and actor=({actor.id}, {actor.name}), skipping system prompt rebuild"
            )
            return agent_state

        # If the memory didn't update, we probably don't want to update the timestamp inside
        # For example, if we're doing a system prompt swap, this should probably be False
        if update_timestamp:
            memory_edit_timestamp = get_utc_time()
        else:
            # NOTE: a bit of a hack - we pull the timestamp from the message created_by
            memory_edit_timestamp = curr_system_message.created_at

        num_messages = self.message_manager.size(actor=actor, agent_id=agent_id)
        num_archival_memories = self.passage_manager.size(actor=actor, agent_id=agent_id)

        # update memory (TODO: potentially update recall/archival stats separately)
        new_system_message_str = compile_system_message(
            system_prompt=agent_state.system,
            in_context_memory=agent_state.memory,
            in_context_memory_last_edit=memory_edit_timestamp,
            recent_passages=self.list_passages(actor=actor, agent_id=agent_id, ascending=False, limit=10),
            previous_message_count=num_messages,
            archival_memory_size=num_archival_memories,
        )

        diff = united_diff(curr_system_message_openai["content"], new_system_message_str)
        if len(diff) > 0:  # there was a diff
            logger.info(f"Rebuilding system with new memory...\nDiff:\n{diff}")

            # Swap the system message out (only if there is a diff)
            message = PydanticMessage.dict_to_message(
                agent_id=agent_id,
                user_id=actor.id,
                model=agent_state.llm_config.model,
                openai_message_dict={"role": "system", "content": new_system_message_str},
            )
            # TODO: This seems kind of silly, why not just update the message?
            message = self.message_manager.create_message(message, actor=actor)
            message_ids = [message.id] + agent_state.message_ids[1:]  # swap index 0 (system)
            return self.set_in_context_messages(agent_id=agent_id, message_ids=message_ids, actor=actor)
        else:
            return agent_state

    @enforce_types
    def set_in_context_messages(self, agent_id: str, message_ids: List[str], actor: PydanticUser) -> PydanticAgentState:
        return self.update_agent(agent_id=agent_id, agent_update=UpdateAgent(message_ids=message_ids), actor=actor)

    @enforce_types
    def trim_older_in_context_messages(self, num: int, agent_id: str, actor: PydanticUser) -> PydanticAgentState:
        message_ids = self.get_agent_by_id(agent_id=agent_id, actor=actor).message_ids
        new_messages = [message_ids[0]] + message_ids[num:]  # 0 is system message
        return self.set_in_context_messages(agent_id=agent_id, message_ids=new_messages, actor=actor)

    @enforce_types
    def trim_all_in_context_messages_except_system(self, agent_id: str, actor: PydanticUser) -> PydanticAgentState:
        message_ids = self.get_agent_by_id(agent_id=agent_id, actor=actor).message_ids
        # TODO: How do we know this?
        new_messages = [message_ids[0]]  # 0 is system message
        return self.set_in_context_messages(agent_id=agent_id, message_ids=new_messages, actor=actor)

    @enforce_types
    def prepend_to_in_context_messages(self, messages: List[PydanticMessage], agent_id: str, actor: PydanticUser) -> PydanticAgentState:
        message_ids = self.get_agent_by_id(agent_id=agent_id, actor=actor).message_ids
        new_messages = self.message_manager.create_many_messages(messages, actor=actor)
        message_ids = [message_ids[0]] + [m.id for m in new_messages] + message_ids[1:]
        return self.set_in_context_messages(agent_id=agent_id, message_ids=message_ids, actor=actor)

    @enforce_types
    def append_to_in_context_messages(self, messages: List[PydanticMessage], agent_id: str, actor: PydanticUser) -> PydanticAgentState:
        messages = self.message_manager.create_many_messages(messages, actor=actor)
        message_ids = self.get_agent_by_id(agent_id=agent_id, actor=actor).message_ids or []
        message_ids += [m.id for m in messages]
        return self.set_in_context_messages(agent_id=agent_id, message_ids=message_ids, actor=actor)

    @enforce_types
    def reset_messages(self, agent_id: str, actor: PydanticUser, add_default_initial_messages: bool = False) -> PydanticAgentState:
        """
        Removes all in-context messages for the specified agent by:
          1) Clearing the agent.messages relationship (which cascades delete-orphans).
          2) Resetting the message_ids list to empty.
          3) Committing the transaction.

        This action is destructive and cannot be undone once committed.

        Args:
            add_default_initial_messages: If true, adds the default initial messages after resetting.
            agent_id (str): The ID of the agent whose messages will be reset.
            actor (PydanticUser): The user performing this action.

        Returns:
            PydanticAgentState: The updated agent state with no linked messages.
        """
        with self.session_maker() as session:
            # Retrieve the existing agent (will raise NoResultFound if invalid)
            agent = AgentModel.read(db_session=session, identifier=agent_id, actor=actor)

            # Because of cascade="all, delete-orphan" on agent.messages, setting
            # this relationship to an empty list will physically remove them from the DB.
            agent.messages = []

            # Also clear out the message_ids field to keep in-context memory consistent
            agent.message_ids = []

            # Commit the update
            agent.update(db_session=session, actor=actor)

            agent_state = agent.to_pydantic()

        if add_default_initial_messages:
            return self.append_initial_message_sequence_to_in_context_messages(actor, agent_state)
        else:
            # We still want to always have a system message
            init_messages = initialize_message_sequence(
                agent_state=agent_state, memory_edit_timestamp=get_utc_time(), include_initial_boot_message=True
            )
            system_message = PydanticMessage.dict_to_message(
                agent_id=agent_state.id,
                user_id=agent_state.created_by_id,
                model=agent_state.llm_config.model,
                openai_message_dict=init_messages[0],
            )
            return self.append_to_in_context_messages([system_message], agent_id=agent_state.id, actor=actor)

    # TODO: I moved this from agent.py - replace all mentions of this with the agent_manager version
    @enforce_types
    def update_memory_if_changed(self, agent_id: str, new_memory: Memory, actor: PydanticUser) -> PydanticAgentState:
        """
        Update internal memory object and system prompt if there have been modifications.

        Args:
            new_memory (Memory): the new memory object to compare to the current memory object

        Returns:
            modified (bool): whether the memory was updated
        """
        agent_state = self.get_agent_by_id(agent_id=agent_id, actor=actor)
        if agent_state.memory.compile() != new_memory.compile():
            # update the blocks (LRW) in the DB
            for label in agent_state.memory.list_block_labels():
                updated_value = new_memory.get_block(label).value
                if updated_value != agent_state.memory.get_block(label).value:
                    # update the block if it's changed
                    block_id = agent_state.memory.get_block(label).id
                    block = self.block_manager.update_block(block_id=block_id, block_update=BlockUpdate(value=updated_value), actor=actor)

            # refresh memory from DB (using block ids)
            agent_state.memory = Memory(
                blocks=[self.block_manager.get_block_by_id(block.id, actor=actor) for block in agent_state.memory.get_blocks()]
            )

            # NOTE: don't do this since re-buildin the memory is handled at the start of the step
            # rebuild memory - this records the last edited timestamp of the memory
            # TODO: pass in update timestamp from block edit time
            agent_state = self.rebuild_system_prompt(agent_id=agent_id, actor=actor)

        return agent_state

    # ======================================================================================================================
    # Source Management
    # ======================================================================================================================
    @enforce_types
    def attach_source(self, agent_id: str, source_id: str, actor: PydanticUser) -> PydanticAgentState:
        """
        Attaches a source to an agent.

        Args:
            agent_id: ID of the agent to attach the source to
            source_id: ID of the source to attach
            actor: User performing the action

        Raises:
            ValueError: If either agent or source doesn't exist
            IntegrityError: If the source is already attached to the agent
        """

        with self.session_maker() as session:
            # Verify both agent and source exist and user has permission to access them
            agent = AgentModel.read(db_session=session, identifier=agent_id, actor=actor)

            # The _process_relationship helper already handles duplicate checking via unique constraint
            _process_relationship(
                session=session,
                agent=agent,
                relationship_name="sources",
                model_class=SourceModel,
                item_ids=[source_id],
                allow_partial=False,
                replace=False,  # Extend existing sources rather than replace
            )

            # Commit the changes
            agent.update(session, actor=actor)

        # Force rebuild of system prompt so that the agent is updated with passage count
        # and recent passages and add system message alert to agent
        self.rebuild_system_prompt(agent_id=agent_id, actor=actor, force=True)
        self.append_system_message(
            agent_id=agent_id,
            content=DATA_SOURCE_ATTACH_ALERT,
            actor=actor,
        )

        return agent.to_pydantic()

    @enforce_types
    def append_system_message(self, agent_id: str, content: str, actor: PydanticUser):

        # get the agent
        agent = self.get_agent_by_id(agent_id=agent_id, actor=actor)
        message = PydanticMessage.dict_to_message(
            agent_id=agent.id, user_id=actor.id, model=agent.llm_config.model, openai_message_dict={"role": "system", "content": content}
        )

        # update agent in-context message IDs
        self.append_to_in_context_messages(messages=[message], agent_id=agent_id, actor=actor)

    @enforce_types
    def list_attached_sources(self, agent_id: str, actor: PydanticUser) -> List[PydanticSource]:
        """
        Lists all sources attached to an agent.

        Args:
            agent_id: ID of the agent to list sources for
            actor: User performing the action

        Returns:
            List[str]: List of source IDs attached to the agent
        """
        with self.session_maker() as session:
            # Verify agent exists and user has permission to access it
            agent = AgentModel.read(db_session=session, identifier=agent_id, actor=actor)

            # Use the lazy-loaded relationship to get sources
            return [source.to_pydantic() for source in agent.sources]

    @enforce_types
    def detach_source(self, agent_id: str, source_id: str, actor: PydanticUser) -> PydanticAgentState:
        """
        Detaches a source from an agent.

        Args:
            agent_id: ID of the agent to detach the source from
            source_id: ID of the source to detach
            actor: User performing the action
        """
        with self.session_maker() as session:
            # Verify agent exists and user has permission to access it
            agent = AgentModel.read(db_session=session, identifier=agent_id, actor=actor)

            # Remove the source from the relationship
            remaining_sources = [s for s in agent.sources if s.id != source_id]

            if len(remaining_sources) == len(agent.sources):  # Source ID was not in the relationship
                logger.warning(f"Attempted to remove unattached source id={source_id} from agent id={agent_id} by actor={actor}")

            # Update the sources relationship
            agent.sources = remaining_sources

            # Commit the changes
            agent.update(session, actor=actor)
            return agent.to_pydantic()

    # ======================================================================================================================
    # Block management
    # ======================================================================================================================
    @enforce_types
    def get_block_with_label(
        self,
        agent_id: str,
        block_label: str,
        actor: PydanticUser,
    ) -> PydanticBlock:
        """Gets a block attached to an agent by its label."""
        with self.session_maker() as session:
            agent = AgentModel.read(db_session=session, identifier=agent_id, actor=actor)
            for block in agent.core_memory:
                if block.label == block_label:
                    return block.to_pydantic()
            raise NoResultFound(f"No block with label '{block_label}' found for agent '{agent_id}'")

    @enforce_types
    def update_block_with_label(
        self,
        agent_id: str,
        block_label: str,
        new_block_id: str,
        actor: PydanticUser,
    ) -> PydanticAgentState:
        """Updates which block is assigned to a specific label for an agent."""
        with self.session_maker() as session:
            agent = AgentModel.read(db_session=session, identifier=agent_id, actor=actor)
            new_block = BlockModel.read(db_session=session, identifier=new_block_id, actor=actor)

            if new_block.label != block_label:
                raise ValueError(f"New block label '{new_block.label}' doesn't match required label '{block_label}'")

            # Remove old block with this label if it exists
            agent.core_memory = [b for b in agent.core_memory if b.label != block_label]

            # Add new block
            agent.core_memory.append(new_block)
            agent.update(session, actor=actor)
            return agent.to_pydantic()

    @enforce_types
    def attach_block(self, agent_id: str, block_id: str, actor: PydanticUser) -> PydanticAgentState:
        """Attaches a block to an agent."""
        with self.session_maker() as session:
            agent = AgentModel.read(db_session=session, identifier=agent_id, actor=actor)
            block = BlockModel.read(db_session=session, identifier=block_id, actor=actor)

            agent.core_memory.append(block)
            agent.update(session, actor=actor)
            return agent.to_pydantic()

    @enforce_types
    def detach_block(
        self,
        agent_id: str,
        block_id: str,
        actor: PydanticUser,
    ) -> PydanticAgentState:
        """Detaches a block from an agent."""
        with self.session_maker() as session:
            agent = AgentModel.read(db_session=session, identifier=agent_id, actor=actor)
            original_length = len(agent.core_memory)

            agent.core_memory = [b for b in agent.core_memory if b.id != block_id]

            if len(agent.core_memory) == original_length:
                raise NoResultFound(f"No block with id '{block_id}' found for agent '{agent_id}' with actor id: '{actor.id}'")

            agent.update(session, actor=actor)
            return agent.to_pydantic()

    @enforce_types
    def detach_block_with_label(
        self,
        agent_id: str,
        block_label: str,
        actor: PydanticUser,
    ) -> PydanticAgentState:
        """Detaches a block with the specified label from an agent."""
        with self.session_maker() as session:
            agent = AgentModel.read(db_session=session, identifier=agent_id, actor=actor)
            original_length = len(agent.core_memory)

            agent.core_memory = [b for b in agent.core_memory if b.label != block_label]

            if len(agent.core_memory) == original_length:
                raise NoResultFound(f"No block with label '{block_label}' found for agent '{agent_id}' with actor id: '{actor.id}'")

            agent.update(session, actor=actor)
            return agent.to_pydantic()

    # ======================================================================================================================
    # Passage Management
    # ======================================================================================================================
    def _build_passage_query(
        self,
        actor: PydanticUser,
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

        with self.session_maker() as session:
            # Start with base query for source passages
            source_passages = None
            if not agent_only:  # Include source passages
                if agent_id is not None:
                    source_passages = (
                        select(SourcePassage, literal(None).label("agent_id"))
                        .join(SourcesAgents, SourcesAgents.source_id == SourcePassage.source_id)
                        .where(SourcesAgents.agent_id == agent_id)
                        .where(SourcePassage.organization_id == actor.organization_id)
                    )
                else:
                    source_passages = select(SourcePassage, literal(None).label("agent_id")).where(
                        SourcePassage.organization_id == actor.organization_id
                    )

                if source_id:
                    source_passages = source_passages.where(SourcePassage.source_id == source_id)
                if file_id:
                    source_passages = source_passages.where(SourcePassage.file_id == file_id)

            # Add agent passages query
            agent_passages = None
            if agent_id is not None:
                agent_passages = (
                    select(
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
                    before_ref = (
                        select(combined_query.c.created_at, combined_query.c.id).where(combined_query.c.id == before).cte("before_ref")
                    )
                if after:
                    after_ref = (
                        select(combined_query.c.created_at, combined_query.c.id).where(combined_query.c.id == after).cte("after_ref")
                    )

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

    @enforce_types
    def list_passages(
        self,
        actor: PydanticUser,
        agent_id: Optional[str] = None,
        file_id: Optional[str] = None,
        limit: Optional[int] = 50,
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
    ) -> List[PydanticPassage]:
        """Lists all passages attached to an agent."""
        with self.session_maker() as session:
            main_query = self._build_passage_query(
                actor=actor,
                agent_id=agent_id,
                file_id=file_id,
                query_text=query_text,
                start_date=start_date,
                end_date=end_date,
                before=before,
                after=after,
                source_id=source_id,
                embed_query=embed_query,
                ascending=ascending,
                embedding_config=embedding_config,
                agent_only=agent_only,
            )

            # Add limit
            if limit:
                main_query = main_query.limit(limit)

            # Execute query
            results = list(session.execute(main_query))

            passages = []
            for row in results:
                data = dict(row._mapping)
                if data["agent_id"] is not None:
                    # This is an AgentPassage - remove source fields
                    data.pop("source_id", None)
                    data.pop("file_id", None)
                    passage = AgentPassage(**data)
                else:
                    # This is a SourcePassage - remove agent field
                    data.pop("agent_id", None)
                    passage = SourcePassage(**data)
                passages.append(passage)

            return [p.to_pydantic() for p in passages]

    @enforce_types
    def passage_size(
        self,
        actor: PydanticUser,
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
    ) -> int:
        """Returns the count of passages matching the given criteria."""
        with self.session_maker() as session:
            main_query = self._build_passage_query(
                actor=actor,
                agent_id=agent_id,
                file_id=file_id,
                query_text=query_text,
                start_date=start_date,
                end_date=end_date,
                before=before,
                after=after,
                source_id=source_id,
                embed_query=embed_query,
                ascending=ascending,
                embedding_config=embedding_config,
                agent_only=agent_only,
            )

            # Convert to count query
            count_query = select(func.count()).select_from(main_query.subquery())
            return session.scalar(count_query) or 0

    # ======================================================================================================================
    # Tool Management
    # ======================================================================================================================
    @enforce_types
    def attach_tool(self, agent_id: str, tool_id: str, actor: PydanticUser) -> PydanticAgentState:
        """
        Attaches a tool to an agent.

        Args:
            agent_id: ID of the agent to attach the tool to.
            tool_id: ID of the tool to attach.
            actor: User performing the action.

        Raises:
            NoResultFound: If the agent or tool is not found.

        Returns:
            PydanticAgentState: The updated agent state.
        """
        with self.session_maker() as session:
            # Verify the agent exists and user has permission to access it
            agent = AgentModel.read(db_session=session, identifier=agent_id, actor=actor)

            # Use the _process_relationship helper to attach the tool
            _process_relationship(
                session=session,
                agent=agent,
                relationship_name="tools",
                model_class=ToolModel,
                item_ids=[tool_id],
                allow_partial=False,  # Ensure the tool exists
                replace=False,  # Extend the existing tools
            )

            # Commit and refresh the agent
            agent.update(session, actor=actor)
            return agent.to_pydantic()

    @enforce_types
    def detach_tool(self, agent_id: str, tool_id: str, actor: PydanticUser) -> PydanticAgentState:
        """
        Detaches a tool from an agent.

        Args:
            agent_id: ID of the agent to detach the tool from.
            tool_id: ID of the tool to detach.
            actor: User performing the action.

        Raises:
            NoResultFound: If the agent or tool is not found.

        Returns:
            PydanticAgentState: The updated agent state.
        """
        with self.session_maker() as session:
            # Verify the agent exists and user has permission to access it
            agent = AgentModel.read(db_session=session, identifier=agent_id, actor=actor)

            # Filter out the tool to be detached
            remaining_tools = [tool for tool in agent.tools if tool.id != tool_id]

            if len(remaining_tools) == len(agent.tools):  # Tool ID was not in the relationship
                logger.warning(f"Attempted to remove unattached tool id={tool_id} from agent id={agent_id} by actor={actor}")

            # Update the tools relationship
            agent.tools = remaining_tools

            # Commit and refresh the agent
            agent.update(session, actor=actor)
            return agent.to_pydantic()

    @enforce_types
    def list_attached_tools(self, agent_id: str, actor: PydanticUser) -> List[PydanticTool]:
        """
        List all tools attached to an agent.

        Args:
            agent_id: ID of the agent to list tools for.
            actor: User performing the action.

        Returns:
            List[PydanticTool]: List of tools attached to the agent.
        """
        with self.session_maker() as session:
            agent = AgentModel.read(db_session=session, identifier=agent_id, actor=actor)
            return [tool.to_pydantic() for tool in agent.tools]

    # ======================================================================================================================
    # Tag Management
    # ======================================================================================================================
    @enforce_types
    def list_tags(
        self, actor: PydanticUser, after: Optional[str] = None, limit: Optional[int] = 50, query_text: Optional[str] = None
    ) -> List[str]:
        """
        Get all tags a user has created, ordered alphabetically.

        Args:
            actor: User performing the action.
            after: Cursor for forward pagination.
            limit: Maximum number of tags to return.
            query_text: Query text to filter tags by.

        Returns:
            List[str]: List of all tags.
        """
        with self.session_maker() as session:
            query = (
                session.query(AgentsTags.tag)
                .join(AgentModel, AgentModel.id == AgentsTags.agent_id)
                .filter(AgentModel.organization_id == actor.organization_id)
                .distinct()
            )

            if query_text:
                query = query.filter(AgentsTags.tag.ilike(f"%{query_text}%"))

            if after:
                query = query.filter(AgentsTags.tag > after)

            query = query.order_by(AgentsTags.tag).limit(limit)
            results = [tag[0] for tag in query.all()]
            return results
