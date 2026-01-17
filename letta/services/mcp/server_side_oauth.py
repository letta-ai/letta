"""Server-side OAuth for FastMCP client that works with web app flows.

This module provides a custom OAuth implementation that:
1. Forwards authorization URLs via callback instead of opening a browser
2. Receives auth codes from an external source (web app callback) instead of running a local server

This is designed for server-side applications where the OAuth flow must be handled
by a web frontend rather than opening a local browser.
"""

import asyncio
import time
from typing import Callable, Optional, Tuple
from urllib.parse import urlparse

from mcp.client.auth import OAuthClientProvider
from mcp.shared.auth import OAuthClientMetadata
from pydantic import AnyHttpUrl

from letta.log import get_logger
from letta.orm.mcp_oauth import OAuthSessionStatus
from letta.schemas.mcp import MCPOAuthSessionUpdate
from letta.schemas.user import User as PydanticUser
from letta.services.mcp.oauth_utils import DatabaseTokenStorage

logger = get_logger(__name__)

# Type alias for the MCPServerManager to avoid circular imports
# The actual type is letta.services.mcp_server_manager.MCPServerManager
MCPManagerType = "MCPServerManager"


class ServerSideOAuth(OAuthClientProvider):
    """
    OAuth client that forwards authorization URL via callback instead of opening browser,
    and receives auth code from external source instead of running local callback server.

    This class subclasses MCP's OAuthClientProvider directly (bypassing FastMCP's OAuth class)
    to use DatabaseTokenStorage for persistent token storage instead of file-based storage.

    This class works in a server-side context where:
    - The authorization URL should be returned to a web client instead of opening a browser
    - The authorization code is received via a webhook/callback endpoint instead of a local server
    - Tokens are stored in the database for persistence across server restarts and instances

    Args:
        mcp_url: The MCP server URL to authenticate against
        session_id: The OAuth session ID for tracking this flow in the database
        mcp_manager: The MCP manager instance for database operations
        actor: The user making the OAuth request
        redirect_uri: The redirect URI for the OAuth callback (web app endpoint)
        url_callback: Optional callback function called with the authorization URL
        logo_uri: Optional logo URI to include in OAuth client metadata
        scopes: OAuth scopes to request
    """

    def __init__(
        self,
        mcp_url: str,
        session_id: str,
        mcp_manager: MCPManagerType,
        actor: PydanticUser,
        redirect_uri: str,
        url_callback: Optional[Callable[[str], None]] = None,
        logo_uri: Optional[str] = None,
        scopes: Optional[str | list[str]] = None,
    ):
        self.session_id = session_id
        self.mcp_manager = mcp_manager
        self.actor = actor
        self._redirect_uri = redirect_uri
        self._url_callback = url_callback

        # Parse URL to get server base URL
        parsed_url = urlparse(mcp_url)
        server_base_url = f"{parsed_url.scheme}://{parsed_url.netloc}"
        self.server_base_url = server_base_url

        # Build scopes string
        scopes_str: str
        if isinstance(scopes, list):
            scopes_str = " ".join(scopes)
        elif scopes is not None:
            scopes_str = str(scopes)
        else:
            scopes_str = ""

        # Create client metadata with the web app's redirect URI
        client_metadata = OAuthClientMetadata(
            client_name="Letta",
            redirect_uris=[AnyHttpUrl(redirect_uri)],
            grant_types=["authorization_code", "refresh_token"],
            response_types=["code"],
            scope=scopes_str,
        )
        if logo_uri:
            client_metadata.logo_uri = logo_uri

        # Use DatabaseTokenStorage for persistent storage in the database
        storage = DatabaseTokenStorage(session_id, mcp_manager, actor)

        # Initialize parent OAuthClientProvider directly (bypassing FastMCP's OAuth class)
        # This allows us to use DatabaseTokenStorage instead of FileTokenStorage
        super().__init__(
            server_url=server_base_url,
            client_metadata=client_metadata,
            storage=storage,
            redirect_handler=self.redirect_handler,
            callback_handler=self.callback_handler,
        )

    async def redirect_handler(self, authorization_url: str) -> None:
        """Store authorization URL in database and call optional callback.

        This overrides the parent's redirect_handler which would open a browser.
        Instead, we:
        1. Store the URL in the database for the API to return
        2. Call an optional callback (e.g., to yield to an SSE stream)

        Args:
            authorization_url: The OAuth authorization URL to redirect the user to
        """
        logger.info(f"OAuth redirect handler called with URL: {authorization_url}")

        # Store URL in database for API response
        session_update = MCPOAuthSessionUpdate(authorization_url=authorization_url)
        await self.mcp_manager.update_oauth_session(self.session_id, session_update, self.actor)

        logger.info(f"OAuth authorization URL stored for session {self.session_id}")

        # Call the callback if provided (e.g., to yield URL to SSE stream)
        if self._url_callback:
            self._url_callback(authorization_url)

    async def callback_handler(self) -> Tuple[str, Optional[str]]:
        """Poll database for authorization code set by web app callback.

        This overrides the parent's callback_handler which would run a local server.
        Instead, we poll the database waiting for the authorization code to be set
        by the web app's callback endpoint.

        Returns:
            Tuple of (authorization_code, state)

        Raises:
            Exception: If OAuth authorization failed or timed out
        """
        timeout = 300  # 5 minutes
        start_time = time.time()

        logger.info(f"Waiting for authorization code for session {self.session_id}")

        while time.time() - start_time < timeout:
            oauth_session = await self.mcp_manager.get_oauth_session_by_id(self.session_id, self.actor)

            if oauth_session and oauth_session.authorization_code_enc:
                # Read authorization code directly from _enc column
                auth_code = await oauth_session.authorization_code_enc.get_plaintext_async()
                logger.info(f"Authorization code received for session {self.session_id}")
                return auth_code, oauth_session.state

            if oauth_session and oauth_session.status == OAuthSessionStatus.ERROR:
                raise Exception("OAuth authorization failed")

            await asyncio.sleep(1)

        raise Exception(f"Timeout waiting for OAuth callback after {timeout} seconds")
