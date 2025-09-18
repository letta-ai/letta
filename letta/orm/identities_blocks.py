from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from letta.orm.base import Base


class IdentitiesBlocks(Base):
    """Identities may have one or many blocks associated with them."""

    __tablename__ = "identities_blocks"

    identity_id: Mapped[str] = mapped_column(String, ForeignKey("identities.id", ondelete="CASCADE"), primary_key=True)
    block_id: Mapped[str] = mapped_column(String, ForeignKey("block.id", ondelete="CASCADE"), primary_key=True)
