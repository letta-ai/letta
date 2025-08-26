import asyncio
import json
import traceback
from datetime import datetime, timezone
from typing import Annotated, Any, Dict, List, Optional, Union

from fastapi import APIRouter, Body, Depends, File, Form, Header, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import JSONResponse
from marshmallow import ValidationError
from orjson import orjson
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError, OperationalError
from starlette.responses import Response, StreamingResponse

from letta.agents.letta_agent import LettaAgent
from letta.constants import AGENT_ID_PATTERN, DEFAULT_MAX_STEPS, DEFAULT_MESSAGE_TOOL, DEFAULT_MESSAGE_TOOL_KWARG, REDIS_RUN_ID_PREFIX
from letta.data_sources.redis_client import NoopAsyncRedisClient, get_redis_client
from letta.errors import AgentExportIdMappingError, AgentExportProcessingError, AgentFileImportError, AgentNotFoundForExportError
from letta.groups.sleeptime_multi_agent_v2 import SleeptimeMultiAgentV2
from letta.helpers.datetime_helpers import get_utc_timestamp_ns
from letta.log import get_logger
from letta.orm.errors import NoResultFound
from letta.otel.context import get_ctx_attributes
from letta.otel.metric_registry import MetricRegistry
from letta.schemas.agent import AgentState, AgentType, CreateAgent, UpdateAgent
from letta.schemas.agent_file import AgentFileSchema
from letta.schemas.block import Block, BlockUpdate
from letta.schemas.enums import JobType
from letta.schemas.file import AgentFileAttachment, PaginatedAgentFiles
from letta.schemas.group import Group
from letta.schemas.job import JobStatus, JobUpdate, LettaRequestConfig
from letta.schemas.letta_message import LettaMessageUnion, LettaMessageUpdateUnion, MessageType
from letta.schemas.letta_request import LettaAsyncRequest, LettaRequest, LettaStreamingRequest
from letta.schemas.letta_response import LettaResponse
from letta.schemas.memory import ContextWindowOverview, CreateArchivalMemory, Memory
from letta.schemas.message import MessageCreate
from letta.schemas.passage import Passage, PassageUpdate
from letta.schemas.run import Run
from letta.schemas.source import Source
from letta.schemas.tool import Tool
from letta.schemas.user import User
from letta.serialize_schemas.pydantic_agent_schema import AgentSchema
from letta.server.rest_api.redis_stream_manager import create_background_stream_processor, redis_sse_stream_generator
from letta.server.rest_api.utils import get_letta_server
from letta.server.server import SyncServer
from letta.services.summarizer.enums import SummarizationMode
from letta.services.telemetry_manager import NoopTelemetryManager
from letta.settings import settings
from letta.utils import safe_create_task, truncate_file_visible_content

# These can be forward refs, but because Fastapi needs them at runtime the must be imported normally


router = APIRouter(prefix="/agents", tags=["agents"])

logger = get_logger(__name__)


@router.get("/", response_model=list[AgentState], operation_id="list_agents")
async def list_agents(
    name: str | None = Query(None, description="Name of the agent"),
    tags: list[str] | None = Query(None, description="List of tags to filter agents by"),
    match_all_tags: bool = Query(
        False,
        description="If True, only returns agents that match ALL given tags. Otherwise, return agents that have ANY of the passed-in tags.",
    ),
    server: SyncServer = Depends(get_letta_server),
    actor_id: str | None = Header(None, alias="user_id"),
    before: str | None = Query(None, description="Cursor for pagination"),
    after: str | None = Query(None, description="Cursor for pagination"),
    limit: int | None = Query(50, description="Limit for pagination"),
    query_text: str | None = Query(None, description="Search agents by name"),
    project_id: str | None = Query(None, description="Search agents by project ID - this will default to your default project on cloud"),
    template_id: str | None = Query(None, description="Search agents by template ID"),
    base_template_id: str | None = Query(None, description="Search agents by base template ID"),
    identity_id: str | None = Query(None, description="Search agents by identity ID"),
    identifier_keys: list[str] | None = Query(None, description="Search agents by identifier keys"),
    include_relationships: list[str] | None = Query(
        None,
        description=(
            "Specify which relational fields (e.g., 'tools', 'sources', 'memory') to include in the response. "
            "If not provided, all relationships are loaded by default. "
            "Using this can optimize performance by reducing unnecessary joins."
        ),
    ),
    ascending: bool = Query(
        False,
        description="Whether to sort agents oldest to newest (True) or newest to oldest (False, default)",
    ),
    sort_by: str | None = Query(
        "created_at",
        description="Field to sort by. Options: 'created_at' (default), 'last_run_completion'",
    ),
    show_hidden_agents: bool | None = Query(
        False,
        include_in_schema=False,
        description="If set to True, include agents marked as hidden in the results.",
    ),
):
    """
    List all agents associated with a given user.

    This endpoint retrieves a list of all agents and their configurations
    associated with the specified user ID.
    """

    # Retrieve the actor (user) details
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

    # Call list_agents directly without unnecessary dict handling
    return await server.agent_manager.list_agents_async(
        actor=actor,
        name=name,
        before=before,
        after=after,
        limit=limit,
        query_text=query_text,
        tags=tags,
        match_all_tags=match_all_tags,
        project_id=project_id,
        template_id=template_id,
        base_template_id=base_template_id,
        identity_id=identity_id,
        identifier_keys=identifier_keys,
        include_relationships=include_relationships,
        ascending=ascending,
        sort_by=sort_by,
        show_hidden_agents=show_hidden_agents,
    )


@router.get("/count", response_model=int, operation_id="count_agents")
async def count_agents(
    server: SyncServer = Depends(get_letta_server),
    actor_id: str | None = Header(None, alias="user_id"),
):
    """
    Get the count of all agents associated with a given user.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    return await server.agent_manager.size_async(actor=actor)


class IndentedORJSONResponse(Response):
    media_type = "application/json"

    def render(self, content: Any) -> bytes:
        return orjson.dumps(content, option=orjson.OPT_INDENT_2)


@router.get("/{agent_id}/export", response_class=IndentedORJSONResponse, operation_id="export_agent_serialized")
async def export_agent_serialized(
    agent_id: str,
    max_steps: int = 100,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: str | None = Header(None, alias="user_id"),
    use_legacy_format: bool = Query(
        True,
        description="If true, exports using the legacy single-agent format. If false, exports using the new multi-entity format.",
    ),
    # do not remove, used to autogeneration of spec
    # TODO: Think of a better way to export AgentFileSchema
    spec: AgentFileSchema | None = None,
    legacy_spec: AgentSchema | None = None,
) -> JSONResponse:
    """
    Export the serialized JSON representation of an agent, formatted with indentation.

    Supports two export formats:
    - Legacy format (use_legacy_format=true): Single agent with inline tools/blocks
    - New format (default): Multi-entity format with separate agents, tools, blocks, files, etc.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)

    if use_legacy_format:
        # Use the legacy serialization method
        try:
            agent = server.agent_manager.serialize(agent_id=agent_id, actor=actor, max_steps=max_steps)
            return agent.model_dump()
        except NoResultFound:
            raise HTTPException(status_code=404, detail=f"Agent with id={agent_id} not found for user_id={actor.id}.")
    else:
        # Use the new multi-entity export format
        try:
            agent_file_schema = await server.agent_serialization_manager.export(agent_ids=[agent_id], actor=actor)
            return agent_file_schema.model_dump()
        except AgentNotFoundForExportError:
            raise HTTPException(status_code=404, detail=f"Agent with id={agent_id} not found for user_id={actor.id}.")
        except AgentExportIdMappingError as e:
            raise HTTPException(
                status_code=500, detail=f"Internal error during export: ID mapping failed for {e.entity_type} ID '{e.db_id}'"
            )
        except AgentExportProcessingError as e:
            raise HTTPException(status_code=500, detail=f"Export processing failed: {str(e.original_error)}")


