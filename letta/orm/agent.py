import asyncio
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional, Set

from sqlalchemy import JSON, Boolean, DateTime, Index, Integer, String
from sqlalchemy.ext.asyncio import AsyncAttrs
from sqlalchemy.orm import Mapped, mapped_column, relationship

from letta.orm.block import Block
from letta.orm.custom_columns import EmbeddingConfigColumn, LLMConfigColumn, ResponseFormatColumn, ToolRulesColumn
from letta.orm.identity import Identity
from letta.orm.mixins import OrganizationMixin, ProjectMixin, TemplateEntityMixin, TemplateMixin
from letta.orm.organization import Organization
from letta.orm.sqlalchemy_base import SqlalchemyBase
from letta.schemas.agent import AgentState as PydanticAgentState
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import AgentType
from letta.schemas.letta_stop_reason import StopReasonType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.memory import Memory
from letta.schemas.response_format import ResponseFormatUnion
from letta.schemas.tool_rule import ToolRule
from letta.utils import calculate_file_defaults_based_on_context_window

if TYPE_CHECKING:
    from letta.orm.agents_tags import AgentsTags
    from letta.orm.archives_agents import ArchivesAgents
    from letta.orm.files_agents import FileAgent
    from letta.orm.identity import Identity
    from letta.orm.organization import Organization
    from letta.orm.run import Run
    from letta.orm.source import Source
    from letta.orm.tool import Tool


