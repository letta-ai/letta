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
tools = client.tools.list_mcp_tools_by_server(mcp_server_name="deep_wiki_server")

#override schema with new input
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

# Add a specific tool from the MCP server but override schema with the user provided one
# tool = client.tools.add_mcp_tool(
#     mcp_server_name="deep_wiki_server",
#     mcp_tool_name="read_wiki_structure",
#     overridden_schema=new_input_schema,
# )
pprint(tools[0])

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
