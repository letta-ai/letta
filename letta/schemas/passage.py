from datetime import datetime
from typing import Dict, List, Optional

from pydantic import Field, field_validator

from letta import settings
from letta.constants import MAX_EMBEDDING_DIM
from letta.helpers.datetime_helpers import get_utc_time
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import PrimitiveType
from letta.schemas.letta_base import OrmMetadataBase


class PassageBase(OrmMetadataBase):
    __id_prefix__ = PrimitiveType.PASSAGE.value

    is_deleted: bool = Field(False, description="Whether this passage is deleted or not.")

    # associated user/agent
    organization_id: Optional[str] = Field(None, description="The unique identifier of the user associated with the passage.")
    archive_id: Optional[str] = Field(None, description="The unique identifier of the archive containing this passage.")

    # origin data source
    source_id: Optional[str] = Field(None, description="The data source of the passage.")

    # file association
    file_id: Optional[str] = Field(None, description="The unique identifier of the file associated with the passage.")
    file_name: Optional[str] = Field(None, description="The name of the file (only for source passages).")
    metadata: Optional[Dict] = Field({}, validation_alias="metadata_", description="The metadata of the passage.")
    tags: Optional[List[str]] = Field(None, description="Tags associated with this passage.")


class Passage(PassageBase):
    """Representation of a passage, which is stored in archival memory."""

    id: str = PassageBase.generate_id_field()

    # passage text
    text: str = Field(..., description="The text of the passage.")

    # embeddings
    embedding: Optional[List[float]] = Field(..., description="The embedding of the passage.")
    embedding_config: Optional[EmbeddingConfig] = Field(..., description="The embedding configuration used by the passage.")

    created_at: datetime = Field(default_factory=get_utc_time, description="The creation date of the passage.")

    @field_validator("embedding", mode="before")
    @classmethod
    def pad_embeddings(cls, embedding: List[float], info) -> List[float]:
        """Pad embeddings to `MAX_EMBEDDING_SIZE`. This is necessary to ensure all stored embeddings are the same size."""
        if embedding is None:
            return embedding

        # Check if this is an archival memory passage (has archive_id) or file passage (has file_id)
        data = info.data if hasattr(info, "data") else {}
        is_archival = data.get("archive_id") is not None
        is_file = data.get("file_id") is not None

        # Pad if using pgvector
        if settings.letta_pg_uri_no_default:
            # For archival memory: always pad
            # For file passages: only pad if NOT using turbopuffer
            from letta.helpers.tpuf_client import should_use_tpuf

            should_pad = is_archival or (is_file and not should_use_tpuf())

            if should_pad:
                import numpy as np

                np_embedding = np.array(embedding)
                if np_embedding.shape[0] != MAX_EMBEDDING_DIM:
                    padded_embedding = np.pad(np_embedding, (0, MAX_EMBEDDING_DIM - np_embedding.shape[0]), mode="constant")
                    return padded_embedding.tolist()

        return embedding


class PassageCreate(PassageBase):
    text: str = Field(..., description="The text of the passage.")

    # optionally provide embeddings
    embedding: Optional[List[float]] = Field(None, description="The embedding of the passage.")
    embedding_config: Optional[EmbeddingConfig] = Field(None, description="The embedding configuration used by the passage.")


class PassageUpdate(PassageCreate):
    id: str = Field(..., description="The unique identifier of the passage.")
    text: Optional[str] = Field(None, description="The text of the passage.")

    # optionally provide embeddings
    embedding: Optional[List[float]] = Field(None, description="The embedding of the passage.")
    embedding_config: Optional[EmbeddingConfig] = Field(None, description="The embedding configuration used by the passage.")
