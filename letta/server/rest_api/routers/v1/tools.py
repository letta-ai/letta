from typing import Any, Dict, List, Optional, Union

from composio.client import ComposioClientError, HTTPError, NoItemsFound
from composio.client.collections import ActionModel, AppModel
from composio.exceptions import (
    ApiKeyNotProvidedError,
    ComposioSDKError,
    ConnectedAccountNotFoundError,
    EnumMetadataNotFound,
    EnumStringNotFound,
)
from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field

from letta.errors import LettaToolCreateError
from letta.functions.functions import derive_openai_json_schema
from letta.functions.mcp_client.exceptions import MCPTimeoutError
from letta.functions.mcp_client.types import MCPServerType, MCPTool, SSEServerConfig, StdioServerConfig, StreamableHTTPServerConfig
from letta.helpers.composio_helpers import get_composio_api_key
from letta.log import get_logger
from letta.orm.errors import UniqueConstraintViolationError
from letta.schemas.letta_message import ToolReturnMessage
from letta.schemas.mcp import UpdateSSEMCPServer, UpdateStreamableHTTPMCPServer
from letta.schemas.tool import Tool, ToolCreate, ToolRunFromSource, ToolUpdate
from letta.server.rest_api.utils import get_letta_server
from letta.server.server import SyncServer
from letta.services.mcp.sse_client import AsyncSSEMCPClient
from letta.services.mcp.streamable_http_client import AsyncStreamableHTTPMCPClient
from letta.settings import tool_settings

router = APIRouter(prefix="/tools", tags=["tools"])

logger = get_logger(__name__)


