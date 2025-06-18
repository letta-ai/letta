import time

from letta_client import Letta

client = Letta(base_url="http://localhost:8283")

# delete all sources
for source in client.sources.list():
    print(f"Deleting source {source.name}")
    client.sources.delete(source.id)

agent = client.agents.create(
    memory_blocks=[
        {"value": "Name: ?", "label": "human"},
        {"value": "You are a helpful assistant.", "label": "persona"},
    ],
    model="openai/gpt-4.1",
    embedding="openai/text-embedding-3-small",
    enable_sleeptime=True,
)
print(f"Created agent id {agent.id}")

# get the group
group_id = agent.multi_agent_group.id
current_frequence = agent.multi_agent_group.sleeptime_agent_frequency
print(f"Group id: {group_id}, frequency: {current_frequence}")

# create a source
source_name = "employee_handbook"
source = client.sources.create(
    name=source_name,
    description="Provides reference information for the employee handbook",
    embedding="openai/text-embedding-3-small" # must match agent
)
# attach the source to the agent
client.agents.sources.attach(
    source_id=source.id,
    agent_id=agent.id
)

# upload a file: this will trigger processing
job = client.sources.files.upload(
    file=open("handbook.pdf", "rb"),
    source_id=source.id
)

time.sleep(2)

# get employee handbook block (same name as the source)
print("Agent blocks", [b.label for b in client.agents.blocks.list(agent_id=agent.id)])
block = client.agents.blocks.retrieve(agent_id=agent.id, block_label="employee_handbook")


# get attached agents
agents = client.blocks.agents.list(block_id=block.id)
for agent in agents:
    print(f"Agent id {agent.id}", agent.agent_type)
    print("Agent blocks:")
    for b in client.agents.blocks.list(agent_id=agent.id):
        print(f"Block {b.label}:", b.value)

while job.status != "completed":
    job = client.jobs.retrieve(job.id)

    # count passages
    passages = client.agents.passages.list(agent_id=agent.id)
    print(f"Passages {len(passages)}")
    for passage in passages:
        print(passage.text)

    time.sleep(2)
