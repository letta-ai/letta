import json
import os
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union

from fastapi import HTTPException
from sqlalchemy import delete, desc, null, select
from starlette.requests import Request

import letta.constants as constants
from letta.functions.mcp_client.types import (
    MCPServerType,
    MCPTool,
    MCPToolHealth,
    SSEServerConfig,
    StdioServerConfig,
    StreamableHTTPServerConfig,
)
from letta.functions.schema_generator import normalize_mcp_schema
from letta.functions.schema_validator import validate_complete_json_schema
from letta.log import get_logger
from letta.orm.errors import NoResultFound
from letta.orm.mcp_oauth import MCPOAuth, OAuthSessionStatus
from letta.orm.mcp_server import MCPServer as MCPServerModel
from letta.orm.tool import Tool as ToolModel
from letta.schemas.enums import PrimitiveType
from letta.schemas.mcp import (
    MCPOAuthSession,
    MCPOAuthSessionCreate,
    MCPOAuthSessionUpdate,
    MCPServer,
    MCPServerResyncResult,
    UpdateMCPServer,
    UpdateSSEMCPServer,
    UpdateStdioMCPServer,
    UpdateStreamableHTTPMCPServer,
)
from letta.schemas.secret import Secret
from letta.schemas.tool import Tool as PydanticTool, ToolCreate, ToolUpdate
from letta.schemas.user import User as PydanticUser
from letta.server.db import db_registry
from letta.services.mcp.base_client import AsyncBaseMCPClient
from letta.services.mcp.sse_client import MCP_CONFIG_TOPLEVEL_KEY, AsyncSSEMCPClient
from letta.services.mcp.stdio_client import AsyncStdioMCPClient
from letta.services.mcp.streamable_http_client import AsyncStreamableHTTPMCPClient
from letta.services.tool_manager import ToolManager
from letta.settings import settings, tool_settings
from letta.utils import enforce_types, printd, safe_create_task_with_return
from letta.validators import raise_on_invalid_id

logger = get_logger(__name__)