@router.delete("/{tool_id}", operation_id="delete_tool")
async def delete_tool(
    tool_id: str,
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Delete a tool by name
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    await server.tool_manager.delete_tool_by_id_async(tool_id=tool_id, actor=actor)


@router.get("/count", response_model=int, operation_id="count_tools")
async def count_tools(
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
    include_base_tools: Optional[bool] = Query(False, description="Include built-in Letta tools in the count"),
):
    """
    Get a count of all tools available to agents belonging to the org of the user.
    """
    try:
        actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
        return await server.tool_manager.size_async(actor=actor, include_base_tools=include_base_tools)
    except Exception as e:
        print(f"Error occurred: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{tool_id}", response_model=Tool, operation_id="retrieve_tool")
async def retrieve_tool(
    tool_id: str,
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Get a tool by ID
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    tool = await server.tool_manager.get_tool_by_id_async(tool_id=tool_id, actor=actor)
    if tool is None:
        # return 404 error
        raise HTTPException(status_code=404, detail=f"Tool with id {tool_id} not found.")
    return tool


@router.get("/", response_model=List[Tool], operation_id="list_tools")
async def list_tools(
    after: Optional[str] = None,
    limit: Optional[int] = 50,
    name: Optional[str] = None,
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Get a list of all tools available to agents belonging to the org of the user
    """
    try:
        actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
        if name is not None:
            tool = await server.tool_manager.get_tool_by_name_async(tool_name=name, actor=actor)
            return [tool] if tool else []

        # Get the list of tools
        return await server.tool_manager.list_tools_async(actor=actor, after=after, limit=limit)
    except Exception as e:
        # Log or print the full exception here for debugging
        print(f"Error occurred: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/count", response_model=int, operation_id="count_tools")
def count_tools(
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Get a count of all tools available to agents belonging to the org of the user
    """
    try:
        return server.tool_manager.size(actor=server.user_manager.get_user_or_default(user_id=actor_id))
    except Exception as e:
        print(f"Error occurred: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", response_model=Tool, operation_id="create_tool")
async def create_tool(
    request: ToolCreate = Body(...),
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Create a new tool
    """
    try:
        actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
        tool = Tool(**request.model_dump())
        return await server.tool_manager.create_tool_async(pydantic_tool=tool, actor=actor)
    except UniqueConstraintViolationError as e:
        # Log or print the full exception here for debugging
        print(f"Error occurred: {e}")
        clean_error_message = f"Tool with this name already exists."
        raise HTTPException(status_code=409, detail=clean_error_message)
    except LettaToolCreateError as e:
        # HTTP 400 == Bad Request
        print(f"Error occurred during tool creation: {e}")
        # print the full stack trace
        import traceback

        print(traceback.format_exc())
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # Catch other unexpected errors and raise an internal server error
        print(f"Unexpected error occurred: {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")


@router.put("/", response_model=Tool, operation_id="upsert_tool")
async def upsert_tool(
    request: ToolCreate = Body(...),
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Create or update a tool
    """
    try:
        actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
        tool = await server.tool_manager.create_or_update_tool_async(pydantic_tool=Tool(**request.model_dump()), actor=actor)
        return tool
    except UniqueConstraintViolationError as e:
        # Log the error and raise a conflict exception
        print(f"Unique constraint violation occurred: {e}")
        raise HTTPException(status_code=409, detail=str(e))
    except LettaToolCreateError as e:
        # HTTP 400 == Bad Request
        print(f"Error occurred during tool upsert: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # Catch other unexpected errors and raise an internal server error
        print(f"Unexpected error occurred: {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")


@router.patch("/{tool_id}", response_model=Tool, operation_id="modify_tool")
async def modify_tool(
    tool_id: str,
    request: ToolUpdate = Body(...),
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Update an existing tool
    """
    try:
        actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
        return await server.tool_manager.update_tool_by_id_async(tool_id=tool_id, tool_update=request, actor=actor)
    except LettaToolCreateError as e:
        # HTTP 400 == Bad Request
        print(f"Error occurred during tool update: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # Catch other unexpected errors and raise an internal server error
        print(f"Unexpected error occurred: {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")


@router.post("/add-base-tools", response_model=List[Tool], operation_id="add_base_tools")
async def upsert_base_tools(
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Upsert base tools
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    return await server.tool_manager.upsert_base_tools_async(actor=actor)


@router.post("/run", response_model=ToolReturnMessage, operation_id="run_tool_from_source")
async def run_tool_from_source(
    server: SyncServer = Depends(get_letta_server),
    request: ToolRunFromSource = Body(...),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Attempt to build a tool from source, then run it on the provided arguments
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

    try:
        return await server.run_tool_from_source(
            tool_source=request.source_code,
            tool_source_type=request.source_type,
            tool_args=request.args,
            tool_env_vars=request.env_vars,
            tool_name=request.name,
            tool_args_json_schema=request.args_json_schema,
            tool_json_schema=request.json_schema,
            actor=actor,
        )
    except LettaToolCreateError as e:
        # HTTP 400 == Bad Request
        print(f"Error occurred during tool creation: {e}")
        # print the full stack trace
        import traceback

        print(traceback.format_exc())
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        # Catch other unexpected errors and raise an internal server error
        print(f"Unexpected error occurred: {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")


# Specific routes for Composio
@router.get("/composio/apps", response_model=List[AppModel], operation_id="list_composio_apps")
def list_composio_apps(server: SyncServer = Depends(get_letta_server), user_id: Optional[str] = Header(None, alias="user_id")):
    """
    Get a list of all Composio apps
    """
    actor = server.user_manager.get_user_or_default(user_id=user_id)
    composio_api_key = get_composio_api_key(actor=actor, logger=logger)
    if not composio_api_key:
        raise HTTPException(
            status_code=400,  # Bad Request
            detail=f"No API keys found for Composio. Please add your Composio API Key as an environment variable for your sandbox configuration, or set it as environment variable COMPOSIO_API_KEY.",
        )
    return server.get_composio_apps(api_key=composio_api_key)


@router.get("/composio/apps/{composio_app_name}/actions", response_model=List[ActionModel], operation_id="list_composio_actions_by_app")
def list_composio_actions_by_app(
    composio_app_name: str,
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Get a list of all Composio actions for a specific app
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    composio_api_key = get_composio_api_key(actor=actor, logger=logger)
    if not composio_api_key:
        raise HTTPException(
            status_code=400,  # Bad Request
            detail=f"No API keys found for Composio. Please add your Composio API Key as an environment variable for your sandbox configuration, or set it as environment variable COMPOSIO_API_KEY.",
        )
    return server.get_composio_actions_from_app_name(composio_app_name=composio_app_name, api_key=composio_api_key)


@router.post("/composio/{composio_action_name}", response_model=Tool, operation_id="add_composio_tool")
async def add_composio_tool(
    composio_action_name: str,
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Add a new Composio tool by action name (Composio refers to each tool as an `Action`)
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

    try:
        tool_create = ToolCreate.from_composio(action_name=composio_action_name)
        return await server.tool_manager.create_or_update_composio_tool_async(tool_create=tool_create, actor=actor)
    except ConnectedAccountNotFoundError as e:
        raise HTTPException(
            status_code=400,  # Bad Request
            detail={
                "code": "ConnectedAccountNotFoundError",
                "message": str(e),
                "composio_action_name": composio_action_name,
            },
        )
    except EnumStringNotFound as e:
        raise HTTPException(
            status_code=400,  # Bad Request
            detail={
                "code": "EnumStringNotFound",
                "message": str(e),
                "composio_action_name": composio_action_name,
            },
        )
    except EnumMetadataNotFound as e:
        raise HTTPException(
            status_code=400,  # Bad Request
            detail={
                "code": "EnumMetadataNotFound",
                "message": str(e),
                "composio_action_name": composio_action_name,
            },
        )
    except HTTPError as e:
        raise HTTPException(
            status_code=400,  # Bad Request
            detail={
                "code": "HTTPError",
                "message": str(e),
                "composio_action_name": composio_action_name,
            },
        )
    except NoItemsFound as e:
        raise HTTPException(
            status_code=400,  # Bad Request
            detail={
                "code": "NoItemsFound",
                "message": str(e),
                "composio_action_name": composio_action_name,
            },
        )
    except ApiKeyNotProvidedError as e:
        raise HTTPException(
            status_code=400,  # Bad Request
            detail={
                "code": "ApiKeyNotProvidedError",
                "message": str(e),
                "composio_action_name": composio_action_name,
            },
        )
    except ComposioClientError as e:
        raise HTTPException(
            status_code=400,  # Bad Request
            detail={
                "code": "ComposioClientError",
                "message": str(e),
                "composio_action_name": composio_action_name,
            },
        )
    except ComposioSDKError as e:
        raise HTTPException(
            status_code=400,  # Bad Request
            detail={
                "code": "ComposioSDKError",
                "message": str(e),
                "composio_action_name": composio_action_name,
            },
        )


# Specific routes for MCP
@router.get(
    "/mcp/servers",
    response_model=dict[str, Union[SSEServerConfig, StdioServerConfig, StreamableHTTPServerConfig]],
    operation_id="list_mcp_servers",
)
async def list_mcp_servers(server: SyncServer = Depends(get_letta_server), user_id: Optional[str] = Header(None, alias="user_id")):
    """
    Get a list of all configured MCP servers
    """
    if tool_settings.mcp_read_from_config:
        return server.get_mcp_servers()
    else:
        actor = await server.user_manager.get_actor_or_default_async(actor_id=user_id)
        mcp_servers = await server.mcp_manager.list_mcp_servers(actor=actor)
        return {server.server_name: server.to_config() for server in mcp_servers}


# NOTE: async because the MCP client/session calls are async
# TODO: should we make the return type MCPTool, not Tool (since we don't have ID)?
@router.get("/mcp/servers/{mcp_server_name}/tools", response_model=List[MCPTool], operation_id="list_mcp_tools_by_server")
async def list_mcp_tools_by_server(
    mcp_server_name: str,
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Get a list of all tools for a specific MCP server
    """
    if tool_settings.mcp_read_from_config:
        try:
            return await server.get_tools_from_mcp_server(mcp_server_name=mcp_server_name)
        except ValueError as e:
            # ValueError means that the MCP server name doesn't exist
            raise HTTPException(
                status_code=400,  # Bad Request
                detail={
                    "code": "MCPServerNotFoundError",
                    "message": str(e),
                    "mcp_server_name": mcp_server_name,
                },
            )
        except MCPTimeoutError as e:
            raise HTTPException(
                status_code=408,  # Timeout
                detail={
                    "code": "MCPTimeoutError",
                    "message": str(e),
                    "mcp_server_name": mcp_server_name,
                },
            )
    else:
        actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
        mcp_tools = await server.mcp_manager.list_mcp_server_tools(mcp_server_name=mcp_server_name, actor=actor)
        return mcp_tools


@router.post("/mcp/servers/{mcp_server_name}/{mcp_tool_name}", response_model=Tool, operation_id="add_mcp_tool")
async def add_mcp_tool(
    mcp_server_name: str,
    mcp_tool_name: str,
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Register a new MCP tool as a Letta server by MCP server + tool name
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)

    if tool_settings.mcp_read_from_config:

        try:
            available_tools = await server.get_tools_from_mcp_server(mcp_server_name=mcp_server_name)
        except ValueError as e:
            # ValueError means that the MCP server name doesn't exist
            raise HTTPException(
                status_code=400,  # Bad Request
                detail={
                    "code": "MCPServerNotFoundError",
                    "message": str(e),
                    "mcp_server_name": mcp_server_name,
                },
            )
        except MCPTimeoutError as e:
            raise HTTPException(
                status_code=408,  # Timeout
                detail={
                    "code": "MCPTimeoutError",
                    "message": str(e),
                    "mcp_server_name": mcp_server_name,
                },
            )

        # See if the tool is in the available list
        mcp_tool = None
        for tool in available_tools:
            if tool.name == mcp_tool_name:
                mcp_tool = tool
                break
        if not mcp_tool:
            raise HTTPException(
                status_code=400,  # Bad Request
                detail={
                    "code": "MCPToolNotFoundError",
                    "message": f"Tool {mcp_tool_name} not found in MCP server {mcp_server_name} - available tools: {', '.join([tool.name for tool in available_tools])}",
                    "mcp_tool_name": mcp_tool_name,
                },
            )

        tool_create = ToolCreate.from_mcp(mcp_server_name=mcp_server_name, mcp_tool=mcp_tool)
        return await server.tool_manager.create_mcp_tool_async(tool_create=tool_create, mcp_server_name=mcp_server_name, actor=actor)

    else:
        return await server.mcp_manager.add_tool_from_mcp_server(mcp_server_name=mcp_server_name, mcp_tool_name=mcp_tool_name, actor=actor)


@router.put(
    "/mcp/servers",
    response_model=List[Union[StdioServerConfig, SSEServerConfig, StreamableHTTPServerConfig]],
    operation_id="add_mcp_server",
)
async def add_mcp_server_to_config(
    request: Union[StdioServerConfig, SSEServerConfig, StreamableHTTPServerConfig] = Body(...),
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Add a new MCP server to the Letta MCP server config
    """
    try:
        actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

        if tool_settings.mcp_read_from_config:
            # write to config file
            return await server.add_mcp_server_to_config(server_config=request, allow_upsert=True)
        else:
            # log to DB
            from letta.schemas.mcp import MCPServer

            if isinstance(request, StdioServerConfig):
                mapped_request = MCPServer(server_name=request.server_name, server_type=request.type, stdio_config=request)
                # don't allow stdio servers
                if tool_settings.mcp_disable_stdio:  # protected server
                    raise HTTPException(
                        status_code=400,
                        detail="stdio is not supported in the current environment, please use a self-hosted Letta server in order to add a stdio MCP server",
                    )
            elif isinstance(request, SSEServerConfig):
                mapped_request = MCPServer(
                    server_name=request.server_name,
                    server_type=request.type,
                    server_url=request.server_url,
                    token=request.resolve_token() if not request.custom_headers else None,
                    custom_headers=request.custom_headers,
                )
            elif isinstance(request, StreamableHTTPServerConfig):
                mapped_request = MCPServer(
                    server_name=request.server_name,
                    server_type=request.type,
                    server_url=request.server_url,
                    token=request.resolve_token() if not request.custom_headers else None,
                    custom_headers=request.custom_headers,
                )

            await server.mcp_manager.create_mcp_server(mapped_request, actor=actor)

            # TODO: don't do this in the future (just return MCPServer)
            all_servers = await server.mcp_manager.list_mcp_servers(actor=actor)
            return [server.to_config() for server in all_servers]
    except UniqueConstraintViolationError:
        # If server name already exists, throw 409 conflict error
        raise HTTPException(
            status_code=409,
            detail={
                "code": "MCPServerNameAlreadyExistsError",
                "message": f"MCP server with name '{request.server_name}' already exists",
                "server_name": request.server_name,
            },
        )
    except Exception as e:
        print(f"Unexpected error occurred while adding MCP server: {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")


@router.patch(
    "/mcp/servers/{mcp_server_name}",
    response_model=Union[StdioServerConfig, SSEServerConfig, StreamableHTTPServerConfig],
    operation_id="update_mcp_server",
)
async def update_mcp_server(
    mcp_server_name: str,
    request: Union[UpdateSSEMCPServer, UpdateStreamableHTTPMCPServer] = Body(...),
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Update an existing MCP server configuration
    """
    try:
        actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

        if tool_settings.mcp_read_from_config:
            raise HTTPException(status_code=501, detail="Update not implemented for config file mode, config files to be deprecated.")
        else:
            updated_server = await server.mcp_manager.update_mcp_server_by_name(
                mcp_server_name=mcp_server_name, mcp_server_update=request, actor=actor
            )
            return updated_server.to_config()
    except HTTPException:
        # Re-raise HTTP exceptions (like 404)
        raise
    except Exception as e:
        print(f"Unexpected error occurred while updating MCP server: {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")


@router.delete(
    "/mcp/servers/{mcp_server_name}",
    response_model=List[Union[StdioServerConfig, SSEServerConfig, StreamableHTTPServerConfig]],
    operation_id="delete_mcp_server",
)
async def delete_mcp_server_from_config(
    mcp_server_name: str,
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Add a new MCP server to the Letta MCP server config
    """
    if tool_settings.mcp_read_from_config:
        # write to config file
        return server.delete_mcp_server_from_config(server_name=mcp_server_name)
    else:
        # log to DB
        actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
        mcp_server_id = await server.mcp_manager.get_mcp_server_id_by_name(mcp_server_name, actor)
        await server.mcp_manager.delete_mcp_server_by_id(mcp_server_id, actor=actor)

        # TODO: don't do this in the future (just return MCPServer)
        all_servers = await server.mcp_manager.list_mcp_servers(actor=actor)
        return [server.to_config() for server in all_servers]


@router.post("/mcp/servers/test", response_model=List[MCPTool], operation_id="test_mcp_server")
async def test_mcp_server(
    request: Union[StdioServerConfig, SSEServerConfig, StreamableHTTPServerConfig] = Body(...),
):
    """
    Test connection to an MCP server without adding it.
    Returns the list of available tools if successful.
    """
    client = None
    try:
        if isinstance(request, StdioServerConfig):
            raise HTTPException(
                status_code=400,
                detail="stdio is not supported currently for testing connection",
            )

        # create a temporary MCP client based on the server type
        if request.type == MCPServerType.SSE:
            if not isinstance(request, SSEServerConfig):
                request = SSEServerConfig(**request.model_dump())
            client = AsyncSSEMCPClient(request)
        elif request.type == MCPServerType.STREAMABLE_HTTP:
            if not isinstance(request, StreamableHTTPServerConfig):
                request = StreamableHTTPServerConfig(**request.model_dump())
            client = AsyncStreamableHTTPMCPClient(request)
        else:
            raise ValueError(f"Invalid MCP server type: {request.type}")

        await client.connect_to_server()
        tools = await client.list_tools()
        return tools
    except ConnectionError as e:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "MCPServerConnectionError",
                "message": str(e),
                "server_name": request.server_name,
            },
        )
    except MCPTimeoutError as e:
        raise HTTPException(
            status_code=408,
            detail={
                "code": "MCPTimeoutError",
                "message": f"MCP server connection timed out: {str(e)}",
                "server_name": request.server_name,
            },
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "code": "MCPServerTestError",
                "message": f"Failed to test MCP server: {str(e)}",
                "server_name": request.server_name,
            },
        )
    finally:
        if client:
            try:
                await client.cleanup()
            except Exception as cleanup_error:
                logger.warning(f"Error during MCP client cleanup: {cleanup_error}")


class CodeInput(BaseModel):
    code: str = Field(..., description="Python source code to parse for JSON schema")


@router.post("/generate-schema", response_model=Dict[str, Any], operation_id="generate_json_schema")
async def generate_json_schema(
    request: CodeInput = Body(...),
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Generate a JSON schema from the given Python source code defining a function or class.
    """
    try:
        schema = derive_openai_json_schema(source_code=request.code)
        return schema

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to generate schema: {str(e)}")
