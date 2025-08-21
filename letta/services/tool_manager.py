import importlib
import os
import warnings
from typing import List, Optional, Set, Union

from sqlalchemy import func, select

from letta.constants import (
    BASE_FUNCTION_RETURN_CHAR_LIMIT,
    BASE_MEMORY_TOOLS,
    BASE_SLEEPTIME_TOOLS,
    BASE_TOOLS,
    BASE_VOICE_SLEEPTIME_CHAT_TOOLS,
    BASE_VOICE_SLEEPTIME_TOOLS,
    BUILTIN_TOOLS,
    FILES_TOOLS,
    LETTA_TOOL_MODULE_NAMES,
    LETTA_TOOL_SET,
    LOCAL_ONLY_MULTI_AGENT_TOOLS,
    MCP_TOOL_TAG_NAME_PREFIX,
)
from letta.errors import LettaToolNameConflictError
from letta.functions.functions import derive_openai_json_schema, load_function_set
from letta.log import get_logger

# TODO: Remove this once we translate all of these to the ORM
from letta.orm.errors import NoResultFound
from letta.orm.tool import Tool as ToolModel
from letta.otel.tracing import trace_method
from letta.schemas.enums import ToolType
from letta.schemas.tool import Tool as PydanticTool
from letta.schemas.tool import ToolCreate, ToolUpdate
from letta.schemas.user import User as PydanticUser
from letta.server.db import db_registry
from letta.services.helpers.agent_manager_helper import calculate_multi_agent_tools
from letta.services.mcp.types import SSEServerConfig, StdioServerConfig
from letta.settings import settings
from letta.utils import enforce_types, printd

logger = get_logger(__name__)


