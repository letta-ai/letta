from contextlib import AsyncExitStack

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
    async def _initialize_connection(self, exit_stack: AsyncExitStack[bool | None], server_config: SSEServerConfig) -> None:
        sse_cm = sse_client(url=server_config.server_url)
        sse_transport = await exit_stack.enter_async_context(sse_cm)
        self.stdio, self.write = sse_transport

        # Create and enter the ClientSession context manager
        session_cm = ClientSession(self.stdio, self.write)
        self.session = await exit_stack.enter_async_context(session_cm)
