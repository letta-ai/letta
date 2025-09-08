"""
Example of using composio tools in Letta

Make sure you set `COMPOSIO_API_KEY` environment variable or run `composio login` to authenticate with Composio.
"""

from composio import Action
from letta_client import Letta

client = Letta(base_url="http://localhost:8283")

# add a composio tool
tool = client.tools.add_composio_tool(composio_action_name=Action.GITHUB_STAR_A_REPOSITORY_FOR_THE_AUTHENTICATED_USER.name)

# create an agent with the tool
agent = client.agents.create(
    name="file_editing_agent",
    memory_blocks=[{"label": "persona", "value": "I am a helpful assistant"}],
    model="anthropic/claude-3-5-sonnet-20241022",
    embedding="openai/text-embedding-3-small",
    tool_ids=[tool.id],
)
print("Agent tools", [tool.name for tool in agent.tools])

# message the agent
response = client.agents.messages.create(
    agent_id=agent.id, messages=[{"role": "user", "content": "Star the github repo `letta` by `letta-ai`"}]
)
for message in response.messages:
    print(message)
