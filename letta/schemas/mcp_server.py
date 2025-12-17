import json
from datetime import datetime
from typing import Annotated, Any, Dict, List, Literal, Optional, Union

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
class CreateStdioMCPServer(LettaBase):
    """Create a new Stdio MCP server"""

    mcp_server_type: Literal[MCPServerType.STDIO] = MCPServerType.STDIO
    command: str = Field(..., description="The command to run (MCP 'local' client will run this command)")
    args: List[str] = Field(..., description="The arguments to pass to the command")
    env: Optional[dict[str, str]] = Field(None, description="Environment variables to set")


class CreateSSEMCPServer(LettaBase):
    """Create a new SSE MCP server"""

    mcp_server_type: Literal[MCPServerType.SSE] = MCPServerType.SSE
    server_url: str = Field(..., description="The URL of the server")
    auth_header: Optional[str] = Field(None, description="The name of the authentication header (e.g., 'Authorization')")
    auth_token: Optional[str] = Field(None, description="The authentication token or API key value")
    custom_headers: Optional[dict[str, str]] = Field(None, description="Custom HTTP headers to include with requests")


class CreateStreamableHTTPMCPServer(LettaBase):
    """Create a new Streamable HTTP MCP server"""

    mcp_server_type: Literal[MCPServerType.STREAMABLE_HTTP] = MCPServerType.STREAMABLE_HTTP
    server_url: str = Field(..., description="The URL of the server")
    auth_header: Optional[str] = Field(None, description="The name of the authentication header (e.g., 'Authorization')")
    auth_token: Optional[str] = Field(None, description="The authentication token or API key value")
    custom_headers: Optional[dict[str, str]] = Field(None, description="Custom HTTP headers to include with requests")


CreateMCPServerUnion = Union[CreateStdioMCPServer, CreateSSEMCPServer, CreateStreamableHTTPMCPServer]


class StdioMCPServer(CreateStdioMCPServer):
    """A Stdio MCP server"""

    id: str = BaseMCPServer.generate_id_field()
    server_name: str = Field(..., description="The name of the MCP server")


class SSEMCPServer(CreateSSEMCPServer):
    """An SSE MCP server"""

    id: str = BaseMCPServer.generate_id_field()
    server_name: str = Field(..., description="The name of the MCP server")


class StreamableHTTPMCPServer(CreateStreamableHTTPMCPServer):
    """A Streamable HTTP MCP server"""

    id: str = BaseMCPServer.generate_id_field()
    server_name: str = Field(..., description="The name of the MCP server")


MCPServerUnion = Union[StdioMCPServer, SSEMCPServer, StreamableHTTPMCPServer]


# Update Schemas (for PATCH requests) - same shape as Create/Config, but all fields optional.
# We exclude fields that aren't persisted on the server model to avoid invalid ORM assignments.
class UpdateStdioMCPServer(LettaBase):
    """Update schema for Stdio MCP server - all fields optional"""

    mcp_server_type: Literal[MCPServerType.STDIO] = MCPServerType.STDIO
    command: Optional[str] = Field(..., description="The command to run (MCP 'local' client will run this command)")
    args: Optional[List[str]] = Field(..., description="The arguments to pass to the command")
    env: Optional[dict[str, str]] = Field(None, description="Environment variables to set")


class UpdateSSEMCPServer(LettaBase):
    """Update schema for SSE MCP server - all fields optional"""

    mcp_server_type: Literal[MCPServerType.SSE] = MCPServerType.SSE
    server_url: Optional[str] = Field(..., description="The URL of the server")
    auth_header: Optional[str] = Field(None, description="The name of the authentication header (e.g., 'Authorization')")
    auth_token: Optional[str] = Field(None, description="The authentication token or API key value")
    custom_headers: Optional[dict[str, str]] = Field(None, description="Custom HTTP headers to include with requests")


