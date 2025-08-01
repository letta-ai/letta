import asyncio
import os
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set, Tuple

import sqlalchemy as sa
from sqlalchemy import delete, func, insert, literal, or_, select, tuple_
from sqlalchemy.dialects.postgresql import insert as pg_insert

from letta.constants import (
    BASE_MEMORY_TOOLS,
    BASE_MEMORY_TOOLS_V2,
    BASE_SLEEPTIME_CHAT_TOOLS,
    BASE_SLEEPTIME_TOOLS,
    BASE_TOOLS,
    BASE_VOICE_SLEEPTIME_CHAT_TOOLS,
    BASE_VOICE_SLEEPTIME_TOOLS,
    DEFAULT_CORE_MEMORY_SOURCE_CHAR_LIMIT,
    DEFAULT_MAX_FILES_OPEN,
    DEFAULT_TIMEZONE,
    DEPRECATED_LETTA_TOOLS,
    FILES_TOOLS,
)
from letta.helpers import ToolRulesSolver
from letta.helpers.datetime_helpers import get_utc_time
from letta.llm_api.llm_client import LLMClient
from letta.log import get_logger
from letta.orm import Agent as AgentModel
from letta.orm import AgentPassage, AgentsTags
from letta.orm import Block as BlockModel
from letta.orm import BlocksAgents
from letta.orm import Group as GroupModel
from letta.orm import GroupsAgents, IdentitiesAgents
from letta.orm import Source as SourceModel
from letta.orm import SourcePassage, SourcesAgents
from letta.orm import Tool as ToolModel
from letta.orm import ToolsAgents
from letta.orm.enums import ToolType
from letta.orm.errors import NoResultFound
from letta.orm.sandbox_config import AgentEnvironmentVariable
from letta.orm.sandbox_config import AgentEnvironmentVariable as AgentEnvironmentVariableModel
from letta.orm.sqlalchemy_base import AccessType
from letta.otel.tracing import trace_method
from letta.schemas.agent import AgentState as PydanticAgentState
from letta.schemas.agent import AgentType, CreateAgent, UpdateAgent, get_prompt_template_for_agent_type
from letta.schemas.block import DEFAULT_BLOCKS
from letta.schemas.block import Block as PydanticBlock
from letta.schemas.block import BlockUpdate
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import ProviderType
from letta.schemas.file import FileMetadata as PydanticFileMetadata
from letta.schemas.group import Group as PydanticGroup
from letta.schemas.group import ManagerType
from letta.schemas.memory import ContextWindowOverview, Memory
from letta.schemas.message import Message
from letta.schemas.message import Message as PydanticMessage
from letta.schemas.message import MessageCreate, MessageUpdate
from letta.schemas.passage import Passage as PydanticPassage
from letta.schemas.source import Source as PydanticSource
from letta.schemas.tool import Tool as PydanticTool
from letta.schemas.tool_rule import ContinueToolRule, TerminalToolRule
from letta.schemas.user import User as PydanticUser
from letta.serialize_schemas import MarshmallowAgentSchema
from letta.serialize_schemas.marshmallow_message import SerializedMessageSchema
from letta.serialize_schemas.marshmallow_tool import SerializedToolSchema
from letta.serialize_schemas.pydantic_agent_schema import AgentSchema
from letta.server.db import db_registry
from letta.services.block_manager import BlockManager
from letta.services.context_window_calculator.context_window_calculator import ContextWindowCalculator
from letta.services.context_window_calculator.token_counter import AnthropicTokenCounter, TiktokenCounter
from letta.services.file_processor.chunker.line_chunker import LineChunker
from letta.services.files_agents_manager import FileAgentManager
from letta.services.helpers.agent_manager_helper import (
    _apply_filters,
    _apply_identity_filters,
    _apply_pagination,
    _apply_pagination_async,
    _apply_relationship_filters,
    _apply_tag_filter,
    _process_relationship,
    _process_relationship_async,
    build_agent_passage_query,
    build_passage_query,
    build_source_passage_query,
    calculate_base_tools,
    calculate_multi_agent_tools,
    check_supports_structured_output,
    compile_system_message,
    compile_system_message_async,
    derive_system_message,
    initialize_message_sequence,
    initialize_message_sequence_async,
    package_initial_message_sequence,
    validate_agent_exists_async,
)
from letta.services.identity_manager import IdentityManager
from letta.services.message_manager import MessageManager
from letta.services.passage_manager import PassageManager
from letta.services.source_manager import SourceManager
from letta.services.tool_manager import ToolManager
from letta.settings import DatabaseChoice, settings
from letta.utils import calculate_file_defaults_based_on_context_window, enforce_types, united_diff

logger = get_logger(__name__)


