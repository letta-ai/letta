from datetime import datetime
from typing import Dict, Optional

from pydantic import Field

from letta.schemas.letta_base import OrmMetadataBase


class ArchiveBase(OrmMetadataBase):
    __id_prefix__ = "archive"

    name: str = Field(..., description="The name of the archive")
    description: Optional[str] = Field(None, description="A description of the archive")
    organization_id: str = Field(..., description="The organization this archive belongs to")
    metadata: Optional[Dict] = Field(default_factory=dict, validation_alias="metadata_", description="Additional metadata")


class Archive(ArchiveBase):
    """
    Representation of an archive - a collection of archival passages that can be shared between agents.

    Parameters:
        id (str): The unique identifier of the archive.
        name (str): The name of the archive.
        description (str): A description of the archive.
        organization_id (str): The organization this archive belongs to.
        created_at (datetime): The creation date of the archive.
        metadata (dict): Additional metadata for the archive.
    """

    id: str = ArchiveBase.generate_id_field()
    created_at: datetime = Field(..., description="The creation date of the archive")


class ArchiveCreate(ArchiveBase):
    """Create a new archive"""


class ArchiveUpdate(ArchiveBase):
    """Update an existing archive"""

    name: Optional[str] = Field(None, description="The name of the archive")
    description: Optional[str] = Field(None, description="A description of the archive")
    metadata: Optional[Dict] = Field(None, validation_alias="metadata_", description="Additional metadata")
