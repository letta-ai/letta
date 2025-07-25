import json
import os
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union

from fastapi import HTTPException
from sqlalchemy import null

import letta.constants as constants
from letta.functions.mcp_client.types import MCPServerType, MCPTool, SSEServerConfig, StdioServerConfig, StreamableHTTPServerConfig
from letta.log import get_logger
from letta.orm.errors import NoResultFound
from letta.orm.mcp_oauth import MCPOAuth, OAuthSessionStatus
from letta.orm.mcp_server import MCPServer as MCPServerModel
from letta.schemas.mcp import (
    MCPOAuthSession,
    MCPOAuthSessionCreate,
    MCPOAuthSessionUpdate,
    MCPServer,
    UpdateMCPServer,
    UpdateSSEMCPServer,
    UpdateStdioMCPServer,
    UpdateStreamableHTTPMCPServer,
)
from letta.schemas.tool import Tool as PydanticTool
from letta.schemas.tool import ToolCreate
from letta.schemas.user import User as PydanticUser
from letta.server.db import db_registry
from letta.services.mcp.sse_client import MCP_CONFIG_TOPLEVEL_KEY, AsyncSSEMCPClient
from letta.services.mcp.stdio_client import AsyncStdioMCPClient
from letta.services.mcp.streamable_http_client import AsyncStreamableHTTPMCPClient
from letta.services.tool_manager import ToolManager
from letta.utils import enforce_types, printd

logger = get_logger(__name__)


