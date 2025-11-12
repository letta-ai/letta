import importlib
from typing import List, Optional, Set, Union

from sqlalchemy import and_, func, or_, select

from letta.constants import (
    BASE_FUNCTION_RETURN_CHAR_LIMIT,
    BASE_MEMORY_TOOLS,
    BASE_SLEEPTIME_TOOLS,
    BASE_TOOLS,
    BASE_VOICE_SLEEPTIME_CHAT_TOOLS,
    BASE_VOICE_SLEEPTIME_TOOLS,
    BUILTIN_TOOLS,
    FILES_TOOLS,
    LETTA_PARALLEL_SAFE_TOOLS,
    LETTA_TOOL_MODULE_NAMES,
    LETTA_TOOL_SET,
    LOCAL_ONLY_MULTI_AGENT_TOOLS,
    MAX_TOOL_NAME_LENGTH,
    MCP_TOOL_TAG_NAME_PREFIX,
    MODAL_DEFAULT_TOOL_NAME,
)
from letta.errors import LettaInvalidArgumentError, LettaToolNameConflictError, LettaToolNameSchemaMismatchError
from letta.functions.functions import derive_openai_json_schema, load_function_set
from letta.helpers.tool_helpers import compute_tool_hash, generate_modal_function_name
from letta.log import get_logger

# TODO: Remove this once we translate all of these to the ORM
from letta.orm.errors import NoResultFound
from letta.orm.tool import Tool as ToolModel
from letta.otel.tracing import trace_method
from letta.schemas.agent import AgentState
from letta.schemas.enums import PrimitiveType, SandboxType, ToolType
from letta.schemas.tool import Tool as PydanticTool, ToolCreate, ToolUpdate
from letta.schemas.user import User as PydanticUser
from letta.server.db import db_registry
from letta.services.helpers.agent_manager_helper import calculate_multi_agent_tools
from letta.services.mcp.types import SSEServerConfig, StdioServerConfig
from letta.services.tool_schema_generator import generate_schema_for_tool_creation, generate_schema_for_tool_update
from letta.settings import settings, tool_settings
from letta.utils import enforce_types, printd
from letta.validators import raise_on_invalid_id

logger = get_logger(__name__)


# NOTE: function name and nested modal function decorator name must stay in sync with MODAL_DEFAULT_TOOL_NAME
def modal_tool_wrapper(tool: PydanticTool, actor: PydanticUser, sandbox_env_vars: dict = None, project_id: str = "default"):
    """Create a Modal function wrapper for a tool"""
    import contextlib
    import io
    import os
    import sys
    from typing import Optional

    import modal
    from letta_client import Letta

    packages = [str(req) for req in tool.pip_requirements] if tool.pip_requirements else []
    packages.append("letta_client")
    packages.append("letta")  # Base letta without extras
    packages.append("asyncpg>=0.30.0")  # Fixes asyncpg import error
    packages.append("psycopg2-binary>=2.9.10")  # PostgreSQL adapter (pre-compiled, no build required)
    # packages.append("pgvector>=0.3.6")  # Vector operations support

    function_name = generate_modal_function_name(tool.name, actor.organization_id, project_id)
    modal_app = modal.App(function_name)
    logger.info(f"Creating Modal app {tool.id} with name {function_name}")

    # Create secrets dict with sandbox env vars
    secrets_dict = {"LETTA_API_KEY": None}
    if sandbox_env_vars:
        secrets_dict.update(sandbox_env_vars)

    @modal_app.function(
        image=modal.Image.debian_slim(python_version="3.13").pip_install(packages),
        restrict_modal_access=True,
        timeout=10,
        secrets=[modal.Secret.from_dict(secrets_dict)],
        serialized=True,
    )
    def modal_function(
        tool_name: str, agent_state: Optional[dict], agent_id: Optional[str], env_vars: dict, letta_api_key: Optional[str] = None, **kwargs
    ):
        """Wrapper function for running untrusted code in a Modal function"""
        # Reconstruct AgentState from dict if passed (to avoid cloudpickle serialization issues)
        # This is done with extra safety to handle schema mismatches between environments
        reconstructed_agent_state = None
        if agent_state:
            try:
                from letta.schemas.agent import AgentState as AgentStateModel

                # Filter dict to only include fields that exist in Modal's version of AgentState
                # This prevents ValidationError from extra fields in newer schemas
                modal_agent_fields = set(AgentStateModel.model_fields.keys())
                filtered_agent_state = {key: value for key, value in agent_state.items() if key in modal_agent_fields}

                # Try to reconstruct with filtered data
                reconstructed_agent_state = AgentStateModel.model_validate(filtered_agent_state)

                # Log if we filtered out any fields
                filtered_out = set(agent_state.keys()) - modal_agent_fields
                if filtered_out:
                    print(f"Fields not in available in AgentState: {filtered_out}", file=sys.stderr)

            except ImportError as e:
                print(f"Cannot import AgentState: {e}", file=sys.stderr)
                print("Passing agent_state as dict to tool", file=sys.stderr)
                reconstructed_agent_state = agent_state
            except Exception as e:
                print(f"Warning: Could not reconstruct AgentState (schema mismatch?): {e}", file=sys.stderr)
                print("Passing agent_state as dict to tool", file=sys.stderr)
                reconstructed_agent_state = agent_state

        # Set environment variables
        if env_vars:
            for key, value in env_vars.items():
                os.environ[key] = str(value)

        # Initialize the Letta client
        if letta_api_key:
            letta_client = Letta(token=letta_api_key, base_url=os.environ.get("LETTA_API_URL", "https://api.letta.com"))
        else:
            letta_client = None

        tool_namespace = {
            "__builtins__": __builtins__,  # Include built-in functions
            "_letta_client": letta_client,  # Make letta_client available
            "os": os,  # Include os module for env vars access
            "agent_id": agent_id,
            # Add any other modules/variables the tool might need
        }

        # Initialize the tool code
        # Create a namespace for the tool
        # tool_namespace = {}
        exec(tool.source_code, tool_namespace)

        # Get the tool function
        if tool_name not in tool_namespace:
            raise Exception(f"Tool function {tool_name} not found in {tool.source_code}, globals: {tool_namespace}")
        tool_func = tool_namespace[tool_name]

        # Detect if the tool function is async
        import asyncio
        import inspect
        import traceback

        is_async = inspect.iscoroutinefunction(tool_func)

        # Capture stdout and stderr during tool execution
        stdout_capture = io.StringIO()
        stderr_capture = io.StringIO()
        result = None
        error_occurred = False

        with contextlib.redirect_stdout(stdout_capture), contextlib.redirect_stderr(stderr_capture):
            try:
                # if `agent_state` is in the tool function arguments, inject it
                # Pass reconstructed AgentState (or dict if reconstruction failed)
                if "agent_state" in tool_func.__code__.co_varnames:
                    kwargs["agent_state"] = reconstructed_agent_state

                # Execute the tool function (async or sync)
                if is_async:
                    result = asyncio.run(tool_func(**kwargs))
                else:
                    result = tool_func(**kwargs)
            except Exception as e:
                # Capture the exception and write to stderr
                error_occurred = True
                traceback.print_exc(file=stderr_capture)

        # Get captured output
        stdout = stdout_capture.getvalue()
        stderr = stderr_capture.getvalue()

        return {
            "result": result,
            "stdout": stdout,
            "stderr": stderr,
            "agent_state": agent_state,  # TODO: deprecate (use letta_client instead)
            "error": error_occurred or bool(stderr),
        }

    return modal_app


