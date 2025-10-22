from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import Field

from letta.schemas.enums import FileProcessingStatus, PrimitiveType
from letta.schemas.letta_base import LettaBase


class FileStatus(str, Enum):
    """
    Enum to represent the state of a file.
    """

    open = "open"
    closed = "closed"


class FileMetadataBase(LettaBase):
    """Base class for FileMetadata schemas"""

    __id_prefix__ = PrimitiveType.FILE.value

    # Core file metadata fields
    source_id: str = Field(..., description="The unique identifier of the source associated with the document.")
    file_name: Optional[str] = Field(None, description="The name of the file.")
    original_file_name: Optional[str] = Field(None, description="The original name of the file as uploaded.")
    file_path: Optional[str] = Field(None, description="The path to the file.")
    file_type: Optional[str] = Field(None, description="The type of the file (MIME type).")
    file_size: Optional[int] = Field(None, description="The size of the file in bytes.")
    file_creation_date: Optional[str] = Field(None, description="The creation date of the file.")
    file_last_modified_date: Optional[str] = Field(None, description="The last modified date of the file.")
    processing_status: FileProcessingStatus = Field(
        default=FileProcessingStatus.PENDING,
        description="The current processing status of the file (e.g. pending, parsing, embedding, completed, error).",
    )
    error_message: Optional[str] = Field(default=None, description="Optional error message if the file failed processing.")
    total_chunks: Optional[int] = Field(default=None, description="Total number of chunks for the file.")
    chunks_embedded: Optional[int] = Field(default=None, description="Number of chunks that have been embedded.")
    content: Optional[str] = Field(
        default=None, description="Optional full-text content of the file; only populated on demand due to its size."
    )

    def is_processing_terminal(self) -> bool:
        """Check if the file processing status is in a terminal state (completed or error)."""
        return self.processing_status in (FileProcessingStatus.COMPLETED, FileProcessingStatus.ERROR)


class FileMetadata(FileMetadataBase):
    """Representation of a single FileMetadata"""

    id: str = FileMetadataBase.generate_id_field()
    organization_id: Optional[str] = Field(None, description="The unique identifier of the organization associated with the document.")

    # orm metadata, optional fields
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow, description="The creation date of the file.")
    updated_at: Optional[datetime] = Field(default_factory=datetime.utcnow, description="The update date of the file.")


class FileAgentBase(LettaBase):
    """Base class for the FileMetadata-⇄-Agent association schemas"""

    __id_prefix__ = PrimitiveType.FILE.value

    # Core file-agent association fields
    agent_id: str = Field(..., description="Unique identifier of the agent.")
    file_id: str = Field(..., description="Unique identifier of the file.")
    source_id: str = Field(..., description="Unique identifier of the source.")
    file_name: str = Field(..., description="Name of the file.")
    is_open: bool = Field(True, description="True if the agent currently has the file open.")
    visible_content: Optional[str] = Field(
        None,
        description="Portion of the file the agent is focused on (may be large).",
    )
    last_accessed_at: Optional[datetime] = Field(
        default_factory=datetime.utcnow,
        description="UTC timestamp of the agent's most recent access to this file.",
    )
    start_line: Optional[int] = Field(None, description="Starting line number (1-indexed) when file was opened with line range.")
    end_line: Optional[int] = Field(None, description="Ending line number (exclusive) when file was opened with line range.")


class FileAgent(FileAgentBase):
    """
    A single FileMetadata ⇄ Agent association row.

    Captures:
    • whether the agent currently has the file “open”
    • the excerpt (grepped section) in the context window
    • the last time the agent accessed the file
    """

    id: str = Field(
        ...,
        description="The internal ID",
    )
    organization_id: Optional[str] = Field(
        None,
        description="Org ID this association belongs to (inherited from both agent and file).",
    )

    created_at: Optional[datetime] = Field(
        default_factory=datetime.utcnow,
        description="Row creation timestamp (UTC).",
    )
    updated_at: Optional[datetime] = Field(
        default_factory=datetime.utcnow,
        description="Row last-update timestamp (UTC).",
    )


class AgentFileAttachment(LettaBase):
    """Response model for agent file attachments showing file status in agent context"""

    id: str = Field(..., description="Unique identifier of the file-agent relationship")
    file_id: str = Field(..., description="Unique identifier of the file")
    file_name: str = Field(..., description="Name of the file")
    folder_id: str = Field(..., description="Unique identifier of the folder/source")
    folder_name: str = Field(..., description="Name of the folder/source")
    is_open: bool = Field(..., description="Whether the file is currently open in the agent's context")
    last_accessed_at: Optional[datetime] = Field(None, description="Timestamp of last access by the agent")
    visible_content: Optional[str] = Field(None, description="Portion of the file visible to the agent if open")
    start_line: Optional[int] = Field(None, description="Starting line number if file was opened with line range")
    end_line: Optional[int] = Field(None, description="Ending line number if file was opened with line range")


class PaginatedAgentFiles(LettaBase):
    """Paginated response for agent files"""

    files: List[AgentFileAttachment] = Field(..., description="List of file attachments for the agent")
    next_cursor: Optional[str] = Field(None, description="Cursor for fetching the next page (file-agent relationship ID)")
    has_more: bool = Field(..., description="Whether more results exist after this page")
