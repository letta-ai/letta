from datetime import datetime
from typing import Optional

from pydantic import Field

from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.letta_base import LettaBase


class BaseFolder(LettaBase):
    """
    Shared attributes across all folder schemas.
    """

    __id_prefix__ = "source"  # TODO: change to "folder"

    # Core folder fields
    name: str = Field(..., description="The name of the folder.")
    description: Optional[str] = Field(None, description="The description of the folder.")
    instructions: Optional[str] = Field(None, description="Instructions for how to use the folder.")
    metadata: Optional[dict] = Field(None, description="Metadata associated with the folder.")


class Folder(BaseFolder):
    """
    Representation of a folder, which is a collection of files and passages.

    Parameters:
        id (str): The ID of the folder
        name (str): The name of the folder.
        embedding_config (EmbeddingConfig): The embedding configuration used by the folder.
        user_id (str): The ID of the user that created the folder.
        metadata (dict): Metadata associated with the folder.
        description (str): The description of the folder.
    """

    id: str = BaseFolder.generate_id_field()
    embedding_config: EmbeddingConfig = Field(..., description="The embedding configuration used by the folder.")
    organization_id: Optional[str] = Field(None, description="The ID of the organization that created the folder.")
    metadata: Optional[dict] = Field(None, validation_alias="metadata_", description="Metadata associated with the folder.")

    # metadata fields
    created_by_id: Optional[str] = Field(None, description="The id of the user that made this Tool.")
    last_updated_by_id: Optional[str] = Field(None, description="The id of the user that made this Tool.")
    created_at: Optional[datetime] = Field(None, description="The timestamp when the folder was created.")
    updated_at: Optional[datetime] = Field(None, description="The timestamp when the folder was last updated.")


class FolderCreate(BaseFolder):
    """
    Schema for creating a new Folder.
    """

    # TODO: @matt, make this required after shub makes the FE changes
    embedding: Optional[str] = Field(None, description="The handle for the embedding config used by the folder.")
    embedding_chunk_size: Optional[int] = Field(None, description="The chunk size of the embedding.")

    # TODO: remove (legacy config)
    embedding_config: Optional[EmbeddingConfig] = Field(None, description="(Legacy) The embedding configuration used by the folder.")


class FolderUpdate(BaseFolder):
    """
    Schema for updating an existing Folder.
    """

    # Override base fields to make them optional for updates
    name: Optional[str] = Field(None, description="The name of the folder.")
    description: Optional[str] = Field(None, description="The description of the folder.")
    instructions: Optional[str] = Field(None, description="Instructions for how to use the folder.")
    metadata: Optional[dict] = Field(None, description="Metadata associated with the folder.")

    # Additional update-specific fields
    embedding_config: Optional[EmbeddingConfig] = Field(None, description="The embedding configuration used by the folder.")
