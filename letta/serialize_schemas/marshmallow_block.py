from letta.orm.block import Block
from letta.schemas.block import Block as PydanticBlock
from letta.serialize_schemas.marshmallow_base import BaseSchema


class SerializedBlockSchema(BaseSchema):
    """
    Marshmallow schema for serializing/deserializing Block objects.
    """

    __pydantic_model__ = PydanticBlock

    class Meta(BaseSchema.Meta):
        model = Block
        exclude = BaseSchema.Meta.exclude + ("agents", "identities", "is_deleted")
