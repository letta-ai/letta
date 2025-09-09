from letta_client import Letta

client = Letta(base_url="http://localhost:8283")


try:
    # create a supervisor agent
    supervisor_agent = client.agents.create(
        name="supervisor_agent",
        memory_blocks=[
            {"label": "persona", "value": "I am the supervisor, and I can communicate with worker agents with the tag `worker`"}
        ],
        model="anthropic/claude-3-5-sonnet-20241022",
        embedding="openai/text-embedding-3-small",
        tags=["supervisor"],
        tools=["send_message_to_agents_matching_all_tags"],
    )
    print(f"Created agent {supervisor_agent.name} with ID {supervisor_agent.id}")

    def get_name() -> str:
        """Get the name of the worker agent."""
        return "Bob"

    tool = client.tools.upsert_from_function(func=get_name)
    print(f"Created tool {tool.name} with ID {tool.id}")

    # create a worker agent
    worker_agent = client.agents.create(
        name="worker_agent",
        memory_blocks=[{"label": "persona", "value": f"I am the worker, my supervisor agent has ID {supervisor_agent.id}"}],
        model="anthropic/claude-3-5-sonnet-20241022",
        embedding="openai/text-embedding-3-small",
        tool_ids=[tool.id],
        tags=["worker"],
        tools=["send_message_to_agents_matching_all_tags"],
    )
    print(f"Created agent {worker_agent.name} with ID {worker_agent.id}")

    # send a message to the supervisor agent
    response = client.agents.messages.create(
        agent_id=worker_agent.id,
        messages=[{"role": "user", "content": "Ask the worker agents what their name is, then tell me with send_message"}],
    )
    print(response.messages)
    print(response.usage)
except Exception as e:
    print(e)

    # cleanup
    agents = client.agents.list(tags=["worker", "supervisor"])
    for agent in agents:
        client.agents.delete(agent.id)
        print(f"Deleted agent {agent.name} with ID {agent.id}")
