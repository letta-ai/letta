from pprint import pprint

from letta_client import Letta

client = Letta(base_url="http://localhost:8283")

mcp_server_name = "everything"
mcp_tool_name = "echo"

mcp_tools = client.tools.list_mcp_tools_by_server(
    mcp_server_name=mcp_server_name,
)
for tool in mcp_tools:
    pprint(tool)

mcp_tool = client.tools.add_mcp_tool(
    mcp_server_name=mcp_server_name,
    mcp_tool_name=mcp_tool_name
)

agent = client.agents.create(
    memory_blocks=[
        {
            "value": "Name: Caren",
            "label": "human"
        }
    ],
    model="openai/gpt-4o-mini",
    embedding="openai/text-embedding-3-small",
    tool_ids=[mcp_tool.id]
)
print(f"Created agent id {agent.id}")

response = client.agents.messages.create(
    agent_id=agent.id,
    messages=[
        {
            "role": "user",
            "content": "Hello can you echo back this input?"
        },
    ],
)
for message in response.messages:
    print(message)
