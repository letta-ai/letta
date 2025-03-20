from marshmallow import fields

from letta.helpers.converters import (
    deserialize_embedding_config,
    deserialize_llm_config,
    deserialize_message_content,
    deserialize_tool_calls,
    deserialize_tool_rules,
    serialize_embedding_config,
    serialize_llm_config,
    serialize_message_content,
    serialize_tool_calls,
    serialize_tool_rules,
)


class PydanticField(fields.Field):
    """Generic Marshmallow field for handling Pydantic models."""

    def __init__(self, pydantic_class, **kwargs):
        self.pydantic_class = pydantic_class
        super().__init__(**kwargs)

    def _serialize(self, value, attr, obj, **kwargs):
        return value.model_dump() if value else None

    def _deserialize(self, value, attr, data, **kwargs):
        return self.pydantic_class(**value) if value else None


class LLMConfigField(fields.Field):
    """Marshmallow field for handling LLMConfig serialization."""

    def _serialize(self, value, attr, obj, **kwargs):
        return serialize_llm_config(value)

    def _deserialize(self, value, attr, data, **kwargs):
        return deserialize_llm_config(value)


class EmbeddingConfigField(fields.Field):
    """Marshmallow field for handling EmbeddingConfig serialization."""

    def _serialize(self, value, attr, obj, **kwargs):
        return serialize_embedding_config(value)

    def _deserialize(self, value, attr, data, **kwargs):
        return deserialize_embedding_config(value)


class ToolRulesField(fields.List):
    """Custom Marshmallow field to handle a list of ToolRules."""

    def __init__(self, **kwargs):
        super().__init__(fields.Dict(), **kwargs)

    def _serialize(self, value, attr, obj, **kwargs):
        return serialize_tool_rules(value)

    def _deserialize(self, value, attr, data, **kwargs):
        return deserialize_tool_rules(value)


class ToolCallField(fields.Field):
    """Marshmallow field for handling a list of OpenAI ToolCall objects."""

    def _serialize(self, value, attr, obj, **kwargs):
        return serialize_tool_calls(value)

    def _deserialize(self, value, attr, data, **kwargs):
        return deserialize_tool_calls(value)


class MessageContentField(fields.Field):
    """Marshmallow field for handling a list of Message Content Part objects."""

    def _serialize(self, value, attr, obj, **kwargs):
        return serialize_message_content(value)

    def _deserialize(self, value, attr, data, **kwargs):
        return deserialize_message_content(value)