class UpdateStreamableHTTPMCPServer(LettaBase):
    """Update schema for Streamable HTTP MCP server - all fields optional"""

    mcp_server_type: Literal[MCPServerType.STREAMABLE_HTTP] = MCPServerType.STREAMABLE_HTTP
    server_url: Optional[str] = Field(..., description="The URL of the server")
    auth_header: Optional[str] = Field(None, description="The name of the authentication header (e.g., 'Authorization')")
    auth_token: Optional[str] = Field(None, description="The authentication token or API key value")
    custom_headers: Optional[dict[str, str]] = Field(None, description="Custom HTTP headers to include with requests")


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
        """Get the access token as a Secret object."""
        return self.access_token_enc if self.access_token_enc is not None else Secret.from_plaintext(None)

    def get_refresh_token_secret(self) -> Secret:
        """Get the refresh token as a Secret object."""
        return self.refresh_token_enc if self.refresh_token_enc is not None else Secret.from_plaintext(None)

    def get_client_secret_secret(self) -> Secret:
        """Get the client secret as a Secret object."""
        return self.client_secret_enc if self.client_secret_enc is not None else Secret.from_plaintext(None)

    def get_authorization_code_secret(self) -> Secret:
        """Get the authorization code as a Secret object."""
        return self.authorization_code_enc if self.authorization_code_enc is not None else Secret.from_plaintext(None)

    def set_access_token_secret(self, secret: Secret) -> None:
        """Set access token from a Secret object."""
        self.access_token_enc = secret

    def set_refresh_token_secret(self, secret: Secret) -> None:
        """Set refresh token from a Secret object."""
        self.refresh_token_enc = secret

    def set_client_secret_secret(self, secret: Secret) -> None:
        """Set client secret from a Secret object."""
        self.client_secret_enc = secret

    def set_authorization_code_secret(self, secret: Secret) -> None:
        """Set authorization code from a Secret object."""
        self.authorization_code_enc = secret


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


class ToolExecuteRequest(LettaBase):
    """Request to execute a tool."""

    args: Dict[str, Any] = Field(default_factory=dict, description="Arguments to pass to the tool")


# Wrapper models for API requests with discriminated unions
class CreateMCPServerRequest(LettaBase):
    """Request to create a new MCP server with configuration."""

    server_name: str = Field(..., description="The name of the MCP server")
    config: Annotated[
        CreateMCPServerUnion,
        Field(..., discriminator="mcp_server_type", description="The MCP server configuration (Stdio, SSE, or Streamable HTTP)"),
    ]


class UpdateMCPServerRequest(LettaBase):
    """Request to update an existing MCP server configuration."""

    server_name: Optional[str] = Field(None, description="The name of the MCP server")
    config: Annotated[
        UpdateMCPServerUnion,
        Field(..., discriminator="mcp_server_type", description="The MCP server configuration updates (Stdio, SSE, or Streamable HTTP)"),
    ]


async def convert_generic_to_union(server) -> MCPServerUnion:
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
            mcp_server_type=MCPServerType.STDIO,
            command=server.stdio_config.command if server.stdio_config else None,
            args=server.stdio_config.args if server.stdio_config else None,
            env=server.stdio_config.env if server.stdio_config else None,
        )
    elif server.server_type == MCPServerType.SSE:
        # Get decrypted values from encrypted columns (async)
        token = await server.token_enc.get_plaintext_async() if server.token_enc else None
        headers = await server.get_custom_headers_dict_async()
        return SSEMCPServer(
            id=server.id,
            server_name=server.server_name,
            mcp_server_type=MCPServerType.SSE,
            server_url=server.server_url,
            auth_header="Authorization" if token else None,
            auth_token=f"Bearer {token}" if token else None,
            custom_headers=headers,
        )
    elif server.server_type == MCPServerType.STREAMABLE_HTTP:
        # Get decrypted values from encrypted columns (async)
        token = await server.token_enc.get_plaintext_async() if server.token_enc else None
        headers = await server.get_custom_headers_dict_async()
        return StreamableHTTPMCPServer(
            id=server.id,
            server_name=server.server_name,
            mcp_server_type=MCPServerType.STREAMABLE_HTTP,
            server_url=server.server_url,
            auth_header="Authorization" if token else None,
            auth_token=f"Bearer {token}" if token else None,
            custom_headers=headers,
        )
    else:
        raise ValueError(f"Unknown server type: {server.server_type}")


