from letta_client import CreateBlock, Letta, MessageCreate

"""
Make sure you run the Letta server before running this example.
See: https://docs.letta.com/quickstart

If you're using Letta Cloud, replace 'baseURL' with 'token'
See: https://docs.letta.com/api-reference/overview

Execute this script using `uv run python3 example.py`

This will install `letta_client` and other dependencies.
"""
client = Letta(
    base_url="http://localhost:8283",
)

agent = client.agents.create(
    memory_blocks=[
        CreateBlock(
            value="Name: Caren",
            label="human",
        ),
    ],
    model="openai/gpt-4o-mini",
    embedding="openai/text-embedding-3-small",
)

print(f"Created agent with name {agent.name}")

# Example without streaming
message_text = "What's my name?"
response = client.agents.messages.create(
    agent_id=agent.id,
    messages=[
        MessageCreate(
            role="user",
            content=message_text,
        ),
    ],
)

print(f"Sent message to agent {agent.name}: {message_text}")
print(f"Agent thoughts: {response.messages[0].reasoning}")
print(f"Agent response: {response.messages[1].content}")


def secret_message():
    """Return a secret message."""
    return "Hello world!"


tool = client.tools.upsert_from_function(
    func=secret_message,
)

client.agents.tools.attach(agent_id=agent.id, tool_id=tool.id)

print(f"Created tool {tool.name} and attached to agent {agent.name}")

message_text = "Run secret message tool and tell me what it returns"
response = client.agents.messages.create(
    agent_id=agent.id,
    messages=[
        MessageCreate(
            role="user",
            content=message_text,
        ),
    ],
)

for msg in response.messages:
    if msg.message_type == "assistant_message":
        print(msg.content)
    elif msg.message_type == "reasoning_message":
        print(msg.reasoning)
    elif msg.message_type == "tool_call_message":
        print(msg.tool_call.name)
        print(msg.tool_call.arguments)
    elif msg.message_type == "tool_return_message":
        print(msg.tool_return)

print(f"Sent message to agent {agent.name}: {message_text}")
print(f"Agent thoughts: {response.messages[0].reasoning}")
print(f"Tool call information: {response.messages[1].tool_call}")
print(f"Tool response information: {response.messages[2].status}")
print(f"Agent thoughts: {response.messages[3].reasoning}")
print(f"Agent response: {response.messages[4].content}")


# send a message to the agent (streaming steps)
message_text = "Repeat my name."
stream = client.agents.messages.create_stream(
    agent_id=agent_state.id,
    messages=[
        MessageCreate(
            role="user",
            content=message_text,
        ),
    ],
    # if stream_tokens is false, each "chunk" will have a full piece
    # if stream_tokens is true, the chunks will be token-based (and may need to be accumulated client-side)
    stream_tokens=True,
)

# print the chunks coming back
for chunk in stream:
    if chunk.message_type == "assistant_message":
        print(chunk.content)
    elif chunk.message_type == "reasoning_message":
        print(chunk.reasoning)
    elif chunk.message_type == "tool_call_message":
        if chunk.tool_call.name:
            print(chunk.tool_call.name)
        if chunk.tool_call.arguments:
            print(chunk.tool_call.arguments)
    elif chunk.message_type == "tool_return_message":
        print(chunk.tool_return)
    elif chunk.message_type == "usage_statistics":
        print(chunk)


agent_copy = client.agents.create(
    model="openai/gpt-4o-mini",
    embedding="openai/text-embedding-3-small",
)
block = client.agents.blocks.retrieve(agent.id, block_label="human")
agent_copy = client.agents.blocks.attach(agent_copy.id, block.id)

print(f"Created agent copy with shared memory named {agent_copy.name}")

message_text = "My name isn't Caren, it's Sarah. Please update your core memory with core_memory_replace"
response = client.agents.messages.create(
    agent_id=agent_copy.id,
    messages=[
        MessageCreate(
            role="user",
            content=message_text,
        ),
    ],
)

print(f"Sent message to agent {agent_copy.name}: {message_text}")

block = client.agents.blocks.retrieve(agent_copy.id, block_label="human")
print(f"New core memory for agent {agent_copy.name}: {block.value}")

message_text = "What's my name?"
response = client.agents.messages.create(
    agent_id=agent_copy.id,
    messages=[
        MessageCreate(
            role="user",
            content=message_text,
        ),
    ],
)

print(f"Sent message to agent {agent_copy.name}: {message_text}")
print(f"Agent thoughts: {response.messages[0].reasoning}")
print(f"Agent response: {response.messages[1].content}")

client.agents.delete(agent_id=agent.id)
client.agents.delete(agent_id=agent_copy.id)

print(f"Deleted agents {agent.name} and {agent_copy.name}")