class ToolManager:
    """Manager class to handle business logic related to Tools."""

    # TODO: Refactor this across the codebase to use CreateTool instead of passing in a Tool object
    @enforce_types
    @trace_method
    def create_or_update_tool(self, pydantic_tool: PydanticTool, actor: PydanticUser, bypass_name_check: bool = False) -> PydanticTool:
        """Create a new tool based on the ToolCreate schema."""
        tool_id = self.get_tool_id_by_name(tool_name=pydantic_tool.name, actor=actor)
        if tool_id:
            # Put to dict and remove fields that should not be reset
            update_data = pydantic_tool.model_dump(exclude_unset=True, exclude_none=True)

            # If there's anything to update
            if update_data:
                # In case we want to update the tool type
                # Useful if we are shuffling around base tools
                updated_tool_type = None
                if "tool_type" in update_data:
                    updated_tool_type = update_data.get("tool_type")
                tool = self.update_tool_by_id(
                    tool_id, ToolUpdate(**update_data), actor, updated_tool_type=updated_tool_type, bypass_name_check=bypass_name_check
                )
            else:
                printd(
                    f"`create_or_update_tool` was called with user_id={actor.id}, organization_id={actor.organization_id}, name={pydantic_tool.name}, but found existing tool with nothing to update."
                )
                tool = self.get_tool_by_id(tool_id, actor=actor)
        else:
            tool = self.create_tool(pydantic_tool, actor=actor)

        return tool

    @enforce_types
    @trace_method
    async def create_or_update_tool_async(
        self, pydantic_tool: PydanticTool, actor: PydanticUser, bypass_name_check: bool = False
    ) -> PydanticTool:
        """Create a new tool based on the ToolCreate schema."""
        tool_id = await self.get_tool_id_by_name_async(tool_name=pydantic_tool.name, actor=actor)
        if tool_id:
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
                    tool_id, ToolUpdate(**update_data), actor, updated_tool_type=updated_tool_type, bypass_name_check=bypass_name_check
                )
            else:
                printd(
                    f"`create_or_update_tool` was called with user_id={actor.id}, organization_id={actor.organization_id}, name={pydantic_tool.name}, but found existing tool with nothing to update."
                )
                tool = await self.get_tool_by_id_async(tool_id, actor=actor)
        else:
            tool = await self.create_tool_async(pydantic_tool, actor=actor)

        return tool

    @enforce_types
    async def create_mcp_server(
        self, server_config: Union[StdioServerConfig, SSEServerConfig], actor: PydanticUser
    ) -> List[Union[StdioServerConfig, SSEServerConfig]]:
        pass

    @enforce_types
    @trace_method
    def create_or_update_mcp_tool(
        self, tool_create: ToolCreate, mcp_server_name: str, mcp_server_id: str, actor: PydanticUser
    ) -> PydanticTool:
        metadata = {MCP_TOOL_TAG_NAME_PREFIX: {"server_name": mcp_server_name, "server_id": mcp_server_id}}
        return self.create_or_update_tool(
            PydanticTool(
                tool_type=ToolType.EXTERNAL_MCP, name=tool_create.json_schema["name"], metadata_=metadata, **tool_create.model_dump()
            ),
            actor,
        )

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
    def create_or_update_composio_tool(self, tool_create: ToolCreate, actor: PydanticUser) -> PydanticTool:
        return self.create_or_update_tool(
            PydanticTool(tool_type=ToolType.EXTERNAL_COMPOSIO, name=tool_create.json_schema["name"], **tool_create.model_dump()), actor
        )

    @enforce_types
    @trace_method
    async def create_or_update_composio_tool_async(self, tool_create: ToolCreate, actor: PydanticUser) -> PydanticTool:
        return await self.create_or_update_tool_async(
            PydanticTool(tool_type=ToolType.EXTERNAL_COMPOSIO, name=tool_create.json_schema["name"], **tool_create.model_dump()), actor
        )

    @enforce_types
    @trace_method
    def create_tool(self, pydantic_tool: PydanticTool, actor: PydanticUser) -> PydanticTool:
        """Create a new tool based on the ToolCreate schema."""
        with db_registry.session() as session:
            # Auto-generate description if not provided
            if pydantic_tool.description is None:
                pydantic_tool.description = pydantic_tool.json_schema.get("description", None)
            tool_data = pydantic_tool.model_dump(to_orm=True)
            # Set the organization id at the ORM layer
            tool_data["organization_id"] = actor.organization_id

            tool = ToolModel(**tool_data)
            tool.create(session, actor=actor)  # Re-raise other database-related errors
        return tool.to_pydantic()

    @enforce_types
    @trace_method
    async def create_tool_async(self, pydantic_tool: PydanticTool, actor: PydanticUser) -> PydanticTool:
        """Create a new tool based on the ToolCreate schema."""
        async with db_registry.async_session() as session:
            # Auto-generate description if not provided
            if pydantic_tool.description is None:
                pydantic_tool.description = pydantic_tool.json_schema.get("description", None)
            tool_data = pydantic_tool.model_dump(to_orm=True)
            # Set the organization id at the ORM layer
            tool_data["organization_id"] = actor.organization_id

            tool = ToolModel(**tool_data)
            await tool.create_async(session, actor=actor)  # Re-raise other database-related errors
            return tool.to_pydantic()

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

        # auto-generate descriptions if not provided
        for tool in pydantic_tools:
            if tool.description is None:
                tool.description = tool.json_schema.get("description", None)

        if settings.letta_pg_uri_no_default:
            # use optimized postgresql bulk upsert
            async with db_registry.async_session() as session:
                return await self._bulk_upsert_postgresql(session, pydantic_tools, actor, override_existing_tools)
        else:
            # fallback to individual upserts for sqlite
            return await self._upsert_tools_individually(pydantic_tools, actor, override_existing_tools)

    @enforce_types
    @trace_method
    def get_tool_by_id(self, tool_id: str, actor: PydanticUser) -> PydanticTool:
        """Fetch a tool by its ID."""
        with db_registry.session() as session:
            # Retrieve tool by id using the Tool model's read method
            tool = ToolModel.read(db_session=session, identifier=tool_id, actor=actor)
            # Convert the SQLAlchemy Tool object to PydanticTool
            return tool.to_pydantic()

    @enforce_types
    @trace_method
    async def get_tool_by_id_async(self, tool_id: str, actor: PydanticUser) -> PydanticTool:
        """Fetch a tool by its ID."""
        async with db_registry.async_session() as session:
            # Retrieve tool by id using the Tool model's read method
            tool = await ToolModel.read_async(db_session=session, identifier=tool_id, actor=actor)
            # Convert the SQLAlchemy Tool object to PydanticTool
            return tool.to_pydantic()

    @enforce_types
    @trace_method
    def get_tool_by_name(self, tool_name: str, actor: PydanticUser) -> Optional[PydanticTool]:
        """Retrieve a tool by its name and a user. We derive the organization from the user, and retrieve that tool."""
        try:
            with db_registry.session() as session:
                tool = ToolModel.read(db_session=session, name=tool_name, actor=actor)
                return tool.to_pydantic()
        except NoResultFound:
            return None

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
    def get_tool_id_by_name(self, tool_name: str, actor: PydanticUser) -> Optional[str]:
        """Retrieve a tool by its name and a user. We derive the organization from the user, and retrieve that tool."""
        try:
            with db_registry.session() as session:
                tool = ToolModel.read(db_session=session, name=tool_name, actor=actor)
                return tool.id
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
        self, actor: PydanticUser, after: Optional[str] = None, limit: Optional[int] = 50, upsert_base_tools: bool = True
    ) -> List[PydanticTool]:
        """List all tools with optional pagination."""
        tools = await self._list_tools_async(actor=actor, after=after, limit=limit)

        # Check if all base tools are present if we requested all the tools w/o cursor
        # TODO: This is a temporary hack to resolve this issue
        # TODO: This requires a deeper rethink about how we keep all our internal tools up-to-date
        if not after and upsert_base_tools:
            existing_tool_names = {tool.name for tool in tools}
            base_tool_names = (
                LETTA_TOOL_SET - set(LOCAL_ONLY_MULTI_AGENT_TOOLS) if os.getenv("LETTA_ENVIRONMENT") == "PRODUCTION" else LETTA_TOOL_SET
            )
            missing_base_tools = base_tool_names - existing_tool_names

            # If any base tools are missing, upsert all base tools
            if missing_base_tools:
                logger.info(f"Missing base tools detected: {missing_base_tools}. Upserting all base tools.")
                await self.upsert_base_tools_async(actor=actor)
                # Re-fetch the tools list after upserting base tools
                tools = await self._list_tools_async(actor=actor, after=after, limit=limit)

        return tools

    @enforce_types
    @trace_method
    async def _list_tools_async(self, actor: PydanticUser, after: Optional[str] = None, limit: Optional[int] = 50) -> List[PydanticTool]:
        """List all tools with optional pagination."""
        tools_to_delete = []
        async with db_registry.async_session() as session:
            tools = await ToolModel.list_async(
                db_session=session,
                after=after,
                limit=limit,
                organization_id=actor.organization_id,
            )

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
    def update_tool_by_id(
        self,
        tool_id: str,
        tool_update: ToolUpdate,
        actor: PydanticUser,
        updated_tool_type: Optional[ToolType] = None,
        bypass_name_check: bool = False,
    ) -> PydanticTool:
        """
        Update a tool with complex validation and schema derivation logic.

        This method handles updates differently based on tool type:
        - MCP tools: JSON schema is trusted, no Python source derivation
        - Python/TypeScript tools: Schema derived from source code if provided
        - Name conflicts are checked unless bypassed

        Args:
            tool_id: The UUID of the tool to update
            tool_update: Partial update data (only changed fields)
            actor: User performing the update (for permissions)
            updated_tool_type: Optional new tool type (e.g., converting custom to builtin)
            bypass_name_check: Skip name conflict validation (use with caution)

        Returns:
            Updated tool as Pydantic model

        Raises:
            LettaToolNameConflictError: If new name conflicts with existing tool
            NoResultFound: If tool doesn't exist or user lacks access

        Side Effects:
            - Updates tool in database
            - May change tool name if source code is modified
            - Recomputes JSON schema from source for non-MCP tools

        Important:
            When source_code is provided for Python/TypeScript tools, the name
            MUST match the function name in the code, overriding any name in json_schema
        """
        # First, check if source code update would cause a name conflict
        update_data = tool_update.model_dump(to_orm=True, exclude_none=True)
        new_name = None
        new_schema = None

        # Fetch current tool to allow conditional logic based on tool type
        current_tool = self.get_tool_by_id(tool_id=tool_id, actor=actor)

        # For MCP tools, do NOT derive schema from Python source. Trust provided JSON schema.
        if current_tool.tool_type == ToolType.EXTERNAL_MCP:
            if "json_schema" in update_data:
                new_schema = update_data["json_schema"].copy()
                new_name = new_schema.get("name", current_tool.name)
            else:
                new_schema = current_tool.json_schema
                new_name = current_tool.name
            update_data.pop("source_code", None)
            if new_name != current_tool.name:
                existing_tool = self.get_tool_by_name(tool_name=new_name, actor=actor)
                if existing_tool:
                    raise LettaToolNameConflictError(tool_name=new_name)
        else:
            # For non-MCP tools, preserve existing behavior
            if "source_code" in update_data.keys() and not bypass_name_check:
                # Check source type to use appropriate parser
                source_type = update_data.get("source_type", current_tool.source_type)
                if source_type == "typescript":
                    from letta.functions.typescript_parser import derive_typescript_json_schema

                    derived_schema = derive_typescript_json_schema(source_code=update_data["source_code"])
                else:
                    # Default to Python for backwards compatibility
                    derived_schema = derive_openai_json_schema(source_code=update_data["source_code"])

                new_name = derived_schema["name"]
                if "json_schema" not in update_data.keys():
                    new_schema = derived_schema
                else:
                    new_schema = update_data["json_schema"].copy()
                    new_schema["name"] = new_name
                    update_data["json_schema"] = new_schema
                if new_name != current_tool.name:
                    existing_tool = self.get_tool_by_name(tool_name=new_name, actor=actor)
                    if existing_tool:
                        raise LettaToolNameConflictError(tool_name=new_name)

        # Now perform the update within the session
        with db_registry.session() as session:
            # Fetch the tool by ID
            tool = ToolModel.read(db_session=session, identifier=tool_id, actor=actor)

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
            return tool.update(db_session=session, actor=actor).to_pydantic()

    @enforce_types
    @trace_method
    async def update_tool_by_id_async(
        self,
        tool_id: str,
        tool_update: ToolUpdate,
        actor: PydanticUser,
        updated_tool_type: Optional[ToolType] = None,
        bypass_name_check: bool = False,
    ) -> PydanticTool:
        """Update a tool by its ID with the given ToolUpdate object."""
        # First, check if source code update would cause a name conflict
        update_data = tool_update.model_dump(to_orm=True, exclude_none=True)
        new_name = None
        new_schema = None

        # Fetch current tool early to allow conditional logic based on tool type
        current_tool = await self.get_tool_by_id_async(tool_id=tool_id, actor=actor)

        # For MCP tools, do NOT derive schema from Python source. Trust provided JSON schema.
        if current_tool.tool_type == ToolType.EXTERNAL_MCP:
            # Prefer provided json_schema; fall back to current
            if "json_schema" in update_data:
                new_schema = update_data["json_schema"].copy()
                new_name = new_schema.get("name", current_tool.name)
            else:
                new_schema = current_tool.json_schema
                new_name = current_tool.name
            # Ensure we don't trigger derive
            update_data.pop("source_code", None)
            # If name changes, enforce uniqueness
            if new_name != current_tool.name:
                name_exists = await self.tool_name_exists_async(tool_name=new_name, actor=actor)
                if name_exists:
                    raise LettaToolNameConflictError(tool_name=new_name)
        else:
            # For non-MCP tools, preserve existing behavior
            # TODO: Consider this behavior...is this what we want?
            # TODO: I feel like it's bad if json_schema strays from source code so
            # if source code is provided, always derive the name from it
            if "source_code" in update_data.keys() and not bypass_name_check:
                # Check source type to use appropriate parser
                source_type = update_data.get("source_type", current_tool.source_type)
                if source_type == "typescript":
                    from letta.functions.typescript_parser import derive_typescript_json_schema

                    derived_schema = derive_typescript_json_schema(source_code=update_data["source_code"])
                else:
                    # Default to Python for backwards compatibility
                    derived_schema = derive_openai_json_schema(source_code=update_data["source_code"])
                new_name = derived_schema["name"]

                # if json_schema wasn't provided, use the derived schema
                if "json_schema" not in update_data.keys():
                    new_schema = derived_schema
                else:
                    # if json_schema was provided, update only its name to match the source code
                    new_schema = update_data["json_schema"].copy()
                    new_schema["name"] = new_name
                    # update the json_schema in update_data so it gets applied in the loop
                    update_data["json_schema"] = new_schema

                # check if the name is changing and if so, verify it doesn't conflict
                if new_name != current_tool.name:
                    # check if a tool with the new name already exists
                    name_exists = await self.tool_name_exists_async(tool_name=new_name, actor=actor)
                    if name_exists:
                        raise LettaToolNameConflictError(tool_name=new_name)

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
            return tool.to_pydantic()

    @enforce_types
    @trace_method
    def delete_tool_by_id(self, tool_id: str, actor: PydanticUser) -> None:
        """Delete a tool by its ID."""
        with db_registry.session() as session:
            try:
                tool = ToolModel.read(db_session=session, identifier=tool_id, actor=actor)
                tool.hard_delete(db_session=session, actor=actor)
            except NoResultFound:
                raise ValueError(f"Tool with id {tool_id} not found.")

    @enforce_types
    @trace_method
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
    def upsert_base_tools(self, actor: PydanticUser) -> List[PydanticTool]:
        """
        Initialize or update all built-in Letta tools for a user.

        This method scans predefined modules to discover and register all base tools
        that ship with Letta. Tools are categorized by type (core, memory, multi-agent, etc.)
        and tagged appropriately for filtering.

        Args:
            actor: The user to create/update tools for

        Returns:
            List of all base tools that were created or updated

        Tool Categories Created:
            - LETTA_CORE: Basic conversation tools (send_message)
            - LETTA_MEMORY_CORE: Memory management (core_memory_append/replace)
            - LETTA_MULTI_AGENT_CORE: Multi-agent communication tools
            - LETTA_SLEEPTIME_CORE: Sleeptime agent tools
            - LETTA_VOICE_SLEEPTIME_CORE: Voice agent specific tools
            - LETTA_BUILTIN: Additional built-in utilities
            - LETTA_FILES_CORE: File handling tools

        Side Effects:
            - Creates or updates tools in database
            - Tools are marked with appropriate type and tags
            - Existing custom tools with same names are NOT overwritten

        Note:
            This is typically called during user initialization or system upgrade
            to ensure all base tools are available. Custom tools take precedence
            over base tools with the same name.
        """
        functions_to_schema = {}

        for module_name in LETTA_TOOL_MODULE_NAMES:
            try:
                module = importlib.import_module(module_name)
            except Exception as e:
                # Handle other general exceptions
                raise e

            try:
                # Load the function set
                functions_to_schema.update(load_function_set(module))
            except ValueError as e:
                err = f"Error loading function set '{module_name}': {e}"
                warnings.warn(err)

        # create tool in db
        tools = []
        for name, schema in functions_to_schema.items():
            if name in LETTA_TOOL_SET:
                if name in BASE_TOOLS:
                    tool_type = ToolType.LETTA_CORE
                    tags = [tool_type.value]
                elif name in BASE_MEMORY_TOOLS:
                    tool_type = ToolType.LETTA_MEMORY_CORE
                    tags = [tool_type.value]
                elif name in calculate_multi_agent_tools():
                    tool_type = ToolType.LETTA_MULTI_AGENT_CORE
                    tags = [tool_type.value]
                elif name in BASE_SLEEPTIME_TOOLS:
                    tool_type = ToolType.LETTA_SLEEPTIME_CORE
                    tags = [tool_type.value]
                elif name in BASE_VOICE_SLEEPTIME_TOOLS or name in BASE_VOICE_SLEEPTIME_CHAT_TOOLS:
                    tool_type = ToolType.LETTA_VOICE_SLEEPTIME_CORE
                    tags = [tool_type.value]
                elif name in BUILTIN_TOOLS:
                    tool_type = ToolType.LETTA_BUILTIN
                    tags = [tool_type.value]
                elif name in FILES_TOOLS:
                    tool_type = ToolType.LETTA_FILES_CORE
                    tags = [tool_type.value]
                else:
                    logger.warning(f"Tool name {name} is not in any known base tool set, skipping")
                    continue

                # create to tool
                tools.append(
                    self.create_or_update_tool(
                        PydanticTool(
                            name=name,
                            tags=tags,
                            source_type="python",
                            tool_type=tool_type,
                            return_char_limit=BASE_FUNCTION_RETURN_CHAR_LIMIT,
                        ),
                        actor=actor,
                    )
                )

        # TODO: Delete any base tools that are stale
        return tools

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
                warnings.warn(f"Error loading function set '{module_name}': {e}")
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
            pydantic_tool = PydanticTool(
                name=name,
                tags=[tool_type.value],
                source_type="python",
                tool_type=tool_type,
                return_char_limit=BASE_FUNCTION_RETURN_CHAR_LIMIT,
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