class ImportedAgentsResponse(BaseModel):
    """Response model for imported agents"""

    agent_ids: List[str] = Field(..., description="List of IDs of the imported agents")


def import_agent_legacy(
    agent_json: dict,
    server: "SyncServer",
    actor: User,
    append_copy_suffix: bool = True,
    override_existing_tools: bool = True,
    project_id: str | None = None,
    strip_messages: bool = False,
    env_vars: Optional[dict[str, Any]] = None,
) -> List[str]:
    """
    Import an agent using the legacy AgentSchema format.
    """
    try:
        # Validate the JSON against AgentSchema before passing it to deserialize
        agent_schema = AgentSchema.model_validate(agent_json)

        new_agent = server.agent_manager.deserialize(
            serialized_agent=agent_schema,  # Ensure we're passing a validated AgentSchema
            actor=actor,
            append_copy_suffix=append_copy_suffix,
            override_existing_tools=override_existing_tools,
            project_id=project_id,
            strip_messages=strip_messages,
            env_vars=env_vars,
        )
        return [new_agent.id]

    except ValidationError as e:
        raise HTTPException(status_code=422, detail=f"Invalid agent schema: {e!s}")

    except IntegrityError as e:
        raise HTTPException(status_code=409, detail=f"Database integrity error: {e!s}")

    except OperationalError as e:
        raise HTTPException(status_code=503, detail=f"Database connection error. Please try again later: {e!s}")

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred while uploading the agent: {e!s}")


async def import_agent(
    agent_file_json: dict,
    server: "SyncServer",
    actor: User,
    # TODO: Support these fields for new agent file
    append_copy_suffix: bool = True,
    override_existing_tools: bool = True,
    project_id: str | None = None,
    strip_messages: bool = False,
    env_vars: Optional[dict[str, Any]] = None,
) -> List[str]:
    """
    Import an agent using the new AgentFileSchema format.
    """
    try:
        agent_schema = AgentFileSchema.model_validate(agent_file_json)
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=f"Invalid agent file schema: {e!s}")

    try:
        import_result = await server.agent_serialization_manager.import_file(
            schema=agent_schema,
            actor=actor,
            append_copy_suffix=append_copy_suffix,
            override_existing_tools=override_existing_tools,
            env_vars=env_vars,
        )

        if not import_result.success:
            raise HTTPException(
                status_code=500, detail=f"Import failed: {import_result.message}. Errors: {', '.join(import_result.errors)}"
            )

        return import_result.imported_agent_ids

    except AgentFileImportError as e:
        raise HTTPException(status_code=400, detail=f"Agent file import error: {str(e)}")

    except IntegrityError as e:
        raise HTTPException(status_code=409, detail=f"Database integrity error: {e!s}")

    except OperationalError as e:
        raise HTTPException(status_code=503, detail=f"Database connection error. Please try again later: {e!s}")

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred while importing agents: {e!s}")


@router.post("/import", response_model=ImportedAgentsResponse, operation_id="import_agent_serialized")
async def import_agent_serialized(
    file: UploadFile = File(...),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: str | None = Header(None, alias="user_id"),
    append_copy_suffix: bool = Form(True, description='If set to True, appends "_copy" to the end of the agent name.'),
    override_existing_tools: bool = Form(
        True,
        description="If set to True, existing tools can get their source code overwritten by the uploaded tool definitions. Note that Letta core tools can never be updated externally.",
    ),
    project_id: str | None = Form(None, description="The project ID to associate the uploaded agent with."),
    strip_messages: bool = Form(
        False,
        description="If set to True, strips all messages from the agent before importing.",
    ),
    env_vars_json: Optional[str] = Form(
        None, description="Environment variables as a JSON string to pass to the agent for tool execution."
    ),
):
    """
    Import a serialized agent file and recreate the agent(s) in the system.
    Returns the IDs of all imported agents.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)

    try:
        serialized_data = file.file.read()
        agent_json = json.loads(serialized_data)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Corrupted agent file format.")

    # Parse env_vars_json if provided
    env_vars = None
    if env_vars_json:
        try:
            env_vars = json.loads(env_vars_json)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="env_vars_json must be a valid JSON string")

        if not isinstance(env_vars, dict):
            raise HTTPException(status_code=400, detail="env_vars_json must be a valid JSON string")

    # Check if the JSON is AgentFileSchema or AgentSchema
    # TODO: This is kind of hacky, but should work as long as dont' change the schema
    if "agents" in agent_json and isinstance(agent_json.get("agents"), list):
        # This is an AgentFileSchema
        agent_ids = await import_agent(
            agent_file_json=agent_json,
            server=server,
            actor=actor,
            append_copy_suffix=append_copy_suffix,
            override_existing_tools=override_existing_tools,
            project_id=project_id,
            strip_messages=strip_messages,
            env_vars=env_vars,
        )
    else:
        # This is a legacy AgentSchema
        agent_ids = import_agent_legacy(
            agent_json=agent_json,
            server=server,
            actor=actor,
            append_copy_suffix=append_copy_suffix,
            override_existing_tools=override_existing_tools,
            project_id=project_id,
            strip_messages=strip_messages,
            env_vars=env_vars,
        )

    return ImportedAgentsResponse(agent_ids=agent_ids)


@router.get("/{agent_id}/context", response_model=ContextWindowOverview, operation_id="retrieve_agent_context_window")
async def retrieve_agent_context_window(
    agent_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: str | None = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Retrieve the context window of a specific agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    try:
        return await server.agent_manager.get_context_window(agent_id=agent_id, actor=actor)
    except Exception as e:
        traceback.print_exc()
        raise e


class CreateAgentRequest(CreateAgent):
    """
    CreateAgent model specifically for POST request body, excluding user_id which comes from headers
    """

    # Override the user_id field to exclude it from the request body validation
    actor_id: str | None = Field(None, exclude=True)


@router.post("/", response_model=AgentState, operation_id="create_agent")
async def create_agent(
    agent: CreateAgentRequest = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: str | None = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
    x_project: str | None = Header(
        None, alias="X-Project", description="The project slug to associate with the agent (cloud only)."
    ),  # Only handled by next js middleware
):
    """
    Create a new agent with the specified configuration.
    """
    try:
        actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
        return await server.create_agent_async(agent, actor=actor)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{agent_id}", response_model=AgentState, operation_id="modify_agent")
async def modify_agent(
    agent_id: str,
    update_agent: UpdateAgent = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: str | None = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """Update an existing agent"""
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    return await server.update_agent_async(agent_id=agent_id, request=update_agent, actor=actor)


@router.get("/{agent_id}/tools", response_model=list[Tool], operation_id="list_agent_tools")
async def list_agent_tools(
    agent_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: str | None = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """Get tools from an existing agent"""
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    return await server.agent_manager.list_attached_tools_async(agent_id=agent_id, actor=actor)


@router.patch("/{agent_id}/tools/attach/{tool_id}", response_model=AgentState, operation_id="attach_tool")
async def attach_tool(
    agent_id: str,
    tool_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: str | None = Header(None, alias="user_id"),
):
    """
    Attach a tool to an agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    await server.agent_manager.attach_tool_async(agent_id=agent_id, tool_id=tool_id, actor=actor)
    # TODO: Unfortunately we need this to preserve our current API behavior
    return await server.agent_manager.get_agent_by_id_async(agent_id=agent_id, actor=actor)


