from datetime import datetime
from typing import Any, Dict, Optional, Union

from pydantic import Field

from letta.functions.mcp_client.types import (
    MCP_AUTH_HEADER_AUTHORIZATION,
    MCP_AUTH_TOKEN_BEARER_PREFIX,
    MCPServerType,
    SSEServerConfig,
    StdioServerConfig,
    StreamableHTTPServerConfig,
)
from letta.orm.mcp_oauth import OAuthSessionStatus
from letta.schemas.letta_base import LettaBase


class BaseMCPServer(LettaBase):
    __id_prefix__ = "mcp_server"


class MCPServer(BaseMCPServer):
    id: str = BaseMCPServer.generate_id_field()
    server_type: MCPServerType = MCPServerType.STREAMABLE_HTTP
    server_name: str = Field(..., description="The name of the server")

    # sse / streamable http config
    server_url: Optional[str] = Field(None, description="The URL of the server (MCP SSE/Streamable HTTP client will connect to this URL)")
    token: Optional[str] = Field(None, description="The access token or API key for the MCP server (used for authentication)")
    custom_headers: Optional[Dict[str, str]] = Field(None, description="Custom authentication headers as key-value pairs")

    # stdio config
    stdio_config: Optional[StdioServerConfig] = Field(
        None, description="The configuration for the server (MCP 'local' client will run this command)"
    )

    organization_id: Optional[str] = Field(None, description="The unique identifier of the organization associated with the tool.")

    # metadata fields
    created_by_id: Optional[str] = Field(None, description="The id of the user that made this Tool.")
    last_updated_by_id: Optional[str] = Field(None, description="The id of the user that made this Tool.")
    metadata_: Optional[Dict[str, Any]] = Field(default_factory=dict, description="A dictionary of additional metadata for the tool.")

    def to_config(
        self,
        environment_variables: Optional[Dict[str, str]] = None,
        resolve_variables: bool = True,
    ) -> Union[SSEServerConfig, StdioServerConfig, StreamableHTTPServerConfig]:
        if self.server_type == MCPServerType.SSE:
            config = SSEServerConfig(
                server_name=self.server_name,
                server_url=self.server_url,
                auth_header=MCP_AUTH_HEADER_AUTHORIZATION if self.token and not self.custom_headers else None,
                auth_token=f"{MCP_AUTH_TOKEN_BEARER_PREFIX} {self.token}" if self.token and not self.custom_headers else None,
                custom_headers=self.custom_headers,
            )
            if resolve_variables:
                config.resolve_environment_variables(environment_variables)
            return config
        elif self.server_type == MCPServerType.STDIO:
            if self.stdio_config is None:
                raise ValueError("stdio_config is required for STDIO server type")
            if resolve_variables:
                self.stdio_config.resolve_environment_variables(environment_variables)
            return self.stdio_config
        elif self.server_type == MCPServerType.STREAMABLE_HTTP:
            if self.server_url is None:
                raise ValueError("server_url is required for STREAMABLE_HTTP server type")

            config = StreamableHTTPServerConfig(
                server_name=self.server_name,
                server_url=self.server_url,
                auth_header=MCP_AUTH_HEADER_AUTHORIZATION if self.token and not self.custom_headers else None,
                auth_token=f"{MCP_AUTH_TOKEN_BEARER_PREFIX} {self.token}" if self.token and not self.custom_headers else None,
                custom_headers=self.custom_headers,
            )
            if resolve_variables:
                config.resolve_environment_variables(environment_variables)
            return config
        else:
            raise ValueError(f"Unsupported server type: {self.server_type}")


class UpdateSSEMCPServer(LettaBase):
    """Update an SSE MCP server"""

    server_name: Optional[str] = Field(None, description="The name of the server")
    server_url: Optional[str] = Field(None, description="The URL of the server (MCP SSE client will connect to this URL)")
    token: Optional[str] = Field(None, description="The access token or API key for the MCP server (used for SSE authentication)")
    custom_headers: Optional[Dict[str, str]] = Field(None, description="Custom authentication headers as key-value pairs")


