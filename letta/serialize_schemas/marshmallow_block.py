from typing import Dict

from marshmallow import post_dump, pre_load

from letta.orm.block import Block
from letta.schemas.block import Block as PydanticBlock
from letta.serialize_schemas.marshmallow_base import BaseSchema


class SerializedBlockSchema(BaseSchema):
    """
    Marshmallow schema for serializing/deserializing Block objects.
    """

    __pydantic_model__ = PydanticBlock

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
        model = Block
        exclude = BaseSchema.Meta.exclude + ("agents", "identities", "is_deleted", "groups", "organization")
