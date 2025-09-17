import uuid
from typing import Optional

from letta.orm.sandbox_config import AgentEnvironmentVariable
from letta.serialize_schemas.marshmallow_base import BaseSchema


class SerializedAgentEnvironmentVariableSchema(BaseSchema):
    """
    Marshmallow schema for serializing/deserializing AgentEnvironmentVariable objects.
    """

    __pydantic_model__ = None

    def generate_id(self) -> Optional[str]:
        # TODO: This is brittle and duplicated in orm/sandbox_config.py
        return f"agent-env-{uuid.uuid4()}"

    class Meta(BaseSchema.Meta):
        model = AgentEnvironmentVariable
        exclude = BaseSchema.Meta.exclude + ("agent",)
