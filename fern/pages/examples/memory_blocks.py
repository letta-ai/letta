import os

from letta_client import Letta

# Initialize client (using LETTA_API_KEY environment variable)
client = Letta(token=os.getenv("LETTA_API_KEY"))

# Create agent
agent = client.agents.create(
    name="hello_world_assistant",
    model="openai/gpt-4o-mini",
)

print(f"Created agent: {agent.id}\n")

# Create memory block storing information about Letta.
block = client.blocks.create(
    label="organization",
    value="""
Organization: Letta
Website: https://www.letta.com
Description: Letta is a platform for building and running stateful agents.
Code: TimberTheDog1234!

When users provide a code, you should check if it matches the code you have
available. If it matches, you should respond with "Access granted".
""",
)

# Attach memory block to agent
agent = client.agents.blocks.attach(
    agent_id=agent.id,
    block_id=block.id,
)

# The agent can now see what's in the block, let's ask it about Letta.
response = client.agents.messages.create(
    agent_id=agent.id,
    messages=[{"role": "user", "content": "What is Letta?"}],
)
print(f"Agent response: {response.messages[0].content}\n")

# Agent response: Letta is a platform designed for building and running stateful agents. You can find more information about it on their website: [https://www.letta.com](https://www.letta.com).

# Blocks can also be _detached_ from an agent, removing it from the agent's context window.
# Detached blocks are not deleted, and can be re-attached to an agent later.
agent = client.agents.blocks.detach(
    agent_id=agent.id,
    block_id=block.id,
)
print(f"Detached block from agent: {agent.id}")
print(f"Block: {block.id}")

# Let's ask for the password. It should not have access to this password anymore,
# as we've detached the block.
response = client.agents.messages.create(
    agent_id=agent.id,
    messages=[{"role": "user", "content": "The code is TimberTheDog1234!"}],
)
print(f"Agent response: {response.messages[0].content}")

# The agent doesn't have any access to the code or password, so it can't respond:
# Agent response: It seems like you've provided a code or password. If this is sensitive information, please ensure you only share it with trusted parties and in secure environments. Let me know how I can assist you further!

# Attach the block back to the agent and ask again.
agent = client.agents.blocks.attach(
    agent_id=agent.id,
    block_id=block.id,
)
response = client.agents.messages.create(
    agent_id=agent.id,
    messages=[{"role": "user", "content": "The code is TimberTheDog1234!"}],
)
print(f"Agent response: {response.messages[0].content}")

# The agent now has access to the code and password, so it can respond:
# Agent response: Access granted. How can I assist you further?
