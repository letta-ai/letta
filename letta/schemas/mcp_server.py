import json
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

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
from letta.schemas.enums import PrimitiveType
from letta.schemas.letta_base import LettaBase
from letta.schemas.secret import Secret


class BaseMCPServer(LettaBase):
    __id_prefix__ = PrimitiveType.MCP_SERVER.value


# Create Schemas (for POST requests)
class CreateStdioMCPServer(StdioServerConfig):
    """Create a new Stdio MCP server"""


class CreateSSEMCPServer(SSEServerConfig):
    """Create a new SSE MCP server"""


class CreateStreamableHTTPMCPServer(StreamableHTTPServerConfig):
    """Create a new Streamable HTTP MCP server"""


CreateMCPServerUnion = Union[CreateStdioMCPServer, CreateSSEMCPServer, CreateStreamableHTTPMCPServer]


class StdioMCPServer(CreateStdioMCPServer):
    """A Stdio MCP server"""

    id: str = BaseMCPServer.generate_id_field()
    type: MCPServerType = MCPServerType.STDIO


class SSEMCPServer(CreateSSEMCPServer):
    """An SSE MCP server"""

    id: str = BaseMCPServer.generate_id_field()
    type: MCPServerType = MCPServerType.SSE


class StreamableHTTPMCPServer(CreateStreamableHTTPMCPServer):
    """A Streamable HTTP MCP server"""

    id: str = BaseMCPServer.generate_id_field()
    type: MCPServerType = MCPServerType.STREAMABLE_HTTP


MCPServerUnion = Union[StdioMCPServer, SSEMCPServer, StreamableHTTPMCPServer]


# Update Schemas (for PATCH requests) - same shape as Create/Config, but all fields optional.
# We exclude fields that aren't persisted on the server model to avoid invalid ORM assignments.
class UpdateStdioMCPServer(LettaBase):
    """Update schema for Stdio MCP server - all fields optional"""

    server_name: Optional[str] = Field(None, description="The name of the MCP server")
    command: Optional[str] = Field(None, description="The command to run the MCP server")
    args: Optional[List[str]] = Field(None, description="The arguments to pass to the command")
    env: Optional[Dict[str, str]] = Field(None, description="Environment variables to set")


class UpdateSSEMCPServer(LettaBase):
    """Update schema for SSE MCP server - all fields optional"""

    server_name: Optional[str] = Field(None, description="The name of the MCP server")
    server_url: Optional[str] = Field(None, description="The URL of the SSE MCP server")
    # Accept both `auth_token` (API surface) and `token` (internal ORM naming)
    auth_token: Optional[str] = Field(None, description="The authentication token or API key value")
    token: Optional[str] = Field(None, description="The authentication token (internal)")
    auth_header: Optional[str] = Field(None, description="The name of the authentication header (e.g., 'Authorization')")
    custom_headers: Optional[Dict[str, str]] = Field(None, description="Custom headers to send with requests")


class UpdateStreamableHTTPMCPServer(LettaBase):
    """Update schema for Streamable HTTP MCP server - all fields optional"""

    server_name: Optional[str] = Field(None, description="The name of the MCP server")
    server_url: Optional[str] = Field(None, description="The URL of the Streamable HTTP MCP server")
    # Accept both `auth_token` (API surface) and `token` (internal ORM naming)
    auth_token: Optional[str] = Field(None, description="The authentication token or API key value")
    token: Optional[str] = Field(None, description="The authentication token (internal)")
    auth_header: Optional[str] = Field(None, description="The name of the authentication header (e.g., 'Authorization')")
    custom_headers: Optional[Dict[str, str]] = Field(None, description="Custom headers to send with requests")


UpdateMCPServerUnion = Union[UpdateStdioMCPServer, UpdateSSEMCPServer, UpdateStreamableHTTPMCPServer]


