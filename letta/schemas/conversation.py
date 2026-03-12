from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

from letta.errors import LettaInvalidArgumentError
from letta.schemas.letta_base import OrmMetadataBase
from letta.schemas.model import ModelSettingsUnion


class Conversation(OrmMetadataBase):
    """Represents a conversation on an agent for concurrent messaging."""

    __id_prefix__ = "conv"

    id: str = Field(..., description="The unique identifier of the conversation.")
    agent_id: str = Field(..., description="The ID of the agent this conversation belongs to.")
    summary: Optional[str] = Field(None, description="A summary of the conversation.")
    in_context_message_ids: List[str] = Field(default_factory=list, description="The IDs of in-context messages for the conversation.")
    isolated_block_ids: List[str] = Field(
        default_factory=list,
        description="IDs of blocks that are isolated (specific to this conversation, overriding agent defaults).",
    )
    model: Optional[str] = Field(
        None,
        description="The model handle for this conversation (overrides agent's model). Format: provider/model-name.",
    )
    model_settings: Optional[ModelSettingsUnion] = Field(
        None,
        description="The model settings for this conversation (overrides agent's model settings).",
    )


class CreateConversation(BaseModel):
    """Request model for creating a new conversation."""

    summary: Optional[str] = Field(None, description="A summary of the conversation.")
    isolated_block_labels: Optional[List[str]] = Field(
        None,
        description="List of block labels that should be isolated (conversation-specific) rather than shared across conversations. "
        "New blocks will be created as copies of the agent's blocks with these labels.",
    )
    model: Optional[str] = Field(
        None,
        description="The model handle for this conversation (overrides agent's model). Format: provider/model-name.",
    )
    model_settings: Optional[ModelSettingsUnion] = Field(
        None,
        description="The model settings for this conversation (overrides agent's model settings).",
    )

    @field_validator("model")
    @classmethod
    def validate_model(cls, model: Optional[str]) -> Optional[str]:
        if not model:
            return model
        if "/" not in model:
            raise LettaInvalidArgumentError("The model handle should be in the format provider/model-name", argument_name="model")
        provider_name, model_name = model.split("/", 1)
        if not provider_name or not model_name:
            raise LettaInvalidArgumentError("The model handle should be in the format provider/model-name", argument_name="model")
        return model


class UpdateConversation(BaseModel):
    """Request model for updating a conversation."""

    summary: Optional[str] = Field(None, description="A summary of the conversation.")
    model: Optional[str] = Field(
        None,
        description="The model handle for this conversation (overrides agent's model). Format: provider/model-name.",
    )
    model_settings: Optional[ModelSettingsUnion] = Field(
        None,
        description="The model settings for this conversation (overrides agent's model settings).",
    )

    @field_validator("model")
    @classmethod
    def validate_model(cls, model: Optional[str]) -> Optional[str]:
        if not model:
            return model
        if "/" not in model:
            raise LettaInvalidArgumentError("The model handle should be in the format provider/model-name", argument_name="model")
        provider_name, model_name = model.split("/", 1)
        if not provider_name or not model_name:
            raise LettaInvalidArgumentError("The model handle should be in the format provider/model-name", argument_name="model")
        return model
