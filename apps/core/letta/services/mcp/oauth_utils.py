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
        if not oauth_session or not oauth_session.access_token:
            return None

        return OAuthToken(
            access_token=oauth_session.access_token,
            refresh_token=oauth_session.refresh_token,
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

        return OAuthClientInformationFull(
            client_id=oauth_session.client_id,
            client_secret=oauth_session.client_secret,
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

    async def store_authorization_code(self, code: str, state: str) -> bool:
        """Store the authorization code from OAuth callback."""
        async with db_registry.async_session() as session:
            try:
                oauth_record = await MCPOAuth.read_async(db_session=session, identifier=self.session_id, actor=None)

                # if oauth_record.state != state:
                #     return False

                oauth_record.authorization_code = code
                oauth_record.state = state
                oauth_record.status = OAuthSessionStatus.AUTHORIZED
                oauth_record.updated_at = datetime.now()
                await oauth_record.update_async(db_session=session, actor=None)
                return True
            except Exception:
                return False

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
    url_callback: Optional[Callable[[str], None]] = None,
) -> OAuthClientProvider:
    """Create an OAuth provider for MCP server authentication."""

    client_metadata_dict = {
        "client_name": "Letta MCP Client",
        "redirect_uris": [redirect_uri],
        "grant_types": ["authorization_code", "refresh_token"],
        "response_types": ["code"],
        "token_endpoint_auth_method": "client_secret_post",
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
                return oauth_session.authorization_code, oauth_session.state
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


def get_oauth_success_html() -> str:
    """Generate HTML for successful OAuth authorization."""
    return """
<!DOCTYPE html>
<html>
<head>
    <title>Authorization Successful - Letta</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background-color: #f5f5f5;
            background-image: url("data:image/svg+xml,%3Csvg width='1440' height='860' viewBox='0 0 1440 860' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cg clip-path='url(%23clip0_14823_146864)'%3E%3Cpath d='M720.001 1003.14C1080.62 1003.14 1372.96 824.028 1372.96 603.083C1372.96 382.138 1080.62 203.026 720.001 203.026C359.384 203.026 67.046 382.138 67.046 603.083C67.046 824.028 359.384 1003.14 720.001 1003.14Z' stroke='%23E1E2E3' stroke-width='1.5' stroke-miterlimit='10'/%3E%3Cpath d='M719.999 978.04C910.334 978.04 1064.63 883.505 1064.63 766.891C1064.63 650.276 910.334 555.741 719.999 555.741C529.665 555.741 375.368 650.276 375.368 766.891C375.368 883.505 529.665 978.04 719.999 978.04Z' stroke='%23E1E2E3' stroke-width='1.5' stroke-miterlimit='10'/%3E%3Cpath d='M720 1020.95C1262.17 1020.95 1701.68 756.371 1701.68 430C1701.68 103.629 1262.17 -160.946 720 -160.946C177.834 -160.946 -261.678 103.629 -261.678 430C-261.678 756.371 177.834 1020.95 720 1020.95Z' stroke='%23E1E2E3' stroke-width='1.5' stroke-miterlimit='10'/%3E%3Cpath d='M719.999 323.658C910.334 323.658 1064.63 223.814 1064.63 100.649C1064.63 -22.5157 910.334 -122.36 719.999 -122.36C529.665 -122.36 375.368 -22.5157 375.368 100.649C375.368 223.814 529.665 323.658 719.999 323.658Z' stroke='%23E1E2E3' stroke-width='1.5' stroke-miterlimit='10'/%3E%3Cpath d='M720.001 706.676C1080.62 706.676 1372.96 517.507 1372.96 284.155C1372.96 50.8029 1080.62 -138.366 720.001 -138.366C359.384 -138.366 67.046 50.8029 67.046 284.155C67.046 517.507 359.384 706.676 720.001 706.676Z' stroke='%23E1E2E3' stroke-width='1.5' stroke-miterlimit='10'/%3E%3Cpath d='M719.999 874.604C1180.69 874.604 1554.15 645.789 1554.15 363.531C1554.15 81.2725 1180.69 -147.543 719.999 -147.543C259.311 -147.543 -114.15 81.2725 -114.15 363.531C-114.15 645.789 259.311 874.604 719.999 874.604Z' stroke='%23E1E2E3' stroke-width='1.5' stroke-miterlimit='10'/%3E%3C/g%3E%3Cdefs%3E%3CclipPath id='clip0_14823_146864'%3E%3Crect width='1440' height='860' fill='white'/%3E%3C/clipPath%3E%3C/defs%3E%3C/svg%3E");
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
        }

        .card {
            text-align: center;
            padding: 48px;
            background: white;
            border-radius: 8px;
            border: 1px solid #E1E2E3;
            max-width: 400px;
            width: 90%;
            position: relative;
            z-index: 1;
        }

        .logo {
            width: 48px;
            height: 48px;
            margin: 0 auto 24px;
            display: block;
        }

        .logo svg {
            width: 100%;
            height: 100%;
        }

        h1 {
            font-size: 20px;
            font-weight: 600;
            color: #101010;
            margin-bottom: 12px;
            line-height: 1.2;
        }

        .subtitle {
            color: #666;
            font-size: 12px;
            margin-top: 10px;
            margin-bottom: 24px;
            line-height: 1.5;
        }

        .close-info {
            font-size: 12px;
            color: #999;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }

        .spinner {
            width: 16px;
            height: 16px;
            border: 2px solid #E1E2E3;
            border-top: 2px solid #333;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        /* Dark mode styles */
        @media (prefers-color-scheme: dark) {
            body {
                background-color: #101010;
                background-image: url("data:image/svg+xml,%3Csvg width='1440' height='860' viewBox='0 0 1440 860' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cg clip-path='url(%23clip0_14833_149362)'%3E%3Cpath d='M720.001 1003.14C1080.62 1003.14 1372.96 824.028 1372.96 603.083C1372.96 382.138 1080.62 203.026 720.001 203.026C359.384 203.026 67.046 382.138 67.046 603.083C67.046 824.028 359.384 1003.14 720.001 1003.14Z' stroke='%2346484A' stroke-width='1.5' stroke-miterlimit='10'/%3E%3Cpath d='M719.999 978.04C910.334 978.04 1064.63 883.505 1064.63 766.891C1064.63 650.276 910.334 555.741 719.999 555.741C529.665 555.741 375.368 650.276 375.368 766.891C375.368 883.505 529.665 978.04 719.999 978.04Z' stroke='%2346484A' stroke-width='1.5' stroke-miterlimit='10'/%3E%3Cpath d='M720 1020.95C1262.17 1020.95 1701.68 756.371 1701.68 430C1701.68 103.629 1262.17 -160.946 720 -160.946C177.834 -160.946 -261.678 103.629 -261.678 430C-261.678 756.371 177.834 1020.95 720 1020.95Z' stroke='%2346484A' stroke-width='1.5' stroke-miterlimit='10'/%3E%3Cpath d='M719.999 323.658C910.334 323.658 1064.63 223.814 1064.63 100.649C1064.63 -22.5157 910.334 -122.36 719.999 -122.36C529.665 -122.36 375.368 -22.5157 375.368 100.649C375.368 223.814 529.665 323.658 719.999 323.658Z' stroke='%2346484A' stroke-width='1.5' stroke-miterlimit='10'/%3E%3Cpath d='M720.001 706.676C1080.62 706.676 1372.96 517.507 1372.96 284.155C1372.96 50.8029 1080.62 -138.366 720.001 -138.366C359.384 -138.366 67.046 50.8029 67.046 284.155C67.046 517.507 359.384 706.676 720.001 706.676Z' stroke='%2346484A' stroke-width='1.5' stroke-miterlimit='10'/%3E%3Cpath d='M719.999 874.604C1180.69 874.604 1554.15 645.789 1554.15 363.531C1554.15 81.2725 1180.69 -147.543 719.999 -147.543C259.311 -147.543 -114.15 81.2725 -114.15 363.531C-114.15 645.789 259.311 874.604 719.999 874.604Z' stroke='%2346484A' stroke-width='1.5' stroke-miterlimit='10'/%3E%3C/g%3E%3Cdefs%3E%3CclipPath id='clip0_14833_149362'%3E%3Crect width='1440' height='860' fill='white'/%3E%3C/clipPath%3E%3C/defs%3E%3C/svg%3E");
            }

            .card {
                background-color: #141414;
                border-color: #202020;
            }

            h1 {
                color: #E1E2E3;
            }

            .subtitle {
                color: #999;
            }

            .logo svg path {
                fill: #E1E2E3;
            }

            .spinner {
                border-color: #46484A;
                border-top-color: #E1E2E3;
            }
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="logo">
            <svg width="48" height="48" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10.7134 7.30028H7.28759V10.7002H10.7134V7.30028Z" fill="#333"/>
                <path d="M14.1391 2.81618V0.5H3.86131V2.81618C3.86131 3.41495 3.37266 3.89991 2.76935 3.89991H0.435547V14.1001H2.76935C3.37266 14.1001 3.86131 14.5851 3.86131 15.1838V17.5H14.1391V15.1838C14.1391 14.5851 14.6277 14.1001 15.231 14.1001H17.5648V3.89991H15.231C14.6277 3.89991 14.1391 3.41495 14.1391 2.81618ZM14.1391 13.0159C14.1391 13.6147 13.6504 14.0996 13.0471 14.0996H4.95375C4.35043 14.0996 3.86179 13.6147 3.86179 13.0159V4.98363C3.86179 4.38486 4.35043 3.89991 4.95375 3.89991H13.0471C13.6504 3.89991 14.1391 4.38486 14.1391 4.98363V13.0159Z" fill="#333"/>
            </svg>
        </div>
        <h3>Authorization Successful</h3>
        <p class="subtitle">You have successfully connected your MCP server.</p>
        <div class="close-info">
            <span>You can now close this window.</span>
        </div>
    </div>
</body>
</html>
"""
