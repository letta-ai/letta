import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

from pydantic import Field

logger = logging.getLogger(__name__)

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
from letta.settings import settings


class BaseMCPServer(LettaBase):
    __id_prefix__ = PrimitiveType.MCP_SERVER.value


class MCPServer(BaseMCPServer):
    id: str = BaseMCPServer.generate_id_field()
    server_type: MCPServerType = MCPServerType.STREAMABLE_HTTP
    server_name: str = Field(..., description="The name of the server")

    # sse / streamable http config
    server_url: Optional[str] = Field(None, description="The URL of the server (MCP SSE/Streamable HTTP client will connect to this URL)")
    token: Optional[str] = Field(None, description="The access token or API key for the MCP server (used for authentication)")
    custom_headers: Optional[Dict[str, str]] = Field(None, description="Custom authentication headers as key-value pairs")

    token_enc: Secret | None = Field(None, description="Encrypted token as Secret object")
    custom_headers_enc: Secret | None = Field(None, description="Encrypted custom headers as Secret object")

    # stdio config
    stdio_config: Optional[StdioServerConfig] = Field(
        None, description="The configuration for the server (MCP 'local' client will run this command)"
    )

    organization_id: Optional[str] = Field(None, description="The unique identifier of the organization associated with the tool.")

    # metadata fields
    created_by_id: Optional[str] = Field(None, description="The id of the user that made this Tool.")
    last_updated_by_id: Optional[str] = Field(None, description="The id of the user that made this Tool.")
    metadata_: Optional[Dict[str, Any]] = Field(default_factory=dict, description="A dictionary of additional metadata for the tool.")

    def get_token_secret(self) -> Optional[Secret]:
        """Get the token as a Secret object."""
        return self.token_enc

    def get_custom_headers_secret(self) -> Optional[Secret]:
        """Get the custom headers as a Secret object (JSON string)."""
        return self.custom_headers_enc

    def get_custom_headers_dict(self) -> Optional[Dict[str, str]]:
        """Get the custom headers as a dictionary."""
        if self.custom_headers_enc:
            json_str = self.custom_headers_enc.get_plaintext()
            if json_str:
                try:
                    return json.loads(json_str)
                except (json.JSONDecodeError, TypeError) as e:
                    logger.warning(f"Failed to parse custom_headers_enc for MCP server {self.id}: {e}")
        return None

    async def get_custom_headers_dict_async(self) -> Optional[Dict[str, str]]:
        """Get custom headers as a plaintext dictionary (async version)."""
        secret = self.get_custom_headers_secret()
        if secret is None:
            return None
        json_str = await secret.get_plaintext_async()
        if json_str:
            try:
                return json.loads(json_str)
            except (json.JSONDecodeError, TypeError) as e:
                logger.warning(f"Failed to parse custom_headers_enc for MCP server {self.id}: {e}")
        return None

    def set_token_secret(self, secret: Secret) -> None:
        """Set token from a Secret object."""
        self.token_enc = secret

    def set_custom_headers_secret(self, secret: Secret) -> None:
        """Set custom headers from a Secret object (JSON string)."""
        self.custom_headers_enc = secret

    def to_config(
        self,
        environment_variables: Optional[Dict[str, str]] = None,
        resolve_variables: bool = True,
    ) -> Union[SSEServerConfig, StdioServerConfig, StreamableHTTPServerConfig]:
        # Get decrypted values directly from encrypted columns
        token_plaintext = self.token_enc.get_plaintext() if self.token_enc else None

        # Get custom headers as dict from encrypted column
        headers_plaintext = None
        if self.custom_headers_enc:
            json_str = self.custom_headers_enc.get_plaintext()
            if json_str:
                try:
                    headers_plaintext = json.loads(json_str)
                except (json.JSONDecodeError, TypeError) as e:
                    logger.warning(f"Failed to parse custom_headers_enc for MCP server {self.id}: {e}")

        if self.server_type == MCPServerType.SSE:
            config = SSEServerConfig(
                server_name=self.server_name,
                server_url=self.server_url,
                auth_header=MCP_AUTH_HEADER_AUTHORIZATION if token_plaintext and not headers_plaintext else None,
                auth_token=f"{MCP_AUTH_TOKEN_BEARER_PREFIX} {token_plaintext}" if token_plaintext and not headers_plaintext else None,
                custom_headers=headers_plaintext,
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
                auth_header=MCP_AUTH_HEADER_AUTHORIZATION if token_plaintext and not headers_plaintext else None,
                auth_token=f"{MCP_AUTH_TOKEN_BEARER_PREFIX} {token_plaintext}" if token_plaintext and not headers_plaintext else None,
                custom_headers=headers_plaintext,
            )
            if resolve_variables:
                config.resolve_environment_variables(environment_variables)
            return config
        else:
            raise ValueError(f"Unsupported server type: {self.server_type}")

    async def to_config_async(
        self,
        environment_variables: Optional[Dict[str, str]] = None,
        resolve_variables: bool = True,
    ) -> Union[SSEServerConfig, StdioServerConfig, StreamableHTTPServerConfig]:
        """Async version of to_config() that uses async decryption."""
        # Get decrypted values for use in config
        token_secret = self.get_token_secret()
        token_plaintext = await token_secret.get_plaintext_async() if token_secret else None

        # Get custom headers as dict
        headers_plaintext = await self.get_custom_headers_dict_async()

        if self.server_type == MCPServerType.SSE:
            config = SSEServerConfig(
                server_name=self.server_name,
                server_url=self.server_url,
                auth_header=MCP_AUTH_HEADER_AUTHORIZATION if token_plaintext and not headers_plaintext else None,
                auth_token=f"{MCP_AUTH_TOKEN_BEARER_PREFIX} {token_plaintext}" if token_plaintext and not headers_plaintext else None,
                custom_headers=headers_plaintext,
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
                auth_header=MCP_AUTH_HEADER_AUTHORIZATION if token_plaintext and not headers_plaintext else None,
                auth_token=f"{MCP_AUTH_TOKEN_BEARER_PREFIX} {token_plaintext}" if token_plaintext and not headers_plaintext else None,
                custom_headers=headers_plaintext,
            )
            if resolve_variables:
                config.resolve_environment_variables(environment_variables)
            return config
        else:
            raise ValueError(f"Unsupported server type: {self.server_type}")


