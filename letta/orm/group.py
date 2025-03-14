import uuid
from typing import List, Optional

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from letta.orm.mixins import OrganizationMixin
from letta.orm.sqlalchemy_base import SqlalchemyBase
from letta.schemas.group import Group as PydanticGroup


class Group(SqlalchemyBase, OrganizationMixin):

    __tablename__ = "groups"
    __pydantic_model__ = PydanticGroup

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"group-{uuid.uuid4()}")
    description: Mapped[str] = mapped_column(nullable=False, doc="")
    manager_type: Mapped[str] = mapped_column(nullable=False, doc="")
    manager_agent_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("agents.id", ondelete="RESTRICT"), nullable=True, doc="")
    termination_token: Mapped[Optional[str]] = mapped_column(nullable=True, doc="")
    max_turns: Mapped[Optional[int]] = mapped_column(nullable=True, doc="")

    # relationships
    organization: Mapped["Organization"] = relationship("Organization", back_populates="groups")
    agents: Mapped[List["Agent"]] = relationship(
        "Agent", secondary="groups_agents", lazy="selectin", passive_deletes=True, back_populates="groups"
    )
    manager_agent: Mapped["Agent"] = relationship("Agent", lazy="joined", back_populates="multi_agent_group")

    @property
    def agent_ids(self) -> List[str]:
        return [agent.id for agent in self.agents]
