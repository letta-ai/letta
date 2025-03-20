from typing import Dict

from marshmallow import fields, post_dump, pre_load

from letta.orm.agents_tags import AgentsTags
from letta.serialize_schemas.marshmallow_base import BaseSchema


class SerializedAgentTagSchema(BaseSchema):
    """
    Marshmallow schema for serializing/deserializing Agent Tags.
    """

    __pydantic_model__ = None

    tag = fields.String(required=True)

    @post_dump
    def sanitize_ids(self, data: Dict, **kwargs):
        return data

    @pre_load
    def regenerate_ids(self, data: Dict, **kwargs) -> Dict:
        return data

    class Meta(BaseSchema.Meta):
        model = AgentsTags
        exclude = BaseSchema.Meta.exclude + ("agent",)
