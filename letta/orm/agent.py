import uuid
from typing import TYPE_CHECKING, List, Optional, Set

from sqlalchemy import JSON, Boolean, Index, String
from sqlalchemy.ext.asyncio import AsyncAttrs
from sqlalchemy.orm import Mapped, mapped_column, relationship

from letta.orm.block import Block
from letta.orm.custom_columns import EmbeddingConfigColumn, LLMConfigColumn, ResponseFormatColumn, ToolRulesColumn
from letta.orm.identity import Identity
from letta.orm.mixins import OrganizationMixin
from letta.orm.organization import Organization
from letta.orm.sqlalchemy_base import SqlalchemyBase
from letta.schemas.agent import AgentState as PydanticAgentState
from letta.schemas.agent import AgentType, get_prompt_template_for_agent_type
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.llm_config import LLMConfig
from letta.schemas.memory import Memory
from letta.schemas.response_format import ResponseFormatUnion
from letta.schemas.tool_rule import ToolRule

if TYPE_CHECKING:
    from letta.orm.agents_tags import AgentsTags
    from letta.orm.identity import Identity
    from letta.orm.organization import Organization
    from letta.orm.source import Source
    from letta.orm.tool import Tool


class Agent(SqlalchemyBase, OrganizationMixin, AsyncAttrs):
    __tablename__ = "agents"
    __pydantic_model__ = PydanticAgentState
    __table_args__ = (Index("ix_agents_created_at", "created_at", "id"),)

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
    project_id: Mapped[Optional[str]] = mapped_column(String, nullable=True, doc="The id of the project the agent belongs to.")
    template_id: Mapped[Optional[str]] = mapped_column(String, nullable=True, doc="The id of the template the agent belongs to.")
    base_template_id: Mapped[Optional[str]] = mapped_column(String, nullable=True, doc="The base template id of the agent.")

    # Tool rules
    tool_rules: Mapped[Optional[List[ToolRule]]] = mapped_column(ToolRulesColumn, doc="the tool rules for this agent.")

    # Stateless
    message_buffer_autoclear: Mapped[bool] = mapped_column(
        Boolean, doc="If set to True, the agent will not remember previous messages. Not recommended unless you have an advanced use case."
    )
    enable_sleeptime: Mapped[Optional[bool]] = mapped_column(
        Boolean, doc="If set to True, memory management will move to a background agent thread."
    )

    # relationships
    organization: Mapped["Organization"] = relationship("Organization", back_populates="agents")
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
        lazy="selectin",
        back_populates="agents",
        passive_deletes=True,
    )
    multi_agent_group: Mapped["Group"] = relationship(
        "Group",
        lazy="selectin",
        viewonly=True,
        back_populates="manager_agent",
    )
    batch_items: Mapped[List["LLMBatchItem"]] = relationship("LLMBatchItem", back_populates="agent", lazy="selectin")

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
            "tool_rules": self.tool_rules,
            "message_buffer_autoclear": self.message_buffer_autoclear,
            "created_by_id": self.created_by_id,
            "last_updated_by_id": self.last_updated_by_id,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            # optional field defaults
            "tags": [],
            "tools": [],
            "sources": [],
            "memory": Memory(blocks=[]),
            "identity_ids": [],
            "multi_agent_group": None,
            "tool_exec_environment_variables": [],
            "enable_sleeptime": None,
            "response_format": self.response_format,
        }

        # Optional fields: only included if requested
        optional_fields = {
            "tags": lambda: [t.tag for t in self.tags],
            "tools": lambda: self.tools,
            "sources": lambda: [s.to_pydantic() for s in self.sources],
            "memory": lambda: Memory(
                blocks=[b.to_pydantic() for b in self.core_memory],
                prompt_template=get_prompt_template_for_agent_type(self.agent_type),
            ),
            "identity_ids": lambda: [i.id for i in self.identities],
            "multi_agent_group": lambda: self.multi_agent_group,
            "tool_exec_environment_variables": lambda: self.tool_exec_environment_variables,
            "enable_sleeptime": lambda: self.enable_sleeptime,
        }

        include_relationships = set(optional_fields.keys() if include_relationships is None else include_relationships)

        for field_name in include_relationships:
            resolver = optional_fields.get(field_name)
            if resolver:
                state[field_name] = resolver()

        return self.__pydantic_model__(**state)

    async def to_pydantic_async(self, include_relationships: Optional[Set[str]] = None) -> PydanticAgentState:
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
            "tool_rules": self.tool_rules,
            "message_buffer_autoclear": self.message_buffer_autoclear,
            "created_by_id": self.created_by_id,
            "last_updated_by_id": self.last_updated_by_id,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            # optional field defaults
            "tags": [],
            "tools": [],
            "sources": [],
            "memory": Memory(blocks=[]),
            "identity_ids": [],
            "multi_agent_group": None,
            "tool_exec_environment_variables": [],
            "enable_sleeptime": None,
            "response_format": self.response_format,
        }
        optional_fields = {
            "tags": [],
            "tools": [],
            "sources": [],
            "memory": Memory(blocks=[]),
            "identity_ids": [],
            "multi_agent_group": None,
            "tool_exec_environment_variables": [],
            "enable_sleeptime": None,
            "response_format": self.response_format,
        }

        # Initialize include_relationships to an empty set if it's None
        include_relationships = set(optional_fields.keys() if include_relationships is None else include_relationships)

        # Only load requested relationships
        if "tags" in include_relationships:
            tags = await self.awaitable_attrs.tags
            state["tags"] = [t.tag for t in tags]

        if "tools" in include_relationships:
            state["tools"] = await self.awaitable_attrs.tools

        if "sources" in include_relationships:
            sources = await self.awaitable_attrs.sources
            state["sources"] = [s.to_pydantic() for s in sources]

        if "memory" in include_relationships:
            memory_blocks = await self.awaitable_attrs.core_memory
            state["memory"] = Memory(
                blocks=[b.to_pydantic() for b in memory_blocks],
                prompt_template=get_prompt_template_for_agent_type(self.agent_type),
            )

        if "identity_ids" in include_relationships:
            identities = await self.awaitable_attrs.identities
            state["identity_ids"] = [i.id for i in identities]

        if "multi_agent_group" in include_relationships:
            state["multi_agent_group"] = await self.awaitable_attrs.multi_agent_group

        if "tool_exec_environment_variables" in include_relationships:
            state["tool_exec_environment_variables"] = await self.awaitable_attrs.tool_exec_environment_variables

        if "enable_sleeptime" in include_relationships:
            state["enable_sleeptime"] = await self.awaitable_attrs.enable_sleeptime

        return self.__pydantic_model__(**state)