def convert_update_to_internal(request: UpdateMCPServerRequest):
    """Convert external UpdateMCPServerRequest to internal UpdateMCPServer union used by the manager.

    External API Request Structure (UpdateMCPServerRequest):
    - server_name: Optional[str] (at top level)
    - config: UpdateMCPServerUnion
        - UpdateStdioMCPServer: command, args, env (flat fields)
        - UpdateSSEMCPServer: server_url, auth_header, auth_token, custom_headers
        - UpdateStreamableHTTPMCPServer: server_url, auth_header, auth_token, custom_headers

    Internal Layer (schemas/mcp.py):
    - UpdateStdioMCPServer: server_name, stdio_config (wrapped in StdioServerConfig)
    - UpdateSSEMCPServer: server_name, server_url, token (not auth_token!), custom_headers
    - UpdateStreamableHTTPMCPServer: server_name, server_url, auth_header, auth_token, custom_headers

    This function:
    1. Extracts server_name from request (top level)
    2. Wraps stdio fields into StdioServerConfig
    3. Maps auth_token → token for SSE (internal uses 'token')
    4. Passes through auth_header + auth_token for StreamableHTTP
    5. Strips 'Bearer ' prefix from tokens if present
    """
    # Local import to avoid circulars
    from letta.functions.mcp_client.types import MCPServerType as MCPType, StdioServerConfig as StdioCfg
    from letta.schemas.mcp import (
        UpdateSSEMCPServer as InternalUpdateSSE,
        UpdateStdioMCPServer as InternalUpdateStdio,
        UpdateStreamableHTTPMCPServer as InternalUpdateHTTP,
    )

    config = request.config
    server_name = request.server_name

    if isinstance(config, UpdateStdioMCPServer):
        # For Stdio: wrap command/args/env into StdioServerConfig
        stdio_cfg = None
        # Only build stdio_config if command and args are explicitly provided
        if config.command is not None and config.args is not None:
            # Note: server_name in StdioServerConfig should match the parent server's name
            # Use empty string as placeholder if server_name update is not provided
            stdio_cfg = StdioCfg(
                server_name=server_name or "",  # Will be overwritten by manager if needed
                type=MCPType.STDIO,
                command=config.command,
                args=config.args,
                env=config.env,
            )

        # Build kwargs with only non-None values
        kwargs: dict = {}
        if server_name is not None:
            kwargs["server_name"] = server_name
        if stdio_cfg is not None:
            kwargs["stdio_config"] = stdio_cfg

        return InternalUpdateStdio(**kwargs)

    elif isinstance(config, UpdateSSEMCPServer):
        # For SSE: map auth_token → token, strip Bearer prefix if present
        token_value = None
        if config.auth_token is not None:
            # Strip 'Bearer ' prefix if present (internal storage doesn't include prefix)
            token_value = config.auth_token
            if token_value.startswith(f"{MCP_AUTH_TOKEN_BEARER_PREFIX} "):
                token_value = token_value[len(f"{MCP_AUTH_TOKEN_BEARER_PREFIX} ") :]

        # Build kwargs with only non-None values
        kwargs: dict = {}
        if server_name is not None:
            kwargs["server_name"] = server_name
        if config.server_url is not None:
            kwargs["server_url"] = config.server_url
        if token_value is not None:
            kwargs["token"] = token_value
        if config.custom_headers is not None:
            kwargs["custom_headers"] = config.custom_headers

        return InternalUpdateSSE(**kwargs)

    elif isinstance(config, UpdateStreamableHTTPMCPServer):
        # For StreamableHTTP: pass through auth_header + auth_token, strip Bearer prefix if present
        auth_token_value = None
        if config.auth_token is not None:
            # Strip 'Bearer ' prefix if present (internal storage doesn't include prefix)
            auth_token_value = config.auth_token
            if auth_token_value.startswith(f"{MCP_AUTH_TOKEN_BEARER_PREFIX} "):
                auth_token_value = auth_token_value[len(f"{MCP_AUTH_TOKEN_BEARER_PREFIX} ") :]

        # Build kwargs with only non-None values
        kwargs: dict = {}
        if server_name is not None:
            kwargs["server_name"] = server_name
        if config.server_url is not None:
            kwargs["server_url"] = config.server_url
        if config.auth_header is not None:
            kwargs["auth_header"] = config.auth_header
        if auth_token_value is not None:
            kwargs["auth_token"] = auth_token_value
        if config.custom_headers is not None:
            kwargs["custom_headers"] = config.custom_headers

        return InternalUpdateHTTP(**kwargs)

    else:
        raise TypeError(f"Unsupported update config type: {type(config)}")
