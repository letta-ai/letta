from letta_client import Letta
from pprint import pprint
from letta.agents.agent_loop import AgentLoop
from letta.agents.letta_agent_v2 import LettaAgentV2
from letta.schemas.message import Message, MessageCreate, MessageUpdate, MessageRole
from letta.schemas.letta_request import (
    LettaAsyncRequest,
    LettaRequest,
    LettaStreamingRequest,
)
from letta.functions.mcp_client.types import (
    MCPTool,
    SSEServerConfig,
    StdioServerConfig,
    StreamableHTTPServerConfig,
)
from letta.schemas.mcp import (
    UpdateSSEMCPServer,
    UpdateStdioMCPServer,
    UpdateStreamableHTTPMCPServer,
)

client = Letta(base_url="http://localhost:8283")
# # List tools from an MCP server
# tools = client.tools.list_mcp_tools_by_server(mcp_server_name="deep_wiki_server")
# print(tools[0])

list_tools= client.tools.list()
# # CASE 1: Tool already exists in Letta server and we just update schema
# # CASE 2: Tool doesn't exist in Letta server but exists in MCP server, BUT when we add from MCP to Letta, we want to override the schema of the MCP tool

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

# # Add a specific tool from the MCP server but override schema with the user provided one
# # CASE 2: Tool doesn't exist in Letta server but exists in MCP server, BUT when we add from MCP to Letta, we want to override the schema of the MCP tool
#override schema with new input

#add tool with normal schema
# tool = client.tools.add_mcp_tool(
#     mcp_server_name="deep_wiki_server",
#     mcp_tool_name="read_wiki_structure",
# )

# tools = client.tools.list()
# print(tools[0].json_schema)

#does an upsert
pprint(client.tools.list(name=))
tool_overridden = client.tools.add_mcp_tool_override(
    mcp_server_name="deep_wiki_server",
    mcp_tool_name="read_wiki_structure",
    overridden_schema=new_input_schema,
)
pprint(tool_overridden.json_schema)

# tool is edited on letta's server side but not on mcp server side
tools = client.tools.list()
rtools = client.tools.retrieve(tool_overridden.id)
pprint(tools[0].json_schema)
pprint(tools[0].id) #'tool-c24b425b-e9b4-4a9b-bfbd-1b86e40ea340'
pprint(rtools.json_schema)
pprint(rtools.id) # 'tool-af73ea02-15ba-475b-b317-0ed82af60aa5'
pprint(len(client.tools.list()))
# updated_tools = client.tools.list_mcp_tools_by_server(mcp_server_name="deep_wiki_server")
# pprint(updated_tools[0])

# BE CAREFUL HERE db backend is updated and letta mcp toolset is updated but need to update the mcp tool itself 
# response = client.tools.update_mcp_server(
#     mcp_server_name="deep_wiki_server",
#     request=UpdateStreamableHTTPMCPServer(
#         server_url='https://mcp.deepwiki.com/mcp'
#     ),
# )
#see tools in server now
# updated_tools = client.tools.list_mcp_tools_by_server(mcp_server_name="deep_wiki_server")
# pprint(updated_tools[0])

# updated_tools = client.tools.list_mcp_tools_by_server(mcp_server_name="deep_wiki_server")
# pprint(f"New Input Schema: {tools[0].input_schema}")
# pprint(type(tool))
# pprint(tool.json_schema)

# #Create agent with MCP tool attached
# agent_state = client.agents.list()[0]
# agent_loop = AgentLoop.load(agent_state=agent_state, actor="User")
# # response = agent_loop.build_request(
# #     input_messages=[message]
# # )

# message = MessageCreate(
#         role=MessageRole.user,
#         content="Use the read_wiki_structure_tool to analyze the directory structure of facebook/react"
#     )
# r = LettaRequest(
#     messages=[message]
# )
# pprint(f"Request type: {type(r)}")
# response = client.agents.messages.preview_raw_payload(
#     agent_id="agent-edfd4884-1c98-459a-abee-7996e0ae743c",
#     request=LettaRequest(
#             messages=[
#             MessageCreate(
#             role="user",
#             content="Use the read_wiki_structure_tool to analyze the directory structure of facebook/react",
#             )
#             ],
#             ),

# )
# pprint(response)

# # Or attach tools to an existing agent
# # client.agents.tools.attach(
# #     agent_id='agent-edfd4884-1c98-459a-abee-7996e0ae743c',
# #     tool_id=tool.id
# # )

# # #Use the agent with MCP tools
# # response = client.agents.messages.create(
# #     agent_id=agent_state.id,
# #     messages=[
# #         {
# #             "role": "user",
# #             "content": "Use the read_wiki_structure tool to check the repo structure of facebook/react"
# #         }
# #     ]
# # )
