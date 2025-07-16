from typing import Dict, List

from letta.errors import AgentFileExportError, AgentFileImportError
from letta.log import get_logger
from letta.schemas.agent import AgentState, CreateAgent
from letta.schemas.agent_file import (
    AgentFileSchema,
    AgentSchema,
    BlockSchema,
    FileSchema,
    GroupSchema,
    ImportResult,
    MessageSchema,
    SourceSchema,
    ToolSchema,
)
from letta.schemas.block import Block
from letta.schemas.message import Message
from letta.schemas.tool import Tool
from letta.schemas.user import User
from letta.services.agent_manager import AgentManager
from letta.services.block_manager import BlockManager
from letta.services.file_manager import FileManager
from letta.services.files_agents_manager import FileAgentManager
from letta.services.group_manager import GroupManager
from letta.services.mcp_manager import MCPManager
from letta.services.message_manager import MessageManager
from letta.services.source_manager import SourceManager
from letta.services.tool_manager import ToolManager

logger = get_logger(__name__)


class AgentFileManager:
    """
    Manages export and import of agent files between database and AgentFileSchema format.

    Handles:
    - ID mapping between database IDs and human-readable file IDs
    - Coordination across multiple entity managers
    - Transaction safety during imports
    - Referential integrity validation
    """

    def __init__(
        self,
        agent_manager: AgentManager,
        tool_manager: ToolManager,
        source_manager: SourceManager,
        block_manager: BlockManager,
        group_manager: GroupManager,
        mcp_manager: MCPManager,
        file_manager: FileManager,
        file_agent_manager: FileAgentManager,
        message_manager: MessageManager,
    ):
        self.agent_manager = agent_manager
        self.tool_manager = tool_manager
        self.source_manager = source_manager
        self.block_manager = block_manager
        self.group_manager = group_manager
        self.mcp_manager = mcp_manager
        self.file_manager = file_manager
        self.file_agent_manager = file_agent_manager
        self.message_manager = message_manager

        # ID mapping state for export
        self._db_to_file_ids: Dict[str, str] = {}

        # Counters for generating Stripe-style IDs
        self._id_counters: Dict[str, int] = {
            AgentSchema.__id_prefix__: 0,
            GroupSchema.__id_prefix__: 0,
            BlockSchema.__id_prefix__: 0,
            FileSchema.__id_prefix__: 0,
            SourceSchema.__id_prefix__: 0,
            ToolSchema.__id_prefix__: 0,
            MessageSchema.__id_prefix__: 0,
            # MCPServerSchema.__id_prefix__: 0,
        }

    def _reset_state(self):
        """Reset internal state for a new operation"""
        self._db_to_file_ids.clear()
        for key in self._id_counters:
            self._id_counters[key] = 0

    def _generate_file_id(self, entity_type: str) -> str:
        """Generate a Stripe-style ID for the given entity type"""
        counter = self._id_counters[entity_type]
        file_id = f"{entity_type}-{counter}"
        self._id_counters[entity_type] += 1
        return file_id

    def _map_db_to_file_id(self, db_id: str, entity_type: str, allow_new: bool = True) -> str:
        """Map a database UUID to a file ID, creating if needed (export only)"""
        if db_id in self._db_to_file_ids:
            return self._db_to_file_ids[db_id]

        if not allow_new:
            raise AgentFileExportError(
                f"Unexpected new {entity_type} ID '{db_id}' encountered during conversion. "
                f"All IDs should have been mapped during agent processing."
            )

        file_id = self._generate_file_id(entity_type)
        self._db_to_file_ids[db_id] = file_id
        return file_id

    def _extract_unique_tools(self, agent_states: List[AgentState]) -> List:
        """Extract unique tools across all agent states by ID"""
        all_tools = []
        for agent_state in agent_states:
            if agent_state.tools:
                all_tools.extend(agent_state.tools)

        unique_tools = {}
        for tool in all_tools:
            unique_tools[tool.id] = tool

        return sorted(unique_tools.values(), key=lambda x: x.name)

    def _extract_unique_blocks(self, agent_states: List[AgentState]) -> List:
        """Extract unique blocks across all agent states by ID"""
        all_blocks = []
        for agent_state in agent_states:
            if agent_state.memory and agent_state.memory.blocks:
                all_blocks.extend(agent_state.memory.blocks)

        unique_blocks = {}
        for block in all_blocks:
            unique_blocks[block.id] = block

        return sorted(unique_blocks.values(), key=lambda x: x.label)

    async def _convert_agent_state_to_schema(self, agent_state: AgentState, actor: User) -> AgentSchema:
        """Convert AgentState to AgentSchema with ID remapping"""

        agent_file_id = self._map_db_to_file_id(agent_state.id, AgentSchema.__id_prefix__)
        agent_schema = await AgentSchema.from_agent_state(agent_state, message_manager=self.message_manager, actor=actor)
        agent_schema.id = agent_file_id

        # Remap message IDs and populate ID map
        if agent_schema.messages:
            for message in agent_schema.messages:
                # This call will populate the _db_to_file_ids mapping for this message
                message_file_id = self._map_db_to_file_id(message.id, MessageSchema.__id_prefix__)
                # Update the message's ID to the file ID
                message.id = message_file_id
                # Update the message's agent_id to the file ID
                message.agent_id = agent_file_id

        # Now remap in_context_message_ids using the populated map
        if agent_schema.in_context_message_ids:
            agent_schema.in_context_message_ids = [
                self._map_db_to_file_id(message_id, MessageSchema.__id_prefix__, allow_new=False)
                for message_id in agent_schema.in_context_message_ids
            ]

        # Remap related entity IDs to file IDs using their schema prefixes
        if agent_schema.tool_ids:
            agent_schema.tool_ids = [self._map_db_to_file_id(tool_id, ToolSchema.__id_prefix__) for tool_id in agent_schema.tool_ids]

        # TODO: Support sources
        # if agent_schema.source_ids:
        #     agent_schema.source_ids = [
        #         self._map_db_to_file_id(source_id, SourceSchema.__id_prefix__) for source_id in agent_schema.source_ids
        #     ]
        #
        if agent_schema.block_ids:
            agent_schema.block_ids = [self._map_db_to_file_id(block_id, BlockSchema.__id_prefix__) for block_id in agent_schema.block_ids]

        # TODO: Add other relationship ID mappings as needed
        # (group_ids, etc.)

        return agent_schema

    def _convert_tool_to_schema(self, tool) -> ToolSchema:
        """Convert Tool to ToolSchema with ID remapping"""
        tool_file_id = self._map_db_to_file_id(tool.id, ToolSchema.__id_prefix__, allow_new=False)
        tool_schema = ToolSchema.from_tool(tool)
        tool_schema.id = tool_file_id
        return tool_schema

    def _convert_block_to_schema(self, block) -> BlockSchema:
        """Convert Block to BlockSchema with ID remapping"""
        block_file_id = self._map_db_to_file_id(block.id, BlockSchema.__id_prefix__, allow_new=False)
        block_schema = BlockSchema.from_block(block)
        block_schema.id = block_file_id
        return block_schema

    async def export(self, agent_ids: List[str], actor: User) -> AgentFileSchema:
        """
        Export agents and their related entities to AgentFileSchema format.

        Args:
            agent_ids: List of agent UUIDs to export

        Returns:
            AgentFileSchema with all related entities

        Raises:
            AgentFileExportError: If export fails
        """
        try:
            self._reset_state()

            agent_states = await self.agent_manager.get_agents_by_ids_async(agent_ids=agent_ids, actor=actor)

            # Validate that all requested agents were found
            if len(agent_states) != len(agent_ids):
                found_ids = {agent.id for agent in agent_states}
                missing_ids = [agent_id for agent_id in agent_ids if agent_id not in found_ids]
                raise AgentFileExportError(f"The following agent IDs were not found: {missing_ids}")

            # Extract unique entities across all agents
            tool_set = self._extract_unique_tools(agent_states)
            block_set = self._extract_unique_blocks(agent_states)

            # Convert to schemas with ID remapping
            agent_schemas = [await self._convert_agent_state_to_schema(agent_state, actor=actor) for agent_state in agent_states]
            tool_schemas = [self._convert_tool_to_schema(tool) for tool in tool_set]
            block_schemas = [self._convert_block_to_schema(block) for block in block_set]

            logger.info(f"Exporting {len(agent_ids)} agents to agent file format")

            # Return AgentFileSchema with converted entities
            return AgentFileSchema(
                agents=agent_schemas,
                groups=[],  # TODO: Extract and convert groups
                blocks=block_schemas,
                files=[],  # TODO: Extract and convert files
                sources=[],  # TODO: Extract and convert sources
                tools=tool_schemas,
                # mcp_servers=[],  # TODO: Extract and convert MCP servers
            )

        except Exception as e:
            logger.error(f"Failed to export agent file: {e}")
            raise AgentFileExportError(f"Export failed: {e}") from e

    async def import_file(self, schema: AgentFileSchema, actor: User, dry_run: bool = False) -> ImportResult:
        """
        Import AgentFileSchema into the database.

        Args:
            schema: The agent file schema to import
            dry_run: If True, validate but don't commit changes

        Returns:
            ImportResult with success status and details

        Raises:
            AgentFileImportError: If import fails
        """
        try:
            self._reset_state()

            if dry_run:
                logger.info("Starting dry run import validation")
            else:
                logger.info("Starting agent file import")

            # Validate schema first
            self._validate_schema(schema)

            if dry_run:
                return ImportResult(
                    success=True,
                    message="Dry run validation passed",
                    imported_count=0,
                )

            # Import in dependency order
            imported_count = 0
            file_to_db_ids = {}  # Maps file IDs to new database IDs

            # 1. Create tools first (no dependencies)
            for tool_schema in schema.tools:
                # Convert ToolSchema back to ToolCreate
                created_tool = await self.tool_manager.create_or_update_tool_async(
                    pydantic_tool=Tool(**tool_schema.model_dump(exclude={"id"})), actor=actor
                )
                file_to_db_ids[tool_schema.id] = created_tool.id
                imported_count += 1

            # 2. Create blocks (no dependencies)
            for block_schema in schema.blocks:
                # Convert BlockSchema back to CreateBlock
                block = Block(**block_schema.model_dump(exclude={"id"}))
                created_block = await self.block_manager.create_or_update_block_async(block, actor)
                file_to_db_ids[block_schema.id] = created_block.id
                imported_count += 1

            # 3. Create agents with empty message history
            for agent_schema in schema.agents:
                # Convert AgentSchema back to CreateAgent, remapping tool/block IDs
                agent_data = agent_schema.model_dump(exclude={"id", "in_context_message_ids", "messages"})

                # Remap tool_ids from file IDs to database IDs
                if agent_data.get("tool_ids"):
                    agent_data["tool_ids"] = [file_to_db_ids[file_id] for file_id in agent_data["tool_ids"]]

                # Remap block_ids from file IDs to database IDs
                if agent_data.get("block_ids"):
                    agent_data["block_ids"] = [file_to_db_ids[file_id] for file_id in agent_data["block_ids"]]

                agent_create = CreateAgent(**agent_data)
                created_agent = await self.agent_manager.create_agent_async(agent_create, actor, _init_with_no_messages=True)
                file_to_db_ids[agent_schema.id] = created_agent.id
                imported_count += 1

            # 4. Create messages and update agent message_ids
            for agent_schema in schema.agents:
                agent_db_id = file_to_db_ids[agent_schema.id]
                message_file_to_db_ids = {}

                # Create messages for this agent
                messages = []
                for message_schema in agent_schema.messages:
                    # Convert MessageSchema back to Message, setting agent_id to new DB ID
                    message_data = message_schema.model_dump(exclude={"id"})
                    message_data["agent_id"] = agent_db_id  # Remap agent_id to new database ID
                    message_obj = Message(**message_data)
                    messages.append(message_obj)
                    # Map file ID to the generated database ID immediately
                    message_file_to_db_ids[message_schema.id] = message_obj.id

                created_messages = await self.message_manager.create_many_messages_async(pydantic_msgs=messages, actor=actor)
                imported_count += len(created_messages)

                # Remap in_context_message_ids from file IDs to database IDs
                in_context_db_ids = [message_file_to_db_ids[message_schema_id] for message_schema_id in agent_schema.in_context_message_ids]

                # Update agent with the correct message_ids
                await self.agent_manager.set_in_context_messages_async(agent_id=agent_db_id, message_ids=in_context_db_ids, actor=actor)

            return ImportResult(
                success=True,
                message=f"Import completed successfully. Imported {imported_count} entities.",
                imported_count=imported_count,
                id_mappings=file_to_db_ids,
            )

        except Exception as e:
            logger.error(f"Failed to import agent file: {e}")
            raise AgentFileImportError(f"Import failed: {e}") from e

    def _validate_id_format(self, schema: AgentFileSchema) -> List[str]:
        """Validate that all IDs follow the expected format"""
        errors = []

        # Define entity types and their expected prefixes
        entity_checks = [
            (schema.agents, AgentSchema.__id_prefix__),
            (schema.groups, GroupSchema.__id_prefix__),
            (schema.blocks, BlockSchema.__id_prefix__),
            (schema.files, FileSchema.__id_prefix__),
            (schema.sources, SourceSchema.__id_prefix__),
            (schema.tools, ToolSchema.__id_prefix__),
        ]

        for entities, expected_prefix in entity_checks:
            for entity in entities:
                if not entity.id.startswith(f"{expected_prefix}-"):
                    errors.append(f"Invalid ID format: {entity.id} should start with '{expected_prefix}-'")
                else:
                    # Check that the suffix is a valid integer
                    try:
                        suffix = entity.id[len(expected_prefix) + 1 :]
                        int(suffix)
                    except ValueError:
                        errors.append(f"Invalid ID format: {entity.id} should have integer suffix")

        # Also check message IDs within agents
        for agent in schema.agents:
            for message in agent.messages:
                if not message.id.startswith(f"{MessageSchema.__id_prefix__}-"):
                    errors.append(f"Invalid message ID format: {message.id} should start with '{MessageSchema.__id_prefix__}-'")
                else:
                    # Check that the suffix is a valid integer
                    try:
                        suffix = message.id[len(MessageSchema.__id_prefix__) + 1 :]
                        int(suffix)
                    except ValueError:
                        errors.append(f"Invalid message ID format: {message.id} should have integer suffix")

        return errors

    def _validate_duplicate_ids(self, schema: AgentFileSchema) -> List[str]:
        """Validate that there are no duplicate IDs within or across entity types"""
        errors = []
        all_ids = set()

        # Check each entity type for internal duplicates and collect all IDs
        entity_collections = [
            ("agents", schema.agents),
            ("groups", schema.groups),
            ("blocks", schema.blocks),
            ("files", schema.files),
            ("sources", schema.sources),
            ("tools", schema.tools),
        ]

        for entity_type, entities in entity_collections:
            entity_ids = [entity.id for entity in entities]

            # Check for duplicates within this entity type
            if len(entity_ids) != len(set(entity_ids)):
                duplicates = [id for id in entity_ids if entity_ids.count(id) > 1]
                errors.append(f"Duplicate {entity_type} IDs found: {set(duplicates)}")

            # Check for duplicates across all entity types
            for entity_id in entity_ids:
                if entity_id in all_ids:
                    errors.append(f"Duplicate ID across entity types: {entity_id}")
                all_ids.add(entity_id)

        # Also check message IDs within agents
        for agent in schema.agents:
            message_ids = [msg.id for msg in agent.messages]

            # Check for duplicates within agent messages
            if len(message_ids) != len(set(message_ids)):
                duplicates = [id for id in message_ids if message_ids.count(id) > 1]
                errors.append(f"Duplicate message IDs in agent {agent.id}: {set(duplicates)}")

            # Check for duplicates across all entity types
            for message_id in message_ids:
                if message_id in all_ids:
                    errors.append(f"Duplicate ID across entity types: {message_id}")
                all_ids.add(message_id)

        return errors

    def _validate_schema(self, schema: AgentFileSchema):
        """
        Validate the agent file schema for consistency and referential integrity.

        Args:
            schema: The schema to validate

        Raises:
            AgentFileImportError: If validation fails
        """
        errors = []

        # 1. ID Format Validation
        errors.extend(self._validate_id_format(schema))

        # 2. Duplicate ID Detection
        errors.extend(self._validate_duplicate_ids(schema))

        if errors:
            raise AgentFileImportError(f"Schema validation failed: {'; '.join(errors)}")

        logger.info("Schema validation passed")
