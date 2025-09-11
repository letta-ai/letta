from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from letta.orm.base import Base


class IdentitiesAgents(Base):
    """Identities may have one or many agents associated with them."""

    __tablename__ = "identities_agents"

    identity_id: Mapped[str] = mapped_column(String, ForeignKey("identities.id", ondelete="CASCADE"), primary_key=True)
    agent_id: Mapped[str] = mapped_column(String, ForeignKey("agents.id", ondelete="CASCADE"), primary_key=True)
