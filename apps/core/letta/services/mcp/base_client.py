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

    async def connect_to_server(self):
        try:
            await self._initialize_connection(self.server_config)
            await self.session.initialize()
            self.initialized = True
        except Exception as e:
            logger.error(
                f"Connecting to MCP server failed. Please review your server config: {self.server_config.model_dump_json(indent=4)}"
            )
            raise e

    async def _initialize_connection(self, exit_stack: AsyncExitStack[bool | None], server_config: BaseServerConfig) -> None:
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

        return final_content, result.isError

    def _check_initialized(self):
        if not self.initialized:
            logger.error("MCPClient has not been initialized")
            raise RuntimeError("MCPClient has not been initialized")

    async def cleanup(self):
        """Clean up resources"""
        await self.exit_stack.aclose()
