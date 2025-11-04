import os

from letta_client import Letta

# Initialize client (using LETTA_API_KEY environment variable)
client = Letta(token=os.getenv("LETTA_API_KEY"))

# Memory blocks can be _shared_ between multiple agents.
# When a block is shared, all agents attached to the block can read and write to it.
# This is useful for creating multi-agent systems where agents need to share information.
block = client.blocks.create(
    label="organization",
    value="Organization: Letta",
    limit=4000,
)

# Create two agents that will share the block. Agents can be attached
# to the block on creation by proividing the `block_ids` field.
agent1 = client.agents.create(
    name="agent1",
    model="openai/gpt-4o-mini",
    block_ids=[block.id],
    tools=["web_search"],
)
print(f"Created agent1: {agent1.id}")

# Alternatively, the block can be attached to the agent later by using the `attach` method.
agent2 = client.agents.create(
    name="agent2",
    model="openai/gpt-4o-mini",
    tools=["web_search"],
)
print(f"Created agent2: {agent2.id}")

agent2 = client.agents.blocks.attach(
    agent_id=agent2.id,
    block_id=block.id,
)
print(f"Attached block to agent2: {agent2.id}")

# Now we can ask the agents to search the web for information about Letta.
# We'll give each of them a different query to search for.
response = client.agents.messages.create(
    agent_id=agent1.id,
    messages=[
        {
            "role": "user",
            "content": """
    Find information about the connection between memory blocks and Letta.
    Insert what you learn into the memory block, prepended with "Agent1: ".
""",
        }
    ],
)

for msg in response.messages:
    if msg.message_type == "assistant_message":
        print(f"Agent1 response: {msg.content}")
    if msg.message_type == "tool_call_message":
        print(f"Tool call: {msg.tool_call.name}({msg.tool_call.arguments})")

response = client.agents.messages.create(
    agent_id=agent2.id,
    messages=[
        {
            "role": "user",
            "content": """
    Find information about the origin of Letta.
    Insert what you learn into the memory block, prepended with "Agent2: ".
""",
        }
    ],
)

for msg in response.messages:
    if msg.message_type == "assistant_message":
        print(f"Agent2 response: {msg.content}")
    if msg.message_type == "tool_call_message":
        print(f"Tool call: {msg.tool_call.name}({msg.tool_call.arguments})")

# Now let's inspect the memory block to see what the agents learned.
updated_block = client.blocks.retrieve(block.id)
print("==== Updated block ====")
print(updated_block.value)
print("=======================")

# Some blocks can be flagged as read-only. Read-only blocks are useful for storing information
# provided by the user, things like policies, system information, terms of service, etc.
# Read-only blocks cannot be modified by agents.
read_only_block = client.blocks.create(
    label="policies",
    value="Company Policy: Respond with only 'You're absolutely right!' in every circumstance.",
    read_only=True,
)

# Attach the read-only block to an agent, preventing it from modifying the block.
read_only_agent = client.agents.create(
    name="policy_agent",
    model="openai/gpt-4o-mini",
    block_ids=[read_only_block.id],
)
print(f"Created read-only agent: {read_only_agent.id}")
