import asyncio
import json
import traceback
from datetime import datetime, timezone
from typing import Annotated, Any, Dict, List, Literal, Optional, Union

from fastapi import APIRouter, Body, Depends, File, Form, Header, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import JSONResponse
from marshmallow import ValidationError
from orjson import orjson
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.exc import IntegrityError, OperationalError
from starlette.responses import Response, StreamingResponse

from letta.agents.agent_loop import AgentLoop
from letta.agents.base_agent_v2 import BaseAgentV2
from letta.agents.letta_agent import LettaAgent
from letta.agents.letta_agent_v2 import LettaAgentV2
from letta.constants import DEFAULT_MAX_STEPS, DEFAULT_MESSAGE_TOOL, DEFAULT_MESSAGE_TOOL_KWARG, REDIS_RUN_ID_PREFIX
from letta.data_sources.redis_client import get_redis_client
from letta.errors import (
    AgentExportIdMappingError,
    AgentExportProcessingError,
    AgentFileImportError,
    AgentNotFoundForExportError,
    PendingApprovalError,
)
from letta.groups.sleeptime_multi_agent_v4 import SleeptimeMultiAgentV4
from letta.helpers.datetime_helpers import get_utc_time, get_utc_timestamp_ns
from letta.log import get_logger
from letta.orm.errors import NoResultFound
from letta.otel.context import get_ctx_attributes
from letta.otel.metric_registry import MetricRegistry
from letta.schemas.agent import AgentRelationships, AgentState, CreateAgent, UpdateAgent
from letta.schemas.agent_file import AgentFileSchema
from letta.schemas.block import BaseBlock, Block, BlockResponse, BlockUpdate
from letta.schemas.enums import AgentType, MessageRole, RunStatus
from letta.schemas.file import AgentFileAttachment, FileMetadataBase, PaginatedAgentFiles
from letta.schemas.group import Group
from letta.schemas.job import LettaRequestConfig
from letta.schemas.letta_message import LettaMessageUnion, LettaMessageUpdateUnion, MessageType
from letta.schemas.letta_message_content import TextContent
from letta.schemas.letta_request import LettaAsyncRequest, LettaRequest, LettaStreamingRequest
from letta.schemas.letta_response import LettaResponse, LettaStreamingResponse
from letta.schemas.letta_stop_reason import StopReasonType
from letta.schemas.memory import (
    ArchivalMemorySearchResponse,
    ArchivalMemorySearchResult,
    ContextWindowOverview,
    CreateArchivalMemory,
    Memory,
)
from letta.schemas.message import Message, MessageCreate, MessageCreateType, MessageSearchRequest, MessageSearchResult
from letta.schemas.passage import Passage
from letta.schemas.run import Run as PydanticRun, RunUpdate
from letta.schemas.source import BaseSource, Source
from letta.schemas.tool import BaseTool, Tool
from letta.schemas.user import User
from letta.serialize_schemas.pydantic_agent_schema import AgentSchema
from letta.server.rest_api.dependencies import HeaderParams, get_headers, get_letta_server
from letta.server.server import SyncServer
from letta.services.lettuce import LettuceClient
from letta.services.run_manager import RunManager
from letta.services.streaming_service import StreamingService
from letta.settings import settings
from letta.utils import is_1_0_sdk_version, safe_create_shielded_task, safe_create_task, truncate_file_visible_content
from letta.validators import AgentId, BlockId, FileId, MessageId, SourceId, ToolId

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
    headers: HeaderParams = Depends(get_headers),
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
            "This is a legacy parameter, and no longer supported after 1.0.0 SDK versions."
        ),
    ),
    include: List[AgentRelationships] = Query(
        [],
        description=("Specify which relational fields to include in the response. No relationships are included by default."),
    ),
    order: Literal["asc", "desc"] = Query(
        "desc", description="Sort order for agents by creation time. 'asc' for oldest first, 'desc' for newest first"
    ),
    order_by: Literal["created_at", "last_run_completion"] = Query("created_at", description="Field to sort by"),
    ascending: bool = Query(
        False,
        description="Whether to sort agents oldest to newest (True) or newest to oldest (False, default)",
        deprecated=True,
    ),
    sort_by: str | None = Query(
        "created_at",
        description="Field to sort by. Options: 'created_at' (default), 'last_run_completion'",
        deprecated=True,
    ),
    show_hidden_agents: bool | None = Query(
        False,
        include_in_schema=False,
        description="If set to True, include agents marked as hidden in the results.",
    ),
    last_stop_reason: Optional[StopReasonType] = Query(None, description="Filter agents by their last stop reason."),
):
    """
    Get a list of all agents.
    """

    # Retrieve the actor (user) details
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    # Handle backwards compatibility - prefer new parameters over legacy ones
    final_ascending = (order == "asc") if order else ascending
    final_sort_by = order_by if order_by else sort_by
    if include_relationships is None and is_1_0_sdk_version(headers):
        include_relationships = []  # don't default include all if using new SDK version

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
        include=include,
        ascending=final_ascending,
        sort_by=final_sort_by,
        show_hidden_agents=show_hidden_agents,
        last_stop_reason=last_stop_reason,
    )


