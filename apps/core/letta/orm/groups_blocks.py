from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from letta.orm.base import Base


class GroupsBlocks(Base):
    """Groups may have one or many shared blocks associated with them."""

    __tablename__ = "groups_blocks"

    group_id: Mapped[str] = mapped_column(String, ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True)
    block_id: Mapped[str] = mapped_column(String, ForeignKey("block.id", ondelete="CASCADE"), primary_key=True)
