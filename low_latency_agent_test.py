"""
#!/usr/bin/env python3
Example usage:
    python low_latency_agent_test.py --url http://localhost:8283/ --agent-id agent-6025440b-2c43-4b19-8ab6-f37e2a7469ca

"""

import json
import time

import requests
from letta_client import Letta
from sseclient import SSEClient  # pip install sseclient-py

letta_client = Letta(
    base_url="http://localhost:8283",
)


def test_voice_agent_conversation_latency(
    base_url,
    agent_id,
    user_id=None,
    message="Hello, how are you today?",
):
    url = f"{base_url}/v1/voice-beta/{agent_id}/chat/completions"

    headers = {
        "Content-Type": "application/json",
    }

    if user_id:
        headers["user_id"] = user_id

    # Store latency measurements
    ttft_times = []  # Time to first token
    total_times = []  # Total request time
    conversation_messages = [{"role": "user", "content": message}]
    print(f"Testing sequential conversation latency for {url}")
    print(f"\nMessage:")
    print(f"Content: {conversation_messages[-1]['content']}")

    # Create payload with current conversation history

    payload = {
        "model": "gpt-4o-mini",
        "messages": conversation_messages,
        "stream": True,
    }

    # Start timer for this message
    start_time = time.time()
    first_token_time = None
    assistant_response = ""

    # Make request
    response = requests.post(url, json=payload, headers=headers, stream=True)

    if response.status_code != 200:
        print(f"Error: Status code {response.status_code}")
        print(response.text)
        return

    # Process the SSE stream
    client = SSEClient(response)
    for event in client.events():
        current_time = time.time()

        # If this is the first token, record time
        if first_token_time is None:
            first_token_time = current_time
            ttft = first_token_time - start_time
            ttft_times.append(ttft)
            print(f"  Time to first token: {ttft:.3f} seconds")

            # Process the content if not the done signal
            if event.data != "[DONE]":
                try:
                    data = json.loads(event.data)
                    if "choices" in data and len(data["choices"]) > 0:
                        delta = data["choices"][0].get("delta", {})
                        if "content" in delta and delta["content"]:
                            assistant_response += delta["content"]
                except json.JSONDecodeError:
                    pass
            else:
                break

        # Record total time for this message
    end_time = time.time()
    total_time = end_time - start_time
    total_times.append(total_time)
    # get number of current tokens in teh agent
    blocks = letta_client.agents.blocks.list(agent_id=agent_id)
    block_length = sum([len(block.value) for block in blocks])

    print(f"  Total time for message: {total_time:.3f} seconds")
    print(f"  Number of current tokens: {block_length}")


if __name__ == "__main__":
    # You can modify these parameters as needed
    base_url = "http://localhost:8283"  # Change to your API server URL
    agent_id = "agent-6025440b-2c43-4b19-8ab6-f37e2a7469ca"  # Change to your agent ID
    user_id = None  # Optional user ID

    # Run the test
    test_voice_agent_conversation_latency(
        base_url=base_url,
        agent_id=agent_id,
        user_id=user_id,
    )
