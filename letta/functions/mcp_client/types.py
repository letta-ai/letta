from enum import Enum
from typing import List, Optional

from mcp import Tool
from pydantic import BaseModel, Field

# MCP Authentication Constants
MCP_AUTH_HEADER_AUTHORIZATION = "Authorization"
MCP_AUTH_TOKEN_BEARER_PREFIX = "Bearer"


class MCPTool(Tool):
    """A simple wrapper around MCP's tool definition (to avoid conflict with our own)"""


class MCPServerType(str, Enum):
    SSE = "sse"
    STDIO = "stdio"
    STREAMABLE_HTTP = "streamable_http"


class BaseServerConfig(BaseModel):
    server_name: str = Field(..., description="The name of the server")
    type: MCPServerType


class SSEServerConfig(BaseServerConfig):
    """
    Configuration for an MCP server using SSE

    Authentication can be provided in multiple ways:
    1. Using auth_header + auth_token: Will add a specific header with the token
       Example: auth_header="Authorization", auth_token="Bearer abc123"

    2. Using the custom_headers dict: For more complex authentication scenarios
       Example: custom_headers={"X-API-Key": "abc123", "X-Custom-Header": "value"}
    """

    type: MCPServerType = MCPServerType.SSE
    server_url: str = Field(..., description="The URL of the server (MCP SSE client will connect to this URL)")
    auth_header: Optional[str] = Field(None, description="The name of the authentication header (e.g., 'Authorization')")
    auth_token: Optional[str] = Field(None, description="The authentication token or API key value")
    custom_headers: Optional[dict[str, str]] = Field(None, description="Custom HTTP headers to include with SSE requests")

    def resolve_token(self) -> Optional[str]:
        if self.auth_token and self.auth_token.startswith(f"{MCP_AUTH_TOKEN_BEARER_PREFIX} "):
            return self.auth_token[len(f"{MCP_AUTH_TOKEN_BEARER_PREFIX} ") :]
        return self.auth_token

    def to_dict(self) -> dict:
        values = {
            "transport": "sse",
            "url": self.server_url,
        }

        # TODO: handle custom headers
        if self.custom_headers is not None or (self.auth_header is not None and self.auth_token is not None):
            headers = self.custom_headers.copy() if self.custom_headers else {}

            # Add auth header if specified
            if self.auth_header is not None and self.auth_token is not None:
                headers[self.auth_header] = self.auth_token

            values["headers"] = headers

        return values


class StdioServerConfig(BaseServerConfig):
    type: MCPServerType = MCPServerType.STDIO
    command: str = Field(..., description="The command to run (MCP 'local' client will run this command)")
    args: List[str] = Field(..., description="The arguments to pass to the command")
    env: Optional[dict[str, str]] = Field(None, description="Environment variables to set")

    def to_dict(self) -> dict:
        values = {
            "transport": "stdio",
            "command": self.command,
            "args": self.args,
        }
        if self.env is not None:
            values["env"] = self.env
        return values


class StreamableHTTPServerConfig(BaseServerConfig):
    """
    Configuration for an MCP server using Streamable HTTP

    Authentication can be provided in multiple ways:
    1. Using auth_header + auth_token: Will add a specific header with the token
       Example: auth_header="Authorization", auth_token="Bearer abc123"

    2. Using the custom_headers dict: For more complex authentication scenarios
       Example: custom_headers={"X-API-Key": "abc123", "X-Custom-Header": "value"}
    """

    type: MCPServerType = MCPServerType.STREAMABLE_HTTP
    server_url: str = Field(..., description="The URL path for the streamable HTTP server (e.g., 'example/mcp')")
    auth_header: Optional[str] = Field(None, description="The name of the authentication header (e.g., 'Authorization')")
    auth_token: Optional[str] = Field(None, description="The authentication token or API key value")
    custom_headers: Optional[dict[str, str]] = Field(None, description="Custom HTTP headers to include with streamable HTTP requests")

    def resolve_token(self) -> Optional[str]:
        if self.auth_token and self.auth_token.startswith(f"{MCP_AUTH_TOKEN_BEARER_PREFIX} "):
            return self.auth_token[len(f"{MCP_AUTH_TOKEN_BEARER_PREFIX} ") :]
        return self.auth_token

    def model_post_init(self, __context) -> None:
        """Validate the server URL format."""
        # Basic validation for streamable HTTP URLs
        if not self.server_url:
            raise ValueError("server_url cannot be empty")

        # For streamable HTTP, the URL should typically be a path or full URL
        # We'll be lenient and allow both formats
        if self.server_url.startswith("http://") or self.server_url.startswith("https://"):
            # Full URL format - this is what the user is trying
            pass
        elif "/" in self.server_url:
            # Path format like "example/mcp" - this is the typical format
            pass
        else:
            # Single word - might be valid but warn in logs
            pass

    def to_dict(self) -> dict:
        values = {
            "transport": "streamable_http",
            "url": self.server_url,
        }

        # Handle custom headers
        if self.custom_headers is not None or (self.auth_header is not None and self.auth_token is not None):
            headers = self.custom_headers.copy() if self.custom_headers else {}

            # Add auth header if specified
            if self.auth_header is not None and self.auth_token is not None:
                headers[self.auth_header] = self.auth_token

            values["headers"] = headers

        return values
