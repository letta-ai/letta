from typing import Any, AsyncGenerator, Dict, List, Optional, Union

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from httpx import HTTPStatusError
from starlette.responses import StreamingResponse

from letta.functions.mcp_client.types import SSEServerConfig, StdioServerConfig, StreamableHTTPServerConfig
from letta.log import get_logger
from letta.schemas.letta_message import ToolReturnMessage
from letta.schemas.mcp_server import (
    CreateMCPServerUnion,
    MCPServerUnion,
    MCPToolExecuteRequest,
    UpdateMCPServerUnion,
    convert_generic_to_union,
    convert_update_to_internal,
)
from letta.schemas.tool import Tool
from letta.schemas.tool_execution_result import ToolExecutionResult
from letta.server.rest_api.dependencies import (
    HeaderParams,
    get_headers,
    get_letta_server,
)
from letta.server.rest_api.streaming_response import StreamingResponseWithStatusCode
from letta.server.server import SyncServer
from letta.services.mcp.oauth_utils import drill_down_exception, oauth_stream_event
from letta.services.mcp.stdio_client import AsyncStdioMCPClient
from letta.services.mcp.types import OauthStreamEvent
from letta.settings import tool_settings

router = APIRouter(prefix="/mcp-servers", tags=["mcp-servers"])

logger = get_logger(__name__)


