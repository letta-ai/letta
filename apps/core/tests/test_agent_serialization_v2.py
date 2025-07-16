import asyncio
from typing import List

import pytest

from letta.config import LettaConfig
from letta.errors import AgentFileExportError, AgentFileImportError
from letta.orm import Base
from letta.schemas.agent import CreateAgent
from letta.schemas.agent_file import (
    AgentFileSchema,
    AgentSchema,
    BlockSchema,
    FileSchema,
    GroupSchema,
    MessageSchema,
    SourceSchema,
    ToolSchema,
)
from letta.schemas.block import Block, CreateBlock
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import MessageRole
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import MessageCreate
from letta.schemas.organization import Organization
from letta.schemas.user import User
from letta.server.server import SyncServer
from letta.services.agent_file_manager import AgentFileManager
from tests.utils import create_tool_from_func

# ------------------------------
# Fixtures
# ------------------------------


@pytest.fixture(scope="module")
def event_loop():
    """Use a single asyncio loop for the entire test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


def _clear_tables():
    from letta.server.db import db_context

    with db_context() as session:
        for table in reversed(Base.metadata.sorted_tables):  # Reverse to avoid FK issues
            session.execute(table.delete())  # Truncate table
        session.commit()


@pytest.fixture(autouse=True)
def clear_tables():
    _clear_tables()


@pytest.fixture
def server():
    config = LettaConfig.load()
    config.save()
    server = SyncServer(init_with_default_org_and_user=True)
    server.tool_manager.upsert_base_tools(actor=server.default_user)

    yield server


@pytest.fixture
def default_organization(server: SyncServer):
    """Fixture to create and return the default organization."""
    org = server.organization_manager.create_default_organization()
    yield org


@pytest.fixture
def default_user(server: SyncServer, default_organization):
    """Fixture to create and return the default user within the default organization."""
    user = server.user_manager.create_default_user(org_id=default_organization.id)
    yield user


@pytest.fixture
def other_organization(server: SyncServer):
    """Fixture to create and return another organization."""
    org = server.organization_manager.create_organization(pydantic_org=Organization(name="test_org"))
    yield org


@pytest.fixture
def other_user(server: SyncServer, other_organization):
    """Fixture to create and return another user within the other organization."""
    user = server.user_manager.create_user(pydantic_user=User(organization_id=other_organization.id, name="test_user"))
    yield user


@pytest.fixture
def weather_tool_func():
    def get_weather(location: str) -> str:
        """Get the current weather for a given location.

        Args:
            location: The city and state, e.g. San Francisco, CA

        Returns:
            Weather description
        """
        return f"The weather in {location} is sunny and 72 degrees."

    return get_weather


@pytest.fixture
def print_tool_func():
    def print_message(message: str) -> str:
        """Print a message to the console.

        Args:
            message: The message to print

        Returns:
            Confirmation message
        """
        print(message)
        return f"Printed: {message}"

    return print_tool_func


@pytest.fixture
def weather_tool(server, weather_tool_func, default_user):
    weather_tool = server.tool_manager.create_or_update_tool(create_tool_from_func(func=weather_tool_func), actor=default_user)
    yield weather_tool


@pytest.fixture
def print_tool(server, print_tool_func, default_user):
    print_tool = server.tool_manager.create_or_update_tool(create_tool_from_func(func=print_tool_func), actor=default_user)
    yield print_tool


@pytest.fixture
def test_block(server: SyncServer, default_user):
    """Fixture to create and return a test block."""
    block_data = Block(
        label="test_block",
        value="Test Block Content",
        description="A test block for agent file tests",
        limit=1000,
        metadata={"type": "test", "category": "demo"},
    )
    block = server.block_manager.create_or_update_block(block_data, actor=default_user)
    yield block


@pytest.fixture
def agent_file_manager(server, default_user):
    """Fixture to create AgentFileManager with all required services."""
    manager = AgentFileManager(
        agent_manager=server.agent_manager,
        tool_manager=server.tool_manager,
        source_manager=server.source_manager,
        block_manager=server.block_manager,
        group_manager=server.group_manager,
        mcp_manager=server.mcp_manager,
        file_manager=server.file_manager,
        file_agent_manager=server.file_agent_manager,
        message_manager=server.message_manager,
    )
    yield manager


@pytest.fixture
def test_agent(server: SyncServer, default_user, default_organization, test_block, weather_tool):
    """Fixture to create and return a test agent with messages."""
    memory_blocks = [
        CreateBlock(label="human", value="User is a test user"),
        CreateBlock(label="persona", value="I am a helpful test assistant"),
    ]

    create_agent_request = CreateAgent(
        name="test_agent_v2",
        system="You are a helpful assistant for testing agent file export/import.",
        memory_blocks=memory_blocks,
        llm_config=LLMConfig.default_config("gpt-4o-mini"),
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
        block_ids=[test_block.id],
        tool_ids=[weather_tool.id],
        tags=["test", "v2", "export"],
        description="Test agent for agent file v2 testing",
        metadata={"test_key": "test_value", "version": "v2"},
        initial_message_sequence=[
            MessageCreate(role=MessageRole.system, content="You are a helpful assistant."),
            MessageCreate(role=MessageRole.user, content="Hello!"),
            MessageCreate(role=MessageRole.assistant, content="Hello! How can I help you today?"),
        ],
        tool_exec_environment_variables={"TEST_VAR": "test_value"},
        message_buffer_autoclear=False,
    )

    agent_state = server.agent_manager.create_agent(
        agent_create=create_agent_request,
        actor=default_user,
    )

    # Add more messages to create a richer conversation history
    server.send_messages(
        actor=default_user,
        agent_id=agent_state.id,
        input_messages=[MessageCreate(role=MessageRole.user, content="What's the weather like?")],
    )

    # Get updated agent state with messages
    agent_state = server.agent_manager.get_agent_by_id(agent_id=agent_state.id, actor=default_user)
    yield agent_state


# ------------------------------
# Helper Functions
# ------------------------------


def compare_agent_files(original: AgentFileSchema, imported: AgentFileSchema) -> bool:
    """Compare two AgentFileSchema objects for logical equivalence."""
    errors = []

    if len(original.agents) != len(imported.agents):
        errors.append(f"Agent count mismatch: {len(original.agents)} vs {len(imported.agents)}")

    if len(original.tools) != len(imported.tools):
        errors.append(f"Tool count mismatch: {len(original.tools)} vs {len(imported.tools)}")

    if len(original.blocks) != len(imported.blocks):
        errors.append(f"Block count mismatch: {len(original.blocks)} vs {len(imported.blocks)}")

    if len(original.groups) != len(imported.groups):
        errors.append(f"Group count mismatch: {len(original.groups)} vs {len(imported.groups)}")

    if len(original.files) != len(imported.files):
        errors.append(f"File count mismatch: {len(original.files)} vs {len(imported.files)}")

    if len(original.sources) != len(imported.sources):
        errors.append(f"Source count mismatch: {len(original.sources)} vs {len(imported.sources)}")

    for i, (orig_agent, imp_agent) in enumerate(zip(original.agents, imported.agents)):
        agent_errors = _compare_agents(orig_agent, imp_agent, i)
        errors.extend(agent_errors)

    orig_tools_sorted = sorted(original.tools, key=lambda x: x.name)
    imp_tools_sorted = sorted(imported.tools, key=lambda x: x.name)
    for i, (orig_tool, imp_tool) in enumerate(zip(orig_tools_sorted, imp_tools_sorted)):
        tool_errors = _compare_tools(orig_tool, imp_tool, i)
        errors.extend(tool_errors)

    orig_blocks_sorted = sorted(original.blocks, key=lambda x: x.label)
    imp_blocks_sorted = sorted(imported.blocks, key=lambda x: x.label)
    for i, (orig_block, imp_block) in enumerate(zip(orig_blocks_sorted, imp_blocks_sorted)):
        block_errors = _compare_blocks(orig_block, imp_block, i)
        errors.extend(block_errors)

    for i, (orig_group, imp_group) in enumerate(zip(original.groups, imported.groups)):
        group_errors = _compare_groups(orig_group, imp_group, i)
        errors.extend(group_errors)

    for i, (orig_file, imp_file) in enumerate(zip(original.files, imported.files)):
        file_errors = _compare_files(orig_file, imp_file, i)
        errors.extend(file_errors)

    for i, (orig_source, imp_source) in enumerate(zip(original.sources, imported.sources)):
        source_errors = _compare_sources(orig_source, imp_source, i)
        errors.extend(source_errors)

    if errors:
        print("Agent file comparison errors:")
        for error in errors:
            print(f"  - {error}")
        return False

    return True


def _compare_agents(orig: AgentSchema, imp: AgentSchema, index: int) -> List[str]:
    """Compare two AgentSchema objects for logical equivalence."""
    errors = []

    if orig.name != imp.name:
        errors.append(f"Agent {index}: name mismatch: '{orig.name}' vs '{imp.name}'")

    if orig.system != imp.system:
        errors.append(f"Agent {index}: system mismatch")

    if orig.description != imp.description:
        errors.append(f"Agent {index}: description mismatch")

    if orig.agent_type != imp.agent_type:
        errors.append(f"Agent {index}: agent_type mismatch: '{orig.agent_type}' vs '{imp.agent_type}'")

    if orig.tags != imp.tags:
        errors.append(f"Agent {index}: tags mismatch: {orig.tags} vs {imp.tags}")

    if orig.metadata != imp.metadata:
        errors.append(f"Agent {index}: metadata mismatch")

    if orig.llm_config != imp.llm_config:
        errors.append(f"Agent {index}: llm_config mismatch")

    if orig.embedding_config != imp.embedding_config:
        errors.append(f"Agent {index}: embedding_config mismatch")

    # Tool rules
    if orig.tool_rules != imp.tool_rules:
        errors.append(f"Agent {index}: tool_rules mismatch")

    # Environment variables
    if orig.tool_exec_environment_variables != imp.tool_exec_environment_variables:
        errors.append(f"Agent {index}: tool_exec_environment_variables mismatch")

    # Messages
    if len(orig.messages) != len(imp.messages):
        errors.append(f"Agent {index}: message count mismatch: {len(orig.messages)} vs {len(imp.messages)}")
    else:
        for j, (orig_msg, imp_msg) in enumerate(zip(orig.messages, imp.messages)):
            msg_errors = _compare_messages(orig_msg, imp_msg, index, j)
            errors.extend(msg_errors)

    # In-context messages
    if len(orig.in_context_message_ids) != len(imp.in_context_message_ids):
        errors.append(
            f"Agent {index}: in-context message count mismatch: {len(orig.in_context_message_ids)} vs {len(imp.in_context_message_ids)}"
        )

    # Relationship IDs (lengths should match)
    if len(orig.tool_ids or []) != len(imp.tool_ids or []):
        errors.append(f"Agent {index}: tool_ids count mismatch: {len(orig.tool_ids or [])} vs {len(imp.tool_ids or [])}")

    if len(orig.block_ids or []) != len(imp.block_ids or []):
        errors.append(f"Agent {index}: block_ids count mismatch: {len(orig.block_ids or [])} vs {len(imp.block_ids or [])}")

    if len(orig.source_ids or []) != len(imp.source_ids or []):
        errors.append(f"Agent {index}: source_ids count mismatch: {len(orig.source_ids or [])} vs {len(imp.source_ids or [])}")

    return errors


def _compare_messages(orig: MessageSchema, imp: MessageSchema, agent_index: int, msg_index: int) -> List[str]:
    """Compare two MessageSchema objects for logical equivalence."""
    errors = []

    if orig.role != imp.role:
        errors.append(f"Agent {agent_index}, Message {msg_index}: role mismatch: '{orig.role}' vs '{imp.role}'")

    if orig.content != imp.content:
        errors.append(f"Agent {agent_index}, Message {msg_index}: content mismatch")

    if orig.name != imp.name:
        errors.append(f"Agent {agent_index}, Message {msg_index}: name mismatch: '{orig.name}' vs '{imp.name}'")

    if orig.model != imp.model:
        errors.append(f"Agent {agent_index}, Message {msg_index}: model mismatch: '{orig.model}' vs '{imp.model}'")

    # Skip agent_id comparison - expected to be different between original and imported

    return errors


def _compare_tools(orig: ToolSchema, imp: ToolSchema, index: int) -> List[str]:
    """Compare two ToolSchema objects for logical equivalence."""
    errors = []

    if orig.name != imp.name:
        errors.append(f"Tool {index}: name mismatch: '{orig.name}' vs '{imp.name}'")

    if orig.description != imp.description:
        errors.append(f"Tool {index}: description mismatch")

    if orig.source_code != imp.source_code:
        errors.append(f"Tool {index}: source_code mismatch")

    if orig.json_schema != imp.json_schema:
        errors.append(f"Tool {index}: json_schema mismatch")

    if orig.tags != imp.tags:
        errors.append(f"Tool {index}: tags mismatch: {orig.tags} vs {imp.tags}")

    if orig.metadata_ != imp.metadata_:
        errors.append(f"Tool {index}: metadata mismatch")

    # Skip organization_id comparison - expected to be different between orgs

    return errors


def _compare_blocks(orig: BlockSchema, imp: BlockSchema, index: int) -> List[str]:
    """Compare two BlockSchema objects for logical equivalence."""
    errors = []

    if orig.label != imp.label:
        errors.append(f"Block {index}: label mismatch: '{orig.label}' vs '{imp.label}'")

    if orig.value != imp.value:
        errors.append(f"Block {index}: value mismatch")

    if orig.limit != imp.limit:
        errors.append(f"Block {index}: limit mismatch: {orig.limit} vs {imp.limit}")

    if orig.description != imp.description:
        errors.append(f"Block {index}: description mismatch")

    if orig.metadata != imp.metadata:
        errors.append(f"Block {index}: metadata mismatch")

    if orig.template_name != imp.template_name:
        errors.append(f"Block {index}: template_name mismatch: '{orig.template_name}' vs '{imp.template_name}'")

    if orig.is_template != imp.is_template:
        errors.append(f"Block {index}: is_template mismatch: {orig.is_template} vs {imp.is_template}")

    return errors


def _compare_groups(orig: GroupSchema, imp: GroupSchema, index: int) -> List[str]:
    """Compare two GroupSchema objects for logical equivalence."""
    errors = []

    if orig.name != imp.name:
        errors.append(f"Group {index}: name mismatch: '{orig.name}' vs '{imp.name}'")

    if orig.description != imp.description:
        errors.append(f"Group {index}: description mismatch")

    if orig.metadata != imp.metadata:
        errors.append(f"Group {index}: metadata mismatch")

    return errors


def _compare_files(orig: FileSchema, imp: FileSchema, index: int) -> List[str]:
    """Compare two FileSchema objects for logical equivalence."""
    errors = []

    if orig.file_name != imp.file_name:
        errors.append(f"File {index}: file_name mismatch: '{orig.file_name}' vs '{imp.file_name}'")

    if orig.file_size != imp.file_size:
        errors.append(f"File {index}: file_size mismatch: {orig.file_size} vs {imp.file_size}")

    if orig.file_type != imp.file_type:
        errors.append(f"File {index}: file_type mismatch: '{orig.file_type}' vs '{imp.file_type}'")

    if orig.description != imp.description:
        errors.append(f"File {index}: description mismatch")

    if orig.metadata != imp.metadata:
        errors.append(f"File {index}: metadata mismatch")

    return errors


def _compare_sources(orig: SourceSchema, imp: SourceSchema, index: int) -> List[str]:
    """Compare two SourceSchema objects for logical equivalence."""
    errors = []

    if orig.name != imp.name:
        errors.append(f"Source {index}: name mismatch: '{orig.name}' vs '{imp.name}'")

    if orig.description != imp.description:
        errors.append(f"Source {index}: description mismatch")

    if orig.metadata != imp.metadata:
        errors.append(f"Source {index}: metadata mismatch")

    return errors


def validate_id_format(schema: AgentFileSchema) -> bool:
    """Validate that all IDs follow the expected format (entity-N)."""
    # Check agent IDs
    for agent in schema.agents:
        if not agent.id.startswith("agent-"):
            print(f"Invalid agent ID format: {agent.id}")
            return False

        # Check message IDs within agents
        for message in agent.messages:
            if not message.id.startswith("message-"):
                print(f"Invalid message ID format: {message.id}")
                return False

        # Check in-context message ID references
        for msg_id in agent.in_context_message_ids:
            if not msg_id.startswith("message-"):
                print(f"Invalid in-context message ID format: {msg_id}")
                return False

    # Check tool IDs
    for tool in schema.tools:
        if not tool.id.startswith("tool-"):
            print(f"Invalid tool ID format: {tool.id}")
            return False

    # Check block IDs
    for block in schema.blocks:
        if not block.id.startswith("block-"):
            print(f"Invalid block ID format: {block.id}")
            return False

    return True


# ------------------------------
# Tests
# ------------------------------


class TestAgentFileExport:
    """Tests for agent file export functionality."""

    async def test_basic_export(self, agent_file_manager, test_agent, default_user):
        """Test basic agent export functionality."""
        # Export the agent
        agent_file = await agent_file_manager.export([test_agent.id], default_user)

        # Validate the structure
        assert isinstance(agent_file, AgentFileSchema)
        assert len(agent_file.agents) == 1
        assert len(agent_file.tools) > 0  # Should include base tools + weather tool
        assert len(agent_file.blocks) > 0  # Should include memory blocks + test block

        # Validate ID formats
        assert validate_id_format(agent_file)

        # Check agent data
        exported_agent = agent_file.agents[0]
        assert exported_agent.name == test_agent.name
        assert exported_agent.system == test_agent.system
        assert len(exported_agent.messages) > 0
        assert len(exported_agent.in_context_message_ids) > 0

    async def test_export_multiple_agents(self, server, agent_file_manager, test_agent, default_user, weather_tool):
        """Test exporting multiple agents."""
        # Create a second agent
        create_agent_request = CreateAgent(
            name="second_test_agent",
            system="Second test agent",
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            tool_ids=[weather_tool.id],
            initial_message_sequence=[
                MessageCreate(role=MessageRole.user, content="Second agent message"),
            ],
        )

        second_agent = server.agent_manager.create_agent(
            agent_create=create_agent_request,
            actor=default_user,
        )

        # Export both agents
        agent_file = await agent_file_manager.export([test_agent.id, second_agent.id], default_user)

        # Validate
        assert len(agent_file.agents) == 2
        assert validate_id_format(agent_file)

        # Check that agents have different IDs but tools are deduplicated
        agent_ids = {agent.id for agent in agent_file.agents}
        assert len(agent_ids) == 2

    async def test_export_id_remapping(self, agent_file_manager, test_agent, default_user):
        """Test that IDs are properly remapped during export."""
        # Export the agent
        agent_file = await agent_file_manager.export([test_agent.id], default_user)

        exported_agent = agent_file.agents[0]

        # Verify agent ID is remapped
        assert exported_agent.id == "agent-0"
        assert exported_agent.id != test_agent.id

        # Verify tool/block IDs are remapped
        if exported_agent.tool_ids:
            for tool_id in exported_agent.tool_ids:
                assert tool_id.startswith("tool-")

        if exported_agent.block_ids:
            for block_id in exported_agent.block_ids:
                assert block_id.startswith("block-")

        # Verify message IDs are remapped and in-context references are consistent
        message_ids = {msg.id for msg in exported_agent.messages}
        for in_context_id in exported_agent.in_context_message_ids:
            assert in_context_id in message_ids, f"In-context message ID {in_context_id} not found in messages"

    async def test_message_agent_id_remapping(self, agent_file_manager, test_agent, default_user):
        """Test that message.agent_id is properly remapped during export."""
        # Export the agent
        agent_file = await agent_file_manager.export([test_agent.id], default_user)

        exported_agent = agent_file.agents[0]

        # Verify all messages have the remapped agent_id matching the exported agent
        for message in exported_agent.messages:
            assert (
                message.agent_id == exported_agent.id
            ), f"Message {message.id} has agent_id {message.agent_id}, expected {exported_agent.id}"

        # Verify agent_id is the remapped file ID format
        assert exported_agent.id == "agent-0"
        assert exported_agent.id != test_agent.id

    async def test_export_empty_agent_list(self, agent_file_manager, default_user):
        """Test exporting empty agent list."""
        agent_file = await agent_file_manager.export([], default_user)

        assert len(agent_file.agents) == 0
        assert len(agent_file.tools) == 0
        assert len(agent_file.blocks) == 0

    async def test_export_nonexistent_agent(self, agent_file_manager, default_user):
        """Test exporting non-existent agent raises error."""
        with pytest.raises(AgentFileExportError):  # Should raise AgentFileExportError for non-existent agent
            await agent_file_manager.export(["non-existent-id"], default_user)


class TestAgentFileImport:
    """Tests for agent file import functionality."""

    async def test_basic_import(self, agent_file_manager, test_agent, default_user, other_user):
        """Test basic agent import functionality."""
        # Export the agent
        agent_file = await agent_file_manager.export([test_agent.id], default_user)

        # Import the agent
        result = await agent_file_manager.import_file(agent_file, other_user)

        # Validate import result
        assert result.success
        assert result.imported_count > 0
        assert len(result.id_mappings) > 0

        # Verify new entities were created (not existing ones reused)
        for file_id, db_id in result.id_mappings.items():
            if file_id.startswith("agent-"):
                assert db_id != test_agent.id  # New agent should have different ID

    async def test_import_preserves_data(self, server, agent_file_manager, test_agent, default_user, other_user):
        """Test that import preserves all important data."""
        # Export the agent
        agent_file = await agent_file_manager.export([test_agent.id], default_user)

        # Import the agent
        result = await agent_file_manager.import_file(agent_file, other_user)

        # Get the imported agent
        imported_agent_id = next(db_id for file_id, db_id in result.id_mappings.items() if file_id == "agent-0")
        imported_agent = server.agent_manager.get_agent_by_id(imported_agent_id, other_user)

        # Compare key fields
        assert imported_agent.name == test_agent.name
        assert imported_agent.system == test_agent.system
        assert imported_agent.description == test_agent.description
        assert imported_agent.metadata == test_agent.metadata
        assert imported_agent.tags == test_agent.tags

        # Check that tools and blocks were imported
        assert len(imported_agent.tools) == len(test_agent.tools)
        assert len(imported_agent.memory.blocks) == len(test_agent.memory.blocks)

        # Check that messages were imported
        original_messages = server.message_manager.list_messages_for_agent(test_agent.id, default_user)
        imported_messages = server.message_manager.list_messages_for_agent(imported_agent_id, other_user)

        assert len(imported_messages) == len(original_messages)

        # Verify message content is preserved
        for orig_msg, imp_msg in zip(original_messages, imported_messages):
            assert orig_msg.role == imp_msg.role
            assert orig_msg.content == imp_msg.content
            assert imp_msg.agent_id == imported_agent_id  # Should be remapped to new agent

    async def test_import_message_context_preservation(self, server, agent_file_manager, test_agent, default_user, other_user):
        """Test that in-context message references are preserved during import."""
        # Export the agent
        agent_file = await agent_file_manager.export([test_agent.id], default_user)

        # Import the agent
        result = await agent_file_manager.import_file(agent_file, other_user)

        # Get the imported agent
        imported_agent_id = next(db_id for file_id, db_id in result.id_mappings.items() if file_id == "agent-0")
        imported_agent = server.agent_manager.get_agent_by_id(imported_agent_id, other_user)

        # Check that in-context message count is preserved
        assert len(imported_agent.message_ids) == len(test_agent.message_ids)

        # Verify all in-context messages exist
        imported_messages = server.message_manager.list_messages_for_agent(imported_agent_id, other_user)
        imported_message_ids = {msg.id for msg in imported_messages}

        for in_context_id in imported_agent.message_ids:
            assert in_context_id in imported_message_ids

    async def test_dry_run_import(self, agent_file_manager, test_agent, default_user, other_user):
        """Test dry run import validation."""
        # Export the agent
        agent_file = await agent_file_manager.export([test_agent.id], default_user)

        # Dry run import
        result = await agent_file_manager.import_file(agent_file, other_user, dry_run=True)

        # Validate dry run result
        assert result.success
        assert result.imported_count == 0  # No actual imports in dry run
        assert len(result.id_mappings) == 0
        assert "dry run" in result.message.lower()

    async def test_import_validation_errors(self, agent_file_manager, other_user):
        """Test import validation catches errors."""
        # Create invalid agent file with duplicate IDs
        invalid_agent_file = AgentFileSchema(
            agents=[
                AgentSchema(id="agent-0", name="agent1"),
                AgentSchema(id="agent-0", name="agent2"),  # Duplicate ID
            ],
            groups=[],
            blocks=[],
            files=[],
            sources=[],
            tools=[],
        )

        # Import should fail validation
        with pytest.raises(AgentFileImportError):
            await agent_file_manager.import_file(invalid_agent_file, other_user)


class TestAgentFileRoundTrip:
    """Tests for complete export -> import -> export cycles."""

    async def test_roundtrip_consistency(self, server, agent_file_manager, test_agent, default_user, other_user):
        """Test that export -> import -> export produces consistent results."""
        # First export
        original_export = await agent_file_manager.export([test_agent.id], default_user)

        # Import
        result = await agent_file_manager.import_file(original_export, other_user)

        # Get imported agent ID
        imported_agent_id = next(db_id for file_id, db_id in result.id_mappings.items() if file_id == "agent-0")

        # Second export
        second_export = await agent_file_manager.export([imported_agent_id], other_user)

        # Compare exports (should be logically equivalent)
        assert compare_agent_files(original_export, second_export)

    async def test_multiple_roundtrips(self, server, agent_file_manager, test_agent, default_user, other_user):
        """Test multiple rounds of export/import maintain consistency."""
        current_agent_id = test_agent.id
        current_user = default_user

        for i in range(3):
            # Export
            agent_file = await agent_file_manager.export([current_agent_id], current_user)

            # Import to other user
            target_user = other_user if current_user == default_user else default_user
            result = await agent_file_manager.import_file(agent_file, target_user)

            # Update for next iteration
            current_agent_id = next(db_id for file_id, db_id in result.id_mappings.items() if file_id == "agent-0")
            current_user = target_user

            # Verify the agent still works
            imported_agent = server.agent_manager.get_agent_by_id(current_agent_id, current_user)
            assert imported_agent.name == test_agent.name


class TestAgentFileEdgeCases:
    """Tests for edge cases and error conditions."""

    async def test_agent_with_no_messages(self, server, agent_file_manager, default_user, other_user):
        """Test exporting/importing agent with no messages."""
        # Create agent with no initial messages
        create_agent_request = CreateAgent(
            name="no_messages_agent",
            system="Agent with no messages",
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            initial_message_sequence=[],
        )

        agent_state = await server.agent_manager.create_agent_async(
            agent_create=create_agent_request,
            actor=default_user,
            _init_with_no_messages=True,  # Create with truly no messages
        )

        # Export
        agent_file = await agent_file_manager.export([agent_state.id], default_user)

        # Import
        result = await agent_file_manager.import_file(agent_file, other_user)

        # Verify
        assert result.success
        imported_agent_id = next(db_id for file_id, db_id in result.id_mappings.items() if file_id == "agent-0")
        imported_agent = server.agent_manager.get_agent_by_id(imported_agent_id, other_user)

        assert len(imported_agent.message_ids) == 0

    async def test_large_agent_file(self, server, agent_file_manager, default_user, other_user, weather_tool):
        """Test handling of larger agent files with many messages."""
        # Create agent
        create_agent_request = CreateAgent(
            name="large_agent",
            system="Agent with many messages",
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            tool_ids=[weather_tool.id],
        )

        agent_state = server.agent_manager.create_agent(
            agent_create=create_agent_request,
            actor=default_user,
        )

        # Add many messages
        for i in range(10):
            server.send_messages(
                actor=default_user,
                agent_id=agent_state.id,
                input_messages=[MessageCreate(role=MessageRole.user, content=f"Message {i}")],
            )

        # Export
        agent_file = await agent_file_manager.export([agent_state.id], default_user)

        # Verify large file
        exported_agent = agent_file.agents[0]
        assert len(exported_agent.messages) >= 10

        # Import
        result = await agent_file_manager.import_file(agent_file, other_user)

        # Verify all messages imported correctly
        assert result.success
        imported_agent_id = next(db_id for file_id, db_id in result.id_mappings.items() if file_id == "agent-0")
        imported_messages = server.message_manager.list_messages_for_agent(imported_agent_id, other_user)

        assert len(imported_messages) >= 10


class TestAgentFileValidation:
    """Tests for agent file validation and schema compliance."""

    def test_agent_file_schema_validation(self, test_agent):
        """Test AgentFileSchema validation."""
        # Valid schema
        valid_schema = AgentFileSchema(
            agents=[AgentSchema(id="agent-0", name="test")],
            groups=[],
            blocks=[],
            files=[],
            sources=[],
            tools=[],
            # mcp_servers=[],
        )

        # Should not raise
        assert valid_schema.agents[0].id == "agent-0"

    def test_message_schema_conversion(self, test_agent, server, default_user):
        """Test MessageSchema.from_message conversion."""
        # Get a message from the test agent
        messages = server.message_manager.list_messages_for_agent(test_agent.id, default_user)
        if messages:
            original_message = messages[0]

            # Convert to MessageSchema
            message_schema = MessageSchema.from_message(original_message)

            # Verify conversion
            assert message_schema.role == original_message.role
            assert message_schema.content == original_message.content
            assert message_schema.model == original_message.model
            assert message_schema.agent_id == original_message.agent_id

    def test_id_format_validation(self):
        """Test ID format validation helper."""
        # Valid schema
        valid_schema = AgentFileSchema(
            agents=[AgentSchema(id="agent-0", name="test")],
            groups=[],
            blocks=[BlockSchema(id="block-0", label="test", value="test")],
            files=[],
            sources=[],
            tools=[
                ToolSchema(
                    id="tool-0",
                    name="test_tool",
                    source_code="test",
                    json_schema={"name": "test_tool", "parameters": {"type": "object", "properties": {}}},
                )
            ],
            # mcp_servers=[],
        )

        assert validate_id_format(valid_schema)

        # Invalid schema
        invalid_schema = AgentFileSchema(
            agents=[AgentSchema(id="invalid-id-format", name="test")],
            groups=[],
            blocks=[],
            files=[],
            sources=[],
            tools=[],
            # mcp_servers=[],
        )

        assert not validate_id_format(invalid_schema)


if __name__ == "__main__":
    pytest.main([__file__])
