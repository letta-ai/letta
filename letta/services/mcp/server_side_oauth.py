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

from fastmcp.client.auth.oauth import OAuth
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


class ServerSideOAuth(OAuth):
    """
    OAuth client that forwards authorization URL via callback instead of opening browser,
    and receives auth code from external source instead of running local callback server.

    This class extends FastMCP's OAuth class to:
    - Use DatabaseTokenStorage for persistent token storage instead of file-based storage
    - Override redirect_handler to store URLs in the database instead of opening a browser
    - Override callback_handler to poll database for auth codes instead of running a local server

    By extending FastMCP's OAuth, we inherit its _initialize() fix that properly sets
    token_expiry_time, enabling automatic token refresh when tokens expire.

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

        # Initialize parent OAuth class (this creates FileTokenStorage internally)
        super().__init__(
            mcp_url=mcp_url,
            scopes=scopes,
            client_name="Letta",
        )

        # Replace the file-based storage with database storage
        # This must be done after super().__init__ since it creates the context
        self.context.storage = DatabaseTokenStorage(session_id, mcp_manager, actor)

        # Override redirect URI in client metadata to use our web app's callback
        self.context.client_metadata.redirect_uris = [AnyHttpUrl(redirect_uri)]

        # Clear empty scope - some OAuth servers (like Supabase) reject empty scope strings
        # Setting to None lets the server use its default scopes
        if not scopes:
            self.context.client_metadata.scope = None

        # Set logo URI if provided
        if logo_uri:
            self.context.client_metadata.logo_uri = logo_uri

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
