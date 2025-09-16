#!/usr/bin/env python3
"""
Minimal examples showing Letta's streaming API.
"""

import os
from typing import Dict, Any
from letta_client import Letta


def step_streaming_example(client: Letta, agent_id: str):
    """Step streaming: receive complete messages as they're generated."""
    # Send a message with step streaming (default)
    stream = client.agents.messages.create_stream(
        agent_id=agent_id,
        messages=[{
            "role": "user",
            "content": "Hi! My name is Alice. What's 2+2?"
        }]
    )

    for chunk in stream:
        # Each chunk is a complete message
        if hasattr(chunk, 'message_type'):
            if chunk.message_type == 'assistant_message':
                print(chunk.content)


def token_streaming_example(client: Letta, agent_id: str):
    """Token streaming: receive partial chunks for real-time display."""
    # Send a message with token streaming enabled
    stream = client.agents.messages.create_stream(
        agent_id=agent_id,
        messages=[{
            "role": "user",
            "content": "What's my name? And tell me a short joke."
        }],
        stream_tokens=True  # Enable token streaming
    )

    # Track messages by ID for reassembly
    message_accumulators: Dict[str, str] = {}

    for chunk in stream:
        if hasattr(chunk, 'id') and chunk.message_type == 'assistant_message':
            msg_id = chunk.id

            # Initialize accumulator for new messages
            if msg_id not in message_accumulators:
                message_accumulators[msg_id] = ''

            # Accumulate and print content
            content_chunk = chunk.content or ''
            message_accumulators[msg_id] += content_chunk
            print(content_chunk, end="", flush=True)

    print()  # New line after streaming completes


def main():
    # Check for API key
    api_key = os.environ.get("LETTA_API_KEY")
    if not api_key:
        print("Please set LETTA_API_KEY environment variable")
        return

    # Initialize client
    client = Letta(token=api_key)

    # Create a test agent
    agent = client.agents.create(
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
        memory_blocks=[
            {
                "label": "human",
                "value": "The user is exploring streaming capabilities."
            },
            {
                "label": "persona",
                "value": "I am a helpful assistant demonstrating streaming responses."
            }
        ]
    )

    try:
        # Example 1: Step Streaming (default)
        print("\nStep Streaming (complete messages):")
        step_streaming_example(client, agent.id)

        # Example 2: Token Streaming
        print("\nToken Streaming (real-time chunks):")
        token_streaming_example(client, agent.id)

    finally:
        # Clean up
        client.agents.delete(agent.id)


if __name__ == "__main__":
    main()