class UpdateSSEMCPServer(LettaBase):
    """Update an SSE MCP server"""

    server_name: Optional[str] = Field(None, description="The name of the MCP server")
    server_url: Optional[str] = Field(None, description="The URL of the server (MCP SSE client will connect to this URL)")
    token: Optional[str] = Field(None, description="The access token or API key for the MCP server (used for SSE authentication)")
    custom_headers: Optional[Dict[str, str]] = Field(None, description="Custom authentication headers as key-value pairs")


class UpdateStdioMCPServer(LettaBase):
    """Update a Stdio MCP server"""

    server_name: Optional[str] = Field(None, description="The name of the MCP server")
    stdio_config: Optional[StdioServerConfig] = Field(
        None, description="The configuration for the server (MCP 'local' client will run this command)"
    )


class UpdateStreamableHTTPMCPServer(LettaBase):
    """Update a Streamable HTTP MCP server"""

    server_name: Optional[str] = Field(None, description="The name of the MCP server")
    server_url: Optional[str] = Field(None, description="The URL path for the streamable HTTP server (e.g., 'example/mcp')")
    auth_header: Optional[str] = Field(None, description="The name of the authentication header (e.g., 'Authorization')")
    auth_token: Optional[str] = Field(None, description="The authentication token or API key value")
    custom_headers: Optional[Dict[str, str]] = Field(None, description="Custom authentication headers as key-value pairs")


UpdateMCPServer = Union[UpdateSSEMCPServer, UpdateStdioMCPServer, UpdateStreamableHTTPMCPServer]


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