@router.patch("/{agent_id}/tools/detach/{tool_id}", response_model=AgentState, operation_id="detach_tool")
async def detach_tool(
    agent_id: str,
    tool_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: str | None = Header(None, alias="user_id"),
):
    """
    Detach a tool from an agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    await server.agent_manager.detach_tool_async(agent_id=agent_id, tool_id=tool_id, actor=actor)
    # TODO: Unfortunately we need this to preserve our current API behavior
    return await server.agent_manager.get_agent_by_id_async(agent_id=agent_id, actor=actor)


@router.patch("/{agent_id}/sources/attach/{source_id}", response_model=AgentState, operation_id="attach_source_to_agent")
async def attach_source(
    agent_id: str,
    source_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: str | None = Header(None, alias="user_id"),
):
    """
    Attach a source to an agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    agent_state = await server.agent_manager.attach_source_async(agent_id=agent_id, source_id=source_id, actor=actor)

    # Check if the agent is missing any files tools
    agent_state = await server.agent_manager.attach_missing_files_tools_async(agent_state=agent_state, actor=actor)

    files = await server.file_manager.list_files(source_id, actor, include_content=True)
    if files:
        await server.agent_manager.insert_files_into_context_window(agent_state=agent_state, file_metadata_with_content=files, actor=actor)

    if agent_state.enable_sleeptime:
        source = await server.source_manager.get_source_by_id(source_id=source_id)
        safe_create_task(
            server.sleeptime_document_ingest_async(agent_state, source, actor), logger=logger, label="sleeptime_document_ingest_async"
        )

    return agent_state


@router.patch("/{agent_id}/folders/attach/{folder_id}", response_model=AgentState, operation_id="attach_folder_to_agent")
async def attach_folder_to_agent(
    agent_id: str,
    folder_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: str | None = Header(None, alias="user_id"),
):
    """
    Attach a folder to an agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    agent_state = await server.agent_manager.attach_source_async(agent_id=agent_id, source_id=folder_id, actor=actor)

    # Check if the agent is missing any files tools
    agent_state = await server.agent_manager.attach_missing_files_tools_async(agent_state=agent_state, actor=actor)

    files = await server.file_manager.list_files(folder_id, actor, include_content=True)
    if files:
        await server.agent_manager.insert_files_into_context_window(agent_state=agent_state, file_metadata_with_content=files, actor=actor)

    if agent_state.enable_sleeptime:
        source = await server.source_manager.get_source_by_id(source_id=folder_id)
        safe_create_task(
            server.sleeptime_document_ingest_async(agent_state, source, actor), logger=logger, label="sleeptime_document_ingest_async"
        )

    return agent_state


@router.patch("/{agent_id}/sources/detach/{source_id}", response_model=AgentState, operation_id="detach_source_from_agent")
async def detach_source(
    agent_id: str,
    source_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: str | None = Header(None, alias="user_id"),
):
    """
    Detach a source from an agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    agent_state = await server.agent_manager.detach_source_async(agent_id=agent_id, source_id=source_id, actor=actor)

    if not agent_state.sources:
        agent_state = await server.agent_manager.detach_all_files_tools_async(agent_state=agent_state, actor=actor)

    files = await server.file_manager.list_files(source_id, actor)
    file_ids = [f.id for f in files]
    await server.remove_files_from_context_window(agent_state=agent_state, file_ids=file_ids, actor=actor)

    if agent_state.enable_sleeptime:
        try:
            source = await server.source_manager.get_source_by_id(source_id=source_id)
            block = await server.agent_manager.get_block_with_label_async(agent_id=agent_state.id, block_label=source.name, actor=actor)
            await server.block_manager.delete_block_async(block.id, actor)
        except:
            pass
    return agent_state


@router.patch("/{agent_id}/folders/detach/{folder_id}", response_model=AgentState, operation_id="detach_folder_from_agent")
async def detach_folder_from_agent(
    agent_id: str,
    folder_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: str | None = Header(None, alias="user_id"),
):
    """
    Detach a folder from an agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    agent_state = await server.agent_manager.detach_source_async(agent_id=agent_id, source_id=folder_id, actor=actor)

    if not agent_state.sources:
        agent_state = await server.agent_manager.detach_all_files_tools_async(agent_state=agent_state, actor=actor)

    files = await server.file_manager.list_files(folder_id, actor)
    file_ids = [f.id for f in files]
    await server.remove_files_from_context_window(agent_state=agent_state, file_ids=file_ids, actor=actor)

    if agent_state.enable_sleeptime:
        try:
            source = await server.source_manager.get_source_by_id(source_id=folder_id)
            block = await server.agent_manager.get_block_with_label_async(agent_id=agent_state.id, block_label=source.name, actor=actor)
            await server.block_manager.delete_block_async(block.id, actor)
        except:
            pass
    return agent_state


@router.patch("/{agent_id}/files/close-all", response_model=List[str], operation_id="close_all_open_files")
async def close_all_open_files(
    agent_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Closes all currently open files for a given agent.

    This endpoint updates the file state for the agent so that no files are marked as open.
    Typically used to reset the working memory view for the agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

    return await server.file_agent_manager.close_all_other_files(agent_id=agent_id, keep_file_names=[], actor=actor)


@router.patch("/{agent_id}/files/{file_id}/open", response_model=List[str], operation_id="open_file")
async def open_file(
    agent_id: str,
    file_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Opens a specific file for a given agent.

    This endpoint marks a specific file as open in the agent's file state.
    The file will be included in the agent's working memory view.
    Returns a list of file names that were closed due to LRU eviction.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

    # Get the agent to access files configuration
    try:
        per_file_view_window_char_limit, max_files_open = await server.agent_manager.get_agent_files_config_async(
            agent_id=agent_id, actor=actor
        )
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Agent with id={agent_id} not found")

    # Get file metadata
    file_metadata = await server.file_manager.get_file_by_id(file_id=file_id, actor=actor, include_content=True)
    if not file_metadata:
        raise HTTPException(status_code=404, detail=f"File with id={file_id} not found")

    # Process file content with line numbers using LineChunker
    from letta.services.file_processor.chunker.line_chunker import LineChunker

    content_lines = LineChunker().chunk_text(file_metadata=file_metadata, validate_range=False)
    visible_content = "\n".join(content_lines)

    # Truncate if needed
    visible_content = truncate_file_visible_content(visible_content, True, per_file_view_window_char_limit)

    # Use enforce_max_open_files_and_open for efficient LRU handling
    closed_files, was_already_open, _ = await server.file_agent_manager.enforce_max_open_files_and_open(
        agent_id=agent_id,
        file_id=file_id,
        file_name=file_metadata.file_name,
        source_id=file_metadata.source_id,
        actor=actor,
        visible_content=visible_content,
        max_files_open=max_files_open,
    )

    return closed_files


@router.patch("/{agent_id}/files/{file_id}/close", response_model=None, operation_id="close_file")
async def close_file(
    agent_id: str,
    file_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Closes a specific file for a given agent.

    This endpoint marks a specific file as closed in the agent's file state.
    The file will be removed from the agent's working memory view.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

    # Use update_file_agent_by_id to close the file
    try:
        await server.file_agent_manager.update_file_agent_by_id(
            agent_id=agent_id,
            file_id=file_id,
            actor=actor,
            is_open=False,
        )
        return JSONResponse(status_code=status.HTTP_200_OK, content={"message": f"File id={file_id} successfully closed"})
    except NoResultFound:
        raise HTTPException(status_code=404, detail=f"File association for file_id={file_id} and agent_id={agent_id} not found")


@router.get("/{agent_id}", response_model=AgentState, operation_id="retrieve_agent")
async def retrieve_agent(
    agent_id: str,
    include_relationships: list[str] | None = Query(
        None,
        description=(
            "Specify which relational fields (e.g., 'tools', 'sources', 'memory') to include in the response. "
            "If not provided, all relationships are loaded by default. "
            "Using this can optimize performance by reducing unnecessary joins."
        ),
    ),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: str | None = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Get the state of the agent.
    """
    # Check if agent_id matches uuid4 format
    if not AGENT_ID_PATTERN.match(agent_id):
        raise HTTPException(status_code=400, detail=f"agent_id {agent_id} is not in the valid format 'agent-<uuid4>'")

    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

    try:
        return await server.agent_manager.get_agent_by_id_async(agent_id=agent_id, include_relationships=include_relationships, actor=actor)
    except NoResultFound as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{agent_id}", response_model=None, operation_id="delete_agent")
