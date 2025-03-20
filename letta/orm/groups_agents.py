from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from letta.orm.base import Base


class GroupsAgents(Base):
    """Agents may have one or many groups associated with them."""

    __tablename__ = "groups_agents"

    group_id: Mapped[str] = mapped_column(String, ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True)
    agent_id: Mapped[str] = mapped_column(String, ForeignKey("agents.id", ondelete="CASCADE"), primary_key=True)
