from letta_client import Letta
from pprint import pprint

########################################
# Set Up (leave this portion Uncommented during testing in both the per tool and per agent scenarios)
'''
For testing/demonstrating MCP tool overrides for each case, simply comment out the version you don't want to test.
Leave the client and new_input_schema instantiations uncommented for ease of use.
'''
########################################
client = Letta(base_url="http://localhost:8283")
new_input_schema = {
    "$schema": "http://json-schema.org/draft-06/schema#",
    "additionalProperties": False,
    "properties": {
        "repoName": {
            "description": "GitHub repository: owner/repo " '(e.g. "letta/letta")',
            "type": "string",
        }
    },
    "required": ["repoName"],
    "type": "object",
}

########################################
# Per Tool MCP Schema Override
########################################

## Case 1: Overriding Schema for an Existing MCP Tool in Letta Server ###

# add MCP tool from MCP Server to Letta Server (default tool schema)
tool = client.tools.add_mcp_tool(
    mcp_server_name="deep_wiki_server",
    mcp_tool_name="read_wiki_structure",
)

#example of what schema looks like
print("Original Schema:")
pprint(tool.json_schema)

#now override schema with custom schema for MCP Tool
tool_overridden = client.tools.add_mcp_tool_override(
    mcp_server_name="deep_wiki_server",
    mcp_tool_name="read_wiki_structure",
    overridden_schema=new_input_schema,
)

print("Updated (overridden) Schema:")
pprint(tool_overridden.json_schema)

#validate that updated schema persisted
retrieve_updated_mcp_tool = client.tools.retrieve(tool_overridden.id)
print("Retrieved Updated Schema:")
pprint(retrieve_updated_mcp_tool.json_schema)
print("Did overridden schema persist:", retrieve_updated_mcp_tool.json_schema == tool_overridden.json_schema)

### Case 2: Adding a New MCP Tool with Overridden Schema to Letta Server ###

#can automatically add the new MCP tool and override the MCP tool schema in one shot
tool_overridden = client.tools.add_mcp_tool_override(
    mcp_server_name="deep_wiki_server",
    mcp_tool_name="read_wiki_structure",
    overridden_schema=new_input_schema,
)

print("Updated (overridden) Schema:")
pprint(tool_overridden.json_schema)

#validate that updated schema persisted
retrieve_updated_mcp_tool = client.tools.retrieve(tool_overridden.id)
print("Retrieved Updated Schema:")
pprint(retrieve_updated_mcp_tool.json_schema)
print("Did overridden schema persist:", retrieve_updated_mcp_tool.json_schema == tool_overridden.json_schema)


########################################
# Per Agent MCP Tool Schema Override
########################################

#add an MCP tool to the Letta Server
mcp_tool = client.tools.add_mcp_tool(
    mcp_server_name="deep_wiki_server",
    mcp_tool_name="read_wiki_structure",
)

#attach the MCP tool to the Agent
client.agents.tools.attach(
    agent_id="agent-735f2d68-b0a7-4eed-a3bd-75abc911f571",
    tool_id=f"{mcp_tool.id}"
)

print(f"Original Schema for {mcp_tool.name}: ")
pprint(mcp_tool.json_schema)

# override this MCP tool schema (updates core backend DB so other agents sharing this tool will also have the updated schema)
client.agents.tools.override_mcp_tool(
    agent_id="agent-735f2d68-b0a7-4eed-a3bd-75abc911f571",
    tool_id=f"{mcp_tool.id}",
    overridden_schema=new_input_schema
)

# grab the specific MCP tool who's schema was overridden
for t in client.agents.tools.list(agent_id='agent-735f2d68-b0a7-4eed-a3bd-75abc911f571'):
    if t.id == mcp_tool.id:
        inspect_tool = t
        break

print(f"Overridden Schema for {inspect_tool.name}: ")
pprint(inspect_tool.json_schema)