@router.post(
    "/",
    response_model=MCPServerUnion,
    operation_id="mcp_create_mcp_server",
)
async def create_mcp_server(
    request: CreateMCPServerUnion = Body(...),
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Add a new MCP server to the Letta MCP server config
    """
    # TODO: add the tools to the MCP server table we made.
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    new_server = await server.mcp_server_manager.create_mcp_server_from_config_with_tools(request, actor=actor)
    return convert_generic_to_union(new_server)


@router.get(
    "/",
    response_model=List[MCPServerUnion],
    operation_id="mcp_list_mcp_servers",
)
async def list_mcp_servers(
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Get a list of all configured MCP servers
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    mcp_servers = await server.mcp_server_manager.list_mcp_servers(actor=actor)
    return [convert_generic_to_union(mcp_server) for mcp_server in mcp_servers]


@router.get(
    "/{mcp_server_id}",
    response_model=MCPServerUnion,
    operation_id="mcp_get_mcp_server",
)
async def get_mcp_server(
    mcp_server_id: str,
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Get a specific MCP server
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    current_server = await server.mcp_server_manager.get_mcp_server_by_id_async(mcp_server_id=mcp_server_id, actor=actor)
    return convert_generic_to_union(current_server)


@router.delete(
    "/{mcp_server_id}",
    status_code=204,
    operation_id="mcp_delete_mcp_server",
)
async def delete_mcp_server(
    mcp_server_id: str,
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Delete an MCP server by its ID
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    await server.mcp_server_manager.delete_mcp_server_by_id(mcp_server_id, actor=actor)


@router.patch(
    "/{mcp_server_id}",
    response_model=MCPServerUnion,
    operation_id="mcp_update_mcp_server",
)
async def update_mcp_server(
    mcp_server_id: str,
    request: UpdateMCPServerUnion = Body(...),
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Update an existing MCP server configuration
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    # Convert external update payload to internal manager union
    internal_update = convert_update_to_internal(request)
    updated_server = await server.mcp_server_manager.update_mcp_server_by_id(
        mcp_server_id=mcp_server_id, mcp_server_update=internal_update, actor=actor
    )
    return convert_generic_to_union(updated_server)


@router.get("/{mcp_server_id}/tools", response_model=List[Tool], operation_id="mcp_list_mcp_tools_by_server")
async def list_mcp_tools_by_server(
    mcp_server_id: str,
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Get a list of all tools for a specific MCP server
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    # Use the new efficient method that queries from the database using MCPTools mapping
    tools = await server.mcp_server_manager.list_tools_by_mcp_server_from_db(mcp_server_id, actor=actor)
    return tools


@router.get("/{mcp_server_id}/tools/{tool_id}", response_model=Tool, operation_id="mcp_get_mcp_tool")
async def get_mcp_tool(
    mcp_server_id: str,
    tool_id: str,
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Get a specific MCP tool by its ID
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    tool = await server.mcp_server_manager.get_tool_by_mcp_server(mcp_server_id, tool_id, actor=actor)
    return tool


@router.post("/{mcp_server_id}/tools/{tool_id}/run", response_model=ToolExecutionResult, operation_id="mcp_run_tool")
async def run_mcp_tool(
    mcp_server_id: str,
    tool_id: str,
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
    request: MCPToolExecuteRequest = Body(default=MCPToolExecuteRequest()),
):
    """
    Execute a specific MCP tool

    The request body should contain the tool arguments in the MCPToolExecuteRequest format.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    # Execute the tool
    result, success = await server.mcp_server_manager.execute_mcp_server_tool(
        mcp_server_id=mcp_server_id,
        tool_id=tool_id,
        tool_args=request.args,
        environment_variables={},  # TODO: Get environment variables from somewhere if needed
        actor=actor,
    )

    # Create a ToolExecutionResult
    return ToolExecutionResult(
        status="success" if success else "error",
        func_return=result,
    )


@router.patch("/{mcp_server_id}/refresh", operation_id="mcp_refresh_mcp_server_tools")
async def refresh_mcp_server_tools(
    mcp_server_id: str,
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
    agent_id: Optional[str] = None,
):
    """
    Refresh tools for an MCP server by:
    1. Fetching current tools from the MCP server
    2. Deleting tools that no longer exist on the server
    3. Updating schemas for existing tools
    4. Adding new tools from the server

    Returns a summary of changes made.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    result = await server.mcp_server_manager.resync_mcp_server_tools(mcp_server_id, actor=actor, agent_id=agent_id)
    return result


@router.get(
    "/connect/{mcp_server_id}",
    response_model=None,
    # TODO: make this into a model?
    responses={
        200: {
            "description": "Successful response",
            "content": {
                "text/event-stream": {"description": "Server-Sent Events stream"},
            },
        }
    },
    operation_id="mcp_connect_mcp_server",
)
async def connect_mcp_server(
    mcp_server_id: str,
    request: Request,
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
) -> StreamingResponse:
    """
    Connect to an MCP server with support for OAuth via SSE.
    Returns a stream of events handling authorization state and exchange if OAuth is required.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    mcp_server = await server.mcp_server_manager.get_mcp_server_by_id_async(mcp_server_id=mcp_server_id, actor=actor)

    # Convert the MCP server to the appropriate config type
    config = mcp_server.to_config(resolve_variables=False)

    async def oauth_stream_generator(
        mcp_config: Union[StdioServerConfig, SSEServerConfig, StreamableHTTPServerConfig],
        http_request: Request,
    ) -> AsyncGenerator[str, None]:
        client = None

        oauth_flow_attempted = False
        try:
            # Acknowledge connection attempt
            yield oauth_stream_event(OauthStreamEvent.CONNECTION_ATTEMPT, server_name=mcp_config.server_name)

            # Create MCP client with respective transport type
            try:
                mcp_config.resolve_environment_variables()
                client = await server.mcp_server_manager.get_mcp_client(mcp_config, actor)
            except ValueError as e:
                yield oauth_stream_event(OauthStreamEvent.ERROR, message=str(e))
                return

            # Try normal connection first for flows that don't require OAuth
            try:
                await client.connect_to_server()
                tools = await client.list_tools(serialize=True)
                yield oauth_stream_event(OauthStreamEvent.SUCCESS, tools=tools)
                return
            except ConnectionError:
                # TODO: jnjpng make this connection error check more specific to the 401 unauthorized error
                if isinstance(client, AsyncStdioMCPClient):
                    logger.warning("OAuth not supported for stdio")
                    yield oauth_stream_event(OauthStreamEvent.ERROR, message="OAuth not supported for stdio")
                    return
                # Continue to OAuth flow
                logger.info(f"Attempting OAuth flow for {mcp_config}...")
            except Exception as e:
                yield oauth_stream_event(OauthStreamEvent.ERROR, message=f"Connection failed: {str(e)}")
                return
            finally:
                if client:
                    try:
                        await client.cleanup()
                    # This is a workaround to catch the expected 401 Unauthorized from the official MCP SDK, see their streamable_http.py
                    # For SSE transport types, we catch the ConnectionError above, but Streamable HTTP doesn't bubble up the exception
                    except HTTPStatusError:
                        oauth_flow_attempted = True
                        async for event in server.mcp_server_manager.handle_oauth_flow(
                            request=mcp_config, actor=actor, http_request=http_request
                        ):
                            yield event

            # Failsafe to make sure we don't try to handle OAuth flow twice
            if not oauth_flow_attempted:
                async for event in server.mcp_server_manager.handle_oauth_flow(request=mcp_config, actor=actor, http_request=http_request):
                    yield event
            return
        except Exception as e:
            detailed_error = drill_down_exception(e)
            logger.error(f"Error in OAuth stream:\n{detailed_error}")
            yield oauth_stream_event(OauthStreamEvent.ERROR, message=f"Internal error: {detailed_error}")

        finally:
            if client:
                try:
                    await client.cleanup()
                except Exception as cleanup_error:
                    logger.warning(f"Error during temp MCP client cleanup: {cleanup_error}")

    return StreamingResponseWithStatusCode(oauth_stream_generator(config, request), media_type="text/event-stream")
