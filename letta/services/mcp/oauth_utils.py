"""OAuth utilities for MCP server authentication."""

import asyncio
import json
import secrets
import time
import uuid
from datetime import datetime, timedelta
from typing import Callable, Optional, Tuple

from mcp.client.auth import OAuthClientProvider, TokenStorage
from mcp.shared.auth import OAuthClientInformationFull, OAuthClientMetadata, OAuthToken
from sqlalchemy import select

from letta.log import get_logger
from letta.orm.mcp_oauth import MCPOAuth, OAuthSessionStatus
from letta.schemas.mcp import MCPOAuthSessionUpdate
from letta.schemas.user import User as PydanticUser
from letta.server.db import db_registry
from letta.services.mcp.types import OauthStreamEvent
from letta.services.mcp_manager import MCPManager

logger = get_logger(__name__)


class DatabaseTokenStorage(TokenStorage):
    """Database-backed token storage using MCPOAuth table via mcp_manager."""

    def __init__(self, session_id: str, mcp_manager: MCPManager, actor: PydanticUser):
        self.session_id = session_id
        self.mcp_manager = mcp_manager
        self.actor = actor

    async def get_tokens(self) -> Optional[OAuthToken]:
        """Retrieve tokens from database."""
        oauth_session = await self.mcp_manager.get_oauth_session_by_id(self.session_id, self.actor)
        if not oauth_session:
            return None

        # Decrypt tokens using getter methods
        access_token_secret = oauth_session.get_access_token_secret()
        access_token = access_token_secret.get_plaintext()
        if not access_token:
            return None

        refresh_token_secret = oauth_session.get_refresh_token_secret()
        refresh_token = refresh_token_secret.get_plaintext()

        return OAuthToken(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type=oauth_session.token_type,
            expires_in=int(oauth_session.expires_at.timestamp() - time.time()),
            scope=oauth_session.scope,
        )

    async def set_tokens(self, tokens: OAuthToken) -> None:
        """Store tokens in database."""
        session_update = MCPOAuthSessionUpdate(
            access_token=tokens.access_token,
            refresh_token=tokens.refresh_token,
            token_type=tokens.token_type,
            expires_at=datetime.fromtimestamp(tokens.expires_in + time.time()),
            scope=tokens.scope,
            status=OAuthSessionStatus.AUTHORIZED,
        )
        await self.mcp_manager.update_oauth_session(self.session_id, session_update, self.actor)

    async def get_client_info(self) -> Optional[OAuthClientInformationFull]:
        """Retrieve client information from database."""
        oauth_session = await self.mcp_manager.get_oauth_session_by_id(self.session_id, self.actor)
        if not oauth_session or not oauth_session.client_id:
            return None

        # Decrypt client secret using getter method
        client_secret_secret = oauth_session.get_client_secret_secret()
        client_secret = client_secret_secret.get_plaintext()

        return OAuthClientInformationFull(
            client_id=oauth_session.client_id,
            client_secret=client_secret,
            redirect_uris=[oauth_session.redirect_uri] if oauth_session.redirect_uri else [],
        )

    async def set_client_info(self, client_info: OAuthClientInformationFull) -> None:
        """Store client information in database."""
        session_update = MCPOAuthSessionUpdate(
            client_id=client_info.client_id,
            client_secret=client_info.client_secret,
            redirect_uri=str(client_info.redirect_uris[0]) if client_info.redirect_uris else None,
        )
        await self.mcp_manager.update_oauth_session(self.session_id, session_update, self.actor)


