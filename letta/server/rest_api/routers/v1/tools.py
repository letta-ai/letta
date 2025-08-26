import json
from collections.abc import AsyncGenerator
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
from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query, Request
from httpx import HTTPStatusError
from pydantic import BaseModel, Field
from starlette.responses import StreamingResponse

from letta.errors import LettaToolCreateError, LettaToolNameConflictError
from letta.functions.functions import derive_openai_json_schema
from letta.functions.mcp_client.exceptions import MCPTimeoutError
from letta.functions.mcp_client.types import MCPTool, SSEServerConfig, StdioServerConfig, StreamableHTTPServerConfig
from letta.helpers.composio_helpers import get_composio_api_key
from letta.helpers.decorators import deprecated
from letta.llm_api.llm_client import LLMClient
from letta.log import get_logger
from letta.orm.errors import UniqueConstraintViolationError
from letta.orm.mcp_oauth import OAuthSessionStatus
from letta.prompts.gpt_system import get_system_text
from letta.schemas.enums import MessageRole
from letta.schemas.letta_message import ToolReturnMessage
from letta.schemas.letta_message_content import TextContent
from letta.schemas.mcp import UpdateSSEMCPServer, UpdateStdioMCPServer, UpdateStreamableHTTPMCPServer
from letta.schemas.message import Message
from letta.schemas.pip_requirement import PipRequirement
from letta.schemas.tool import Tool, ToolCreate, ToolRunFromSource, ToolUpdate
from letta.server.rest_api.streaming_response import StreamingResponseWithStatusCode
from letta.server.rest_api.utils import get_letta_server
from letta.server.server import SyncServer
from letta.services.mcp.oauth_utils import MCPOAuthSession, drill_down_exception, oauth_stream_event
from letta.services.mcp.stdio_client import AsyncStdioMCPClient
from letta.services.mcp.types import OauthStreamEvent
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
        clean_error_message = "Tool with this name already exists."
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
    except LettaToolNameConflictError as e:
        # HTTP 409 == Conflict
        print(f"Tool name conflict during update: {e}")
        raise HTTPException(status_code=409, detail=str(e))
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
            pip_requirements=request.pip_requirements,
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
            detail="No API keys found for Composio. Please add your Composio API Key as an environment variable for your sandbox configuration, or set it as environment variable COMPOSIO_API_KEY.",
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
            detail="No API keys found for Composio. Please add your Composio API Key as an environment variable for your sandbox configuration, or set it as environment variable COMPOSIO_API_KEY.",
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
        return {server.server_name: server.to_config(resolve_variables=False) for server in mcp_servers}


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

        # Check tool health - reject only INVALID tools
        if mcp_tool.health:
            if mcp_tool.health.status == "INVALID":
                raise HTTPException(
                    status_code=400,
                    detail={
                        "code": "MCPToolSchemaInvalid",
                        "message": f"Tool {mcp_tool_name} has an invalid schema and cannot be attached",
                        "mcp_tool_name": mcp_tool_name,
                        "health_status": mcp_tool.health.status,
                        "reasons": mcp_tool.health.reasons,
                    },
                )

        tool_create = ToolCreate.from_mcp(mcp_server_name=mcp_server_name, mcp_tool=mcp_tool)
        # For config-based servers, use the server name as ID since they don't have database IDs
        mcp_server_id = mcp_server_name
        return await server.tool_manager.create_mcp_tool_async(
            tool_create=tool_create, mcp_server_name=mcp_server_name, mcp_server_id=mcp_server_id, actor=actor
        )

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
                    token=request.resolve_token(),
                    custom_headers=request.custom_headers,
                )
            elif isinstance(request, StreamableHTTPServerConfig):
                mapped_request = MCPServer(
                    server_name=request.server_name,
                    server_type=request.type,
                    server_url=request.server_url,
                    token=request.resolve_token(),
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
    request: Union[UpdateStdioMCPServer, UpdateSSEMCPServer, UpdateStreamableHTTPMCPServer] = Body(...),
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
    Delete a MCP server configuration
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


@deprecated("Deprecated in favor of /mcp/servers/connect which handles OAuth flow via SSE stream")
@router.post("/mcp/servers/test", operation_id="test_mcp_server")
async def test_mcp_server(
    request: Union[StdioServerConfig, SSEServerConfig, StreamableHTTPServerConfig] = Body(...),
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Test connection to an MCP server without adding it.
    Returns the list of available tools if successful.
    """
    client = None
    try:
        actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
        request.resolve_environment_variables()
        client = await server.mcp_manager.get_mcp_client(request, actor)

        await client.connect_to_server()
        tools = await client.list_tools()

        return {"status": "success", "tools": tools}
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


@router.post(
    "/mcp/servers/connect",
    response_model=None,
    responses={
        200: {
            "description": "Successful response",
            "content": {
                "text/event-stream": {"description": "Server-Sent Events stream"},
            },
        }
    },
    operation_id="connect_mcp_server",
)
async def connect_mcp_server(
    request: Union[StdioServerConfig, SSEServerConfig, StreamableHTTPServerConfig] = Body(...),
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
    http_request: Request = None,
) -> StreamingResponse:
    """
    Connect to an MCP server with support for OAuth via SSE.
    Returns a stream of events handling authorization state and exchange if OAuth is required.
    """

    async def oauth_stream_generator(
        request: Union[StdioServerConfig, SSEServerConfig, StreamableHTTPServerConfig],
        http_request: Request,
    ) -> AsyncGenerator[str, None]:
        client = None

        oauth_flow_attempted = False
        try:
            # Acknolwedge connection attempt
            yield oauth_stream_event(OauthStreamEvent.CONNECTION_ATTEMPT, server_name=request.server_name)

            actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

            # Create MCP client with respective transport type
            try:
                request.resolve_environment_variables()
                client = await server.mcp_manager.get_mcp_client(request, actor)
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
                    logger.warning(f"OAuth not supported for stdio")
                    yield oauth_stream_event(OauthStreamEvent.ERROR, message=f"OAuth not supported for stdio")
                    return
                # Continue to OAuth flow
                logger.info(f"Attempting OAuth flow for {request}...")
            except Exception as e:
                yield oauth_stream_event(OauthStreamEvent.ERROR, message=f"Connection failed: {str(e)}")
                return
            finally:
                if client:
                    try:
                        await client.cleanup()
                    # This is a workaround to catch the expected 401 Unauthorized from the official MCP SDK, see their streamable_http.py
                    # For SSE transport types, we catch the ConnectionError above, but Streamable HTTP doesn't bubble up the exception
                    except* HTTPStatusError:
                        oauth_flow_attempted = True
                        async for event in server.mcp_manager.handle_oauth_flow(request=request, actor=actor, http_request=http_request):
                            yield event

            # Failsafe to make sure we don't try to handle OAuth flow twice
            if not oauth_flow_attempted:
                async for event in server.mcp_manager.handle_oauth_flow(request=request, actor=actor, http_request=http_request):
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

    return StreamingResponseWithStatusCode(oauth_stream_generator(request, http_request), media_type="text/event-stream")


class CodeInput(BaseModel):
    code: str = Field(..., description="Source code to parse for JSON schema")
    source_type: Optional[str] = Field("python", description="The source type of the code (python or typescript)")


@router.post("/generate-schema", response_model=Dict[str, Any], operation_id="generate_json_schema")
async def generate_json_schema(
    request: CodeInput = Body(...),
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Generate a JSON schema from the given source code defining a function or class.
    Supports both Python and TypeScript source code.
    """
    try:
        if request.source_type == "typescript":
            from letta.functions.typescript_parser import derive_typescript_json_schema

            schema = derive_typescript_json_schema(source_code=request.code)
        else:
            # Default to Python for backwards compatibility
            schema = derive_openai_json_schema(source_code=request.code)
        return schema

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to generate schema: {str(e)}")


# TODO: @jnjpng move this and other models above to appropriate file for schemas
class MCPToolExecuteRequest(BaseModel):
    args: Dict[str, Any] = Field(default_factory=dict, description="Arguments to pass to the MCP tool")


@router.post("/mcp/servers/{mcp_server_name}/tools/{tool_name}/execute", operation_id="execute_mcp_tool")
async def execute_mcp_tool(
    mcp_server_name: str,
    tool_name: str,
    request: MCPToolExecuteRequest = Body(...),
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Execute a specific MCP tool from a configured server.
    Returns the tool execution result.
    """
    client = None
    try:
        actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

        # Get the MCP server by name
        mcp_server = await server.mcp_manager.get_mcp_server(mcp_server_name, actor)
        if not mcp_server:
            raise HTTPException(
                status_code=404,
                detail={
                    "code": "MCPServerNotFound",
                    "message": f"MCP server '{mcp_server_name}' not found",
                    "server_name": mcp_server_name,
                },
            )

        # Create client and connect
        server_config = mcp_server.to_config()
        server_config.resolve_environment_variables()
        client = await server.mcp_manager.get_mcp_client(server_config, actor)
        await client.connect_to_server()

        # Execute the tool
        result, success = await client.execute_tool(tool_name, request.args)

        return {
            "result": result,
            "success": success,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Error executing MCP tool: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "code": "MCPToolExecutionError",
                "message": f"Failed to execute MCP tool: {str(e)}",
                "server_name": mcp_server_name,
                "tool_name": tool_name,
            },
        )
    finally:
        if client:
            try:
                await client.cleanup()
            except Exception as cleanup_error:
                logger.warning(f"Error during MCP client cleanup: {cleanup_error}")


# TODO: @jnjpng need to route this through cloud API for production
@router.get("/mcp/oauth/callback/{session_id}", operation_id="mcp_oauth_callback")
async def mcp_oauth_callback(
    session_id: str,
    code: Optional[str] = Query(None, description="OAuth authorization code"),
    state: Optional[str] = Query(None, description="OAuth state parameter"),
    error: Optional[str] = Query(None, description="OAuth error"),
    error_description: Optional[str] = Query(None, description="OAuth error description"),
):
    """
    Handle OAuth callback for MCP server authentication.
    """
    try:
        oauth_session = MCPOAuthSession(session_id)
        if error:
            error_msg = f"OAuth error: {error}"
            if error_description:
                error_msg += f" - {error_description}"
            await oauth_session.update_session_status(OAuthSessionStatus.ERROR)
            return {"status": "error", "message": error_msg}

        if not code or not state:
            await oauth_session.update_session_status(OAuthSessionStatus.ERROR)
            return {"status": "error", "message": "Missing authorization code or state"}

        # Store authorization code
        success = await oauth_session.store_authorization_code(code, state)
        if not success:
            await oauth_session.update_session_status(OAuthSessionStatus.ERROR)
            return {"status": "error", "message": "Invalid state parameter"}

        return {"status": "success", "message": "Authorization successful", "server_url": success.server_url}

    except Exception as e:
        logger.error(f"OAuth callback error: {e}")
        return {"status": "error", "message": f"OAuth callback failed: {str(e)}"}


class GenerateToolInput(BaseModel):
    tool_name: str = Field(..., description="Name of the tool to generate code for")
    prompt: str = Field(..., description="User prompt to generate code")
    handle: Optional[str] = Field(None, description="Handle of the tool to generate code for")
    starter_code: Optional[str] = Field(None, description="Python source code to parse for JSON schema")
    validation_errors: List[str] = Field(..., description="List of validation errors")


class GenerateToolOutput(BaseModel):
    tool: Tool = Field(..., description="Generated tool")
    sample_args: Dict[str, Any] = Field(..., description="Sample arguments for the tool")
    response: str = Field(..., description="Response from the assistant")


@router.post("/generate-tool", response_model=GenerateToolOutput, operation_id="generate_tool")
async def generate_tool_from_prompt(
    request: GenerateToolInput = Body(...),
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Generate a tool from the given user prompt.
    """
    response_data = None

    try:
        actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
        llm_config = await server.get_cached_llm_config_async(actor=actor, handle=request.handle or "anthropic/claude-3-5-sonnet-20240620")
        formatted_prompt = (
            f"Generate a python function named {request.tool_name} using the instructions below "
            + (f"based on this starter code: \n\n```\n{request.starter_code}\n```\n\n" if request.starter_code else "\n")
            + (f"Note the following validation errors: \n{' '.join(request.validation_errors)}\n\n" if request.validation_errors else "\n")
            + f"Instructions: {request.prompt}"
        )
        llm_client = LLMClient.create(
            provider_type=llm_config.model_endpoint_type,
            actor=actor,
        )
        assert llm_client is not None

        assistant_message_ack = "Understood, I will respond with generated python source code and sample arguments that can be used to test the functionality once I receive the user prompt. I'm ready."

        input_messages = [
            Message(role=MessageRole.system, content=[TextContent(text=get_system_text("memgpt_generate_tool"))]),
            Message(role=MessageRole.assistant, content=[TextContent(text=assistant_message_ack)]),
            Message(role=MessageRole.user, content=[TextContent(text=formatted_prompt)]),
        ]

        tool = {
            "name": "generate_tool",
            "description": "This method generates the raw source code for a custom tool that can be attached to and agent for llm invocation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "raw_source_code": {"type": "string", "description": "The raw python source code of the custom tool."},
                    "sample_args_json": {
                        "type": "string",
                        "description": "The JSON dict that contains sample args for a test run of the python function. Key is the name of the function parameter and value is an example argument that is passed in.",
                    },
                    "pip_requirements_json": {
                        "type": "string",
                        "description": "Optional JSON dict that contains pip packages to be installed if needed by the source code. Key is the name of the pip package and value is the version number.",
                    },
                },
                "required": ["raw_source_code", "sample_args_json", "pip_requirements_json"],
            },
        }
        request_data = llm_client.build_request_data(
            input_messages,
            llm_config,
            tools=[tool],
        )
        response_data = await llm_client.request_async(request_data, llm_config)
        response = llm_client.convert_response_to_chat_completion(response_data, input_messages, llm_config)
        output = json.loads(response.choices[0].message.tool_calls[0].function.arguments)
        pip_requirements = [PipRequirement(name=k, version=v or None) for k, v in json.loads(output["pip_requirements_json"]).items()]
        return GenerateToolOutput(
            tool=Tool(
                name=request.tool_name,
                source_type="python",
                source_code=output["raw_source_code"],
                pip_requirements=pip_requirements,
            ),
            sample_args=json.loads(output["sample_args_json"]),
            response=response.choices[0].message.content,
        )
    except Exception as e:
        logger.error(f"Failed to generate tool: {str(e)}. Raw response: {response_data}")
        raise HTTPException(status_code=500, detail=f"Failed to generate tool: {str(e)}")
