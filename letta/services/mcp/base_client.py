from contextlib import AsyncExitStack
from typing import Optional, Tuple

from mcp import ClientSession, Tool as MCPTool
from mcp.client.auth import OAuthClientProvider
from mcp.types import TextContent

from letta.functions.mcp_client.types import BaseServerConfig
from letta.log import get_logger

logger = get_logger(__name__)


# TODO: Get rid of Async prefix on this class name once we deprecate old sync code
class AsyncBaseMCPClient:
    # HTTP headers
    AGENT_ID_HEADER = "X-Agent-Id"

    def __init__(
        self, server_config: BaseServerConfig, oauth_provider: Optional[OAuthClientProvider] = None, agent_id: Optional[str] = None
    ):
        self.server_config = server_config
        self.oauth_provider = oauth_provider
        self.agent_id = agent_id
        self.exit_stack = AsyncExitStack()
        self.session: Optional[ClientSession] = None
        self.initialized = False

    async def connect_to_server(self):
        try:
            await self._initialize_connection(self.server_config)
            await self.session.initialize()
            self.initialized = True
        except ConnectionError as e:
            # MCP connection failures are often due to user misconfiguration, not system errors
            # Log at debug level to avoid triggering Sentry alerts for expected configuration issues
            logger.debug(f"MCP connection failed: {str(e)}")
            raise e
        except Exception as e:
            # MCP connection failures are often due to user misconfiguration, not system errors
            # Log as warning for visibility in monitoring
            logger.warning(
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

    async def list_tools(self, serialize: bool = False) -> list[MCPTool]:
        self._check_initialized()
        response = await self.session.list_tools()
        if serialize:
            serializable_tools = []
            for tool in response.tools:
                if hasattr(tool, "model_dump"):
                    # Pydantic model - use model_dump
                    serializable_tools.append(tool.model_dump())
                elif hasattr(tool, "dict"):
                    # Older Pydantic model - use dict()
                    serializable_tools.append(tool.dict())
                elif hasattr(tool, "__dict__"):
                    # Regular object - use __dict__
                    serializable_tools.append(tool.__dict__)
                else:
                    # Fallback - convert to string
                    serializable_tools.append(str(tool))
            return serializable_tools
        return response.tools

    async def execute_tool(self, tool_name: str, tool_args: dict) -> Tuple[str, bool]:
        self._check_initialized()
        try:
            result = await self.session.call_tool(tool_name, tool_args)
        except Exception as e:
            if e.__class__.__name__ == "McpError":
                logger.warning(f"MCP tool '{tool_name}' execution failed: {str(e)}")
            raise

        parsed_content = []
        for content_piece in result.content:
            if isinstance(content_piece, TextContent):
                parsed_content.append(content_piece.text)
                logger.debug(f"MCP tool result parsed content (text): {parsed_content}")
            else:
                parsed_content.append(str(content_piece))
                logger.debug(f"MCP tool result parsed content (other): {parsed_content}")
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
        await self.exit_stack.aclose()

    def to_sync_client(self):
        raise NotImplementedError("Subclasses must implement to_sync_client")
