import asyncio
from typing import List, Optional, Tuple

from mcp import ClientSession, Tool

from letta.functions.mcp_client.types import BaseServerConfig
from letta.log import get_logger

logger = get_logger(__name__)


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
        success = self._initialize_connection(server_config)

        if success:
            self.loop.run_until_complete(self.session.initialize())
            self.initialized = True
        else:
            raise RuntimeError(
                f"Connecting to MCP server failed. Please review your server config: {server_config.model_dump_json(indent=4)}"
            )

    def _initialize_connection(self, server_config: BaseServerConfig) -> bool:
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
