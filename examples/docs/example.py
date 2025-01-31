from letta_client import CreateBlock, Letta, MessageCreate

"""
Make sure you run the Letta server before running this example.
See: https://docs.letta.com/quickstart

If you're using Letta Cloud, replace 'baseURL' with 'token'
See: https://docs.letta.com/api-reference/overview

Execute this script using `poetry run python3 example.py`
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
    embedding="openai/text-embedding-ada-002",
)

print(f"Created agent with name {agent.name}")

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

print(f"Sent message to agent {agent.name}: {message_text}")
print(f"Agent thoughts: {response.messages[0].reasoning}")
print(f"Tool call information: {response.messages[1].tool_call}")
print(f"Tool response information: {response.messages[2].status}")
print(f"Agent thoughts: {response.messages[3].reasoning}")
print(f"Agent response: {response.messages[4].content}")

agent_copy = client.agents.create(
    model="openai/gpt-4o-mini",
    embedding="openai/text-embedding-ada-002",
)
block = client.agents.core_memory.retrieve_block(agent.id, "human")
agent_copy = client.agents.core_memory.attach_block(agent_copy.id, block.id)

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

block = client.agents.core_memory.retrieve_block(agent_copy.id, "human")
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
