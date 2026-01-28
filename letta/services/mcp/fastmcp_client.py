"""FastMCP-based MCP clients with server-side OAuth support.

This module provides MCP client implementations using the FastMCP library,
with support for server-side OAuth flows where authorization URLs are
forwarded to web clients instead of opening a browser.

These clients replace the existing AsyncSSEMCPClient and AsyncStreamableHTTPMCPClient
implementations that used the lower-level MCP SDK directly.
"""

from contextlib import AsyncExitStack
from typing import List, Optional, Tuple

import httpx
from fastmcp import Client
from fastmcp.client.transports import SSETransport, StreamableHttpTransport
from mcp import Tool as MCPTool

from letta.functions.mcp_client.types import SSEServerConfig, StreamableHTTPServerConfig
from letta.log import get_logger
from letta.services.mcp.server_side_oauth import ServerSideOAuth

logger = get_logger(__name__)


class AsyncFastMCPSSEClient:
    """SSE MCP client using FastMCP with server-side OAuth support.

    This client connects to MCP servers using Server-Sent Events (SSE) transport.
    It supports both authenticated and unauthenticated connections, with OAuth
    handled via the ServerSideOAuth class for server-side flows.

    Args:
        server_config: SSE server configuration including URL, headers, and auth settings
        oauth: Optional ServerSideOAuth instance for OAuth authentication
        agent_id: Optional agent ID to include in request headers
    """

    AGENT_ID_HEADER = "X-Agent-Id"

    def __init__(
        self,
        server_config: SSEServerConfig,
        oauth: Optional[ServerSideOAuth] = None,
        agent_id: Optional[str] = None,
    ):
        self.server_config = server_config
        self.oauth = oauth
        self.agent_id = agent_id
        self.client: Optional[Client] = None
        self.initialized = False
        self.exit_stack = AsyncExitStack()

    async def connect_to_server(self):
        """Establish connection to the MCP server.

        Raises:
            ConnectionError: If connection to the server fails
        """
        try:
            headers = {}
            if self.server_config.custom_headers:
                headers.update(self.server_config.custom_headers)
            if self.server_config.auth_header and self.server_config.auth_token:
                headers[self.server_config.auth_header] = self.server_config.auth_token
            if self.agent_id:
                headers[self.AGENT_ID_HEADER] = self.agent_id

            transport = SSETransport(
                url=self.server_config.server_url,
                headers=headers if headers else None,
                auth=self.oauth,  # Pass ServerSideOAuth instance (or None)
            )

            self.client = Client(transport)
            await self.client._connect()
            self.initialized = True
        except httpx.HTTPStatusError as e:
            # Re-raise HTTP status errors for OAuth flow handling
            if e.response.status_code == 401:
                raise ConnectionError("401 Unauthorized") from e
            raise ConnectionError(f"HTTP error connecting to MCP server at {self.server_config.server_url}: {e}") from e
        except ConnectionError:
            # Re-raise ConnectionError as-is
            raise
        except Exception as e:
            # MCP connection failures are often due to user misconfiguration, not system errors
            # Log as warning for visibility in monitoring
            logger.warning(
                f"Connecting to MCP server failed. Please review your server config: {self.server_config.model_dump_json(indent=4)}. Error: {str(e)}"
            )
            raise ConnectionError(
                f"Failed to connect to MCP server at '{self.server_config.server_url}'. "
                f"Please check your configuration and ensure the server is accessible. Error: {str(e)}"
            ) from e

    async def list_tools(self, serialize: bool = False) -> List[MCPTool]:
        """List available tools from the MCP server.

        Args:
            serialize: If True, return tools as dictionaries instead of MCPTool objects

        Returns:
            List of tools available on the server

        Raises:
            RuntimeError: If client has not been initialized
        """
        self._check_initialized()
        tools = await self.client.list_tools()
        if serialize:
            serializable_tools = []
            for tool in tools:
                if hasattr(tool, "model_dump"):
                    serializable_tools.append(tool.model_dump())
                elif hasattr(tool, "dict"):
                    serializable_tools.append(tool.dict())
                elif hasattr(tool, "__dict__"):
                    serializable_tools.append(tool.__dict__)
                else:
                    serializable_tools.append(str(tool))
            return serializable_tools
        return tools

    async def execute_tool(self, tool_name: str, tool_args: dict) -> Tuple[str, bool]:
        """Execute a tool on the MCP server.

        Args:
            tool_name: Name of the tool to execute
            tool_args: Arguments to pass to the tool

        Returns:
            Tuple of (result_content, success_flag)

        Raises:
            RuntimeError: If client has not been initialized
        """
        self._check_initialized()
        try:
            result = await self.client.call_tool(tool_name, tool_args)
        except Exception as e:
            # ToolError is raised by fastmcp for input validation errors (e.g., missing required properties)
            # McpError is raised for other MCP-related errors
            # Both are expected user-facing issues from external MCP servers
            # Log at debug level to avoid triggering production alerts for expected failures
            if e.__class__.__name__ in ("McpError", "ToolError"):
                logger.debug(f"MCP tool '{tool_name}' execution failed: {str(e)}")
            raise

        # Parse content from result
        parsed_content = []
        for content_piece in result.content:
            if hasattr(content_piece, "text"):
                parsed_content.append(content_piece.text)
                logger.debug(f"MCP tool result parsed content (text): {parsed_content}")
            else:
                parsed_content.append(str(content_piece))
                logger.debug(f"MCP tool result parsed content (other): {parsed_content}")

        if parsed_content:
            final_content = " ".join(parsed_content)
        else:
            final_content = "Empty response from tool"

        return final_content, not result.is_error

    def _check_initialized(self):
        """Check if the client has been initialized."""
        if not self.initialized:
            logger.error("MCPClient has not been initialized")
            raise RuntimeError("MCPClient has not been initialized")

    async def cleanup(self):
        """Clean up client resources."""
        if self.client:
            try:
                await self.client.close()
            except Exception as e:
                logger.warning(f"Error during FastMCP client cleanup: {e}")
        self.initialized = False