class AgentManager:
    """Manager class to handle business logic related to Agents."""

    def __init__(self):
        self.block_manager = BlockManager()
        self.tool_manager = ToolManager()
        self.source_manager = SourceManager()
        self.message_manager = MessageManager()
        self.passage_manager = PassageManager()
        self.identity_manager = IdentityManager()
        self.file_agent_manager = FileAgentManager()

    @staticmethod
    def _resolve_tools(session, names: Set[str], ids: Set[str], org_id: str) -> Tuple[Dict[str, str], Dict[str, str]]:
        """
        Bulk‑fetch all ToolModel rows matching either name ∈ names or id ∈ ids
        (and scoped to this organization), and return two maps:
          name_to_id, id_to_name.
        Raises if any requested name or id was not found.
        """
        stmt = select(ToolModel.id, ToolModel.name).where(
            ToolModel.organization_id == org_id,
            or_(
                ToolModel.name.in_(names),
                ToolModel.id.in_(ids),
            ),
        )
        rows = session.execute(stmt).all()
        name_to_id = {name: tid for tid, name in rows}
        id_to_name = {tid: name for tid, name in rows}

        missing_names = names - set(name_to_id.keys())
        missing_ids = ids - set(id_to_name.keys())
        if missing_names:
            raise ValueError(f"Tools not found by name: {missing_names}")
        if missing_ids:
            raise ValueError(f"Tools not found by id:   {missing_ids}")

        return name_to_id, id_to_name

    @staticmethod
    async def _resolve_tools_async(session, names: Set[str], ids: Set[str], org_id: str) -> Tuple[Dict[str, str], Dict[str, str]]:
        """
        Bulk‑fetch all ToolModel rows matching either name ∈ names or id ∈ ids
        (and scoped to this organization), and return two maps:
          name_to_id, id_to_name.
        Raises if any requested name or id was not found.
        """
        stmt = select(ToolModel.id, ToolModel.name).where(
            ToolModel.organization_id == org_id,
            or_(
                ToolModel.name.in_(names),
                ToolModel.id.in_(ids),
            ),
        )
        result = await session.execute(stmt)
        rows = result.fetchall()  # Use fetchall()
        name_to_id = {row[1]: row[0] for row in rows}  # row[1] is name, row[0] is id
        id_to_name = {row[0]: row[1] for row in rows}  # row[0] is id, row[1] is name

        missing_names = names - set(name_to_id.keys())
        missing_ids = ids - set(id_to_name.keys())
        if missing_names:
            raise ValueError(f"Tools not found by name: {missing_names}")
        if missing_ids:
            raise ValueError(f"Tools not found by id:   {missing_ids}")

        return name_to_id, id_to_name

    @staticmethod
    def _bulk_insert_pivot(session, table, rows: list[dict]):
        if not rows:
            return

        dialect = session.bind.dialect.name
        if dialect == "postgresql":
            stmt = pg_insert(table).values(rows).on_conflict_do_nothing()
        elif dialect == "sqlite":
            stmt = sa.insert(table).values(rows).prefix_with("OR IGNORE")
        else:
            # fallback: filter out exact-duplicate dicts in Python
            seen = set()
            filtered = []
            for row in rows:
                key = tuple(sorted(row.items()))
                if key not in seen:
                    seen.add(key)
                    filtered.append(row)
            stmt = sa.insert(table).values(filtered)

        session.execute(stmt)

    @staticmethod
    async def _bulk_insert_pivot_async(session, table, rows: list[dict]):
        if not rows:
            return

        dialect = session.bind.dialect.name
        if dialect == "postgresql":
            stmt = pg_insert(table).values(rows).on_conflict_do_nothing()
        elif dialect == "sqlite":
            stmt = sa.insert(table).values(rows).prefix_with("OR IGNORE")
        else:
            # fallback: filter out exact-duplicate dicts in Python
            seen = set()
            filtered = []
            for row in rows:
                key = tuple(sorted(row.items()))
                if key not in seen:
                    seen.add(key)
                    filtered.append(row)
            stmt = sa.insert(table).values(filtered)

        await session.execute(stmt)

    @staticmethod
    def _replace_pivot_rows(session, table, agent_id: str, rows: list[dict]):
        """
        Replace all pivot rows for an agent with *exactly* the provided list.
        Uses two bulk statements (DELETE + INSERT ... ON CONFLICT DO NOTHING).
        """
        # delete all existing rows for this agent
        session.execute(delete(table).where(table.c.agent_id == agent_id))
        if rows:
            AgentManager._bulk_insert_pivot(session, table, rows)

    @staticmethod
    async def _replace_pivot_rows_async(session, table, agent_id: str, rows: list[dict]):
        """
        Replace all pivot rows for an agent atomically using MERGE pattern.
        """
        dialect = session.bind.dialect.name

        if dialect == "postgresql":
            if rows:
                # separate upsert and delete operations
                stmt = pg_insert(table).values(rows)
                stmt = stmt.on_conflict_do_nothing()
                await session.execute(stmt)

                # delete rows not in new set
                pk_names = [c.name for c in table.primary_key.columns]
                new_keys = [tuple(r[c] for c in pk_names) for r in rows]
                await session.execute(
                    delete(table).where(table.c.agent_id == agent_id, ~tuple_(*[table.c[c] for c in pk_names]).in_(new_keys))
                )
            else:
                # if no rows to insert, just delete all
                await session.execute(delete(table).where(table.c.agent_id == agent_id))

        elif dialect == "sqlite":
            if rows:
                stmt = sa.insert(table).values(rows).prefix_with("OR REPLACE")
                await session.execute(stmt)

            if rows:
                primary_key_cols = [table.c[c.name] for c in table.primary_key.columns]
                new_keys = [tuple(r[c.name] for c in table.primary_key.columns) for r in rows]
                await session.execute(delete(table).where(table.c.agent_id == agent_id, ~tuple_(*primary_key_cols).in_(new_keys)))
            else:
                await session.execute(delete(table).where(table.c.agent_id == agent_id))

        else:
            # fallback: use original DELETE + INSERT pattern
            await session.execute(delete(table).where(table.c.agent_id == agent_id))
            if rows:
                await AgentManager._bulk_insert_pivot_async(session, table, rows)

    # ======================================================================================================================
    # Basic CRUD operations
    # ======================================================================================================================
    @trace_method
    def create_agent(self, agent_create: CreateAgent, actor: PydanticUser, _test_only_force_id: Optional[str] = None) -> PydanticAgentState:
        # validate required configs
        if not agent_create.llm_config or not agent_create.embedding_config:
            raise ValueError("llm_config and embedding_config are required")

        # blocks
        block_ids = list(agent_create.block_ids or [])
        if agent_create.memory_blocks:
            pydantic_blocks = [PydanticBlock(**b.model_dump(to_orm=True)) for b in agent_create.memory_blocks]
            created_blocks = self.block_manager.batch_create_blocks(
                pydantic_blocks,
                actor=actor,
            )
            block_ids.extend([blk.id for blk in created_blocks])

        # tools
        tool_names = set(agent_create.tools or [])
        if agent_create.include_base_tools:
            if agent_create.agent_type == AgentType.voice_sleeptime_agent:
                tool_names |= set(BASE_VOICE_SLEEPTIME_TOOLS)
            elif agent_create.agent_type == AgentType.voice_convo_agent:
                tool_names |= set(BASE_VOICE_SLEEPTIME_CHAT_TOOLS)
            elif agent_create.agent_type == AgentType.sleeptime_agent:
                tool_names |= set(BASE_SLEEPTIME_TOOLS)
            elif agent_create.enable_sleeptime:
                tool_names |= set(BASE_SLEEPTIME_CHAT_TOOLS)
            elif agent_create.agent_type == AgentType.memgpt_v2_agent:
                tool_names |= calculate_base_tools(is_v2=True)
            elif agent_create.agent_type == AgentType.react_agent:
                pass  # no default tools
            elif agent_create.agent_type == AgentType.workflow_agent:
                pass  # no default tools
            else:
                tool_names |= calculate_base_tools(is_v2=False)
        if agent_create.include_multi_agent_tools:
            tool_names |= calculate_multi_agent_tools()

        supplied_ids = set(agent_create.tool_ids or [])

        source_ids = agent_create.source_ids or []
        identity_ids = agent_create.identity_ids or []
        tag_values = agent_create.tags or []

        with db_registry.session() as session:
            with session.begin():
                name_to_id, id_to_name = self._resolve_tools(
                    session,
                    tool_names,
                    supplied_ids,
                    actor.organization_id,
                )

                tool_ids = set(name_to_id.values()) | set(id_to_name.keys())
                tool_names = set(name_to_id.keys())  # now canonical

                tool_rules = list(agent_create.tool_rules or [])
                if agent_create.include_base_tool_rules:
                    for tn in tool_names:
                        if tn in {"send_message", "send_message_to_agent_async", "memory_finish_edits"}:
                            tool_rules.append(TerminalToolRule(tool_name=tn))
                        elif tn in (BASE_TOOLS + BASE_MEMORY_TOOLS + BASE_SLEEPTIME_TOOLS):
                            tool_rules.append(ContinueToolRule(tool_name=tn))

                if tool_rules:
                    check_supports_structured_output(model=agent_create.llm_config.model, tool_rules=tool_rules)

                new_agent = AgentModel(
                    name=agent_create.name,
                    system=derive_system_message(
                        agent_type=agent_create.agent_type,
                        enable_sleeptime=agent_create.enable_sleeptime,
                        system=agent_create.system,
                    ),
                    agent_type=agent_create.agent_type,
                    llm_config=agent_create.llm_config,
                    embedding_config=agent_create.embedding_config,
                    organization_id=actor.organization_id,
                    description=agent_create.description,
                    metadata_=agent_create.metadata,
                    tool_rules=tool_rules,
                    project_id=agent_create.project_id,
                    template_id=agent_create.template_id,
                    base_template_id=agent_create.base_template_id,
                    message_buffer_autoclear=agent_create.message_buffer_autoclear,
                    enable_sleeptime=agent_create.enable_sleeptime,
                    response_format=agent_create.response_format,
                    created_by_id=actor.id,
                    last_updated_by_id=actor.id,
                    timezone=agent_create.timezone,
                    max_files_open=agent_create.max_files_open,
                    per_file_view_window_char_limit=agent_create.per_file_view_window_char_limit,
                )

                if _test_only_force_id:
                    new_agent.id = _test_only_force_id

                session.add(new_agent)
                session.flush()
                aid = new_agent.id

                # Note: These methods may need async versions if they perform database operations
                self._bulk_insert_pivot(
                    session,
                    ToolsAgents.__table__,
                    [{"agent_id": aid, "tool_id": tid} for tid in tool_ids],
                )

                if block_ids:
                    result = session.execute(select(BlockModel.id, BlockModel.label).where(BlockModel.id.in_(block_ids)))
                    rows = [{"agent_id": aid, "block_id": bid, "block_label": lbl} for bid, lbl in result.all()]
                    self._bulk_insert_pivot(session, BlocksAgents.__table__, rows)

                self._bulk_insert_pivot(
                    session,
                    SourcesAgents.__table__,
                    [{"agent_id": aid, "source_id": sid} for sid in source_ids],
                )
                self._bulk_insert_pivot(
                    session,
                    AgentsTags.__table__,
                    [{"agent_id": aid, "tag": tag} for tag in tag_values],
                )
                self._bulk_insert_pivot(
                    session,
                    IdentitiesAgents.__table__,
                    [{"agent_id": aid, "identity_id": iid} for iid in identity_ids],
                )

                if agent_create.tool_exec_environment_variables:
                    env_rows = [
                        {
                            "agent_id": aid,
                            "key": key,
                            "value": val,
                            "organization_id": actor.organization_id,
                        }
                        for key, val in agent_create.tool_exec_environment_variables.items()
                    ]
                    session.execute(insert(AgentEnvironmentVariable).values(env_rows))

                # initial message sequence
                init_messages = self._generate_initial_message_sequence(
                    actor,
                    agent_state=new_agent.to_pydantic(include_relationships={"memory"}),
                    supplied_initial_message_sequence=agent_create.initial_message_sequence,
                )
                new_agent.message_ids = [msg.id for msg in init_messages]

            session.refresh(new_agent)

        # Using the synchronous version since we don't have an async version yet
        # If you implement an async version of create_many_messages, you can switch to that
        self.message_manager.create_many_messages(pydantic_msgs=init_messages, actor=actor)
        return new_agent.to_pydantic()

    @trace_method
    async def create_agent_async(
        self,
        agent_create: CreateAgent,
        actor: PydanticUser,
        _test_only_force_id: Optional[str] = None,
        _init_with_no_messages: bool = False,
    ) -> PydanticAgentState:
        # validate required configs
        if not agent_create.llm_config or not agent_create.embedding_config:
            raise ValueError("llm_config and embedding_config are required")

        # blocks
        block_ids = list(agent_create.block_ids or [])
        if agent_create.memory_blocks:

            pydantic_blocks = [PydanticBlock(**b.model_dump(to_orm=True)) for b in agent_create.memory_blocks]

            # Inject a description for the default blocks if the user didn't specify them
            # Used for `persona`, `human`, etc
            default_blocks = {block.label: block for block in DEFAULT_BLOCKS}
            for block in pydantic_blocks:
                if block.label in default_blocks:
                    if block.description is None:
                        block.description = default_blocks[block.label].description

            # Actually create the blocks
            created_blocks = await self.block_manager.batch_create_blocks_async(
                pydantic_blocks,
                actor=actor,
            )
            block_ids.extend([blk.id for blk in created_blocks])

        # tools
        tool_names = set(agent_create.tools or [])
        if agent_create.include_base_tools:
            if agent_create.agent_type == AgentType.voice_sleeptime_agent:
                tool_names |= set(BASE_VOICE_SLEEPTIME_TOOLS)
            elif agent_create.agent_type == AgentType.voice_convo_agent:
                tool_names |= set(BASE_VOICE_SLEEPTIME_CHAT_TOOLS)
            elif agent_create.agent_type == AgentType.sleeptime_agent:
                tool_names |= set(BASE_SLEEPTIME_TOOLS)
            elif agent_create.enable_sleeptime:
                tool_names |= set(BASE_SLEEPTIME_CHAT_TOOLS)
            elif agent_create.agent_type == AgentType.memgpt_v2_agent:
                tool_names |= calculate_base_tools(is_v2=True)
            elif agent_create.agent_type == AgentType.react_agent:
                pass  # no default tools
            elif agent_create.agent_type == AgentType.workflow_agent:
                pass  # no default tools
            else:
                tool_names |= calculate_base_tools(is_v2=False)
        if agent_create.include_multi_agent_tools:
            tool_names |= calculate_multi_agent_tools()

        # take out the deprecated tool names
        tool_names.difference_update(set(DEPRECATED_LETTA_TOOLS))

        supplied_ids = set(agent_create.tool_ids or [])

        source_ids = agent_create.source_ids or []

        # Create default source if requested
        if agent_create.include_default_source:
            default_source = PydanticSource(
                name=f"{agent_create.name} External Data Source",
                embedding_config=agent_create.embedding_config,
            )
            created_source = await self.source_manager.create_source(default_source, actor)
            source_ids.append(created_source.id)

        identity_ids = agent_create.identity_ids or []
        tag_values = agent_create.tags or []

        # if the agent type is workflow, we set the autoclear to forced true
        if agent_create.agent_type == AgentType.workflow_agent:
            agent_create.message_buffer_autoclear = True

        async with db_registry.async_session() as session:
            async with session.begin():
                # Note: This will need to be modified if _resolve_tools needs an async version
                name_to_id, id_to_name = await self._resolve_tools_async(
                    session,
                    tool_names,
                    supplied_ids,
                    actor.organization_id,
                )

                tool_ids = set(name_to_id.values()) | set(id_to_name.keys())
                tool_names = set(name_to_id.keys())  # now canonical

                tool_rules = list(agent_create.tool_rules or [])
                if agent_create.include_base_tool_rules:
                    for tn in tool_names:
                        if tn in {"send_message", "send_message_to_agent_async", "memory_finish_edits"}:
                            tool_rules.append(TerminalToolRule(tool_name=tn))
                        elif tn in (BASE_TOOLS + BASE_MEMORY_TOOLS + BASE_MEMORY_TOOLS_V2 + BASE_SLEEPTIME_TOOLS):
                            tool_rules.append(ContinueToolRule(tool_name=tn))

                if tool_rules:
                    check_supports_structured_output(model=agent_create.llm_config.model, tool_rules=tool_rules)

                new_agent = AgentModel(
                    name=agent_create.name,
                    system=derive_system_message(
                        agent_type=agent_create.agent_type,
                        enable_sleeptime=agent_create.enable_sleeptime,
                        system=agent_create.system,
                    ),
                    agent_type=agent_create.agent_type,
                    llm_config=agent_create.llm_config,
                    embedding_config=agent_create.embedding_config,
                    organization_id=actor.organization_id,
                    description=agent_create.description,
                    metadata_=agent_create.metadata,
                    tool_rules=tool_rules,
                    project_id=agent_create.project_id,
                    template_id=agent_create.template_id,
                    base_template_id=agent_create.base_template_id,
                    message_buffer_autoclear=agent_create.message_buffer_autoclear,
                    enable_sleeptime=agent_create.enable_sleeptime,
                    response_format=agent_create.response_format,
                    created_by_id=actor.id,
                    last_updated_by_id=actor.id,
                    timezone=agent_create.timezone if agent_create.timezone else DEFAULT_TIMEZONE,
                    max_files_open=agent_create.max_files_open,
                    per_file_view_window_char_limit=agent_create.per_file_view_window_char_limit,
                )

                if _test_only_force_id:
                    new_agent.id = _test_only_force_id

                session.add(new_agent)
                await session.flush()
                aid = new_agent.id

                # Note: These methods may need async versions if they perform database operations
                await self._bulk_insert_pivot_async(
                    session,
                    ToolsAgents.__table__,
                    [{"agent_id": aid, "tool_id": tid} for tid in tool_ids],
                )

                if block_ids:
                    result = await session.execute(select(BlockModel.id, BlockModel.label).where(BlockModel.id.in_(block_ids)))
                    rows = [{"agent_id": aid, "block_id": bid, "block_label": lbl} for bid, lbl in result.all()]
                    await self._bulk_insert_pivot_async(session, BlocksAgents.__table__, rows)

                await self._bulk_insert_pivot_async(
                    session,
                    SourcesAgents.__table__,
                    [{"agent_id": aid, "source_id": sid} for sid in source_ids],
                )
                await self._bulk_insert_pivot_async(
                    session,
                    AgentsTags.__table__,
                    [{"agent_id": aid, "tag": tag} for tag in tag_values],
                )
                await self._bulk_insert_pivot_async(
                    session,
                    IdentitiesAgents.__table__,
                    [{"agent_id": aid, "identity_id": iid} for iid in identity_ids],
                )

                if agent_create.tool_exec_environment_variables:
                    env_rows = [
                        {
                            "agent_id": aid,
                            "key": key,
                            "value": val,
                            "organization_id": actor.organization_id,
                        }
                        for key, val in agent_create.tool_exec_environment_variables.items()
                    ]
                    await session.execute(insert(AgentEnvironmentVariable).values(env_rows))

                include_relationships = []
                if tool_ids:
                    include_relationships.append("tools")
                if source_ids:
                    include_relationships.append("sources")
                if block_ids:
                    include_relationships.append("memory")
                if identity_ids:
                    include_relationships.append("identity_ids")
                if tag_values:
                    include_relationships.append("tags")

                result = await new_agent.to_pydantic_async(include_relationships=include_relationships)

                # initial message sequence (skip if _init_with_no_messages is True)
                if not _init_with_no_messages:
                    init_messages = await self._generate_initial_message_sequence_async(
                        actor,
                        agent_state=result,
                        supplied_initial_message_sequence=agent_create.initial_message_sequence,
                    )
                    result.message_ids = [msg.id for msg in init_messages]
                    new_agent.message_ids = [msg.id for msg in init_messages]
                    await new_agent.update_async(session, no_refresh=True)
                else:
                    init_messages = []

        # Only create messages if we initialized with messages
        if not _init_with_no_messages:
            await self.message_manager.create_many_messages_async(pydantic_msgs=init_messages, actor=actor)
        return result

    @enforce_types
    def _generate_initial_message_sequence(
        self, actor: PydanticUser, agent_state: PydanticAgentState, supplied_initial_message_sequence: Optional[List[MessageCreate]] = None
    ) -> List[Message]:
        init_messages = initialize_message_sequence(
            agent_state=agent_state, memory_edit_timestamp=get_utc_time(), include_initial_boot_message=True
        )
        if supplied_initial_message_sequence is not None:
            # We always need the system prompt up front
            system_message_obj = PydanticMessage.dict_to_message(
                agent_id=agent_state.id,
                model=agent_state.llm_config.model,
                openai_message_dict=init_messages[0],
            )
            # Don't use anything else in the pregen sequence, instead use the provided sequence
            init_messages = [system_message_obj]
            init_messages.extend(
                package_initial_message_sequence(
                    agent_state.id, supplied_initial_message_sequence, agent_state.llm_config.model, agent_state.timezone, actor
                )
            )
        else:
            init_messages = [
                PydanticMessage.dict_to_message(agent_id=agent_state.id, model=agent_state.llm_config.model, openai_message_dict=msg)
                for msg in init_messages
            ]

        return init_messages

    @enforce_types
    async def _generate_initial_message_sequence_async(
        self, actor: PydanticUser, agent_state: PydanticAgentState, supplied_initial_message_sequence: Optional[List[MessageCreate]] = None
    ) -> List[Message]:
        init_messages = await initialize_message_sequence_async(
            agent_state=agent_state, memory_edit_timestamp=get_utc_time(), include_initial_boot_message=True
        )
        if supplied_initial_message_sequence is not None:
            # We always need the system prompt up front
            system_message_obj = PydanticMessage.dict_to_message(
                agent_id=agent_state.id,
                model=agent_state.llm_config.model,
                openai_message_dict=init_messages[0],
            )
            # Don't use anything else in the pregen sequence, instead use the provided sequence
            init_messages = [system_message_obj]
            init_messages.extend(
                package_initial_message_sequence(
                    agent_state.id, supplied_initial_message_sequence, agent_state.llm_config.model, agent_state.timezone, actor
                )
            )
        else:
            init_messages = [
                PydanticMessage.dict_to_message(agent_id=agent_state.id, model=agent_state.llm_config.model, openai_message_dict=msg)
                for msg in init_messages
            ]

        return init_messages

    @enforce_types
    @trace_method
    def append_initial_message_sequence_to_in_context_messages(
        self, actor: PydanticUser, agent_state: PydanticAgentState, initial_message_sequence: Optional[List[MessageCreate]] = None
    ) -> PydanticAgentState:
        init_messages = self._generate_initial_message_sequence(actor, agent_state, initial_message_sequence)
        return self.append_to_in_context_messages(init_messages, agent_id=agent_state.id, actor=actor)

    @enforce_types
    @trace_method
    async def append_initial_message_sequence_to_in_context_messages_async(
        self, actor: PydanticUser, agent_state: PydanticAgentState, initial_message_sequence: Optional[List[MessageCreate]] = None
    ) -> PydanticAgentState:
        init_messages = await self._generate_initial_message_sequence_async(actor, agent_state, initial_message_sequence)
        return await self.append_to_in_context_messages_async(init_messages, agent_id=agent_state.id, actor=actor)

    @enforce_types
    @trace_method
    def update_agent(
        self,
        agent_id: str,
        agent_update: UpdateAgent,
        actor: PydanticUser,
    ) -> PydanticAgentState:

        new_tools = set(agent_update.tool_ids or [])
        new_sources = set(agent_update.source_ids or [])
        new_blocks = set(agent_update.block_ids or [])
        new_idents = set(agent_update.identity_ids or [])
        new_tags = set(agent_update.tags or [])

        with db_registry.session() as session, session.begin():

            agent: AgentModel = AgentModel.read(db_session=session, identifier=agent_id, actor=actor)
            agent.updated_at = datetime.now(timezone.utc)
            agent.last_updated_by_id = actor.id

            scalar_updates = {
                "name": agent_update.name,
                "system": agent_update.system,
                "llm_config": agent_update.llm_config,
                "embedding_config": agent_update.embedding_config,
                "message_ids": agent_update.message_ids,
                "tool_rules": agent_update.tool_rules,
                "description": agent_update.description,
                "project_id": agent_update.project_id,
                "template_id": agent_update.template_id,
                "base_template_id": agent_update.base_template_id,
                "message_buffer_autoclear": agent_update.message_buffer_autoclear,
                "enable_sleeptime": agent_update.enable_sleeptime,
                "response_format": agent_update.response_format,
                "last_run_completion": agent_update.last_run_completion,
                "last_run_duration_ms": agent_update.last_run_duration_ms,
                "max_files_open": agent_update.max_files_open,
                "per_file_view_window_char_limit": agent_update.per_file_view_window_char_limit,
                "timezone": agent_update.timezone,
            }
            for col, val in scalar_updates.items():
                if val is not None:
                    setattr(agent, col, val)

            if agent_update.metadata is not None:
                agent.metadata_ = agent_update.metadata

            aid = agent.id

            if agent_update.tool_ids is not None:
                self._replace_pivot_rows(
                    session,
                    ToolsAgents.__table__,
                    aid,
                    [{"agent_id": aid, "tool_id": tid} for tid in new_tools],
                )
                session.expire(agent, ["tools"])

            if agent_update.source_ids is not None:
                self._replace_pivot_rows(
                    session,
                    SourcesAgents.__table__,
                    aid,
                    [{"agent_id": aid, "source_id": sid} for sid in new_sources],
                )
                session.expire(agent, ["sources"])

            if agent_update.block_ids is not None:
                rows = []
                if new_blocks:
                    label_map = {
                        bid: lbl
                        for bid, lbl in session.execute(select(BlockModel.id, BlockModel.label).where(BlockModel.id.in_(new_blocks)))
                    }
                    rows = [{"agent_id": aid, "block_id": bid, "block_label": label_map[bid]} for bid in new_blocks]

                self._replace_pivot_rows(session, BlocksAgents.__table__, aid, rows)
                session.expire(agent, ["core_memory"])

            if agent_update.identity_ids is not None:
                self._replace_pivot_rows(
                    session,
                    IdentitiesAgents.__table__,
                    aid,
                    [{"agent_id": aid, "identity_id": iid} for iid in new_idents],
                )
                session.expire(agent, ["identities"])

            if agent_update.tags is not None:
                self._replace_pivot_rows(
                    session,
                    AgentsTags.__table__,
                    aid,
                    [{"agent_id": aid, "tag": tag} for tag in new_tags],
                )
                session.expire(agent, ["tags"])

            if agent_update.tool_exec_environment_variables is not None:
                session.execute(delete(AgentEnvironmentVariable).where(AgentEnvironmentVariable.agent_id == aid))
                env_rows = [
                    {
                        "agent_id": aid,
                        "key": k,
                        "value": v,
                        "organization_id": agent.organization_id,
                    }
                    for k, v in agent_update.tool_exec_environment_variables.items()
                ]
                if env_rows:
                    self._bulk_insert_pivot(session, AgentEnvironmentVariable.__table__, env_rows)
                session.expire(agent, ["tool_exec_environment_variables"])

            if agent_update.enable_sleeptime and agent_update.system is None:
                agent.system = derive_system_message(
                    agent_type=agent.agent_type,
                    enable_sleeptime=agent_update.enable_sleeptime,
                    system=agent.system,
                )

            session.flush()
            session.refresh(agent)

            return agent.to_pydantic()

    @enforce_types
    @trace_method
    async def update_agent_async(
        self,
        agent_id: str,
        agent_update: UpdateAgent,
        actor: PydanticUser,
    ) -> PydanticAgentState:

        new_tools = set(agent_update.tool_ids or [])
        new_sources = set(agent_update.source_ids or [])
        new_blocks = set(agent_update.block_ids or [])
        new_idents = set(agent_update.identity_ids or [])
        new_tags = set(agent_update.tags or [])

        async with db_registry.async_session() as session, session.begin():

            agent: AgentModel = await AgentModel.read_async(db_session=session, identifier=agent_id, actor=actor)
            agent.updated_at = datetime.now(timezone.utc)
            agent.last_updated_by_id = actor.id

            scalar_updates = {
                "name": agent_update.name,
                "system": agent_update.system,
                "llm_config": agent_update.llm_config,
                "embedding_config": agent_update.embedding_config,
                "message_ids": agent_update.message_ids,
                "tool_rules": agent_update.tool_rules,
                "description": agent_update.description,
                "project_id": agent_update.project_id,
                "template_id": agent_update.template_id,
                "base_template_id": agent_update.base_template_id,
                "message_buffer_autoclear": agent_update.message_buffer_autoclear,
                "enable_sleeptime": agent_update.enable_sleeptime,
                "response_format": agent_update.response_format,
                "last_run_completion": agent_update.last_run_completion,
                "last_run_duration_ms": agent_update.last_run_duration_ms,
                "timezone": agent_update.timezone,
                "max_files_open": agent_update.max_files_open,
                "per_file_view_window_char_limit": agent_update.per_file_view_window_char_limit,
            }
            for col, val in scalar_updates.items():
                if val is not None:
                    setattr(agent, col, val)

            if agent_update.metadata is not None:
                agent.metadata_ = agent_update.metadata

            aid = agent.id

            if agent_update.tool_ids is not None:
                await self._replace_pivot_rows_async(
                    session,
                    ToolsAgents.__table__,
                    aid,
                    [{"agent_id": aid, "tool_id": tid} for tid in new_tools],
                )
                session.expire(agent, ["tools"])

            if agent_update.source_ids is not None:
                await self._replace_pivot_rows_async(
                    session,
                    SourcesAgents.__table__,
                    aid,
                    [{"agent_id": aid, "source_id": sid} for sid in new_sources],
                )
                session.expire(agent, ["sources"])

            if agent_update.block_ids is not None:
                rows = []
                if new_blocks:
                    result = await session.execute(select(BlockModel.id, BlockModel.label).where(BlockModel.id.in_(new_blocks)))
                    label_map = {bid: lbl for bid, lbl in result.all()}
                    rows = [{"agent_id": aid, "block_id": bid, "block_label": label_map[bid]} for bid in new_blocks]

                await self._replace_pivot_rows_async(session, BlocksAgents.__table__, aid, rows)
                session.expire(agent, ["core_memory"])

            if agent_update.identity_ids is not None:
                await self._replace_pivot_rows_async(
                    session,
                    IdentitiesAgents.__table__,
                    aid,
                    [{"agent_id": aid, "identity_id": iid} for iid in new_idents],
                )
                session.expire(agent, ["identities"])

            if agent_update.tags is not None:
                await self._replace_pivot_rows_async(
                    session,
                    AgentsTags.__table__,
                    aid,
                    [{"agent_id": aid, "tag": tag} for tag in new_tags],
                )
                session.expire(agent, ["tags"])

            if agent_update.tool_exec_environment_variables is not None:
                await session.execute(delete(AgentEnvironmentVariable).where(AgentEnvironmentVariable.agent_id == aid))
                env_rows = [
                    {
                        "agent_id": aid,
                        "key": k,
                        "value": v,
                        "organization_id": agent.organization_id,
                    }
                    for k, v in agent_update.tool_exec_environment_variables.items()
                ]
                if env_rows:
                    await self._bulk_insert_pivot_async(session, AgentEnvironmentVariable.__table__, env_rows)
                session.expire(agent, ["tool_exec_environment_variables"])

            if agent_update.enable_sleeptime and agent_update.system is None:
                agent.system = derive_system_message(
                    agent_type=agent.agent_type,
                    enable_sleeptime=agent_update.enable_sleeptime,
                    system=agent.system,
                )

            await session.flush()
            await session.refresh(agent)

            return await agent.to_pydantic_async()

    @enforce_types
    @trace_method
    async def update_message_ids_async(
        self,
        agent_id: str,
        message_ids: List[str],
        actor: PydanticUser,
    ) -> None:
        async with db_registry.async_session() as session:
            query = select(AgentModel)
            query = AgentModel.apply_access_predicate(query, actor, ["read"], AccessType.ORGANIZATION)
            query = query.where(AgentModel.id == agent_id)
            query = _apply_relationship_filters(query, include_relationships=[])

            result = await session.execute(query)
            agent = result.scalar_one_or_none()

            agent.updated_at = datetime.now(timezone.utc)
            agent.last_updated_by_id = actor.id
            agent.message_ids = message_ids

            await agent.update_async(db_session=session, actor=actor, no_commit=True, no_refresh=True)
            await session.commit()

    # TODO: Make this general and think about how to roll this into sqlalchemybase
    @trace_method
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
        ascending: bool = True,
        sort_by: Optional[str] = "created_at",
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
            ascending

        Returns:
            List[PydanticAgentState]: The filtered list of matching agents.
        """
        with db_registry.session() as session:
            query = select(AgentModel).distinct(AgentModel.created_at, AgentModel.id)
            query = AgentModel.apply_access_predicate(query, actor, ["read"], AccessType.ORGANIZATION)

            # Apply filters
            query = _apply_filters(query, name, query_text, project_id, template_id, base_template_id)
            query = _apply_identity_filters(query, identity_id, identifier_keys)
            query = _apply_tag_filter(query, tags, match_all_tags)
            query = _apply_pagination(query, before, after, session, ascending=ascending, sort_by=sort_by)

            if limit:
                query = query.limit(limit)

            result = session.execute(query)
            agents = result.scalars().all()
            return [agent.to_pydantic(include_relationships=include_relationships) for agent in agents]

    @trace_method
    async def list_agents_async(
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
        ascending: bool = True,
        sort_by: Optional[str] = "created_at",
        show_hidden_agents: Optional[bool] = None,
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
            ascending (bool): Sort agents in ascending order.
            sort_by (Optional[str]): Sort agents by this field.
            show_hidden_agents (bool): If True, include agents marked as hidden in the results.

        Returns:
            List[PydanticAgentState]: The filtered list of matching agents.
        """
        async with db_registry.async_session() as session:
            query = select(AgentModel)
            query = AgentModel.apply_access_predicate(query, actor, ["read"], AccessType.ORGANIZATION)

            # Apply filters
            query = _apply_filters(query, name, query_text, project_id, template_id, base_template_id)
            query = _apply_identity_filters(query, identity_id, identifier_keys)
            query = _apply_tag_filter(query, tags, match_all_tags)
            query = _apply_relationship_filters(query, include_relationships)

            # Apply hidden filter
            if not show_hidden_agents:
                query = query.where((AgentModel.hidden.is_(None)) | (AgentModel.hidden == False))
            query = await _apply_pagination_async(query, before, after, session, ascending=ascending, sort_by=sort_by)

            if limit:
                query = query.limit(limit)
            result = await session.execute(query)
            agents = result.scalars().all()
            return await asyncio.gather(*[agent.to_pydantic_async(include_relationships=include_relationships) for agent in agents])

    @enforce_types
    @trace_method
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
        with db_registry.session() as session:
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
    @trace_method
    async def list_agents_matching_tags_async(
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
        async with db_registry.async_session() as session:
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
            result = await session.execute(query)
            return await asyncio.gather(*[agent.to_pydantic_async() for agent in result.scalars()])

    @trace_method
    def size(
        self,
        actor: PydanticUser,
    ) -> int:
        """
        Get the total count of agents for the given user.
        """
        with db_registry.session() as session:
            return AgentModel.size(db_session=session, actor=actor)

    @trace_method
    async def size_async(
        self,
        actor: PydanticUser,
    ) -> int:
        """
        Get the total count of agents for the given user.
        """
        async with db_registry.async_session() as session:
            return await AgentModel.size_async(db_session=session, actor=actor)

    @enforce_types
    @trace_method
    def get_agent_by_id(self, agent_id: str, actor: PydanticUser) -> PydanticAgentState:
        """Fetch an agent by its ID."""
        with db_registry.session() as session:
            agent = AgentModel.read(db_session=session, identifier=agent_id, actor=actor)
            return agent.to_pydantic()

    @enforce_types
    @trace_method
    async def get_agent_by_id_async(
        self,
        agent_id: str,
        actor: PydanticUser,
        include_relationships: Optional[List[str]] = None,
    ) -> PydanticAgentState:
        """Fetch an agent by its ID."""
        async with db_registry.async_session() as session:
            try:
                query = select(AgentModel)
                query = AgentModel.apply_access_predicate(query, actor, ["read"], AccessType.ORGANIZATION)
                query = query.where(AgentModel.id == agent_id)
                query = _apply_relationship_filters(query, include_relationships)

                result = await session.execute(query)
                agent = result.scalar_one_or_none()

                if agent is None:
                    raise NoResultFound(f"Agent with ID {agent_id} not found")

                return await agent.to_pydantic_async(include_relationships=include_relationships)
            except Exception as e:
                logger.error(f"Error fetching agent {agent_id}: {str(e)}")
                raise

    @enforce_types
    @trace_method
    async def get_agents_by_ids_async(
        self,
        agent_ids: list[str],
        actor: PydanticUser,
        include_relationships: Optional[List[str]] = None,
    ) -> list[PydanticAgentState]:
        """Fetch a list of agents by their IDs."""
        async with db_registry.async_session() as session:
            try:
                query = select(AgentModel)
                query = AgentModel.apply_access_predicate(query, actor, ["read"], AccessType.ORGANIZATION)
                query = query.where(AgentModel.id.in_(agent_ids))
                query = _apply_relationship_filters(query, include_relationships)

                result = await session.execute(query)
                agents = result.scalars().all()

                if not agents:
                    logger.warning(f"No agents found with IDs: {agent_ids}")
                    return []

                return await asyncio.gather(*[agent.to_pydantic_async(include_relationships=include_relationships) for agent in agents])
            except Exception as e:
                logger.error(f"Error fetching agents with IDs {agent_ids}: {str(e)}")
                raise

    @enforce_types
    @trace_method
    def get_agent_by_name(self, agent_name: str, actor: PydanticUser) -> PydanticAgentState:
        """Fetch an agent by its ID."""
        with db_registry.session() as session:
            agent = AgentModel.read(db_session=session, name=agent_name, actor=actor)
            return agent.to_pydantic()

    @enforce_types
    @trace_method
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
        with db_registry.session() as session:
            # Retrieve the agent
            logger.debug(f"Hard deleting Agent with ID: {agent_id} with actor={actor}")
            agent = AgentModel.read(db_session=session, identifier=agent_id, actor=actor)
            agents_to_delete = [agent]
            sleeptime_group_to_delete = None

            # Delete sleeptime agent and group (TODO this is flimsy pls fix)
            if agent.multi_agent_group:
                participant_agent_ids = agent.multi_agent_group.agent_ids
                if agent.multi_agent_group.manager_type in {ManagerType.sleeptime, ManagerType.voice_sleeptime} and participant_agent_ids:
                    for participant_agent_id in participant_agent_ids:
                        try:
                            sleeptime_agent = AgentModel.read(db_session=session, identifier=participant_agent_id, actor=actor)
                            agents_to_delete.append(sleeptime_agent)
                        except NoResultFound:
                            pass  # agent already deleted
                    sleeptime_agent_group = GroupModel.read(db_session=session, identifier=agent.multi_agent_group.id, actor=actor)
                    sleeptime_group_to_delete = sleeptime_agent_group

            try:
                if sleeptime_group_to_delete is not None:
                    session.delete(sleeptime_group_to_delete)
                    session.commit()
                for agent in agents_to_delete:
                    session.delete(agent)
                session.commit()
            except Exception as e:
                session.rollback()
                logger.exception(f"Failed to hard delete Agent with ID {agent_id}")
                raise ValueError(f"Failed to hard delete Agent with ID {agent_id}: {e}")
            else:
                logger.debug(f"Agent with ID {agent_id} successfully hard deleted")

    @enforce_types
    @trace_method
    async def delete_agent_async(self, agent_id: str, actor: PydanticUser) -> None:
        """
        Deletes an agent and its associated relationships.
        Ensures proper permission checks and cascades where applicable.

        Args:
            agent_id: ID of the agent to be deleted.
            actor: User performing the action.

        Raises:
            NoResultFound: If agent doesn't exist
        """
        async with db_registry.async_session() as session:
            # Retrieve the agent
            logger.debug(f"Hard deleting Agent with ID: {agent_id} with actor={actor}")
            agent = await AgentModel.read_async(db_session=session, identifier=agent_id, actor=actor)
            agents_to_delete = [agent]
            sleeptime_group_to_delete = None

            # Delete sleeptime agent and group (TODO this is flimsy pls fix)
            if agent.multi_agent_group:
                participant_agent_ids = agent.multi_agent_group.agent_ids
                if agent.multi_agent_group.manager_type in {ManagerType.sleeptime, ManagerType.voice_sleeptime} and participant_agent_ids:
                    for participant_agent_id in participant_agent_ids:
                        try:
                            sleeptime_agent = await AgentModel.read_async(db_session=session, identifier=participant_agent_id, actor=actor)
                            agents_to_delete.append(sleeptime_agent)
                        except NoResultFound:
                            pass  # agent already deleted
                    sleeptime_agent_group = await GroupModel.read_async(
                        db_session=session, identifier=agent.multi_agent_group.id, actor=actor
                    )
                    sleeptime_group_to_delete = sleeptime_agent_group

            try:
                if sleeptime_group_to_delete is not None:
                    await session.delete(sleeptime_group_to_delete)
                    await session.commit()
                for agent in agents_to_delete:
                    await session.delete(agent)
                    await session.commit()
            except Exception as e:
                await session.rollback()
                logger.exception(f"Failed to hard delete Agent with ID {agent_id}")
                raise ValueError(f"Failed to hard delete Agent with ID {agent_id}: {e}")
            else:
                logger.debug(f"Agent with ID {agent_id} successfully hard deleted")

    @enforce_types
    @trace_method
    def serialize(self, agent_id: str, actor: PydanticUser) -> AgentSchema:
        with db_registry.session() as session:
            agent = AgentModel.read(db_session=session, identifier=agent_id, actor=actor)
            schema = MarshmallowAgentSchema(session=session, actor=actor)
            data = schema.dump(agent)
            return AgentSchema(**data)

    @enforce_types
    @trace_method
    def deserialize(
        self,
        serialized_agent: AgentSchema,
        actor: PydanticUser,
        append_copy_suffix: bool = True,
        override_existing_tools: bool = True,
        project_id: Optional[str] = None,
        strip_messages: Optional[bool] = False,
    ) -> PydanticAgentState:
        serialized_agent_dict = serialized_agent.model_dump()
        tool_data_list = serialized_agent_dict.pop("tools", [])
        messages = serialized_agent_dict.pop(MarshmallowAgentSchema.FIELD_MESSAGES, [])

        for msg in messages:
            msg[MarshmallowAgentSchema.FIELD_ID] = SerializedMessageSchema.generate_id()  # Generate new ID

        message_ids = []
        in_context_message_indices = serialized_agent_dict.pop(MarshmallowAgentSchema.FIELD_IN_CONTEXT_INDICES)
        for idx in in_context_message_indices:
            message_ids.append(messages[idx][MarshmallowAgentSchema.FIELD_ID])

        serialized_agent_dict[MarshmallowAgentSchema.FIELD_MESSAGE_IDS] = message_ids

        with db_registry.session() as session:
            schema = MarshmallowAgentSchema(session=session, actor=actor)
            agent = schema.load(serialized_agent_dict, session=session)

            agent.organization_id = actor.organization_id
            for block in agent.core_memory:
                block.organization_id = actor.organization_id
            if append_copy_suffix:
                agent.name += "_copy"
            if project_id:
                agent.project_id = project_id

            if strip_messages:
                # we want to strip all but the first (system) message
                agent.message_ids = [agent.message_ids[0]]
            agent = agent.create(session, actor=actor)

            pydantic_agent = agent.to_pydantic()

        pyd_msgs = []
        message_schema = SerializedMessageSchema(session=session, actor=actor)

        for serialized_message in messages:
            pydantic_message = message_schema.load(serialized_message, session=session).to_pydantic()
            pydantic_message.agent_id = agent.id
            pyd_msgs.append(pydantic_message)
        self.message_manager.create_many_messages(pyd_msgs, actor=actor)

        # Need to do this separately as there's some fancy upsert logic that SqlAlchemy cannot handle
        for tool_data in tool_data_list:
            pydantic_tool = SerializedToolSchema(actor=actor).load(tool_data, transient=True).to_pydantic()

            existing_pydantic_tool = self.tool_manager.get_tool_by_name(pydantic_tool.name, actor=actor)
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
    @trace_method
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
        with db_registry.session() as session:
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

    @enforce_types
    @trace_method
    def list_groups(self, agent_id: str, actor: PydanticUser, manager_type: Optional[str] = None) -> List[PydanticGroup]:
        with db_registry.session() as session:
            query = (
                select(GroupModel)
                .join(GroupsAgents, GroupModel.id == GroupsAgents.group_id)
                .where(GroupsAgents.agent_id == agent_id, GroupModel.organization_id == actor.organization_id)
            )

            if manager_type:
                query = query.where(GroupModel.manager_type == manager_type)

            result = session.execute(query)
            return [group.to_pydantic() for group in result.scalars()]

    # ======================================================================================================================
    # In Context Messages Management
    # ======================================================================================================================
    # TODO: There are several assumptions here that are not explicitly checked
    # TODO: 1) These message ids are valid
    # TODO: 2) These messages are ordered from oldest to newest
    # TODO: This can be fixed by having an actual relationship in the ORM for message_ids
    # TODO: This can also be made more efficient, instead of getting, setting, we can do it all in one db session for one query.
    @enforce_types
    @trace_method
    def get_in_context_messages(self, agent_id: str, actor: PydanticUser) -> List[PydanticMessage]:
        message_ids = self.get_agent_by_id(agent_id=agent_id, actor=actor).message_ids
        return self.message_manager.get_messages_by_ids(message_ids=message_ids, actor=actor)

    @enforce_types
    @trace_method
    def get_system_message(self, agent_id: str, actor: PydanticUser) -> PydanticMessage:
        message_ids = self.get_agent_by_id(agent_id=agent_id, actor=actor).message_ids
        return self.message_manager.get_message_by_id(message_id=message_ids[0], actor=actor)

    @enforce_types
    @trace_method
    async def get_system_message_async(self, agent_id: str, actor: PydanticUser) -> PydanticMessage:
        agent = await self.get_agent_by_id_async(agent_id=agent_id, include_relationships=[], actor=actor)
        return await self.message_manager.get_message_by_id_async(message_id=agent.message_ids[0], actor=actor)

    # TODO: This is duplicated below
    # TODO: This is legacy code and should be cleaned up
    # TODO: A lot of the memory "compilation" should be offset to a separate class
    @enforce_types
    @trace_method
    def rebuild_system_prompt(self, agent_id: str, actor: PydanticUser, force=False, update_timestamp=True) -> PydanticAgentState:
        """Rebuilds the system message with the latest memory object and any shared memory block updates

        Updates to core memory blocks should trigger a "rebuild", which itself will create a new message object

        Updates to the memory header should *not* trigger a rebuild, since that will simply flood recall storage with excess messages
        """
        agent_state = self.get_agent_by_id(agent_id=agent_id, actor=actor)

        curr_system_message = self.get_system_message(
            agent_id=agent_id, actor=actor
        )  # this is the system + memory bank, not just the system prompt

        if curr_system_message is None:
            logger.warning(f"No system message found for agent {agent_state.id} and user {actor}")
            return agent_state

        curr_system_message_openai = curr_system_message.to_openai_dict()

        # note: we only update the system prompt if the core memory is changed
        # this means that the archival/recall memory statistics may be someout out of date
        curr_memory_str = agent_state.memory.compile(sources=agent_state.sources)
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
            timezone=agent_state.timezone,
            previous_message_count=num_messages - len(agent_state.message_ids),
            archival_memory_size=num_archival_memories,
            sources=agent_state.sources,
            max_files_open=agent_state.max_files_open,
        )

        diff = united_diff(curr_system_message_openai["content"], new_system_message_str)
        if len(diff) > 0:  # there was a diff
            logger.debug(f"Rebuilding system with new memory...\nDiff:\n{diff}")

            # Swap the system message out (only if there is a diff)
            message = PydanticMessage.dict_to_message(
                agent_id=agent_id,
                model=agent_state.llm_config.model,
                openai_message_dict={"role": "system", "content": new_system_message_str},
            )
            message = self.message_manager.update_message_by_id(
                message_id=curr_system_message.id,
                message_update=MessageUpdate(**message.model_dump()),
                actor=actor,
            )
            return self.set_in_context_messages(agent_id=agent_id, message_ids=agent_state.message_ids, actor=actor)
        else:
            return agent_state

    # TODO: This is probably one of the worst pieces of code I've ever written please rip up as you see wish
    @enforce_types
    @trace_method
    async def rebuild_system_prompt_async(
        self,
        agent_id: str,
        actor: PydanticUser,
        force=False,
        update_timestamp=True,
        tool_rules_solver: Optional[ToolRulesSolver] = None,
        dry_run: bool = False,
    ) -> Tuple[PydanticAgentState, Optional[PydanticMessage], int, int]:
        """Rebuilds the system message with the latest memory object and any shared memory block updates

        Updates to core memory blocks should trigger a "rebuild", which itself will create a new message object

        Updates to the memory header should *not* trigger a rebuild, since that will simply flood recall storage with excess messages
        """
        num_messages = await self.message_manager.size_async(actor=actor, agent_id=agent_id)
        num_archival_memories = await self.passage_manager.agent_passage_size_async(actor=actor, agent_id=agent_id)
        agent_state = await self.get_agent_by_id_async(agent_id=agent_id, include_relationships=["memory", "sources", "tools"], actor=actor)

        if not tool_rules_solver:
            tool_rules_solver = ToolRulesSolver(agent_state.tool_rules)

        curr_system_message = await self.message_manager.get_message_by_id_async(message_id=agent_state.message_ids[0], actor=actor)

        if curr_system_message is None:
            logger.warning(f"No system message found for agent {agent_state.id} and user {actor}")
            return agent_state, curr_system_message, num_messages, num_archival_memories

        curr_system_message_openai = curr_system_message.to_openai_dict()

        # note: we only update the system prompt if the core memory is changed
        # this means that the archival/recall memory statistics may be someout out of date
        curr_memory_str = await agent_state.memory.compile_async(
            sources=agent_state.sources,
            tool_usage_rules=tool_rules_solver.compile_tool_rule_prompts(),
            max_files_open=agent_state.max_files_open,
        )
        if curr_memory_str in curr_system_message_openai["content"] and not force:
            # NOTE: could this cause issues if a block is removed? (substring match would still work)
            logger.debug(
                f"Memory hasn't changed for agent id={agent_id} and actor=({actor.id}, {actor.name}), skipping system prompt rebuild"
            )
            return agent_state, curr_system_message, num_messages, num_archival_memories

        # If the memory didn't update, we probably don't want to update the timestamp inside
        # For example, if we're doing a system prompt swap, this should probably be False
        if update_timestamp:
            memory_edit_timestamp = get_utc_time()
        else:
            # NOTE: a bit of a hack - we pull the timestamp from the message created_by
            memory_edit_timestamp = curr_system_message.created_at

        # update memory (TODO: potentially update recall/archival stats separately)

        new_system_message_str = await compile_system_message_async(
            system_prompt=agent_state.system,
            in_context_memory=agent_state.memory,
            in_context_memory_last_edit=memory_edit_timestamp,
            timezone=agent_state.timezone,
            previous_message_count=num_messages - len(agent_state.message_ids),
            archival_memory_size=num_archival_memories,
            tool_rules_solver=tool_rules_solver,
            sources=agent_state.sources,
            max_files_open=agent_state.max_files_open,
        )

        diff = united_diff(curr_system_message_openai["content"], new_system_message_str)
        if len(diff) > 0:  # there was a diff
            logger.debug(f"Rebuilding system with new memory...\nDiff:\n{diff}")

            # Swap the system message out (only if there is a diff)
            temp_message = PydanticMessage.dict_to_message(
                agent_id=agent_id,
                model=agent_state.llm_config.model,
                openai_message_dict={"role": "system", "content": new_system_message_str},
            )
            temp_message.id = curr_system_message.id

            if not dry_run:
                await self.message_manager.update_message_by_id_async(
                    message_id=curr_system_message.id,
                    message_update=MessageUpdate(**temp_message.model_dump()),
                    actor=actor,
                )
            else:
                curr_system_message = temp_message

        return agent_state, curr_system_message, num_messages, num_archival_memories

    @enforce_types
    @trace_method
    def set_in_context_messages(self, agent_id: str, message_ids: List[str], actor: PydanticUser) -> PydanticAgentState:
        return self.update_agent(agent_id=agent_id, agent_update=UpdateAgent(message_ids=message_ids), actor=actor)

    @enforce_types
    @trace_method
    async def set_in_context_messages_async(self, agent_id: str, message_ids: List[str], actor: PydanticUser) -> PydanticAgentState:
        return await self.update_agent_async(agent_id=agent_id, agent_update=UpdateAgent(message_ids=message_ids), actor=actor)

    @enforce_types
    @trace_method
    def trim_older_in_context_messages(self, num: int, agent_id: str, actor: PydanticUser) -> PydanticAgentState:
        message_ids = self.get_agent_by_id(agent_id=agent_id, actor=actor).message_ids
        new_messages = [message_ids[0]] + message_ids[num:]  # 0 is system message
        return self.set_in_context_messages(agent_id=agent_id, message_ids=new_messages, actor=actor)

    @enforce_types
    @trace_method
    def trim_all_in_context_messages_except_system(self, agent_id: str, actor: PydanticUser) -> PydanticAgentState:
        message_ids = self.get_agent_by_id(agent_id=agent_id, actor=actor).message_ids
        # TODO: How do we know this?
        new_messages = [message_ids[0]]  # 0 is system message
        return self.set_in_context_messages(agent_id=agent_id, message_ids=new_messages, actor=actor)

    @enforce_types
    @trace_method
    def prepend_to_in_context_messages(self, messages: List[PydanticMessage], agent_id: str, actor: PydanticUser) -> PydanticAgentState:
        message_ids = self.get_agent_by_id(agent_id=agent_id, actor=actor).message_ids
        new_messages = self.message_manager.create_many_messages(messages, actor=actor)
        message_ids = [message_ids[0]] + [m.id for m in new_messages] + message_ids[1:]
        return self.set_in_context_messages(agent_id=agent_id, message_ids=message_ids, actor=actor)

    @enforce_types
    @trace_method
    def append_to_in_context_messages(self, messages: List[PydanticMessage], agent_id: str, actor: PydanticUser) -> PydanticAgentState:
        messages = self.message_manager.create_many_messages(messages, actor=actor)
        message_ids = self.get_agent_by_id(agent_id=agent_id, actor=actor).message_ids or []
        message_ids += [m.id for m in messages]
        return self.set_in_context_messages(agent_id=agent_id, message_ids=message_ids, actor=actor)

    @enforce_types
    @trace_method
    async def append_to_in_context_messages_async(
        self, messages: List[PydanticMessage], agent_id: str, actor: PydanticUser
    ) -> PydanticAgentState:
        messages = await self.message_manager.create_many_messages_async(messages, actor=actor)
        agent = await self.get_agent_by_id_async(agent_id=agent_id, actor=actor)
        message_ids = agent.message_ids or []
        message_ids += [m.id for m in messages]
        return await self.set_in_context_messages_async(agent_id=agent_id, message_ids=message_ids, actor=actor)

    @enforce_types
    @trace_method
    async def reset_messages_async(
        self, agent_id: str, actor: PydanticUser, add_default_initial_messages: bool = False
    ) -> PydanticAgentState:
        """
        Removes all in-context messages for the specified agent except the original system message by:
          1) Preserving the first message ID (original system message).
          2) Deleting all other messages for the agent.
          3) Updating the agent's message_ids to only contain the system message.
          4) Optionally adding default initial messages after the system message.

        This action is destructive and cannot be undone once committed.

        Args:
            add_default_initial_messages: If true, adds the default initial messages after resetting.
            agent_id (str): The ID of the agent whose messages will be reset.
            actor (PydanticUser): The user performing this action.

        Returns:
            PydanticAgentState: The updated agent state with only the original system message preserved.
        """
        async with db_registry.async_session() as session:
            # Retrieve the existing agent (will raise NoResultFound if invalid)
            agent = await AgentModel.read_async(db_session=session, identifier=agent_id, actor=actor)

            # Ensure agent has message_ids with at least one message
            if not agent.message_ids or len(agent.message_ids) == 0:
                logger.error(
                    f"Agent {agent_id} has no message_ids. Agent details: "
                    f"name={agent.name}, created_at={agent.created_at}, "
                    f"message_ids={agent.message_ids}, organization_id={actor.organization_id}"
                )
                raise ValueError(f"Agent {agent_id} has no message_ids - cannot preserve system message")

            # Get the system message ID (first message)
            system_message_id = agent.message_ids[0]

            # Delete all messages for the agent except the system message
            await self.message_manager.delete_all_messages_for_agent_async(agent_id=agent_id, actor=actor, exclude_ids=[system_message_id])

            # Update agent to only keep the system message
            agent.message_ids = [system_message_id]
            await agent.update_async(db_session=session, actor=actor)
            agent_state = await agent.to_pydantic_async(include_relationships=["sources"])

        # Optionally add default initial messages after the system message
        if add_default_initial_messages:
            init_messages = await initialize_message_sequence_async(
                agent_state=agent_state, memory_edit_timestamp=get_utc_time(), include_initial_boot_message=True
            )
            # Skip index 0 (system message) since we preserved the original
            non_system_messages = [
                PydanticMessage.dict_to_message(
                    agent_id=agent_state.id,
                    model=agent_state.llm_config.model,
                    openai_message_dict=msg,
                )
                for msg in init_messages[1:]
            ]
            return await self.append_to_in_context_messages_async(non_system_messages, agent_id=agent_state.id, actor=actor)
        else:
            return agent_state

    @enforce_types
    @trace_method
    async def update_memory_if_changed_async(self, agent_id: str, new_memory: Memory, actor: PydanticUser) -> PydanticAgentState:
        """
        Update internal memory object and system prompt if there have been modifications.

        Args:
            actor:
            agent_id:
            new_memory (Memory): the new memory object to compare to the current memory object

        Returns:
            modified (bool): whether the memory was updated
        """
        agent_state = await self.get_agent_by_id_async(agent_id=agent_id, actor=actor, include_relationships=["memory", "sources"])
        system_message = await self.message_manager.get_message_by_id_async(message_id=agent_state.message_ids[0], actor=actor)
        temp_tool_rules_solver = ToolRulesSolver(agent_state.tool_rules)
        new_memory_str = await new_memory.compile_async(
            sources=agent_state.sources,
            tool_usage_rules=temp_tool_rules_solver.compile_tool_rule_prompts(),
            max_files_open=agent_state.max_files_open,
        )
        if new_memory_str not in system_message.content[0].text:
            # update the blocks (LRW) in the DB
            for label in agent_state.memory.list_block_labels():
                updated_value = new_memory.get_block(label).value
                if updated_value != agent_state.memory.get_block(label).value:
                    # update the block if it's changed
                    block_id = agent_state.memory.get_block(label).id
                    await self.block_manager.update_block_async(
                        block_id=block_id, block_update=BlockUpdate(value=updated_value), actor=actor
                    )

            # refresh memory from DB (using block ids)
            blocks = await self.block_manager.get_all_blocks_by_ids_async(
                block_ids=[b.id for b in agent_state.memory.get_blocks()], actor=actor
            )

            agent_state.memory = Memory(
                blocks=blocks,
                file_blocks=agent_state.memory.file_blocks,
                prompt_template=get_prompt_template_for_agent_type(agent_state.agent_type),
            )

            # NOTE: don't do this since re-buildin the memory is handled at the start of the step
            # rebuild memory - this records the last edited timestamp of the memory
            # TODO: pass in update timestamp from block edit time
            await self.rebuild_system_prompt_async(agent_id=agent_id, actor=actor)

        return agent_state

    @enforce_types
    @trace_method
    async def refresh_memory_async(self, agent_state: PydanticAgentState, actor: PydanticUser) -> PydanticAgentState:
        # TODO: This will NOT work for new blocks/file blocks added intra-step
        block_ids = [b.id for b in agent_state.memory.blocks]
        file_block_names = [b.label for b in agent_state.memory.file_blocks]

        if block_ids:
            blocks = await self.block_manager.get_all_blocks_by_ids_async(block_ids=[b.id for b in agent_state.memory.blocks], actor=actor)
            agent_state.memory.blocks = [b for b in blocks if b is not None]

        if file_block_names:
            file_blocks = await self.file_agent_manager.get_all_file_blocks_by_name(
                file_names=file_block_names,
                agent_id=agent_state.id,
                actor=actor,
                per_file_view_window_char_limit=agent_state.per_file_view_window_char_limit,
            )
            agent_state.memory.file_blocks = [b for b in file_blocks if b is not None]

        return agent_state

    @enforce_types
    @trace_method
    async def refresh_file_blocks(self, agent_state: PydanticAgentState, actor: PydanticUser) -> PydanticAgentState:
        file_blocks = await self.file_agent_manager.list_files_for_agent(
            agent_id=agent_state.id,
            per_file_view_window_char_limit=agent_state.per_file_view_window_char_limit,
            actor=actor,
            return_as_blocks=True,
        )
        agent_state.memory.file_blocks = [b for b in file_blocks if b is not None]
        return agent_state

    # ======================================================================================================================
    # Source Management
    # ======================================================================================================================
    @enforce_types
    @trace_method
    async def attach_source_async(self, agent_id: str, source_id: str, actor: PydanticUser) -> PydanticAgentState:
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

        async with db_registry.async_session() as session:
            # Verify both agent and source exist and user has permission to access them
            agent = await AgentModel.read_async(db_session=session, identifier=agent_id, actor=actor)

            # The _process_relationship helper already handles duplicate checking via unique constraint
            await _process_relationship_async(
                session=session,
                agent=agent,
                relationship_name="sources",
                model_class=SourceModel,
                item_ids=[source_id],
                replace=False,
            )

            # Commit the changes
            agent = await agent.update_async(session, actor=actor)
            return await agent.to_pydantic_async()

    @enforce_types
    @trace_method
    def append_system_message(self, agent_id: str, content: str, actor: PydanticUser):

        # get the agent
        agent = self.get_agent_by_id(agent_id=agent_id, actor=actor)
        message = PydanticMessage.dict_to_message(
            agent_id=agent.id, model=agent.llm_config.model, openai_message_dict={"role": "system", "content": content}
        )

        # update agent in-context message IDs
        self.append_to_in_context_messages(messages=[message], agent_id=agent_id, actor=actor)

    @enforce_types
    @trace_method
    async def append_system_message_async(self, agent_id: str, content: str, actor: PydanticUser):

        # get the agent
        agent = await self.get_agent_by_id_async(agent_id=agent_id, actor=actor)
        message = PydanticMessage.dict_to_message(
            agent_id=agent.id, model=agent.llm_config.model, openai_message_dict={"role": "system", "content": content}
        )

        # update agent in-context message IDs
        await self.append_to_in_context_messages_async(messages=[message], agent_id=agent_id, actor=actor)

    @enforce_types
    @trace_method
    async def list_attached_sources_async(self, agent_id: str, actor: PydanticUser) -> List[PydanticSource]:
        """
        Lists all sources attached to an agent.

        Args:
            agent_id: ID of the agent to list sources for
            actor: User performing the action

        Returns:
            List[str]: List of source IDs attached to the agent

        Raises:
            NoResultFound: If agent doesn't exist or user doesn't have access
        """
        async with db_registry.async_session() as session:
            # Validate agent exists and user has access
            await validate_agent_exists_async(session, agent_id, actor)

            # Use raw SQL to efficiently fetch sources - much faster than lazy loading
            # Fast query without relationship loading
            query = (
                select(SourceModel)
                .join(SourcesAgents, SourceModel.id == SourcesAgents.source_id)
                .where(
                    SourcesAgents.agent_id == agent_id,
                    SourceModel.organization_id == actor.organization_id,
                    SourceModel.is_deleted == False,
                )
                .order_by(SourceModel.created_at.desc(), SourceModel.id)
            )

            result = await session.execute(query)
            sources = result.scalars().all()

            return [source.to_pydantic() for source in sources]

    @enforce_types
    @trace_method
    async def detach_source_async(self, agent_id: str, source_id: str, actor: PydanticUser) -> PydanticAgentState:
        """
        Detaches a source from an agent.

        Args:
            agent_id: ID of the agent to detach the source from
            source_id: ID of the source to detach
            actor: User performing the action

        Raises:
            NoResultFound: If agent doesn't exist or user doesn't have access
        """
        async with db_registry.async_session() as session:
            # Validate agent exists and user has access
            await validate_agent_exists_async(session, agent_id, actor)

            # Check if the source is actually attached to this agent using junction table
            attachment_check_query = select(SourcesAgents).where(SourcesAgents.agent_id == agent_id, SourcesAgents.source_id == source_id)
            attachment_result = await session.execute(attachment_check_query)
            attachment = attachment_result.scalar_one_or_none()

            if not attachment:
                logger.warning(f"Attempted to remove unattached source id={source_id} from agent id={agent_id} by actor={actor}")
            else:
                # Delete the association directly from the junction table
                delete_query = delete(SourcesAgents).where(SourcesAgents.agent_id == agent_id, SourcesAgents.source_id == source_id)
                await session.execute(delete_query)
                await session.commit()

            # Get agent without loading relationships for return value
            agent = await AgentModel.read_async(db_session=session, identifier=agent_id, actor=actor)
            return await agent.to_pydantic_async()

    # ======================================================================================================================
    # Block management
    # ======================================================================================================================
    @enforce_types
    @trace_method
    def get_block_with_label(
        self,
        agent_id: str,
        block_label: str,
        actor: PydanticUser,
    ) -> PydanticBlock:
        """Gets a block attached to an agent by its label."""
        with db_registry.session() as session:
            agent = AgentModel.read(db_session=session, identifier=agent_id, actor=actor)
            for block in agent.core_memory:
                if block.label == block_label:
                    return block.to_pydantic()
            raise NoResultFound(f"No block with label '{block_label}' found for agent '{agent_id}'")

    @enforce_types
    @trace_method
    async def get_block_with_label_async(
        self,
        agent_id: str,
        block_label: str,
        actor: PydanticUser,
    ) -> PydanticBlock:
        """Gets a block attached to an agent by its label."""
        async with db_registry.async_session() as session:
            agent = await AgentModel.read_async(db_session=session, identifier=agent_id, actor=actor)
            for block in agent.core_memory:
                if block.label == block_label:
                    return block.to_pydantic()
            raise NoResultFound(f"No block with label '{block_label}' found for agent '{agent_id}'")

    @enforce_types
    @trace_method
    async def modify_block_by_label_async(
        self,
        agent_id: str,
        block_label: str,
        block_update: BlockUpdate,
        actor: PydanticUser,
    ) -> PydanticBlock:
        """Gets a block attached to an agent by its label."""
        async with db_registry.async_session() as session:
            block = None
            agent = await AgentModel.read_async(db_session=session, identifier=agent_id, actor=actor)
            for block in agent.core_memory:
                if block.label == block_label:
                    block = block
                    break
            if not block:
                raise NoResultFound(f"No block with label '{block_label}' found for agent '{agent_id}'")

            update_data = block_update.model_dump(to_orm=True, exclude_unset=True, exclude_none=True)

            for key, value in update_data.items():
                setattr(block, key, value)

            await block.update_async(session, actor=actor)
            return block.to_pydantic()

    @enforce_types
    @trace_method
    def update_block_with_label(
        self,
        agent_id: str,
        block_label: str,
        new_block_id: str,
        actor: PydanticUser,
    ) -> PydanticAgentState:
        """Updates which block is assigned to a specific label for an agent."""
        with db_registry.session() as session:
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
    @trace_method
    def attach_block(self, agent_id: str, block_id: str, actor: PydanticUser) -> PydanticAgentState:
        """Attaches a block to an agent. For sleeptime agents, also attaches to paired agents in the same group."""
        with db_registry.session() as session:
            agent = AgentModel.read(db_session=session, identifier=agent_id, actor=actor)
            block = BlockModel.read(db_session=session, identifier=block_id, actor=actor)

            # Attach block to the main agent
            agent.core_memory.append(block)
            agent.update(session, actor=actor, no_commit=True)

            # If agent is part of a sleeptime group, attach block to the sleeptime_agent
            if agent.multi_agent_group and agent.multi_agent_group.manager_type == ManagerType.sleeptime:
                group = agent.multi_agent_group
                # Find the sleeptime_agent in the group
                for other_agent_id in group.agent_ids or []:
                    if other_agent_id != agent_id:
                        try:
                            other_agent = AgentModel.read(db_session=session, identifier=other_agent_id, actor=actor)
                            if other_agent.agent_type == AgentType.sleeptime_agent and block not in other_agent.core_memory:
                                other_agent.core_memory.append(block)
                                other_agent.update(session, actor=actor, no_commit=True)
                        except NoResultFound:
                            # Agent might not exist anymore, skip
                            continue
            session.commit()

            return agent.to_pydantic()

    @enforce_types
    @trace_method
    async def attach_block_async(self, agent_id: str, block_id: str, actor: PydanticUser) -> PydanticAgentState:
        """Attaches a block to an agent. For sleeptime agents, also attaches to paired agents in the same group."""
        async with db_registry.async_session() as session:
            agent = await AgentModel.read_async(db_session=session, identifier=agent_id, actor=actor)
            block = await BlockModel.read_async(db_session=session, identifier=block_id, actor=actor)

            # Attach block to the main agent
            agent.core_memory.append(block)
            # await agent.update_async(session, actor=actor, no_commit=True)
            await agent.update_async(session)

            # If agent is part of a sleeptime group, attach block to the sleeptime_agent
            if agent.multi_agent_group and agent.multi_agent_group.manager_type == ManagerType.sleeptime:
                group = agent.multi_agent_group
                # Find the sleeptime_agent in the group
                for other_agent_id in group.agent_ids or []:
                    if other_agent_id != agent_id:
                        try:
                            other_agent = await AgentModel.read_async(db_session=session, identifier=other_agent_id, actor=actor)
                            if other_agent.agent_type == AgentType.sleeptime_agent and block not in other_agent.core_memory:
                                other_agent.core_memory.append(block)
                                # await other_agent.update_async(session, actor=actor, no_commit=True)
                                await other_agent.update_async(session, actor=actor)
                        except NoResultFound:
                            # Agent might not exist anymore, skip
                            continue

            # TODO: @andy/caren
            # TODO: Ideally we do two no commits on the update_async calls, and then commit here - but that errors for some reason?
            # TODO: I have too many things rn so lets look at this later
            # await session.commit()

            return await agent.to_pydantic_async()

    @enforce_types
    @trace_method
    def detach_block(
        self,
        agent_id: str,
        block_id: str,
        actor: PydanticUser,
    ) -> PydanticAgentState:
        """Detaches a block from an agent."""
        with db_registry.session() as session:
            agent = AgentModel.read(db_session=session, identifier=agent_id, actor=actor)
            original_length = len(agent.core_memory)

            agent.core_memory = [b for b in agent.core_memory if b.id != block_id]

            if len(agent.core_memory) == original_length:
                raise NoResultFound(f"No block with id '{block_id}' found for agent '{agent_id}' with actor id: '{actor.id}'")

            agent.update(session, actor=actor)
            return agent.to_pydantic()

    @enforce_types
    @trace_method
    async def detach_block_async(
        self,
        agent_id: str,
        block_id: str,
        actor: PydanticUser,
    ) -> PydanticAgentState:
        """Detaches a block from an agent."""
        async with db_registry.async_session() as session:
            agent = await AgentModel.read_async(db_session=session, identifier=agent_id, actor=actor)
            original_length = len(agent.core_memory)

            agent.core_memory = [b for b in agent.core_memory if b.id != block_id]

            if len(agent.core_memory) == original_length:
                raise NoResultFound(f"No block with id '{block_id}' found for agent '{agent_id}' with actor id: '{actor.id}'")

            await agent.update_async(session, actor=actor)
            return await agent.to_pydantic_async()

    @enforce_types
    @trace_method
    def detach_block_with_label(
        self,
        agent_id: str,
        block_label: str,
        actor: PydanticUser,
    ) -> PydanticAgentState:
        """Detaches a block with the specified label from an agent."""
        with db_registry.session() as session:
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

    @enforce_types
    @trace_method
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
        with db_registry.session() as session:
            main_query = build_passage_query(
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
                    data.pop("file_name", None)
                    passage = AgentPassage(**data)
                else:
                    # This is a SourcePassage - remove agent field
                    data.pop("agent_id", None)
                    passage = SourcePassage(**data)
                passages.append(passage)

            return [p.to_pydantic() for p in passages]

    @enforce_types
    @trace_method
    async def list_passages_async(
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
        async with db_registry.async_session() as session:
            main_query = build_passage_query(
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
            result = await session.execute(main_query)

            passages = []
            for row in result:
                data = dict(row._mapping)
                if data["agent_id"] is not None:
                    # This is an AgentPassage - remove source fields
                    data.pop("source_id", None)
                    data.pop("file_id", None)
                    data.pop("file_name", None)
                    passage = AgentPassage(**data)
                else:
                    # This is a SourcePassage - remove agent field
                    data.pop("agent_id", None)
                    passage = SourcePassage(**data)
                passages.append(passage)

            return [p.to_pydantic() for p in passages]

    @enforce_types
    @trace_method
    async def list_source_passages_async(
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
    ) -> List[PydanticPassage]:
        """Lists all passages attached to an agent."""
        async with db_registry.async_session() as session:
            main_query = build_source_passage_query(
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
            )

            # Add limit
            if limit:
                main_query = main_query.limit(limit)

            # Execute query
            result = await session.execute(main_query)

            # Get ORM objects directly using scalars()
            passages = result.scalars().all()

            # Convert to Pydantic models
            return [p.to_pydantic() for p in passages]

    @enforce_types
    @trace_method
    async def list_agent_passages_async(
        self,
        actor: PydanticUser,
        agent_id: Optional[str] = None,
        limit: Optional[int] = 50,
        query_text: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        before: Optional[str] = None,
        after: Optional[str] = None,
        embed_query: bool = False,
        ascending: bool = True,
        embedding_config: Optional[EmbeddingConfig] = None,
    ) -> List[PydanticPassage]:
        """Lists all passages attached to an agent."""
        async with db_registry.async_session() as session:
            main_query = build_agent_passage_query(
                actor=actor,
                agent_id=agent_id,
                query_text=query_text,
                start_date=start_date,
                end_date=end_date,
                before=before,
                after=after,
                embed_query=embed_query,
                ascending=ascending,
                embedding_config=embedding_config,
            )

            # Add limit
            if limit:
                main_query = main_query.limit(limit)

            # Execute query
            result = await session.execute(main_query)

            # Get ORM objects directly using scalars()
            passages = result.scalars().all()

            # Convert to Pydantic models
            return [p.to_pydantic() for p in passages]

    @enforce_types
    @trace_method
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
        with db_registry.session() as session:
            main_query = build_passage_query(
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

    @enforce_types
    async def passage_size_async(
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
        async with db_registry.async_session() as session:
            main_query = build_passage_query(
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
            return (await session.execute(count_query)).scalar() or 0

    # ======================================================================================================================
    # Tool Management
    # ======================================================================================================================
    @enforce_types
    @trace_method
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
        with db_registry.session() as session:
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
    @trace_method
    async def attach_tool_async(self, agent_id: str, tool_id: str, actor: PydanticUser) -> None:
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
        async with db_registry.async_session() as session:
            # Verify the agent exists and user has permission to access it
            await validate_agent_exists_async(session, agent_id, actor)

            # verify tool exists and belongs to organization in a single query with the insert
            # first, check if tool exists with correct organization
            tool_check_query = select(func.count(ToolModel.id)).where(
                ToolModel.id == tool_id, ToolModel.organization_id == actor.organization_id
            )
            tool_result = await session.execute(tool_check_query)
            if tool_result.scalar() == 0:
                raise NoResultFound(f"Tool with id={tool_id} not found in organization={actor.organization_id}")

            # use postgresql on conflict or mysql on duplicate key update for atomic operation
            if settings.letta_pg_uri_no_default:
                from sqlalchemy.dialects.postgresql import insert as pg_insert

                insert_stmt = pg_insert(ToolsAgents).values(agent_id=agent_id, tool_id=tool_id)
                # on conflict do nothing - silently ignore if already exists
                insert_stmt = insert_stmt.on_conflict_do_nothing(index_elements=["agent_id", "tool_id"])
                result = await session.execute(insert_stmt)
                if result.rowcount == 0:
                    logger.info(f"Tool id={tool_id} is already attached to agent id={agent_id}")
            else:
                # for sqlite/mysql, check then insert
                existing_query = (
                    select(func.count()).select_from(ToolsAgents).where(ToolsAgents.agent_id == agent_id, ToolsAgents.tool_id == tool_id)
                )
                existing_result = await session.execute(existing_query)
                if existing_result.scalar() == 0:
                    insert_stmt = insert(ToolsAgents).values(agent_id=agent_id, tool_id=tool_id)
                    await session.execute(insert_stmt)
                else:
                    logger.info(f"Tool id={tool_id} is already attached to agent id={agent_id}")

            await session.commit()

    @enforce_types
    @trace_method
    async def bulk_attach_tools_async(self, agent_id: str, tool_ids: List[str], actor: PydanticUser) -> None:
        """
        Efficiently attaches multiple tools to an agent in a single operation.

        Args:
            agent_id: ID of the agent to attach the tools to.
            tool_ids: List of tool IDs to attach.
            actor: User performing the action.

        Raises:
            NoResultFound: If the agent or any tool is not found.
        """
        if not tool_ids:
            # no tools to attach, nothing to do
            return

        async with db_registry.async_session() as session:
            # Verify the agent exists and user has permission to access it
            await validate_agent_exists_async(session, agent_id, actor)

            # verify all tools exist and belong to organization in a single query
            tool_check_query = select(func.count(ToolModel.id)).where(
                ToolModel.id.in_(tool_ids), ToolModel.organization_id == actor.organization_id
            )
            tool_result = await session.execute(tool_check_query)
            found_count = tool_result.scalar()

            if found_count != len(tool_ids):
                # find which tools are missing for better error message
                existing_query = select(ToolModel.id).where(ToolModel.id.in_(tool_ids), ToolModel.organization_id == actor.organization_id)
                existing_result = await session.execute(existing_query)
                existing_ids = {row[0] for row in existing_result}
                missing_ids = set(tool_ids) - existing_ids
                raise NoResultFound(f"Tools with ids={missing_ids} not found in organization={actor.organization_id}")

            if settings.letta_pg_uri_no_default:
                from sqlalchemy.dialects.postgresql import insert as pg_insert

                # prepare bulk values
                values = [{"agent_id": agent_id, "tool_id": tool_id} for tool_id in tool_ids]

                # bulk insert with on conflict do nothing
                insert_stmt = pg_insert(ToolsAgents).values(values)
                insert_stmt = insert_stmt.on_conflict_do_nothing(index_elements=["agent_id", "tool_id"])
                result = await session.execute(insert_stmt)
                logger.info(
                    f"Attached {result.rowcount} new tools to agent {agent_id} (skipped {len(tool_ids) - result.rowcount} already attached)"
                )
            else:
                # for sqlite/mysql, first check which tools are already attached
                existing_query = select(ToolsAgents.tool_id).where(ToolsAgents.agent_id == agent_id, ToolsAgents.tool_id.in_(tool_ids))
                existing_result = await session.execute(existing_query)
                already_attached = {row[0] for row in existing_result}

                # only insert tools that aren't already attached
                new_tool_ids = [tid for tid in tool_ids if tid not in already_attached]

                if new_tool_ids:
                    # bulk insert new attachments
                    values = [{"agent_id": agent_id, "tool_id": tool_id} for tool_id in new_tool_ids]
                    insert_stmt = insert(ToolsAgents).values(values)
                    await session.execute(insert_stmt)
                    logger.info(
                        f"Attached {len(new_tool_ids)} new tools to agent {agent_id} (skipped {len(already_attached)} already attached)"
                    )
                else:
                    logger.info(f"All {len(tool_ids)} tools already attached to agent {agent_id}")

            await session.commit()

    @enforce_types
    @trace_method
    async def attach_missing_files_tools_async(self, agent_state: PydanticAgentState, actor: PydanticUser) -> PydanticAgentState:
        """
        Attaches missing core file tools to an agent.

        Args:
            agent_state: The current agent state with tools already loaded.
            actor: User performing the action.

        Raises:
            NoResultFound: If the agent or tool is not found.

        Returns:
            PydanticAgentState: The updated agent state.
        """
        # get current file tools attached to the agent
        attached_file_tool_names = {tool.name for tool in agent_state.tools if tool.tool_type == ToolType.LETTA_FILES_CORE}

        # determine which file tools are missing
        missing_tool_names = set(FILES_TOOLS) - attached_file_tool_names

        if not missing_tool_names:
            # agent already has all file tools
            return agent_state

        # get full tool objects for all missing file tools in one query
        async with db_registry.async_session() as session:
            query = select(ToolModel).where(
                ToolModel.name.in_(missing_tool_names),
                ToolModel.organization_id == actor.organization_id,
                ToolModel.tool_type == ToolType.LETTA_FILES_CORE,
            )
            result = await session.execute(query)
            found_tool_models = result.scalars().all()

        if not found_tool_models:
            logger.warning(f"No file tools found for organization {actor.organization_id}. Expected tools: {missing_tool_names}")
            return agent_state

        # convert to pydantic tools
        found_tools = [tool.to_pydantic() for tool in found_tool_models]
        found_tool_names = {tool.name for tool in found_tools}

        # log if any expected tools weren't found
        still_missing = missing_tool_names - found_tool_names
        if still_missing:
            logger.warning(f"File tools {still_missing} not found in organization {actor.organization_id}")

        # extract tool IDs for bulk attach
        tool_ids_to_attach = [tool.id for tool in found_tools]

        # bulk attach all found file tools
        await self.bulk_attach_tools_async(agent_id=agent_state.id, tool_ids=tool_ids_to_attach, actor=actor)

        # create a shallow copy with updated tools list to avoid modifying input
        agent_state_dict = agent_state.model_dump()
        agent_state_dict["tools"] = agent_state.tools + found_tools

        return PydanticAgentState(**agent_state_dict)

    @enforce_types
    @trace_method
    async def detach_all_files_tools_async(self, agent_state: PydanticAgentState, actor: PydanticUser) -> PydanticAgentState:
        """
        Detach all core file tools from an agent.

        Args:
            agent_state: The current agent state with tools already loaded.
            actor: User performing the action.

        Raises:
            NoResultFound: If the agent is not found.

        Returns:
            PydanticAgentState: The updated agent state.
        """
        # extract file tool IDs directly from agent_state.tools
        file_tool_ids = [tool.id for tool in agent_state.tools if tool.tool_type == ToolType.LETTA_FILES_CORE]

        if not file_tool_ids:
            # no file tools to detach
            return agent_state

        # bulk detach all file tools in one operation
        await self.bulk_detach_tools_async(agent_id=agent_state.id, tool_ids=file_tool_ids, actor=actor)

        # create a shallow copy with updated tools list to avoid modifying input
        agent_state_dict = agent_state.model_dump()
        agent_state_dict["tools"] = [tool for tool in agent_state.tools if tool.tool_type != ToolType.LETTA_FILES_CORE]

        return PydanticAgentState(**agent_state_dict)

    @enforce_types
    @trace_method
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
        with db_registry.session() as session:
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
    @trace_method
    async def detach_tool_async(self, agent_id: str, tool_id: str, actor: PydanticUser) -> None:
        """
        Detaches a tool from an agent.

        Args:
            agent_id: ID of the agent to detach the tool from.
            tool_id: ID of the tool to detach.
            actor: User performing the action.

        Raises:
            NoResultFound: If the agent is not found.
        """
        async with db_registry.async_session() as session:
            # Verify the agent exists and user has permission to access it
            await validate_agent_exists_async(session, agent_id, actor)

            # Delete the association directly - if it doesn't exist, rowcount will be 0
            delete_query = delete(ToolsAgents).where(ToolsAgents.agent_id == agent_id, ToolsAgents.tool_id == tool_id)
            result = await session.execute(delete_query)

            if result.rowcount == 0:
                logger.warning(f"Attempted to remove unattached tool id={tool_id} from agent id={agent_id} by actor={actor}")
            else:
                logger.debug(f"Detached tool id={tool_id} from agent id={agent_id}")

            await session.commit()

    @enforce_types
    @trace_method
    async def bulk_detach_tools_async(self, agent_id: str, tool_ids: List[str], actor: PydanticUser) -> None:
        """
        Efficiently detaches multiple tools from an agent in a single operation.

        Args:
            agent_id: ID of the agent to detach the tools from.
            tool_ids: List of tool IDs to detach.
            actor: User performing the action.

        Raises:
            NoResultFound: If the agent is not found.
        """
        if not tool_ids:
            # no tools to detach, nothing to do
            return

        async with db_registry.async_session() as session:
            # Verify the agent exists and user has permission to access it
            await validate_agent_exists_async(session, agent_id, actor)

            # Delete all associations in a single query
            delete_query = delete(ToolsAgents).where(ToolsAgents.agent_id == agent_id, ToolsAgents.tool_id.in_(tool_ids))
            result = await session.execute(delete_query)

            detached_count = result.rowcount
            if detached_count == 0:
                logger.warning(f"No tools from list {tool_ids} were attached to agent id={agent_id}")
            elif detached_count < len(tool_ids):
                logger.info(f"Detached {detached_count} tools from agent {agent_id} ({len(tool_ids) - detached_count} were not attached)")
            else:
                logger.info(f"Detached all {detached_count} tools from agent {agent_id}")

            await session.commit()

    @enforce_types
    @trace_method
    def list_attached_tools(self, agent_id: str, actor: PydanticUser) -> List[PydanticTool]:
        """
        List all tools attached to an agent.

        Args:
            agent_id: ID of the agent to list tools for.
            actor: User performing the action.

        Returns:
            List[PydanticTool]: List of tools attached to the agent.
        """
        with db_registry.session() as session:
            agent = AgentModel.read(db_session=session, identifier=agent_id, actor=actor)
            return [tool.to_pydantic() for tool in agent.tools]

    @enforce_types
    @trace_method
    async def list_attached_tools_async(self, agent_id: str, actor: PydanticUser) -> List[PydanticTool]:
        """
        List all tools attached to an agent (async version with optimized performance).
        Uses direct SQL queries to avoid SqlAlchemyBase overhead.

        Args:
            agent_id: ID of the agent to list tools for.
            actor: User performing the action.

        Returns:
            List[PydanticTool]: List of tools attached to the agent.
        """
        async with db_registry.async_session() as session:
            # lightweight check for agent access
            await validate_agent_exists_async(session, agent_id, actor)

            # direct query for tools via join - much more performant
            query = (
                select(ToolModel)
                .join(ToolsAgents, ToolModel.id == ToolsAgents.tool_id)
                .where(ToolsAgents.agent_id == agent_id, ToolModel.organization_id == actor.organization_id)
            )

            result = await session.execute(query)
            tools = result.scalars().all()
            return [tool.to_pydantic() for tool in tools]

    # ======================================================================================================================
    # File Management
    # ======================================================================================================================
    async def insert_file_into_context_windows(
        self,
        source_id: str,
        file_metadata_with_content: PydanticFileMetadata,
        actor: PydanticUser,
        agent_states: Optional[List[PydanticAgentState]] = None,
    ) -> List[PydanticAgentState]:
        """
        Insert the uploaded document into the context window of all agents
        attached to the given source.
        """
        agent_states = agent_states or await self.source_manager.list_attached_agents(source_id=source_id, actor=actor)

        # Return early
        if not agent_states:
            return []

        logger.info(f"Inserting document into context window for source: {source_id}")
        logger.info(f"Attached agents: {[a.id for a in agent_states]}")

        # Generate visible content for the file
        line_chunker = LineChunker()
        content_lines = line_chunker.chunk_text(file_metadata=file_metadata_with_content)
        visible_content = "\n".join(content_lines)
        visible_content_map = {file_metadata_with_content.file_name: visible_content}

        # Attach file to each agent using bulk method (one file per agent, but atomic per agent)
        all_closed_files = await asyncio.gather(
            *(
                self.file_agent_manager.attach_files_bulk(
                    agent_id=agent_state.id,
                    files_metadata=[file_metadata_with_content],
                    visible_content_map=visible_content_map,
                    actor=actor,
                    max_files_open=agent_state.max_files_open,
                )
                for agent_state in agent_states
            )
        )
        # Flatten and log if any files were closed
        closed_files = [file for closed_list in all_closed_files for file in closed_list]
        if closed_files:
            logger.info(f"LRU eviction closed {len(closed_files)} files during bulk attach: {closed_files}")

        return agent_states

    async def insert_files_into_context_window(
        self, agent_state: PydanticAgentState, file_metadata_with_content: List[PydanticFileMetadata], actor: PydanticUser
    ) -> None:
        """
        Insert the uploaded documents into the context window of an agent
        attached to the given source.
        """
        logger.info(f"Inserting {len(file_metadata_with_content)} documents into context window for agent_state: {agent_state.id}")

        # Generate visible content for each file
        line_chunker = LineChunker()
        visible_content_map = {}
        for file_metadata in file_metadata_with_content:
            content_lines = line_chunker.chunk_text(file_metadata=file_metadata)
            visible_content_map[file_metadata.file_name] = "\n".join(content_lines)

        # Use bulk attach to avoid race conditions and duplicate LRU eviction decisions
        closed_files = await self.file_agent_manager.attach_files_bulk(
            agent_id=agent_state.id,
            files_metadata=file_metadata_with_content,
            visible_content_map=visible_content_map,
            actor=actor,
            max_files_open=agent_state.max_files_open,
        )

        if closed_files:
            logger.info(f"LRU eviction closed {len(closed_files)} files during bulk insert: {closed_files}")

    # ======================================================================================================================
    # Tag Management
    # ======================================================================================================================
    @enforce_types
    @trace_method
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
        with db_registry.session() as session:
            query = (
                session.query(AgentsTags.tag)
                .join(AgentModel, AgentModel.id == AgentsTags.agent_id)
                .filter(AgentModel.organization_id == actor.organization_id)
                .distinct()
            )

            if query_text:
                if settings.database_engine is DatabaseChoice.POSTGRES:
                    # PostgreSQL: Use ILIKE for case-insensitive search
                    query = query.filter(AgentsTags.tag.ilike(f"%{query_text}%"))
                else:
                    # SQLite: Use LIKE with LOWER for case-insensitive search
                    query = query.filter(func.lower(AgentsTags.tag).like(func.lower(f"%{query_text}%")))

            if after:
                query = query.filter(AgentsTags.tag > after)

            query = query.order_by(AgentsTags.tag).limit(limit)
            results = [tag[0] for tag in query.all()]
            return results

    @enforce_types
    @trace_method
    async def list_tags_async(
        self, actor: PydanticUser, after: Optional[str] = None, limit: Optional[int] = 50, query_text: Optional[str] = None
    ) -> List[str]:
        """
        Get all tags a user has created, ordered alphabetically.

        Args:
            actor: User performing the action.
            after: Cursor for forward pagination.
            limit: Maximum number of tags to return.
            query text to filter tags by.

        Returns:
            List[str]: List of all tags.
        """
        async with db_registry.async_session() as session:
            # Build the query using select() for async SQLAlchemy
            query = (
                select(AgentsTags.tag)
                .join(AgentModel, AgentModel.id == AgentsTags.agent_id)
                .where(AgentModel.organization_id == actor.organization_id)
                .distinct()
            )

            if query_text:
                if settings.database_engine is DatabaseChoice.POSTGRES:
                    # PostgreSQL: Use ILIKE for case-insensitive search
                    query = query.where(AgentsTags.tag.ilike(f"%{query_text}%"))
                else:
                    # SQLite: Use LIKE with LOWER for case-insensitive search
                    query = query.where(func.lower(AgentsTags.tag).like(func.lower(f"%{query_text}%")))

            if after:
                query = query.where(AgentsTags.tag > after)

            query = query.order_by(AgentsTags.tag).limit(limit)

            # Execute the query asynchronously
            result = await session.execute(query)
            # Extract the tag values from the result
            results = [row[0] for row in result.all()]
            return results

    @enforce_types
    @trace_method
    async def get_agent_files_config_async(self, agent_id: str, actor: PydanticUser) -> Tuple[int, int]:
        """Get per_file_view_window_char_limit and max_files_open for an agent.

        This is a performant query that only fetches the specific fields needed.

        Args:
            agent_id: The ID of the agent
            actor: The user making the request

        Returns:
            Tuple of per_file_view_window_char_limit, max_files_open values
        """
        async with db_registry.async_session() as session:
            result = await session.execute(
                select(AgentModel.per_file_view_window_char_limit, AgentModel.max_files_open)
                .where(AgentModel.id == agent_id)
                .where(AgentModel.organization_id == actor.organization_id)
                .where(AgentModel.is_deleted == False)
            )
            row = result.one_or_none()

            if row is None:
                raise ValueError(f"Agent {agent_id} not found")

            per_file_limit, max_files = row[0], row[1]

            # Handle None values by calculating defaults based on context window
            if per_file_limit is None or max_files is None:
                # Get the agent's model context window to calculate appropriate defaults
                model_result = await session.execute(
                    select(AgentModel.llm_config)
                    .where(AgentModel.id == agent_id)
                    .where(AgentModel.organization_id == actor.organization_id)
                    .where(AgentModel.is_deleted == False)
                )
                model_row = model_result.one_or_none()
                context_window = model_row[0].context_window if model_row and model_row[0] else None

                default_max_files, default_per_file_limit = calculate_file_defaults_based_on_context_window(context_window)

                # Use calculated defaults for None values
                if per_file_limit is None:
                    per_file_limit = default_per_file_limit
                if max_files is None:
                    max_files = default_max_files

            # FINAL fallback: ensure neither is None (should never happen, but just in case)
            if per_file_limit is None:
                per_file_limit = DEFAULT_CORE_MEMORY_SOURCE_CHAR_LIMIT
            if max_files is None:
                max_files = DEFAULT_MAX_FILES_OPEN

            return per_file_limit, max_files

    @enforce_types
    @trace_method
    async def get_agent_max_files_open_async(self, agent_id: str, actor: PydanticUser) -> int:
        """Get max_files_open for an agent.

        This is a performant query that only fetches the specific field needed.

        Args:
            agent_id: The ID of the agent
            actor: The user making the request

        Returns:
            max_files_open value
        """
        async with db_registry.async_session() as session:
            result = await session.execute(
                select(AgentModel.max_files_open)
                .where(AgentModel.id == agent_id)
                .where(AgentModel.organization_id == actor.organization_id)
                .where(AgentModel.is_deleted == False)
            )
            row = result.scalar_one_or_none()

            if row is None:
                raise ValueError(f"Agent {agent_id} not found")

            return row

    @enforce_types
    @trace_method
    async def get_agent_per_file_view_window_char_limit_async(self, agent_id: str, actor: PydanticUser) -> int:
        """Get per_file_view_window_char_limit for an agent.

        This is a performant query that only fetches the specific field needed.

        Args:
            agent_id: The ID of the agent
            actor: The user making the request

        Returns:
            per_file_view_window_char_limit value
        """
        async with db_registry.async_session() as session:
            result = await session.execute(
                select(AgentModel.per_file_view_window_char_limit)
                .where(AgentModel.id == agent_id)
                .where(AgentModel.organization_id == actor.organization_id)
                .where(AgentModel.is_deleted == False)
            )
            row = result.scalar_one_or_none()

            if row is None:
                raise ValueError(f"Agent {agent_id} not found")

            return row

    @trace_method
    async def get_context_window(self, agent_id: str, actor: PydanticUser) -> ContextWindowOverview:
        agent_state, system_message, num_messages, num_archival_memories = await self.rebuild_system_prompt_async(
            agent_id=agent_id, actor=actor, force=True, dry_run=True
        )
        calculator = ContextWindowCalculator()

        if os.getenv("LETTA_ENVIRONMENT") == "PRODUCTION" or agent_state.llm_config.model_endpoint_type == "anthropic":
            anthropic_client = LLMClient.create(provider_type=ProviderType.anthropic, actor=actor)
            model = agent_state.llm_config.model if agent_state.llm_config.model_endpoint_type == "anthropic" else None

            token_counter = AnthropicTokenCounter(anthropic_client, model)  # noqa
        else:
            token_counter = TiktokenCounter(agent_state.llm_config.model)

        return await calculator.calculate_context_window(
            agent_state=agent_state,
            actor=actor,
            token_counter=token_counter,
            message_manager=self.message_manager,
            system_message_compiled=system_message,
            num_archival_memories=num_archival_memories,
            num_messages=num_messages,
        )
