from sqlalchemy import JSON
from sqlalchemy.types import BINARY, TypeDecorator

from letta.helpers.converters import (
    deserialize_agent_step_state,
    deserialize_approvals,
    deserialize_batch_request_result,
    deserialize_create_batch_response,
    deserialize_embedding_config,
    deserialize_llm_config,
    deserialize_mcp_stdio_config,
    deserialize_message_content,
    deserialize_poll_batch_response,
    deserialize_response_format,
    deserialize_tool_calls,
    deserialize_tool_returns,
    deserialize_tool_rules,
    deserialize_vector,
    serialize_agent_step_state,
    serialize_approvals,
    serialize_batch_request_result,
    serialize_create_batch_response,
    serialize_embedding_config,
    serialize_llm_config,
    serialize_mcp_stdio_config,
    serialize_message_content,
    serialize_poll_batch_response,
    serialize_response_format,
    serialize_tool_calls,
    serialize_tool_returns,
    serialize_tool_rules,
    serialize_vector,
)


class LLMConfigColumn(TypeDecorator):
    """Custom SQLAlchemy column type for storing LLMConfig as JSON."""

    impl = JSON
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return serialize_llm_config(value)

    def process_result_value(self, value, dialect):
        return deserialize_llm_config(value)


class EmbeddingConfigColumn(TypeDecorator):
    """Custom SQLAlchemy column type for storing EmbeddingConfig as JSON."""

    impl = JSON
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return serialize_embedding_config(value)

    def process_result_value(self, value, dialect):
        return deserialize_embedding_config(value)


class ToolRulesColumn(TypeDecorator):
    """Custom SQLAlchemy column type for storing a list of ToolRules as JSON."""

    impl = JSON
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return serialize_tool_rules(value)

    def process_result_value(self, value, dialect):
        return deserialize_tool_rules(value)


class ToolCallColumn(TypeDecorator):
    """Custom SQLAlchemy column type for storing OpenAI ToolCall objects as JSON."""

    impl = JSON
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return serialize_tool_calls(value)

    def process_result_value(self, value, dialect):
        return deserialize_tool_calls(value)


class ToolReturnColumn(TypeDecorator):
    """Custom SQLAlchemy column type for storing the return value of a tool call as JSON."""

    impl = JSON
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return serialize_tool_returns(value)

    def process_result_value(self, value, dialect):
        return deserialize_tool_returns(value)


class ApprovalsColumn(TypeDecorator):
    """Custom SQLAlchemy column type for storing the approval responses of a tool call request as JSON."""

    impl = JSON
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return serialize_approvals(value)

    def process_result_value(self, value, dialect):
        return deserialize_approvals(value)


class MessageContentColumn(TypeDecorator):
    """Custom SQLAlchemy column type for storing the content parts of a message as JSON."""

    impl = JSON
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return serialize_message_content(value)

    def process_result_value(self, value, dialect):
        return deserialize_message_content(value)


class CommonVector(TypeDecorator):
    """Custom SQLAlchemy column type for storing vectors in SQLite."""

    impl = BINARY
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return serialize_vector(value)

    def process_result_value(self, value, dialect):
        return deserialize_vector(value, dialect)


class CreateBatchResponseColumn(TypeDecorator):
    """Custom SQLAlchemy column type for storing a list of ToolRules as JSON."""

    impl = JSON
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return serialize_create_batch_response(value)

    def process_result_value(self, value, dialect):
        return deserialize_create_batch_response(value)


class PollBatchResponseColumn(TypeDecorator):
    """Custom SQLAlchemy column type for storing a list of ToolRules as JSON."""

    impl = JSON
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return serialize_poll_batch_response(value)

    def process_result_value(self, value, dialect):
        return deserialize_poll_batch_response(value)


class BatchRequestResultColumn(TypeDecorator):
    """Custom SQLAlchemy column type for storing a list of ToolRules as JSON."""

    impl = JSON
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return serialize_batch_request_result(value)

    def process_result_value(self, value, dialect):
        return deserialize_batch_request_result(value)


class AgentStepStateColumn(TypeDecorator):
    """Custom SQLAlchemy column type for storing a list of ToolRules as JSON."""

    impl = JSON
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return serialize_agent_step_state(value)

    def process_result_value(self, value, dialect):
        return deserialize_agent_step_state(value)


class ResponseFormatColumn(TypeDecorator):
    """Custom SQLAlchemy column type for storing a list of ToolRules as JSON."""

    impl = JSON
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return serialize_response_format(value)

    def process_result_value(self, value, dialect):
        return deserialize_response_format(value)


class MCPStdioServerConfigColumn(TypeDecorator):
    impl = JSON
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return serialize_mcp_stdio_config(value)

    def process_result_value(self, value, dialect):
        return deserialize_mcp_stdio_config(value)
