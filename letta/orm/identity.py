import uuid
from typing import List, Optional

from sqlalchemy import String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from letta.orm.mixins import OrganizationMixin
from letta.orm.sqlalchemy_base import SqlalchemyBase
from letta.schemas.identity import Identity as PydanticIdentity
from letta.schemas.identity import IdentityProperty


class Identity(SqlalchemyBase, OrganizationMixin):
    """Identity ORM class"""

    __tablename__ = "identities"
    __pydantic_model__ = PydanticIdentity
    __table_args__ = (
        UniqueConstraint(
            "identifier_key",
            "project_id",
            "organization_id",
            name="unique_identifier_key_project_id_organization_id",
            postgresql_nulls_not_distinct=True,
        ),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"identity-{uuid.uuid4()}")
    identifier_key: Mapped[str] = mapped_column(nullable=False, doc="External, user-generated identifier key of the identity.")
    name: Mapped[str] = mapped_column(nullable=False, doc="The name of the identity.")
    identity_type: Mapped[str] = mapped_column(nullable=False, doc="The type of the identity.")
    project_id: Mapped[Optional[str]] = mapped_column(nullable=True, doc="The project id of the identity.")
    properties: Mapped[List["IdentityProperty"]] = mapped_column(
        JSON, nullable=False, default=list, doc="List of properties associated with the identity"
    )

    # relationships
    organization: Mapped["Organization"] = relationship("Organization", back_populates="identities")
    agents: Mapped[List["Agent"]] = relationship(
        "Agent", secondary="identities_agents", lazy="selectin", passive_deletes=True, back_populates="identities"
    )
    blocks: Mapped[List["Block"]] = relationship(
        "Block", secondary="identities_blocks", lazy="selectin", passive_deletes=True, back_populates="identities"
    )

    @property
    def agent_ids(self) -> List[str]:
        """Get just the agent IDs without loading the full agent objects"""
        return [agent.id for agent in self.agents]

    @property
    def block_ids(self) -> List[str]:
        """Get just the block IDs without loading the full agent objects"""
        return [block.id for block in self.blocks]

    def to_pydantic(self) -> PydanticIdentity:
        state = {
            "id": self.id,
            "identifier_key": self.identifier_key,
            "name": self.name,
            "identity_type": self.identity_type,
            "project_id": self.project_id,
            "agent_ids": self.agent_ids,
            "block_ids": self.block_ids,
            "organization_id": self.organization_id,
            "properties": self.properties,
        }
        return PydanticIdentity(**state)
