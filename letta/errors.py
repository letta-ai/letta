import json
from enum import Enum
from typing import TYPE_CHECKING, Dict, List, Optional, Union

# Avoid circular imports
if TYPE_CHECKING:
    from letta.schemas.message import Message


class ErrorCode(Enum):
    """Enum for error codes used by client."""

    NOT_FOUND = "NOT_FOUND"
    UNAUTHENTICATED = "UNAUTHENTICATED"
    PERMISSION_DENIED = "PERMISSION_DENIED"
    INVALID_ARGUMENT = "INVALID_ARGUMENT"
    INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR"
    CONTEXT_WINDOW_EXCEEDED = "CONTEXT_WINDOW_EXCEEDED"
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"
    TIMEOUT = "TIMEOUT"
    CONFLICT = "CONFLICT"
    EXPIRED = "EXPIRED"


class LettaError(Exception):
    """Base class for all Letta related errors."""

    def __init__(self, message: str, code: Optional[ErrorCode] = None, details: Optional[Union[Dict, str, object]] = None):
        if details is None:
            details = {}
        self.message = message
        self.code = code
        self.details = details
        super().__init__(message)

    def __str__(self) -> str:
        if self.code:
            return f"{self.code.value}: {self.message}"
        return self.message

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(message='{self.message}', code='{self.code}', details={self.details})"


class PendingApprovalError(LettaError):
    """Error raised when attempting an operation while agent is waiting for tool approval."""

    def __init__(self, pending_request_id: Optional[str] = None):
        self.pending_request_id = pending_request_id
        message = "Cannot send a new message: The agent is waiting for approval on a tool call. Please approve or deny the pending request before continuing."
        code = ErrorCode.CONFLICT
        details = {"error_code": "PENDING_APPROVAL", "pending_request_id": pending_request_id}
        super().__init__(message=message, code=code, details=details)


class LettaToolCreateError(LettaError):
    """Error raised when a tool cannot be created."""

    default_error_message = "Error creating tool."

    def __init__(self, message=None):
        super().__init__(message=message or self.default_error_message)


class LettaToolNameConflictError(LettaError):
    """Error raised when a tool name already exists."""

    def __init__(self, tool_name: str):
        super().__init__(
            message=f"Tool with name '{tool_name}' already exists in your organization",
            code=ErrorCode.INVALID_ARGUMENT,
            details={"tool_name": tool_name},
        )


class LettaToolNameSchemaMismatchError(LettaToolCreateError):
    """Error raised when a tool name our source codedoes not match the name in the JSON schema."""

    def __init__(self, tool_name: str, json_schema_name: str, source_code: str):
        super().__init__(
            message=f"Tool name '{tool_name}' does not match the name in the JSON schema '{json_schema_name}' or in the source code `{source_code}`",
        )


class LettaConfigurationError(LettaError):
    """Error raised when there are configuration-related issues."""

    def __init__(self, message: str, missing_fields: Optional[List[str]] = None):
        self.missing_fields = missing_fields or []
        super().__init__(message=message, details={"missing_fields": self.missing_fields})


class LettaAgentNotFoundError(LettaError):
    """Error raised when an agent is not found."""


class LettaUserNotFoundError(LettaError):
    """Error raised when a user is not found."""


class LettaUnsupportedFileUploadError(LettaError):
    """Error raised when an unsupported file upload is attempted."""


class LettaInvalidArgumentError(LettaError):
    """Error raised when an invalid argument is provided."""

    def __init__(self, message: str, argument_name: Optional[str] = None):
        details = {"argument_name": argument_name} if argument_name else {}
        super().__init__(message=message, code=ErrorCode.INVALID_ARGUMENT, details=details)


class LettaMCPError(LettaError):
    """Base error for MCP-related issues."""


class LettaInvalidMCPSchemaError(LettaMCPError):
    """Error raised when an invalid MCP schema is provided."""

    def __init__(self, server_name: str, mcp_tool_name: str, reasons: List[str]):
        details = {"server_name": server_name, "mcp_tool_name": mcp_tool_name, "reasons": reasons}
        super().__init__(
            message=f"MCP tool {mcp_tool_name} has an invalid schema and cannot be attached - reasons: {reasons}",
            code=ErrorCode.INVALID_ARGUMENT,
            details=details,
        )


class LettaMCPConnectionError(LettaMCPError):
    """Error raised when unable to connect to MCP server."""

    def __init__(self, message: str, server_name: Optional[str] = None):
        details = {"server_name": server_name} if server_name else {}
        super().__init__(message=message, code=ErrorCode.INTERNAL_SERVER_ERROR, details=details)


class LettaMCPTimeoutError(LettaMCPError):
    """Error raised when MCP server operation times out."""

    def __init__(self, message: str, server_name: Optional[str] = None):
        details = {"server_name": server_name} if server_name else {}
        super().__init__(message=message, code=ErrorCode.TIMEOUT, details=details)


class LettaServiceUnavailableError(LettaError):
    """Error raised when a required service is unavailable."""

    def __init__(self, message: str, service_name: Optional[str] = None):
        details = {"service_name": service_name} if service_name else {}
        super().__init__(message=message, code=ErrorCode.INTERNAL_SERVER_ERROR, details=details)


class LettaUnexpectedStreamCancellationError(LettaError):
    """Error raised when a streaming request is terminated unexpectedly."""


class LettaExpiredError(LettaError):
    """Error raised when a resource has expired."""

    def __init__(self, message: str):
        super().__init__(message=message, code=ErrorCode.EXPIRED)


