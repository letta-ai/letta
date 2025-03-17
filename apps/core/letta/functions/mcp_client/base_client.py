import asyncio
from typing import List, Optional, Tuple

from mcp import ClientSession, Tool

from letta.functions.mcp_client.types import BaseServerConfig
from letta.log import get_logger
from letta.settings import tool_settings

logger = get_logger(__name__)


class BaseMCPClient:
    def __init__(self, server_config: BaseServerConfig):
        self.server_config = server_config
        self.session: Optional[ClientSession] = None
        self.stdio = None
        self.write = None
        self.initialized = False
        self.loop = asyncio.new_event_loop()
        self.cleanup_funcs = []

    def connect_to_server(self):
        asyncio.set_event_loop(self.loop)
        success = self._initialize_connection(self.server_config, timeout=tool_settings.mcp_connect_to_server_timeout)

        if success:
            try:
                self.loop.run_until_complete(
                    asyncio.wait_for(self.session.initialize(), timeout=tool_settings.mcp_connect_to_server_timeout)
                )
                self.initialized = True
            except asyncio.TimeoutError:
                raise RuntimeError(
                    f"Timed out while initializing session for MCP server {self.server_config.server_name} (timeout={tool_settings.mcp_connect_to_server_timeout}s)."
                )
        else:
            raise RuntimeError(
                f"Connecting to MCP server failed. Please review your server config: {self.server_config.model_dump_json(indent=4)}"
            )

    def _initialize_connection(self, server_config: BaseServerConfig, timeout: float) -> bool:
        raise NotImplementedError("Subclasses must implement _initialize_connection")

    def list_tools(self) -> List[Tool]:
        self._check_initialized()
        try:
            response = self.loop.run_until_complete(
                asyncio.wait_for(self.session.list_tools(), timeout=tool_settings.mcp_list_tools_timeout)
            )
            return response.tools
        except asyncio.TimeoutError:
            # Could log, throw a custom exception, etc.
            logger.error(
                f"Timed out while listing tools for MCP server {self.server_config.server_name} (timeout={tool_settings.mcp_list_tools_timeout}s)."
            )
            return []

    def execute_tool(self, tool_name: str, tool_args: dict) -> Tuple[str, bool]:
        self._check_initialized()
        try:
            result = self.loop.run_until_complete(
                asyncio.wait_for(self.session.call_tool(tool_name, tool_args), timeout=tool_settings.mcp_execute_tool_timeout)
            )
            return str(result.content), result.isError
        except asyncio.TimeoutError:
            logger.error(
                f"Timed out while executing tool '{tool_name}' for MCP server {self.server_config.server_name} (timeout={tool_settings.mcp_execute_tool_timeout}s)."
            )
            return "", True

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
