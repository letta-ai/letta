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
from letta.schemas.letta_base import LettaBase
from letta.schemas.secret import Secret, SecretDict
from letta.settings import settings


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

    token_enc: Optional[str] = Field(None, description="Encrypted token")
    custom_headers_enc: Optional[str] = Field(None, description="Encrypted custom headers")

    # stdio config
    stdio_config: Optional[StdioServerConfig] = Field(
        None, description="The configuration for the server (MCP 'local' client will run this command)"
    )

    organization_id: Optional[str] = Field(None, description="The unique identifier of the organization associated with the tool.")

    # metadata fields
    created_by_id: Optional[str] = Field(None, description="The id of the user that made this Tool.")
    last_updated_by_id: Optional[str] = Field(None, description="The id of the user that made this Tool.")
    metadata_: Optional[Dict[str, Any]] = Field(default_factory=dict, description="A dictionary of additional metadata for the tool.")

    def get_token_secret(self) -> Secret:
        """Get the token as a Secret object, preferring encrypted over plaintext."""
        return Secret.from_db(self.token_enc, self.token)

    def get_custom_headers_secret(self) -> SecretDict:
        """Get custom headers as a SecretDict object, preferring encrypted over plaintext."""
        return SecretDict.from_db(self.custom_headers_enc, self.custom_headers)

    def set_token_secret(self, secret: Secret) -> None:
        """Set token from a Secret object, updating both encrypted and plaintext fields."""
        secret_dict = secret.to_dict()
        self.token_enc = secret_dict["encrypted"]
        # Only set plaintext during migration phase
        if not secret._was_encrypted:
            self.token = secret_dict["plaintext"]
        else:
            self.token = None

    def set_custom_headers_secret(self, secret: SecretDict) -> None:
        """Set custom headers from a SecretDict object, updating both fields."""
        secret_dict = secret.to_dict()
        self.custom_headers_enc = secret_dict["encrypted"]
        # Only set plaintext during migration phase
        if not secret._was_encrypted:
            self.custom_headers = secret_dict["plaintext"]
        else:
            self.custom_headers = None

    def model_dump(self, to_orm: bool = False, **kwargs):
        """Override model_dump to handle encryption when saving to database."""
        data = super().model_dump(to_orm=to_orm, **kwargs)

        if to_orm and settings.encryption_key:
            # Encrypt token if present
            if self.token is not None:
                token_secret = Secret.from_plaintext(self.token)
                secret_dict = token_secret.to_dict()
                data["token_enc"] = secret_dict["encrypted"]
                # Keep plaintext for dual-write during migration
                data["token"] = secret_dict["plaintext"]

            # Encrypt custom headers if present
            if self.custom_headers is not None:
                headers_secret = SecretDict.from_plaintext(self.custom_headers)
                secret_dict = headers_secret.to_dict()
                data["custom_headers_enc"] = secret_dict["encrypted"]
                # Keep plaintext for dual-write during migration
                data["custom_headers"] = secret_dict["plaintext"]

        return data

    def to_config(
        self,
        environment_variables: Optional[Dict[str, str]] = None,
        resolve_variables: bool = True,
    ) -> Union[SSEServerConfig, StdioServerConfig, StreamableHTTPServerConfig]:
        # Get decrypted values for use in config
        token_secret = self.get_token_secret()
        token_plaintext = token_secret.get_plaintext()

        headers_secret = self.get_custom_headers_secret()
        headers_plaintext = headers_secret.get_plaintext()

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

    server_url: Optional[str] = Field(None, description="The URL of the server (MCP SSE client will connect to this URL)")
    token: Optional[str] = Field(None, description="The access token or API key for the MCP server (used for SSE authentication)")
    custom_headers: Optional[Dict[str, str]] = Field(None, description="Custom authentication headers as key-value pairs")


class UpdateStdioMCPServer(LettaBase):
    """Update a Stdio MCP server"""

    stdio_config: Optional[StdioServerConfig] = Field(
        None, description="The configuration for the server (MCP 'local' client will run this command)"
    )


