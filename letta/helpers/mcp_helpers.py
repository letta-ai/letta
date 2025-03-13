import asyncio
from enum import Enum
from typing import List, Optional, Tuple

from mcp import ClientSession, StdioServerParameters, Tool
from mcp.client.sse import sse_client
from mcp.client.stdio import stdio_client
from pydantic import BaseModel, Field

from letta.log import get_logger

logger = get_logger(__name__)


class MCPTool(Tool):
    """A simple wrapper around MCP's tool definition (to avoid conflict with our own)"""


class MCPServerType(str, Enum):
    SSE = "sse"
    LOCAL = "local"


class BaseServerConfig(BaseModel):
    server_name: str = Field(..., description="The name of the server")
    type: MCPServerType


class SSEServerConfig(BaseServerConfig):
    type: MCPServerType = MCPServerType.SSE
    server_url: str = Field(..., description="The URL of the server (MCP SSE client will connect to this URL)")


class LocalServerConfig(BaseServerConfig):
    type: MCPServerType = MCPServerType.LOCAL
    command: str = Field(..., description="The command to run (MCP 'local' client will run this command)")
    args: List[str] = Field(..., description="The arguments to pass to the command")


class BaseMCPClient:
    def __init__(self):
        self.session: Optional[ClientSession] = None
        self.stdio = None
        self.write = None
        self.initialized = False
        self.loop = asyncio.new_event_loop()
        self.cleanup_funcs = []

    def connect_to_server(self, server_config: BaseServerConfig):
        asyncio.set_event_loop(self.loop)
        self._initialize_connection(server_config)
        self.loop.run_until_complete(self.session.initialize())
        self.initialized = True

    def _initialize_connection(self, server_config: BaseServerConfig):
        raise NotImplementedError("Subclasses must implement _initialize_connection")

    def list_tools(self) -> List[Tool]:
        self._check_initialized()
        response = self.loop.run_until_complete(self.session.list_tools())
        return response.tools

    def execute_tool(self, tool_name: str, tool_args: dict) -> Tuple[str, bool]:
        self._check_initialized()
        result = self.loop.run_until_complete(self.session.call_tool(tool_name, tool_args))
        return str(result.content), result.isError

    def _check_initialized(self):
        if not self.initialized:
            logger.error("MCPClient has not been initialized")
            raise RuntimeError("MCPClient has not been initialized")

    def cleanup(self):
        try:
            for cleanup_func in self.cleanup_funcs:
                cleanup_func()
            self.initialized = False
            if not self.loop.is_closed():
                self.loop.close()
        except Exception as e:
            logger.warning(e)
        finally:
            logger.info("Cleaned up MCP clients on shutdown.")


class LocalMCPClient(BaseMCPClient):
    def _initialize_connection(self, server_config: LocalServerConfig):
        server_params = StdioServerParameters(command=server_config.command, args=server_config.args)
        stdio_cm = stdio_client(server_params)
        stdio_transport = self.loop.run_until_complete(stdio_cm.__aenter__())
        self.stdio, self.write = stdio_transport
        self.cleanup_funcs.append(lambda: self.loop.run_until_complete(stdio_cm.__aexit__(None, None, None)))

        session_cm = ClientSession(self.stdio, self.write)
        self.session = self.loop.run_until_complete(session_cm.__aenter__())
        self.cleanup_funcs.append(lambda: self.loop.run_until_complete(session_cm.__aexit__(None, None, None)))


class SSEMCPClient(BaseMCPClient):
    def _initialize_connection(self, server_config: SSEServerConfig):
        sse_cm = sse_client(url=server_config.server_url)
        sse_transport = self.loop.run_until_complete(sse_cm.__aenter__())
        self.stdio, self.write = sse_transport
        self.cleanup_funcs.append(lambda: self.loop.run_until_complete(sse_cm.__aexit__(None, None, None)))

        session_cm = ClientSession(self.stdio, self.write)
        self.session = self.loop.run_until_complete(session_cm.__aenter__())
        self.cleanup_funcs.append(lambda: self.loop.run_until_complete(session_cm.__aexit__(None, None, None)))
