# from letta_client import Letta
# from letta_client.types import StreamableHTTPServerConfig, MCPServerType

# client = Letta(token="LETTA_API_KEY")

# # Connect a Streamable HTTP server with Bearer token auth
# streamable_config = StreamableHTTPServerConfig(
#     server_name="my-server",
#     type=MCPServerType.STREAMABLE_HTTP,
#     server_url="https://mcp.deepwiki.com/mcp",
#     auth_header="Authorization",
#     auth_token="Bearer your-token",  # Include "Bearer " prefix
#     custom_headers={"X-API-Version": "v1"}  # Additional custom headers
# )

# client.tools.add_mcp_server(request=streamable_config)

# # Example with templated variables for agent-scoped authentication
# agent_scoped_config = StreamableHTTPServerConfig(
#     server_name="user-specific-server",
#     type=MCPServerType.STREAMABLE_HTTP,
#     server_url="https://api.example.com/mcp",
#     auth_header="Authorization",
#     auth_token="Bearer {{AGENT_API_KEY | api_key}}",  # Agent-specific API key
#     custom_headers={
#         "X-User-ID": "{{AGENT_API_KEY | user_id}}",  # Agent-specific user ID
#         "X-API-Version": "v2"
#     }
# )

# client.tools.add_mcp_server(request=agent_scoped_config)

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
import asyncio

client = Letta(base_url="http://localhost:8283")

# List tools from an MCP server
tools = client.tools.list_mcp_tools_by_server(mcp_server_name="deep_wiki_server")

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

# Add a specific tool from the MCP server
tool = client.tools.add_mcp_tool(
    mcp_server_name="deep_wiki_server",
    mcp_tool_name="read_wiki_structure",
    overridden_schema=new_input_schema,
)
pprint(tool.json_schema)

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