class UpdateStreamableHTTPMCPServer(LettaBase):
    """Update a Streamable HTTP MCP server"""

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

    # Encrypted token fields (for internal use)
    access_token_enc: Optional[str] = Field(None, description="Encrypted OAuth access token")
    refresh_token_enc: Optional[str] = Field(None, description="Encrypted OAuth refresh token")

    # Client configuration
    client_id: Optional[str] = Field(None, description="OAuth client ID")
    client_secret: Optional[str] = Field(None, description="OAuth client secret")
    redirect_uri: Optional[str] = Field(None, description="OAuth redirect URI")

    # Encrypted client secret (for internal use)
    client_secret_enc: Optional[str] = Field(None, description="Encrypted OAuth client secret")

    # Session state
    status: OAuthSessionStatus = Field(default=OAuthSessionStatus.PENDING, description="Session status")

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.now, description="Session creation time")
    updated_at: datetime = Field(default_factory=datetime.now, description="Last update time")

    def get_access_token_secret(self) -> Secret:
        """Get the access token as a Secret object, preferring encrypted over plaintext."""
        return Secret.from_db(self.access_token_enc, self.access_token)

    def get_refresh_token_secret(self) -> Secret:
        """Get the refresh token as a Secret object, preferring encrypted over plaintext."""
        return Secret.from_db(self.refresh_token_enc, self.refresh_token)

    def get_client_secret_secret(self) -> Secret:
        """Get the client secret as a Secret object, preferring encrypted over plaintext."""
        return Secret.from_db(self.client_secret_enc, self.client_secret)

    def set_access_token_secret(self, secret: Secret) -> None:
        """Set access token from a Secret object."""
        secret_dict = secret.to_dict()
        self.access_token_enc = secret_dict["encrypted"]
        if not secret._was_encrypted:
            self.access_token = secret_dict["plaintext"]
        else:
            self.access_token = None

    def set_refresh_token_secret(self, secret: Secret) -> None:
        """Set refresh token from a Secret object."""
        secret_dict = secret.to_dict()
        self.refresh_token_enc = secret_dict["encrypted"]
        if not secret._was_encrypted:
            self.refresh_token = secret_dict["plaintext"]
        else:
            self.refresh_token = None

    def set_client_secret_secret(self, secret: Secret) -> None:
        """Set client secret from a Secret object."""
        secret_dict = secret.to_dict()
        self.client_secret_enc = secret_dict["encrypted"]
        if not secret._was_encrypted:
            self.client_secret = secret_dict["plaintext"]
        else:
            self.client_secret = None

    def model_dump(self, to_orm: bool = False, **kwargs):
        """Override model_dump to handle encryption when saving to database."""
        data = super().model_dump(to_orm=to_orm, **kwargs)

        if to_orm and settings.encryption_key:
            # Encrypt access token if present
            if self.access_token is not None:
                token_secret = Secret.from_plaintext(self.access_token)
                secret_dict = token_secret.to_dict()
                data["access_token_enc"] = secret_dict["encrypted"]
                # Keep plaintext for dual-write during migration
                data["access_token"] = secret_dict["plaintext"]

            # Encrypt refresh token if present
            if self.refresh_token is not None:
                token_secret = Secret.from_plaintext(self.refresh_token)
                secret_dict = token_secret.to_dict()
                data["refresh_token_enc"] = secret_dict["encrypted"]
                # Keep plaintext for dual-write during migration
                data["refresh_token"] = secret_dict["plaintext"]

            # Encrypt client secret if present
            if self.client_secret is not None:
                secret = Secret.from_plaintext(self.client_secret)
                secret_dict = secret.to_dict()
                data["client_secret_enc"] = secret_dict["encrypted"]
                # Keep plaintext for dual-write during migration
                data["client_secret"] = secret_dict["plaintext"]

        return data


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
