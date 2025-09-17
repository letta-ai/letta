from typing import Dict

from marshmallow import post_dump, pre_load

from letta.orm import Tool
from letta.schemas.tool import Tool as PydanticTool
from letta.serialize_schemas.marshmallow_base import BaseSchema


class SerializedToolSchema(BaseSchema):
    """
    Marshmallow schema for serializing/deserializing Tool objects.
    """

    __pydantic_model__ = PydanticTool

    @post_dump
    def sanitize_ids(self, data: Dict, **kwargs) -> Dict:
        # delete id
        del data["id"]
        del data["_created_by_id"]
        del data["_last_updated_by_id"]

        return data

    @pre_load
    def regenerate_ids(self, data: Dict, **kwargs) -> Dict:
        if self.Meta.model:
            data["id"] = self.generate_id()
            data["_created_by_id"] = self.actor.id
            data["_last_updated_by_id"] = self.actor.id

        return data

    class Meta(BaseSchema.Meta):
        model = Tool
        exclude = BaseSchema.Meta.exclude + ("is_deleted", "organization")
