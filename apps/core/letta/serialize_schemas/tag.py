from marshmallow import fields

from letta.orm.agents_tags import AgentsTags
from letta.serialize_schemas.base import BaseSchema


class SerializedAgentTagSchema(BaseSchema):
    """
    Marshmallow schema for serializing/deserializing Agent Tags.
    """

    __pydantic_model__ = None

    tag = fields.String(required=True)

    class Meta(BaseSchema.Meta):
        model = AgentsTags
        exclude = BaseSchema.Meta.exclude + ("agent",)