class AsyncFastMCPStreamableHTTPClient:
    """Streamable HTTP MCP client using FastMCP with server-side OAuth support.

    This client connects to MCP servers using Streamable HTTP transport.
    It supports both authenticated and unauthenticated connections, with OAuth
    handled via the ServerSideOAuth class for server-side flows.

    Args:
        server_config: Streamable HTTP server configuration
        oauth: Optional ServerSideOAuth instance for OAuth authentication
        agent_id: Optional agent ID to include in request headers
    """

    AGENT_ID_HEADER = "X-Agent-Id"

    def __init__(
        self,
        server_config: StreamableHTTPServerConfig,
        oauth: Optional[ServerSideOAuth] = None,
        agent_id: Optional[str] = None,
    ):
        self.server_config = server_config
        self.oauth = oauth
        self.agent_id = agent_id
        self.client: Optional[Client] = None
        self.initialized = False
        self.exit_stack = AsyncExitStack()

    async def connect_to_server(self):
        """Establish connection to the MCP server.

        Raises:
            ConnectionError: If connection to the server fails
        """
        try:
            headers = {}
            if self.server_config.custom_headers:
                headers.update(self.server_config.custom_headers)
            if self.server_config.auth_header and self.server_config.auth_token:
                headers[self.server_config.auth_header] = self.server_config.auth_token
            if self.agent_id:
                headers[self.AGENT_ID_HEADER] = self.agent_id

            transport = StreamableHttpTransport(
                url=self.server_config.server_url,
                headers=headers if headers else None,
                auth=self.oauth,  # Pass ServerSideOAuth instance (or None)
            )

            self.client = Client(transport)
            await self.client._connect()
            self.initialized = True
        except httpx.HTTPStatusError as e:
            # Re-raise HTTP status errors for OAuth flow handling
            if e.response.status_code == 401:
                raise ConnectionError("401 Unauthorized") from e
            raise ConnectionError(f"HTTP error connecting to MCP server at {self.server_config.server_url}: {e}") from e
        except ConnectionError:
            # Re-raise ConnectionError as-is
            raise
        except Exception as e:
            # MCP connection failures are often due to user misconfiguration, not system errors
            # Log as warning for visibility in monitoring
            logger.warning(
                f"Connecting to MCP server failed. Please review your server config: {self.server_config.model_dump_json(indent=4)}. Error: {str(e)}"
            )
            raise ConnectionError(
                f"Failed to connect to MCP server at '{self.server_config.server_url}'. "
                f"Please check your configuration and ensure the server is accessible. Error: {str(e)}"
            ) from e

    async def list_tools(self, serialize: bool = False) -> List[MCPTool]:
        """List available tools from the MCP server.

        Args:
            serialize: If True, return tools as dictionaries instead of MCPTool objects

        Returns:
            List of tools available on the server

        Raises:
            RuntimeError: If client has not been initialized
        """
        self._check_initialized()
        tools = await self.client.list_tools()
        if serialize:
            serializable_tools = []
            for tool in tools:
                if hasattr(tool, "model_dump"):
                    serializable_tools.append(tool.model_dump())
                elif hasattr(tool, "dict"):
                    serializable_tools.append(tool.dict())
                elif hasattr(tool, "__dict__"):
                    serializable_tools.append(tool.__dict__)
                else:
                    serializable_tools.append(str(tool))
            return serializable_tools
        return tools

    async def execute_tool(self, tool_name: str, tool_args: dict) -> Tuple[str, bool]:
        """Execute a tool on the MCP server.

        Args:
            tool_name: Name of the tool to execute
            tool_args: Arguments to pass to the tool

        Returns:
            Tuple of (result_content, success_flag)

        Raises:
            RuntimeError: If client has not been initialized
        """
        self._check_initialized()
        try:
            result = await self.client.call_tool(tool_name, tool_args)
        except Exception as e:
            # ToolError is raised by fastmcp for input validation errors (e.g., missing required properties)
            # McpError is raised for other MCP-related errors
            # Both are expected user-facing issues from external MCP servers
            # Log at debug level to avoid triggering production alerts for expected failures
            if e.__class__.__name__ in ("McpError", "ToolError"):
                logger.debug(f"MCP tool '{tool_name}' execution failed: {str(e)}")
            raise

        # Parse content from result
        parsed_content = []
        for content_piece in result.content:
            if hasattr(content_piece, "text"):
                parsed_content.append(content_piece.text)
                logger.debug(f"MCP tool result parsed content (text): {parsed_content}")
            else:
                parsed_content.append(str(content_piece))
                logger.debug(f"MCP tool result parsed content (other): {parsed_content}")

        if parsed_content:
            final_content = " ".join(parsed_content)
        else:
            final_content = "Empty response from tool"

        return final_content, not result.is_error

    def _check_initialized(self):
        """Check if the client has been initialized."""
        if not self.initialized:
            logger.error("MCPClient has not been initialized")
            raise RuntimeError("MCPClient has not been initialized")

    async def cleanup(self):
        """Clean up client resources."""
        if self.client:
            try:
                await self.client.close()
            except Exception as e:
                logger.warning(f"Error during FastMCP client cleanup: {e}")
        self.initialized = False