class MCPOAuthSession:
    """Legacy OAuth session class - deprecated, use mcp_manager directly."""

    def __init__(self, server_url: str, server_name: str, user_id: Optional[str], organization_id: str):
        self.server_url = server_url
        self.server_name = server_name
        self.user_id = user_id
        self.organization_id = organization_id
        self.session_id = str(uuid.uuid4())
        self.state = secrets.token_urlsafe(32)

    def __init__(self, session_id: str):
        self.session_id = session_id

    # TODO: consolidate / deprecate this in favor of mcp_manager access
    async def create_session(self) -> str:
        """Create a new OAuth session in the database."""
        async with db_registry.async_session() as session:
            oauth_record = MCPOAuth(
                id=self.session_id,
                state=self.state,
                server_url=self.server_url,
                server_name=self.server_name,
                user_id=self.user_id,
                organization_id=self.organization_id,
                status=OAuthSessionStatus.PENDING,
                created_at=datetime.now(),
                updated_at=datetime.now(),
            )
            oauth_record = await oauth_record.create_async(session, actor=None)

        return self.session_id

    async def get_session_status(self) -> OAuthSessionStatus:
        """Get the current status of the OAuth session."""
        async with db_registry.async_session() as session:
            try:
                oauth_record = await MCPOAuth.read_async(db_session=session, identifier=self.session_id, actor=None)
                return oauth_record.status
            except Exception:
                return OAuthSessionStatus.ERROR

    async def update_session_status(self, status: OAuthSessionStatus) -> None:
        """Update the session status."""
        async with db_registry.async_session() as session:
            try:
                oauth_record = await MCPOAuth.read_async(db_session=session, identifier=self.session_id, actor=None)
                oauth_record.status = status
                oauth_record.updated_at = datetime.now()
                await oauth_record.update_async(db_session=session, actor=None)
            except Exception:
                pass

    async def store_authorization_code(self, code: str, state: str) -> Optional[MCPOAuth]:
        """Store the authorization code from OAuth callback."""
        # Use mcp_manager to ensure proper encryption
        from letta.schemas.mcp import MCPOAuthSessionUpdate
        from letta.schemas.secret import Secret

        async with db_registry.async_session() as session:
            try:
                oauth_record = await MCPOAuth.read_async(db_session=session, identifier=self.session_id, actor=None)

                # Encrypt the authorization_code before storing
                if code is not None:
                    oauth_record.authorization_code_enc = Secret.from_plaintext(code).get_encrypted()
                    # Keep plaintext for dual-write during migration
                    oauth_record.authorization_code = code

                oauth_record.status = OAuthSessionStatus.AUTHORIZED
                oauth_record.state = state

                return await oauth_record.update_async(db_session=session, actor=None)
            except Exception:
                return None

    async def get_authorization_url(self) -> Optional[str]:
        """Get the authorization URL for this session."""
        async with db_registry.async_session() as session:
            try:
                oauth_record = await MCPOAuth.read_async(db_session=session, identifier=self.session_id, actor=None)
                return oauth_record.authorization_url
            except Exception:
                return None

    async def set_authorization_url(self, url: str) -> None:
        """Set the authorization URL for this session."""
        async with db_registry.async_session() as session:
            try:
                oauth_record = await MCPOAuth.read_async(db_session=session, identifier=self.session_id, actor=None)
                oauth_record.authorization_url = url
                oauth_record.updated_at = datetime.now()
                await oauth_record.update_async(db_session=session, actor=None)
            except Exception:
                pass


