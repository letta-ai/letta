from typing import List, Optional

from pydantic import Field

from letta.schemas.letta_base import LettaBase


class FileStats(LettaBase):
    """File statistics for metadata endpoint"""

    file_id: str = Field(..., description="Unique identifier of the file")
    file_name: str = Field(..., description="Name of the file")
    file_size: Optional[int] = Field(None, description="Size of the file in bytes")


class SourceStats(LettaBase):
    """Aggregated metadata for a source"""

    source_id: str = Field(..., description="Unique identifier of the source")
    source_name: str = Field(..., description="Name of the source")
    file_count: int = Field(0, description="Number of files in the source")
    total_size: int = Field(0, description="Total size of all files in bytes")
    files: List[FileStats] = Field(default_factory=list, description="List of file statistics")


class OrganizationSourcesStats(LettaBase):
    """Complete metadata response for organization sources"""

    total_sources: int = Field(0, description="Total number of sources")
    total_files: int = Field(0, description="Total number of files across all sources")
    total_size: int = Field(0, description="Total size of all files in bytes")
    sources: List[SourceStats] = Field(default_factory=list, description="List of source metadata")
