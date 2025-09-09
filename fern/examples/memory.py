from letta_client import Letta

client = Letta(base_url="http://localhost:8283")

agent = client.agents.create(
    name="memory_agent",
    memory_blocks=[
        {"label": "persona", "value": "I am a memory agent"},
        {"label": "human", "value": "Name: Bob", "limit": 10000},
    ],
    model="anthropic/claude-3-5-sonnet-20241022",
    embedding="openai/text-embedding-3-small",
    tags=["worker"],
)


# create a persisted block, which can be attached to agents
block = client.blocks.create(
    label="organization",
    value="Organization: Letta",
    limit=4000,
)

# create an agent with both a shared block and its own blocks
shared_block_agent = client.agents.create(
    name="shared_block_agent",
    memory_blocks=[block.id],
    model="anthropic/claude-3-5-sonnet-20241022",
    embedding="openai/text-embedding-3-small",
    tags=["worker"],
)

# list the agents blocks
blocks = client.agents.core_memory.list_blocks(shared_block_agent.id)
for block in blocks:
    print(block)

# update the block (via ID)
block = client.blocks.modify(block.id, limit=10000)

# update the block (via label)
block = client.agents.core_memory.modify_block(
    agent_id=shared_block_agent.id, block_label="organization", value="Organization: Letta", limit=10000
)