async def create_oauth_provider(
    session_id: str,
    server_url: str,
    redirect_uri: str,
    mcp_manager: MCPManager,
    actor: PydanticUser,
    logo_uri: Optional[str] = None,
    url_callback: Optional[Callable[[str], None]] = None,
) -> OAuthClientProvider:
    """Create an OAuth provider for MCP server authentication."""

    client_metadata_dict = {
        "client_name": "Letta",
        "redirect_uris": [redirect_uri],
        "grant_types": ["authorization_code", "refresh_token"],
        "response_types": ["code"],
        "token_endpoint_auth_method": "client_secret_post",
        "logo_uri": logo_uri,
    }

    # Use manager-based storage
    storage = DatabaseTokenStorage(session_id, mcp_manager, actor)

    # Extract base URL (remove /mcp endpoint if present)
    oauth_server_url = server_url.rstrip("/").removesuffix("/sse").removesuffix("/mcp")

    async def redirect_handler(authorization_url: str) -> None:
        """Handle OAuth redirect by storing the authorization URL."""
        logger.info(f"OAuth redirect handler called with URL: {authorization_url}")
        session_update = MCPOAuthSessionUpdate(authorization_url=authorization_url)
        await mcp_manager.update_oauth_session(session_id, session_update, actor)
        logger.info(f"OAuth authorization URL stored: {authorization_url}")

        # Call the callback if provided (e.g., to yield URL to SSE stream)
        if url_callback:
            url_callback(authorization_url)

    async def callback_handler() -> Tuple[str, Optional[str]]:
        """Handle OAuth callback by waiting for authorization code."""
        timeout = 300  # 5 minutes
        start_time = time.time()

        logger.info(f"Waiting for authorization code for session {session_id}")
        while time.time() - start_time < timeout:
            oauth_session = await mcp_manager.get_oauth_session_by_id(session_id, actor)
            if oauth_session and oauth_session.authorization_code:
                # Decrypt the authorization code before returning
                auth_code_secret = oauth_session.get_authorization_code_secret()
                return auth_code_secret.get_plaintext(), oauth_session.state
            elif oauth_session and oauth_session.status == OAuthSessionStatus.ERROR:
                raise Exception("OAuth authorization failed")
            await asyncio.sleep(1)

        raise Exception(f"Timeout waiting for OAuth callback after {timeout} seconds")

    return OAuthClientProvider(
        server_url=oauth_server_url,
        client_metadata=OAuthClientMetadata.model_validate(client_metadata_dict),
        storage=storage,
        redirect_handler=redirect_handler,
        callback_handler=callback_handler,
    )


async def cleanup_expired_oauth_sessions(max_age_hours: int = 24) -> None:
    """Clean up expired OAuth sessions."""
    cutoff_time = datetime.now() - timedelta(hours=max_age_hours)

    async with db_registry.async_session() as session:
        result = await session.execute(select(MCPOAuth).where(MCPOAuth.created_at < cutoff_time))
        expired_sessions = result.scalars().all()

        for oauth_session in expired_sessions:
            await oauth_session.hard_delete_async(db_session=session, actor=None)

        if expired_sessions:
            logger.info(f"Cleaned up {len(expired_sessions)} expired OAuth sessions")


def oauth_stream_event(event: OauthStreamEvent, **kwargs) -> str:
    data = {"event": event.value}
    data.update(kwargs)
    return f"data: {json.dumps(data)}\n\n"


def drill_down_exception(exception, depth=0, max_depth=5):
    """Recursively drill down into nested exceptions to find the root cause"""
    indent = "  " * depth
    error_details = []

    error_details.append(f"{indent}Exception at depth {depth}:")
    error_details.append(f"{indent}  Type: {type(exception).__name__}")
    error_details.append(f"{indent}  Message: {str(exception)}")
    error_details.append(f"{indent}  Module: {getattr(type(exception), '__module__', 'unknown')}")

    # Check for exception groups (TaskGroup errors)
    if hasattr(exception, "exceptions") and exception.exceptions:
        error_details.append(f"{indent}  ExceptionGroup with {len(exception.exceptions)} sub-exceptions:")
        for i, sub_exc in enumerate(exception.exceptions):
            error_details.append(f"{indent}    Sub-exception {i}:")
            if depth < max_depth:
                error_details.extend(drill_down_exception(sub_exc, depth + 1, max_depth))

    # Check for chained exceptions (__cause__ and __context__)
    if hasattr(exception, "__cause__") and exception.__cause__ and depth < max_depth:
        error_details.append(f"{indent}  Caused by:")
        error_details.extend(drill_down_exception(exception.__cause__, depth + 1, max_depth))

    if hasattr(exception, "__context__") and exception.__context__ and depth < max_depth:
        error_details.append(f"{indent}  Context:")
        error_details.extend(drill_down_exception(exception.__context__, depth + 1, max_depth))

    # Add traceback info
    import traceback

    if hasattr(exception, "__traceback__") and exception.__traceback__:
        tb_lines = traceback.format_tb(exception.__traceback__)
        error_details.append(f"{indent}  Traceback:")
        for line in tb_lines[-3:]:  # Show last 3 traceback lines
            error_details.append(f"{indent}    {line.strip()}")

    error_info = "".join(error_details)
    return error_info
