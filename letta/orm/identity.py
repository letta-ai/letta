import uuid
from typing import List, Optional

from sqlalchemy import String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from letta.orm.mixins import OrganizationMixin
from letta.orm.sqlalchemy_base import SqlalchemyBase
from letta.schemas.identity import Identity as PydanticIdentity


class Identity(SqlalchemyBase, OrganizationMixin):
    """Identity ORM class"""

    __tablename__ = "identities"
    __pydantic_model__ = PydanticIdentity
    __table_args__ = (UniqueConstraint("identifier_key", "project_id", "organization_id", name="unique_identifier_pid_org_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"identity-{uuid.uuid4()}")
    identifier_key: Mapped[str] = mapped_column(nullable=False, doc="External, user-generated identifier key of the identity.")
    name: Mapped[str] = mapped_column(nullable=False, doc="The name of the identity.")
    identity_type: Mapped[str] = mapped_column(nullable=False, doc="The type of the identity.")
    project_id: Mapped[Optional[str]] = mapped_column(nullable=True, doc="The project id of the identity.")

    # relationships
    organization: Mapped["Organization"] = relationship("Organization", back_populates="identities")
    agents: Mapped[List["Agent"]] = relationship("Agent", lazy="selectin", back_populates="identity")

    def to_pydantic(self) -> PydanticIdentity:
        state = {
            "id": self.id,
            "identifier_key": self.identifier_key,
            "name": self.name,
            "identity_type": self.identity_type,
            "project_id": self.project_id,
            "agents": [agent.to_pydantic() for agent in self.agents],
        }

        return self.__pydantic_model__(**state)
