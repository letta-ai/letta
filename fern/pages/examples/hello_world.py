import os

from letta_client import Letta

# Initialize client (using LETTA_API_KEY environment variable)
client = Letta(token=os.getenv("LETTA_API_KEY"))

# Create agent
agent = client.agents.create(
    name="hello_world_assistant",
    memory_blocks=[
        {"label": "persona", "value": "I am a friendly AI assistant here to help you learn about Letta."},
        {"label": "human", "value": "Name: User\nFirst interaction: Learning about Letta"},
    ],
    model="openai/gpt-4o-mini",
    embedding="openai/text-embedding-3-small",
)

print(f"Created agent: {agent.id}\n")

# Send first message
response = client.agents.messages.create(agent_id=agent.id, messages=[{"role": "user", "content": "Hello! What's your purpose?"}])

for msg in response.messages:
    if msg.message_type == "assistant_message":
        print(f"Assistant: {msg.content}\n")

# Send information about yourself
response = client.agents.messages.create(
    agent_id=agent.id, messages=[{"role": "user", "content": "My name is Cameron. Please store this information in your memory."}]
)

# Print out tool calls, arguments, and the assistant's response
for msg in response.messages:
    if msg.message_type == "assistant_message":
        print(f"Assistant: {msg.content}\n")
    if msg.message_type == "tool_call_message":
        print(f"Tool call: {msg.tool_call.name}({msg.tool_call.arguments})")

# Inspect memory
blocks = client.agents.blocks.list(agent_id=agent.id)
print("Current Memory:")
for block in blocks:
    print(f"  {block.label}: {len(block.value)}/{block.limit} chars")
    print(f"  {block.value}\n")

# Example of the human block after the conversation
# Name: Cameron