class LLMError(LettaError):
    pass


class LLMConnectionError(LLMError):
    """Error when unable to connect to LLM service"""


class LLMRateLimitError(LLMError):
    """Error when rate limited by LLM service"""


class LLMBadRequestError(LLMError):
    """Error when LLM service cannot process request"""


class LLMAuthenticationError(LLMError):
    """Error when authentication fails with LLM service"""


class LLMPermissionDeniedError(LLMError):
    """Error when permission is denied by LLM service"""


class LLMNotFoundError(LLMError):
    """Error when requested resource is not found"""


class LLMUnprocessableEntityError(LLMError):
    """Error when request is well-formed but semantically invalid"""


class LLMServerError(LLMError):
    """Error indicating an internal server error occurred within the LLM service itself
    while processing the request."""


class LLMTimeoutError(LLMError):
    """Error when LLM request times out"""


class LLMProviderOverloaded(LLMError):
    """Error when LLM provider is overloaded"""


class BedrockPermissionError(LettaError):
    """Exception raised for errors in the Bedrock permission process."""

    def __init__(self, message="User does not have access to the Bedrock model with the specified ID."):
        super().__init__(message=message)


class BedrockError(LettaError):
    """Exception raised for errors in the Bedrock process."""

    def __init__(self, message="Error with Bedrock model."):
        super().__init__(message=message)


class LLMJSONParsingError(LettaError):
    """Exception raised for errors in the JSON parsing process."""

    def __init__(self, message="Error parsing JSON generated by LLM"):
        super().__init__(message=message)


class LocalLLMError(LettaError):
    """Generic catch-all error for local LLM problems"""

    def __init__(self, message="Encountered an error while running local LLM"):
        super().__init__(message=message)


class LocalLLMConnectionError(LettaError):
    """Error for when local LLM cannot be reached with provided IP/port"""

    def __init__(self, message="Could not connect to local LLM"):
        super().__init__(message=message)


class ContextWindowExceededError(LettaError):
    """Error raised when the context window is exceeded but further summarization fails."""

    def __init__(self, message: str, details: dict = {}):
        error_message = f"{message} ({details})"
        super().__init__(
            message=error_message,
            code=ErrorCode.CONTEXT_WINDOW_EXCEEDED,
            details=details,
        )


class RateLimitExceededError(LettaError):
    """Error raised when the llm rate limiter throttles api requests."""

    def __init__(self, message: str, max_retries: int):
        error_message = f"{message} ({max_retries})"
        super().__init__(
            message=error_message,
            code=ErrorCode.RATE_LIMIT_EXCEEDED,
            details={"max_retries": max_retries},
        )


class LettaMessageError(LettaError):
    """Base error class for handling message-related errors."""

    messages: List[Union["Message", "LettaMessage"]]
    default_error_message: str = "An error occurred with the message."

    def __init__(self, *, messages: List[Union["Message", "LettaMessage"]], explanation: Optional[str] = None) -> None:
        error_msg = self.construct_error_message(messages, self.default_error_message, explanation)
        super().__init__(error_msg)
        self.messages = messages

    @staticmethod
    def construct_error_message(messages: List[Union["Message", "LettaMessage"]], error_msg: str, explanation: Optional[str] = None) -> str:
        """Helper method to construct a clean and formatted error message."""
        if explanation:
            error_msg += f" (Explanation: {explanation})"

        # Pretty print out message JSON
        message_json = json.dumps([message.model_dump() for message in messages], indent=4)
        return f"{error_msg}\n\n{message_json}"


class MissingToolCallError(LettaMessageError):
    """Error raised when a message is missing a tool call."""

    default_error_message = "The message is missing a tool call."


class InvalidToolCallError(LettaMessageError):
    """Error raised when a message uses an invalid tool call."""

    default_error_message = "The message uses an invalid tool call or has improper usage of a tool call."


class MissingInnerMonologueError(LettaMessageError):
    """Error raised when a message is missing an inner monologue."""

    default_error_message = "The message is missing an inner monologue."


class InvalidInnerMonologueError(LettaMessageError):
    """Error raised when a message has a malformed inner monologue."""

    default_error_message = "The message has a malformed inner monologue."


class HandleNotFoundError(LettaError):
    """Error raised when a handle is not found."""

    def __init__(self, handle: str, available_handles: List[str]):
        super().__init__(
            message=f"Handle {handle} not found, must be one of {available_handles}",
            code=ErrorCode.NOT_FOUND,
        )


class AgentFileExportError(Exception):
    """Exception raised during agent file export operations"""


class AgentNotFoundForExportError(AgentFileExportError):
    """Exception raised when requested agents are not found during export"""

    def __init__(self, missing_ids: List[str]):
        self.missing_ids = missing_ids
        super().__init__(f"The following agent IDs were not found: {missing_ids}")


class AgentExportIdMappingError(AgentFileExportError):
    """Exception raised when ID mapping fails during export conversion"""

    def __init__(self, db_id: str, entity_type: str):
        self.db_id = db_id
        self.entity_type = entity_type
        super().__init__(
            f"Unexpected new {entity_type} ID '{db_id}' encountered during conversion. "
            f"All IDs should have been mapped during agent processing."
        )


class AgentExportProcessingError(AgentFileExportError):
    """Exception raised when general export processing fails"""

    def __init__(self, message: str, original_error: Optional[Exception] = None):
        self.original_error = original_error
        super().__init__(f"Export failed: {message}")


class AgentFileImportError(Exception):
    """Exception raised during agent file import operations"""
