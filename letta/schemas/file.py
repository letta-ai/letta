from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import Field

from letta.schemas.enums import FileProcessingStatus
from letta.schemas.letta_base import LettaBase


class FileStatus(str, Enum):
    """
    Enum to represent the state of a file.
    """

    open = "open"
    closed = "closed"


class FileMetadataBase(LettaBase):
    """Base class for FileMetadata schemas"""

    __id_prefix__ = "file"


class FileMetadata(FileMetadataBase):
    """Representation of a single FileMetadata"""

    id: str = FileMetadataBase.generate_id_field()
    organization_id: Optional[str] = Field(None, description="The unique identifier of the organization associated with the document.")
    source_id: str = Field(..., description="The unique identifier of the source associated with the document.")
    file_name: Optional[str] = Field(None, description="The name of the file.")
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

    # orm metadata, optional fields
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow, description="The creation date of the file.")
    updated_at: Optional[datetime] = Field(default_factory=datetime.utcnow, description="The update date of the file.")
    is_deleted: bool = Field(False, description="Whether this file is deleted or not.")

    # This is optional, and only occasionally pulled in since it can be very large
    content: Optional[str] = Field(
        default=None, description="Optional full-text content of the file; only populated on demand due to its size."
    )


class FileAgentBase(LettaBase):
    """Base class for the FileMetadata-⇄-Agent association schemas"""

    __id_prefix__ = "file_agent"


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
    agent_id: str = Field(..., description="Unique identifier of the agent.")
    file_id: str = Field(..., description="Unique identifier of the file.")
    file_name: str = Field(..., description="Name of the file.")
    is_open: bool = Field(True, description="True if the agent currently has the file open.")
    visible_content: Optional[str] = Field(
        None,
        description="Portion of the file the agent is focused on (may be large).",
    )
    last_accessed_at: Optional[datetime] = Field(
        default_factory=datetime.utcnow,
        description="UTC timestamp of the agent’s most recent access to this file.",
    )

    created_at: Optional[datetime] = Field(
        default_factory=datetime.utcnow,
        description="Row creation timestamp (UTC).",
    )
    updated_at: Optional[datetime] = Field(
        default_factory=datetime.utcnow,
        description="Row last-update timestamp (UTC).",
    )
    is_deleted: bool = Field(False, description="Soft-delete flag.")
