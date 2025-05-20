"""Webhook integration for Letta agent events.

This package provides functionality to send agent events to external webhooks.
"""

from .webhook_interface import WebhookStreamingInterface
from .factory import create_streaming_interface, create_streaming_interface_from_env
from .config import validate_webhook_url, get_webhook_config, is_webhook_enabled
from .client import WebhookClient, webhook_client, send_agent_event, send_message_event

__all__ = [
    "WebhookStreamingInterface",
    "create_streaming_interface",
    "create_streaming_interface_from_env",
    "validate_webhook_url",
    "get_webhook_config",
    "is_webhook_enabled",
    "WebhookClient",
    "webhook_client",
    "send_agent_event",
    "send_message_event",
]
