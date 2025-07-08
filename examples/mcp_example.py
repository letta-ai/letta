from pprint import pprint

from letta_client import Letta

# Connect to Letta server
client = Letta(base_url="http://localhost:8283")

# Use the "everything" mcp server:
# https://github.com/modelcontextprotocol/servers/tree/main/src/everything
mcp_server_name = "everything"
mcp_tool_name = "echo"

# List all McpTool belonging to the "everything" mcp server.
mcp_tools = client.tools.list_mcp_tools_by_server(
    mcp_server_name=mcp_server_name,
)

# We can see that "echo" is one of the tools, but it's not
# a letta tool that can be added to a client (it has no tool id).
for tool in mcp_tools:
    pprint(tool)

# Create a Tool (with a tool id) using the server and tool names.
mcp_tool = client.tools.add_mcp_tool(
    mcp_server_name=mcp_server_name,
    mcp_tool_name=mcp_tool_name
)

# Create an agent with the tool, using tool.id -- note that
# this is the ONLY tool in the agent, you typically want to
# also include the default tools.
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

# Ask the agent to call the tool.
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