class ToolManager:
    """Manager class to handle business logic related to Tools."""

    @enforce_types
    @trace_method
    async def create_or_update_tool_async(
        self, pydantic_tool: PydanticTool, actor: PydanticUser, bypass_name_check: bool = False
    ) -> PydanticTool:
        """Create a new tool based on the ToolCreate schema."""
        if pydantic_tool.tool_type == ToolType.CUSTOM and not pydantic_tool.json_schema:
            generated_schema = generate_schema_for_tool_creation(pydantic_tool)
            if generated_schema:
                pydantic_tool.json_schema = generated_schema
            else:
                raise ValueError("Failed to generate schema for tool", pydantic_tool.source_code)

        # make sure the name matches the json_schema
        if not pydantic_tool.name:
            pydantic_tool.name = pydantic_tool.json_schema.get("name")
        else:
            # if name is provided, make sure its less tahn the MAX_TOOL_NAME_LENGTH
            if len(pydantic_tool.name) > MAX_TOOL_NAME_LENGTH:
                raise LettaInvalidArgumentError(
                    f"Tool name {pydantic_tool.name} is too long. It must be less than {MAX_TOOL_NAME_LENGTH} characters."
                )

            if pydantic_tool.name != pydantic_tool.json_schema.get("name"):
                raise LettaToolNameSchemaMismatchError(
                    tool_name=pydantic_tool.name,
                    json_schema_name=pydantic_tool.json_schema.get("name"),
                    source_code=pydantic_tool.source_code,
                )

        # check if the tool name already exists
        current_tool = await self.get_tool_by_name_async(tool_name=pydantic_tool.name, actor=actor)
        if current_tool:
            # Put to dict and remove fields that should not be reset
            update_data = pydantic_tool.model_dump(exclude_unset=True, exclude_none=True)
            update_data["organization_id"] = actor.organization_id

            # If there's anything to update
            if update_data:
                # In case we want to update the tool type
                # Useful if we are shuffling around base tools
                updated_tool_type = None
                if "tool_type" in update_data:
                    updated_tool_type = update_data.get("tool_type")
                tool = await self.update_tool_by_id_async(
                    current_tool.id, ToolUpdate(**update_data), actor, updated_tool_type=updated_tool_type
                )
            else:
                printd(
                    f"`create_or_update_tool` was called with user_id={actor.id}, organization_id={actor.organization_id}, name={pydantic_tool.name}, but found existing tool with nothing to update."
                )
                tool = await self.get_tool_by_id_async(current_tool.id, actor=actor)
            return tool

        return await self.create_tool_async(pydantic_tool, actor=actor)

    @enforce_types
    async def create_mcp_server(
        self, server_config: Union[StdioServerConfig, SSEServerConfig], actor: PydanticUser
    ) -> List[Union[StdioServerConfig, SSEServerConfig]]:
        pass

    @enforce_types
    async def create_mcp_tool_async(
        self, tool_create: ToolCreate, mcp_server_name: str, mcp_server_id: str, actor: PydanticUser
    ) -> PydanticTool:
        metadata = {MCP_TOOL_TAG_NAME_PREFIX: {"server_name": mcp_server_name, "server_id": mcp_server_id}}
        return await self.create_or_update_tool_async(
            PydanticTool(
                tool_type=ToolType.EXTERNAL_MCP, name=tool_create.json_schema["name"], metadata_=metadata, **tool_create.model_dump()
            ),
            actor,
        )

    @enforce_types
    @trace_method
    async def create_or_update_mcp_tool_async(
        self, tool_create: ToolCreate, mcp_server_name: str, mcp_server_id: str, actor: PydanticUser
    ) -> PydanticTool:
        metadata = {MCP_TOOL_TAG_NAME_PREFIX: {"server_name": mcp_server_name, "server_id": mcp_server_id}}
        return await self.create_or_update_tool_async(
            PydanticTool(
                tool_type=ToolType.EXTERNAL_MCP, name=tool_create.json_schema["name"], metadata_=metadata, **tool_create.model_dump()
            ),
            actor,
        )

    @enforce_types
    @trace_method
    async def create_tool_async(self, pydantic_tool: PydanticTool, actor: PydanticUser) -> PydanticTool:
        """Create a new tool based on the ToolCreate schema."""
        # Generate schema only if not provided (only for custom tools)

        async with db_registry.async_session() as session:
            # Auto-generate description if not provided
            if pydantic_tool.description is None and pydantic_tool.json_schema:
                pydantic_tool.description = pydantic_tool.json_schema.get("description", None)

            # Add tool hash to metadata for Modal deployment tracking
            tool_hash = compute_tool_hash(pydantic_tool)
            if pydantic_tool.metadata_ is None:
                pydantic_tool.metadata_ = {}
            pydantic_tool.metadata_["tool_hash"] = tool_hash

            tool_data = pydantic_tool.model_dump(to_orm=True)
            # Set the organization id at the ORM layer
            tool_data["organization_id"] = actor.organization_id

            tool = ToolModel(**tool_data)

            # Log tool creation with memory footprint
            import sys

            tool_size_kb = sys.getsizeof(tool_data) / 1024
            source_code_size_kb = len(pydantic_tool.source_code or "") / 1024
            schema_size_kb = len(str(pydantic_tool.json_schema or "")) / 1024
            logger.info(
                f"Creating tool '{pydantic_tool.name}': total {tool_size_kb:.2f} KB (source: {source_code_size_kb:.2f} KB, schema: {schema_size_kb:.2f} KB)"
            )

            await tool.create_async(session, actor=actor)  # Re-raise other database-related errors
            created_tool = tool.to_pydantic()

            # Deploy Modal app for the new tool
            # Both Modal credentials configured AND tool metadata must indicate Modal
            tool_requests_modal = created_tool.metadata_ and created_tool.metadata_.get("sandbox") == "modal"
            modal_configured = tool_settings.modal_sandbox_enabled

            if created_tool.tool_type == ToolType.CUSTOM and tool_requests_modal and modal_configured:
                await self.create_or_update_modal_app(created_tool, actor)

            return created_tool

    @enforce_types
    @trace_method
    async def bulk_upsert_tools_async(
        self, pydantic_tools: List[PydanticTool], actor: PydanticUser, override_existing_tools: bool = True
    ) -> List[PydanticTool]:
        """
        Bulk create or update multiple tools in a single database transaction.

        Uses optimized PostgreSQL bulk upsert when available, falls back to individual
        upserts for SQLite. This is much more efficient than calling create_or_update_tool_async
        in a loop.

        IMPORTANT BEHAVIOR NOTES:
        - Tools are matched by (name, organization_id) unique constraint, NOT by ID
        - If a tool with the same name already exists for the organization, it will be updated
          regardless of any ID provided in the input tool
        - The existing tool's ID is preserved during updates
        - If you provide a tool with an explicit ID but a name that matches an existing tool,
          the existing tool will be updated and the provided ID will be ignored
        - This matches the behavior of create_or_update_tool_async which also matches by name

        PostgreSQL optimization:
        - Uses native ON CONFLICT (name, organization_id) DO UPDATE for atomic upserts
        - All tools are processed in a single SQL statement for maximum efficiency

        SQLite fallback:
        - Falls back to individual create_or_update_tool_async calls
        - Still benefits from batched transaction handling

        Args:
            pydantic_tools: List of tools to create or update
            actor: User performing the action

        Returns:
            List of created/updated tools
        """
        if not pydantic_tools:
            return []

        # get schemas if not provided
        for tool in pydantic_tools:
            if tool.json_schema is None:
                tool.json_schema = generate_schema_for_tool_creation(tool)

        # auto-generate descriptions if not provided
        for tool in pydantic_tools:
            if tool.description is None:
                tool.description = tool.json_schema.get("description", None)

        # Log bulk tool operation
        total_source_code_kb = sum(len(t.source_code or "") for t in pydantic_tools) / 1024
        logger.info(f"Bulk upserting {len(pydantic_tools)} tools: total source code {total_source_code_kb:.2f} KB")

        if settings.letta_pg_uri_no_default:
            # use optimized postgresql bulk upsert
            async with db_registry.async_session() as session:
                return await self._bulk_upsert_postgresql(session, pydantic_tools, actor, override_existing_tools)
        else:
            # fallback to individual upserts for sqlite
            return await self._upsert_tools_individually(pydantic_tools, actor, override_existing_tools)

    @enforce_types
    @trace_method
    @raise_on_invalid_id(param_name="tool_id", expected_prefix=PrimitiveType.TOOL)
    async def get_tool_by_id_async(self, tool_id: str, actor: PydanticUser) -> PydanticTool:
        """Fetch a tool by its ID."""
        async with db_registry.async_session() as session:
            # Retrieve tool by id using the Tool model's read method
            tool = await ToolModel.read_async(db_session=session, identifier=tool_id, actor=actor)
            # Convert the SQLAlchemy Tool object to PydanticTool
            return tool.to_pydantic()

    @enforce_types
    @trace_method
    async def get_tool_by_name_async(self, tool_name: str, actor: PydanticUser) -> Optional[PydanticTool]:
        """Retrieve a tool by its name and a user. We derive the organization from the user, and retrieve that tool."""
        try:
            async with db_registry.async_session() as session:
                tool = await ToolModel.read_async(db_session=session, name=tool_name, actor=actor)
                return tool.to_pydantic()
        except NoResultFound:
            return None

    @enforce_types
    @trace_method
    async def get_tool_id_by_name_async(self, tool_name: str, actor: PydanticUser) -> Optional[str]:
        """Retrieve a tool by its name and a user. We derive the organization from the user, and retrieve that tool."""
        try:
            async with db_registry.async_session() as session:
                tool = await ToolModel.read_async(db_session=session, name=tool_name, actor=actor)
                return tool.id
        except NoResultFound:
            return None

    @enforce_types
    @trace_method
    @raise_on_invalid_id(param_name="tool_id", expected_prefix=PrimitiveType.TOOL)
    async def tool_exists_async(self, tool_id: str, actor: PydanticUser) -> bool:
        """Check if a tool exists and belongs to the user's organization (lightweight check)."""
        async with db_registry.async_session() as session:
            query = select(func.count(ToolModel.id)).where(ToolModel.id == tool_id, ToolModel.organization_id == actor.organization_id)
            result = await session.execute(query)
            count = result.scalar()
            return count > 0

    @enforce_types
    @trace_method
    async def tool_name_exists_async(self, tool_name: str, actor: PydanticUser) -> bool:
        """Check if a tool with the given name exists in the user's organization (lightweight check)."""
        async with db_registry.async_session() as session:
            query = select(func.count(ToolModel.id)).where(ToolModel.name == tool_name, ToolModel.organization_id == actor.organization_id)
            result = await session.execute(query)
            count = result.scalar()
            return count > 0

    @enforce_types
    @trace_method
    async def list_tools_async(
        self,
        actor: PydanticUser,
        before: Optional[str] = None,
        after: Optional[str] = None,
        limit: Optional[int] = 50,
        ascending: bool = False,
        upsert_base_tools: bool = True,
        tool_types: Optional[List[str]] = None,
        exclude_tool_types: Optional[List[str]] = None,
        names: Optional[List[str]] = None,
        tool_ids: Optional[List[str]] = None,
        search: Optional[str] = None,
        return_only_letta_tools: bool = False,
    ) -> List[PydanticTool]:
        """List all tools with pagination support."""
        tools = await self._list_tools_async(
            actor=actor,
            before=before,
            after=after,
            limit=limit,
            ascending=ascending,
            tool_types=tool_types,
            exclude_tool_types=exclude_tool_types,
            names=names,
            tool_ids=tool_ids,
            search=search,
            return_only_letta_tools=return_only_letta_tools,
        )

        # Check if all base tools are present if we requested all the tools w/o cursor
        # TODO: This is a temporary hack to resolve this issue
        # TODO: This requires a deeper rethink about how we keep all our internal tools up-to-date
        if not after and upsert_base_tools:
            existing_tool_names = {tool.name for tool in tools}
            base_tool_names = LETTA_TOOL_SET - set(LOCAL_ONLY_MULTI_AGENT_TOOLS) if settings.environment == "PRODUCTION" else LETTA_TOOL_SET
            missing_base_tools = base_tool_names - existing_tool_names

            # If any base tools are missing, upsert all base tools
            if missing_base_tools:
                logger.info(f"Missing base tools detected: {missing_base_tools}. Upserting all base tools.")
                await self.upsert_base_tools_async(actor=actor)
                # Re-fetch the tools list after upserting base tools
                tools = await self._list_tools_async(
                    actor=actor,
                    before=before,
                    after=after,
                    limit=limit,
                    ascending=ascending,
                    tool_types=tool_types,
                    exclude_tool_types=exclude_tool_types,
                    names=names,
                    tool_ids=tool_ids,
                    search=search,
                    return_only_letta_tools=return_only_letta_tools,
                )

        return tools

    @enforce_types
    @trace_method
    async def _list_tools_async(
        self,
        actor: PydanticUser,
        before: Optional[str] = None,
        after: Optional[str] = None,
        limit: Optional[int] = 50,
        ascending: bool = False,
        tool_types: Optional[List[str]] = None,
        exclude_tool_types: Optional[List[str]] = None,
        names: Optional[List[str]] = None,
        tool_ids: Optional[List[str]] = None,
        search: Optional[str] = None,
        return_only_letta_tools: bool = False,
    ) -> List[PydanticTool]:
        """List all tools with optional pagination."""
        tools_to_delete = []
        async with db_registry.async_session() as session:
            # Use SQLAlchemy directly for all cases - more control and consistency
            # Start with base query
            query = select(ToolModel).where(ToolModel.organization_id == actor.organization_id)

            # Apply tool_types filter
            if tool_types is not None:
                query = query.where(ToolModel.tool_type.in_(tool_types))

            # Apply names filter
            if names is not None:
                query = query.where(ToolModel.name.in_(names))

            # Apply tool_ids filter
            if tool_ids is not None:
                query = query.where(ToolModel.id.in_(tool_ids))

            # Apply search filter (ILIKE for case-insensitive partial match)
            if search is not None:
                query = query.where(ToolModel.name.ilike(f"%{search}%"))

            # Apply exclude_tool_types filter at database level
            if exclude_tool_types is not None:
                query = query.where(~ToolModel.tool_type.in_(exclude_tool_types))

            # Apply return_only_letta_tools filter at database level
            if return_only_letta_tools:
                query = query.where(ToolModel.tool_type.like("letta_%"))

            # Handle pagination cursors
            if after is not None:
                after_tool = await session.get(ToolModel, after)
                if after_tool:
                    if ascending:
                        query = query.where(
                            or_(
                                ToolModel.created_at > after_tool.created_at,
                                and_(ToolModel.created_at == after_tool.created_at, ToolModel.id > after_tool.id),
                            )
                        )
                    else:
                        query = query.where(
                            or_(
                                ToolModel.created_at < after_tool.created_at,
                                and_(ToolModel.created_at == after_tool.created_at, ToolModel.id < after_tool.id),
                            )
                        )

            if before is not None:
                before_tool = await session.get(ToolModel, before)
                if before_tool:
                    if ascending:
                        query = query.where(
                            or_(
                                ToolModel.created_at < before_tool.created_at,
                                and_(ToolModel.created_at == before_tool.created_at, ToolModel.id < before_tool.id),
                            )
                        )
                    else:
                        query = query.where(
                            or_(
                                ToolModel.created_at > before_tool.created_at,
                                and_(ToolModel.created_at == before_tool.created_at, ToolModel.id > before_tool.id),
                            )
                        )

            # Apply limit
            if limit is not None:
                query = query.limit(limit)

            # Apply ordering based on ascending parameter
            if ascending:
                query = query.order_by(ToolModel.created_at.asc(), ToolModel.id.asc())
            else:
                query = query.order_by(ToolModel.created_at.desc(), ToolModel.id.desc())

            # Execute query
            result = await session.execute(query)
            tools = list(result.scalars())

            # Remove any malformed tools
            results = []
            for tool in tools:
                try:
                    pydantic_tool = tool.to_pydantic()
                    results.append(pydantic_tool)
                except (ValueError, ModuleNotFoundError, AttributeError) as e:
                    tools_to_delete.append(tool)
                    logger.warning(
                        "Deleting malformed tool with id=%s and name=%s. Error was:\n%s\nDeleted tool:%s",
                        tool.id,
                        tool.name,
                        e,
                        tool.pretty_print_columns(),
                    )

        for tool in tools_to_delete:
            await self.delete_tool_by_id_async(tool.id, actor=actor)

        return results

    @enforce_types
    @trace_method
    async def count_tools_async(
        self,
        actor: PydanticUser,
        tool_types: Optional[List[str]] = None,
        exclude_tool_types: Optional[List[str]] = None,
        names: Optional[List[str]] = None,
        tool_ids: Optional[List[str]] = None,
        search: Optional[str] = None,
        return_only_letta_tools: bool = False,
        exclude_letta_tools: bool = False,
    ) -> int:
        """Count tools with the same filtering logic as list_tools_async."""
        async with db_registry.async_session() as session:
            # Use SQLAlchemy directly with COUNT query - same filtering logic as list_tools_async
            # Start with base query
            query = select(func.count(ToolModel.id)).where(ToolModel.organization_id == actor.organization_id)

            # Apply tool_types filter
            if tool_types is not None:
                query = query.where(ToolModel.tool_type.in_(tool_types))

            # Apply names filter
            if names is not None:
                query = query.where(ToolModel.name.in_(names))

            # Apply tool_ids filter
            if tool_ids is not None:
                query = query.where(ToolModel.id.in_(tool_ids))

            # Apply search filter (ILIKE for case-insensitive partial match)
            if search is not None:
                query = query.where(ToolModel.name.ilike(f"%{search}%"))

            # Apply exclude_tool_types filter at database level
            if exclude_tool_types is not None:
                query = query.where(~ToolModel.tool_type.in_(exclude_tool_types))

            # Apply return_only_letta_tools filter at database level
            if return_only_letta_tools:
                query = query.where(ToolModel.tool_type.like("letta_%"))

            # Handle exclude_letta_tools logic (if True, exclude Letta tools)
            if exclude_letta_tools:
                # Exclude tools that are in the LETTA_TOOL_SET
                letta_tool_names = list(LETTA_TOOL_SET)
                query = query.where(~ToolModel.name.in_(letta_tool_names))

            # Execute count query
            result = await session.execute(query)
            count = result.scalar()

            return count or 0

    @enforce_types
    @trace_method
    async def size_async(
        self,
        actor: PydanticUser,
        include_base_tools: bool,
    ) -> int:
        """
        Get the total count of tools for the given user.

        If include_builtin is True, it will also count the built-in tools.
        """
        async with db_registry.async_session() as session:
            if include_base_tools:
                return await ToolModel.size_async(db_session=session, actor=actor)
            return await ToolModel.size_async(db_session=session, actor=actor, name=LETTA_TOOL_SET)

    @enforce_types
    @trace_method
    @raise_on_invalid_id(param_name="tool_id", expected_prefix=PrimitiveType.TOOL)
    async def update_tool_by_id_async(
        self,
        tool_id: str,
        tool_update: ToolUpdate,
        actor: PydanticUser,
        updated_tool_type: Optional[ToolType] = None,
        bypass_name_check: bool = False,
    ) -> PydanticTool:
        """Update a tool by its ID with the given ToolUpdate object."""
        # Fetch current tool early to allow conditional logic based on tool type
        current_tool = await self.get_tool_by_id_async(tool_id=tool_id, actor=actor)

        # Handle schema updates for custom tools
        new_schema = None
        if current_tool.tool_type == ToolType.CUSTOM:
            if tool_update.json_schema is not None:
                new_schema = tool_update.json_schema
            elif tool_update.args_json_schema is not None:
                # Generate full schema from args_json_schema
                generated_schema = generate_schema_for_tool_update(
                    current_tool=current_tool,
                    json_schema=None,
                    args_json_schema=tool_update.args_json_schema,
                    source_code=tool_update.source_code,
                    source_type=tool_update.source_type,
                )
                if generated_schema:
                    tool_update.json_schema = generated_schema
                    new_schema = generated_schema

        # Now model_dump with the potentially updated schema
        update_data = tool_update.model_dump(to_orm=True, exclude_none=True)

        # Determine the final schema and name
        if new_schema:
            new_name = new_schema.get("name", current_tool.name)
        elif "json_schema" in update_data:
            new_schema = update_data["json_schema"]
            new_name = new_schema.get("name", current_tool.name)
        else:
            # Keep existing schema
            new_schema = current_tool.json_schema
            new_name = current_tool.name

        # Handle explicit name updates
        if "name" in update_data and update_data["name"] != current_tool.name:
            # Name is being explicitly changed
            new_name = update_data["name"]
            # Update the json_schema name to match if there's a schema
            if new_schema:
                new_schema = new_schema.copy()
                new_schema["name"] = new_name
                update_data["json_schema"] = new_schema
        elif new_schema and new_name != current_tool.name:
            # Schema provides a different name but name wasn't explicitly changed
            update_data["name"] = new_name
            # raise ValueError(
            #    f"JSON schema name '{new_name}' conflicts with current tool name '{current_tool.name}'. Update the name field explicitly if you want to rename the tool."
            # )

        # If name changes, enforce uniqueness
        if new_name != current_tool.name:
            name_exists = await self.tool_name_exists_async(tool_name=new_name, actor=actor)
            if name_exists:
                raise LettaToolNameConflictError(tool_name=new_name)

        # NOTE: EXTREMELEY HACKY, we need to stop making assumptions about the source_code
        if "source_code" in update_data and f"def {new_name}" not in update_data.get("source_code", ""):
            raise LettaToolNameSchemaMismatchError(
                tool_name=new_name,
                json_schema_name=new_schema.get("name") if new_schema else None,
                source_code=update_data.get("source_code"),
            )

        # Create a preview of the updated tool by merging current tool with updates
        # This allows us to compute the hash before the database session
        updated_tool_pydantic = current_tool.model_copy(deep=True)
        for key, value in update_data.items():
            setattr(updated_tool_pydantic, key, value)
        if new_schema is not None:
            updated_tool_pydantic.json_schema = new_schema
            updated_tool_pydantic.name = new_name
        if updated_tool_type:
            updated_tool_pydantic.tool_type = updated_tool_type

        # Check if we need to redeploy the Modal app due to changes
        # Compute this before the session to avoid issues
        tool_requests_modal = updated_tool_pydantic.metadata_ and updated_tool_pydantic.metadata_.get("sandbox") == "modal"
        modal_configured = tool_settings.modal_sandbox_enabled
        should_check_modal = tool_requests_modal and modal_configured and updated_tool_pydantic.tool_type == ToolType.CUSTOM

        # Compute hash before session if needed
        new_hash = None
        old_hash = None
        needs_modal_deployment = False

        if should_check_modal:
            new_hash = compute_tool_hash(updated_tool_pydantic)
            old_hash = current_tool.metadata_.get("tool_hash") if current_tool.metadata_ else None
            needs_modal_deployment = new_hash != old_hash

        # Now perform the update within the session
        async with db_registry.async_session() as session:
            # Fetch the tool by ID
            tool = await ToolModel.read_async(db_session=session, identifier=tool_id, actor=actor)

            # Update tool attributes with only the fields that were explicitly set
            for key, value in update_data.items():
                setattr(tool, key, value)

            # If we already computed the new schema, apply it
            if new_schema is not None:
                tool.json_schema = new_schema
                tool.name = new_name

            if updated_tool_type:
                tool.tool_type = updated_tool_type

            # Save the updated tool to the database
            tool = await tool.update_async(db_session=session, actor=actor)
            updated_tool = tool.to_pydantic()

            # Update Modal hash in metadata if needed (inside session context)
            if needs_modal_deployment:
                if updated_tool.metadata_ is None:
                    updated_tool.metadata_ = {}
                updated_tool.metadata_["tool_hash"] = new_hash

                # Update the metadata in the database (still inside session)
                tool.metadata_ = updated_tool.metadata_
                tool = await tool.update_async(db_session=session, actor=actor)
                updated_tool = tool.to_pydantic()

        # Deploy Modal app outside of session (it creates its own sessions)
        if needs_modal_deployment:
            logger.info(f"Deploying Modal app for tool {updated_tool.id} with new hash: {new_hash}")
            await self.create_or_update_modal_app(updated_tool, actor)

        return updated_tool

    @enforce_types
    @trace_method
    # @raise_on_invalid_id This is commented out bc it's called by _list_tools_async, when it encounters malformed tools (i.e. if id is invalid will fail validation on deletion)
    async def delete_tool_by_id_async(self, tool_id: str, actor: PydanticUser) -> None:
        """Delete a tool by its ID."""
        async with db_registry.async_session() as session:
            try:
                tool = await ToolModel.read_async(db_session=session, identifier=tool_id, actor=actor)
                await tool.hard_delete_async(db_session=session, actor=actor)
            except NoResultFound:
                raise ValueError(f"Tool with id {tool_id} not found.")

    @enforce_types
    @trace_method
    async def upsert_base_tools_async(
        self,
        actor: PydanticUser,
        allowed_types: Optional[Set[ToolType]] = None,
    ) -> List[PydanticTool]:
        """Add default tools defined in the various function_sets modules, optionally filtered by ToolType.

        Optimized bulk implementation using single database session and batch operations.
        """

        functions_to_schema = {}
        for module_name in LETTA_TOOL_MODULE_NAMES:
            try:
                module = importlib.import_module(module_name)
                functions_to_schema.update(load_function_set(module))
            except ValueError as e:
                logger.warning(f"Error loading function set '{module_name}': {e}")
            except Exception as e:
                raise e

        # prepare tool data for bulk operations
        tool_data_list = []
        for name, schema in functions_to_schema.items():
            if name not in LETTA_TOOL_SET:
                continue

            if name in BASE_TOOLS:
                tool_type = ToolType.LETTA_CORE
            elif name in BASE_MEMORY_TOOLS:
                tool_type = ToolType.LETTA_MEMORY_CORE
            elif name in BASE_SLEEPTIME_TOOLS:
                tool_type = ToolType.LETTA_SLEEPTIME_CORE
            elif name in calculate_multi_agent_tools():
                tool_type = ToolType.LETTA_MULTI_AGENT_CORE
            elif name in BASE_VOICE_SLEEPTIME_TOOLS or name in BASE_VOICE_SLEEPTIME_CHAT_TOOLS:
                tool_type = ToolType.LETTA_VOICE_SLEEPTIME_CORE
            elif name in BUILTIN_TOOLS:
                tool_type = ToolType.LETTA_BUILTIN
            elif name in FILES_TOOLS:
                tool_type = ToolType.LETTA_FILES_CORE
            else:
                logger.warning(f"Tool name {name} is not in any known base tool set, skipping")
                continue

            if allowed_types is not None and tool_type not in allowed_types:
                continue

            # create pydantic tool for validation and conversion
            parallel_safe = name in LETTA_PARALLEL_SAFE_TOOLS
            pydantic_tool = PydanticTool(
                name=name,
                tags=[tool_type.value],
                source_type="python",
                tool_type=tool_type,
                return_char_limit=BASE_FUNCTION_RETURN_CHAR_LIMIT,
                enable_parallel_execution=parallel_safe,
            )

            # auto-generate description if not provided
            if pydantic_tool.description is None:
                pydantic_tool.description = pydantic_tool.json_schema.get("description", None)

            tool_data_list.append(pydantic_tool)

        if not tool_data_list:
            return []

        if settings.letta_pg_uri_no_default:
            async with db_registry.async_session() as session:
                return await self._bulk_upsert_postgresql(session, tool_data_list, actor)
        else:
            return await self._upsert_tools_individually(tool_data_list, actor)

    @trace_method
    async def _bulk_upsert_postgresql(
        self, session, tool_data_list: List[PydanticTool], actor: PydanticUser, override_existing_tools: bool = True
    ) -> List[PydanticTool]:
        """hyper-optimized postgresql bulk upsert using on_conflict_do_update or on_conflict_do_nothing."""
        from sqlalchemy import func, select
        from sqlalchemy.dialects.postgresql import insert

        # prepare data for bulk insert
        table = ToolModel.__table__
        valid_columns = {col.name for col in table.columns}

        insert_data = []
        for tool in tool_data_list:
            tool_dict = tool.model_dump(to_orm=True)
            # set created/updated by fields
            if actor:
                tool_dict["_created_by_id"] = actor.id
                tool_dict["_last_updated_by_id"] = actor.id
                tool_dict["organization_id"] = actor.organization_id

            # filter to only include columns that exist in the table
            filtered_dict = {k: v for k, v in tool_dict.items() if k in valid_columns}
            insert_data.append(filtered_dict)

        # use postgresql's native bulk upsert
        stmt = insert(table).values(insert_data)

        if override_existing_tools:
            # on conflict, update all columns except id, created_at, and _created_by_id
            excluded = stmt.excluded
            update_dict = {}
            for col in table.columns:
                if col.name not in ("id", "created_at", "_created_by_id"):
                    if col.name == "updated_at":
                        update_dict[col.name] = func.now()
                    else:
                        update_dict[col.name] = excluded[col.name]

            upsert_stmt = stmt.on_conflict_do_update(index_elements=["name", "organization_id"], set_=update_dict)
        else:
            # on conflict, do nothing (skip existing tools)
            upsert_stmt = stmt.on_conflict_do_nothing(index_elements=["name", "organization_id"])

        await session.execute(upsert_stmt)
        await session.commit()

        # fetch results (includes both inserted and skipped tools)
        tool_names = [tool.name for tool in tool_data_list]
        result_query = select(ToolModel).where(ToolModel.name.in_(tool_names), ToolModel.organization_id == actor.organization_id)
        result = await session.execute(result_query)
        return [tool.to_pydantic() for tool in result.scalars()]

    @trace_method
    async def _upsert_tools_individually(
        self, tool_data_list: List[PydanticTool], actor: PydanticUser, override_existing_tools: bool = True
    ) -> List[PydanticTool]:
        """fallback to individual upserts for sqlite (original approach)."""
        tools = []
        for tool in tool_data_list:
            if override_existing_tools:
                # update existing tools if they exist
                upserted_tool = await self.create_or_update_tool_async(tool, actor)
                tools.append(upserted_tool)
            else:
                # skip existing tools, only create new ones
                existing_tool_id = await self.get_tool_id_by_name_async(tool_name=tool.name, actor=actor)
                if existing_tool_id:
                    # tool exists, fetch and return it without updating
                    existing_tool = await self.get_tool_by_id_async(existing_tool_id, actor=actor)
                    tools.append(existing_tool)
                else:
                    # tool doesn't exist, create it
                    created_tool = await self.create_tool_async(tool, actor=actor)
                    tools.append(created_tool)
        return tools

    # MODAL RELATED METHODS
    @trace_method
    async def create_or_update_modal_app(self, tool: PydanticTool, actor: PydanticUser):
        """Create a Modal app with the tool function registered"""
        import time

        import modal

        from letta.services.sandbox_config_manager import SandboxConfigManager

        # Load sandbox env vars to bake them into the Modal secrets
        sandbox_env_vars = {}
        try:
            sandbox_config_manager = SandboxConfigManager()
            sandbox_config = await sandbox_config_manager.get_or_create_default_sandbox_config_async(
                sandbox_type=SandboxType.MODAL, actor=actor
            )
            if sandbox_config:
                sandbox_env_vars = await sandbox_config_manager.get_sandbox_env_vars_as_dict_async(
                    sandbox_config_id=sandbox_config.id, actor=actor, limit=None
                )
                logger.info(f"Loaded {len(sandbox_env_vars)} sandbox env vars for Modal app {tool.id}")
        except Exception as e:
            logger.warning(f"Could not load sandbox env vars for Modal app {tool.id}: {e}")

        # Create the Modal app using the global function with sandbox env vars
        modal_app = modal_tool_wrapper(tool, actor, sandbox_env_vars)

        # Deploy the app first
        with modal.enable_output():
            try:
                deploy = modal_app.deploy()
            except Exception as e:
                raise LettaInvalidArgumentError(f"Failed to deploy tool {tool.id} with name {tool.name} to Modal: {e}")

        # After deployment, look up the function to configure autoscaler
        try:
            func = modal.Function.from_name(modal_app.name, MODAL_DEFAULT_TOOL_NAME)
            func.update_autoscaler(scaledown_window=2)  # drain inactive old containers
            time.sleep(5)
            func.update_autoscaler(scaledown_window=60)
        except Exception as e:
            logger.warning(f"Failed to configure autoscaler for Modal function {modal_app.name}: {e}")

        return deploy
