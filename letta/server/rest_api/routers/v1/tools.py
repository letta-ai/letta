from typing import List, Optional, Union

from composio.client import ComposioClientError, HTTPError, NoItemsFound
from composio.client.collections import ActionModel, AppModel
from composio.exceptions import (
    ApiKeyNotProvidedError,
    ComposioSDKError,
    ConnectedAccountNotFoundError,
    EnumMetadataNotFound,
    EnumStringNotFound,
)
from fastapi import APIRouter, Body, Depends, Header, HTTPException

from letta.errors import LettaToolCreateError
from letta.functions.mcp_client.types import MCPTool, SSEServerConfig, StdioServerConfig
from letta.helpers.composio_helpers import get_composio_api_key
from letta.log import get_logger
from letta.orm.errors import UniqueConstraintViolationError
from letta.schemas.letta_message import ToolReturnMessage
from letta.schemas.tool import Tool, ToolCreate, ToolRunFromSource, ToolUpdate
from letta.server.rest_api.utils import get_letta_server
from letta.server.server import SyncServer

router = APIRouter(prefix="/tools", tags=["tools"])

logger = get_logger(__name__)


@router.delete("/{tool_id}", operation_id="delete_tool")
def delete_tool(
    tool_id: str,
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Delete a tool by name
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    server.tool_manager.delete_tool_by_id(tool_id=tool_id, actor=actor)


@router.get("/{tool_id}", response_model=Tool, operation_id="retrieve_tool")
def retrieve_tool(
    tool_id: str,
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Get a tool by ID
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    tool = server.tool_manager.get_tool_by_id(tool_id=tool_id, actor=actor)
    if tool is None:
        # return 404 error
        raise HTTPException(status_code=404, detail=f"Tool with id {tool_id} not found.")
    return tool


@router.get("/", response_model=List[Tool], operation_id="list_tools")
def list_tools(
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
        actor = server.user_manager.get_user_or_default(user_id=actor_id)
        if name is not None:
            tool = server.tool_manager.get_tool_by_name(tool_name=name, actor=actor)
            return [tool] if tool else []
        return server.tool_manager.list_tools(actor=actor, after=after, limit=limit)
    except Exception as e:
        # Log or print the full exception here for debugging
        print(f"Error occurred: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", response_model=Tool, operation_id="create_tool")
def create_tool(
    request: ToolCreate = Body(...),
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Create a new tool
    """
    try:
        actor = server.user_manager.get_user_or_default(user_id=actor_id)
        tool = Tool(**request.model_dump())
        return server.tool_manager.create_tool(pydantic_tool=tool, actor=actor)
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
def upsert_tool(
    request: ToolCreate = Body(...),
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Create or update a tool
    """
    try:
        actor = server.user_manager.get_user_or_default(user_id=actor_id)
        tool = server.tool_manager.create_or_update_tool(pydantic_tool=Tool(**request.model_dump()), actor=actor)
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
def modify_tool(
    tool_id: str,
    request: ToolUpdate = Body(...),
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Update an existing tool
    """
    try:
        actor = server.user_manager.get_user_or_default(user_id=actor_id)
        return server.tool_manager.update_tool_by_id(tool_id=tool_id, tool_update=request, actor=actor)
    except LettaToolCreateError as e:
        # HTTP 400 == Bad Request
        print(f"Error occurred during tool update: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # Catch other unexpected errors and raise an internal server error
        print(f"Unexpected error occurred: {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")


@router.post("/add-base-tools", response_model=List[Tool], operation_id="add_base_tools")
def upsert_base_tools(
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Upsert base tools
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    return server.tool_manager.upsert_base_tools(actor=actor)


@router.post("/run", response_model=ToolReturnMessage, operation_id="run_tool_from_source")
def run_tool_from_source(
    server: SyncServer = Depends(get_letta_server),
    request: ToolRunFromSource = Body(...),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Attempt to build a tool from source, then run it on the provided arguments
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)

    try:
        return server.run_tool_from_source(
            tool_source=request.source_code,
            tool_source_type=request.source_type,
            tool_args=request.args,
            tool_env_vars=request.env_vars,
            tool_name=request.name,
            tool_args_json_schema=request.args_json_schema,
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
def add_composio_tool(
    composio_action_name: str,
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Add a new Composio tool by action name (Composio refers to each tool as an `Action`)
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)

    try:
        tool_create = ToolCreate.from_composio(action_name=composio_action_name)
        return server.tool_manager.create_or_update_composio_tool(tool_create=tool_create, actor=actor)
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
    except ComposioClientError as e:
        raise HTTPException(
            status_code=400,  # Bad Request
            detail={
                "code": "ComposioClientError",
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
@router.get("/mcp/servers", response_model=dict[str, Union[SSEServerConfig, StdioServerConfig]], operation_id="list_mcp_servers")
def list_mcp_servers(server: SyncServer = Depends(get_letta_server), user_id: Optional[str] = Header(None, alias="user_id")):
    """
    Get a list of all configured MCP servers
    """
    actor = server.user_manager.get_user_or_default(user_id=user_id)
    return server.get_mcp_servers()


# NOTE: async because the MCP client/session calls are async
# TODO: should we make the return type MCPTool, not Tool (since we don't have ID)?
@router.get("/mcp/servers/{mcp_server_name}/tools", response_model=List[MCPTool], operation_id="list_mcp_tools_by_server")
def list_mcp_tools_by_server(
    mcp_server_name: str,
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Get a list of all tools for a specific MCP server
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    try:
        return server.get_tools_from_mcp_server(mcp_server_name=mcp_server_name)
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


@router.post("/mcp/servers/{mcp_server_name}/{mcp_tool_name}", response_model=Tool, operation_id="add_mcp_tool")
def add_mcp_tool(
    mcp_server_name: str,
    mcp_tool_name: str,
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Register a new MCP tool as a Letta server by MCP server + tool name
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)

    available_tools = server.get_tools_from_mcp_server(mcp_server_name=mcp_server_name)
    # See if the tool is in the avaialable list
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
    return server.tool_manager.create_or_update_mcp_tool(tool_create=tool_create, actor=actor)


@router.put("/mcp/servers", response_model=List[Union[StdioServerConfig, SSEServerConfig]], operation_id="add_mcp_server")
def add_mcp_server_to_config(
    request: Union[StdioServerConfig, SSEServerConfig] = Body(...),
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Add a new MCP server to the Letta MCP server config
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    return server.add_mcp_server_to_config(server_config=request, allow_upsert=True)


@router.delete(
    "/mcp/servers/{mcp_server_name}", response_model=List[Union[StdioServerConfig, SSEServerConfig]], operation_id="delete_mcp_server"
)
def delete_mcp_server_from_config(
    mcp_server_name: str,
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Add a new MCP server to the Letta MCP server config
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    return server.delete_mcp_server_from_config(server_name=mcp_server_name)
