from typing import Dict

from marshmallow import post_dump

from letta.orm.message import Message
from letta.schemas.message import Message as PydanticMessage
from letta.serialize_schemas.base import BaseSchema
from letta.serialize_schemas.custom_fields import ToolCallField


class SerializedMessageSchema(BaseSchema):
    """
    Marshmallow schema for serializing/deserializing Message objects.
    """

    __pydantic_model__ = PydanticMessage

    tool_calls = ToolCallField()

    @post_dump
    def sanitize_ids(self, data: Dict, **kwargs):
        # We don't want to remap here
        # Because of the way that message_ids is just a JSON field on agents
        # We need to wait for the agent dumps, and then keep track of all the message IDs we remapped
        return data

    class Meta(BaseSchema.Meta):
        model = Message
        exclude = BaseSchema.Meta.exclude + ("step", "job_message", "agent")
