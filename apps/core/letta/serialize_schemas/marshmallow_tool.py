from letta.orm import Tool
from letta.schemas.tool import Tool as PydanticTool
from letta.serialize_schemas.marshmallow_base import BaseSchema


class SerializedToolSchema(BaseSchema):
    """
    Marshmallow schema for serializing/deserializing Tool objects.
    """

    __pydantic_model__ = PydanticTool

    class Meta(BaseSchema.Meta):
        model = Tool
        exclude = BaseSchema.Meta.exclude
