"""Constants for webhook configuration."""

# Environment variable names
ENV_WEBHOOK_URL = "LETTA_WEBHOOK_URL"
ENV_WEBHOOK_TOKEN = "LETTA_WEBHOOK_TOKEN"

# Default values
DEFAULT_WEBHOOK_TIMEOUT = 10.0  # seconds
DEFAULT_WEBHOOK_USER_AGENT = "LettaWebhookClient/1.0"

# Event types
EVENT_USER_MESSAGE = "user_message"
EVENT_ASSISTANT_MESSAGE = "assistant_message"
EVENT_INTERNAL_MONOLOGUE = "internal_monologue"
EVENT_FUNCTION_CALL = "function_call"
EVENT_STREAM_START = "stream_start"
EVENT_STREAM_END = "stream_end"
EVENT_STREAM_INITIALIZED = "stream_initialized"

# Headers
HEADER_AUTHORIZATION = "Authorization"
HEADER_CONTENT_TYPE = "Content-Type"
HEADER_USER_AGENT = "User-Agent"

# Content types
CONTENT_TYPE_JSON = "application/json"
