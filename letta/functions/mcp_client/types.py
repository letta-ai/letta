import re
from abc import abstractmethod
from enum import Enum
from typing import Dict, List, Optional

from mcp import Tool
from pydantic import BaseModel, Field

from letta.utils import get_logger

# MCP Authentication Constants
MCP_AUTH_HEADER_AUTHORIZATION = "Authorization"
MCP_AUTH_TOKEN_BEARER_PREFIX = "Bearer"
TEMPLATED_VARIABLE_REGEX = (
    r"\{\{\s*([A-Z_][A-Z0-9_]*)\s*(?:\|\s*([^}]+?)\s*)?\}\}"  # Allows for optional whitespace around the variable name and default value
)

logger = get_logger(__name__)


class MCPToolHealth(BaseModel):
    """Health status for an MCP tool's schema."""

    # TODO: @jnjpng use the enum provided in schema_validator.py
    status: str = Field(..., description="Schema health status: STRICT_COMPLIANT, NON_STRICT_ONLY, or INVALID")
    reasons: List[str] = Field(default_factory=list, description="List of reasons for the health status")


class MCPTool(Tool):
    """A simple wrapper around MCP's tool definition (to avoid conflict with our own)"""

    # Optional health information added at runtime
    health: Optional[MCPToolHealth] = Field(None, description="Schema health status for OpenAI strict mode")


class MCPServerType(str, Enum):
    SSE = "sse"
    STDIO = "stdio"
    STREAMABLE_HTTP = "streamable_http"


class BaseServerConfig(BaseModel):
    server_name: str = Field(..., description="The name of the server")
    type: MCPServerType

    def is_templated_tool_variable(self, value: str) -> bool:
        """
        Check if string contains templated variables.

        Args:
            value: The value string to check

        Returns:
            True if the value contains templated variables in the format {{ VARIABLE_NAME }} or {{ VARIABLE_NAME | default }}, False otherwise
        """
        return bool(re.search(TEMPLATED_VARIABLE_REGEX, value))

    def get_tool_variable(self, value: str, environment_variables: Dict[str, str]) -> Optional[str]:
        """
        Replace templated variables in a value string with their values from environment variables.
        Supports fallback/default values with pipe syntax.

        Args:
            value: The value string that may contain templated variables (e.g., "Bearer {{ API_KEY | default_token }}")
            environment_variables: Dictionary of environment variables

        Returns:
            The string with templated variables replaced, or None if no templated variables found
        """

        # If no templated variables found or default value provided, return the original value
        if not self.is_templated_tool_variable(value):
            return value

        def replace_template(match):
            variable_name = match.group(1)
            default_value = match.group(2) if match.group(2) else None

            # Try to get the value from environment variables
            env_value = environment_variables.get(variable_name) if environment_variables else None

            # Return environment value if found, otherwise return default value, otherwise return empty string
            if env_value is not None:
                return env_value
            elif default_value is not None:
                return default_value
            else:
                # If no environment value and no default, return the original template
                return match.group(0)

        # Replace all templated variables in the token
        result = re.sub(TEMPLATED_VARIABLE_REGEX, replace_template, value)

        # If the result still contains unreplaced templates, just return original value
        if re.search(TEMPLATED_VARIABLE_REGEX, result):
            logger.warning(f"Unable to resolve templated variable in value: {value}")
            return value

        return result

    def resolve_custom_headers(
        self, custom_headers: Optional[Dict[str, str]], environment_variables: Optional[Dict[str, str]] = None
    ) -> Optional[Dict[str, str]]:
        """
        Resolve templated variables in custom headers dictionary.

        Args:
            custom_headers: Dictionary of custom headers that may contain templated variables
            environment_variables: Dictionary of environment variables for resolving templates

        Returns:
            Dictionary with resolved header values, or None if custom_headers is None
        """
        if custom_headers is None:
            return None

        resolved_headers = {}
        for key, value in custom_headers.items():
            # Resolve templated variables in each header value
            if self.is_templated_tool_variable(value):
                resolved_headers[key] = self.get_tool_variable(value, environment_variables)
            else:
                resolved_headers[key] = value

        return resolved_headers

    @abstractmethod
    def resolve_environment_variables(self, environment_variables: Optional[Dict[str, str]] = None) -> None:
        raise NotImplementedError


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
        """
        Extract token for storage if auth_header/auth_token are provided
        and not already in custom_headers.

        Returns:
            The resolved token (without Bearer prefix) if it should be stored separately, None otherwise
        """
        if self.auth_token and self.auth_header:
            # Check if custom_headers already has the auth header
            if not self.custom_headers or self.auth_header not in self.custom_headers:
                # Strip Bearer prefix if present
                if self.auth_token.startswith(f"{MCP_AUTH_TOKEN_BEARER_PREFIX} "):
                    return self.auth_token[len(f"{MCP_AUTH_TOKEN_BEARER_PREFIX} ") :]
                return self.auth_token
        return None

    def resolve_environment_variables(self, environment_variables: Optional[Dict[str, str]] = None) -> None:
        if self.auth_token and super().is_templated_tool_variable(self.auth_token):
            self.auth_token = super().get_tool_variable(self.auth_token, environment_variables)

        self.custom_headers = super().resolve_custom_headers(self.custom_headers, environment_variables)

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

    # TODO: @jnjpng templated auth handling for stdio
    def resolve_environment_variables(self, environment_variables: Optional[Dict[str, str]] = None) -> None:
        pass

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
        """
        Extract token for storage if auth_header/auth_token are provided
        and not already in custom_headers.

        Returns:
            The resolved token (without Bearer prefix) if it should be stored separately, None otherwise
        """
        if self.auth_token and self.auth_header:
            # Check if custom_headers already has the auth header
            if not self.custom_headers or self.auth_header not in self.custom_headers:
                # Strip Bearer prefix if present
                if self.auth_token.startswith(f"{MCP_AUTH_TOKEN_BEARER_PREFIX} "):
                    return self.auth_token[len(f"{MCP_AUTH_TOKEN_BEARER_PREFIX} ") :]
                return self.auth_token
        return None

    def resolve_environment_variables(self, environment_variables: Optional[Dict[str, str]] = None) -> None:
        if self.auth_token and super().is_templated_tool_variable(self.auth_token):
            self.auth_token = super().get_tool_variable(self.auth_token, environment_variables)

        self.custom_headers = super().resolve_custom_headers(self.custom_headers, environment_variables)

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
