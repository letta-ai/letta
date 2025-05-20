import os
import json
import aiohttp
from typing import Optional, Dict, Any
from datetime import datetime

from letta.streaming_interface import AgentChunkStreamingInterface
from letta.schemas.message import Message
from letta.schemas.openai.chat_completion_response import ChatCompletionChunkResponse
from .constants import (
    EVENT_ASSISTANT_MESSAGE, EVENT_FUNCTION_CALL, EVENT_INTERNAL_MONOLOGUE,
    EVENT_STREAM_END, EVENT_STREAM_INITIALIZED, EVENT_STREAM_START, EVENT_USER_MESSAGE
)
from .client import WebhookClient, send_agent_event, send_message_event

class WebhookStreamingInterface(AgentChunkStreamingInterface):
    """Streaming interface that sends webhook events for agent activities.
    
    This interface captures various agent events and forwards them to a configurable
    webhook URL with authentication.
    """
    
    def __init__(self, webhook_url: str, webhook_token: str):
        """Initialize the webhook interface.
        
        Args:
            webhook_url: The URL to send webhook events to
            webhook_token: Bearer token for authenticating with the webhook
        """
        self.webhook_url = webhook_url
        self.webhook_token = webhook_token
        self.session = None
        self.current_message_id = None
        self.current_message_start = None
        self.agent_id = None  # Will be set when processing starts

    async def _send_webhook(self, event_type: str, data: Dict[str, Any]) -> None:
        """Helper method to send webhook events.
        
        Args:
            event_type: Type of the event (e.g., 'user_message', 'assistant_message')
            data: Event-specific data to include in the webhook payload
        """
        if not self.webhook_url:
            return
            
        payload = {
            "event": event_type,
            "timestamp": datetime.utcnow().isoformat(),
            "data": data
        }
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.webhook_token}",
            "User-Agent": "LettaWebhook/1.0"
        }
        
        try:
            if not self.session or self.session.closed:
                self.session = aiohttp.ClientSession()
                
            async with self.session.post(
                self.webhook_url,
                json=payload,
                headers=headers,
                timeout=10
            ) as response:
                if response.status >= 400:
                    error_text = await response.text()
                    print(f"Webhook error ({response.status}): {error_text}")
        except Exception as e:
            print(f"Failed to send webhook: {str(e)}")

    async def user_message(self, msg: str, msg_obj: Optional[Message] = None) -> None:
        """Handle user message event."""
        if msg_obj:
            await send_message_event(EVENT_USER_MESSAGE, msg_obj.id, self.agent_id, msg)

    async def assistant_message(self, msg: str, msg_obj: Optional[Message] = None) -> None:
        """Handle assistant message event."""
        if msg_obj:
            await send_message_event(EVENT_ASSISTANT_MESSAGE, msg_obj.id, self.agent_id, msg)

    async def internal_monologue(self, msg: str, msg_obj: Optional[Message] = None, chunk_index: Optional[int] = None) -> None:
        """Handle internal monologue event."""
        if msg_obj:
            await send_agent_event(EVENT_INTERNAL_MONOLOGUE, self.agent_id, msg, {"message_id": msg_obj.id, "chunk_index": chunk_index})

    async def function_message(self, msg: str, msg_obj: Optional[Message] = None, chunk_index: Optional[int] = None) -> None:
        """Handle function call event."""
        if msg_obj:
            await send_agent_event(EVENT_FUNCTION_CALL, self.agent_id, msg, {"message_id": msg_obj.id, "chunk_index": chunk_index})

    async def process_chunk(
        self,
        chunk: ChatCompletionChunkResponse,
        message_id: str,
        message_date: datetime,
        expect_reasoning_content: bool = False,
        name: Optional[str] = None,
        message_index: int = 0,
    ) -> None:
        """Process a streaming chunk."""
        if message_id != self.current_message_id:
            self.current_message_id = message_id
            self.current_message_start = datetime.utcnow()
            
            await send_agent_event(EVENT_STREAM_START, self.agent_id, message_id, {"expect_reasoning_content": expect_reasoning_content, "message_index": message_index})

    async def stream_start(self) -> None:
        """Handle stream start event."""
        await send_agent_event(EVENT_STREAM_INITIALIZED, self.agent_id)

    async def stream_end(self) -> None:
        """Handle stream end event."""
        if self.current_message_id and self.current_message_start:
            duration = (datetime.utcnow() - self.current_message_start).total_seconds()
            await send_agent_event(EVENT_STREAM_END, self.agent_id, self.current_message_id, {"duration_seconds": duration})
            
        self.current_message_id = None
        self.current_message_start = None
        
        # Close the session if it exists
        if self.session:
            await self.session.close()
            self.session = None

    def set_agent_id(self, agent_id: str) -> None:
        """Set the agent ID for the current session.
        
        Args:
            agent_id: The ID of the agent this interface is handling
        """
        self.agent_id = agent_id

    async def __aenter__(self):
        """Support async context manager."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Ensure resources are cleaned up."""
        if self.session:
            await self.session.close()
            self.session = None
