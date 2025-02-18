from marshmallow import fields

from letta.orm import Agent
from letta.serialize_schemas.base import BaseSchema
from letta.serialize_schemas.custom_fields import EmbeddingConfigField, LLMConfigField, ToolRulesField
from letta.serialize_schemas.message import SerializedMessageSchema


class SerializedAgentSchema(BaseSchema):
    """
    Marshmallow schema for serializing/deserializing Agent objects.
    Excludes relational fields.
    """

    llm_config = LLMConfigField()
    embedding_config = EmbeddingConfigField()
    tool_rules = ToolRulesField()

    messages = fields.List(fields.Nested(SerializedMessageSchema))

    def __init__(self, *args, session=None, **kwargs):
        super().__init__(*args, **kwargs)
        if session:
            self.session = session

            # propagate session to nested schemas
            for field_name, field_obj in self.fields.items():
                if isinstance(field_obj, fields.List) and hasattr(field_obj.inner, "schema"):
                    field_obj.inner.schema.session = session
                elif hasattr(field_obj, "schema"):
                    field_obj.schema.session = session

    class Meta(BaseSchema.Meta):
        model = Agent
        # TODO: Serialize these as well...
        exclude = ("tools", "sources", "core_memory", "tags", "source_passages", "agent_passages", "organization")
