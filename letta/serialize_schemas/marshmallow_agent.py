from typing import Dict, Optional

from marshmallow import fields, post_dump, pre_load
from sqlalchemy import func
from sqlalchemy.orm import sessionmaker

import letta
from letta.orm import Agent, Message as MessageModel
from letta.schemas.agent import AgentState as PydanticAgentState
from letta.schemas.user import User
from letta.serialize_schemas.marshmallow_agent_environment_variable import SerializedAgentEnvironmentVariableSchema
from letta.serialize_schemas.marshmallow_base import BaseSchema
from letta.serialize_schemas.marshmallow_block import SerializedBlockSchema
from letta.serialize_schemas.marshmallow_custom_fields import EmbeddingConfigField, LLMConfigField, ToolRulesField
from letta.serialize_schemas.marshmallow_message import SerializedMessageSchema
from letta.serialize_schemas.marshmallow_tag import SerializedAgentTagSchema
from letta.serialize_schemas.marshmallow_tool import SerializedToolSchema
from letta.settings import DatabaseChoice, settings


class MarshmallowAgentSchema(BaseSchema):
    """
    Marshmallow schema for serializing/deserializing Agent objects.
    Excludes relational fields.
    """

    __pydantic_model__ = PydanticAgentState

    FIELD_VERSION = "version"
    FIELD_MESSAGES = "messages"
    FIELD_MESSAGE_IDS = "message_ids"
    FIELD_IN_CONTEXT_INDICES = "in_context_message_indices"
    FIELD_ID = "id"

    llm_config = LLMConfigField()
    embedding_config = EmbeddingConfigField()

    tool_rules = ToolRulesField()

    core_memory = fields.List(fields.Nested(SerializedBlockSchema))
    tools = fields.List(fields.Nested(SerializedToolSchema))
    tool_exec_environment_variables = fields.List(fields.Nested(SerializedAgentEnvironmentVariableSchema))
    secrets = fields.List(fields.Nested(SerializedAgentEnvironmentVariableSchema))
    tags = fields.List(fields.Nested(SerializedAgentTagSchema))

    def __init__(self, *args, session: sessionmaker, actor: User, max_steps: Optional[int] = None, **kwargs):
        super().__init__(*args, actor=actor, **kwargs)
        self.session = session
        self.max_steps = max_steps

        # Propagate session and actor to nested schemas automatically
        for field in self.fields.values():
            if isinstance(field, fields.List) and isinstance(field.inner, fields.Nested):
                field.inner.schema.session = session
                field.inner.schema.actor = actor
            elif isinstance(field, fields.Nested):
                field.schema.session = session
                field.schema.actor = actor

    @post_dump
    def attach_messages(self, data: Dict, **kwargs):
        """
        After dumping the agent, load all its Message rows and serialize them here.
        """
        # TODO: This is hacky, but want to move fast, please refactor moving forward
        from letta.server.db import db_registry

        with db_registry.session() as session:
            agent_id = data.get("id")

            if self.max_steps is not None:
                # first, always get the system message
                system_msg = (
                    session.query(MessageModel)
                    .filter(
                        MessageModel.agent_id == agent_id,
                        MessageModel.organization_id == self.actor.organization_id,
                        MessageModel.role == "system",
                    )
                    .order_by(MessageModel.sequence_id.asc())
                    .first()
                )

                if settings.database_engine is DatabaseChoice.POSTGRES:
                    # efficient PostgreSQL approach using subquery
                    user_msg_subquery = (
                        session.query(MessageModel.sequence_id)
                        .filter(
                            MessageModel.agent_id == agent_id,
                            MessageModel.organization_id == self.actor.organization_id,
                            MessageModel.role == "user",
                        )
                        .order_by(MessageModel.sequence_id.desc())
                        .limit(self.max_steps)
                        .subquery()
                    )

                    # get the minimum sequence_id from the subquery
                    cutoff_sequence_id = session.query(func.min(user_msg_subquery.c.sequence_id)).scalar()

                    if cutoff_sequence_id:
                        # get messages from cutoff, excluding system message to avoid duplicates
                        step_msgs = (
                            session.query(MessageModel)
                            .filter(
                                MessageModel.agent_id == agent_id,
                                MessageModel.organization_id == self.actor.organization_id,
                                MessageModel.sequence_id >= cutoff_sequence_id,
                                MessageModel.role != "system",
                            )
                            .order_by(MessageModel.sequence_id.asc())
                            .all()
                        )
                        # combine system message with step messages
                        msgs = [system_msg] + step_msgs if system_msg else step_msgs
                    else:
                        # no user messages, just return system message
                        msgs = [system_msg] if system_msg else []
                else:
                    # sqlite approach: get all user messages first, then get messages from cutoff
                    user_messages = (
                        session.query(MessageModel.sequence_id)
                        .filter(
                            MessageModel.agent_id == agent_id,
                            MessageModel.organization_id == self.actor.organization_id,
                            MessageModel.role == "user",
                        )
                        .order_by(MessageModel.sequence_id.desc())
                        .limit(self.max_steps)
                        .all()
                    )

                    if user_messages:
                        # get the minimum sequence_id
                        cutoff_sequence_id = min(msg.sequence_id for msg in user_messages)

                        # get messages from cutoff, excluding system message to avoid duplicates
                        step_msgs = (
                            session.query(MessageModel)
                            .filter(
                                MessageModel.agent_id == agent_id,
                                MessageModel.organization_id == self.actor.organization_id,
                                MessageModel.sequence_id >= cutoff_sequence_id,
                                MessageModel.role != "system",
                            )
                            .order_by(MessageModel.sequence_id.asc())
                            .all()
                        )
                        # combine system message with step messages
                        msgs = [system_msg] + step_msgs if system_msg else step_msgs
                    else:
                        # no user messages, just return system message
                        msgs = [system_msg] if system_msg else []
            else:
                # if no limit, get all messages in ascending order
                msgs = (
                    session.query(MessageModel)
                    .filter(
                        MessageModel.agent_id == agent_id,
                        MessageModel.organization_id == self.actor.organization_id,
                    )
                    .order_by(MessageModel.sequence_id.asc())
                    .all()
                )

            # overwrite the "messages" key with a fully serialized list
            data[self.FIELD_MESSAGES] = [SerializedMessageSchema(session=self.session, actor=self.actor).dump(m) for m in msgs]

        return data

    @post_dump
    def sanitize_ids(self, data: Dict, **kwargs):
        """
        - Removes `message_ids`
        - Adds versioning
        - Marks messages as in-context, preserving the order of the original `message_ids`
        - Removes individual message `id` fields
        """
        del data["id"]
        del data["_created_by_id"]
        del data["_last_updated_by_id"]
        data[self.FIELD_VERSION] = letta.__version__

        original_message_ids = data.pop(self.FIELD_MESSAGE_IDS, [])
        messages = data.get(self.FIELD_MESSAGES, [])

        # Build a mapping from message id to its first occurrence index and remove the id in one pass
        id_to_index = {}
        for idx, message in enumerate(messages):
            msg_id = message.pop(self.FIELD_ID, None)
            if msg_id is not None and msg_id not in id_to_index:
                id_to_index[msg_id] = idx

        # Build in-context indices in the same order as the original message_ids
        in_context_indices = [id_to_index[msg_id] for msg_id in original_message_ids if msg_id in id_to_index]

        data[self.FIELD_IN_CONTEXT_INDICES] = in_context_indices
        data[self.FIELD_MESSAGES] = messages

        return data

    @pre_load
    def regenerate_ids(self, data: Dict, **kwargs) -> Dict:
        if self.Meta.model:
            data["id"] = self.generate_id()
            data["_created_by_id"] = self.actor.id
            data["_last_updated_by_id"] = self.actor.id

        return data

    @post_dump
    def hide_tool_exec_environment_variables(self, data: Dict, **kwargs):
        """Hide the value of tool_exec_environment_variables"""

        for env_var in data.get("tool_exec_environment_variables", []):
            # need to be re-set at load time
            env_var["value"] = ""
        for env_var in data.get("secrets", []):
            # need to be re-set at load time
            env_var["value"] = ""
        return data

    @pre_load
    def check_version(self, data, **kwargs):
        """Check version and remove it from the schema"""
        version = data[self.FIELD_VERSION]
        if version != letta.__version__:
            print(f"Version mismatch: expected {letta.__version__}, got {version}")
        del data[self.FIELD_VERSION]
        return data

    class Meta(BaseSchema.Meta):
        model = Agent
        exclude = BaseSchema.Meta.exclude + (
            "project_id",
            "template_id",
            "base_template_id",
            "sources",
            "identities",
            "is_deleted",
            "groups",
            "batch_items",
            "organization",
            "runs",  # Exclude the runs relationship (agents_runs association table)
        )
