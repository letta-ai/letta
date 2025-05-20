"""Factory for creating streaming interfaces with optional webhook support."""

import os
from typing import Optional, Union

from letta.streaming_interface import AgentChunkStreamingInterface, StreamingCLIInterface
from .webhook_interface import WebhookStreamingInterface

def create_streaming_interface(
    agent_id: str,
    webhook_url: Optional[str] = None,
    webhook_token: Optional[str] = None,
    base_interface: Optional[AgentChunkStreamingInterface] = None,
) -> AgentChunkStreamingInterface:
    """Create a streaming interface with optional webhook support.
    
    Args:
        agent_id: The ID of the agent this interface is for
        webhook_url: The URL to send webhook events to. If None, webhooks are disabled.
        webhook_token: The bearer token for authenticating with the webhook
        base_interface: The base interface to wrap with webhook functionality. 
                      If None, a new StreamingCLIInterface will be used.
    
    Returns:
        A streaming interface that may include webhook functionality
    """
    # Use the provided base interface or create a default one
    if base_interface is None:
        base_interface = StreamingCLIInterface()
    
    # If webhook is not configured, return the base interface
    if not webhook_url:
        return base_interface
    
    # Create a webhook interface and set the agent ID
    webhook_interface = WebhookStreamingInterface(
        webhook_url=webhook_url,
        webhook_token=webhook_token or ""
    )
    webhook_interface.set_agent_id(agent_id)
    
    # Create a composite interface if needed
    if base_interface is not None:
        from letta.streaming_interface import CompositeStreamingInterface
        return CompositeStreamingInterface([base_interface, webhook_interface])
    
    return webhook_interface

def create_streaming_interface_from_env(
    agent_id: str,
    base_interface: Optional[AgentChunkStreamingInterface] = None
) -> AgentChunkStreamingInterface:
    """Create a streaming interface with webhook support from environment variables.
    
    Looks for these environment variables:
    - LETTA_WEBHOOK_URL: The URL to send webhook events to
    - LETTA_WEBHOOK_TOKEN: The bearer token for authenticating with the webhook
    
    Args:
        agent_id: The ID of the agent this interface is for
        base_interface: The base interface to wrap with webhook functionality
    
    Returns:
        A streaming interface that may include webhook functionality
    """
    webhook_url = os.getenv("LETTA_WEBHOOK_URL")
    webhook_token = os.getenv("LETTA_WEBHOOK_TOKEN", "")
    
    return create_streaming_interface(
        agent_id=agent_id,
        webhook_url=webhook_url,
        webhook_token=webhook_token,
        base_interface=base_interface
    )
