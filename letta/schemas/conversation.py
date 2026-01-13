from typing import List, Optional

from pydantic import BaseModel, Field

from letta.schemas.letta_base import OrmMetadataBase


class Conversation(OrmMetadataBase):
    """Represents a conversation on an agent for concurrent messaging."""

    __id_prefix__ = "conv"

    id: str = Field(..., description="The unique identifier of the conversation.")
    agent_id: str = Field(..., description="The ID of the agent this conversation belongs to.")
    summary: Optional[str] = Field(None, description="A summary of the conversation.")
    in_context_message_ids: List[str] = Field(default_factory=list, description="The IDs of in-context messages for the conversation.")


class CreateConversation(BaseModel):
    """Request model for creating a new conversation."""

    summary: Optional[str] = Field(None, description="A summary of the conversation.")


class UpdateConversation(BaseModel):
    """Request model for updating a conversation."""

    summary: Optional[str] = Field(None, description="A summary of the conversation.")
