import uuid
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import JSON, Boolean, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from letta.orm.block import Block
from letta.orm.custom_columns import EmbeddingConfigColumn, LLMConfigColumn, ToolRulesColumn
from letta.orm.identity import Identity
from letta.orm.message import Message
from letta.orm.mixins import OrganizationMixin
from letta.orm.organization import Organization
from letta.orm.sqlalchemy_base import SqlalchemyBase
from letta.schemas.agent import AgentState as PydanticAgentState
from letta.schemas.agent import AgentType
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.llm_config import LLMConfig
from letta.schemas.memory import Memory
from letta.schemas.tool_rule import ToolRule

if TYPE_CHECKING:
    from letta.orm.agents_tags import AgentsTags
    from letta.orm.identity import Identity
    from letta.orm.organization import Organization
    from letta.orm.source import Source
    from letta.orm.tool import Tool


class Agent(SqlalchemyBase, OrganizationMixin):
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
    messages: Mapped[List["Message"]] = relationship(
        "Message",
        back_populates="agent",
        lazy="selectin",
        cascade="all, delete-orphan",  # Ensure messages are deleted when the agent is deleted
        passive_deletes=True,
    )
    tags: Mapped[List["AgentsTags"]] = relationship(
        "AgentsTags",
        back_populates="agent",
        cascade="all, delete-orphan",
        lazy="selectin",
        doc="Tags associated with the agent.",
    )
    source_passages: Mapped[List["SourcePassage"]] = relationship(
        "SourcePassage",
        secondary="sources_agents",  # The join table for Agent -> Source
        primaryjoin="Agent.id == sources_agents.c.agent_id",
        secondaryjoin="and_(SourcePassage.source_id == sources_agents.c.source_id)",
        lazy="selectin",
        order_by="SourcePassage.created_at.desc()",
        viewonly=True,  # Ensures SQLAlchemy doesn't attempt to manage this relationship
        doc="All passages derived from sources associated with this agent.",
    )
    agent_passages: Mapped[List["AgentPassage"]] = relationship(
        "AgentPassage",
        back_populates="agent",
        lazy="selectin",
        order_by="AgentPassage.created_at.desc()",
        cascade="all, delete-orphan",
        viewonly=True,  # Ensures SQLAlchemy doesn't attempt to manage this relationship
        doc="All passages derived created by this agent.",
    )
    identities: Mapped[List["Identity"]] = relationship(
        "Identity",
        secondary="identities_agents",
        lazy="selectin",
        back_populates="agents",
        passive_deletes=True,
    )

    def to_pydantic(self) -> PydanticAgentState:
        """converts to the basic pydantic model counterpart"""
        # add default rule for having send_message be a terminal tool
        tool_rules = self.tool_rules
        state = {
            "id": self.id,
            "organization_id": self.organization_id,
            "name": self.name,
            "description": self.description,
            "message_ids": self.message_ids,
            "tools": self.tools,
            "sources": [source.to_pydantic() for source in self.sources],
            "tags": [t.tag for t in self.tags],
            "tool_rules": tool_rules,
            "system": self.system,
            "agent_type": self.agent_type,
            "llm_config": self.llm_config,
            "embedding_config": self.embedding_config,
            "metadata": self.metadata_,
            "memory": Memory(blocks=[b.to_pydantic() for b in self.core_memory]),
            "created_by_id": self.created_by_id,
            "last_updated_by_id": self.last_updated_by_id,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "tool_exec_environment_variables": self.tool_exec_environment_variables,
            "project_id": self.project_id,
            "template_id": self.template_id,
            "base_template_id": self.base_template_id,
            "identity_ids": [identity.id for identity in self.identities],
            "message_buffer_autoclear": self.message_buffer_autoclear,
        }

        return self.__pydantic_model__(**state)