# OAuth-related schemas
class BaseMCPOAuth(LettaBase):
    __id_prefix__ = PrimitiveType.MCP_OAUTH.value


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

    # Encrypted authorization code (for internal use)
    authorization_code_enc: Secret | None = Field(None, description="Encrypted OAuth authorization code as Secret object")

    # Token data
    access_token: Optional[str] = Field(None, description="OAuth access token")
    refresh_token: Optional[str] = Field(None, description="OAuth refresh token")
    token_type: str = Field(default="Bearer", description="Token type")
    expires_at: Optional[datetime] = Field(None, description="Token expiry time")
    scope: Optional[str] = Field(None, description="OAuth scope")

    # Encrypted token fields (for internal use)
    access_token_enc: Secret | None = Field(None, description="Encrypted OAuth access token as Secret object")
    refresh_token_enc: Secret | None = Field(None, description="Encrypted OAuth refresh token as Secret object")

    # Client configuration
    client_id: Optional[str] = Field(None, description="OAuth client ID")
    client_secret: Optional[str] = Field(None, description="OAuth client secret")
    redirect_uri: Optional[str] = Field(None, description="OAuth redirect URI")

    # Encrypted client secret (for internal use)
    client_secret_enc: Secret | None = Field(None, description="Encrypted OAuth client secret as Secret object")

    # Session state
    status: OAuthSessionStatus = Field(default=OAuthSessionStatus.PENDING, description="Session status")

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.now, description="Session creation time")
    updated_at: datetime = Field(default_factory=datetime.now, description="Last update time")

    def get_access_token_secret(self) -> Secret:
        """Get the access token as a Secret object, preferring encrypted over plaintext."""
        if self.access_token_enc is not None:
            return self.access_token_enc
        return Secret.from_db(None, self.access_token)

    def get_refresh_token_secret(self) -> Secret:
        """Get the refresh token as a Secret object, preferring encrypted over plaintext."""
        if self.refresh_token_enc is not None:
            return self.refresh_token_enc
        return Secret.from_db(None, self.refresh_token)

    def get_client_secret_secret(self) -> Secret:
        """Get the client secret as a Secret object, preferring encrypted over plaintext."""
        if self.client_secret_enc is not None:
            return self.client_secret_enc
        return Secret.from_db(None, self.client_secret)

    def get_authorization_code_secret(self) -> Secret:
        """Get the authorization code as a Secret object, preferring encrypted over plaintext."""
        if self.authorization_code_enc is not None:
            return self.authorization_code_enc
        return Secret.from_db(None, self.authorization_code)

    def set_access_token_secret(self, secret: Secret) -> None:
        """Set access token from a Secret object."""
        self.access_token_enc = secret
        secret_dict = secret.to_dict()
        if not secret.was_encrypted:
            self.access_token = secret_dict["plaintext"]
        else:
            self.access_token = None

    def set_refresh_token_secret(self, secret: Secret) -> None:
        """Set refresh token from a Secret object."""
        self.refresh_token_enc = secret
        secret_dict = secret.to_dict()
        if not secret.was_encrypted:
            self.refresh_token = secret_dict["plaintext"]
        else:
            self.refresh_token = None

    def set_client_secret_secret(self, secret: Secret) -> None:
        """Set client secret from a Secret object."""
        self.client_secret_enc = secret
        secret_dict = secret.to_dict()
        if not secret.was_encrypted:
            self.client_secret = secret_dict["plaintext"]
        else:
            self.client_secret = None

    def set_authorization_code_secret(self, secret: Secret) -> None:
        """Set authorization code from a Secret object."""
        self.authorization_code_enc = secret
        secret_dict = secret.to_dict()
        if not secret.was_encrypted:
            self.authorization_code = secret_dict["plaintext"]
        else:
            self.authorization_code = None


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


class MCPServerResyncResult(LettaBase):
    """Result of resyncing MCP server tools."""

    deleted: List[str] = Field(default_factory=list, description="List of deleted tool names")
    updated: List[str] = Field(default_factory=list, description="List of updated tool names")
    added: List[str] = Field(default_factory=list, description="List of added tool names")


class MCPToolExecuteRequest(LettaBase):
    """Request to execute an MCP tool by IDs."""

    args: Dict[str, Any] = Field(default_factory=dict, description="Arguments to pass to the MCP tool")


