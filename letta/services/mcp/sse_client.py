from mcp import ClientSession
from mcp.client.sse import sse_client

from letta.functions.mcp_client.types import SSEServerConfig
from letta.log import get_logger
from letta.services.mcp.base_client import AsyncBaseMCPClient

# see: https://modelcontextprotocol.io/quickstart/user
MCP_CONFIG_TOPLEVEL_KEY = "mcpServers"

logger = get_logger(__name__)


# TODO: Get rid of Async prefix on this class name once we deprecate old sync code
class AsyncSSEMCPClient(AsyncBaseMCPClient):
    async def _initialize_connection(self, server_config: SSEServerConfig) -> None:
        headers = {}
        if server_config.custom_headers:
            headers.update(server_config.custom_headers)

        if server_config.auth_header and server_config.auth_token:
            headers[server_config.auth_header] = server_config.auth_token

        sse_cm = sse_client(url=server_config.server_url, headers=headers if headers else None)
        sse_transport = await self.exit_stack.enter_async_context(sse_cm)
        self.stdio, self.write = sse_transport

        # Create and enter the ClientSession context manager
        session_cm = ClientSession(self.stdio, self.write)
        self.session = await self.exit_stack.enter_async_context(session_cm)
