#!/usr/bin/env python3
"""
Demo script to show the structure of Letta streaming responses.
This demonstrates both token streaming and step streaming modes.
"""

import json
from typing import Dict, Any, List
from letta_client import Letta
import os

def print_message_structure(message: Dict[str, Any], mode: str = ""):
    """Pretty print message structure with type information."""
    print(f"\n{'='*60}")
    if mode:
        print(f"Mode: {mode}")
    print(f"Message Type: {message.get('message_type', 'N/A')}")
    print(f"ID: {message.get('id', 'N/A')[:20]}..." if message.get('id') else "ID: N/A")
    print(f"Date: {message.get('date', 'N/A')}")
    
    # Print content based on message type
    msg_type = message.get('message_type')
    
    if msg_type == 'reasoning_message':
        print(f"Reasoning: {message.get('reasoning', '')[:100]}...")
    elif msg_type == 'assistant_message':
        print(f"Assistant: {message.get('assistant_message', '')[:100]}...")
    elif msg_type == 'tool_call_message':
        tool_call = message.get('tool_call', {})
        print(f"Tool Call: {tool_call.get('name', 'N/A')}")
        print(f"Arguments: {tool_call.get('arguments', '')[:100]}...")
    elif msg_type == 'tool_return_message':
        print(f"Tool Return: {message.get('tool_return', '')[:100]}...")
    elif msg_type == 'usage_statistics':
        print(f"Usage Stats: {json.dumps(message, indent=2)}")
    
    print(f"{'='*60}")

def demo_step_streaming(client: Letta, agent_id: str):
    """Demonstrate step streaming - complete messages per event."""
    print("\n" + "="*80)
    print("STEP STREAMING DEMO (stream_tokens=False - DEFAULT)")
    print("="*80)
    print("Each SSE event contains a COMPLETE message")

    # Send a message with step streaming (default behavior)
    stream = client.agents.messages.create_stream(
        agent_id=agent_id,
        messages=[
            {
                "role": "user",
                "content": "Hi, my name is Donald Glover. Please remember this and then tell me what 2+2 equals."
            }
        ],
        stream_tokens=False  # Explicitly disable token streaming
    )
    
    collected_messages = []
    chunk_count = 0

    for chunk in stream:
        chunk_count += 1
        print(f"\n{'='*80}")
        print(f"CHUNK #{chunk_count}")
        print(f"{'='*80}")

        # Print complete chunk information
        print(f"Type: {type(chunk).__name__}")
        print(f"Raw object: {chunk}")

        # Print all attributes
        if hasattr(chunk, '__dict__'):
            print("\nAll attributes:")
            for attr, value in vars(chunk).items():
                print(f"  {attr}: {value}")
        else:
            print(f"\nObject methods and attributes:")
            attrs = [attr for attr in dir(chunk) if not attr.startswith('_')]
            for attr in attrs:
                try:
                    value = getattr(chunk, attr)
                    if not callable(value):
                        print(f"  {attr}: {value}")
                except:
                    print(f"  {attr}: <unable to access>")

        print(f"{'='*80}")

        collected_messages.append(chunk)

        if chunk == "[DONE]" or str(chunk) == "[DONE]":
            print("\n[DONE] signal received")
            break
    
    print(f"\nTotal messages received: {len(collected_messages)}")
    return collected_messages

def demo_token_streaming(client: Letta, agent_id: str):
    """Demonstrate token streaming - partial chunks that need reassembly."""
    print("\n" + "="*80)
    print("TOKEN STREAMING DEMO (stream_tokens=True)")
    print("="*80)
    print("Each SSE event contains PARTIAL chunks that must be reassembled by message ID")

    # Send a message with TOKEN streaming enabled
    stream = client.agents.messages.create_stream(
        agent_id=agent_id,
        messages=[
            {
                "role": "user",
                "content": "What's my name again? And can you tell me a joke about actors?"
            }
        ],
        stream_tokens=True  # Enable token streaming for partial chunks
    )

    collected_chunks = []
    chunk_count = 0

    for chunk in stream:
        chunk_count += 1
        print(f"\n{'='*80}")
        print(f"CHUNK #{chunk_count}")
        print(f"{'='*80}")

        # Print complete chunk information
        print(f"Type: {type(chunk).__name__}")
        print(f"Raw object: {chunk}")

        # Print all attributes
        if hasattr(chunk, '__dict__'):
            print("\nAll attributes:")
            for attr, value in vars(chunk).items():
                print(f"  {attr}: {value}")
        else:
            print(f"\nObject methods and attributes:")
            attrs = [attr for attr in dir(chunk) if not attr.startswith('_')]
            for attr in attrs:
                try:
                    value = getattr(chunk, attr)
                    if not callable(value):
                        print(f"  {attr}: {value}")
                except:
                    print(f"  {attr}: <unable to access>")

        print(f"{'='*80}")

        collected_chunks.append(chunk)

        if chunk == "[DONE]" or str(chunk) == "[DONE]":
            print("\n[DONE] signal received")
            break

    print(f"\nTotal chunks received: {len(collected_chunks)}")
    return collected_chunks

def main():
    # Get API key
    api_key = os.environ.get("LETTA_API_KEY")
    if not api_key:
        print("Please set LETTA_API_KEY environment variable")
        return
    
    # Initialize client
    print("Initializing Letta client...")
    client = Letta(token=api_key)
    
    # Create a test agent
    print("Creating test agent...")
    agent_state = client.agents.create(
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
        memory_blocks=[
            {
                "label": "human",
                "value": "The human is testing streaming responses."
            },
            {
                "label": "persona",
                "value": "I am a helpful assistant demonstrating streaming."
            }
        ]
    )
    print(f"Agent created with ID: {agent_state.id}")
    
    try:
        # Demo 1: Step Streaming
        step_messages = demo_step_streaming(client, agent_state.id)
        
        # Demo 2: Token Streaming
        token_messages = demo_token_streaming(client, agent_state.id)
        
        # Summary
        print("\n" + "="*80)
        print("SUMMARY OF MESSAGE SHAPES")
        print("="*80)
        
        print("\nMessage Types Observed:")
        print("- reasoning_message: Agent's internal reasoning/thinking")
        print("- assistant_message: Agent's response to the user")
        print("- tool_call_message: Request to execute a tool")
        print("- tool_return_message: Result from tool execution")
        print("- usage_statistics: Token usage and step count")
        
        print("\nKey Differences:")
        print("1. Step Streaming (stream_tokens=False): Each SSE event is a complete message")
        print("2. Token Streaming (stream_tokens=True): Each SSE event is a partial chunk")
        print("   - Must accumulate chunks by message ID and type")
        print("   - Partial content in reasoning/assistant_message fields")
        print("   - Same LettaMessage structure, just chunked content")
        print("   - Client responsible for reassembling complete messages")
        
        print("\nSSE Format:")
        print("- Each event starts with 'data: '")
        print("- JSON payload follows the data prefix")
        print("- Stream ends with 'data: [DONE]'")
        
    finally:
        # Clean up - delete the agent
        print(f"\nCleaning up - deleting agent {agent_state.id}")
        client.agents.delete(agent_state.id)
        print("Done!")

if __name__ == "__main__":
    main()
