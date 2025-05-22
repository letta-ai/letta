from letta_client import Letta, VoiceSleeptimeManagerUpdate

client = Letta(base_url="http://localhost:8283")

agent = client.agents.create(
    name="low_latency_voice_agent_demo",
    agent_type="voice_convo_agent",
    memory_blocks=[
        {"value": "Name: ?", "label": "human"},
        {"value": "You are a helpful assistant.", "label": "persona"},
    ],
    model="openai/gpt-4o-mini", # Use 4o-mini for speed
    embedding="openai/text-embedding-3-small",
    enable_sleeptime=True,
    initial_message_sequence = [],
)
print(f"Created agent id {agent.id}")

# get the group
group_id = agent.multi_agent_group.id
max_message_buffer_length = agent.multi_agent_group.max_message_buffer_length
min_message_buffer_length = agent.multi_agent_group.min_message_buffer_length
print(f"Group id: {group_id}, max_message_buffer_length: {max_message_buffer_length},  min_message_buffer_length: {min_message_buffer_length}")

# change it to be more frequent
group = client.groups.modify(
    group_id=group_id,
    manager_config=VoiceSleeptimeManagerUpdate(
            max_message_buffer_length=10,
            min_message_buffer_length=6,
    )
)
