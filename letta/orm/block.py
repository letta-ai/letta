from typing import TYPE_CHECKING, List, Optional, Type

from sqlalchemy import JSON, BigInteger, ForeignKey, Index, Integer, String, UniqueConstraint, event
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from letta.constants import CORE_MEMORY_BLOCK_CHAR_LIMIT
from letta.orm.block_history import BlockHistory
from letta.orm.blocks_agents import BlocksAgents
from letta.orm.mixins import OrganizationMixin, ProjectMixin, TemplateEntityMixin, TemplateMixin
from letta.orm.sqlalchemy_base import SqlalchemyBase
from letta.schemas.block import Block as PydanticBlock, Human, Persona

if TYPE_CHECKING:
    from letta.orm import Organization
    from letta.orm.identity import Identity


class Block(OrganizationMixin, SqlalchemyBase, ProjectMixin, TemplateEntityMixin, TemplateMixin):
    """Blocks are sections of the LLM context, representing a specific part of the total Memory"""

    __tablename__ = "block"
    __pydantic_model__ = PydanticBlock
    # This may seem redundant, but is necessary for the BlocksAgents composite FK relationship
    __table_args__ = (
        UniqueConstraint("id", "label", name="unique_block_id_label"),
        Index("created_at_label_idx", "created_at", "label"),
        Index("ix_block_is_template", "is_template"),
        Index("ix_block_hidden", "hidden"),
        Index("ix_block_org_project_template", "organization_id", "project_id", "is_template"),
        Index("ix_block_organization_id_deployment_id", "organization_id", "deployment_id"),
    )

    template_name: Mapped[Optional[str]] = mapped_column(
        nullable=True, doc="the unique name that identifies a block in a human-readable way"
    )
    description: Mapped[Optional[str]] = mapped_column(nullable=True, doc="a description of the block for context")
    label: Mapped[str] = mapped_column(doc="the type of memory block in use, ie 'human', 'persona', 'system'")
    is_template: Mapped[bool] = mapped_column(
        doc="whether the block is a template (e.g. saved human/persona options as baselines for other templates)", default=False
    )
    preserve_on_migration: Mapped[Optional[bool]] = mapped_column(doc="preserve the block on template migration", default=False)
    value: Mapped[str] = mapped_column(doc="Text content of the block for the respective section of core memory.")
    limit: Mapped[BigInteger] = mapped_column(Integer, default=CORE_MEMORY_BLOCK_CHAR_LIMIT, doc="Character limit of the block.")
    metadata_: Mapped[Optional[dict]] = mapped_column(JSON, default={}, doc="arbitrary information related to the block.")

    # permissions of the agent
    read_only: Mapped[bool] = mapped_column(doc="whether the agent has read-only access to the block", default=False)
    hidden: Mapped[Optional[bool]] = mapped_column(nullable=True, doc="If set to True, the block will be hidden.")

    # history pointers / locking mechanisms
    current_history_entry_id: Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("block_history.id", name="fk_block_current_history_entry", use_alter=True), nullable=True, index=True
    )
    version: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default="1", doc="Optimistic locking version counter, incremented on each state change."
    )
    # NOTE: This takes advantage of built-in optimistic locking functionality by SqlAlchemy
    # https://docs.sqlalchemy.org/en/20/orm/versioning.html
    __mapper_args__ = {"version_id_col": version}

    # relationships
    organization: Mapped[Optional["Organization"]] = relationship("Organization", lazy="raise")
    agents: Mapped[List["Agent"]] = relationship(
        "Agent",
        secondary="blocks_agents",
        lazy="raise",
        passive_deletes=True,  # Ensures SQLAlchemy doesn't fetch blocks_agents rows before deleting
        back_populates="core_memory",
        doc="Agents associated with this block.",
    )
    identities: Mapped[List["Identity"]] = relationship(
        "Identity",
        secondary="identities_blocks",
        lazy="raise",
        back_populates="blocks",
        passive_deletes=True,
    )
    groups: Mapped[List["Group"]] = relationship(
        "Group",
        secondary="groups_blocks",
        lazy="raise",
        back_populates="shared_blocks",
        passive_deletes=True,
    )

    def to_pydantic(self) -> Type:
        match self.label:
            case "human":
                Schema = Human
            case "persona":
                Schema = Persona
            case _:
                Schema = PydanticBlock
        model_dict = {k: v for k, v in self.__dict__.items() if k in self.__pydantic_model__.model_fields}
        model_dict["metadata"] = self.metadata_
        return Schema.model_validate(model_dict)

    @declared_attr
    def current_history_entry(cls) -> Mapped[Optional["BlockHistory"]]:
        # Relationship to easily load the specific history entry that is current
        return relationship(
            "BlockHistory",
            primaryjoin=lambda: cls.current_history_entry_id == BlockHistory.id,
            foreign_keys=[cls.current_history_entry_id],
            lazy="joined",  # Typically want current history details readily available
            post_update=True,
        )  # Helps manage potential FK cycles


@event.listens_for(Block, "before_insert")
@event.listens_for(Block, "before_update")
def validate_value_length(mapper, connection, target):
    """Ensure the value length does not exceed the limit."""
    if target.value and len(target.value) > target.limit:
        raise ValueError(
            f"Value length ({len(target.value)}) exceeds the limit ({target.limit}) for block with label '{target.label}' and id '{target.id}'."
        )
