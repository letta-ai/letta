from typing import List, Optional

import pytest

from letta.agents.agent_loop import AgentLoop
from letta.config import LettaConfig
from letta.errors import AgentFileExportError, AgentFileImportError
from letta.orm import Base
from letta.schemas.agent import AgentType, CreateAgent
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
from letta.schemas.group import ManagerType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import MessageCreate
from letta.schemas.organization import Organization
from letta.schemas.run import Run
from letta.schemas.source import Source
from letta.schemas.user import User
from letta.server.server import SyncServer
from letta.services.agent_serialization_manager import AgentSerializationManager
from tests.utils import create_tool_from_func

# ------------------------------
# Fixtures
# ------------------------------


#
async def _clear_tables():
    from letta.server.db import db_registry

    async with db_registry.async_session() as session:
        for table in reversed(Base.metadata.sorted_tables):  # Reverse to avoid FK issues
            await session.execute(table.delete())  # Truncate table
        await session.commit()


@pytest.fixture(autouse=True)
async def clear_tables():
    await _clear_tables()


@pytest.fixture
async def server():
    config = LettaConfig.load()
    config.save()
    server = SyncServer(init_with_default_org_and_user=True)
    await server.init_async()
    await server.tool_manager.upsert_base_tools_async(actor=server.default_user)

    yield server


@pytest.fixture
async def default_organization(server: SyncServer):
    """Fixture to create and return the default organization."""
    org = await server.organization_manager.create_default_organization_async()
    yield org


@pytest.fixture
async def default_user(server: SyncServer, default_organization):
    """Fixture to create and return the default user within the default organization."""
    user = await server.user_manager.create_default_actor_async(org_id=default_organization.id)
    yield user


@pytest.fixture
async def other_organization(server: SyncServer):
    """Fixture to create and return another organization."""
    org = await server.organization_manager.create_organization_async(pydantic_org=Organization(name="test_org"))
    yield org


@pytest.fixture
async def other_user(server: SyncServer, other_organization):
    """Fixture to create and return another user within the other organization."""
    user = await server.user_manager.create_actor_async(pydantic_user=User(organization_id=other_organization.id, name="test_user"))
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
async def weather_tool(server, weather_tool_func, default_user):
    weather_tool = await server.tool_manager.create_or_update_tool_async(create_tool_from_func(func=weather_tool_func), actor=default_user)
    yield weather_tool


@pytest.fixture
async def print_tool(server, print_tool_func, default_user):
    print_tool = await server.tool_manager.create_or_update_tool_async(create_tool_from_func(func=print_tool_func), actor=default_user)
    yield print_tool


@pytest.fixture
async def test_block(server: SyncServer, default_user):
    """Fixture to create and return a test block."""
    block_data = Block(
        label="test_block",
        value="Test Block Content",
        description="A test block for agent file tests",
        limit=1000,
        metadata={"type": "test", "category": "demo"},
    )
    block = await server.block_manager.create_or_update_block_async(block_data, actor=default_user)
    yield block