class UpdateStdioMCPServer(LettaBase):
    """Update a Stdio MCP server"""

    server_name: Optional[str] = Field(None, description="The name of the server")
    stdio_config: Optional[StdioServerConfig] = Field(
        None, description="The configuration for the server (MCP 'local' client will run this command)"
    )


class UpdateStreamableHTTPMCPServer(LettaBase):
    """Update a Streamable HTTP MCP server"""

    server_name: Optional[str] = Field(None, description="The name of the server")
    server_url: Optional[str] = Field(None, description="The URL path for the streamable HTTP server (e.g., 'example/mcp')")
    auth_header: Optional[str] = Field(None, description="The name of the authentication header (e.g., 'Authorization')")
    auth_token: Optional[str] = Field(None, description="The authentication token or API key value")
    custom_headers: Optional[Dict[str, str]] = Field(None, description="Custom authentication headers as key-value pairs")


UpdateMCPServer = Union[UpdateSSEMCPServer, UpdateStdioMCPServer, UpdateStreamableHTTPMCPServer]


# OAuth-related schemas
class BaseMCPOAuth(LettaBase):
    __id_prefix__ = "mcp-oauth"


class MCPOAuthSession(BaseMCPOAuth):
    """OAuth session for MCP server authentication."""

    id: str = BaseMCPOAuth.generate_id_field()
    state: str = Field(..., description="OAuth state parameter")
    server_id: Optional[str] = Field(None, description="MCP server ID")
    server_url: str = Field(..., description="MCP server URL")
    server_name: str = Field(..., description="MCP server display name")

    # User and organization context
    user_id: Optional[str] = Field(None, description="User ID associated with the session")
    organization_id: str = Field(..., description="Organization ID associated with the session")

    # OAuth flow data
    authorization_url: Optional[str] = Field(None, description="OAuth authorization URL")
    authorization_code: Optional[str] = Field(None, description="OAuth authorization code")

    # Token data
    access_token: Optional[str] = Field(None, description="OAuth access token")
    refresh_token: Optional[str] = Field(None, description="OAuth refresh token")
    token_type: str = Field(default="Bearer", description="Token type")
    expires_at: Optional[datetime] = Field(None, description="Token expiry time")
    scope: Optional[str] = Field(None, description="OAuth scope")

    # Client configuration
    client_id: Optional[str] = Field(None, description="OAuth client ID")
    client_secret: Optional[str] = Field(None, description="OAuth client secret")
    redirect_uri: Optional[str] = Field(None, description="OAuth redirect URI")

    # Session state
    status: OAuthSessionStatus = Field(default=OAuthSessionStatus.PENDING, description="Session status")

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.now, description="Session creation time")
    updated_at: datetime = Field(default_factory=datetime.now, description="Last update time")


class MCPOAuthSessionCreate(BaseMCPOAuth):
    """Create a new OAuth session."""

    server_url: str = Field(..., description="MCP server URL")
    server_name: str = Field(..., description="MCP server display name")
    user_id: Optional[str] = Field(None, description="User ID associated with the session")
    organization_id: str = Field(..., description="Organization ID associated with the session")
    state: Optional[str] = Field(None, description="OAuth state parameter")


class MCPOAuthSessionUpdate(BaseMCPOAuth):
    """Update an existing OAuth session."""

    authorization_url: Optional[str] = Field(None, description="OAuth authorization URL")
    authorization_code: Optional[str] = Field(None, description="OAuth authorization code")
    access_token: Optional[str] = Field(None, description="OAuth access token")
    refresh_token: Optional[str] = Field(None, description="OAuth refresh token")
    token_type: Optional[str] = Field(None, description="Token type")
    expires_at: Optional[datetime] = Field(None, description="Token expiry time")
    scope: Optional[str] = Field(None, description="OAuth scope")
    client_id: Optional[str] = Field(None, description="OAuth client ID")
    client_secret: Optional[str] = Field(None, description="OAuth client secret")
    redirect_uri: Optional[str] = Field(None, description="OAuth redirect URI")
    status: Optional[OAuthSessionStatus] = Field(None, description="Session status")