class Agent(SqlalchemyBase, OrganizationMixin, ProjectMixin, TemplateEntityMixin, TemplateMixin, AsyncAttrs):
    __tablename__ = "agents"
    __pydantic_model__ = PydanticAgentState
    __table_args__ = (
        Index("ix_agents_created_at", "created_at", "id"),
        Index("ix_agents_organization_id_deployment_id", "organization_id", "deployment_id"),
        Index("ix_agents_project_id", "project_id"),
    )

    # agent generates its own id
    # TODO: We want to migrate all the ORM models to do this, so we will need to move this to the SqlalchemyBase
    # TODO: Some still rely on the Pydantic object to do this
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"agent-{uuid.uuid4()}")

    # Descriptor fields
    agent_type: Mapped[Optional[AgentType]] = mapped_column(String, nullable=True, doc="The type of Agent")
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True, doc="a human-readable identifier for an agent, non-unique.")
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True, doc="The description of the agent.")

    # System prompt
    system: Mapped[Optional[str]] = mapped_column(String, nullable=True, doc="The system prompt used by the agent.")

    # In context memory
    # TODO: This should be a separate mapping table
    # This is dangerously flexible with the JSON type
    message_ids: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True, doc="List of message IDs in in-context memory.")

    # Response Format
    response_format: Mapped[Optional[ResponseFormatUnion]] = mapped_column(
        ResponseFormatColumn, nullable=True, doc="The response format for the agent."
    )

    # Metadata and configs
    metadata_: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, doc="metadata for the agent.")
    llm_config: Mapped[Optional[LLMConfig]] = mapped_column(
        LLMConfigColumn, nullable=True, doc="the LLM backend configuration object for this agent."
    )
    embedding_config: Mapped[Optional[EmbeddingConfig]] = mapped_column(
        EmbeddingConfigColumn, doc="the embedding configuration object for this agent."
    )

    # Tool rules
    tool_rules: Mapped[Optional[List[ToolRule]]] = mapped_column(ToolRulesColumn, doc="the tool rules for this agent.")

    # Stateless
    message_buffer_autoclear: Mapped[bool] = mapped_column(
        Boolean, doc="If set to True, the agent will not remember previous messages. Not recommended unless you have an advanced use case."
    )
    enable_sleeptime: Mapped[Optional[bool]] = mapped_column(
        Boolean, doc="If set to True, memory management will move to a background agent thread."
    )

    # Run metrics
    last_run_completion: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, doc="The timestamp when the agent last completed a run."
    )
    last_run_duration_ms: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, doc="The duration in milliseconds of the agent's last run."
    )
    last_stop_reason: Mapped[Optional[StopReasonType]] = mapped_column(
        String, nullable=True, doc="The stop reason from the agent's last run."
    )

    # timezone
    timezone: Mapped[Optional[str]] = mapped_column(String, nullable=True, doc="The timezone of the agent (for the context window).")

    # file related controls
    max_files_open: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, doc="Maximum number of files that can be open at once for this agent."
    )
    per_file_view_window_char_limit: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, doc="The per-file view window character limit for this agent."
    )

    # indexing controls
    hidden: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True, default=None, doc="If set to True, the agent will be hidden.")
    _vector_db_namespace: Mapped[Optional[str]] = mapped_column(String, nullable=True, doc="Private field for vector database namespace")

    # relationships
    organization: Mapped["Organization"] = relationship("Organization", back_populates="agents", lazy="raise")
    tool_exec_environment_variables: Mapped[List["AgentEnvironmentVariable"]] = relationship(
        "AgentEnvironmentVariable",
        back_populates="agent",
        cascade="all, delete-orphan",
        lazy="selectin",
        doc="Environment variables associated with this agent.",
    )
    tools: Mapped[List["Tool"]] = relationship("Tool", secondary="tools_agents", lazy="selectin", passive_deletes=True)
    sources: Mapped[List["Source"]] = relationship("Source", secondary="sources_agents", lazy="selectin")
    core_memory: Mapped[List["Block"]] = relationship(
        "Block",
        secondary="blocks_agents",
        lazy="selectin",
        passive_deletes=True,  # Ensures SQLAlchemy doesn't fetch blocks_agents rows before deleting
        back_populates="agents",
        doc="Blocks forming the core memory of the agent.",
    )
    tags: Mapped[List["AgentsTags"]] = relationship(
        "AgentsTags",
        back_populates="agent",
        cascade="all, delete-orphan",
        lazy="selectin",
        doc="Tags associated with the agent.",
    )
    runs: Mapped[List["Run"]] = relationship(
        "Run",
        back_populates="agent",
        cascade="all, delete-orphan",
        lazy="selectin",
        doc="Runs associated with the agent.",
    )
    identities: Mapped[List["Identity"]] = relationship(
        "Identity",
        secondary="identities_agents",
        lazy="selectin",
        back_populates="agents",
        passive_deletes=True,
    )
    groups: Mapped[List["Group"]] = relationship(
        "Group",
        secondary="groups_agents",
        lazy="raise",
        back_populates="agents",
        passive_deletes=True,
    )
    multi_agent_group: Mapped["Group"] = relationship(
        "Group",
        lazy="selectin",
        viewonly=True,
        back_populates="manager_agent",
    )
    batch_items: Mapped[List["LLMBatchItem"]] = relationship("LLMBatchItem", back_populates="agent", lazy="raise")
    file_agents: Mapped[List["FileAgent"]] = relationship(
        "FileAgent",
        back_populates="agent",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    archives_agents: Mapped[List["ArchivesAgents"]] = relationship(
        "ArchivesAgents",
        back_populates="agent",
        cascade="all, delete-orphan",
        lazy="noload",
        doc="Archives accessible by this agent.",
    )

    def _get_per_file_view_window_char_limit(self) -> int:
        """Get the per_file_view_window_char_limit, calculating defaults if None."""
        if self.per_file_view_window_char_limit is not None:
            return self.per_file_view_window_char_limit

        context_window = self.llm_config.context_window if self.llm_config and self.llm_config.context_window else None
        _, default_char_limit = calculate_file_defaults_based_on_context_window(context_window)
        return default_char_limit

    def to_pydantic(self, include_relationships: Optional[Set[str]] = None) -> PydanticAgentState:
        """
        Converts the SQLAlchemy Agent model into its Pydantic counterpart.

        The following base fields are always included:
          - id, agent_type, name, description, system, message_ids, metadata_,
            llm_config, embedding_config, project_id, template_id, base_template_id,
            tool_rules, message_buffer_autoclear, tags

        Everything else (e.g., tools, sources, memory, etc.) is optional and only
        included if specified in `include_fields`.

        Args:
            include_relationships (Optional[Set[str]]):
                A set of additional field names to include in the output. If None or empty,
                no extra fields are loaded beyond the base fields.

        Returns:
            PydanticAgentState: The Pydantic representation of the agent.
        """
        # Base fields: always included
        state = {
            "id": self.id,
            "agent_type": self.agent_type,
            "name": self.name,
            "description": self.description,
            "system": self.system,
            "message_ids": self.message_ids,
            "metadata": self.metadata_,  # Exposed as 'metadata' to Pydantic
            "llm_config": self.llm_config,
            "embedding_config": self.embedding_config,
            "project_id": self.project_id,
            "template_id": self.template_id,
            "base_template_id": self.base_template_id,
            "deployment_id": self.deployment_id,
            "entity_id": self.entity_id,
            "tool_rules": self.tool_rules,
            "message_buffer_autoclear": self.message_buffer_autoclear,
            "created_by_id": self.created_by_id,
            "last_updated_by_id": self.last_updated_by_id,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "enable_sleeptime": self.enable_sleeptime,
            "response_format": self.response_format,
            "last_run_completion": self.last_run_completion,
            "last_run_duration_ms": self.last_run_duration_ms,
            "last_stop_reason": self.last_stop_reason,
            "timezone": self.timezone,
            "max_files_open": self.max_files_open,
            "per_file_view_window_char_limit": self.per_file_view_window_char_limit,
            "hidden": self.hidden,
            # optional field defaults
            "tags": [],
            "tools": [],
            "sources": [],
            "memory": Memory(blocks=[]),
            "blocks": [],
            "identity_ids": [],
            "identities": [],
            "multi_agent_group": None,
            "tool_exec_environment_variables": [],
            "secrets": [],
        }

        # Optional fields: only included if requested
        optional_fields = {
            "tags": lambda: [t.tag for t in self.tags],
            "tools": lambda: self.tools,
            "sources": lambda: [s.to_pydantic() for s in self.sources],
            "memory": lambda: Memory(
                blocks=[b.to_pydantic() for b in self.core_memory],
                file_blocks=[
                    block
                    for b in self.file_agents
                    if (block := b.to_pydantic_block(per_file_view_window_char_limit=self._get_per_file_view_window_char_limit()))
                    is not None
                ],
                agent_type=self.agent_type,
            ),
            "blocks": lambda: [b.to_pydantic() for b in self.core_memory],
            "identity_ids": lambda: [i.id for i in self.identities],
            "identities": lambda: [i.to_pydantic() for i in self.identities],  # TODO: fix this
            "multi_agent_group": lambda: self.multi_agent_group,
            "managed_group": lambda: self.multi_agent_group,
            "tool_exec_environment_variables": lambda: self.tool_exec_environment_variables,
            "secrets": lambda: self.tool_exec_environment_variables,
        }

        include_relationships = set(optional_fields.keys() if include_relationships is None else include_relationships)

        for field_name in include_relationships:
            resolver = optional_fields.get(field_name)
            if resolver:
                state[field_name] = resolver()

        state["model"] = self.llm_config.handle if self.llm_config else None
        state["model_settings"] = self.llm_config._to_model_settings() if self.llm_config else None
        state["embedding"] = self.embedding_config.handle if self.embedding_config else None

        return self.__pydantic_model__(**state)

    async def to_pydantic_async(
        self,
        include_relationships: Optional[Set[str]] = None,
        include: Optional[List[str]] = None,
    ) -> PydanticAgentState:
        """
        Converts the SQLAlchemy Agent model into its Pydantic counterpart.

        The following base fields are always included:
          - id, agent_type, name, description, system, message_ids, metadata_,
            llm_config, embedding_config, project_id, template_id, base_template_id,
            tool_rules, message_buffer_autoclear, tags

        Everything else (e.g., tools, sources, memory, etc.) is optional and only
        included if specified in `include_fields`.

        Args:
            include_relationships (Optional[Set[str]]):
                A set of additional field names to include in the output. If None or empty,
                no extra fields are loaded beyond the base fields.

        Returns:
            PydanticAgentState: The Pydantic representation of the agent.
        """

        # Base fields: always included
        state = {
            "id": self.id,
            "agent_type": self.agent_type,
            "name": self.name,
            "description": self.description,
            "system": self.system,
            "message_ids": self.message_ids,
            "metadata": self.metadata_,  # Exposed as 'metadata' to Pydantic
            "llm_config": self.llm_config,
            "embedding_config": self.embedding_config,
            "project_id": self.project_id,
            "template_id": self.template_id,
            "base_template_id": self.base_template_id,
            "deployment_id": self.deployment_id,
            "entity_id": self.entity_id,
            "tool_rules": self.tool_rules,
            "message_buffer_autoclear": self.message_buffer_autoclear,
            "created_by_id": self.created_by_id,
            "last_updated_by_id": self.last_updated_by_id,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "timezone": self.timezone,
            "enable_sleeptime": self.enable_sleeptime,
            "response_format": self.response_format,
            "last_run_completion": self.last_run_completion,
            "last_run_duration_ms": self.last_run_duration_ms,
            "last_stop_reason": self.last_stop_reason,
            "max_files_open": self.max_files_open,
            "per_file_view_window_char_limit": self.per_file_view_window_char_limit,
            "hidden": self.hidden,
        }
        optional_fields = {
            "tags": [],
            "tools": [],
            "sources": [],
            "memory": Memory(blocks=[]),
            "blocks": [],
            "identity_ids": [],
            "identities": [],
            "multi_agent_group": None,
            "managed_group": None,
            "tool_exec_environment_variables": [],
            "secrets": [],
        }

        # Initialize include_relationships to an empty set if it's None
        include_relationships = set(optional_fields.keys() if include_relationships is None else include_relationships)

        # Convert include list to set for efficient membership checks
        include_set = set(include) if include else set()

        async def empty_list_async():
            return []

        async def none_async():
            return None

        # Only load requested relationships
        tags = self.awaitable_attrs.tags if "tags" in include_relationships or "agent.tags" in include_set else empty_list_async()
        tools = self.awaitable_attrs.tools if "tools" in include_relationships or "agent.tools" in include_set else empty_list_async()
        sources = (
            self.awaitable_attrs.sources if "sources" in include_relationships or "agent.sources" in include_set else empty_list_async()
        )
        memory = (
            self.awaitable_attrs.core_memory if "memory" in include_relationships or "agent.blocks" in include_set else empty_list_async()
        )
        identities = (
            self.awaitable_attrs.identities
            if "identity_ids" in include_relationships or "agent.identities" in include_set
            else empty_list_async()
        )
        multi_agent_group = (
            self.awaitable_attrs.multi_agent_group
            if "multi_agent_group" in include_relationships or "agent.managed_group" in include_set
            else none_async()
        )
        tool_exec_environment_variables = (
            self.awaitable_attrs.tool_exec_environment_variables
            if "tool_exec_environment_variables" in include_relationships
            or "secrets" in include_relationships
            or "agent.secrets" in include_set
            else empty_list_async()
        )
        file_agents = (
            self.awaitable_attrs.file_agents if "memory" in include_relationships or "agent.blocks" in include_set else empty_list_async()
        )

        (tags, tools, sources, memory, identities, multi_agent_group, tool_exec_environment_variables, file_agents) = await asyncio.gather(
            tags, tools, sources, memory, identities, multi_agent_group, tool_exec_environment_variables, file_agents
        )

        state["tags"] = [t.tag for t in tags]
        state["tools"] = [t.to_pydantic() for t in tools]
        state["sources"] = [s.to_pydantic() for s in sources]
        state["memory"] = Memory(
            blocks=[m.to_pydantic() for m in memory],
            file_blocks=[
                block
                for b in file_agents
                if (block := b.to_pydantic_block(per_file_view_window_char_limit=self._get_per_file_view_window_char_limit())) is not None
            ],
            agent_type=self.agent_type,
        )
        state["blocks"] = [m.to_pydantic() for m in memory]
        state["identity_ids"] = [i.id for i in identities]
        state["identities"] = [i.to_pydantic() for i in identities]
        state["multi_agent_group"] = multi_agent_group
        state["managed_group"] = multi_agent_group
        state["tool_exec_environment_variables"] = tool_exec_environment_variables
        state["secrets"] = tool_exec_environment_variables
        state["model"] = self.llm_config.handle if self.llm_config else None
        state["model_settings"] = self.llm_config._to_model_settings() if self.llm_config else None
        state["embedding"] = self.embedding_config.handle if self.embedding_config else None

        return self.__pydantic_model__(**state)
