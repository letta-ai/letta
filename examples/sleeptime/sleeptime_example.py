from letta_client import Letta, SleeptimeManagerUpdate

client = Letta(base_url="http://localhost:8283")

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

group = client.groups.modify(
    group_id=group_id,
    manager_config=SleeptimeManagerUpdate(
        sleeptime_agent_frequency=1
    ),
)
print(f"Updated group id {group_id} with frequency {group.sleeptime_agent_frequency}")
print(f"Group members", group.agent_ids)
sleeptime_ids = [] 
for agent_id in group.agent_ids:
    if client.agents.retrieve(agent_id=agent_id).agent_type == "sleeptime_agent":
        sleeptime_ids.append(agent_id)
print(f"Sleeptime agent ids: {sleeptime_ids}")
sleeptime_agent_id = sleeptime_ids[0]

# check the frequency
agent = client.agents.retrieve(agent_id=agent.id)
print(f"Updated agent id {agent.id} with frequency {agent.multi_agent_group.sleeptime_agent_frequency}")


response = client.agents.messages.create(
    agent_id=agent.id,
    messages=[
        {"role": "user", "content": "Hello can you echo back this input?"},
    ],
)
response = client.agents.messages.create(
    agent_id=agent.id,
    messages=[
        {"role": "user", "content": "My name is sarah"},
    ],
)
for message in response.messages:
    print(message)

print("---------------- SLEEPTIME AGENT ----------------")
for message in client.agents.messages.list(agent_id=sleeptime_agent_id):
    print(message)

