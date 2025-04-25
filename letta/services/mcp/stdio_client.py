from contextlib import AsyncExitStack

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from letta.functions.mcp_client.types import StdioServerConfig
from letta.log import get_logger
from letta.services.mcp.base_client import AsyncBaseMCPClient

logger = get_logger(__name__)


# TODO: Get rid of Async prefix on this class name once we deprecate old sync code
class AsyncStdioMCPClient(AsyncBaseMCPClient):
    async def _initialize_connection(self, exit_stack: AsyncExitStack[bool | None], server_config: StdioServerConfig) -> None:
        server_params = StdioServerParameters(command=server_config.command, args=server_config.args)
        stdio_transport = await exit_stack.enter_async_context(stdio_client(server_params))
        self.stdio, self.write = stdio_transport
        self.session = await exit_stack.enter_async_context(ClientSession(self.stdio, self.write))
