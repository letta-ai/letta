import asyncio
import importlib
import warnings
from typing import List, Optional, Set, Union

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
    MCP_TOOL_TAG_NAME_PREFIX,
    MULTI_AGENT_TOOLS,
)
from letta.functions.functions import derive_openai_json_schema, load_function_set
from letta.log import get_logger
from letta.orm.enums import ToolType

# TODO: Remove this once we translate all of these to the ORM
from letta.orm.errors import NoResultFound
from letta.orm.tool import Tool as ToolModel
from letta.otel.tracing import trace_method
from letta.schemas.tool import Tool as PydanticTool
from letta.schemas.tool import ToolCreate, ToolUpdate
from letta.schemas.user import User as PydanticUser
from letta.server.db import db_registry
from letta.services.mcp.types import SSEServerConfig, StdioServerConfig
from letta.utils import enforce_types, printd

logger = get_logger(__name__)


class ToolManager:
    """Manager class to handle business logic related to Tools."""

    # TODO: Refactor this across the codebase to use CreateTool instead of passing in a Tool object
    @enforce_types
    @trace_method
    def create_or_update_tool(self, pydantic_tool: PydanticTool, actor: PydanticUser) -> PydanticTool:
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
                tool = self.update_tool_by_id(tool_id, ToolUpdate(**update_data), actor, updated_tool_type=updated_tool_type)
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
    async def create_or_update_tool_async(self, pydantic_tool: PydanticTool, actor: PydanticUser) -> PydanticTool:
        """Create a new tool based on the ToolCreate schema."""
        tool_id = await self.get_tool_id_by_name_async(tool_name=pydantic_tool.name, actor=actor)
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
                tool = await self.update_tool_by_id_async(tool_id, ToolUpdate(**update_data), actor, updated_tool_type=updated_tool_type)
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
    def create_or_update_mcp_tool(self, tool_create: ToolCreate, mcp_server_name: str, actor: PydanticUser) -> PydanticTool:
        metadata = {MCP_TOOL_TAG_NAME_PREFIX: {"server_name": mcp_server_name}}
        return self.create_or_update_tool(
            PydanticTool(
                tool_type=ToolType.EXTERNAL_MCP, name=tool_create.json_schema["name"], metadata_=metadata, **tool_create.model_dump()
            ),
            actor,
        )

    @enforce_types
    async def create_mcp_tool_async(self, tool_create: ToolCreate, mcp_server_name: str, actor: PydanticUser) -> PydanticTool:
        metadata = {MCP_TOOL_TAG_NAME_PREFIX: {"server_name": mcp_server_name}}
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
    def create_or_update_langchain_tool(self, tool_create: ToolCreate, actor: PydanticUser) -> PydanticTool:
        return self.create_or_update_tool(
            PydanticTool(tool_type=ToolType.EXTERNAL_LANGCHAIN, name=tool_create.json_schema["name"], **tool_create.model_dump()), actor
        )

    @enforce_types
    @trace_method
    def create_tool(self, pydantic_tool: PydanticTool, actor: PydanticUser) -> PydanticTool:
        """Create a new tool based on the ToolCreate schema."""
        with db_registry.session() as session:
            # Set the organization id at the ORM layer
            pydantic_tool.organization_id = actor.organization_id
            # Auto-generate description if not provided
            if pydantic_tool.description is None:
                pydantic_tool.description = pydantic_tool.json_schema.get("description", None)
            tool_data = pydantic_tool.model_dump(to_orm=True)

            tool = ToolModel(**tool_data)
            tool.create(session, actor=actor)  # Re-raise other database-related errors
        return tool.to_pydantic()

    @enforce_types
    @trace_method
    async def create_tool_async(self, pydantic_tool: PydanticTool, actor: PydanticUser) -> PydanticTool:
        """Create a new tool based on the ToolCreate schema."""
        async with db_registry.async_session() as session:
            # Set the organization id at the ORM layer
            pydantic_tool.organization_id = actor.organization_id
            # Auto-generate description if not provided
            if pydantic_tool.description is None:
                pydantic_tool.description = pydantic_tool.json_schema.get("description", None)
            tool_data = pydantic_tool.model_dump(to_orm=True)

            tool = ToolModel(**tool_data)
            await tool.create_async(session, actor=actor)  # Re-raise other database-related errors
            return tool.to_pydantic()

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
            missing_base_tools = LETTA_TOOL_SET - existing_tool_names

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
                    logger.warning(f"Deleting malformed tool with id={tool.id} and name={tool.name}, error was:\n{e}")
                    logger.warning("Deleted tool: ")
                    logger.warning(tool.pretty_print_columns())

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
        self, tool_id: str, tool_update: ToolUpdate, actor: PydanticUser, updated_tool_type: Optional[ToolType] = None
    ) -> PydanticTool:
        """Update a tool by its ID with the given ToolUpdate object."""
        with db_registry.session() as session:
            # Fetch the tool by ID
            tool = ToolModel.read(db_session=session, identifier=tool_id, actor=actor)

            # Update tool attributes with only the fields that were explicitly set
            update_data = tool_update.model_dump(to_orm=True, exclude_none=True)
            for key, value in update_data.items():
                setattr(tool, key, value)

            # If source code is changed and a new json_schema is not provided, we want to auto-refresh the schema
            if "source_code" in update_data.keys() and "json_schema" not in update_data.keys():
                pydantic_tool = tool.to_pydantic()
                new_schema = derive_openai_json_schema(source_code=pydantic_tool.source_code)

                tool.json_schema = new_schema
                tool.name = new_schema["name"]

            if updated_tool_type:
                tool.tool_type = updated_tool_type

            # Save the updated tool to the database
            return tool.update(db_session=session, actor=actor).to_pydantic()

    @enforce_types
    @trace_method
    async def update_tool_by_id_async(
        self, tool_id: str, tool_update: ToolUpdate, actor: PydanticUser, updated_tool_type: Optional[ToolType] = None
    ) -> PydanticTool:
        """Update a tool by its ID with the given ToolUpdate object."""
        async with db_registry.async_session() as session:
            # Fetch the tool by ID
            tool = await ToolModel.read_async(db_session=session, identifier=tool_id, actor=actor)

            # Update tool attributes with only the fields that were explicitly set
            update_data = tool_update.model_dump(to_orm=True, exclude_none=True)
            for key, value in update_data.items():
                setattr(tool, key, value)

            # If source code is changed and a new json_schema is not provided, we want to auto-refresh the schema
            if "source_code" in update_data.keys() and "json_schema" not in update_data.keys():
                pydantic_tool = tool.to_pydantic()
                new_schema = derive_openai_json_schema(source_code=pydantic_tool.source_code)

                tool.json_schema = new_schema
                tool.name = new_schema["name"]

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
        """Add default tools in base.py and multi_agent.py"""
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
                elif name in MULTI_AGENT_TOOLS:
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
                    raise ValueError(
                        f"Tool name {name} is not in the list of base tool names: {BASE_TOOLS + BASE_MEMORY_TOOLS + MULTI_AGENT_TOOLS + BASE_SLEEPTIME_TOOLS + BASE_VOICE_SLEEPTIME_TOOLS + BASE_VOICE_SLEEPTIME_CHAT_TOOLS}"
                    )

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
        """Add default tools defined in the various function_sets modules, optionally filtered by ToolType."""

        functions_to_schema = {}
        for module_name in LETTA_TOOL_MODULE_NAMES:
            try:
                module = importlib.import_module(module_name)
                functions_to_schema.update(load_function_set(module))
            except ValueError as e:
                warnings.warn(f"Error loading function set '{module_name}': {e}")
            except Exception as e:
                raise e

        tools = []
        for name, schema in functions_to_schema.items():
            if name not in LETTA_TOOL_SET:
                continue

            if name in BASE_TOOLS:
                tool_type = ToolType.LETTA_CORE
            elif name in BASE_MEMORY_TOOLS:
                tool_type = ToolType.LETTA_MEMORY_CORE
            elif name in BASE_SLEEPTIME_TOOLS:
                tool_type = ToolType.LETTA_SLEEPTIME_CORE
            elif name in MULTI_AGENT_TOOLS:
                tool_type = ToolType.LETTA_MULTI_AGENT_CORE
            elif name in BASE_VOICE_SLEEPTIME_TOOLS or name in BASE_VOICE_SLEEPTIME_CHAT_TOOLS:
                tool_type = ToolType.LETTA_VOICE_SLEEPTIME_CORE
            elif name in BUILTIN_TOOLS:
                tool_type = ToolType.LETTA_BUILTIN
            elif name in FILES_TOOLS:
                tool_type = ToolType.LETTA_FILES_CORE
            else:
                raise ValueError(f"Tool name {name} is not recognized in any known base tool set.")

            if allowed_types is not None and tool_type not in allowed_types:
                continue

            tools.append(
                self.create_or_update_tool_async(
                    PydanticTool(
                        name=name,
                        tags=[tool_type.value],
                        source_type="python",
                        tool_type=tool_type,
                        return_char_limit=BASE_FUNCTION_RETURN_CHAR_LIMIT,
                    ),
                    actor=actor,
                )
            )

        return await asyncio.gather(*tools)
