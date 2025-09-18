"""
This example shows how to create agents with tool rules, which restrict
what tool the agent can execute at a given step.

Note that by default, agents can execute any tool. As agents become more
powerful, they will not need as much guidance from the developer.

Last tested with letta-client version: 0.1.22
"""

from letta_client import ChildToolRule, InitToolRule, Letta, TerminalToolRule

client = Letta(base_url="http://localhost:8283")

# always search archival memory first
search_agent = client.agents.create(
    name="search_agent",
    memory_blocks=[],
    model="anthropic/claude-3-5-sonnet-20241022",
    embedding="openai/text-embedding-3-small",
    tags=["worker"],
    tool_rules=[
        InitToolRule(tool_name="archival_memory_search"),
        ChildToolRule(tool_name="archival_memory_search", children=["send_message"]),
        # TerminalToolRule(tool_name="send_message", type="TerminalToolRule"),
        TerminalToolRule(tool_name="send_message"),
    ],
)
response = client.agents.messages.create(
    agent_id=search_agent.id,
    messages=[{"role": "user", "content": "do something"}],
)
for message in response.messages:
    print(message)