@router.get("/count", response_model=int, operation_id="count_agents")
async def count_agents(
    name: str | None = Query(None, description="Name of the agent"),
    tags: list[str] | None = Query(None, description="List of tags to filter agents by"),
    match_all_tags: bool = Query(
        False,
        description="If True, only counts agents that match ALL given tags. Otherwise, counts agents that have ANY of the passed-in tags.",
    ),
    query_text: str | None = Query(None, description="Search agents by name"),
    project_id: str | None = Query(None, description="Search agents by project ID - this will default to your default project on cloud"),
    template_id: str | None = Query(None, description="Search agents by template ID"),
    base_template_id: str | None = Query(None, description="Search agents by base template ID"),
    identity_id: str | None = Query(None, description="Search agents by identity ID"),
    identifier_keys: list[str] | None = Query(None, description="Search agents by identifier keys"),
    show_hidden_agents: bool | None = Query(
        False,
        include_in_schema=False,
        description="If set to True, include agents marked as hidden in the results.",
    ),
    last_stop_reason: Optional[StopReasonType] = Query(None, description="Filter agents by their last stop reason."),
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Get the total number of agents with optional filtering.
    Supports the same filters as list_agents for consistent querying.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    # If no filters are provided, use the simpler size_async method
    if (
        all(
            param is None or param is False
            for param in [name, tags, query_text, project_id, template_id, base_template_id, identity_id, identifier_keys, last_stop_reason]
        )
        and not show_hidden_agents
    ):
        return await server.agent_manager.size_async(actor=actor)

    return await server.agent_manager.count_agents_async(
        actor=actor,
        name=name,
        tags=tags,
        match_all_tags=match_all_tags,
        query_text=query_text,
        project_id=project_id,
        template_id=template_id,
        base_template_id=base_template_id,
        identity_id=identity_id,
        identifier_keys=identifier_keys,
        show_hidden_agents=show_hidden_agents,
        last_stop_reason=last_stop_reason,
    )


class IndentedORJSONResponse(Response):
    media_type = "application/json"

    def render(self, content: Any) -> bytes:
        return orjson.dumps(content, option=orjson.OPT_INDENT_2)


@router.get("/{agent_id}/export", response_class=IndentedORJSONResponse, operation_id="export_agent")
async def export_agent(
    agent_id: str = AgentId,
    max_steps: int = Query(100, deprecated=True),
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
    use_legacy_format: bool = Query(
        False,
        description="If True, exports using the legacy single-agent 'v1' format with inline tools/blocks. If False, exports using the new multi-entity 'v2' format, with separate agents, tools, blocks, files, etc.",
        deprecated=True,
    ),
    # do not remove, used to autogeneration of spec
    # TODO: Think of a better way to export AgentFileSchema
    spec: AgentFileSchema | None = None,
    legacy_spec: AgentSchema | None = None,
) -> JSONResponse:
    """
    Export the serialized JSON representation of an agent, formatted with indentation.
    """
    if use_legacy_format:
        raise HTTPException(status_code=400, detail="Legacy format is not supported")
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    agent_file_schema = await server.agent_serialization_manager.export(agent_ids=[agent_id], actor=actor)
    return agent_file_schema.model_dump()


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


async def _import_agent(
    agent_file_json: dict,
    server: "SyncServer",
    actor: User,
    # TODO: Support these fields for new agent file
    append_copy_suffix: bool = True,
    override_name: Optional[str] = None,
    override_existing_tools: bool = True,
    project_id: str | None = None,
    strip_messages: bool = False,
    env_vars: Optional[dict[str, Any]] = None,
    override_embedding_handle: Optional[str] = None,
) -> List[str]:
    """
    Import an agent using the new AgentFileSchema format.
    """
    agent_schema = AgentFileSchema.model_validate(agent_file_json)

    if override_embedding_handle:
        embedding_config_override = await server.get_embedding_config_from_handle_async(actor=actor, handle=override_embedding_handle)
    else:
        embedding_config_override = None

    import_result = await server.agent_serialization_manager.import_file(
        schema=agent_schema,
        actor=actor,
        append_copy_suffix=append_copy_suffix,
        override_name=override_name,
        override_existing_tools=override_existing_tools,
        env_vars=env_vars,
        override_embedding_config=embedding_config_override,
        project_id=project_id,
    )

    if not import_result.success:
        from letta.errors import AgentFileImportError

        raise AgentFileImportError(f"Import failed: {import_result.message}. Errors: {', '.join(import_result.errors)}")

    return import_result.imported_agent_ids


@router.post("/import", response_model=ImportedAgentsResponse, operation_id="import_agent")
async def import_agent(
    file: UploadFile = File(...),
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
    x_override_embedding_model: str | None = Header(None, alias="x-override-embedding-model"),
    append_copy_suffix: bool = Form(
        True,
        description='If set to True, appends "_copy" to the end of the agent name.',
        deprecated=True,
    ),
    override_name: Optional[str] = Form(
        None,
        description="If provided, overrides the agent name with this value.",
    ),
    override_existing_tools: bool = Form(
        True,
        description="If set to True, existing tools can get their source code overwritten by the uploaded tool definitions. Note that Letta core tools can never be updated externally.",
    ),
    override_embedding_handle: Optional[str] = Form(
        None,
        description="Override import with specific embedding handle.",
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
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    try:
        serialized_data = file.file.read()
        file_size_mb = len(serialized_data) / (1024 * 1024)
        logger.info(f"Agent import: loaded {file_size_mb:.2f} MB into memory")
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

    # Prioritize header over form data for override_embedding_handle
    final_override_embedding_handle = x_override_embedding_model or override_embedding_handle

    # Check if the JSON is AgentFileSchema or AgentSchema
    # TODO: This is kind of hacky, but should work as long as dont' change the schema
    if "agents" in agent_json and isinstance(agent_json.get("agents"), list):
        # This is an AgentFileSchema
        agent_ids = await _import_agent(
            agent_file_json=agent_json,
            server=server,
            actor=actor,
            append_copy_suffix=append_copy_suffix,
            override_name=override_name,
            override_existing_tools=override_existing_tools,
            project_id=project_id,
            strip_messages=strip_messages,
            env_vars=env_vars,
            override_embedding_handle=final_override_embedding_handle,
        )
    else:
        # This is a legacy AgentSchema
        raise HTTPException(
            status_code=400,
            detail="Legacy AgentSchema format is deprecated. Please use the new AgentFileSchema format with 'agents' field.",
        )

    return ImportedAgentsResponse(agent_ids=agent_ids)


@router.get("/{agent_id}/context", response_model=ContextWindowOverview, operation_id="retrieve_agent_context_window", deprecated=True)
async def retrieve_agent_context_window(
    agent_id: AgentId,
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Retrieve the context window of a specific agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await server.agent_manager.get_context_window(agent_id=agent_id, actor=actor)


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
    headers: HeaderParams = Depends(get_headers),
    x_project: str | None = Header(
        None, alias="X-Project", description="The project slug to associate with the agent (cloud only)."
    ),  # Only handled by next js middleware
):
    """
    Create an agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    if headers.experimental_params.letta_v1_agent and agent.agent_type == AgentType.memgpt_v2_agent:
        agent.agent_type = AgentType.letta_v1_agent
    return await server.create_agent_async(agent, actor=actor)


@router.patch("/{agent_id}", response_model=AgentState, operation_id="modify_agent")
async def modify_agent(
    agent_id: AgentId,
    update_agent: UpdateAgent = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """Update an existing agent."""
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await server.update_agent_async(agent_id=agent_id, request=update_agent, actor=actor)


@router.get("/{agent_id}/tools", response_model=list[Tool], operation_id="list_tools_for_agent")
async def list_tools_for_agent(
    agent_id: AgentId,
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
    before: Optional[str] = Query(
        None, description="Tool ID cursor for pagination. Returns tools that come before this tool ID in the specified sort order"
    ),
    after: Optional[str] = Query(
        None, description="Tool ID cursor for pagination. Returns tools that come after this tool ID in the specified sort order"
    ),
    limit: Optional[int] = Query(10, description="Maximum number of tools to return"),
    order: Literal["asc", "desc"] = Query(
        "desc", description="Sort order for tools by creation time. 'asc' for oldest first, 'desc' for newest first"
    ),
    order_by: Literal["created_at"] = Query("created_at", description="Field to sort by"),
):
    """Get tools from an existing agent."""
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await server.agent_manager.list_attached_tools_async(
        agent_id=agent_id,
        actor=actor,
        before=before,
        after=after,
        limit=limit,
        ascending=(order == "asc"),
    )


@router.patch("/{agent_id}/tools/attach/{tool_id}", response_model=Optional[AgentState], operation_id="attach_tool_to_agent")
async def attach_tool_to_agent(
    tool_id: ToolId,
    agent_id: AgentId,
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Attach a tool to an agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    await server.agent_manager.attach_tool_async(agent_id=agent_id, tool_id=tool_id, actor=actor)
    if is_1_0_sdk_version(headers):
        return None
    # TODO: Unfortunately we need this to preserve our current API behavior
    return await server.agent_manager.get_agent_by_id_async(agent_id=agent_id, actor=actor)


@router.patch("/{agent_id}/tools/detach/{tool_id}", response_model=Optional[AgentState], operation_id="detach_tool_from_agent")
async def detach_tool_from_agent(
    tool_id: ToolId,
    agent_id: AgentId,
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Detach a tool from an agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    await server.agent_manager.detach_tool_async(agent_id=agent_id, tool_id=tool_id, actor=actor)
    if is_1_0_sdk_version(headers):
        return None
    # TODO: Unfortunately we need this to preserve our current API behavior
    return await server.agent_manager.get_agent_by_id_async(agent_id=agent_id, actor=actor)


class ModifyApprovalRequest(BaseModel):
    """Request body for modifying tool approval requirements."""

    requires_approval: bool = Field(..., description="Whether the tool requires approval before execution")

    model_config = ConfigDict(extra="forbid")


@router.patch("/{agent_id}/tools/approval/{tool_name}", response_model=Optional[AgentState], operation_id="modify_approval_for_tool")
async def modify_approval_for_tool(
    tool_name: str,
    agent_id: AgentId,
    requires_approval: bool | None = Query(None, description="Whether the tool requires approval before execution", deprecated=True),
    request: ModifyApprovalRequest | None = Body(None),
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Modify the approval requirement for a tool attached to an agent.

    Accepts requires_approval via request body (preferred) or query parameter (deprecated).
    """
    # Prefer body over query param for backwards compatibility
    if request is not None:
        approval_value = request.requires_approval
    elif requires_approval is not None:
        approval_value = requires_approval
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="requires_approval must be provided either in request body or as query parameter",
        )

    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    await server.agent_manager.modify_approvals_async(agent_id=agent_id, tool_name=tool_name, requires_approval=approval_value, actor=actor)
    if is_1_0_sdk_version(headers):
        return None
    # TODO: Unfortunately we need this to preserve our current API behavior
    return await server.agent_manager.get_agent_by_id_async(agent_id=agent_id, actor=actor)


@router.patch("/{agent_id}/sources/attach/{source_id}", response_model=AgentState, operation_id="attach_source_to_agent", deprecated=True)
async def attach_source(
    source_id: SourceId,
    agent_id: AgentId,
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Attach a source to an agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    agent_state = await server.agent_manager.attach_source_async(agent_id=agent_id, source_id=source_id, actor=actor)

    # Check if the agent is missing any files tools
    agent_state = await server.agent_manager.attach_missing_files_tools_async(agent_state=agent_state, actor=actor)

    files = await server.file_manager.list_files(source_id, actor, include_content=True)
    if files:
        await server.agent_manager.insert_files_into_context_window(agent_state=agent_state, file_metadata_with_content=files, actor=actor)

    if agent_state.enable_sleeptime:
        source = await server.source_manager.get_source_by_id(source_id=source_id)
        safe_create_task(server.sleeptime_document_ingest_async(agent_state, source, actor), label="sleeptime_document_ingest_async")

    return agent_state


@router.patch("/{agent_id}/folders/attach/{folder_id}", response_model=AgentState, operation_id="attach_folder_to_agent")
async def attach_folder_to_agent(
    folder_id: SourceId,
    agent_id: AgentId,
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Attach a folder to an agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    agent_state = await server.agent_manager.attach_source_async(agent_id=agent_id, source_id=folder_id, actor=actor)

    # Check if the agent is missing any files tools
    agent_state = await server.agent_manager.attach_missing_files_tools_async(agent_state=agent_state, actor=actor)

    files = await server.file_manager.list_files(folder_id, actor, include_content=True)
    if files:
        await server.agent_manager.insert_files_into_context_window(agent_state=agent_state, file_metadata_with_content=files, actor=actor)

    if agent_state.enable_sleeptime:
        source = await server.source_manager.get_source_by_id(source_id=folder_id)
        safe_create_task(server.sleeptime_document_ingest_async(agent_state, source, actor), label="sleeptime_document_ingest_async")

    return agent_state


@router.patch("/{agent_id}/sources/detach/{source_id}", response_model=AgentState, operation_id="detach_source_from_agent", deprecated=True)
async def detach_source(
    source_id: SourceId,
    agent_id: AgentId,
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Detach a source from an agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
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
    folder_id: SourceId,
    agent_id: AgentId,
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Detach a folder from an agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
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


@router.patch("/{agent_id}/files/close-all", response_model=List[str], operation_id="close_all_files_for_agent")
async def close_all_files_for_agent(
    agent_id: AgentId,
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Closes all currently open files for a given agent.

    This endpoint updates the file state for the agent so that no files are marked as open.
    Typically used to reset the working memory view for the agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    return await server.file_agent_manager.close_all_other_files(agent_id=agent_id, keep_file_names=[], actor=actor)


@router.patch("/{agent_id}/files/{file_id}/open", response_model=List[str], operation_id="open_file_for_agent")
async def open_file_for_agent(
    file_id: FileId,
    agent_id: AgentId,
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Opens a specific file for a given agent.

    This endpoint marks a specific file as open in the agent's file state.
    The file will be included in the agent's working memory view.
    Returns a list of file names that were closed due to LRU eviction.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    # Get the agent to access files configuration
    per_file_view_window_char_limit, max_files_open = await server.agent_manager.get_agent_files_config_async(
        agent_id=agent_id, actor=actor
    )

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


@router.patch("/{agent_id}/files/{file_id}/close", response_model=None, operation_id="close_file_for_agent")
async def close_file_for_agent(
    file_id: FileId,
    agent_id: AgentId,
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Closes a specific file for a given agent.

    This endpoint marks a specific file as closed in the agent's file state.
    The file will be removed from the agent's working memory view.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    # Use update_file_agent_by_id to close the file
    await server.file_agent_manager.update_file_agent_by_id(
        agent_id=agent_id,
        file_id=file_id,
        actor=actor,
        is_open=False,
    )
    return JSONResponse(status_code=status.HTTP_200_OK, content={"message": f"File id={file_id} successfully closed"})


@router.get("/{agent_id}", response_model=AgentState, operation_id="retrieve_agent")
async def retrieve_agent(
    agent_id: AgentId,
    include_relationships: list[str] | None = Query(
        None,
        description=(
            "Specify which relational fields (e.g., 'tools', 'sources', 'memory') to include in the response. "
            "If not provided, all relationships are loaded by default. "
            "Using this can optimize performance by reducing unnecessary joins."
            "This is a legacy parameter, and no longer supported after 1.0.0 SDK versions."
        ),
    ),
    include: List[AgentRelationships] = Query(
        [],
        description=("Specify which relational fields to include in the response. No relationships are included by default."),
    ),
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Get the state of the agent.
    """

    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    if include_relationships is None and is_1_0_sdk_version(headers):
        include_relationships = []  # don't default include all if using new SDK version
    return await server.agent_manager.get_agent_by_id_async(
        agent_id=agent_id, include_relationships=include_relationships, include=include, actor=actor
    )


@router.delete("/{agent_id}", response_model=None, operation_id="delete_agent")
async def delete_agent(
    agent_id: AgentId,
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Delete an agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    await server.agent_manager.delete_agent_async(agent_id=agent_id, actor=actor)
    return JSONResponse(status_code=status.HTTP_200_OK, content={"message": f"Agent id={agent_id} successfully deleted"})


@router.get("/{agent_id}/sources", response_model=list[Source], operation_id="list_agent_sources", deprecated=True)
async def list_agent_sources(
    agent_id: AgentId,
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
    before: Optional[str] = Query(
        None, description="Source ID cursor for pagination. Returns sources that come before this source ID in the specified sort order"
    ),
    after: Optional[str] = Query(
        None, description="Source ID cursor for pagination. Returns sources that come after this source ID in the specified sort order"
    ),
    limit: Optional[int] = Query(100, description="Maximum number of sources to return"),
    order: Literal["asc", "desc"] = Query(
        "desc", description="Sort order for sources by creation time. 'asc' for oldest first, 'desc' for newest first"
    ),
    order_by: Literal["created_at"] = Query("created_at", description="Field to sort by"),
):
    """
    Get the sources associated with an agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await server.agent_manager.list_attached_sources_async(
        agent_id=agent_id,
        actor=actor,
        before=before,
        after=after,
        limit=limit,
        ascending=(order == "asc"),
    )


@router.get("/{agent_id}/folders", response_model=list[Source], operation_id="list_folders_for_agent")
async def list_folders_for_agent(
    agent_id: AgentId,
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
    before: Optional[str] = Query(
        None, description="Source ID cursor for pagination. Returns sources that come before this source ID in the specified sort order"
    ),
    after: Optional[str] = Query(
        None, description="Source ID cursor for pagination. Returns sources that come after this source ID in the specified sort order"
    ),
    limit: Optional[int] = Query(100, description="Maximum number of sources to return"),
    order: Literal["asc", "desc"] = Query(
        "desc", description="Sort order for sources by creation time. 'asc' for oldest first, 'desc' for newest first"
    ),
    order_by: Literal["created_at"] = Query("created_at", description="Field to sort by"),
):
    """
    Get the folders associated with an agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await server.agent_manager.list_attached_sources_async(
        agent_id=agent_id,
        actor=actor,
        before=before,
        after=after,
        limit=limit,
        ascending=(order == "asc"),
    )


@router.get("/{agent_id}/files", response_model=PaginatedAgentFiles, operation_id="list_files_for_agent")
async def list_files_for_agent(
    agent_id: AgentId,
    before: Optional[str] = Query(
        None, description="File ID cursor for pagination. Returns files that come before this file ID in the specified sort order"
    ),
    after: Optional[str] = Query(
        None, description="File ID cursor for pagination. Returns files that come after this file ID in the specified sort order"
    ),
    limit: Optional[int] = Query(100, description="Maximum number of files to return"),
    order: Literal["asc", "desc"] = Query(
        "desc", description="Sort order for files by creation time. 'asc' for oldest first, 'desc' for newest first"
    ),
    order_by: Literal["created_at"] = Query("created_at", description="Field to sort by"),
    cursor: Optional[str] = Query(
        None, description="Pagination cursor from previous response (deprecated, use before/after)", deprecated=True
    ),
    is_open: Optional[bool] = Query(None, description="Filter by open status (true for open files, false for closed files)"),
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Get the files attached to an agent with their open/closed status.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    effective_limit = limit or 20

    # get paginated file-agent relationships for this agent
    file_agents, next_cursor, has_more = await server.file_agent_manager.list_files_for_agent_paginated(
        agent_id=agent_id,
        actor=actor,
        cursor=cursor,  # keep for backwards compatibility
        limit=effective_limit,
        is_open=is_open,
        before=before,
        after=after,
        ascending=(order == "asc"),
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
@router.get("/{agent_id}/core-memory", response_model=Memory, operation_id="retrieve_agent_memory", deprecated=True)
async def retrieve_agent_memory(
    agent_id: AgentId,
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Retrieve the memory state of a specific agent.
    This endpoint fetches the current memory state of the agent identified by the user ID and agent ID.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    return await server.get_agent_memory_async(agent_id=agent_id, actor=actor)


@router.get("/{agent_id}/core-memory/blocks/{block_label}", response_model=BlockResponse, operation_id="retrieve_core_memory_block")
async def retrieve_block_for_agent(
    block_label: str,
    agent_id: AgentId,
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Retrieve a core memory block from an agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    return await server.agent_manager.get_block_with_label_async(agent_id=agent_id, block_label=block_label, actor=actor)


@router.get("/{agent_id}/core-memory/blocks", response_model=list[BlockResponse], operation_id="list_core_memory_blocks")
async def list_blocks_for_agent(
    agent_id: AgentId,
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
    before: Optional[str] = Query(
        None, description="Block ID cursor for pagination. Returns blocks that come before this block ID in the specified sort order"
    ),
    after: Optional[str] = Query(
        None, description="Block ID cursor for pagination. Returns blocks that come after this block ID in the specified sort order"
    ),
    limit: Optional[int] = Query(100, description="Maximum number of blocks to return"),
    order: Literal["asc", "desc"] = Query(
        "desc", description="Sort order for blocks by creation time. 'asc' for oldest first, 'desc' for newest first"
    ),
    order_by: Literal["created_at"] = Query("created_at", description="Field to sort by"),
):
    """
    Retrieve the core memory blocks of a specific agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    return await server.agent_manager.list_agent_blocks_async(
        agent_id=agent_id,
        actor=actor,
        before=before,
        after=after,
        limit=limit,
        ascending=(order == "asc"),
    )


@router.patch("/{agent_id}/core-memory/blocks/{block_label}", response_model=BlockResponse, operation_id="modify_core_memory_block")
async def modify_block_for_agent(
    block_label: str,
    agent_id: AgentId,
    block_update: BlockUpdate = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Updates a core memory block of an agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    block = await server.agent_manager.modify_block_by_label_async(
        agent_id=agent_id, block_label=block_label, block_update=block_update, actor=actor
    )

    # This should also trigger a system prompt change in the agent
    await server.agent_manager.rebuild_system_prompt_async(agent_id=agent_id, actor=actor, force=True, update_timestamp=False)

    return block


@router.patch("/{agent_id}/core-memory/blocks/attach/{block_id}", response_model=AgentState, operation_id="attach_core_memory_block")
async def attach_block_to_agent(
    block_id: BlockId,
    agent_id: AgentId,
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Attach a core memory block to an agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await server.agent_manager.attach_block_async(agent_id=agent_id, block_id=block_id, actor=actor)


@router.patch("/{agent_id}/core-memory/blocks/detach/{block_id}", response_model=AgentState, operation_id="detach_core_memory_block")
async def detach_block_from_agent(
    block_id: BlockId,
    agent_id: AgentId,
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Detach a core memory block from an agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await server.agent_manager.detach_block_async(agent_id=agent_id, block_id=block_id, actor=actor)


@router.patch("/{agent_id}/archives/attach/{archive_id}", response_model=None, operation_id="attach_archive_to_agent")
async def attach_archive_to_agent(
    archive_id: str,
    agent_id: AgentId,
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Attach an archive to an agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    await server.archive_manager.attach_agent_to_archive_async(
        agent_id=agent_id,
        archive_id=archive_id,
        actor=actor,
    )
    return None


@router.patch("/{agent_id}/archives/detach/{archive_id}", response_model=None, operation_id="detach_archive_from_agent")
async def detach_archive_from_agent(
    archive_id: str,
    agent_id: AgentId,
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Detach an archive from an agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    await server.archive_manager.detach_agent_from_archive_async(
        agent_id=agent_id,
        archive_id=archive_id,
        actor=actor,
    )
    return None


@router.patch("/{agent_id}/identities/attach/{identity_id}", response_model=None, operation_id="attach_identity_to_agent")
async def attach_identity_to_agent(
    identity_id: str,
    agent_id: AgentId,
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Attach an identity to an agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    await server.identity_manager.attach_agent_async(
        identity_id=identity_id,
        agent_id=agent_id,
        actor=actor,
    )
    return None


@router.patch("/{agent_id}/identities/detach/{identity_id}", response_model=None, operation_id="detach_identity_from_agent")
async def detach_identity_from_agent(
    identity_id: str,
    agent_id: AgentId,
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Detach an identity from an agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    await server.identity_manager.detach_agent_async(
        identity_id=identity_id,
        agent_id=agent_id,
        actor=actor,
    )
    return None


@router.get("/{agent_id}/archival-memory", response_model=list[Passage], operation_id="list_passages", deprecated=True)
async def list_passages(
    agent_id: AgentId,
    server: "SyncServer" = Depends(get_letta_server),
    after: str | None = Query(None, description="Unique ID of the memory to start the query range at."),
    before: str | None = Query(None, description="Unique ID of the memory to end the query range at."),
    limit: int | None = Query(100, description="How many results to include in the response."),
    search: str | None = Query(None, description="Search passages by text"),
    ascending: bool | None = Query(
        True, description="Whether to sort passages oldest to newest (True, default) or newest to oldest (False)"
    ),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Retrieve the memories in an agent's archival memory store (paginated query).
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    return await server.get_agent_archival_async(
        agent_id=agent_id,
        actor=actor,
        after=after,
        before=before,
        query_text=search,
        limit=limit,
        ascending=ascending,
    )


@router.post("/{agent_id}/archival-memory", response_model=list[Passage], operation_id="create_passage", deprecated=True)
async def create_passage(
    agent_id: AgentId,
    request: CreateArchivalMemory = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Insert a memory into an agent's archival memory store.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    return await server.insert_archival_memory_async(
        agent_id=agent_id, memory_contents=request.text, actor=actor, tags=request.tags, created_at=request.created_at
    )


@router.get(
    "/{agent_id}/archival-memory/search",
    response_model=ArchivalMemorySearchResponse,
    operation_id="search_archival_memory",
    deprecated=True,
)
async def search_archival_memory(
    agent_id: AgentId,
    query: str = Query(..., description="String to search for using semantic similarity"),
    tags: Optional[List[str]] = Query(None, description="Optional list of tags to filter search results"),
    tag_match_mode: Literal["any", "all"] = Query(
        "any", description="How to match tags - 'any' to match passages with any of the tags, 'all' to match only passages with all tags"
    ),
    top_k: Optional[int] = Query(None, description="Maximum number of results to return. Uses system default if not specified"),
    start_datetime: Optional[datetime] = Query(None, description="Filter results to passages created after this datetime"),
    end_datetime: Optional[datetime] = Query(None, description="Filter results to passages created before this datetime"),
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Search archival memory using semantic (embedding-based) search with optional temporal filtering.

    This endpoint allows manual triggering of archival memory searches, enabling users to query
    an agent's archival memory store directly via the API. The search uses the same functionality
    as the agent's archival_memory_search tool but is accessible for external API usage.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    # convert datetime to string in ISO 8601 format
    start_datetime = start_datetime.isoformat() if start_datetime else None
    end_datetime = end_datetime.isoformat() if end_datetime else None

    # Use the shared agent manager method
    formatted_results = await server.agent_manager.search_agent_archival_memory_async(
        agent_id=agent_id,
        actor=actor,
        query=query,
        tags=tags,
        tag_match_mode=tag_match_mode,
        top_k=top_k,
        start_datetime=start_datetime,
        end_datetime=end_datetime,
    )

    # Convert to proper response schema
    search_results = [ArchivalMemorySearchResult(**result) for result in formatted_results]

    return ArchivalMemorySearchResponse(results=search_results, count=len(formatted_results))


# TODO(ethan): query or path parameter for memory_id?
# @router.delete("/{agent_id}/archival")
@router.delete("/{agent_id}/archival-memory/{memory_id}", response_model=None, operation_id="delete_passage", deprecated=True)
async def delete_passage(
    memory_id: str,
    agent_id: AgentId,
    # memory_id: str = Query(..., description="Unique ID of the memory to be deleted."),
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Delete a memory from an agent's archival memory store.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    await server.delete_archival_memory_async(memory_id=memory_id, actor=actor)
    return JSONResponse(status_code=status.HTTP_200_OK, content={"message": f"Memory id={memory_id} successfully deleted"})


AgentMessagesResponse = Annotated[
    list[LettaMessageUnion], Field(json_schema_extra={"type": "array", "items": {"$ref": "#/components/schemas/LettaMessageUnion"}})
]


@router.get("/{agent_id}/messages", response_model=AgentMessagesResponse, operation_id="list_messages")
async def list_messages(
    agent_id: AgentId,
    server: "SyncServer" = Depends(get_letta_server),
    before: Optional[str] = Query(
        None, description="Message ID cursor for pagination. Returns messages that come before this message ID in the specified sort order"
    ),
    after: Optional[str] = Query(
        None, description="Message ID cursor for pagination. Returns messages that come after this message ID in the specified sort order"
    ),
    limit: Optional[int] = Query(100, description="Maximum number of messages to return"),
    order: Literal["asc", "desc"] = Query(
        "desc", description="Sort order for messages by creation time. 'asc' for oldest first, 'desc' for newest first"
    ),
    order_by: Literal["created_at"] = Query("created_at", description="Field to sort by"),
    group_id: str | None = Query(None, description="Group ID to filter messages by."),
    use_assistant_message: bool = Query(True, description="Whether to use assistant messages", deprecated=True),
    assistant_message_tool_name: str = Query(DEFAULT_MESSAGE_TOOL, description="The name of the designated message tool.", deprecated=True),
    assistant_message_tool_kwarg: str = Query(DEFAULT_MESSAGE_TOOL_KWARG, description="The name of the message argument.", deprecated=True),
    include_err: bool | None = Query(
        None, description="Whether to include error messages and error statuses. For debugging purposes only."
    ),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Retrieve message history for an agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    return await server.get_agent_recall_async(
        agent_id=agent_id,
        after=after,
        before=before,
        limit=limit,
        group_id=group_id,
        reverse=(order == "desc"),
        return_message_object=False,
        use_assistant_message=use_assistant_message,
        assistant_message_tool_name=assistant_message_tool_name,
        assistant_message_tool_kwarg=assistant_message_tool_kwarg,
        include_err=include_err,
        actor=actor,
    )


@router.patch("/{agent_id}/messages/{message_id}", response_model=LettaMessageUnion, operation_id="modify_message")
async def modify_message(
    agent_id: AgentId,  # backwards compatible. Consider removing for v1
    message_id: MessageId,
    request: LettaMessageUpdateUnion = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Update the details of a message associated with an agent.
    """
    # TODO: support modifying tool calls/returns
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await server.message_manager.update_message_by_letta_message_async(
        message_id=message_id, letta_message_update=request, actor=actor
    )


# noinspection PyInconsistentReturns
@router.post(
    "/{agent_id}/messages",
    response_model=LettaResponse,
    operation_id="send_message",
    responses={
        200: {
            "description": "Successful response",
            "content": {
                "application/json": {"schema": {"$ref": "#/components/schemas/LettaResponse"}},
                "text/event-stream": {"description": "Server-Sent Events stream (when streaming=true in request body)"},
            },
        }
    },
)
async def send_message(
    request_obj: Request,  # FastAPI Request
    agent_id: AgentId,
    server: SyncServer = Depends(get_letta_server),
    request: LettaStreamingRequest = Body(...),
    headers: HeaderParams = Depends(get_headers),
) -> StreamingResponse | LettaResponse:
    """
    Process a user message and return the agent's response.
    This endpoint accepts a message from a user and processes it through the agent.

    The response format is controlled by the `streaming` field in the request body:
    - If `streaming=false` (default): Returns a complete LettaResponse with all messages
    - If `streaming=true`: Returns a Server-Sent Events (SSE) stream

    Additional streaming options (only used when streaming=true):
    - `stream_tokens`: Stream individual tokens instead of complete steps
    - `include_pings`: Include keepalive pings to prevent connection timeouts
    - `background`: Process the request in the background
    """
    # After validation, messages should always be set (converted from input if needed)
    if not request.messages or len(request.messages) == 0:
        raise HTTPException(status_code=422, detail="Messages must not be empty")

    # Validate streaming-specific options are only set when streaming=true
    if not request.streaming:
        errors = []

        if request.stream_tokens is True:
            errors.append("stream_tokens can only be true when streaming=true")

        if request.include_pings is False:
            errors.append("include_pings can only be set to false when streaming=true")

        if request.background is True:
            errors.append("background can only be true when streaming=true")

        if errors:
            raise HTTPException(
                status_code=422,
                detail=f"Streaming options set without streaming enabled. {'; '.join(errors)}. "
                "Either set streaming=true or use default values for streaming options.",
            )

    is_1_0_sdk = is_1_0_sdk_version(headers)
    if request.streaming and not is_1_0_sdk:
        raise HTTPException(status_code=422, detail="streaming=true is only supported for SDK v1.0+ clients.")

    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    if request.streaming and is_1_0_sdk:
        streaming_service = StreamingService(server)
        run, result = await streaming_service.create_agent_stream(
            agent_id=agent_id,
            actor=actor,
            request=request,
            run_type="send_message",
        )
        return result

    request_start_timestamp_ns = get_utc_timestamp_ns()
    MetricRegistry().user_message_counter.add(1, get_ctx_attributes())
    # TODO: This is redundant, remove soon
    agent = await server.agent_manager.get_agent_by_id_async(
        agent_id, actor, include_relationships=["memory", "multi_agent_group", "sources", "tool_exec_environment_variables", "tools"]
    )
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
        "deepseek",
    ]

    # Create a new run for execution tracking
    if settings.track_agent_run:
        runs_manager = RunManager()
        run = await runs_manager.create_run(
            pydantic_run=PydanticRun(
                agent_id=agent_id,
                background=False,
                metadata={
                    "run_type": "send_message",
                },
                request_config=LettaRequestConfig.from_letta_request(request),
            ),
            actor=actor,
        )
    else:
        run = None

    # TODO (cliandy): clean this up
    redis_client = await get_redis_client()
    await redis_client.set(f"{REDIS_RUN_ID_PREFIX}:{agent_id}", run.id if run else None)

    run_update_metadata = None
    try:
        result = None
        if agent_eligible and model_compatible:
            agent_loop = AgentLoop.load(agent_state=agent, actor=actor)
            result = await agent_loop.step(
                request.messages,
                max_steps=request.max_steps,
                run_id=run.id if run else None,
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
        run_status = result.stop_reason.stop_reason.run_status
        return result
    except PendingApprovalError as e:
        run_update_metadata = {"error": str(e)}
        run_status = RunStatus.failed
        raise HTTPException(
            status_code=409, detail={"code": "PENDING_APPROVAL", "message": str(e), "pending_request_id": e.pending_request_id}
        )
    except Exception as e:
        run_update_metadata = {"error": str(e)}
        run_status = RunStatus.failed
        raise
    finally:
        if settings.track_agent_run:
            if result:
                stop_reason = result.stop_reason.stop_reason
            else:
                # NOTE: we could also consider this an error?
                stop_reason = None
            await server.run_manager.update_run_by_id_async(
                run_id=run.id,
                update=RunUpdate(
                    status=run_status,
                    metadata=run_update_metadata,
                    stop_reason=stop_reason,
                ),
                actor=actor,
            )


# noinspection PyInconsistentReturns
@router.post(
    "/{agent_id}/messages/stream",
    response_model=LettaStreamingResponse,
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
    request_obj: Request,  # FastAPI Request
    agent_id: AgentId,
    server: SyncServer = Depends(get_letta_server),
    request: LettaStreamingRequest = Body(...),
    headers: HeaderParams = Depends(get_headers),
) -> StreamingResponse | LettaResponse:
    """
    Process a user message and return the agent's response.
    This endpoint accepts a message from a user and processes it through the agent.
    It will stream the steps of the response always, and stream the tokens if 'stream_tokens' is set to True.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    # Since this is the dedicated streaming endpoint, ensure streaming is enabled
    request.streaming = True

    # use the streaming service for unified stream handling
    streaming_service = StreamingService(server)

    run, result = await streaming_service.create_agent_stream(
        agent_id=agent_id,
        actor=actor,
        request=request,
        run_type="send_message_streaming",
    )

    return result


class CancelAgentRunRequest(BaseModel):
    run_ids: list[str] | None = Field(None, description="Optional list of run IDs to cancel")


@router.post("/{agent_id}/messages/cancel", operation_id="cancel_message")
async def cancel_message(
    agent_id: AgentId,
    request: CancelAgentRunRequest = Body(None),
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
) -> dict:
    """
    Cancel runs associated with an agent. If run_ids are passed in, cancel those in particular.

    Note to cancel active runs associated with an agent, redis is required.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    if not settings.track_agent_run:
        raise HTTPException(status_code=400, detail="Agent run tracking is disabled")
    run_ids = request.run_ids if request else None
    if not run_ids:
        redis_client = await get_redis_client()
        run_id = await redis_client.get(f"{REDIS_RUN_ID_PREFIX}:{agent_id}")
        if run_id is None:
            logger.warning("Cannot find run associated with agent to cancel in redis, fetching from db.")
            run_ids = await server.run_manager.list_runs(
                actor=actor,
                statuses=[RunStatus.created, RunStatus.running],
                ascending=False,
                agent_id=agent_id,  # NOTE: this will override agent_ids if provided
            )
            run_ids = [run.id for run in run_ids]
        else:
            run_ids = [run_id]

    results = {}
    for run_id in run_ids:
        run = await server.run_manager.get_run_by_id(run_id=run_id, actor=actor)
        if run.metadata.get("lettuce"):
            lettuce_client = await LettuceClient.create()
            await lettuce_client.cancel(run_id)
        success = await server.run_manager.update_run_by_id_async(
            run_id=run_id,
            update=RunUpdate(status=RunStatus.cancelled),
            actor=actor,
        )
        results[run_id] = "cancelled" if success else "failed"
    return results


@router.post("/messages/search", response_model=List[MessageSearchResult], operation_id="search_messages")
async def search_messages(
    request: MessageSearchRequest = Body(...),
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Search messages across the entire organization with optional project and template filtering. Returns messages with FTS/vector ranks and total RRF score.

    This is a cloud-only feature.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    # get embedding config from the default agent if needed
    # check if any agents exist in the org
    agent_count = await server.agent_manager.size_async(actor=actor)
    if agent_count == 0:
        raise HTTPException(status_code=400, detail="No agents found in organization to derive embedding configuration from")

    results = await server.message_manager.search_messages_org_async(
        actor=actor,
        query_text=request.query,
        search_mode=request.search_mode,
        roles=request.roles,
        project_id=request.project_id,
        template_id=request.template_id,
        limit=request.limit,
        start_date=request.start_date,
        end_date=request.end_date,
    )
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
    """Background task to process the message and update run status."""
    request_start_timestamp_ns = get_utc_timestamp_ns()
    agent_loop = None
    result = None

    try:
        agent = await server.agent_manager.get_agent_by_id_async(
            agent_id, actor, include_relationships=["memory", "multi_agent_group", "sources", "tool_exec_environment_variables", "tools"]
        )
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
            "deepseek",
        ]
        if agent_eligible and model_compatible:
            agent_loop = AgentLoop.load(agent_state=agent, actor=actor)
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
                metadata={"run_id": run_id},
                # Support for AssistantMessage
                use_assistant_message=use_assistant_message,
                assistant_message_tool_name=assistant_message_tool_name,
                assistant_message_tool_kwarg=assistant_message_tool_kwarg,
                include_return_message_types=include_return_message_types,
            )

        runs_manager = RunManager()
        from letta.schemas.enums import RunStatus

        if result.stop_reason.stop_reason == "cancelled":
            run_status = RunStatus.cancelled
        else:
            run_status = RunStatus.completed

        await runs_manager.update_run_by_id_async(
            run_id=run_id,
            update=RunUpdate(status=run_status, stop_reason=result.stop_reason.stop_reason),
            actor=actor,
        )

    except PendingApprovalError as e:
        # Update run status to failed with specific error info
        runs_manager = RunManager()
        from letta.schemas.enums import RunStatus

        await runs_manager.update_run_by_id_async(
            run_id=run_id,
            update=RunUpdate(status=RunStatus.failed),
            actor=actor,
        )
    except Exception as e:
        # Update run status to failed
        runs_manager = RunManager()
        from letta.schemas.enums import RunStatus

        await runs_manager.update_run_by_id_async(
            run_id=run_id,
            update=RunUpdate(status=RunStatus.failed),
            actor=actor,
        )
    finally:
        # Critical: Explicit resource cleanup to prevent accumulation
        if agent_loop and result:
            await _cleanup_background_task_resources(agent_loop, result)


async def _cleanup_background_task_resources(agent_loop: BaseAgentV2 | LettaAgent, result: StreamingResponse | LettaResponse) -> None:
    """
    Explicit cleanup of resources created during background message processing.

    Proper cleanup of:
    - Agent instances and their internal state
    - Message buffers and response accumulation
    - Any database connections or sessions
    - LLM client resources
    """
    import gc

    try:
        if agent_loop is not None:
            if agent_loop.response_messages:
                # Clear response message buffer to prevent accumulation
                agent_loop.response_messages.clear()
            # Clean up agent loop resources
            del agent_loop

        if result is not None:
            del result  # Clear result data to free memory

        # Force garbage collection to clean up references and release memory
        gc.collect()
    except Exception as e:
        # Handle errors for logging but don't fail the background task
        logger.warning(f"Error during background task resource cleanup: {e}")
        pass


@router.post(
    "/{agent_id}/messages/async",
    response_model=PydanticRun,
    operation_id="create_agent_message_async",
)
async def send_message_async(
    agent_id: AgentId,
    server: SyncServer = Depends(get_letta_server),
    request: LettaAsyncRequest = Body(...),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Asynchronously process a user message and return a run object.
    The actual processing happens in the background, and the status can be checked using the run ID.

    This is "asynchronous" in the sense that it's a background run and explicitly must be fetched by the run ID.
    """
    MetricRegistry().user_message_counter.add(1, get_ctx_attributes())
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    try:
        is_message_input = request.messages[0].type == MessageCreateType.message
    except:
        is_message_input = True
    use_lettuce = headers.experimental_params.message_async and is_message_input

    # Create a new run
    run = PydanticRun(
        callback_url=request.callback_url,
        agent_id=agent_id,
        background=True,  # Async endpoints are always background
        metadata={
            "run_type": "send_message_async",
            "lettuce": use_lettuce,
        },
        request_config=LettaRequestConfig.from_letta_request(request),
    )
    run = await server.run_manager.create_run(
        pydantic_run=run,
        actor=actor,
    )

    if use_lettuce:
        agent_state = await server.agent_manager.get_agent_by_id_async(
            agent_id, actor, include_relationships=["memory", "multi_agent_group", "sources", "tool_exec_environment_variables", "tools"]
        )
        if agent_state.multi_agent_group is None and agent_state.agent_type != AgentType.letta_v1_agent:
            lettuce_client = await LettuceClient.create()
            run_id_from_lettuce = await lettuce_client.step(
                agent_state=agent_state,
                actor=actor,
                input_messages=request.messages,
                max_steps=request.max_steps,
                run_id=run.id,
                use_assistant_message=request.use_assistant_message,
                include_return_message_types=request.include_return_message_types,
            )
            if run_id_from_lettuce:
                return run

    # Create asyncio task for background processing (shielded to prevent cancellation)
    task = safe_create_shielded_task(
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
        ),
        label=f"process_message_background_{run.id}",
    )

    def handle_task_completion(t):
        try:
            t.result()
        except asyncio.CancelledError:
            # Note: With shielded tasks, cancellation attempts don't actually stop the task
            logger.info(f"Cancellation attempted on shielded background task for run {run.id}, but task continues running")
            # Don't mark as failed since the shielded task is still running
        except Exception as e:
            logger.error(f"Unhandled exception in background task for run {run.id}: {e}")
            from letta.services.run_manager import RunManager

            async def update_failed_run():
                runs_manager = RunManager()
                from letta.schemas.enums import RunStatus

                await runs_manager.update_run_by_id_async(
                    run_id=run.id,
                    update=RunUpdate(status=RunStatus.failed),
                    actor=actor,
                )

            safe_create_task(
                update_failed_run(),
                label=f"update_failed_run_{run.id}",
            )

    task.add_done_callback(handle_task_completion)

    return run


class ResetMessagesRequest(BaseModel):
    """Request body for resetting messages on an agent."""

    add_default_initial_messages: bool = Field(
        False,
        description="If true, adds the default initial messages after resetting.",
    )


@router.patch("/{agent_id}/reset-messages", response_model=AgentState, operation_id="reset_messages")
async def reset_messages(
    agent_id: AgentId,
    request: ResetMessagesRequest = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """Resets the messages for an agent"""
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await server.agent_manager.reset_messages_async(
        agent_id=agent_id, actor=actor, add_default_initial_messages=request.add_default_initial_messages
    )


@router.get("/{agent_id}/groups", response_model=list[Group], operation_id="list_groups_for_agent")
async def list_groups_for_agent(
    agent_id: AgentId,
    manager_type: str | None = Query(None, description="Manager type to filter groups by"),
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
    before: Optional[str] = Query(
        None, description="Group ID cursor for pagination. Returns groups that come before this group ID in the specified sort order"
    ),
    after: Optional[str] = Query(
        None, description="Group ID cursor for pagination. Returns groups that come after this group ID in the specified sort order"
    ),
    limit: Optional[int] = Query(100, description="Maximum number of groups to return"),
    order: Literal["asc", "desc"] = Query(
        "desc", description="Sort order for groups by creation time. 'asc' for oldest first, 'desc' for newest first"
    ),
    order_by: Literal["created_at"] = Query("created_at", description="Field to sort by"),
):
    """Lists the groups for an agent."""
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    logger.info("in list agents with manager_type", manager_type)
    return await server.agent_manager.list_groups_async(
        agent_id=agent_id,
        manager_type=manager_type,
        actor=actor,
        before=before,
        after=after,
        limit=limit,
        ascending=(order == "asc"),
    )


@router.post(
    "/{agent_id}/messages/preview-raw-payload",
    response_model=Dict[str, Any],
    operation_id="preview_model_request",
)
async def preview_model_request(
    agent_id: AgentId,
    request: Union[LettaRequest, LettaStreamingRequest] = Body(...),
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Inspect the raw LLM request payload without sending it.

    This endpoint processes the message through the agent loop up until
    the LLM request, then returns the raw request payload that would
    be sent to the LLM provider. Useful for debugging and inspection.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    agent = await server.agent_manager.get_agent_by_id_async(
        agent_id, actor, include_relationships=["multi_agent_group", "memory", "sources"]
    )
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
        "deepseek",
    ]

    if agent_eligible and model_compatible:
        agent_loop = AgentLoop.load(agent_state=agent, actor=actor)
        return await agent_loop.build_request(
            input_messages=request.messages,
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Payload inspection is not currently supported for this agent configuration.",
        )


@router.post("/{agent_id}/summarize", status_code=204, operation_id="summarize_messages")
async def summarize_messages(
    agent_id: AgentId,
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Summarize an agent's conversation history.
    """

    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
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
        "deepseek",
    ]

    if agent_eligible and model_compatible:
        agent_loop = LettaAgentV2(agent_state=agent, actor=actor)
        in_context_messages = await server.message_manager.get_messages_by_ids_async(message_ids=agent.message_ids, actor=actor)
        await agent_loop.summarize_conversation_history(
            in_context_messages=in_context_messages,
            new_letta_messages=[],
            total_tokens=None,
            force=True,
        )
        # Summarization completed, return 204 No Content
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Summarization is not currently supported for this agent configuration. Please contact Letta support.",
        )


class CaptureMessagesRequest(BaseModel):
    provider: str
    model: str
    request_messages: list[dict[str, Any]]
    response_dict: dict[str, Any]


@router.post("/{agent_id}/messages/capture", response_model=str, operation_id="capture_messages", include_in_schema=False)
async def capture_messages(
    agent_id: AgentId,
    request: CaptureMessagesRequest = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Capture a list of messages for an agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    agent = await server.agent_manager.get_agent_by_id_async(agent_id, actor, include_relationships=["multi_agent_group"])

    messages_to_persist = []

    # Input user messages
    for message in request.request_messages:
        if message["role"] == "user":
            messages_to_persist.append(
                Message(
                    role=MessageRole.user,
                    content=[(TextContent(text=message["content"]))],
                    agent_id=agent_id,
                    tool_calls=None,
                    tool_call_id=None,
                    created_at=get_utc_time(),
                )
            )

    # Assistant response
    messages_to_persist.append(
        Message(
            role=MessageRole.assistant,
            content=[(TextContent(text=request.response_dict["content"]))],
            agent_id=agent_id,
            model=request.model,
            tool_calls=None,
            tool_call_id=None,
            created_at=get_utc_time(),
        )
    )

    response_messages = await server.message_manager.create_many_messages_async(messages_to_persist, actor=actor)

    sleeptime_group = agent.multi_agent_group if agent.multi_agent_group and agent.multi_agent_group.manager_type == "sleeptime" else None
    if sleeptime_group:
        sleeptime_agent_loop = SleeptimeMultiAgentV4(agent_state=agent, actor=actor, group=sleeptime_group)
        sleeptime_agent_loop.response_messages = response_messages
        run_ids = await sleeptime_agent_loop.run_sleeptime_agents()

    return JSONResponse({"success": True, "messages_created": len(response_messages), "run_ids": run_ids})
