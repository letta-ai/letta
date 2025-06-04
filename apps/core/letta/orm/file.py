import uuid
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.ext.asyncio import AsyncAttrs
from sqlalchemy.orm import Mapped, mapped_column, relationship

from letta.orm.mixins import OrganizationMixin, SourceMixin
from letta.orm.sqlalchemy_base import SqlalchemyBase
from letta.schemas.file import FileMetadata as PydanticFileMetadata

if TYPE_CHECKING:
    from letta.orm.files_agents import FileAgent
    from letta.orm.organization import Organization
    from letta.orm.passage import SourcePassage
    from letta.orm.source import Source


# TODO: Note that this is NOT organization scoped, this is potentially dangerous if we misuse this
# TODO: This should ONLY be manipulated internally in relation to FileMetadata.content
# TODO: Leaving organization_id out of this for now for simplicity
class FileContent(SqlalchemyBase):
    """Holds the full text content of a file (potentially large)."""

    __tablename__ = "file_contents"

    # TODO: We want to migrate all the ORM models to do this, so we will need to move this to the SqlalchemyBase
    # TODO: Some still rely on the Pydantic object to do this
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"file_content-{uuid.uuid4()}")
    file_id: Mapped[str] = mapped_column(
        ForeignKey("files.id", ondelete="CASCADE"), primary_key=True, doc="Foreign key to files table; also serves as primary key."
    )
    text: Mapped[str] = mapped_column(Text, nullable=False, doc="Full plain-text content of the file (e.g., extracted from a PDF).")

    # back-reference to FileMetadata
    file: Mapped["FileMetadata"] = relationship(back_populates="content", lazy="selectin")


class FileMetadata(SqlalchemyBase, OrganizationMixin, SourceMixin, AsyncAttrs):
    """Represents an uploaded file."""

    __tablename__ = "files"
    __pydantic_model__ = PydanticFileMetadata

    file_name: Mapped[Optional[str]] = mapped_column(String, nullable=True, doc="The name of the file.")
    file_path: Mapped[Optional[str]] = mapped_column(String, nullable=True, doc="The file path on the system.")
    file_type: Mapped[Optional[str]] = mapped_column(String, nullable=True, doc="The type of the file.")
    file_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, doc="The size of the file in bytes.")
    file_creation_date: Mapped[Optional[str]] = mapped_column(String, nullable=True, doc="The creation date of the file.")
    file_last_modified_date: Mapped[Optional[str]] = mapped_column(String, nullable=True, doc="The last modified date of the file.")

    # relationships
    organization: Mapped["Organization"] = relationship("Organization", back_populates="files", lazy="selectin")
    source: Mapped["Source"] = relationship("Source", back_populates="files", lazy="selectin")
    source_passages: Mapped[List["SourcePassage"]] = relationship(
        "SourcePassage", back_populates="file", lazy="selectin", cascade="all, delete-orphan"
    )
    file_agents: Mapped[List["FileAgent"]] = relationship(
        "FileAgent",
        back_populates="file",
        lazy="selectin",
        cascade="all, delete-orphan",
        passive_deletes=True,  # ← add this
    )
    content: Mapped[Optional["FileContent"]] = relationship(
        "FileContent",
        uselist=False,
        back_populates="file",
        lazy="raise",  # raises if you access without eager load
        cascade="all, delete-orphan",
    )

    async def to_pydantic_async(self, include_content: bool = False) -> PydanticFileMetadata:
        """
        Async version of `to_pydantic` that supports optional relationship loading
        without requiring `expire_on_commit=False`.
        """

        # Load content relationship if requested
        if include_content:
            content_obj = await self.awaitable_attrs.content
            content_text = content_obj.text if content_obj else None
        else:
            content_text = None

        return PydanticFileMetadata(
            id=self.id,
            organization_id=self.organization_id,
            source_id=self.source_id,
            file_name=self.file_name,
            file_path=self.file_path,
            file_type=self.file_type,
            file_size=self.file_size,
            file_creation_date=self.file_creation_date,
            file_last_modified_date=self.file_last_modified_date,
            created_at=self.created_at,
            updated_at=self.updated_at,
            is_deleted=self.is_deleted,
            content=content_text,
        )
