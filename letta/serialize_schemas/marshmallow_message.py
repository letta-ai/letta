from typing import Dict

from marshmallow import post_dump, pre_load

from letta.orm.message import Message
from letta.schemas.message import Message as PydanticMessage
from letta.serialize_schemas.marshmallow_base import BaseSchema
from letta.serialize_schemas.marshmallow_custom_fields import ToolCallField


class SerializedMessageSchema(BaseSchema):
    """
    Marshmallow schema for serializing/deserializing Message objects.
    """

    __pydantic_model__ = PydanticMessage

    tool_calls = ToolCallField()

    @post_dump
    def sanitize_ids(self, data: Dict, **kwargs) -> Dict:
        # keep id for remapping later on agent dump
        # agent dump will then get rid of message ids
        del data["_created_by_id"]
        del data["_last_updated_by_id"]
        del data["organization"]

        return data

    @pre_load
    def regenerate_ids(self, data: Dict, **kwargs) -> Dict:
        if self.Meta.model:
            # Skip regenerating ID, as agent dump will do it
            data["_created_by_id"] = self.actor.id
            data["_last_updated_by_id"] = self.actor.id
            data["organization"] = self.actor.organization_id

        return data

    class Meta(BaseSchema.Meta):
        model = Message
        exclude = BaseSchema.Meta.exclude + ("step", "job_message", "agent", "otid", "is_deleted")
