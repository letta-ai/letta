from letta.orm.message import Message
from letta.serialize_schemas.base import BaseSchema
from letta.serialize_schemas.custom_fields import ToolCallField


class SerializedMessageSchema(BaseSchema):
    """
    Marshmallow schema for serializing/deserializing Message objects.
    """

    tool_calls = ToolCallField()

    class Meta(BaseSchema.Meta):
        model = Message
        exclude = ("step", "job_message")