class MCPManager:
    """Manager class to handle business logic related to MCP."""

    def __init__(self):
        # TODO: timeouts?
        self.tool_manager = ToolManager()
        self.cached_mcp_servers = {}  # maps id -> async connection

    @enforce_types
    async def list_mcp_server_tools(self, mcp_server_name: str, actor: PydanticUser) -> List[MCPTool]:
        """Get a list of all tools for a specific MCP server."""
        try:
            mcp_server_id = await self.get_mcp_server_id_by_name(mcp_server_name, actor=actor)
            mcp_config = await self.get_mcp_server_by_id_async(mcp_server_id, actor=actor)
            server_config = mcp_config.to_config()
            mcp_client = await self.get_mcp_client(server_config, actor)
            await mcp_client.connect_to_server()

            # list tools
            tools = await mcp_client.list_tools()
            return tools
        except Exception as e:
            logger.error(f"Error listing tools for MCP server {mcp_server_name}: {e}")
            return []
        finally:
            await mcp_client.cleanup()

    @enforce_types
    async def execute_mcp_server_tool(
        self, mcp_server_name: str, tool_name: str, tool_args: Optional[Dict[str, Any]], actor: PydanticUser
    ) -> Tuple[str, bool]:
        """Call a specific tool from a specific MCP server."""
        from letta.settings import tool_settings

        if not tool_settings.mcp_read_from_config:
            # read from DB
            mcp_server_id = await self.get_mcp_server_id_by_name(mcp_server_name, actor=actor)
            mcp_config = await self.get_mcp_server_by_id_async(mcp_server_id, actor=actor)
            server_config = mcp_config.to_config()
        else:
            # read from config file
            mcp_config = self.read_mcp_config()
            if mcp_server_name not in mcp_config:
                raise ValueError(f"MCP server {mcp_server_name} not found in config.")
            server_config = mcp_config[mcp_server_name]

        mcp_client = await self.get_mcp_client(server_config, actor)
        await mcp_client.connect_to_server()

        # call tool
        result, success = await mcp_client.execute_tool(tool_name, tool_args)
        logger.info(f"MCP Result: {result}, Success: {success}")
        # TODO: change to pydantic tool

        await mcp_client.cleanup()

        return result, success

    @enforce_types
    async def add_tool_from_mcp_server(self, mcp_server_name: str, mcp_tool_name: str, actor: PydanticUser) -> PydanticTool:
        """Add a tool from an MCP server to the Letta tool registry."""
        # get the MCP server ID, we should migrate to use the server_id instead of the name
        mcp_server_id = await self.get_mcp_server_id_by_name(mcp_server_name, actor=actor)
        if not mcp_server_id:
            raise ValueError(f"MCP server '{mcp_server_name}' not found")

        mcp_tools = await self.list_mcp_server_tools(mcp_server_name, actor=actor)

        for mcp_tool in mcp_tools:
            if mcp_tool.name == mcp_tool_name:
                tool_create = ToolCreate.from_mcp(mcp_server_name=mcp_server_name, mcp_tool=mcp_tool)
                return await self.tool_manager.create_mcp_tool_async(
                    tool_create=tool_create, mcp_server_name=mcp_server_name, mcp_server_id=mcp_server_id, actor=actor
                )

        # failed to add - handle error?
        return None

    @enforce_types
    async def list_mcp_servers(self, actor: PydanticUser) -> List[MCPServer]:
        """List all MCP servers available"""
        async with db_registry.async_session() as session:
            mcp_servers = await MCPServerModel.list_async(
                db_session=session,
                organization_id=actor.organization_id,
            )

            return [mcp_server.to_pydantic() for mcp_server in mcp_servers]

    @enforce_types
    async def create_or_update_mcp_server(self, pydantic_mcp_server: MCPServer, actor: PydanticUser) -> MCPServer:
        """Create a new tool based on the ToolCreate schema."""
        mcp_server_id = await self.get_mcp_server_id_by_name(mcp_server_name=pydantic_mcp_server.server_name, actor=actor)
        if mcp_server_id:
            # Put to dict and remove fields that should not be reset
            update_data = pydantic_mcp_server.model_dump(exclude_unset=True, exclude_none=True)

            # If there's anything to update (can only update the configs, not the name)
            if update_data:
                if pydantic_mcp_server.server_type == MCPServerType.SSE:
                    update_request = UpdateSSEMCPServer(server_url=pydantic_mcp_server.server_url, token=pydantic_mcp_server.token)
                elif pydantic_mcp_server.server_type == MCPServerType.STDIO:
                    update_request = UpdateStdioMCPServer(stdio_config=pydantic_mcp_server.stdio_config)
                elif pydantic_mcp_server.server_type == MCPServerType.STREAMABLE_HTTP:
                    update_request = UpdateStreamableHTTPMCPServer(
                        server_url=pydantic_mcp_server.server_url, token=pydantic_mcp_server.token
                    )
                else:
                    raise ValueError(f"Unsupported server type: {pydantic_mcp_server.server_type}")
                mcp_server = await self.update_mcp_server_by_id(mcp_server_id, update_request, actor)
            else:
                printd(
                    f"`create_or_update_mcp_server` was called with user_id={actor.id}, organization_id={actor.organization_id}, name={pydantic_mcp_server.server_name}, but found existing mcp server with nothing to update."
                )
                mcp_server = await self.get_mcp_server_by_id_async(mcp_server_id, actor=actor)
        else:
            mcp_server = await self.create_mcp_server(pydantic_mcp_server, actor=actor)

        return mcp_server

    @enforce_types
    async def create_mcp_server(self, pydantic_mcp_server: MCPServer, actor: PydanticUser) -> MCPServer:
        """Create a new MCP server."""
        async with db_registry.async_session() as session:
            # Set the organization id at the ORM layer
            pydantic_mcp_server.organization_id = actor.organization_id
            mcp_server_data = pydantic_mcp_server.model_dump(to_orm=True)

            # Ensure custom_headers None is stored as SQL NULL, not JSON null
            if mcp_server_data.get("custom_headers") is None:
                mcp_server_data.pop("custom_headers", None)

            mcp_server = MCPServerModel(**mcp_server_data)
            mcp_server = await mcp_server.create_async(session, actor=actor)
            return mcp_server.to_pydantic()

    @enforce_types
    async def update_mcp_server_by_id(self, mcp_server_id: str, mcp_server_update: UpdateMCPServer, actor: PydanticUser) -> MCPServer:
        """Update a tool by its ID with the given ToolUpdate object."""
        async with db_registry.async_session() as session:
            # Fetch the tool by ID
            mcp_server = await MCPServerModel.read_async(db_session=session, identifier=mcp_server_id, actor=actor)

            # Update tool attributes with only the fields that were explicitly set
            update_data = mcp_server_update.model_dump(to_orm=True, exclude_unset=True)

            # Ensure custom_headers None is stored as SQL NULL, not JSON null
            if update_data.get("custom_headers") is None:
                update_data.pop("custom_headers", None)
                setattr(mcp_server, "custom_headers", null())

            for key, value in update_data.items():
                setattr(mcp_server, key, value)

            mcp_server = await mcp_server.update_async(db_session=session, actor=actor)

            # Save the updated tool to the database mcp_server = await mcp_server.update_async(db_session=session, actor=actor)
            return mcp_server.to_pydantic()

    @enforce_types
    async def update_mcp_server_by_name(self, mcp_server_name: str, mcp_server_update: UpdateMCPServer, actor: PydanticUser) -> MCPServer:
        """Update an MCP server by its name."""
        mcp_server_id = await self.get_mcp_server_id_by_name(mcp_server_name, actor)
        if not mcp_server_id:
            raise HTTPException(
                status_code=404,
                detail={
                    "code": "MCPServerNotFoundError",
                    "message": f"MCP server {mcp_server_name} not found",
                    "mcp_server_name": mcp_server_name,
                },
            )
        return await self.update_mcp_server_by_id(mcp_server_id, mcp_server_update, actor)

    @enforce_types
    async def get_mcp_server_id_by_name(self, mcp_server_name: str, actor: PydanticUser) -> Optional[str]:
        """Retrieve a MCP server by its name and a user"""
        try:
            async with db_registry.async_session() as session:
                mcp_server = await MCPServerModel.read_async(db_session=session, server_name=mcp_server_name, actor=actor)
                return mcp_server.id
        except NoResultFound:
            return None

    @enforce_types
    async def get_mcp_server_by_id_async(self, mcp_server_id: str, actor: PydanticUser) -> MCPServer:
        """Fetch a tool by its ID."""
        async with db_registry.async_session() as session:
            # Retrieve tool by id using the Tool model's read method
            mcp_server = await MCPServerModel.read_async(db_session=session, identifier=mcp_server_id, actor=actor)
            # Convert the SQLAlchemy Tool object to PydanticTool
            return mcp_server.to_pydantic()

    @enforce_types
    async def get_mcp_servers_by_ids(self, mcp_server_ids: List[str], actor: PydanticUser) -> List[MCPServer]:
        """Fetch multiple MCP servers by their IDs in a single query."""
        if not mcp_server_ids:
            return []

        async with db_registry.async_session() as session:
            mcp_servers = await MCPServerModel.list_async(
                db_session=session, organization_id=actor.organization_id, id=mcp_server_ids  # This will use the IN operator
            )
            return [mcp_server.to_pydantic() for mcp_server in mcp_servers]

    @enforce_types
    async def get_mcp_server(self, mcp_server_name: str, actor: PydanticUser) -> PydanticTool:
        """Get a tool by name."""
        async with db_registry.async_session() as session:
            mcp_server_id = await self.get_mcp_server_id_by_name(mcp_server_name, actor)
            mcp_server = await MCPServerModel.read_async(db_session=session, identifier=mcp_server_id, actor=actor)
            if not mcp_server:
                raise HTTPException(
                    status_code=404,  # Not Found
                    detail={
                        "code": "MCPServerNotFoundError",
                        "message": f"MCP server {mcp_server_name} not found",
                        "mcp_server_name": mcp_server_name,
                    },
                )
            return mcp_server.to_pydantic()

    # @enforce_types
    # async def delete_mcp_server(self, mcp_server_name: str, actor: PydanticUser) -> None:
    #    """Delete an existing tool."""
    #    with db_registry.session() as session:
    #        mcp_server_id = await self.get_mcp_server_id_by_name(mcp_server_name, actor)
    #        mcp_server = await MCPServerModel.read_async(db_session=session, identifier=mcp_server_id, actor=actor)
    #        if not mcp_server:
    #            raise HTTPException(
    #                status_code=404,  # Not Found
    #                detail={
    #                    "code": "MCPServerNotFoundError",
    #                    "message": f"MCP server {mcp_server_name} not found",
    #                    "mcp_server_name": mcp_server_name,
    #                },
    #            )
    #        mcp_server.delete(session, actor=actor)  # Re-raise other database-related errors

    @enforce_types
    async def delete_mcp_server_by_id(self, mcp_server_id: str, actor: PydanticUser) -> None:
        """Delete a tool by its ID."""
        async with db_registry.async_session() as session:
            try:
                mcp_server = await MCPServerModel.read_async(db_session=session, identifier=mcp_server_id, actor=actor)
                await mcp_server.hard_delete_async(db_session=session, actor=actor)
            except NoResultFound:
                raise ValueError(f"MCP server with id {mcp_server_id} not found.")

    def read_mcp_config(self) -> dict[str, Union[SSEServerConfig, StdioServerConfig, StreamableHTTPServerConfig]]:
        mcp_server_list = {}

        # Attempt to read from ~/.letta/mcp_config.json
        mcp_config_path = os.path.join(constants.LETTA_DIR, constants.MCP_CONFIG_NAME)
        if os.path.exists(mcp_config_path):
            with open(mcp_config_path, "r") as f:
                try:
                    mcp_config = json.load(f)
                except Exception as e:
                    logger.error(f"Failed to parse MCP config file ({mcp_config_path}) as json: {e}")
                    return mcp_server_list

                # Proper formatting is "mcpServers" key at the top level,
                # then a dict with the MCP server name as the key,
                # with the value being the schema from StdioServerParameters
                if MCP_CONFIG_TOPLEVEL_KEY in mcp_config:
                    for server_name, server_params_raw in mcp_config[MCP_CONFIG_TOPLEVEL_KEY].items():

                        # No support for duplicate server names
                        if server_name in mcp_server_list:
                            logger.error(f"Duplicate MCP server name found (skipping): {server_name}")
                            continue

                        if "url" in server_params_raw:
                            # Attempt to parse the server params as an SSE server
                            try:
                                server_params = SSEServerConfig(
                                    server_name=server_name,
                                    server_url=server_params_raw["url"],
                                    auth_header=server_params_raw.get("auth_header", None),
                                    auth_token=server_params_raw.get("auth_token", None),
                                    headers=server_params_raw.get("headers", None),
                                )
                                mcp_server_list[server_name] = server_params
                            except Exception as e:
                                logger.error(f"Failed to parse server params for MCP server {server_name} (skipping): {e}")
                                continue
                        else:
                            # Attempt to parse the server params as a StdioServerParameters
                            try:
                                server_params = StdioServerConfig(
                                    server_name=server_name,
                                    command=server_params_raw["command"],
                                    args=server_params_raw.get("args", []),
                                    env=server_params_raw.get("env", {}),
                                )
                                mcp_server_list[server_name] = server_params
                            except Exception as e:
                                logger.error(f"Failed to parse server params for MCP server {server_name} (skipping): {e}")
                                continue
        return mcp_server_list

    async def get_mcp_client(
        self,
        server_config: Union[SSEServerConfig, StdioServerConfig, StreamableHTTPServerConfig],
        actor: PydanticUser,
        oauth_provider: Optional[Any] = None,
    ) -> Union[AsyncSSEMCPClient, AsyncStdioMCPClient, AsyncStreamableHTTPMCPClient]:
        """
        Helper function to create the appropriate MCP client based on server configuration.

        Args:
            server_config: The server configuration object
            actor: The user making the request
            oauth_provider: Optional OAuth provider for authentication

        Returns:
            The appropriate MCP client instance

        Raises:
            ValueError: If server config type is not supported
        """
        # If no OAuth provider is provided, check if we have stored OAuth credentials
        if oauth_provider is None and hasattr(server_config, "server_url"):
            oauth_session = await self.get_oauth_session_by_server(server_config.server_url, actor)
            if oauth_session and oauth_session.access_token:
                # Create OAuth provider from stored credentials
                from letta.services.mcp.oauth_utils import create_oauth_provider

                oauth_provider = await create_oauth_provider(
                    session_id=oauth_session.id,
                    server_url=oauth_session.server_url,
                    redirect_uri=oauth_session.redirect_uri,
                    mcp_manager=self,
                    actor=actor,
                )

        if server_config.type == MCPServerType.SSE:
            server_config = SSEServerConfig(**server_config.model_dump())
            return AsyncSSEMCPClient(server_config=server_config, oauth_provider=oauth_provider)
        elif server_config.type == MCPServerType.STDIO:
            server_config = StdioServerConfig(**server_config.model_dump())
            return AsyncStdioMCPClient(server_config=server_config, oauth_provider=oauth_provider)
        elif server_config.type == MCPServerType.STREAMABLE_HTTP:
            server_config = StreamableHTTPServerConfig(**server_config.model_dump())
            return AsyncStreamableHTTPMCPClient(server_config=server_config, oauth_provider=oauth_provider)
        else:
            raise ValueError(f"Unsupported server config type: {type(server_config)}")

    # OAuth-related methods
    @enforce_types
    async def create_oauth_session(self, session_create: MCPOAuthSessionCreate, actor: PydanticUser) -> MCPOAuthSession:
        """Create a new OAuth session for MCP server authentication."""
        async with db_registry.async_session() as session:
            # Create the OAuth session with a unique state
            oauth_session = MCPOAuth(
                id="mcp-oauth-" + str(uuid.uuid4())[:8],
                state=secrets.token_urlsafe(32),
                server_url=session_create.server_url,
                server_name=session_create.server_name,
                user_id=session_create.user_id,
                organization_id=session_create.organization_id,
                status=OAuthSessionStatus.PENDING,
                created_at=datetime.now(),
                updated_at=datetime.now(),
            )
            oauth_session = await oauth_session.create_async(session, actor=actor)

            # Convert to Pydantic model
            return MCPOAuthSession(
                id=oauth_session.id,
                state=oauth_session.state,
                server_url=oauth_session.server_url,
                server_name=oauth_session.server_name,
                user_id=oauth_session.user_id,
                organization_id=oauth_session.organization_id,
                status=oauth_session.status,
                created_at=oauth_session.created_at,
                updated_at=oauth_session.updated_at,
            )

    @enforce_types
    async def get_oauth_session_by_id(self, session_id: str, actor: PydanticUser) -> Optional[MCPOAuthSession]:
        """Get an OAuth session by its ID."""
        async with db_registry.async_session() as session:
            try:
                oauth_session = await MCPOAuth.read_async(db_session=session, identifier=session_id, actor=actor)
                return MCPOAuthSession(
                    id=oauth_session.id,
                    state=oauth_session.state,
                    server_url=oauth_session.server_url,
                    server_name=oauth_session.server_name,
                    user_id=oauth_session.user_id,
                    organization_id=oauth_session.organization_id,
                    authorization_url=oauth_session.authorization_url,
                    authorization_code=oauth_session.authorization_code,
                    access_token=oauth_session.access_token,
                    refresh_token=oauth_session.refresh_token,
                    token_type=oauth_session.token_type,
                    expires_at=oauth_session.expires_at,
                    scope=oauth_session.scope,
                    client_id=oauth_session.client_id,
                    client_secret=oauth_session.client_secret,
                    redirect_uri=oauth_session.redirect_uri,
                    status=oauth_session.status,
                    created_at=oauth_session.created_at,
                    updated_at=oauth_session.updated_at,
                )
            except NoResultFound:
                return None

    @enforce_types
    async def get_oauth_session_by_server(self, server_url: str, actor: PydanticUser) -> Optional[MCPOAuthSession]:
        """Get the latest OAuth session by server URL, organization, and user."""
        from sqlalchemy import desc, select

        async with db_registry.async_session() as session:
            # Query for OAuth session matching organization, user, server URL, and status
            # Order by updated_at desc to get the most recent record
            result = await session.execute(
                select(MCPOAuth)
                .where(
                    MCPOAuth.organization_id == actor.organization_id,
                    MCPOAuth.user_id == actor.id,
                    MCPOAuth.server_url == server_url,
                    MCPOAuth.status == OAuthSessionStatus.AUTHORIZED,
                )
                .order_by(desc(MCPOAuth.updated_at))
                .limit(1)
            )
            oauth_session = result.scalar_one_or_none()

            if not oauth_session:
                return None

            return MCPOAuthSession(
                id=oauth_session.id,
                state=oauth_session.state,
                server_url=oauth_session.server_url,
                server_name=oauth_session.server_name,
                user_id=oauth_session.user_id,
                organization_id=oauth_session.organization_id,
                authorization_url=oauth_session.authorization_url,
                authorization_code=oauth_session.authorization_code,
                access_token=oauth_session.access_token,
                refresh_token=oauth_session.refresh_token,
                token_type=oauth_session.token_type,
                expires_at=oauth_session.expires_at,
                scope=oauth_session.scope,
                client_id=oauth_session.client_id,
                client_secret=oauth_session.client_secret,
                redirect_uri=oauth_session.redirect_uri,
                status=oauth_session.status,
                created_at=oauth_session.created_at,
                updated_at=oauth_session.updated_at,
            )

    @enforce_types
    async def update_oauth_session(self, session_id: str, session_update: MCPOAuthSessionUpdate, actor: PydanticUser) -> MCPOAuthSession:
        """Update an existing OAuth session."""
        async with db_registry.async_session() as session:
            oauth_session = await MCPOAuth.read_async(db_session=session, identifier=session_id, actor=actor)

            # Update fields that are provided
            if session_update.authorization_url is not None:
                oauth_session.authorization_url = session_update.authorization_url
            if session_update.authorization_code is not None:
                oauth_session.authorization_code = session_update.authorization_code
            if session_update.access_token is not None:
                oauth_session.access_token = session_update.access_token
            if session_update.refresh_token is not None:
                oauth_session.refresh_token = session_update.refresh_token
            if session_update.token_type is not None:
                oauth_session.token_type = session_update.token_type
            if session_update.expires_at is not None:
                oauth_session.expires_at = session_update.expires_at
            if session_update.scope is not None:
                oauth_session.scope = session_update.scope
            if session_update.client_id is not None:
                oauth_session.client_id = session_update.client_id
            if session_update.client_secret is not None:
                oauth_session.client_secret = session_update.client_secret
            if session_update.redirect_uri is not None:
                oauth_session.redirect_uri = session_update.redirect_uri
            if session_update.status is not None:
                oauth_session.status = session_update.status

            # Always update the updated_at timestamp
            oauth_session.updated_at = datetime.now()

            oauth_session = await oauth_session.update_async(db_session=session, actor=actor)

            return MCPOAuthSession(
                id=oauth_session.id,
                state=oauth_session.state,
                server_url=oauth_session.server_url,
                server_name=oauth_session.server_name,
                user_id=oauth_session.user_id,
                organization_id=oauth_session.organization_id,
                authorization_url=oauth_session.authorization_url,
                authorization_code=oauth_session.authorization_code,
                access_token=oauth_session.access_token,
                refresh_token=oauth_session.refresh_token,
                token_type=oauth_session.token_type,
                expires_at=oauth_session.expires_at,
                scope=oauth_session.scope,
                client_id=oauth_session.client_id,
                client_secret=oauth_session.client_secret,
                redirect_uri=oauth_session.redirect_uri,
                status=oauth_session.status,
                created_at=oauth_session.created_at,
                updated_at=oauth_session.updated_at,
            )

    @enforce_types
    async def delete_oauth_session(self, session_id: str, actor: PydanticUser) -> None:
        """Delete an OAuth session."""
        async with db_registry.async_session() as session:
            try:
                oauth_session = await MCPOAuth.read_async(db_session=session, identifier=session_id, actor=actor)
                await oauth_session.hard_delete_async(db_session=session, actor=actor)
            except NoResultFound:
                raise ValueError(f"OAuth session with id {session_id} not found.")

    @enforce_types
    async def cleanup_expired_oauth_sessions(self, max_age_hours: int = 24) -> int:
        """Clean up expired OAuth sessions and return the count of deleted sessions."""
        cutoff_time = datetime.now() - timedelta(hours=max_age_hours)

        async with db_registry.async_session() as session:
            from sqlalchemy import select

            # Find expired sessions
            result = await session.execute(select(MCPOAuth).where(MCPOAuth.created_at < cutoff_time))
            expired_sessions = result.scalars().all()

            # Delete expired sessions using async ORM method
            for oauth_session in expired_sessions:
                await oauth_session.hard_delete_async(db_session=session, actor=None)

            if expired_sessions:
                logger.info(f"Cleaned up {len(expired_sessions)} expired OAuth sessions")

            return len(expired_sessions)
