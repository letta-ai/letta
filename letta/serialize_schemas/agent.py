from typing import Dict

from marshmallow import fields, post_dump

from letta.orm import Agent
from letta.schemas.agent import AgentState as PydanticAgentState
from letta.schemas.user import User
from letta.serialize_schemas.agent_environment_variable import SerializedAgentEnvironmentVariableSchema
from letta.serialize_schemas.base import BaseSchema
from letta.serialize_schemas.block import SerializedBlockSchema
from letta.serialize_schemas.custom_fields import EmbeddingConfigField, LLMConfigField, ToolRulesField
from letta.serialize_schemas.message import SerializedMessageSchema
from letta.serialize_schemas.tag import SerializedAgentTagSchema
from letta.serialize_schemas.tool import SerializedToolSchema
from letta.server.db import SessionLocal


class SerializedAgentSchema(BaseSchema):
    """
    Marshmallow schema for serializing/deserializing Agent objects.
    Excludes relational fields.
    """

    __pydantic_model__ = PydanticAgentState

    llm_config = LLMConfigField()
    embedding_config = EmbeddingConfigField()
    tool_rules = ToolRulesField()

    messages = fields.List(fields.Nested(SerializedMessageSchema))
    core_memory = fields.List(fields.Nested(SerializedBlockSchema))
    tools = fields.List(fields.Nested(SerializedToolSchema))
    tool_exec_environment_variables = fields.List(fields.Nested(SerializedAgentEnvironmentVariableSchema))
    tags = fields.List(fields.Nested(SerializedAgentTagSchema))

    def __init__(self, *args, session: SessionLocal, actor: User, **kwargs):
        super().__init__(*args, actor=actor, **kwargs)
        self.session = session

        # Propagate session and actor to nested schemas automatically
        for field in self.fields.values():
            if isinstance(field, fields.List) and isinstance(field.inner, fields.Nested):
                field.inner.schema.session = session
                field.inner.schema.actor = actor
            elif isinstance(field, fields.Nested):
                field.schema.session = session
                field.schema.actor = actor

    @post_dump
    def sanitize_ids(self, data: Dict, **kwargs):
        data = super().sanitize_ids(data, **kwargs)

        # Remap IDs of messages
        # Need to do this in post, so we can correctly map the in-context message IDs
        # TODO: Remap message_ids to reference objects, not just be a list
        id_remapping = dict()
        for message in data.get("messages"):
            message_id = message.get("id")
            if message_id not in id_remapping:
                id_remapping[message_id] = SerializedMessageSchema.__pydantic_model__.generate_id()
                message["id"] = id_remapping[message_id]
            else:
                raise ValueError(f"Duplicate message IDs in agent.messages: {message_id}")

        # Remap in context message ids
        data["message_ids"] = [id_remapping[message_id] for message_id in data.get("message_ids")]

        return data

    class Meta(BaseSchema.Meta):
        model = Agent
        # TODO: Serialize these as well...
        exclude = BaseSchema.Meta.exclude + ("sources", "source_passages", "agent_passages")
