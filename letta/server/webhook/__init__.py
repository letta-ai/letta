"""Webhook integration for Letta agent events.

This package provides functionality to send agent events to external webhooks.
"""

from .webhook_interface import WebhookStreamingInterface
from .factory import create_streaming_interface, create_streaming_interface_from_env
from .config import validate_webhook_url, get_webhook_config, is_webhook_enabled
from .client import WebhookClient, webhook_client, send_agent_event, send_message_event
from .constants import (
    ENV_WEBHOOK_URL,
    ENV_WEBHOOK_TOKEN,
    DEFAULT_WEBHOOK_TIMEOUT,
    DEFAULT_WEBHOOK_USER_AGENT,
    EVENT_USER_MESSAGE,
    EVENT_ASSISTANT_MESSAGE,
    EVENT_INTERNAL_MONOLOGUE,
    EVENT_FUNCTION_CALL,
    EVENT_STREAM_START,
    EVENT_STREAM_END,
    EVENT_STREAM_INITIALIZED,
    HEADER_AUTHORIZATION,
    HEADER_CONTENT_TYPE,
    HEADER_USER_AGENT,
    CONTENT_TYPE_JSON,
)

__all__ = [
    # Classes
    "WebhookStreamingInterface",
    "WebhookClient",
    
    # Factory functions
    "create_streaming_interface",
    "create_streaming_interface_from_env",
    
    # Config functions
    "validate_webhook_url",
    "get_webhook_config",
    "is_webhook_enabled",
    
    # Client utilities
    "webhook_client",
    "send_agent_event",
    "send_message_event",
    
    # Constants
    "ENV_WEBHOOK_URL",
    "ENV_WEBHOOK_TOKEN",
    "DEFAULT_WEBHOOK_TIMEOUT",
    "DEFAULT_WEBHOOK_USER_AGENT",
    "EVENT_USER_MESSAGE",
    "EVENT_ASSISTANT_MESSAGE",
    "EVENT_INTERNAL_MONOLOGUE",
    "EVENT_FUNCTION_CALL",
    "EVENT_STREAM_START",
    "EVENT_STREAM_END",
    "EVENT_STREAM_INITIALIZED",
    "HEADER_AUTHORIZATION",
    "HEADER_CONTENT_TYPE",
    "HEADER_USER_AGENT",
    "CONTENT_TYPE_JSON",
]