async def delete_agent(
    agent_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: str | None = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Delete an agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    try:
        await server.agent_manager.delete_agent_async(agent_id=agent_id, actor=actor)
        return JSONResponse(status_code=status.HTTP_200_OK, content={"message": f"Agent id={agent_id} successfully deleted"})
    except NoResultFound:
        raise HTTPException(status_code=404, detail=f"Agent agent_id={agent_id} not found for user_id={actor.id}.")


@router.get("/{agent_id}/sources", response_model=list[Source], operation_id="list_agent_sources")
async def list_agent_sources(
    agent_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: str | None = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Get the sources associated with an agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    return await server.agent_manager.list_attached_sources_async(agent_id=agent_id, actor=actor)


@router.get("/{agent_id}/folders", response_model=list[Source], operation_id="list_agent_folders")
async def list_agent_folders(
    agent_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: str | None = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Get the folders associated with an agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    return await server.agent_manager.list_attached_sources_async(agent_id=agent_id, actor=actor)


@router.get("/{agent_id}/files", response_model=PaginatedAgentFiles, operation_id="list_agent_files")
async def list_agent_files(
    agent_id: str,
    cursor: Optional[str] = Query(None, description="Pagination cursor from previous response"),
    limit: int = Query(20, ge=1, le=100, description="Number of items to return (1-100)"),
    is_open: Optional[bool] = Query(None, description="Filter by open status (true for open files, false for closed files)"),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: str | None = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Get the files attached to an agent with their open/closed status (paginated).
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

    # get paginated file-agent relationships for this agent
    file_agents, next_cursor, has_more = await server.file_agent_manager.list_files_for_agent_paginated(
        agent_id=agent_id, actor=actor, cursor=cursor, limit=limit, is_open=is_open
    )

    # enrich with file and source metadata
    enriched_files = []
    for fa in file_agents:
        # get source/folder metadata
        source = await server.source_manager.get_source_by_id(source_id=fa.source_id, actor=actor)

        # build response object
        attachment = AgentFileAttachment(
            id=fa.id,
            file_id=fa.file_id,
            file_name=fa.file_name,
            folder_id=fa.source_id,
            folder_name=source.name if source else "Unknown",
            is_open=fa.is_open,
            last_accessed_at=fa.last_accessed_at,
            visible_content=fa.visible_content,
            start_line=fa.start_line,
            end_line=fa.end_line,
        )
        enriched_files.append(attachment)

    return PaginatedAgentFiles(files=enriched_files, next_cursor=next_cursor, has_more=has_more)


# TODO: remove? can also get with agent blocks
@router.get("/{agent_id}/core-memory", response_model=Memory, operation_id="retrieve_agent_memory")
async def retrieve_agent_memory(
    agent_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: str | None = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Retrieve the memory state of a specific agent.
    This endpoint fetches the current memory state of the agent identified by the user ID and agent ID.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

    return await server.get_agent_memory_async(agent_id=agent_id, actor=actor)


@router.get("/{agent_id}/core-memory/blocks/{block_label}", response_model=Block, operation_id="retrieve_core_memory_block")
async def retrieve_block(
    agent_id: str,
    block_label: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: str | None = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Retrieve a core memory block from an agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

    try:
        return await server.agent_manager.get_block_with_label_async(agent_id=agent_id, block_label=block_label, actor=actor)
    except NoResultFound as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{agent_id}/core-memory/blocks", response_model=list[Block], operation_id="list_core_memory_blocks")
async def list_blocks(
    agent_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: str | None = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Retrieve the core memory blocks of a specific agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    try:
        agent = await server.agent_manager.get_agent_by_id_async(agent_id=agent_id, include_relationships=["memory"], actor=actor)
        return agent.memory.blocks
    except NoResultFound as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/{agent_id}/core-memory/blocks/{block_label}", response_model=Block, operation_id="modify_core_memory_block")
async def modify_block(
    agent_id: str,
    block_label: str,
    block_update: BlockUpdate = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: str | None = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Updates a core memory block of an agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

    block = await server.agent_manager.modify_block_by_label_async(
        agent_id=agent_id, block_label=block_label, block_update=block_update, actor=actor
    )

    # This should also trigger a system prompt change in the agent
    await server.agent_manager.rebuild_system_prompt_async(agent_id=agent_id, actor=actor, force=True, update_timestamp=False)

    return block


@router.patch("/{agent_id}/core-memory/blocks/attach/{block_id}", response_model=AgentState, operation_id="attach_core_memory_block")
async def attach_block(
    agent_id: str,
    block_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: str | None = Header(None, alias="user_id"),
):
    """
    Attach a core memory block to an agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    return await server.agent_manager.attach_block_async(agent_id=agent_id, block_id=block_id, actor=actor)


@router.patch("/{agent_id}/core-memory/blocks/detach/{block_id}", response_model=AgentState, operation_id="detach_core_memory_block")
async def detach_block(
    agent_id: str,
    block_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: str | None = Header(None, alias="user_id"),
):
    """
    Detach a core memory block from an agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    return await server.agent_manager.detach_block_async(agent_id=agent_id, block_id=block_id, actor=actor)


@router.get("/{agent_id}/archival-memory", response_model=list[Passage], operation_id="list_passages")
async def list_passages(
    agent_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    after: str | None = Query(None, description="Unique ID of the memory to start the query range at."),
    before: str | None = Query(None, description="Unique ID of the memory to end the query range at."),
    limit: int | None = Query(None, description="How many results to include in the response."),
    search: str | None = Query(None, description="Search passages by text"),
    ascending: bool | None = Query(
        True, description="Whether to sort passages oldest to newest (True, default) or newest to oldest (False)"
    ),
    actor_id: str | None = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Retrieve the memories in an agent's archival memory store (paginated query).
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

    return await server.get_agent_archival_async(
        agent_id=agent_id,
        actor=actor,
        after=after,
        before=before,
        query_text=search,
        limit=limit,
        ascending=ascending,
    )


@router.post("/{agent_id}/archival-memory", response_model=list[Passage], operation_id="create_passage")
async def create_passage(
    agent_id: str,
    request: CreateArchivalMemory = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: str | None = Header(None, alias="user_id"),
):
    """
    Insert a memory into an agent's archival memory store.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

    return await server.insert_archival_memory_async(agent_id=agent_id, memory_contents=request.text, actor=actor)


@router.patch("/{agent_id}/archival-memory/{memory_id}", response_model=list[Passage], operation_id="modify_passage")
def modify_passage(
    agent_id: str,
    memory_id: str,
    passage: PassageUpdate = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: str | None = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Modify a memory in the agent's archival memory store.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    return server.modify_archival_memory(agent_id=agent_id, memory_id=memory_id, passage=passage, actor=actor)


# TODO(ethan): query or path parameter for memory_id?
# @router.delete("/{agent_id}/archival")
@router.delete("/{agent_id}/archival-memory/{memory_id}", response_model=None, operation_id="delete_passage")
async def delete_passage(
    agent_id: str,
    memory_id: str,
    # memory_id: str = Query(..., description="Unique ID of the memory to be deleted."),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: str | None = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Delete a memory from an agent's archival memory store.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

    await server.delete_archival_memory_async(memory_id=memory_id, actor=actor)
    return JSONResponse(status_code=status.HTTP_200_OK, content={"message": f"Memory id={memory_id} successfully deleted"})


AgentMessagesResponse = Annotated[
    list[LettaMessageUnion], Field(json_schema_extra={"type": "array", "items": {"$ref": "#/components/schemas/LettaMessageUnion"}})
]


@router.get("/{agent_id}/messages", response_model=AgentMessagesResponse, operation_id="list_messages")
async def list_messages(
    agent_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    after: str | None = Query(None, description="Message after which to retrieve the returned messages."),
    before: str | None = Query(None, description="Message before which to retrieve the returned messages."),
    limit: int = Query(10, description="Maximum number of messages to retrieve."),
    group_id: str | None = Query(None, description="Group ID to filter messages by."),
    use_assistant_message: bool = Query(True, description="Whether to use assistant messages"),
    assistant_message_tool_name: str = Query(DEFAULT_MESSAGE_TOOL, description="The name of the designated message tool."),
    assistant_message_tool_kwarg: str = Query(DEFAULT_MESSAGE_TOOL_KWARG, description="The name of the message argument."),
    include_err: bool | None = Query(
        None, description="Whether to include error messages and error statuses. For debugging purposes only."
    ),
    actor_id: str | None = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Retrieve message history for an agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

    return await server.get_agent_recall_async(
        agent_id=agent_id,
        after=after,
        before=before,
        limit=limit,
        group_id=group_id,
        reverse=True,
        return_message_object=False,
        use_assistant_message=use_assistant_message,
        assistant_message_tool_name=assistant_message_tool_name,
        assistant_message_tool_kwarg=assistant_message_tool_kwarg,
        include_err=include_err,
        actor=actor,
    )


@router.patch("/{agent_id}/messages/{message_id}", response_model=LettaMessageUnion, operation_id="modify_message")
def modify_message(
    agent_id: str,
    message_id: str,
    request: LettaMessageUpdateUnion = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: str | None = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Update the details of a message associated with an agent.
    """
    # TODO: support modifying tool calls/returns
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    return server.message_manager.update_message_by_letta_message(message_id=message_id, letta_message_update=request, actor=actor)


# noinspection PyInconsistentReturns
@router.post(
    "/{agent_id}/messages",
    response_model=LettaResponse,
    operation_id="send_message",
)
async def send_message(
    agent_id: str,
    request_obj: Request,  # FastAPI Request
    server: SyncServer = Depends(get_letta_server),
    request: LettaRequest = Body(...),
    actor_id: str | None = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Process a user message and return the agent's response.
    This endpoint accepts a message from a user and processes it through the agent.
    """
    request_start_timestamp_ns = get_utc_timestamp_ns()
    MetricRegistry().user_message_counter.add(1, get_ctx_attributes())

    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    # TODO: This is redundant, remove soon
    agent = await server.agent_manager.get_agent_by_id_async(agent_id, actor, include_relationships=["multi_agent_group"])
    agent_eligible = agent.multi_agent_group is None or agent.multi_agent_group.manager_type in ["sleeptime", "voice_sleeptime"]
    model_compatible = agent.llm_config.model_endpoint_type in [
        "anthropic",
        "openai",
        "together",
        "google_ai",
        "google_vertex",
        "bedrock",
        "ollama",
        "azure",
        "xai",
        "groq",
    ]

    # Create a new run for execution tracking
    if settings.track_agent_run:
        job_status = JobStatus.created
        run = await server.job_manager.create_job_async(
            pydantic_job=Run(
                user_id=actor.id,
                status=job_status,
                metadata={
                    "job_type": "send_message",
                    "agent_id": agent_id,
                },
                request_config=LettaRequestConfig(
                    use_assistant_message=request.use_assistant_message,
                    assistant_message_tool_name=request.assistant_message_tool_name,
                    assistant_message_tool_kwarg=request.assistant_message_tool_kwarg,
                    include_return_message_types=request.include_return_message_types,
                ),
            ),
            actor=actor,
        )
    else:
        run = None

    job_update_metadata = None
    # TODO (cliandy): clean this up
    redis_client = await get_redis_client()
    await redis_client.set(f"{REDIS_RUN_ID_PREFIX}:{agent_id}", run.id if run else None)

    try:
        if agent_eligible and model_compatible:
            if agent.enable_sleeptime and agent.agent_type != AgentType.voice_convo_agent:
                agent_loop = SleeptimeMultiAgentV2(
                    agent_id=agent_id,
                    message_manager=server.message_manager,
                    agent_manager=server.agent_manager,
                    block_manager=server.block_manager,
                    passage_manager=server.passage_manager,
                    group_manager=server.group_manager,
                    job_manager=server.job_manager,
                    actor=actor,
                    group=agent.multi_agent_group,
                    current_run_id=run.id if run else None,
                )
            else:
                agent_loop = LettaAgent(
                    agent_id=agent_id,
                    message_manager=server.message_manager,
                    agent_manager=server.agent_manager,
                    block_manager=server.block_manager,
                    job_manager=server.job_manager,
                    passage_manager=server.passage_manager,
                    actor=actor,
                    step_manager=server.step_manager,
                    telemetry_manager=server.telemetry_manager if settings.llm_api_logging else NoopTelemetryManager(),
                    current_run_id=run.id if run else None,
                    # summarizer settings to be added here
                    summarizer_mode=(
                        SummarizationMode.STATIC_MESSAGE_BUFFER
                        if agent.agent_type == AgentType.voice_convo_agent
                        else SummarizationMode.PARTIAL_EVICT_MESSAGE_BUFFER
                    ),
                )

            result = await agent_loop.step(
                request.messages,
                max_steps=request.max_steps,
                use_assistant_message=request.use_assistant_message,
                request_start_timestamp_ns=request_start_timestamp_ns,
                include_return_message_types=request.include_return_message_types,
            )
        else:
            result = await server.send_message_to_agent(
                agent_id=agent_id,
                actor=actor,
                input_messages=request.messages,
                stream_steps=False,
                stream_tokens=False,
                # Support for AssistantMessage
                use_assistant_message=request.use_assistant_message,
                assistant_message_tool_name=request.assistant_message_tool_name,
                assistant_message_tool_kwarg=request.assistant_message_tool_kwarg,
                include_return_message_types=request.include_return_message_types,
            )
        job_status = result.stop_reason.stop_reason.run_status
        return result
    except Exception as e:
        job_update_metadata = {"error": str(e)}
        job_status = JobStatus.failed
        raise
    finally:
        if settings.track_agent_run:
            await server.job_manager.safe_update_job_status_async(
                job_id=run.id,
                new_status=job_status,
                actor=actor,
                metadata=job_update_metadata,
            )


# noinspection PyInconsistentReturns
@router.post(
    "/{agent_id}/messages/stream",
    response_model=None,
    operation_id="create_agent_message_stream",
    responses={
        200: {
            "description": "Successful response",
            "content": {
                "text/event-stream": {"description": "Server-Sent Events stream"},
            },
        }
    },
)
async def send_message_streaming(
    agent_id: str,
    request_obj: Request,  # FastAPI Request
    server: SyncServer = Depends(get_letta_server),
    request: LettaStreamingRequest = Body(...),
    actor_id: str | None = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
) -> StreamingResponse | LettaResponse:
    """
    Process a user message and return the agent's response.
    This endpoint accepts a message from a user and processes it through the agent.
    It will stream the steps of the response always, and stream the tokens if 'stream_tokens' is set to True.
    """
    request_start_timestamp_ns = get_utc_timestamp_ns()
    MetricRegistry().user_message_counter.add(1, get_ctx_attributes())

    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    # TODO: This is redundant, remove soon
    agent = await server.agent_manager.get_agent_by_id_async(agent_id, actor, include_relationships=["multi_agent_group"])
    agent_eligible = agent.multi_agent_group is None or agent.multi_agent_group.manager_type in ["sleeptime", "voice_sleeptime"]
    model_compatible = agent.llm_config.model_endpoint_type in [
        "anthropic",
        "openai",
        "together",
        "google_ai",
        "google_vertex",
        "bedrock",
        "ollama",
        "azure",
        "xai",
        "groq",
    ]
    model_compatible_token_streaming = agent.llm_config.model_endpoint_type in ["anthropic", "openai", "bedrock"]

    # Create a new job for execution tracking
    if settings.track_agent_run:
        job_status = JobStatus.created
        run = await server.job_manager.create_job_async(
            pydantic_job=Run(
                user_id=actor.id,
                status=job_status,
                metadata={
                    "job_type": "send_message_streaming",
                    "agent_id": agent_id,
                    "background": request.background or False,
                },
                request_config=LettaRequestConfig(
                    use_assistant_message=request.use_assistant_message,
                    assistant_message_tool_name=request.assistant_message_tool_name,
                    assistant_message_tool_kwarg=request.assistant_message_tool_kwarg,
                    include_return_message_types=request.include_return_message_types,
                ),
            ),
            actor=actor,
        )
    else:
        run = None

    job_update_metadata = None
    # TODO (cliandy): clean this up
    redis_client = await get_redis_client()
    await redis_client.set(f"{REDIS_RUN_ID_PREFIX}:{agent_id}", run.id if run else None)

    try:
        if agent_eligible and model_compatible:
            if agent.enable_sleeptime and agent.agent_type != AgentType.voice_convo_agent:
                agent_loop = SleeptimeMultiAgentV2(
                    agent_id=agent_id,
                    message_manager=server.message_manager,
                    agent_manager=server.agent_manager,
                    block_manager=server.block_manager,
                    passage_manager=server.passage_manager,
                    group_manager=server.group_manager,
                    job_manager=server.job_manager,
                    actor=actor,
                    step_manager=server.step_manager,
                    telemetry_manager=server.telemetry_manager if settings.llm_api_logging else NoopTelemetryManager(),
                    group=agent.multi_agent_group,
                    current_run_id=run.id if run else None,
                )
            else:
                agent_loop = LettaAgent(
                    agent_id=agent_id,
                    message_manager=server.message_manager,
                    agent_manager=server.agent_manager,
                    block_manager=server.block_manager,
                    job_manager=server.job_manager,
                    passage_manager=server.passage_manager,
                    actor=actor,
                    step_manager=server.step_manager,
                    telemetry_manager=server.telemetry_manager if settings.llm_api_logging else NoopTelemetryManager(),
                    current_run_id=run.id if run else None,
                    # summarizer settings to be added here
                    summarizer_mode=(
                        SummarizationMode.STATIC_MESSAGE_BUFFER
                        if agent.agent_type == AgentType.voice_convo_agent
                        else SummarizationMode.PARTIAL_EVICT_MESSAGE_BUFFER
                    ),
                )

            from letta.server.rest_api.streaming_response import StreamingResponseWithStatusCode, add_keepalive_to_stream

            if request.background and settings.track_agent_run:
                if isinstance(redis_client, NoopAsyncRedisClient):
                    raise HTTPException(
                        status_code=503,
                        detail=(
                            "Background streaming requires Redis to be running. "
                            "Please ensure Redis is properly configured. "
                            f"LETTA_REDIS_HOST: {settings.redis_host}, LETTA_REDIS_PORT: {settings.redis_port}"
                        ),
                    )

                if request.stream_tokens and model_compatible_token_streaming:
                    raw_stream = agent_loop.step_stream(
                        input_messages=request.messages,
                        max_steps=request.max_steps,
                        use_assistant_message=request.use_assistant_message,
                        request_start_timestamp_ns=request_start_timestamp_ns,
                        include_return_message_types=request.include_return_message_types,
                    )
                else:
                    raw_stream = agent_loop.step_stream_no_tokens(
                        request.messages,
                        max_steps=request.max_steps,
                        use_assistant_message=request.use_assistant_message,
                        request_start_timestamp_ns=request_start_timestamp_ns,
                        include_return_message_types=request.include_return_message_types,
                    )

                asyncio.create_task(
                    create_background_stream_processor(
                        stream_generator=raw_stream,
                        redis_client=redis_client,
                        run_id=run.id,
                    )
                )

                stream = redis_sse_stream_generator(
                    redis_client=redis_client,
                    run_id=run.id,
                )

                if request.include_pings and settings.enable_keepalive:
                    stream = add_keepalive_to_stream(stream, keepalive_interval=settings.keepalive_interval)

                return StreamingResponseWithStatusCode(
                    stream,
                    media_type="text/event-stream",
                )

            if request.stream_tokens and model_compatible_token_streaming:
                raw_stream = agent_loop.step_stream(
                    input_messages=request.messages,
                    max_steps=request.max_steps,
                    use_assistant_message=request.use_assistant_message,
                    request_start_timestamp_ns=request_start_timestamp_ns,
                    include_return_message_types=request.include_return_message_types,
                )
                # Conditionally wrap with keepalive based on request parameter
                if request.include_pings and settings.enable_keepalive:
                    stream = add_keepalive_to_stream(raw_stream, keepalive_interval=settings.keepalive_interval)
                else:
                    stream = raw_stream

                result = StreamingResponseWithStatusCode(
                    stream,
                    media_type="text/event-stream",
                )
            else:
                raw_stream = agent_loop.step_stream_no_tokens(
                    request.messages,
                    max_steps=request.max_steps,
                    use_assistant_message=request.use_assistant_message,
                    request_start_timestamp_ns=request_start_timestamp_ns,
                    include_return_message_types=request.include_return_message_types,
                )
                # Conditionally wrap with keepalive based on request parameter
                if request.include_pings and settings.enable_keepalive:
                    stream = add_keepalive_to_stream(raw_stream, keepalive_interval=settings.keepalive_interval)
                else:
                    stream = raw_stream

                result = StreamingResponseWithStatusCode(
                    stream,
                    media_type="text/event-stream",
                )
        else:
            result = await server.send_message_to_agent(
                agent_id=agent_id,
                actor=actor,
                input_messages=request.messages,
                stream_steps=True,
                stream_tokens=request.stream_tokens,
                # Support for AssistantMessage
                use_assistant_message=request.use_assistant_message,
                assistant_message_tool_name=request.assistant_message_tool_name,
                assistant_message_tool_kwarg=request.assistant_message_tool_kwarg,
                request_start_timestamp_ns=request_start_timestamp_ns,
                include_return_message_types=request.include_return_message_types,
            )
        job_status = JobStatus.running
        return result
    except Exception as e:
        job_update_metadata = {"error": str(e)}
        job_status = JobStatus.failed
        raise
    finally:
        if settings.track_agent_run:
            await server.job_manager.safe_update_job_status_async(
                job_id=run.id,
                new_status=job_status,
                actor=actor,
                metadata=job_update_metadata,
            )


class CancelAgentRunRequest(BaseModel):
    run_ids: list[str] | None = Field(None, description="Optional list of run IDs to cancel")


@router.post("/{agent_id}/messages/cancel", operation_id="cancel_agent_run")
async def cancel_agent_run(
    agent_id: str,
    request: CancelAgentRunRequest = Body(None),
    server: SyncServer = Depends(get_letta_server),
    actor_id: str | None = Header(None, alias="user_id"),
) -> dict:
    """
    Cancel runs associated with an agent. If run_ids are passed in, cancel those in particular.

    Note to cancel active runs associated with an agent, redis is required.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    if not settings.track_agent_run:
        raise HTTPException(status_code=400, detail="Agent run tracking is disabled")
    run_ids = request.run_ids if request else None
    if not run_ids:
        redis_client = await get_redis_client()
        run_id = await redis_client.get(f"{REDIS_RUN_ID_PREFIX}:{agent_id}")
        if run_id is None:
            logger.warning("Cannot find run associated with agent to cancel in redis, fetching from db.")
            job_ids = await server.job_manager.list_jobs_async(
                actor=actor,
                statuses=[JobStatus.created, JobStatus.running],
                job_type=JobType.RUN,
                ascending=False,
            )
            run_ids = [Run.from_job(job).id for job in job_ids]
        else:
            run_ids = [run_id]

    results = {}
    for run_id in run_ids:
        success = await server.job_manager.safe_update_job_status_async(
            job_id=run_id,
            new_status=JobStatus.cancelled,
            actor=actor,
        )
        results[run_id] = "cancelled" if success else "failed"
    return results


async def _process_message_background(
    run_id: str,
    server: SyncServer,
    actor: User,
    agent_id: str,
    messages: list[MessageCreate],
    use_assistant_message: bool,
    assistant_message_tool_name: str,
    assistant_message_tool_kwarg: str,
    max_steps: int = DEFAULT_MAX_STEPS,
    include_return_message_types: list[MessageType] | None = None,
) -> None:
    """Background task to process the message and update job status."""
    request_start_timestamp_ns = get_utc_timestamp_ns()
    try:
        agent = await server.agent_manager.get_agent_by_id_async(agent_id, actor, include_relationships=["multi_agent_group"])
        agent_eligible = agent.multi_agent_group is None or agent.multi_agent_group.manager_type in ["sleeptime", "voice_sleeptime"]
        model_compatible = agent.llm_config.model_endpoint_type in [
            "anthropic",
            "openai",
            "together",
            "google_ai",
            "google_vertex",
            "bedrock",
            "ollama",
            "groq",
        ]
        if agent_eligible and model_compatible:
            if agent.enable_sleeptime and agent.agent_type != AgentType.voice_convo_agent:
                agent_loop = SleeptimeMultiAgentV2(
                    agent_id=agent_id,
                    message_manager=server.message_manager,
                    agent_manager=server.agent_manager,
                    block_manager=server.block_manager,
                    passage_manager=server.passage_manager,
                    group_manager=server.group_manager,
                    job_manager=server.job_manager,
                    actor=actor,
                    group=agent.multi_agent_group,
                )
            else:
                agent_loop = LettaAgent(
                    agent_id=agent_id,
                    message_manager=server.message_manager,
                    agent_manager=server.agent_manager,
                    block_manager=server.block_manager,
                    job_manager=server.job_manager,
                    passage_manager=server.passage_manager,
                    actor=actor,
                    step_manager=server.step_manager,
                    telemetry_manager=server.telemetry_manager if settings.llm_api_logging else NoopTelemetryManager(),
                    # summarizer settings to be added here
                    summarizer_mode=(
                        SummarizationMode.STATIC_MESSAGE_BUFFER
                        if agent.agent_type == AgentType.voice_convo_agent
                        else SummarizationMode.PARTIAL_EVICT_MESSAGE_BUFFER
                    ),
                )

            result = await agent_loop.step(
                messages,
                max_steps=max_steps,
                run_id=run_id,
                use_assistant_message=use_assistant_message,
                request_start_timestamp_ns=request_start_timestamp_ns,
                include_return_message_types=include_return_message_types,
            )
        else:
            result = await server.send_message_to_agent(
                agent_id=agent_id,
                actor=actor,
                input_messages=messages,
                stream_steps=False,
                stream_tokens=False,
                metadata={"job_id": run_id},
                # Support for AssistantMessage
                use_assistant_message=use_assistant_message,
                assistant_message_tool_name=assistant_message_tool_name,
                assistant_message_tool_kwarg=assistant_message_tool_kwarg,
                include_return_message_types=include_return_message_types,
            )

        job_update = JobUpdate(
            status=JobStatus.completed,
            completed_at=datetime.now(timezone.utc),
            metadata={"result": result.model_dump(mode="json")},
        )
        await server.job_manager.update_job_by_id_async(job_id=run_id, job_update=job_update, actor=actor)

    except Exception as e:
        # Update job status to failed
        job_update = JobUpdate(
            status=JobStatus.failed,
            completed_at=datetime.now(timezone.utc),
            metadata={"error": str(e)},
        )
        await server.job_manager.update_job_by_id_async(job_id=run_id, job_update=job_update, actor=actor)


@router.post(
    "/{agent_id}/messages/async",
    response_model=Run,
    operation_id="create_agent_message_async",
)
async def send_message_async(
    agent_id: str,
    server: SyncServer = Depends(get_letta_server),
    request: LettaAsyncRequest = Body(...),
    actor_id: str | None = Header(None, alias="user_id"),
):
    """
    Asynchronously process a user message and return a run object.
    The actual processing happens in the background, and the status can be checked using the run ID.

    This is "asynchronous" in the sense that it's a background job and explicitly must be fetched by the run ID.
    This is more like `send_message_job`
    """
    MetricRegistry().user_message_counter.add(1, get_ctx_attributes())
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

    # Create a new job
    run = Run(
        user_id=actor.id,
        status=JobStatus.created,
        callback_url=request.callback_url,
        metadata={
            "job_type": "send_message_async",
            "agent_id": agent_id,
        },
        request_config=LettaRequestConfig(
            use_assistant_message=request.use_assistant_message,
            assistant_message_tool_name=request.assistant_message_tool_name,
            assistant_message_tool_kwarg=request.assistant_message_tool_kwarg,
            include_return_message_types=request.include_return_message_types,
        ),
    )
    run = await server.job_manager.create_job_async(pydantic_job=run, actor=actor)

    # Create asyncio task for background processing
    asyncio.create_task(
        _process_message_background(
            run_id=run.id,
            server=server,
            actor=actor,
            agent_id=agent_id,
            messages=request.messages,
            use_assistant_message=request.use_assistant_message,
            assistant_message_tool_name=request.assistant_message_tool_name,
            assistant_message_tool_kwarg=request.assistant_message_tool_kwarg,
            max_steps=request.max_steps,
            include_return_message_types=request.include_return_message_types,
        )
    )

    return run


@router.patch("/{agent_id}/reset-messages", response_model=AgentState, operation_id="reset_messages")
async def reset_messages(
    agent_id: str,
    add_default_initial_messages: bool = Query(default=False, description="If true, adds the default initial messages after resetting."),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: str | None = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """Resets the messages for an agent"""
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    return await server.agent_manager.reset_messages_async(
        agent_id=agent_id, actor=actor, add_default_initial_messages=add_default_initial_messages
    )


@router.get("/{agent_id}/groups", response_model=list[Group], operation_id="list_agent_groups")
async def list_agent_groups(
    agent_id: str,
    manager_type: str | None = Query(None, description="Manager type to filter groups by"),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: str | None = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """Lists the groups for an agent"""
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    logger.info("in list agents with manager_type", manager_type)
    return server.agent_manager.list_groups(agent_id=agent_id, manager_type=manager_type, actor=actor)


@router.post(
    "/{agent_id}/messages/preview-raw-payload",
    response_model=Dict[str, Any],
    operation_id="preview_raw_payload",
)
async def preview_raw_payload(
    agent_id: str,
    request: Union[LettaRequest, LettaStreamingRequest] = Body(...),
    server: SyncServer = Depends(get_letta_server),
    actor_id: str | None = Header(None, alias="user_id"),
):
    """
    Inspect the raw LLM request payload without sending it.

    This endpoint processes the message through the agent loop up until
    the LLM request, then returns the raw request payload that would
    be sent to the LLM provider. Useful for debugging and inspection.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    agent = await server.agent_manager.get_agent_by_id_async(agent_id, actor, include_relationships=["multi_agent_group"])
    agent_eligible = agent.multi_agent_group is None or agent.multi_agent_group.manager_type in ["sleeptime", "voice_sleeptime"]
    model_compatible = agent.llm_config.model_endpoint_type in [
        "anthropic",
        "openai",
        "together",
        "google_ai",
        "google_vertex",
        "bedrock",
        "ollama",
        "azure",
        "xai",
        "groq",
    ]

    if agent_eligible and model_compatible:
        if agent.enable_sleeptime:
            # TODO: @caren need to support this for sleeptime
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payload inspection is not supported for agents with sleeptime enabled.",
            )
        else:
            agent_loop = LettaAgent(
                agent_id=agent_id,
                message_manager=server.message_manager,
                agent_manager=server.agent_manager,
                block_manager=server.block_manager,
                job_manager=server.job_manager,
                passage_manager=server.passage_manager,
                actor=actor,
                step_manager=server.step_manager,
                telemetry_manager=server.telemetry_manager if settings.llm_api_logging else NoopTelemetryManager(),
                summarizer_mode=(
                    SummarizationMode.STATIC_MESSAGE_BUFFER
                    if agent.agent_type == AgentType.voice_convo_agent
                    else SummarizationMode.PARTIAL_EVICT_MESSAGE_BUFFER
                ),
            )

        # TODO: Support step_streaming
        return await agent_loop.step(
            input_messages=request.messages,
            use_assistant_message=request.use_assistant_message,
            include_return_message_types=request.include_return_message_types,
            dry_run=True,
        )

    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Payload inspection is not currently supported for this agent configuration.",
        )


@router.post("/{agent_id}/summarize", status_code=204, operation_id="summarize_agent_conversation")
async def summarize_agent_conversation(
    agent_id: str,
    request_obj: Request,  # FastAPI Request
    max_message_length: int = Query(..., description="Maximum number of messages to retain after summarization."),
    server: SyncServer = Depends(get_letta_server),
    actor_id: str | None = Header(None, alias="user_id"),
):
    """
    Summarize an agent's conversation history to a target message length.

    This endpoint summarizes the current message history for a given agent,
    truncating and compressing it down to the specified `max_message_length`.
    """

    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    agent = await server.agent_manager.get_agent_by_id_async(agent_id, actor, include_relationships=["multi_agent_group"])
    agent_eligible = agent.multi_agent_group is None or agent.multi_agent_group.manager_type in ["sleeptime", "voice_sleeptime"]
    model_compatible = agent.llm_config.model_endpoint_type in [
        "anthropic",
        "openai",
        "together",
        "google_ai",
        "google_vertex",
        "bedrock",
        "ollama",
        "azure",
        "xai",
        "groq",
    ]

    if agent_eligible and model_compatible:
        agent = LettaAgent(
            agent_id=agent_id,
            message_manager=server.message_manager,
            agent_manager=server.agent_manager,
            block_manager=server.block_manager,
            job_manager=server.job_manager,
            passage_manager=server.passage_manager,
            actor=actor,
            step_manager=server.step_manager,
            telemetry_manager=server.telemetry_manager if settings.llm_api_logging else NoopTelemetryManager(),
            message_buffer_min=max_message_length,
        )
        await agent.summarize_conversation_history()
        # Summarization completed, return 204 No Content
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Summarization is not currently supported for this agent configuration. Please contact Letta support.",
        )
