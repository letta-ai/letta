from datetime import datetime
from typing import Optional

from pydantic import Field

from letta.helpers.tpuf_client import should_use_tpuf
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import PrimitiveType, VectorDBProvider
from letta.schemas.letta_base import LettaBase


class BaseSource(LettaBase):
    """
    Shared attributes across all source schemas.
    """

    __id_prefix__ = PrimitiveType.SOURCE.value

    # Core source fields
    name: str = Field(..., description="The name of the source.")
    description: Optional[str] = Field(None, description="The description of the source.")
    instructions: Optional[str] = Field(None, description="Instructions for how to use the source.")
    metadata: Optional[dict] = Field(None, description="Metadata associated with the source.")


class Source(BaseSource):
    """(Deprecated: Use Folder) Representation of a source, which is a collection of files and passages."""

    id: str = BaseSource.generate_id_field()
    embedding_config: EmbeddingConfig = Field(..., description="The embedding configuration used by the source.")
    organization_id: Optional[str] = Field(None, description="The ID of the organization that created the source.")
    metadata: Optional[dict] = Field(None, validation_alias="metadata_", description="Metadata associated with the source.")

    # metadata fields
    vector_db_provider: VectorDBProvider = Field(
        default=VectorDBProvider.NATIVE,
        description="The vector database provider used for this source's passages",
    )
    created_by_id: Optional[str] = Field(None, description="The id of the user that made this Tool.")
    last_updated_by_id: Optional[str] = Field(None, description="The id of the user that made this Tool.")
    created_at: Optional[datetime] = Field(None, description="The timestamp when the source was created.")
    updated_at: Optional[datetime] = Field(None, description="The timestamp when the source was last updated.")


class SourceCreate(BaseSource):
    """
    Schema for creating a new Source.
    """

    # TODO: @matt, make this required after shub makes the FE changes
    embedding: Optional[str] = Field(None, description="The handle for the embedding config used by the source.")
    embedding_chunk_size: Optional[int] = Field(None, description="The chunk size of the embedding.")

    # TODO: remove (legacy config)
    embedding_config: Optional[EmbeddingConfig] = Field(None, description="(Legacy) The embedding configuration used by the source.")


class SourceUpdate(BaseSource):
    """
    Schema for updating an existing Source.
    """

    # Override base fields to make them optional for updates
    name: Optional[str] = Field(None, description="The name of the source.")
    description: Optional[str] = Field(None, description="The description of the source.")
    instructions: Optional[str] = Field(None, description="Instructions for how to use the source.")
    metadata: Optional[dict] = Field(None, description="Metadata associated with the source.")

    # Additional update-specific fields
    embedding_config: Optional[EmbeddingConfig] = Field(None, description="The embedding configuration used by the source.")
