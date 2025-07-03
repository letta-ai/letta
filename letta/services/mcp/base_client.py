import asyncio
from contextlib import AsyncExitStack
from typing import Optional, Tuple

from mcp import ClientSession
from mcp import Tool as MCPTool
from mcp.types import TextContent

from letta.functions.mcp_client.types import BaseServerConfig
from letta.log import get_logger

logger = get_logger(__name__)


# TODO: Get rid of Async prefix on this class name once we deprecate old sync code
class AsyncBaseMCPClient:
    def __init__(self, server_config: BaseServerConfig):
        self.server_config = server_config
        self.exit_stack = AsyncExitStack()
        self.session: Optional[ClientSession] = None
        self.initialized = False
        # Track the task that created this client
        self._creation_task = asyncio.current_task()
        self._cleanup_queue = asyncio.Queue(maxsize=1)

    async def connect_to_server(self):
        try:
            await self._initialize_connection(self.server_config)
            await self.session.initialize()
            self.initialized = True
        except ConnectionError as e:
            logger.error(f"MCP connection failed: {str(e)}")
            raise e
        except Exception as e:
            logger.error(
                f"Connecting to MCP server failed. Please review your server config: {self.server_config.model_dump_json(indent=4)}. Error: {str(e)}"
            )
            if hasattr(self.server_config, "server_url") and self.server_config.server_url:
                server_info = f"server URL '{self.server_config.server_url}'"
            elif hasattr(self.server_config, "command") and self.server_config.command:
                server_info = f"command '{self.server_config.command}'"
            else:
                server_info = f"server '{self.server_config.server_name}'"
            raise ConnectionError(
                f"Failed to connect to MCP {server_info}. Please check your configuration and ensure the server is accessible."
            ) from e

    async def _initialize_connection(self, server_config: BaseServerConfig) -> None:
        raise NotImplementedError("Subclasses must implement _initialize_connection")

    async def list_tools(self) -> list[MCPTool]:
        self._check_initialized()
        response = await self.session.list_tools()
        return response.tools

    async def execute_tool(self, tool_name: str, tool_args: dict) -> Tuple[str, bool]:
        self._check_initialized()
        result = await self.session.call_tool(tool_name, tool_args)
        parsed_content = []
        for content_piece in result.content:
            if isinstance(content_piece, TextContent):
                parsed_content.append(content_piece.text)
                print("parsed_content (text)", parsed_content)
            else:
                parsed_content.append(str(content_piece))
                print("parsed_content (other)", parsed_content)
        if len(parsed_content) > 0:
            final_content = " ".join(parsed_content)
        else:
            # TODO move hardcoding to constants
            final_content = "Empty response from tool"

        return final_content, not result.isError

    def _check_initialized(self):
        if not self.initialized:
            logger.error("MCPClient has not been initialized")
            raise RuntimeError("MCPClient has not been initialized")

    # TODO: still hitting some async errors for voice agents, need to fix
    async def cleanup(self):
        """Clean up resources - ensure this runs in the same task"""
        if hasattr(self, "_cleanup_task"):
            # If we're in a different task, schedule cleanup in original task
            current_task = asyncio.current_task()
            if current_task != self._creation_task:
                # Create a future to signal completion
                cleanup_done = asyncio.Future()
                self._cleanup_queue.put_nowait((self.exit_stack, cleanup_done))
                await cleanup_done
                return

        # Normal cleanup
        await self.exit_stack.aclose()

    def to_sync_client(self):
        raise NotImplementedError("Subclasses must implement to_sync_client")

    async def __aenter__(self):
        """Enter the async context manager."""
        await self.connect_to_server()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Exit the async context manager."""
        await self.cleanup()
        return False  # Don't suppress exceptions