@pytest.fixture
def agent_serialization_manager(server, default_user):
    """Fixture to create AgentSerializationManager with all required services including file processing."""
    manager = AgentSerializationManager(
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


async def send_message_to_agent(server: SyncServer, agent_state, actor: User, messages: list[MessageCreate]):
    run = Run(
        agent_id=agent_state.id,
    )
    run = await server.run_manager.create_run(
        pydantic_run=run,
        actor=actor,
    )

    agent_loop = AgentLoop.load(agent_state=agent_state, actor=actor)
    result = await agent_loop.step(
        run_id=run.id,
        input_messages=messages,
    )
    return result


@pytest.fixture
async def test_agent(server: SyncServer, default_user, default_organization, test_block, weather_tool):
    """Fixture to create and return a test agent with messages."""
    memory_blocks = [
        CreateBlock(label="human", value="User is a test user"),
        CreateBlock(label="persona", value="I am a helpful test assistant"),
    ]

    create_agent_request = CreateAgent(
        name="test_agent_v2",
        agent_type=AgentType.letta_v1_agent,
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

    agent_state = await server.agent_manager.create_agent_async(
        agent_create=create_agent_request,
        actor=default_user,
    )

    await send_message_to_agent(
        server, agent_state, default_user, [MessageCreate(role=MessageRole.user, content="What's the weather like?")]
    )

    agent_state = await server.agent_manager.get_agent_by_id_async(agent_id=agent_state.id, actor=default_user)
    yield agent_state


@pytest.fixture(scope="function")
def embedding_handle_override():
    current_handle = EmbeddingConfig.default_config(provider="openai").handle
    assert current_handle != "letta/letta-free"  # make sure its different
    return "letta/letta-free"


@pytest.fixture(scope="function")
async def test_source(server: SyncServer, default_user):
    """Fixture to create and return a test source."""
    source_data = Source(
        name="test_source",
        description="Test source for file export tests",
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
    )
    source = await server.source_manager.create_source(source_data, default_user)
    yield source


@pytest.fixture(scope="function")
async def test_file(server: SyncServer, default_user, test_source):
    """Fixture to create and return a test file attached to test_source."""
    from letta.schemas.file import FileMetadata

    file_data = FileMetadata(
        source_id=test_source.id,
        file_name="test.txt",
        original_file_name="test.txt",
        file_type="text/plain",
        file_size=46,
    )
    file_metadata = await server.file_manager.create_file(file_data, default_user, text="This is a test file for export testing.")
    yield file_metadata


@pytest.fixture(scope="function")
async def agent_with_files(server: SyncServer, default_user, test_block, weather_tool, test_source, test_file):
    """Fixture to create and return an agent with attached files."""
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
        source_ids=[test_source.id],
    )

    agent_state = await server.agent_manager.create_agent_async(
        agent_create=create_agent_request,
        actor=default_user,
    )

    await server.agent_manager.insert_files_into_context_window(
        agent_state=agent_state, file_metadata_with_content=[test_file], actor=default_user
    )

    return (agent_state.id, test_source.id, test_file.id)


@pytest.fixture(scope="function")
async def test_mcp_server(server: SyncServer, default_user):
    """Fixture to create and return a test MCP server."""
    from letta.schemas.mcp import MCPServer, MCPServerType

    mcp_server_data = MCPServer(
        server_name="test_mcp_server",
        server_type=MCPServerType.SSE,
        server_url="http://test-mcp-server.com",
        token="test-token-12345",  # This should be excluded during export
        custom_headers={"X-API-Key": "secret-key"},  # This should be excluded during export
    )
    mcp_server = await server.mcp_manager.create_or_update_mcp_server(mcp_server_data, default_user)
    yield mcp_server


@pytest.fixture(scope="function")
async def mcp_tool(server: SyncServer, default_user, test_mcp_server):
    """Fixture to create and return an MCP tool."""
    from letta.schemas.tool import MCPTool, ToolCreate

    # Create a mock MCP tool
    mcp_tool_data = MCPTool(
        name="test_mcp_tool",
        description="Test MCP tool for serialization",
        inputSchema={"type": "object", "properties": {"input": {"type": "string"}}},
    )
    tool_create = ToolCreate.from_mcp(test_mcp_server.server_name, mcp_tool_data)

    # Create tool with MCP metadata
    mcp_tool = await server.tool_manager.create_mcp_tool_async(tool_create, test_mcp_server.server_name, test_mcp_server.id, default_user)
    yield mcp_tool


@pytest.fixture(scope="function")
async def agent_with_mcp_tools(server: SyncServer, default_user, test_block, mcp_tool, test_mcp_server):
    """Fixture to create and return an agent with MCP tools."""
    memory_blocks = [
        CreateBlock(label="human", value="User is a test user"),
        CreateBlock(label="persona", value="I am a helpful test assistant"),
    ]

    create_agent_request = CreateAgent(
        name="test_agent_mcp",
        system="You are a helpful assistant with MCP tools.",
        memory_blocks=memory_blocks,
        llm_config=LLMConfig.default_config("gpt-4o-mini"),
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
        block_ids=[test_block.id],
        tool_ids=[mcp_tool.id],
        tags=["test", "mcp", "export"],
        description="Test agent with MCP tools for serialization testing",
    )

    agent_state = await server.agent_manager.create_agent_async(
        agent_create=create_agent_request,
        actor=default_user,
    )

    return agent_state


# ------------------------------
# Helper Functions
# ------------------------------


async def create_test_source(server: SyncServer, name: str, user: User):
    """Helper function to create a test source using server."""
    source_data = Source(
        name=name,
        description=f"Test source {name}",
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
    )
    return await server.source_manager.create_source(source_data, user)


async def create_test_file(server: SyncServer, filename: str, source_id: str, user: User, content: Optional[str] = None):
    """Helper function to create a test file using server."""
    from letta.schemas.file import FileMetadata

    content = content or f"Content of {filename}"
    file_data = FileMetadata(
        source_id=source_id,
        file_name=filename,
        original_file_name=filename,
        file_type="text/plain",
        file_size=len(content),
    )
    return await server.file_manager.create_file(file_data, user, text=content)


async def create_test_agent_with_files(server: SyncServer, name: str, user: User, file_relationships: List[tuple]):
    """Helper function to create agent with attached files using server.

    Args:
        server: SyncServer instance
        name: Agent name
        user: User creating the agent
        file_relationships: List of (source_id, file_id) tuples
    """
    memory_blocks = [
        CreateBlock(label="human", value="User is a test user"),
        CreateBlock(label="persona", value="I am a helpful test assistant"),
    ]

    create_agent_request = CreateAgent(
        name=name,
        system="You are a helpful assistant for testing file export.",
        memory_blocks=memory_blocks,
        llm_config=LLMConfig.default_config("gpt-4o-mini"),
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
        tags=["test", "files"],
        description="Test agent with files",
    )

    agent_state = await server.agent_manager.create_agent_async(
        agent_create=create_agent_request,
        actor=user,
    )

    for source_id, file_id in file_relationships:
        file_metadata = await server.file_manager.get_file_by_id(file_id, user)
        await server.agent_manager.insert_files_into_context_window(
            agent_state=agent_state, file_metadata_with_content=[file_metadata], actor=user
        )

    return agent_state


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

    if sorted(orig.tags or []) != sorted(imp.tags or []):
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
    if orig.secrets != imp.secrets:
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

    if sorted(orig.tags or []) != sorted(imp.tags or []):
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

    orig_agent_ids = sorted(orig.agent_ids)
    imp_agent_ids = sorted(imp.agent_ids)
    if orig_agent_ids != imp_agent_ids:
        errors.append(f"Group {index}: agent_ids mismatch: '{orig_agent_ids}' vs '{imp_agent_ids}'")

    if orig.description != imp.description:
        errors.append(f"Group {index}: description mismatch")

    if orig.manager_config != imp.manager_config:
        errors.append(f"Group {index}: manager config mismatch")

    orig_shared_block_ids = sorted(orig.shared_block_ids)
    imp_shared_block_ids = sorted(imp.shared_block_ids)
    if orig_shared_block_ids != imp_shared_block_ids:
        errors.append(f"Group {index}: metadata mismatch")

    return errors


def _compare_files(orig: FileSchema, imp: FileSchema, index: int) -> List[str]:
    """Compare two FileSchema objects for logical equivalence."""
    errors = []

    if orig.file_name != imp.file_name:
        errors.append(f"File {index}: file_name mismatch: '{orig.file_name}' vs '{imp.file_name}'")

    if orig.original_file_name != imp.original_file_name:
        errors.append(f"File {index}: original_file_name mismatch: '{orig.original_file_name}' vs '{imp.original_file_name}'")

    if orig.file_size != imp.file_size:
        errors.append(f"File {index}: file_size mismatch: {orig.file_size} vs {imp.file_size}")

    if orig.file_type != imp.file_type:
        errors.append(f"File {index}: file_type mismatch: '{orig.file_type}' vs '{imp.file_type}'")

    if orig.processing_status != imp.processing_status:
        errors.append(f"File {index}: processing_status mismatch: '{orig.processing_status}' vs '{imp.processing_status}'")

    if orig.metadata != imp.metadata:
        errors.append(f"File {index}: metadata mismatch")

    # Check source_id reference format (should be remapped)
    if not imp.source_id.startswith("source-"):
        errors.append(f"File {index}: source_id not properly remapped: {imp.source_id}")

    return errors


def _compare_sources(orig: SourceSchema, imp: SourceSchema, index: int) -> List[str]:
    """Compare two SourceSchema objects for logical equivalence."""
    errors = []

    if orig.name != imp.name:
        errors.append(f"Source {index}: name mismatch: '{orig.name}' vs '{imp.name}'")

    if orig.description != imp.description:
        errors.append(f"Source {index}: description mismatch")

    if orig.instructions != imp.instructions:
        errors.append(f"Source {index}: instructions mismatch")

    if orig.metadata != imp.metadata:
        errors.append(f"Source {index}: metadata mismatch")

    if orig.embedding_config != imp.embedding_config:
        errors.append(f"Source {index}: embedding_config mismatch")

    return errors


def _validate_entity_id(entity_id: str, expected_prefix: str) -> bool:
    """Helper function to validate that an ID follows the expected format (prefix-N)."""
    if not entity_id.startswith(f"{expected_prefix}-"):
        print(f"Invalid {expected_prefix} ID format: {entity_id} should start with '{expected_prefix}-'")
        return False

    try:
        suffix = entity_id[len(expected_prefix) + 1 :]
        int(suffix)
        return True
    except ValueError:
        print(f"Invalid {expected_prefix} ID format: {entity_id} should have integer suffix")
        return False


def validate_id_format(schema: AgentFileSchema) -> bool:
    """Validate that all IDs follow the expected format (entity-N)."""
    for agent in schema.agents:
        if not _validate_entity_id(agent.id, "agent"):
            return False

        for message in agent.messages:
            if not _validate_entity_id(message.id, "message"):
                return False

        for msg_id in agent.in_context_message_ids:
            if not _validate_entity_id(msg_id, "message"):
                return False

    for tool in schema.tools:
        if not _validate_entity_id(tool.id, "tool"):
            return False

    for block in schema.blocks:
        if not _validate_entity_id(block.id, "block"):
            return False

    for file in schema.files:
        if not _validate_entity_id(file.id, "file"):
            return False

    for source in schema.sources:
        if not _validate_entity_id(source.id, "source"):
            return False

    return True


# ------------------------------
# Tests
# ------------------------------


class TestFileExport:
    """Test file export functionality with comprehensive validation"""

    @pytest.mark.asyncio
    async def test_basic_file_export(self, default_user, agent_serialization_manager, agent_with_files):
        """Test basic file export functionality"""
        agent_id, source_id, file_id = agent_with_files

        exported = await agent_serialization_manager.export([agent_id], actor=default_user)

        assert len(exported.agents) == 1
        assert len(exported.sources) == 1
        assert len(exported.files) == 1

        agent = exported.agents[0]
        assert len(agent.files_agents) == 1

        assert _validate_entity_id(agent.id, "agent")
        assert _validate_entity_id(exported.sources[0].id, "source")
        assert _validate_entity_id(exported.files[0].id, "file")

        file_agent = agent.files_agents[0]
        assert file_agent.agent_id == agent.id
        assert file_agent.file_id == exported.files[0].id
        assert file_agent.source_id == exported.sources[0].id

    @pytest.mark.asyncio
    async def test_multiple_files_per_source(self, server, default_user, agent_serialization_manager):
        """Test export with multiple files from the same source"""
        source = await create_test_source(server, "multi-file-source", default_user)
        file1 = await create_test_file(server, "file1.txt", source.id, default_user)
        file2 = await create_test_file(server, "file2.txt", source.id, default_user)

        agent = await create_test_agent_with_files(server, "multi-file-agent", default_user, [(source.id, file1.id), (source.id, file2.id)])

        exported = await agent_serialization_manager.export([agent.id], actor=default_user)

        assert len(exported.agents) == 1
        assert len(exported.sources) == 1
        assert len(exported.files) == 2

        agent = exported.agents[0]
        assert len(agent.files_agents) == 2

        source_id = exported.sources[0].id
        for file_schema in exported.files:
            assert file_schema.source_id == source_id

        file_ids = {f.id for f in exported.files}
        for file_agent in agent.files_agents:
            assert file_agent.file_id in file_ids
            assert file_agent.source_id == source_id

    @pytest.mark.asyncio
    async def test_multiple_sources_export(self, server, default_user, agent_serialization_manager):
        """Test export with files from multiple sources"""
        source1 = await create_test_source(server, "source-1", default_user)
        source2 = await create_test_source(server, "source-2", default_user)
        file1 = await create_test_file(server, "file1.txt", source1.id, default_user)
        file2 = await create_test_file(server, "file2.txt", source2.id, default_user)

        agent = await create_test_agent_with_files(
            server, "multi-source-agent", default_user, [(source1.id, file1.id), (source2.id, file2.id)]
        )

        exported = await agent_serialization_manager.export([agent.id], actor=default_user)

        assert len(exported.agents) == 1
        assert len(exported.sources) == 2
        assert len(exported.files) == 2

        source_ids = {s.id for s in exported.sources}
        for file_schema in exported.files:
            assert file_schema.source_id in source_ids

    @pytest.mark.asyncio
    async def test_cross_agent_file_deduplication(self, server, default_user, agent_serialization_manager):
        """Test that files shared across agents are deduplicated in export"""
        source = await create_test_source(server, "shared-source", default_user)
        shared_file = await create_test_file(server, "shared.txt", source.id, default_user)

        agent1 = await create_test_agent_with_files(server, "agent-1", default_user, [(source.id, shared_file.id)])
        agent2 = await create_test_agent_with_files(server, "agent-2", default_user, [(source.id, shared_file.id)])

        exported = await agent_serialization_manager.export([agent1.id, agent2.id], actor=default_user)

        assert len(exported.agents) == 2
        assert len(exported.sources) == 1
        assert len(exported.files) == 1

        file_id = exported.files[0].id
        source_id = exported.sources[0].id

        for agent in exported.agents:
            assert len(agent.files_agents) == 1
            file_agent = agent.files_agents[0]
            assert file_agent.file_id == file_id
            assert file_agent.source_id == source_id

    @pytest.mark.asyncio
    async def test_file_agent_relationship_preservation(self, server, default_user, agent_serialization_manager):
        """Test that file-agent relationship details are preserved"""
        source = await create_test_source(server, "test-source", default_user)
        file = await create_test_file(server, "test.txt", source.id, default_user)

        agent = await create_test_agent_with_files(server, "test-agent", default_user, [(source.id, file.id)])

        exported = await agent_serialization_manager.export([agent.id], actor=default_user)

        agent = exported.agents[0]
        file_agent = agent.files_agents[0]

        assert file_agent.file_name == file.file_name
        assert file_agent.is_open is True
        assert hasattr(file_agent, "last_accessed_at")

    @pytest.mark.asyncio
    async def test_id_remapping_consistency(self, server, default_user, agent_serialization_manager):
        """Test that ID remapping is consistent across all references"""
        source = await create_test_source(server, "consistency-source", default_user)
        file = await create_test_file(server, "consistency.txt", source.id, default_user)
        agent = await create_test_agent_with_files(server, "consistency-agent", default_user, [(source.id, file.id)])

        exported = await agent_serialization_manager.export([agent.id], actor=default_user)

        agent_schema = exported.agents[0]
        source_schema = exported.sources[0]
        file_schema = exported.files[0]
        file_agent = agent_schema.files_agents[0]

        assert file_schema.source_id == source_schema.id
        assert file_agent.agent_id == agent_schema.id
        assert file_agent.file_id == file_schema.id
        assert file_agent.source_id == source_schema.id

    @pytest.mark.asyncio
    async def test_empty_file_relationships(self, server, default_user, agent_serialization_manager):
        """Test export of agent with no file relationships"""
        agent_create = CreateAgent(
            name="no-files-agent",
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
        )
        agent = await server.agent_manager.create_agent_async(agent_create, actor=default_user)

        exported = await agent_serialization_manager.export([agent.id], actor=default_user)

        assert len(exported.agents) == 1
        assert len(exported.sources) == 0
        assert len(exported.files) == 0

        agent_schema = exported.agents[0]
        assert len(agent_schema.files_agents) == 0

    @pytest.mark.asyncio
    async def test_file_content_inclusion_in_export(self, default_user, agent_serialization_manager, agent_with_files):
        """Test that file content is included in export"""
        agent_id, source_id, file_id = agent_with_files

        exported = await agent_serialization_manager.export([agent_id], actor=default_user)

        file_schema = exported.files[0]
        assert hasattr(file_schema, "content") or file_schema.content is not None


class TestAgentFileExport:
    """Tests for agent file export functionality."""

    async def test_basic_export(self, agent_serialization_manager, test_agent, default_user):
        """Test basic agent export functionality."""
        agent_file = await agent_serialization_manager.export([test_agent.id], default_user)

        assert isinstance(agent_file, AgentFileSchema)
        assert len(agent_file.agents) == 1
        assert len(agent_file.tools) > 0  # Should include base tools + weather tool
        assert len(agent_file.blocks) > 0  # Should include memory blocks + test block

        assert agent_file.metadata.get("revision_id") is not None
        assert agent_file.metadata.get("revision_id") != "unknown"
        assert len(agent_file.metadata.get("revision_id")) > 0

        assert validate_id_format(agent_file)

        exported_agent = agent_file.agents[0]
        assert exported_agent.name == test_agent.name
        assert exported_agent.system == test_agent.system
        assert len(exported_agent.messages) > 0
        assert len(exported_agent.in_context_message_ids) > 0

    async def test_export_multiple_agents(self, server, agent_serialization_manager, test_agent, default_user, weather_tool):
        """Test exporting multiple agents."""
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

        second_agent = await server.agent_manager.create_agent_async(
            agent_create=create_agent_request,
            actor=default_user,
        )

        agent_file = await agent_serialization_manager.export([test_agent.id, second_agent.id], default_user)

        assert len(agent_file.agents) == 2
        assert validate_id_format(agent_file)

        agent_ids = {agent.id for agent in agent_file.agents}
        assert len(agent_ids) == 2

    async def test_export_id_remapping(self, agent_serialization_manager, test_agent, default_user):
        """Test that IDs are properly remapped during export."""
        agent_file = await agent_serialization_manager.export([test_agent.id], default_user)

        exported_agent = agent_file.agents[0]

        assert exported_agent.id == "agent-0"
        assert exported_agent.id != test_agent.id

        if exported_agent.tool_ids:
            for tool_id in exported_agent.tool_ids:
                assert tool_id.startswith("tool-")

        if exported_agent.block_ids:
            for block_id in exported_agent.block_ids:
                assert block_id.startswith("block-")

        message_ids = {msg.id for msg in exported_agent.messages}
        for in_context_id in exported_agent.in_context_message_ids:
            assert in_context_id in message_ids, f"In-context message ID {in_context_id} not found in messages"

    async def test_message_agent_id_remapping(self, agent_serialization_manager, test_agent, default_user):
        """Test that message.agent_id is properly remapped during export."""
        agent_file = await agent_serialization_manager.export([test_agent.id], default_user)

        exported_agent = agent_file.agents[0]

        for message in exported_agent.messages:
            assert message.agent_id == exported_agent.id, (
                f"Message {message.id} has agent_id {message.agent_id}, expected {exported_agent.id}"
            )

        assert exported_agent.id == "agent-0"
        assert exported_agent.id != test_agent.id

    async def test_export_empty_agent_list(self, agent_serialization_manager, default_user):
        """Test exporting empty agent list."""
        agent_file = await agent_serialization_manager.export([], default_user)

        assert len(agent_file.agents) == 0
        assert len(agent_file.tools) == 0
        assert len(agent_file.blocks) == 0

    async def test_export_nonexistent_agent(self, agent_serialization_manager, default_user):
        """Test exporting non-existent agent raises error."""
        with pytest.raises(AgentFileExportError):  # Should raise AgentFileExportError for non-existent agent
            await agent_serialization_manager.export(["non-existent-id"], default_user)

    @pytest.mark.asyncio
    async def test_revision_id_automatic_setting(self, agent_serialization_manager, test_agent, default_user):
        """Test that revision_id is automatically set to the latest alembic revision."""
        agent_file = await agent_serialization_manager.export([test_agent.id], default_user)

        from letta.utils import get_latest_alembic_revision

        expected_revision = await get_latest_alembic_revision()

        assert agent_file.metadata.get("revision_id") == expected_revision

        assert agent_file.metadata.get("revision_id") != "unknown"

        assert len(agent_file.metadata.get("revision_id")) == 12
        assert all(c in "0123456789abcdef" for c in agent_file.metadata.get("revision_id"))

    async def test_export_sleeptime_enabled_agent(self, server, agent_serialization_manager, default_user, weather_tool):
        """Test exporting sleeptime enabled agent."""
        create_agent_request = CreateAgent(
            name="sleeptime-enabled-test-agent",
            system="Sleeptime enabled test agent",
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            tool_ids=[weather_tool.id],
            initial_message_sequence=[
                MessageCreate(role=MessageRole.user, content="Second agent message"),
            ],
            enable_sleeptime=True,
        )

        sleeptime_enabled_agent = await server.create_agent_async(
            request=create_agent_request,
            actor=default_user,
        )

        agent_file = await agent_serialization_manager.export([sleeptime_enabled_agent.id], default_user)

        assert sleeptime_enabled_agent.multi_agent_group != None
        assert len(agent_file.agents) == 2
        assert validate_id_format(agent_file)

        agent_ids = {agent.id for agent in agent_file.agents}
        assert len(agent_ids) == 2

        assert len(agent_file.groups) == 1
        sleeptime_group = agent_file.groups[0]
        assert len(sleeptime_group.agent_ids) == 1
        assert sleeptime_group.agent_ids[0] in agent_ids
        assert sleeptime_group.manager_config.manager_type == ManagerType.sleeptime
        assert sleeptime_group.manager_config.manager_agent_id in agent_ids

        await server.agent_manager.delete_agent_async(agent_id=sleeptime_enabled_agent.id, actor=default_user)

    async def test_tool_exec_environment_variables_scrubbing(self, server, agent_serialization_manager, default_user, weather_tool):
        """Test that tool_exec_environment_variables values are scrubbed during export."""
        # create agent with environment variables containing secrets
        create_agent_request = CreateAgent(
            name="agent_with_env_vars",
            system="Agent with environment variables",
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            tool_ids=[weather_tool.id],
            tool_exec_environment_variables={
                "API_KEY": "super-secret-api-key-12345",
                "DATABASE_PASSWORD": "ultra-secure-password",
                "TOKEN": "bearer-token-xyz789",
            },
            initial_message_sequence=[
                MessageCreate(role=MessageRole.user, content="Test environment variables"),
            ],
        )

        agent_with_env_vars = await server.agent_manager.create_agent_async(
            agent_create=create_agent_request,
            actor=default_user,
        )

        # export the agent
        agent_file = await agent_serialization_manager.export([agent_with_env_vars.id], default_user)

        # verify agent was exported
        assert len(agent_file.agents) == 1
        exported_agent = agent_file.agents[0]

        # verify environment variables exist but values are scrubbed (empty strings)
        assert exported_agent.secrets is not None
        assert len(exported_agent.secrets) == 3
        assert "API_KEY" in exported_agent.secrets
        assert "DATABASE_PASSWORD" in exported_agent.secrets
        assert "TOKEN" in exported_agent.secrets

        # most importantly: verify all secret values have been wiped
        assert exported_agent.secrets["API_KEY"] == ""
        assert exported_agent.secrets["DATABASE_PASSWORD"] == ""
        assert exported_agent.secrets["TOKEN"] == ""

        # verify no secret values appear anywhere in the exported data
        assert "super-secret-api-key-12345" not in str(agent_file)
        assert "ultra-secure-password" not in str(agent_file)
        assert "bearer-token-xyz789" not in str(agent_file)

        # clean up
        await server.agent_manager.delete_agent_async(agent_id=agent_with_env_vars.id, actor=default_user)


class TestAgentFileImport:
    """Tests for agent file import functionality."""

    async def test_basic_import(self, agent_serialization_manager, test_agent, default_user, other_user):
        """Test basic agent import functionality."""
        agent_file = await agent_serialization_manager.export([test_agent.id], default_user)

        result = await agent_serialization_manager.import_file(agent_file, other_user)

        assert result.success
        assert result.imported_count > 0
        assert len(result.id_mappings) > 0

        for file_id, db_id in result.id_mappings.items():
            if file_id.startswith("agent-"):
                assert db_id != test_agent.id  # New agent should have different ID

    async def test_basic_import_with_embedding_override(
        self, server, agent_serialization_manager, test_agent, default_user, other_user, embedding_handle_override
    ):
        """Test basic agent import functionality with embedding override."""
        agent_file = await agent_serialization_manager.export([test_agent.id], default_user)

        embedding_config_override = await server.get_embedding_config_from_handle_async(actor=other_user, handle=embedding_handle_override)
        result = await agent_serialization_manager.import_file(agent_file, other_user, override_embedding_config=embedding_config_override)

        assert result.success
        assert result.imported_count > 0
        assert len(result.id_mappings) > 0

        for file_id, db_id in result.id_mappings.items():
            if file_id.startswith("agent-"):
                assert db_id != test_agent.id  # New agent should have different ID

        # check embedding handle
        imported_agent_id = next(db_id for file_id, db_id in result.id_mappings.items() if file_id == "agent-0")
        imported_agent = await server.agent_manager.get_agent_by_id_async(imported_agent_id, other_user)
        assert imported_agent.embedding_config.handle == embedding_handle_override

    async def test_import_preserves_data(self, server, agent_serialization_manager, test_agent, default_user, other_user):
        """Test that import preserves all important data."""
        agent_file = await agent_serialization_manager.export([test_agent.id], default_user)

        result = await agent_serialization_manager.import_file(agent_file, other_user)

        imported_agent_id = next(db_id for file_id, db_id in result.id_mappings.items() if file_id == "agent-0")
        imported_agent = await server.agent_manager.get_agent_by_id_async(imported_agent_id, other_user)

        assert imported_agent.name == test_agent.name
        assert imported_agent.system == test_agent.system
        assert imported_agent.description == test_agent.description
        assert imported_agent.metadata == test_agent.metadata
        assert imported_agent.tags == test_agent.tags

        assert len(imported_agent.tools) == len(test_agent.tools)
        assert len(imported_agent.memory.blocks) == len(test_agent.memory.blocks)

        original_messages = await server.message_manager.list_messages(actor=default_user, agent_id=test_agent.id)
        imported_messages = await server.message_manager.list_messages(actor=other_user, agent_id=imported_agent_id)

        assert len(imported_messages) == len(original_messages)

        for orig_msg, imp_msg in zip(original_messages, imported_messages):
            assert orig_msg.role == imp_msg.role
            assert orig_msg.content == imp_msg.content
            assert imp_msg.agent_id == imported_agent_id  # Should be remapped to new agent

    async def test_import_message_context_preservation(self, server, agent_serialization_manager, test_agent, default_user, other_user):
        """Test that in-context message references are preserved during import."""
        agent_file = await agent_serialization_manager.export([test_agent.id], default_user)

        result = await agent_serialization_manager.import_file(agent_file, other_user)

        imported_agent_id = next(db_id for file_id, db_id in result.id_mappings.items() if file_id == "agent-0")
        imported_agent = await server.agent_manager.get_agent_by_id_async(imported_agent_id, other_user)

        assert len(imported_agent.message_ids) == len(test_agent.message_ids)

        imported_messages = await server.message_manager.list_messages(actor=other_user, agent_id=imported_agent_id)
        imported_message_ids = {msg.id for msg in imported_messages}

        for in_context_id in imported_agent.message_ids:
            assert in_context_id in imported_message_ids

    async def test_dry_run_import(self, agent_serialization_manager, test_agent, default_user, other_user):
        """Test dry run import validation."""
        agent_file = await agent_serialization_manager.export([test_agent.id], default_user)

        result = await agent_serialization_manager.import_file(agent_file, other_user, dry_run=True)

        assert result.success
        assert result.imported_count == 0  # No actual imports in dry run
        assert len(result.id_mappings) == 0
        assert "dry run" in result.message.lower()

    async def test_import_validation_errors(self, agent_serialization_manager, other_user):
        """Test import validation catches errors."""
        from letta.utils import get_latest_alembic_revision

        current_revision = await get_latest_alembic_revision()

        invalid_agent_file = AgentFileSchema(
            metadata={"revision_id": current_revision},
            agents=[
                AgentSchema(id="agent-0", name="agent1"),
                AgentSchema(id="agent-0", name="agent2"),  # Duplicate ID
            ],
            groups=[],
            blocks=[],
            files=[],
            sources=[],
            tools=[],
            mcp_servers=[],
        )

        with pytest.raises(AgentFileImportError):
            await agent_serialization_manager.import_file(invalid_agent_file, other_user)

    async def test_import_sleeptime_enabled_agent(self, server, agent_serialization_manager, default_user, other_user, weather_tool):
        """Test basic agent import functionality."""
        create_agent_request = CreateAgent(
            name="sleeptime-enabled-test-agent",
            system="Sleeptime enabled test agent",
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            tool_ids=[weather_tool.id],
            initial_message_sequence=[
                MessageCreate(role=MessageRole.user, content="Second agent message"),
            ],
            enable_sleeptime=True,
        )

        sleeptime_enabled_agent = await server.create_agent_async(
            request=create_agent_request,
            actor=default_user,
        )

        sleeptime_enabled_agent.multi_agent_group.id
        sleeptime_enabled_agent.multi_agent_group.agent_ids[0]

        agent_file = await agent_serialization_manager.export([sleeptime_enabled_agent.id], default_user)

        result = await agent_serialization_manager.import_file(agent_file, other_user)
        assert result.success
        assert result.imported_count > 0
        assert len(result.id_mappings) > 0

        exported_agent_ids = [file_id for file_id in list(result.id_mappings.values()) if file_id.startswith("agent-")]
        assert len(exported_agent_ids) == 2
        exported_group_ids = [file_id for file_id in list(result.id_mappings.keys()) if file_id.startswith("group-")]
        assert len(exported_group_ids) == 1

        await server.agent_manager.delete_agent_async(agent_id=sleeptime_enabled_agent.id, actor=default_user)

    async def test_import_with_environment_variables(self, server, agent_serialization_manager, default_user, other_user, weather_tool):
        """Test that environment variables can be provided during import."""
        # create agent with environment variables
        create_agent_request = CreateAgent(
            name="agent_with_env_vars_import_test",
            system="Agent with environment variables for import testing",
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            tool_ids=[weather_tool.id],
            tool_exec_environment_variables={
                "API_KEY": "original-api-key",
                "DATABASE_URL": "original-database-url",
                "SECRET_TOKEN": "original-secret-token",
            },
            initial_message_sequence=[
                MessageCreate(role=MessageRole.user, content="Test environment variables import"),
            ],
        )

        original_agent = await server.agent_manager.create_agent_async(
            agent_create=create_agent_request,
            actor=default_user,
        )

        # export the agent (values should be scrubbed)
        agent_file = await agent_serialization_manager.export([original_agent.id], default_user)

        # verify values are scrubbed in export
        exported_agent = agent_file.agents[0]
        assert exported_agent.secrets["API_KEY"] == ""
        assert exported_agent.secrets["DATABASE_URL"] == ""
        assert exported_agent.secrets["SECRET_TOKEN"] == ""

        # import with new environment variable values
        new_env_vars = {
            "API_KEY": "new-api-key-for-import",
            "DATABASE_URL": "new-database-url-for-import",
            "SECRET_TOKEN": "new-secret-token-for-import",
        }

        result = await agent_serialization_manager.import_file(agent_file, other_user, env_vars=new_env_vars)

        assert result.success
        assert len(result.imported_agent_ids) == 1

        # get the imported agent and verify environment variables were set correctly
        imported_agent_id = result.imported_agent_ids[0]
        imported_agent = await server.agent_manager.get_agent_by_id_async(
            agent_id=imported_agent_id, actor=other_user, include_relationships=["tool_exec_environment_variables"]
        )

        # verify the imported agent has the new environment variable values
        env_vars_dict = imported_agent.get_agent_env_vars_as_dict()
        assert env_vars_dict["API_KEY"] == "new-api-key-for-import"
        assert env_vars_dict["DATABASE_URL"] == "new-database-url-for-import"
        assert env_vars_dict["SECRET_TOKEN"] == "new-secret-token-for-import"

        # clean up
        await server.agent_manager.delete_agent_async(agent_id=original_agent.id, actor=default_user)
        await server.agent_manager.delete_agent_async(agent_id=imported_agent_id, actor=other_user)


class TestAgentFileImportWithProcessing:
    """Tests for agent file import with file processing (chunking/embedding)."""

    async def test_import_with_file_processing(self, server, agent_serialization_manager, default_user, other_user):
        """Test that import processes files for chunking and embedding."""
        source = await create_test_source(server, "processing-source", default_user)
        file_content = "This is test content for processing. It should be chunked and embedded during import."
        file_metadata = await create_test_file(server, "process.txt", source.id, default_user, content=file_content)

        agent = await create_test_agent_with_files(server, "processing-agent", default_user, [(source.id, file_metadata.id)])

        exported = await agent_serialization_manager.export([agent.id], default_user)

        result = await agent_serialization_manager.import_file(exported, other_user)

        assert result.success
        assert result.imported_count > 0

        imported_file_id = next(db_id for file_id, db_id in result.id_mappings.items() if file_id.startswith("file-"))

        imported_file = await server.file_manager.get_file_by_id(imported_file_id, other_user)
        # When using Pinecone, status stays at embedding until chunks are confirmed uploaded
        assert imported_file.processing_status.value in {"embedding", "completed"}

    async def test_import_passage_creation(self, server, agent_serialization_manager, default_user, other_user):
        """Test that import creates passages for file content."""
        source = await create_test_source(server, "passage-source", default_user)
        file_content = "This content should create passages. Each sentence should be chunked separately."
        file_metadata = await create_test_file(server, "passages.txt", source.id, default_user, content=file_content)

        agent = await create_test_agent_with_files(server, "passage-agent", default_user, [(source.id, file_metadata.id)])

        exported = await agent_serialization_manager.export([agent.id], default_user)

        result = await agent_serialization_manager.import_file(exported, other_user)

        imported_file_id = next(db_id for file_id, db_id in result.id_mappings.items() if file_id.startswith("file-"))

        await server.passage_manager.list_passages_by_file_id_async(imported_file_id, other_user)

    async def test_import_file_status_updates(self, server, agent_serialization_manager, default_user, other_user):
        """Test that file processing status is updated correctly during import."""
        source = await create_test_source(server, "status-source", default_user)
        file_metadata = await create_test_file(server, "status.txt", source.id, default_user)

        agent = await create_test_agent_with_files(server, "status-agent", default_user, [(source.id, file_metadata.id)])

        exported = await agent_serialization_manager.export([agent.id], default_user)

        result = await agent_serialization_manager.import_file(exported, other_user)

        imported_file_id = next(db_id for file_id, db_id in result.id_mappings.items() if file_id.startswith("file-"))
        imported_file = await server.file_manager.get_file_by_id(imported_file_id, other_user)

        # When using Pinecone, status stays at embedding until chunks are confirmed uploaded
        assert imported_file.processing_status.value in {"embedding", "completed"}

    async def test_import_multiple_files_processing(self, server, agent_serialization_manager, default_user, other_user):
        """Test import processes multiple files efficiently."""
        source = await create_test_source(server, "multi-source", default_user)
        file1 = await create_test_file(server, "file1.txt", source.id, default_user)
        file2 = await create_test_file(server, "file2.txt", source.id, default_user)

        agent = await create_test_agent_with_files(server, "multi-agent", default_user, [(source.id, file1.id), (source.id, file2.id)])

        exported = await agent_serialization_manager.export([agent.id], default_user)

        result = await agent_serialization_manager.import_file(exported, other_user)

        imported_file_ids = [db_id for file_id, db_id in result.id_mappings.items() if file_id.startswith("file-")]
        assert len(imported_file_ids) == 2

        for file_id in imported_file_ids:
            imported_file = await server.file_manager.get_file_by_id(file_id, other_user)
            # When using Pinecone, status stays at embedding until chunks are confirmed uploaded
            assert imported_file.processing_status.value in {"embedding", "completed"}


class TestAgentFileRoundTrip:
    """Tests for complete export -> import -> export cycles."""

    async def test_roundtrip_consistency(self, server, agent_serialization_manager, test_agent, default_user, other_user):
        """Test that export -> import -> export produces consistent results."""
        original_export = await agent_serialization_manager.export([test_agent.id], default_user)
        result = await agent_serialization_manager.import_file(original_export, other_user)
        imported_agent_id = next(db_id for file_id, db_id in result.id_mappings.items() if file_id == "agent-0")
        second_export = await agent_serialization_manager.export([imported_agent_id], other_user)
        print(original_export.agents[0].tool_rules)
        print(second_export.agents[0].tool_rules)
        assert compare_agent_files(original_export, second_export)

    async def test_multiple_roundtrips(self, server, agent_serialization_manager, test_agent, default_user, other_user):
        """Test multiple rounds of export/import maintain consistency."""
        current_agent_id = test_agent.id
        current_user = default_user

        for i in range(3):
            agent_file = await agent_serialization_manager.export([current_agent_id], current_user)

            target_user = other_user if current_user == default_user else default_user
            result = await agent_serialization_manager.import_file(agent_file, target_user)

            current_agent_id = next(db_id for file_id, db_id in result.id_mappings.items() if file_id == "agent-0")
            current_user = target_user

            imported_agent = await server.agent_manager.get_agent_by_id_async(current_agent_id, current_user)
            assert imported_agent.name == test_agent.name


class TestAgentFileEdgeCases:
    """Tests for edge cases and error conditions."""

    async def test_agent_with_no_messages(self, server, agent_serialization_manager, default_user, other_user):
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
        agent_file = await agent_serialization_manager.export([agent_state.id], default_user)

        # Import
        result = await agent_serialization_manager.import_file(agent_file, other_user)

        # Verify
        assert result.success
        imported_agent_id = next(db_id for file_id, db_id in result.id_mappings.items() if file_id == "agent-0")
        imported_agent = await server.agent_manager.get_agent_by_id_async(imported_agent_id, other_user)

        assert len(imported_agent.message_ids) == 0

    async def test_large_agent_file(self, server, agent_serialization_manager, default_user, other_user, weather_tool):
        """Test handling of larger agent files with many messages."""
        # Create agent
        create_agent_request = CreateAgent(
            name="large_agent",
            system="Agent with many messages",
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            tool_ids=[weather_tool.id],
        )

        agent_state = await server.agent_manager.create_agent_async(
            agent_create=create_agent_request,
            actor=default_user,
        )

        num_messages = 5

        for i in range(num_messages):
            await send_message_to_agent(server, agent_state, default_user, [MessageCreate(role=MessageRole.user, content=f"Message {i}")])

        agent_file = await agent_serialization_manager.export([agent_state.id], default_user)
        exported_agent = agent_file.agents[0]
        assert len(exported_agent.messages) >= num_messages
        result = await agent_serialization_manager.import_file(agent_file, other_user)

        # Verify all messages imported correctly
        assert result.success
        imported_agent_id = next(db_id for file_id, db_id in result.id_mappings.items() if file_id == "agent-0")
        imported_messages = await server.message_manager.list_messages(actor=other_user, agent_id=imported_agent_id)

        assert len(imported_messages) >= num_messages


class TestAgentFileValidation:
    """Tests for agent file validation and schema compliance."""

    def test_agent_file_schema_validation(self, test_agent):
        """Test AgentFileSchema validation."""
        # Use a dummy revision for this test since we can't await in sync test
        current_revision = "495f3f474131"  # Use a known valid revision format

        # Valid schema
        valid_schema = AgentFileSchema(
            metadata={"revision_id": current_revision},
            agents=[AgentSchema(id="agent-0", name="test")],
            groups=[],
            blocks=[],
            files=[],
            sources=[],
            tools=[],
            mcp_servers=[],
        )

        # Should not raise
        assert valid_schema.agents[0].id == "agent-0"
        assert valid_schema.metadata.get("revision_id") == current_revision

    @pytest.mark.asyncio
    async def test_message_schema_conversion(self, test_agent, server, default_user):
        """Test MessageSchema.from_message conversion."""
        # Get a message from the test agent
        messages = await server.message_manager.list_messages(actor=default_user, agent_id=test_agent.id)
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
        # Use a dummy revision for this test since we can't await in sync test
        current_revision = "495f3f474131"  # Use a known valid revision format

        # Valid schema
        valid_schema = AgentFileSchema(
            metadata={"revision_id": current_revision},
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
            mcp_servers=[],
        )

        assert validate_id_format(valid_schema)

        # Invalid schema
        invalid_schema = AgentFileSchema(
            metadata={"revision_id": current_revision},
            agents=[AgentSchema(id="invalid-id-format", name="test")],
            groups=[],
            blocks=[],
            files=[],
            sources=[],
            tools=[],
            mcp_servers=[],
        )

        assert not validate_id_format(invalid_schema)


class TestMCPServerSerialization:
    """Tests for MCP server export/import functionality."""

    async def test_mcp_server_export(self, agent_serialization_manager, agent_with_mcp_tools, default_user):
        """Test that MCP servers are exported correctly."""
        agent_file = await agent_serialization_manager.export([agent_with_mcp_tools.id], default_user)

        # Verify MCP server is included
        assert len(agent_file.mcp_servers) == 1
        mcp_server = agent_file.mcp_servers[0]

        # Verify server details
        assert mcp_server.server_name == "test_mcp_server"
        assert mcp_server.server_url == "http://test-mcp-server.com"
        assert mcp_server.server_type == "sse"

        # Verify auth fields are excluded
        assert not hasattr(mcp_server, "token")
        assert not hasattr(mcp_server, "custom_headers")

        # Verify ID format
        assert _validate_entity_id(mcp_server.id, "mcp_server")

    async def test_mcp_server_auth_scrubbing(self, server, agent_serialization_manager, default_user):
        """Test that authentication information is scrubbed during export."""
        from letta.schemas.mcp import MCPServer, MCPServerType

        # Create MCP server with auth info
        mcp_server_data_stdio = MCPServer(
            server_name="auth_test_server",
            server_type=MCPServerType.STDIO,
            # token="super-secret-token",
            # custom_headers={"Authorization": "Bearer secret-key", "X-Custom": "custom-value"},
            stdio_config={
                "server_name": "auth_test_server",
                "command": "test-command",
                "args": ["arg1", "arg2"],
                "env": {"ENV_VAR": "value"},
            },
        )
        mcp_server = await server.mcp_manager.create_or_update_mcp_server(mcp_server_data_stdio, default_user)

        mcp_server_data_http = MCPServer(
            server_name="auth_test_server_http",
            server_type=MCPServerType.STREAMABLE_HTTP,
            server_url="http://auth_test_server_http.com",
            token="super-secret-token",
            custom_headers={"X-Custom": "custom-value"},
        )
        mcp_server_http = await server.mcp_manager.create_or_update_mcp_server(mcp_server_data_http, default_user)
        # Create tool from MCP server
        from letta.schemas.tool import MCPTool, ToolCreate

        mcp_tool_data = MCPTool(
            name="auth_test_tool_stdio",
            description="Tool with auth",
            inputSchema={"type": "object", "properties": {}},
        )
        tool_create_stdio = ToolCreate.from_mcp(mcp_server.server_name, mcp_tool_data)

        mcp_tool_data_http = MCPTool(
            name="auth_test_tool_http",
            description="Tool with auth",
            inputSchema={"type": "object", "properties": {}},
        )

        tool_create_http = ToolCreate.from_mcp(mcp_server_http.server_name, mcp_tool_data_http)

        mcp_tool = await server.tool_manager.create_mcp_tool_async(tool_create_stdio, mcp_server.server_name, mcp_server.id, default_user)
        mcp_tool_http = await server.tool_manager.create_mcp_tool_async(
            tool_create_http, mcp_server_http.server_name, mcp_server_http.id, default_user
        )

        # Create agent with the tool
        from letta.schemas.agent import CreateAgent

        create_agent_request = CreateAgent(
            name="auth_test_agent",
            tool_ids=[mcp_tool.id, mcp_tool_http.id],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
        )
        agent = await server.agent_manager.create_agent_async(create_agent_request, default_user)

        # Export
        agent_file = await agent_serialization_manager.export([agent.id], default_user)

        for server in agent_file.mcp_servers:
            if server.server_name == "auth_test_server":
                exported_server_stdio = server
            elif server.server_name == "auth_test_server_http":
                exported_server_http = server

        # Verify env variables in stdio server are excluded (typically used for auth)
        assert exported_server_stdio.id != mcp_server.id
        assert exported_server_stdio.server_name == "auth_test_server"
        assert exported_server_stdio.stdio_config == {
            "server_name": "auth_test_server",
            "type": "stdio",
            "command": "test-command",
            "args": ["arg1", "arg2"],
        }  # Non-auth config preserved
        assert exported_server_stdio.server_type == "stdio"

        # Verify token and custom headers are excluded from export for http server
        assert exported_server_http.id != mcp_server_http.id
        assert exported_server_http.server_name == "auth_test_server_http"
        assert exported_server_http.server_type == "streamable_http"
        assert exported_server_http.server_url == "http://auth_test_server_http.com"
        assert not hasattr(exported_server_http, "token")
        assert not hasattr(exported_server_http, "custom_headers")

    async def test_mcp_tool_metadata_with_server_id(self, agent_serialization_manager, agent_with_mcp_tools, default_user):
        """Test that MCP tools have server_id in metadata."""
        agent_file = await agent_serialization_manager.export([agent_with_mcp_tools.id], default_user)

        # Find the MCP tool
        mcp_tool = next((t for t in agent_file.tools if t.name == "test_mcp_tool"), None)
        assert mcp_tool is not None

        # Verify metadata contains server info
        assert mcp_tool.metadata_ is not None
        assert "mcp" in mcp_tool.metadata_
        assert "server_name" in mcp_tool.metadata_["mcp"]
        assert "server_id" in mcp_tool.metadata_["mcp"]
        assert mcp_tool.metadata_["mcp"]["server_name"] == "test_mcp_server"

        # Verify tag format
        assert any(tag.startswith("mcp:") for tag in mcp_tool.tags)

    async def test_mcp_server_import(self, agent_serialization_manager, agent_with_mcp_tools, default_user, other_user):
        """Test importing agents with MCP servers."""
        # Export from default user
        agent_file = await agent_serialization_manager.export([agent_with_mcp_tools.id], default_user)

        # Import to other user
        result = await agent_serialization_manager.import_file(agent_file, other_user)

        assert result.success

        # Verify MCP server was imported
        mcp_server_id = next((db_id for file_id, db_id in result.id_mappings.items() if file_id.startswith("mcp_server-")), None)
        assert mcp_server_id is not None

    async def test_multiple_mcp_servers_export(self, server, agent_serialization_manager, default_user):
        """Test exporting multiple MCP servers from different agents."""
        from letta.schemas.mcp import MCPServer, MCPServerType

        # Create two MCP servers
        mcp_server1 = await server.mcp_manager.create_or_update_mcp_server(
            MCPServer(
                server_name="mcp1",
                server_type=MCPServerType.STREAMABLE_HTTP,
                server_url="http://mcp1.com",
                token="super-secret-token",
                custom_headers={"X-Custom": "custom-value"},
            ),
            default_user,
        )
        mcp_server2 = await server.mcp_manager.create_or_update_mcp_server(
            MCPServer(
                server_name="mcp2",
                server_type=MCPServerType.STDIO,
                stdio_config={
                    "server_name": "mcp2",
                    "command": "mcp2-cmd",
                    "args": ["arg1", "arg2"],
                },
            ),
            default_user,
        )

        # Create tools from each server
        from letta.schemas.tool import MCPTool, ToolCreate

        tool1 = await server.tool_manager.create_mcp_tool_async(
            ToolCreate.from_mcp(
                "mcp1",
                MCPTool(name="tool1", description="Tool 1", inputSchema={"type": "object", "properties": {}}),
            ),
            "mcp1",
            mcp_server1.id,
            default_user,
        )
        tool2 = await server.tool_manager.create_mcp_tool_async(
            ToolCreate.from_mcp(
                "mcp2",
                MCPTool(name="tool2", description="Tool 2", inputSchema={"type": "object", "properties": {}}),
            ),
            "mcp2",
            mcp_server2.id,
            default_user,
        )

        # Create agents with different MCP tools
        from letta.schemas.agent import CreateAgent

        agent1 = await server.agent_manager.create_agent_async(
            CreateAgent(
                name="agent1",
                tool_ids=[tool1.id],
                llm_config=LLMConfig.default_config("gpt-4o-mini"),
                embedding_config=EmbeddingConfig.default_config(provider="openai"),
            ),
            default_user,
        )
        agent2 = await server.agent_manager.create_agent_async(
            CreateAgent(
                name="agent2",
                tool_ids=[tool2.id],
                llm_config=LLMConfig.default_config("gpt-4o-mini"),
                embedding_config=EmbeddingConfig.default_config(provider="openai"),
            ),
            default_user,
        )

        # Export both agents
        agent_file = await agent_serialization_manager.export([agent1.id, agent2.id], default_user)

        # Verify both MCP servers are included
        assert len(agent_file.mcp_servers) == 2

        # Verify server types
        streamable_http_server = next(s for s in agent_file.mcp_servers if s.server_name == "mcp1")
        stdio_server = next(s for s in agent_file.mcp_servers if s.server_name == "mcp2")

        assert streamable_http_server.server_name == "mcp1"
        assert streamable_http_server.server_type == "streamable_http"
        assert streamable_http_server.server_url == "http://mcp1.com"

        assert stdio_server.server_name == "mcp2"
        assert stdio_server.server_type == "stdio"
        assert stdio_server.stdio_config == {
            "server_name": "mcp2",
            "type": "stdio",
            "command": "mcp2-cmd",
            "args": ["arg1", "arg2"],
        }

    async def test_mcp_server_deduplication(self, server, agent_serialization_manager, default_user, test_mcp_server, mcp_tool):
        """Test that shared MCP servers are deduplicated during export."""
        # Create two agents using the same MCP tool
        from letta.schemas.agent import CreateAgent

        agent1 = await server.agent_manager.create_agent_async(
            CreateAgent(
                name="agent_dup1",
                tool_ids=[mcp_tool.id],
                llm_config=LLMConfig.default_config("gpt-4o-mini"),
                embedding_config=EmbeddingConfig.default_config(provider="openai"),
            ),
            default_user,
        )
        agent2 = await server.agent_manager.create_agent_async(
            CreateAgent(
                name="agent_dup2",
                tool_ids=[mcp_tool.id],
                llm_config=LLMConfig.default_config("gpt-4o-mini"),
                embedding_config=EmbeddingConfig.default_config(provider="openai"),
            ),
            default_user,
        )

        # Export both agents
        agent_file = await agent_serialization_manager.export([agent1.id, agent2.id], default_user)

        # Verify only one MCP server is exported
        assert len(agent_file.mcp_servers) == 1
        assert agent_file.mcp_servers[0].server_name == "test_mcp_server"


if __name__ == "__main__":
    pytest.main([__file__])