def convert_generic_to_union(server) -> MCPServerUnion:
    """
    Convert a generic MCPServer (from letta.schemas.mcp) to the appropriate MCPServerUnion type
    based on the server_type field.

    This is used to convert internal MCPServer representations to the API response types.

    Args:
        server: A GenericMCPServer instance from letta.schemas.mcp

    Returns:
        The appropriate MCPServerUnion type (StdioMCPServer, SSEMCPServer, or StreamableHTTPMCPServer)
    """
    # Import here to avoid circular dependency
    from letta.schemas.mcp import MCPServer as GenericMCPServer

    if not isinstance(server, GenericMCPServer):
        raise TypeError(f"Expected GenericMCPServer, got {type(server)}")

    if server.server_type == MCPServerType.STDIO:
        return StdioMCPServer(
            id=server.id,
            server_name=server.server_name,
            type=MCPServerType.STDIO,
            command=server.stdio_config.command if server.stdio_config else None,
            args=server.stdio_config.args if server.stdio_config else None,
            env=server.stdio_config.env if server.stdio_config else None,
        )
    elif server.server_type == MCPServerType.SSE:
        return SSEMCPServer(
            id=server.id,
            server_name=server.server_name,
            type=MCPServerType.SSE,
            server_url=server.server_url,
            auth_header="Authorization" if server.token else None,
            auth_token=f"Bearer {server.token}" if server.token else None,
            custom_headers=server.custom_headers,
        )
    elif server.server_type == MCPServerType.STREAMABLE_HTTP:
        return StreamableHTTPMCPServer(
            id=server.id,
            server_name=server.server_name,
            type=MCPServerType.STREAMABLE_HTTP,
            server_url=server.server_url,
            auth_header="Authorization" if server.token else None,
            auth_token=f"Bearer {server.token}" if server.token else None,
            custom_headers=server.custom_headers,
        )
    else:
        raise ValueError(f"Unknown server type: {server.server_type}")


def convert_update_to_internal(request: Union[UpdateStdioMCPServer, UpdateSSEMCPServer, UpdateStreamableHTTPMCPServer]):
    """Convert external API update models to internal UpdateMCPServer union used by the manager.

    - Flattens stdio fields into StdioServerConfig inside UpdateStdioMCPServer
    - Maps `auth_token` to `token` for HTTP-based transports
    - Ignores `auth_header` at update time (header is derived from token)
    """
    # Local import to avoid circulars
    from letta.functions.mcp_client.types import MCPServerType as MCPType, StdioServerConfig as StdioCfg
    from letta.schemas.mcp import (
        UpdateSSEMCPServer as InternalUpdateSSE,
        UpdateStdioMCPServer as InternalUpdateStdio,
        UpdateStreamableHTTPMCPServer as InternalUpdateHTTP,
    )

    if isinstance(request, UpdateStdioMCPServer):
        stdio_cfg = None
        # Only build stdio_config if command and args are explicitly provided to avoid overwriting existing config
        if request.command is not None and request.args is not None:
            stdio_cfg = StdioCfg(
                server_name=request.server_name or "",
                type=MCPType.STDIO,
                command=request.command,
                args=request.args,
                env=request.env,
            )
        kwargs: dict = {}
        if request.server_name is not None:
            kwargs["server_name"] = request.server_name
        if stdio_cfg is not None:
            kwargs["stdio_config"] = stdio_cfg
        return InternalUpdateStdio(**kwargs)
    elif isinstance(request, UpdateSSEMCPServer):
        token_value = request.auth_token or request.token
        return InternalUpdateSSE(
            server_name=request.server_name, server_url=request.server_url, token=token_value, custom_headers=request.custom_headers
        )
    elif isinstance(request, UpdateStreamableHTTPMCPServer):
        token_value = request.auth_token or request.token
        return InternalUpdateHTTP(
            server_name=request.server_name, server_url=request.server_url, auth_token=token_value, custom_headers=request.custom_headers
        )
    else:
        raise TypeError(f"Unsupported update request type: {type(request)}")
