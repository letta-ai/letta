import json
import os
from typing import Any, Dict, List, Optional, Tuple, Union

from sqlalchemy import null

import letta.constants as constants
from letta.functions.mcp_client.types import MCPServerType, MCPTool, SSEServerConfig, StdioServerConfig, StreamableHTTPServerConfig
from letta.log import get_logger
from letta.orm.errors import NoResultFound
from letta.orm.mcp_server import MCPServer as MCPServerModel
from letta.schemas.mcp import MCPServer, UpdateMCPServer, UpdateSSEMCPServer, UpdateStdioMCPServer, UpdateStreamableHTTPMCPServer
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
        mcp_server_id = await self.get_mcp_server_id_by_name(mcp_server_name, actor=actor)
        mcp_config = await self.get_mcp_server_by_id_async(mcp_server_id, actor=actor)
        server_config = mcp_config.to_config()

        if mcp_config.server_type == MCPServerType.SSE:
            mcp_client = AsyncSSEMCPClient(server_config=server_config)
        elif mcp_config.server_type == MCPServerType.STDIO:
            mcp_client = AsyncStdioMCPClient(server_config=server_config)
        elif mcp_config.server_type == MCPServerType.STREAMABLE_HTTP:
            mcp_client = AsyncStreamableHTTPMCPClient(server_config=server_config)
        else:
            raise ValueError(f"Unsupported MCP server type: {mcp_config.server_type}")
        await mcp_client.connect_to_server()

        # list tools
        tools = await mcp_client.list_tools()

        # TODO: change to pydantic tools
        await mcp_client.cleanup()

        return tools

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
                print("MCP server not found in config.", mcp_config)
                raise ValueError(f"MCP server {mcp_server_name} not found in config.")
            server_config = mcp_config[mcp_server_name]

        if isinstance(server_config, SSEServerConfig):
            # mcp_client = AsyncSSEMCPClient(server_config=server_config)
            async with AsyncSSEMCPClient(server_config=server_config) as mcp_client:
                result, success = await mcp_client.execute_tool(tool_name, tool_args)
                logger.info(f"MCP Result: {result}, Success: {success}")
                return result, success
        elif isinstance(server_config, StdioServerConfig):
            async with AsyncStdioMCPClient(server_config=server_config) as mcp_client:
                result, success = await mcp_client.execute_tool(tool_name, tool_args)
                logger.info(f"MCP Result: {result}, Success: {success}")
                return result, success
        elif isinstance(server_config, StreamableHTTPServerConfig):
            async with AsyncStreamableHTTPMCPClient(server_config=server_config) as mcp_client:
                result, success = await mcp_client.execute_tool(tool_name, tool_args)
                logger.info(f"MCP Result: {result}, Success: {success}")
                return result, success
        else:
            raise ValueError(f"Unsupported server config type: {type(server_config)}")

    @enforce_types
    async def add_tool_from_mcp_server(self, mcp_server_name: str, mcp_tool_name: str, actor: PydanticUser) -> PydanticTool:
        """Add a tool from an MCP server to the Letta tool registry."""
        mcp_tools = await self.list_mcp_server_tools(mcp_server_name, actor=actor)

        for mcp_tool in mcp_tools:
            if mcp_tool.name == mcp_tool_name:
                tool_create = ToolCreate.from_mcp(mcp_server_name=mcp_server_name, mcp_tool=mcp_tool)
                return await self.tool_manager.create_mcp_tool_async(tool_create=tool_create, mcp_server_name=mcp_server_name, actor=actor)

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
