import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import ForeignKey, Index, Integer, String, Text, UniqueConstraint, desc
from sqlalchemy.ext.asyncio import AsyncAttrs
from sqlalchemy.orm import Mapped, mapped_column, relationship

from letta.orm.mixins import OrganizationMixin, SourceMixin
from letta.orm.sqlalchemy_base import SqlalchemyBase
from letta.schemas.enums import FileProcessingStatus
from letta.schemas.file import FileMetadata as PydanticFileMetadata

if TYPE_CHECKING:
    pass


# TODO: Note that this is NOT organization scoped, this is potentially dangerous if we misuse this
# TODO: This should ONLY be manipulated internally in relation to FileMetadata.content
# TODO: Leaving organization_id out of this for now for simplicity
class FileContent(SqlalchemyBase):
    """Holds the full text content of a file (potentially large)."""

    __tablename__ = "file_contents"
    __table_args__ = (UniqueConstraint("file_id", name="uq_file_contents_file_id"),)

    # TODO: We want to migrate all the ORM models to do this, so we will need to move this to the SqlalchemyBase
    # TODO: Some still rely on the Pydantic object to do this
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"file_content-{uuid.uuid4()}")
    file_id: Mapped[str] = mapped_column(ForeignKey("files.id", ondelete="CASCADE"), nullable=False, doc="Foreign key to files table.")

    text: Mapped[str] = mapped_column(Text, nullable=False, doc="Full plain-text content of the file (e.g., extracted from a PDF).")

    # back-reference to FileMetadata
    file: Mapped["FileMetadata"] = relationship(back_populates="content", lazy="selectin")


class FileMetadata(SqlalchemyBase, OrganizationMixin, SourceMixin, AsyncAttrs):
    """Represents an uploaded file."""

    __tablename__ = "files"
    __pydantic_model__ = PydanticFileMetadata
    __table_args__ = (
        Index("ix_files_org_created", "organization_id", desc("created_at")),
        Index("ix_files_source_created", "source_id", desc("created_at")),
        Index("ix_files_processing_status", "processing_status"),
    )

    file_name: Mapped[Optional[str]] = mapped_column(String, nullable=True, doc="The name of the file.")
    original_file_name: Mapped[Optional[str]] = mapped_column(String, nullable=True, doc="The original name of the file as uploaded.")
    file_path: Mapped[Optional[str]] = mapped_column(String, nullable=True, doc="The file path on the system.")
    file_type: Mapped[Optional[str]] = mapped_column(String, nullable=True, doc="The type of the file.")
    file_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, doc="The size of the file in bytes.")
    file_creation_date: Mapped[Optional[str]] = mapped_column(String, nullable=True, doc="The creation date of the file.")
    file_last_modified_date: Mapped[Optional[str]] = mapped_column(String, nullable=True, doc="The last modified date of the file.")
    processing_status: Mapped[FileProcessingStatus] = mapped_column(
        String, default=FileProcessingStatus.PENDING, nullable=False, doc="The current processing status of the file."
    )

    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True, doc="Any error message encountered during processing.")
    total_chunks: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, doc="Total number of chunks for the file.")
    chunks_embedded: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, doc="Number of chunks that have been embedded.")

    # relationships
    content: Mapped[Optional["FileContent"]] = relationship(
        "FileContent",
        uselist=False,
        back_populates="file",
        lazy="raise",  # raises if you access without eager load
        cascade="all, delete-orphan",
    )

    async def to_pydantic_async(self, include_content: bool = False, strip_directory_prefix: bool = False) -> PydanticFileMetadata:
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

        file_name = self.file_name
        if strip_directory_prefix and "/" in file_name:
            file_name = "/".join(file_name.split("/")[1:])

        return PydanticFileMetadata(
            id=self.id,
            organization_id=self.organization_id,
            source_id=self.source_id,
            file_name=file_name,
            original_file_name=self.original_file_name,
            file_path=self.file_path,
            file_type=self.file_type,
            file_size=self.file_size,
            file_creation_date=self.file_creation_date,
            file_last_modified_date=self.file_last_modified_date,
            processing_status=self.processing_status,
            error_message=self.error_message,
            total_chunks=self.total_chunks,
            chunks_embedded=self.chunks_embedded,
            created_at=self.created_at,
            updated_at=self.updated_at,
            content=content_text,
        )
