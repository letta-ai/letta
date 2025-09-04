"""Client for sending webhook events."""

import asyncio
import json
import logging
from typing import Any, Dict, Optional

import aiohttp

from .config import get_webhook_config
from .constants import (
    CONTENT_TYPE_JSON, DEFAULT_WEBHOOK_TIMEOUT, DEFAULT_WEBHOOK_USER_AGENT,
    ENV_WEBHOOK_URL, HEADER_AUTHORIZATION, HEADER_CONTENT_TYPE, HEADER_USER_AGENT
)

logger = logging.getLogger(__name__)

class WebhookClient:
    """Client for sending webhook events."""
    
    def __init__(self, webhook_url: Optional[str] = None, webhook_token: Optional[str] = None):
        """Initialize the webhook client.
        
        Args:
            webhook_url: The URL to send webhook events to
            webhook_token: The bearer token for authenticating with the webhook
        """
        self.webhook_url = webhook_url
        self.webhook_token = webhook_token or ""
        self._session = None
    
    @classmethod
    def from_env(cls) -> 'WebhookClient':
        """Create a WebhookClient using environment variables."""
        webhook_url, webhook_token = get_webhook_config()
        return cls(webhook_url=webhook_url, webhook_token=webhook_token)
    
    @property
    def is_enabled(self) -> bool:
        """Check if the webhook client is enabled."""
        return bool(self.webhook_url)
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create an aiohttp session."""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()
        return self._session
    
    async def send_event(
        self,
        event_type: str,
        data: Dict[str, Any],
        timestamp: Optional[str] = None,
        timeout: float = DEFAULT_WEBHOOK_TIMEOUT
    ) -> bool:
        """Send a webhook event.
        
        Args:
            event_type: The type of event
            data: The event data
            timestamp: Optional timestamp (defaults to current time)
            timeout: Request timeout in seconds
            
        Returns:
            bool: True if the event was sent successfully, False otherwise
        """
        if not self.is_enabled:
            return False
            
        import datetime
        from uuid import uuid4
        
        payload = {
            "event": event_type,
            "id": str(uuid4()),
            "timestamp": timestamp or datetime.datetime.utcnow().isoformat(),
            "data": data
        }
        
        headers = {
            HEADER_CONTENT_TYPE: CONTENT_TYPE_JSON,
            HEADER_USER_AGENT: DEFAULT_WEBHOOK_USER_AGENT
        }
        
        if self.webhook_token:
            headers[HEADER_AUTHORIZATION] = f"Bearer {self.webhook_token}"
        
        try:
            session = await self._get_session()
            
            async with session.post(
                self.webhook_url,
                json=payload,
                headers=headers,
                timeout=timeout
            ) as response:
                if response.status >= 400:
                    error_text = await response.text()
                    logger.error(
                        "Webhook request failed with status %d: %s",
                        response.status,
                        error_text
                    )
                    return False
                return True
                
        except asyncio.TimeoutError:
            logger.error("Webhook request timed out after %.1f seconds", timeout)
            return False
            
        except Exception as e:
            logger.exception("Failed to send webhook event")
            return False
    
    async def close(self):
        """Close the webhook client and release resources."""
        if self._session and not self._session.closed:
            await self._session.close()
    
    async def __aenter__(self):
        """Async context manager entry."""
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()

# Global instance for convenience
webhook_client = WebhookClient.from_env()

# Helper functions for common events

async def send_agent_event(
    event_type: str,
    agent_id: str,
    message: Optional[str] = None,
    data: Optional[Dict[str, Any]] = None,
    **kwargs
) -> bool:
    """Send an agent-related webhook event.
    
    Args:
        event_type: The type of event
        agent_id: The ID of the agent
        message: Optional message
        data: Additional event data
        **kwargs: Additional fields to include in the event data
        
    Returns:
        bool: True if the event was sent successfully, False otherwise
    """
    if not webhook_client.is_enabled:
        return False
        
    event_data = {
        "agent_id": agent_id,
        **kwargs
    }
    
    if message is not None:
        event_data["message"] = message
    
    if data:
        event_data.update(data)
    
    return await webhook_client.send_event(
        event_type=event_type,
        data=event_data
    )

async def send_message_event(
    event_type: str,
    message_id: str,
    agent_id: str,
    content: str,
    **kwargs
) -> bool:
    """Send a message-related webhook event.
    
    Args:
        event_type: The type of event
        message_id: The ID of the message
        agent_id: The ID of the agent
        content: The message content
        **kwargs: Additional fields to include in the event data
        
    Returns:
        bool: True if the event was sent successfully, False otherwise
    """
    return await send_agent_event(
        event_type=event_type,
        agent_id=agent_id,
        message_id=message_id,
        content=content,
        **kwargs
    )