class MCPManager:
    """Manager class to handle business logic related to MCP."""

    def __init__(self):
        # TODO: timeouts?
        self.tool_manager = ToolManager()
        self.cached_mcp_servers = {}  # maps id -> async connection

    @enforce_types
    @raise_on_invalid_id(param_name="agent_id", expected_prefix=PrimitiveType.AGENT)
    async def list_mcp_server_tools(self, mcp_server_name: str, actor: PydanticUser, agent_id: Optional[str] = None) -> List[MCPTool]:
        """Get a list of all tools for a specific MCP server."""
        mcp_client = None
        try:
            mcp_server_id = await self.get_mcp_server_id_by_name(mcp_server_name, actor=actor)
            mcp_config = await self.get_mcp_server_by_id_async(mcp_server_id, actor=actor)
            server_config = mcp_config.to_config()
            mcp_client = await self.get_mcp_client(server_config, actor, agent_id=agent_id)
            await mcp_client.connect_to_server()

            # list tools
            tools = await mcp_client.list_tools()
            # Add health information to each tool
            for tool in tools:
                # Try to normalize the schema and re-validate
                if tool.inputSchema:
                    tool.inputSchema = normalize_mcp_schema(tool.inputSchema)
                    health_status, reasons = validate_complete_json_schema(tool.inputSchema)
                    tool.health = MCPToolHealth(status=health_status.value, reasons=reasons)

            return tools
        except Exception as e:
            # MCP tool listing errors are often due to connection/configuration issues, not system errors
            # Log at info level to avoid triggering Sentry alerts for expected failures
            logger.warning(f"Error listing tools for MCP server {mcp_server_name}: {e}")
            raise e
        finally:
            if mcp_client:
                try:
                    await mcp_client.cleanup()
                except* Exception as eg:
                    for e in eg.exceptions:
                        logger.warning(f"Error listing tools for MCP server {mcp_server_name}: {e}")
                        raise e

    @enforce_types
    async def execute_mcp_server_tool(
        self,
        mcp_server_name: str,
        tool_name: str,
        tool_args: Optional[Dict[str, Any]],
        environment_variables: Dict[str, str],
        actor: PydanticUser,
        agent_id: Optional[str] = None,
    ) -> Tuple[str, bool]:
        """Call a specific tool from a specific MCP server."""
        mcp_client = None
        try:
            if not tool_settings.mcp_read_from_config:
                # read from DB
                mcp_server_id = await self.get_mcp_server_id_by_name(mcp_server_name, actor=actor)
                mcp_config = await self.get_mcp_server_by_id_async(mcp_server_id, actor=actor)
                server_config = mcp_config.to_config(environment_variables)
            else:
                # read from config file
                mcp_config = self.read_mcp_config()
                if mcp_server_name not in mcp_config:
                    raise ValueError(f"MCP server {mcp_server_name} not found in config.")
                server_config = mcp_config[mcp_server_name]

            mcp_client = await self.get_mcp_client(server_config, actor, agent_id=agent_id)
            await mcp_client.connect_to_server()

            # call tool
            result, success = await mcp_client.execute_tool(tool_name, tool_args)
            logger.info(f"MCP Result: {result}, Success: {success}")
            # TODO: change to pydantic tool
            return result, success
        finally:
            if mcp_client:
                await mcp_client.cleanup()

    @enforce_types
    async def add_tool_from_mcp_server(self, mcp_server_name: str, mcp_tool_name: str, actor: PydanticUser) -> PydanticTool:
        """Add a tool from an MCP server to the Letta tool registry."""
        # get the MCP server ID, we should migrate to use the server_id instead of the name
        mcp_server_id = await self.get_mcp_server_id_by_name(mcp_server_name, actor=actor)
        if not mcp_server_id:
            raise ValueError(f"MCP server '{mcp_server_name}' not found")

        mcp_tools = await self.list_mcp_server_tools(mcp_server_name, actor=actor)
        for mcp_tool in mcp_tools:
            # TODO: @jnjpng move health check to tool class
            if mcp_tool.name == mcp_tool_name:
                # Check tool health - but try normalization first for INVALID schemas
                if mcp_tool.health and mcp_tool.health.status == "INVALID":
                    logger.info(f"Attempting to normalize INVALID schema for tool {mcp_tool_name}")
                    logger.info(f"Original health reasons: {mcp_tool.health.reasons}")

                    # Try to normalize the schema and re-validate
                    try:
                        # Normalize the schema to fix common issues
                        logger.debug(f"Normalizing schema for {mcp_tool_name}")
                        normalized_schema = normalize_mcp_schema(mcp_tool.inputSchema)

                        # Re-validate after normalization
                        logger.debug(f"Re-validating schema for {mcp_tool_name}")
                        health_status, health_reasons = validate_complete_json_schema(normalized_schema)
                        logger.info(f"After normalization: status={health_status.value}, reasons={health_reasons}")

                        # Update the tool's schema and health (use inputSchema, not input_schema)
                        mcp_tool.inputSchema = normalized_schema
                        mcp_tool.health.status = health_status.value
                        mcp_tool.health.reasons = health_reasons

                        # Log the normalization result
                        if health_status.value != "INVALID":
                            logger.info(f"✓ MCP tool {mcp_tool_name} schema normalized successfully: {health_status.value}")
                        else:
                            logger.warning(f"MCP tool {mcp_tool_name} still INVALID after normalization. Reasons: {health_reasons}")
                    except Exception as e:
                        logger.error(f"Failed to normalize schema for tool {mcp_tool_name}: {e}", exc_info=True)

                # After normalization attempt, check if still INVALID
                if mcp_tool.health and mcp_tool.health.status == "INVALID":
                    logger.warning(f"Tool {mcp_tool_name} has potentially invalid schema. Reasons: {', '.join(mcp_tool.health.reasons)}")

                tool_create = ToolCreate.from_mcp(mcp_server_name=mcp_server_name, mcp_tool=mcp_tool)
                return await self.tool_manager.create_mcp_tool_async(
                    tool_create=tool_create, mcp_server_name=mcp_server_name, mcp_server_id=mcp_server_id, actor=actor
                )

        # failed to add - handle error?
        return None

    @enforce_types
    async def resync_mcp_server_tools(
        self, mcp_server_name: str, actor: PydanticUser, agent_id: Optional[str] = None
    ) -> MCPServerResyncResult:
        """
        Resync tools for an MCP server by:
        1. Fetching current tools from the MCP server
        2. Deleting tools that no longer exist on the server
        3. Updating schemas for existing tools
        4. Adding new tools from the server

        Returns a result with:
        - deleted: List of deleted tool names
        - updated: List of updated tool names
        - added: List of added tool names
        """
        # Get the MCP server ID
        mcp_server_id = await self.get_mcp_server_id_by_name(mcp_server_name, actor=actor)
        if not mcp_server_id:
            raise ValueError(f"MCP server '{mcp_server_name}' not found")

        # Fetch current tools from MCP server
        try:
            current_mcp_tools = await self.list_mcp_server_tools(mcp_server_name, actor=actor, agent_id=agent_id)
        except Exception as e:
            logger.error(f"Failed to fetch tools from MCP server {mcp_server_name}: {e}")
            raise HTTPException(
                status_code=404,
                detail={
                    "code": "MCPServerUnavailable",
                    "message": f"Could not connect to MCP server {mcp_server_name} to resync tools",
                    "error": str(e),
                },
            )

        # Get all persisted tools for this MCP server
        async with db_registry.async_session() as session:
            # Query for tools with MCP metadata matching this server
            # Using JSON path query to filter by metadata
            persisted_tools = await ToolModel.list_async(
                db_session=session,
                organization_id=actor.organization_id,
            )

            # Filter tools that belong to this MCP server
            mcp_tools = []
            for tool in persisted_tools:
                if tool.metadata_ and constants.MCP_TOOL_TAG_NAME_PREFIX in tool.metadata_:
                    if tool.metadata_[constants.MCP_TOOL_TAG_NAME_PREFIX].get("server_id") == mcp_server_id:
                        mcp_tools.append(tool)

            # Create maps for easier comparison
            current_tool_map = {tool.name: tool for tool in current_mcp_tools}
            persisted_tool_map = {tool.name: tool for tool in mcp_tools}

            deleted_tools = []
            updated_tools = []
            added_tools = []

            # 1. Delete tools that no longer exist on the server
            for tool_name, persisted_tool in persisted_tool_map.items():
                if tool_name not in current_tool_map:
                    # Delete the tool (cascade will handle agent detachment)
                    await persisted_tool.hard_delete_async(db_session=session, actor=actor)
                    deleted_tools.append(tool_name)
                    logger.info(f"Deleted MCP tool {tool_name} as it no longer exists on server {mcp_server_name}")

            # Commit deletions
            await session.commit()

        # 2. Update existing tools and add new tools
        for tool_name, current_tool in current_tool_map.items():
            if tool_name in persisted_tool_map:
                # Update existing tool
                persisted_tool = persisted_tool_map[tool_name]
                tool_create = ToolCreate.from_mcp(mcp_server_name=mcp_server_name, mcp_tool=current_tool)

                # Check if schema has changed
                if persisted_tool.json_schema != tool_create.json_schema:
                    # Update the tool
                    update_data = ToolUpdate(
                        description=tool_create.description,
                        json_schema=tool_create.json_schema,
                        source_code=tool_create.source_code,
                    )

                    await self.tool_manager.update_tool_by_id_async(tool_id=persisted_tool.id, tool_update=update_data, actor=actor)
                    updated_tools.append(tool_name)
                    logger.info(f"Updated MCP tool {tool_name} with new schema from server {mcp_server_name}")
            else:
                # Add new tool
                # Skip INVALID tools
                if current_tool.health and current_tool.health.status == "INVALID":
                    logger.warning(
                        f"Skipping invalid tool {tool_name} from MCP server {mcp_server_name}: {', '.join(current_tool.health.reasons)}"
                    )
                    continue

                tool_create = ToolCreate.from_mcp(mcp_server_name=mcp_server_name, mcp_tool=current_tool)
                await self.tool_manager.create_mcp_tool_async(
                    tool_create=tool_create, mcp_server_name=mcp_server_name, mcp_server_id=mcp_server_id, actor=actor
                )
                added_tools.append(tool_name)
                logger.info(f"Added new MCP tool {tool_name} from server {mcp_server_name}")

        return MCPServerResyncResult(
            deleted=deleted_tools,
            updated=updated_tools,
            added=added_tools,
        )

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
            # TODO: pass in custom headers for update as well?
            if update_data:
                if pydantic_mcp_server.server_type == MCPServerType.SSE:
                    update_request = UpdateSSEMCPServer(server_url=pydantic_mcp_server.server_url, token=pydantic_mcp_server.token)
                elif pydantic_mcp_server.server_type == MCPServerType.STDIO:
                    update_request = UpdateStdioMCPServer(stdio_config=pydantic_mcp_server.stdio_config)
                elif pydantic_mcp_server.server_type == MCPServerType.STREAMABLE_HTTP:
                    update_request = UpdateStreamableHTTPMCPServer(
                        server_url=pydantic_mcp_server.server_url, auth_token=pydantic_mcp_server.token
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
            try:
                # Set the organization id at the ORM layer
                pydantic_mcp_server.organization_id = actor.organization_id

                # Explicitly populate encrypted fields
                if pydantic_mcp_server.token is not None:
                    pydantic_mcp_server.token_enc = Secret.from_plaintext(pydantic_mcp_server.token)
                if pydantic_mcp_server.custom_headers is not None:
                    # custom_headers is a Dict[str, str], serialize to JSON then encrypt
                    import json

                    json_str = json.dumps(pydantic_mcp_server.custom_headers)
                    pydantic_mcp_server.custom_headers_enc = Secret.from_plaintext(json_str)

                mcp_server_data = pydantic_mcp_server.model_dump(to_orm=True)

                # Ensure custom_headers None is stored as SQL NULL, not JSON null
                if mcp_server_data.get("custom_headers") is None:
                    mcp_server_data.pop("custom_headers", None)

                mcp_server = MCPServerModel(**mcp_server_data)
                mcp_server = await mcp_server.create_async(session, actor=actor, no_commit=True)

                # Link existing OAuth sessions for the same user and server URL
                # This ensures OAuth sessions created during testing get linked to the server
                server_url = getattr(mcp_server, "server_url", None)
                if server_url:
                    result = await session.execute(
                        select(MCPOAuth).where(
                            MCPOAuth.server_url == server_url,
                            MCPOAuth.organization_id == actor.organization_id,
                            MCPOAuth.user_id == actor.id,  # Only link sessions for the same user
                            MCPOAuth.server_id.is_(None),  # Only update sessions not already linked
                        )
                    )
                    oauth_sessions = result.scalars().all()

                    # TODO: @jnjpng we should upate sessions in bulk
                    for oauth_session in oauth_sessions:
                        oauth_session.server_id = mcp_server.id
                        await oauth_session.update_async(db_session=session, actor=actor, no_commit=True)

                    if oauth_sessions:
                        logger.info(
                            f"Linked {len(oauth_sessions)} OAuth sessions to MCP server {mcp_server.id} (URL: {server_url}) for user {actor.id}"
                        )

                await session.commit()
                return mcp_server.to_pydantic()
            except Exception as e:
                await session.rollback()
                raise

    @enforce_types
    async def create_mcp_server_from_config(
        self, server_config: Union[StdioServerConfig, SSEServerConfig, StreamableHTTPServerConfig], actor: PydanticUser
    ) -> MCPServer:
        """
        Create an MCP server from a config object, handling encryption of sensitive fields.

        This method converts the server config to an MCPServer model and encrypts
        sensitive fields like tokens and custom headers.
        """
        # Create base MCPServer object
        if isinstance(server_config, StdioServerConfig):
            mcp_server = MCPServer(server_name=server_config.server_name, server_type=server_config.type, stdio_config=server_config)
        elif isinstance(server_config, SSEServerConfig):
            mcp_server = MCPServer(
                server_name=server_config.server_name,
                server_type=server_config.type,
                server_url=server_config.server_url,
            )
            # Encrypt sensitive fields
            token = server_config.resolve_token()
            if token:
                token_secret = Secret.from_plaintext(token)
                mcp_server.set_token_secret(token_secret)
            if server_config.custom_headers:
                # Convert dict to JSON string, then encrypt as Secret
                headers_json = json.dumps(server_config.custom_headers)
                headers_secret = Secret.from_plaintext(headers_json)
                mcp_server.set_custom_headers_secret(headers_secret)

        elif isinstance(server_config, StreamableHTTPServerConfig):
            mcp_server = MCPServer(
                server_name=server_config.server_name,
                server_type=server_config.type,
                server_url=server_config.server_url,
            )
            # Encrypt sensitive fields
            token = server_config.resolve_token()
            if token:
                token_secret = Secret.from_plaintext(token)
                mcp_server.set_token_secret(token_secret)
            if server_config.custom_headers:
                # Convert dict to JSON string, then encrypt as Secret
                headers_json = json.dumps(server_config.custom_headers)
                headers_secret = Secret.from_plaintext(headers_json)
                mcp_server.set_custom_headers_secret(headers_secret)
        else:
            raise ValueError(f"Unsupported server config type: {type(server_config)}")

        return mcp_server

    @enforce_types
    async def create_mcp_server_from_config_with_tools(
        self, server_config: Union[StdioServerConfig, SSEServerConfig, StreamableHTTPServerConfig], actor: PydanticUser
    ) -> MCPServer:
        """
        Create an MCP server from a config object and optimistically sync its tools.

        This method handles encryption of sensitive fields and then creates the server
        with automatic tool synchronization.
        """
        # Convert config to MCPServer with encryption
        mcp_server = await self.create_mcp_server_from_config(server_config, actor)

        # Create the server with tools
        return await self.create_mcp_server_with_tools(mcp_server, actor)

    @enforce_types
    async def create_mcp_server_with_tools(self, pydantic_mcp_server: MCPServer, actor: PydanticUser) -> MCPServer:
        """
        Create a new MCP server and optimistically sync its tools.

        This method:
        1. Creates the MCP server record
        2. Attempts to connect and fetch tools
        3. Persists valid tools in parallel (best-effort)
        """
        import asyncio

        # First, create the MCP server
        created_server = await self.create_mcp_server(pydantic_mcp_server, actor)

        # Optimistically try to sync tools
        try:
            logger.info(f"Attempting to auto-sync tools from MCP server: {created_server.server_name}")

            # List all tools from the MCP server
            mcp_tools = await self.list_mcp_server_tools(mcp_server_name=created_server.server_name, actor=actor)

            # Filter out invalid tools
            valid_tools = [tool for tool in mcp_tools if not (tool.health and tool.health.status == "INVALID")]

            # Register in parallel
            if valid_tools:
                tool_tasks = []
                for mcp_tool in valid_tools:
                    tool_create = ToolCreate.from_mcp(mcp_server_name=created_server.server_name, mcp_tool=mcp_tool)
                    task = self.tool_manager.create_mcp_tool_async(
                        tool_create=tool_create, mcp_server_name=created_server.server_name, mcp_server_id=created_server.id, actor=actor
                    )
                    tool_tasks.append(task)

                results = await asyncio.gather(*tool_tasks, return_exceptions=True)

                successful = sum(1 for r in results if not isinstance(r, Exception))
                failed = len(results) - successful
                logger.info(
                    f"Auto-sync completed for MCP server {created_server.server_name}: "
                    f"{successful} tools persisted, {failed} failed, "
                    f"{len(mcp_tools) - len(valid_tools)} invalid tools skipped"
                )
            else:
                logger.info(f"No valid tools found to sync from MCP server {created_server.server_name}")

        except Exception as e:
            # Log the error but don't fail the server creation
            logger.warning(
                f"Failed to auto-sync tools from MCP server {created_server.server_name}: {e}. "
                f"Server was created successfully but tools were not persisted."
            )

        return created_server

    @enforce_types
    async def update_mcp_server_by_id(self, mcp_server_id: str, mcp_server_update: UpdateMCPServer, actor: PydanticUser) -> MCPServer:
        """Update a tool by its ID with the given ToolUpdate object."""
        async with db_registry.async_session() as session:
            # Fetch the tool by ID
            mcp_server = await MCPServerModel.read_async(db_session=session, identifier=mcp_server_id, actor=actor)

            # Update tool attributes with only the fields that were explicitly set
            update_data = mcp_server_update.model_dump(to_orm=True, exclude_unset=True)

            # Handle encryption for token if provided
            # Only re-encrypt if the value has actually changed
            if "token" in update_data and update_data["token"] is not None:
                # Check if value changed
                existing_token = None
                if mcp_server.token_enc:
                    existing_secret = Secret.from_encrypted(mcp_server.token_enc)
                    existing_token = existing_secret.get_plaintext()
                elif mcp_server.token:
                    existing_token = mcp_server.token

                # Only re-encrypt if different
                if existing_token != update_data["token"]:
                    mcp_server.token_enc = Secret.from_plaintext(update_data["token"]).get_encrypted()
                    # Keep plaintext for dual-write during migration
                    mcp_server.token = update_data["token"]

                # Remove from update_data since we set directly on mcp_server
                update_data.pop("token", None)
                update_data.pop("token_enc", None)

            # Handle encryption for custom_headers if provided
            # Only re-encrypt if the value has actually changed
            if "custom_headers" in update_data:
                if update_data["custom_headers"] is not None:
                    # custom_headers is a Dict[str, str], serialize to JSON then encrypt
                    import json

                    json_str = json.dumps(update_data["custom_headers"])

                    # Check if value changed
                    existing_headers_json = None
                    if mcp_server.custom_headers_enc:
                        existing_secret = Secret.from_encrypted(mcp_server.custom_headers_enc)
                        existing_headers_json = existing_secret.get_plaintext()
                    elif mcp_server.custom_headers:
                        existing_headers_json = json.dumps(mcp_server.custom_headers)

                    # Only re-encrypt if different
                    if existing_headers_json != json_str:
                        mcp_server.custom_headers_enc = Secret.from_plaintext(json_str).get_encrypted()
                        # Keep plaintext for dual-write during migration
                        mcp_server.custom_headers = update_data["custom_headers"]

                    # Remove from update_data since we set directly on mcp_server
                    update_data.pop("custom_headers", None)
                    update_data.pop("custom_headers_enc", None)
                else:
                    # Ensure custom_headers None is stored as SQL NULL, not JSON null
                    update_data.pop("custom_headers", None)
                    setattr(mcp_server, "custom_headers", null())
                    setattr(mcp_server, "custom_headers_enc", None)

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
                db_session=session,
                organization_id=actor.organization_id,
                id=mcp_server_ids,  # This will use the IN operator
            )
            return [mcp_server.to_pydantic() for mcp_server in mcp_servers]

    @enforce_types
    async def get_mcp_server(self, mcp_server_name: str, actor: PydanticUser) -> PydanticTool:
        """Get a MCP server by name."""
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

    @enforce_types
    async def delete_mcp_server_by_id(self, mcp_server_id: str, actor: PydanticUser) -> None:
        """Delete a MCP server by its ID and associated tools and OAuth sessions."""
        async with db_registry.async_session() as session:
            try:
                mcp_server = await MCPServerModel.read_async(db_session=session, identifier=mcp_server_id, actor=actor)
                if not mcp_server:
                    raise NoResultFound(f"MCP server with id {mcp_server_id} not found.")

                server_url = getattr(mcp_server, "server_url", None)
                # Get all tools with matching metadata
                stmt = select(ToolModel).where(ToolModel.organization_id == actor.organization_id)
                result = await session.execute(stmt)
                all_tools = result.scalars().all()

                # Filter and delete tools that belong to this MCP server
                tools_deleted = 0
                for tool in all_tools:
                    if tool.metadata_ and constants.MCP_TOOL_TAG_NAME_PREFIX in tool.metadata_:
                        if tool.metadata_[constants.MCP_TOOL_TAG_NAME_PREFIX].get("server_id") == mcp_server_id:
                            await tool.hard_delete_async(db_session=session, actor=actor)
                            tools_deleted = 1
                            logger.info(f"Deleted MCP tool {tool.name} associated with MCP server {mcp_server_id}")

                if tools_deleted > 0:
                    logger.info(f"Deleted {tools_deleted} MCP tools associated with MCP server {mcp_server_id}")

                # Delete OAuth sessions for the same user and server URL in the same transaction
                # This handles orphaned sessions that were created during testing/connection
                oauth_count = 0
                if server_url:
                    result = await session.execute(
                        delete(MCPOAuth).where(
                            MCPOAuth.server_url == server_url,
                            MCPOAuth.organization_id == actor.organization_id,
                            MCPOAuth.user_id == actor.id,  # Only delete sessions for the same user
                        )
                    )
                    oauth_count = result.rowcount
                    if oauth_count > 0:
                        logger.info(
                            f"Deleting {oauth_count} OAuth sessions for MCP server {mcp_server_id} (URL: {server_url}) for user {actor.id}"
                        )

                # Delete the MCP server, will cascade delete to linked OAuth sessions
                await session.execute(
                    delete(MCPServerModel).where(
                        MCPServerModel.id == mcp_server_id,
                        MCPServerModel.organization_id == actor.organization_id,
                    )
                )

                await session.commit()
            except NoResultFound:
                await session.rollback()
                raise ValueError(f"MCP server with id {mcp_server_id} not found.")
            except Exception as e:
                await session.rollback()
                logger.error(f"Failed to delete MCP server {mcp_server_id}: {e}")
                raise

    def read_mcp_config(self) -> dict[str, Union[SSEServerConfig, StdioServerConfig, StreamableHTTPServerConfig]]:
        mcp_server_list = {}

        # Attempt to read from ~/.letta/mcp_config.json
        mcp_config_path = os.path.join(constants.LETTA_DIR, constants.MCP_CONFIG_NAME)
        if os.path.exists(mcp_config_path):
            with open(mcp_config_path, "r") as f:
                try:
                    mcp_config = json.load(f)
                except Exception as e:
                    # Config parsing errors are user configuration issues, not system errors
                    logger.warning(f"Failed to parse MCP config file ({mcp_config_path}) as json: {e}")
                    return mcp_server_list

                # Proper formatting is "mcpServers" key at the top level,
                # then a dict with the MCP server name as the key,
                # with the value being the schema from StdioServerParameters
                if MCP_CONFIG_TOPLEVEL_KEY in mcp_config:
                    for server_name, server_params_raw in mcp_config[MCP_CONFIG_TOPLEVEL_KEY].items():
                        # No support for duplicate server names
                        if server_name in mcp_server_list:
                            # Duplicate server names are configuration issues, not system errors
                            logger.warning(f"Duplicate MCP server name found (skipping): {server_name}")
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
                                # Config parsing errors are user configuration issues, not system errors
                                logger.warning(f"Failed to parse server params for MCP server {server_name} (skipping): {e}")
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
                                # Config parsing errors are user configuration issues, not system errors
                                logger.warning(f"Failed to parse server params for MCP server {server_name} (skipping): {e}")
                                continue
        return mcp_server_list

    async def get_mcp_client(
        self,
        server_config: Union[SSEServerConfig, StdioServerConfig, StreamableHTTPServerConfig],
        actor: PydanticUser,
        oauth_provider: Optional[Any] = None,
        agent_id: Optional[str] = None,
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
            # Check if access token exists by attempting to decrypt it
            if oauth_session and oauth_session.get_access_token_secret().get_plaintext():
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
            return AsyncSSEMCPClient(server_config=server_config, oauth_provider=oauth_provider, agent_id=agent_id)
        elif server_config.type == MCPServerType.STDIO:
            server_config = StdioServerConfig(**server_config.model_dump())
            return AsyncStdioMCPClient(server_config=server_config, oauth_provider=oauth_provider, agent_id=agent_id)
        elif server_config.type == MCPServerType.STREAMABLE_HTTP:
            server_config = StreamableHTTPServerConfig(**server_config.model_dump())
            return AsyncStreamableHTTPMCPClient(server_config=server_config, oauth_provider=oauth_provider, agent_id=agent_id)
        else:
            raise ValueError(f"Unsupported server config type: {type(server_config)}")

    # OAuth-related methods
    def _oauth_orm_to_pydantic(self, oauth_session: MCPOAuth) -> MCPOAuthSession:
        """
        Convert OAuth ORM model to Pydantic model, handling decryption of sensitive fields.
        """
        # Get decrypted values using the dual-read approach
        # Secret.from_db() will automatically use settings.encryption_key if available
        access_token = None
        if oauth_session.access_token_enc or oauth_session.access_token:
            if settings.encryption_key:
                secret = Secret.from_db(oauth_session.access_token_enc, oauth_session.access_token)
                access_token = secret.get_plaintext()
            else:
                # No encryption key, use plaintext if available
                access_token = oauth_session.access_token

        refresh_token = None
        if oauth_session.refresh_token_enc or oauth_session.refresh_token:
            if settings.encryption_key:
                secret = Secret.from_db(oauth_session.refresh_token_enc, oauth_session.refresh_token)
                refresh_token = secret.get_plaintext()
            else:
                # No encryption key, use plaintext if available
                refresh_token = oauth_session.refresh_token

        client_secret = None
        if oauth_session.client_secret_enc or oauth_session.client_secret:
            if settings.encryption_key:
                secret = Secret.from_db(oauth_session.client_secret_enc, oauth_session.client_secret)
                client_secret = secret.get_plaintext()
            else:
                # No encryption key, use plaintext if available
                client_secret = oauth_session.client_secret

        authorization_code = None
        if oauth_session.authorization_code_enc or oauth_session.authorization_code:
            if settings.encryption_key:
                secret = Secret.from_db(oauth_session.authorization_code_enc, oauth_session.authorization_code)
                authorization_code = secret.get_plaintext()
            else:
                # No encryption key, use plaintext if available
                authorization_code = oauth_session.authorization_code

        # Create the Pydantic object with encrypted fields as Secret objects
        pydantic_session = MCPOAuthSession(
            id=oauth_session.id,
            state=oauth_session.state,
            server_id=oauth_session.server_id,
            server_url=oauth_session.server_url,
            server_name=oauth_session.server_name,
            user_id=oauth_session.user_id,
            organization_id=oauth_session.organization_id,
            authorization_url=oauth_session.authorization_url,
            authorization_code=authorization_code,
            access_token=access_token,
            refresh_token=refresh_token,
            token_type=oauth_session.token_type,
            expires_at=oauth_session.expires_at,
            scope=oauth_session.scope,
            client_id=oauth_session.client_id,
            client_secret=client_secret,
            redirect_uri=oauth_session.redirect_uri,
            status=oauth_session.status,
            created_at=oauth_session.created_at,
            updated_at=oauth_session.updated_at,
            # Encrypted fields as Secret objects (converted from encrypted strings in DB)
            authorization_code_enc=Secret.from_encrypted(oauth_session.authorization_code_enc)
            if oauth_session.authorization_code_enc
            else None,
            access_token_enc=Secret.from_encrypted(oauth_session.access_token_enc) if oauth_session.access_token_enc else None,
            refresh_token_enc=Secret.from_encrypted(oauth_session.refresh_token_enc) if oauth_session.refresh_token_enc else None,
            client_secret_enc=Secret.from_encrypted(oauth_session.client_secret_enc) if oauth_session.client_secret_enc else None,
        )
        return pydantic_session

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

            # Convert to Pydantic model - note: new sessions won't have tokens yet
            return self._oauth_orm_to_pydantic(oauth_session)

    @enforce_types
    async def get_oauth_session_by_id(self, session_id: str, actor: PydanticUser) -> Optional[MCPOAuthSession]:
        """Get an OAuth session by its ID."""
        async with db_registry.async_session() as session:
            try:
                oauth_session = await MCPOAuth.read_async(db_session=session, identifier=session_id, actor=actor)
                return self._oauth_orm_to_pydantic(oauth_session)
            except NoResultFound:
                return None

    @enforce_types
    async def get_oauth_session_by_server(self, server_url: str, actor: PydanticUser) -> Optional[MCPOAuthSession]:
        """Get the latest OAuth session by server URL, organization, and user."""
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

            return self._oauth_orm_to_pydantic(oauth_session)

    @enforce_types
    async def update_oauth_session(self, session_id: str, session_update: MCPOAuthSessionUpdate, actor: PydanticUser) -> MCPOAuthSession:
        """Update an existing OAuth session."""
        async with db_registry.async_session() as session:
            oauth_session = await MCPOAuth.read_async(db_session=session, identifier=session_id, actor=actor)

            # Update fields that are provided
            if session_update.authorization_url is not None:
                oauth_session.authorization_url = session_update.authorization_url

            # Handle encryption for authorization_code
            # Only re-encrypt if the value has actually changed
            if session_update.authorization_code is not None:
                # Check if value changed
                existing_code = None
                if oauth_session.authorization_code_enc:
                    existing_secret = Secret.from_encrypted(oauth_session.authorization_code_enc)
                    existing_code = existing_secret.get_plaintext()
                elif oauth_session.authorization_code:
                    existing_code = oauth_session.authorization_code

                # Only re-encrypt if different
                if existing_code != session_update.authorization_code:
                    oauth_session.authorization_code_enc = Secret.from_plaintext(session_update.authorization_code).get_encrypted()
                    # Keep plaintext for dual-write during migration
                    oauth_session.authorization_code = session_update.authorization_code

            # Handle encryption for access_token
            # Only re-encrypt if the value has actually changed
            if session_update.access_token is not None:
                # Check if value changed
                existing_token = None
                if oauth_session.access_token_enc:
                    existing_secret = Secret.from_encrypted(oauth_session.access_token_enc)
                    existing_token = existing_secret.get_plaintext()
                elif oauth_session.access_token:
                    existing_token = oauth_session.access_token

                # Only re-encrypt if different
                if existing_token != session_update.access_token:
                    oauth_session.access_token_enc = Secret.from_plaintext(session_update.access_token).get_encrypted()
                    # Keep plaintext for dual-write during migration
                    oauth_session.access_token = session_update.access_token

            # Handle encryption for refresh_token
            # Only re-encrypt if the value has actually changed
            if session_update.refresh_token is not None:
                # Check if value changed
                existing_refresh = None
                if oauth_session.refresh_token_enc:
                    existing_secret = Secret.from_encrypted(oauth_session.refresh_token_enc)
                    existing_refresh = existing_secret.get_plaintext()
                elif oauth_session.refresh_token:
                    existing_refresh = oauth_session.refresh_token

                # Only re-encrypt if different
                if existing_refresh != session_update.refresh_token:
                    oauth_session.refresh_token_enc = Secret.from_plaintext(session_update.refresh_token).get_encrypted()
                    # Keep plaintext for dual-write during migration
                    oauth_session.refresh_token = session_update.refresh_token

            if session_update.token_type is not None:
                oauth_session.token_type = session_update.token_type
            if session_update.expires_at is not None:
                oauth_session.expires_at = session_update.expires_at
            if session_update.scope is not None:
                oauth_session.scope = session_update.scope
            if session_update.client_id is not None:
                oauth_session.client_id = session_update.client_id

            # Handle encryption for client_secret
            # Only re-encrypt if the value has actually changed
            if session_update.client_secret is not None:
                # Check if value changed
                existing_secret_val = None
                if oauth_session.client_secret_enc:
                    existing_secret = Secret.from_encrypted(oauth_session.client_secret_enc)
                    existing_secret_val = existing_secret.get_plaintext()
                elif oauth_session.client_secret:
                    existing_secret_val = oauth_session.client_secret

                # Only re-encrypt if different
                if existing_secret_val != session_update.client_secret:
                    oauth_session.client_secret_enc = Secret.from_plaintext(session_update.client_secret).get_encrypted()
                    # Keep plaintext for dual-write during migration
                    oauth_session.client_secret = session_update.client_secret

            if session_update.redirect_uri is not None:
                oauth_session.redirect_uri = session_update.redirect_uri
            if session_update.status is not None:
                oauth_session.status = session_update.status

            # Always update the updated_at timestamp
            oauth_session.updated_at = datetime.now()

            oauth_session = await oauth_session.update_async(db_session=session, actor=actor)

            return self._oauth_orm_to_pydantic(oauth_session)

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
            # Find expired sessions
            result = await session.execute(select(MCPOAuth).where(MCPOAuth.created_at < cutoff_time))
            expired_sessions = result.scalars().all()

            # Delete expired sessions using async ORM method
            for oauth_session in expired_sessions:
                await oauth_session.hard_delete_async(db_session=session, actor=None)

            if expired_sessions:
                logger.info(f"Cleaned up {len(expired_sessions)} expired OAuth sessions")

            return len(expired_sessions)

    @enforce_types
    async def handle_oauth_flow(
        self,
        request: Union[SSEServerConfig, StdioServerConfig, StreamableHTTPServerConfig],
        actor: PydanticUser,
        http_request: Optional[Request] = None,
    ):
        """
        Handle OAuth flow for MCP server connection and yield SSE events.

        Args:
            request: The server configuration
            actor: The user making the request
            http_request: The HTTP request object

        Yields:
            SSE events during OAuth flow

        Returns:
            Tuple of (temp_client, connect_task) after yielding events
        """
        import asyncio

        from letta.services.mcp.oauth_utils import create_oauth_provider, oauth_stream_event
        from letta.services.mcp.types import OauthStreamEvent

        # OAuth required, yield state to client to prepare to handle authorization URL
        yield oauth_stream_event(OauthStreamEvent.OAUTH_REQUIRED, message="OAuth authentication required")

        # Create OAuth session to persist the state of the OAuth flow
        session_create = MCPOAuthSessionCreate(
            server_url=request.server_url,
            server_name=request.server_name,
            user_id=actor.id,
            organization_id=actor.organization_id,
        )
        oauth_session = await self.create_oauth_session(session_create, actor)
        session_id = oauth_session.id

        # TODO: @jnjpng make this check more robust and remove direct os.getenv
        # Check if request is from web frontend to determine redirect URI
        is_web_request = (
            http_request
            and http_request.headers
            and http_request.headers.get("user-agent", "") == "Next.js Middleware"
            and http_request.headers.__contains__("x-organization-id")
        )

        logo_uri = None
        NEXT_PUBLIC_CURRENT_HOST = os.getenv("NEXT_PUBLIC_CURRENT_HOST")
        LETTA_AGENTS_ENDPOINT = os.getenv("LETTA_AGENTS_ENDPOINT")

        if is_web_request and NEXT_PUBLIC_CURRENT_HOST:
            redirect_uri = f"{NEXT_PUBLIC_CURRENT_HOST}/oauth/callback/{session_id}"
            logo_uri = f"{NEXT_PUBLIC_CURRENT_HOST}/seo/favicon.svg"
        elif LETTA_AGENTS_ENDPOINT:
            # API and SDK usage should call core server directly
            redirect_uri = f"{LETTA_AGENTS_ENDPOINT}/v1/tools/mcp/oauth/callback/{session_id}"
        else:
            logger.error(
                f"No redirect URI found for request and base urls: {http_request.headers if http_request else 'No headers'} {NEXT_PUBLIC_CURRENT_HOST} {LETTA_AGENTS_ENDPOINT}"
            )
            raise HTTPException(status_code=400, detail="No redirect URI found")

        # Create OAuth provider for the instance of the stream connection
        oauth_provider = await create_oauth_provider(session_id, request.server_url, redirect_uri, self, actor, logo_uri=logo_uri)

        # Get authorization URL by triggering OAuth flow
        temp_client = None
        connect_task = None

        async def connect_and_cleanup(client: AsyncBaseMCPClient, ready_queue: asyncio.Queue):
            """Wrap connection and cleanup in the same task to share cancel scope"""
            try:
                await client.connect_to_server()
                # Send client to main task without finishing the task
                await ready_queue.put(client)
                # Now wait for signal to cleanup
                await client._cleanup_event.wait()
            finally:
                await client.cleanup()

        try:
            ready_queue = asyncio.Queue()
            temp_client = await self.get_mcp_client(request, actor, oauth_provider)
            temp_client._cleanup_event = asyncio.Event()

            # Run connect_to_server in background to avoid blocking
            # This will trigger the OAuth flow and the redirect_handler will save the authorization URL to database
            connect_task = safe_create_task_with_return(connect_and_cleanup(temp_client, ready_queue), label="mcp_oauth_connect")

            # Fetch the authorization URL from database and yield state to client to proceed with handling authorization URL
            auth_session = await self.get_oauth_session_by_id(session_id, actor)

            # Give the OAuth flow time to connect to the MCP server and store the authorization URL
            timeout = 0
            while not auth_session or not auth_session.authorization_url and not connect_task.done() and timeout < 10:
                timeout += 1
                auth_session = await self.get_oauth_session_by_id(session_id, actor)
                await asyncio.sleep(1.0)

            if auth_session and auth_session.authorization_url:
                yield oauth_stream_event(OauthStreamEvent.AUTHORIZATION_URL, url=auth_session.authorization_url, session_id=session_id)

            # Wait for user authorization (with timeout), client should render loading state until user completes the flow and /mcp/oauth/callback/{session_id} is hit
            yield oauth_stream_event(OauthStreamEvent.WAITING_FOR_AUTH, message="Waiting for user authorization...")

            # Callback handler will poll for authorization code and state and update the OAuth session
            # Get the client from the queue
            temp_client = await ready_queue.get()
            tools = await temp_client.list_tools(serialize=True)
            yield oauth_stream_event(OauthStreamEvent.SUCCESS, tools=tools)

            # Signal the background task to cleanup in its own task
            temp_client._cleanup_event.set()
            await connect_task  # now it finishes safely
        except Exception as e:
            logger.error(f"Error triggering OAuth flow: {e}")
            yield oauth_stream_event(OauthStreamEvent.ERROR, message=f"Failed to trigger OAuth: {str(e)}")
            raise e
        finally:
            # Clean up resources
            if connect_task and not connect_task.done():
                connect_task.cancel()
                try:
                    await connect_task
                except asyncio.CancelledError:
                    pass
