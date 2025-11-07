from datetime import datetime
from typing import Dict, Optional

from pydantic import Field

from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import PrimitiveType, VectorDBProvider
from letta.schemas.letta_base import OrmMetadataBase


class ArchiveBase(OrmMetadataBase):
    __id_prefix__ = PrimitiveType.ARCHIVE.value

    name: str = Field(..., description="The name of the archive")
    description: Optional[str] = Field(None, description="A description of the archive")
    organization_id: str = Field(..., description="The organization this archive belongs to")
    vector_db_provider: VectorDBProvider = Field(
        default=VectorDBProvider.NATIVE, description="The vector database provider used for this archive's passages"
    )
    embedding_config: EmbeddingConfig = Field(..., description="Embedding configuration for passages in this archive")
    metadata: Optional[Dict] = Field(default_factory=dict, validation_alias="metadata_", description="Additional metadata")


class Archive(ArchiveBase):
    """Representation of an archive - a collection of archival passages that can be shared between agents."""

    id: str = ArchiveBase.generate_id_field()
    created_at: datetime = Field(..., description="The creation date of the archive")


class ArchiveCreate(ArchiveBase):
    """Create a new archive"""


class ArchiveUpdate(ArchiveBase):
    """Update an existing archive"""

    name: Optional[str] = Field(None, description="The name of the archive")
    description: Optional[str] = Field(None, description="A description of the archive")
    metadata: Optional[Dict] = Field(None, validation_alias="metadata_", description="Additional metadata")
