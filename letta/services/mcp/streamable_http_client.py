from typing import Optional

from mcp import ClientSession
from mcp.client.auth import OAuthClientProvider
from mcp.client.streamable_http import streamablehttp_client

from letta.functions.mcp_client.types import BaseServerConfig, StreamableHTTPServerConfig
from letta.log import get_logger
from letta.services.mcp.base_client import AsyncBaseMCPClient

logger = get_logger(__name__)


class AsyncStreamableHTTPMCPClient(AsyncBaseMCPClient):
    def __init__(
        self,
        server_config: StreamableHTTPServerConfig,
        oauth_provider: Optional[OAuthClientProvider] = None,
        agent_id: Optional[str] = None,
    ):
        super().__init__(server_config, oauth_provider, agent_id)

    async def _initialize_connection(self, server_config: BaseServerConfig) -> None:
        if not isinstance(server_config, StreamableHTTPServerConfig):
            raise ValueError("Expected StreamableHTTPServerConfig")
        try:
            # Prepare headers for authentication
            headers = {}
            if server_config.custom_headers:
                headers.update(server_config.custom_headers)

            # Add auth header if specified
            if server_config.auth_header and server_config.auth_token:
                headers[server_config.auth_header] = server_config.auth_token

            # Add agent ID header if provided
            if self.agent_id:
                headers[self.AGENT_ID_HEADER] = self.agent_id

            # Use OAuth provider if available, otherwise use regular headers
            if self.oauth_provider:
                streamable_http_cm = streamablehttp_client(
                    server_config.server_url, headers=headers if headers else None, auth=self.oauth_provider
                )
            else:
                # Use streamablehttp_client context manager with headers if provided
                if headers:
                    streamable_http_cm = streamablehttp_client(server_config.server_url, headers=headers)
                else:
                    streamable_http_cm = streamablehttp_client(server_config.server_url)

            read_stream, write_stream, _ = await self.exit_stack.enter_async_context(streamable_http_cm)

            # Create and enter the ClientSession context manager
            session_cm = ClientSession(read_stream, write_stream)
            self.session = await self.exit_stack.enter_async_context(session_cm)
        except Exception as e:
            # Provide more helpful error messages for specific error types
            if "404" in str(e) or "Not Found" in str(e):
                raise ConnectionError(
                    f"MCP server not found at URL: {server_config.server_url}. "
                    "Please verify the URL is correct and the server supports the MCP protocol."
                ) from e
            elif "Connection" in str(e) or "connect" in str(e).lower():
                raise ConnectionError(
                    f"Failed to connect to MCP server at: {server_config.server_url}. "
                    "Please check that the server is running and accessible."
                ) from e
            elif "JSON" in str(e) and "validation" in str(e):
                raise ConnectionError(
                    f"MCP server at {server_config.server_url} is not returning valid JSON-RPC responses. "
                    "The server may not be a proper MCP server or may be returning empty/invalid JSON. "
                    "Please verify this is an MCP-compatible server endpoint."
                ) from e
            else:
                # Re-raise other exceptions with additional context
                raise ConnectionError(f"Failed to initialize streamable HTTP connection to {server_config.server_url}: {str(e)}") from e
