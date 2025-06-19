from letta_client import CreateBlock, Letta, MessageCreate

"""
Make sure you run the Letta server before running this example.
```
letta server
```
"""

client = Letta(base_url="http://localhost:8283")

# create a new agent
agent_state = client.agents.create(
    memory_blocks=[
        CreateBlock(
            label="human",
            value="Name: Sarah",
        ),
    ],
    # set automatic defaults for LLM/embedding config
    model="openai/gpt-4o-mini",
    embedding="openai/text-embedding-3-small",
)
print(f"Created agent with name {agent_state.name} and unique ID {agent_state.id}")

# Message an agent
response = client.agents.messages.create(
    agent_id=agent_state.id,
    messages=[
        MessageCreate(
            role="user",
            content="hello",
        )
    ],
)
print("Usage", response.usage)
print("Agent messages", response.messages)

# list all agents
agents = client.agents.list()

# get the agent by ID
agent_state = client.agents.retrieve(agent_id=agent_state.id)

# get the agent by name
agent_state = client.agents.list(name=agent_state.name)[0]

# delete an agent
client.agents.delete(agent_id=agent_state.id)
