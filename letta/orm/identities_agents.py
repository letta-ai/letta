from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from letta.orm.base import Base


class IdentitiesAgents(Base):
    """Identities may have one or many agents associated with them."""

    __tablename__ = "identities_agents"
    __table_args__ = (Index("ix_identities_agents_agent_id", "agent_id"),)

    identity_id: Mapped[str] = mapped_column(String, ForeignKey("identities.id", ondelete="CASCADE"), primary_key=True)
    agent_id: Mapped[str] = mapped_column(String, ForeignKey("agents.id", ondelete="CASCADE"), primary_key=True)
