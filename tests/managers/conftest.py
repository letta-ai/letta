"""
Shared fixtures for all manager tests.

This conftest.py makes fixtures available to all test files in the tests/managers/ directory.
"""

import os
import time
import uuid
from typing import Tuple

import pytest
from anthropic.types.beta import BetaMessage
from anthropic.types.beta.messages import BetaMessageBatchIndividualResponse, BetaMessageBatchSucceededResult
from sqlalchemy import text

from letta.config import LettaConfig
from letta.functions.functions import derive_openai_json_schema, parse_source_code
from letta.functions.mcp_client.types import MCPTool
from letta.helpers import ToolRulesSolver
from letta.orm import Base
from letta.schemas.agent import CreateAgent
from letta.schemas.block import Block as PydanticBlock, CreateBlock
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import JobStatus, MessageRole, RunStatus
from letta.schemas.environment_variables import SandboxEnvironmentVariableCreate, SandboxEnvironmentVariableUpdate
from letta.schemas.file import FileMetadata as PydanticFileMetadata
from letta.schemas.job import BatchJob, Job as PydanticJob
from letta.schemas.letta_message_content import TextContent
from letta.schemas.llm_batch_job import AgentStepState
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message as PydanticMessage, MessageCreate
from letta.schemas.organization import Organization
from letta.schemas.passage import Passage as PydanticPassage
from letta.schemas.run import Run as PydanticRun
from letta.schemas.sandbox_config import E2BSandboxConfig, SandboxConfigCreate
from letta.schemas.source import Source as PydanticSource
from letta.schemas.tool import Tool as PydanticTool, ToolCreate
from letta.schemas.tool_rule import InitToolRule
from letta.schemas.user import User as PydanticUser
from letta.server.db import db_registry
from letta.server.server import SyncServer
from letta.services.block_manager import BlockManager

# Constants
DEFAULT_EMBEDDING_CONFIG = EmbeddingConfig.default_config(provider="openai")
CREATE_DELAY_SQLITE = 1
USING_SQLITE = not bool(os.getenv("LETTA_PG_URI"))


# ======================================================================================================================
# Database and Server Fixtures
# ======================================================================================================================


@pytest.fixture
async def async_session():
    """Provide an async database session."""
    async with db_registry.async_session() as session:
        yield session


@pytest.fixture(autouse=True)
async def _clear_tables(async_session):
    """Clear all tables before each test (except block_history)."""
    # Temporarily disable foreign key constraints for SQLite only
    engine_name = async_session.bind.dialect.name
    if engine_name == "sqlite":
        await async_session.execute(text("PRAGMA foreign_keys = OFF"))

    for table in reversed(Base.metadata.sorted_tables):  # Reverse to avoid FK issues
        # If this is the block_history table, skip it
        if table.name == "block_history":
            continue
        await async_session.execute(table.delete())  # Truncate table
    await async_session.commit()

    # Re-enable foreign key constraints for SQLite only
    if engine_name == "sqlite":
        await async_session.execute(text("PRAGMA foreign_keys = ON"))


@pytest.fixture(scope="module")
def server():
    """Create a server instance for the test module."""
    config = LettaConfig.load()
    config.save()
    server = SyncServer(init_with_default_org_and_user=False)
    return server


# ======================================================================================================================
# Organization and User Fixtures
# ======================================================================================================================


@pytest.fixture
async def default_organization(server: SyncServer):
    """Create and return the default organization."""
    org = await server.organization_manager.create_default_organization_async()
    yield org


@pytest.fixture
async def other_organization(server: SyncServer):
    """Create and return another organization."""
    org = await server.organization_manager.create_organization_async(pydantic_org=Organization(name="letta"))
    yield org


@pytest.fixture
async def default_user(server: SyncServer, default_organization):
    """Create and return the default user within the default organization."""
    user = await server.user_manager.create_default_actor_async(org_id=default_organization.id)
    yield user


@pytest.fixture
async def other_user(server: SyncServer, default_organization):
    """Create and return another user within the default organization."""
    user = await server.user_manager.create_actor_async(PydanticUser(name="other", organization_id=default_organization.id))
    yield user


@pytest.fixture
async def other_user_different_org(server: SyncServer, other_organization):
    """Create and return a user in a different organization."""
    user = await server.user_manager.create_actor_async(PydanticUser(name="other", organization_id=other_organization.id))
    yield user


# ======================================================================================================================
# Source and File Fixtures
# ======================================================================================================================


@pytest.fixture
async def default_source(server: SyncServer, default_user):
    """Create and return the default source."""
    source_pydantic = PydanticSource(
        name="Test Source",
        description="This is a test source.",
        metadata={"type": "test"},
        embedding_config=DEFAULT_EMBEDDING_CONFIG,
    )
    source = await server.source_manager.create_source(source=source_pydantic, actor=default_user)
    yield source


@pytest.fixture
async def other_source(server: SyncServer, default_user):
    """Create and return another source."""
    source_pydantic = PydanticSource(
        name="Another Test Source",
        description="This is yet another test source.",
        metadata={"type": "another_test"},
        embedding_config=DEFAULT_EMBEDDING_CONFIG,
    )
    source = await server.source_manager.create_source(source=source_pydantic, actor=default_user)
    yield source


@pytest.fixture
async def default_file(server: SyncServer, default_source, default_user, default_organization):
    """Create and return the default file."""
    file = await server.file_manager.create_file(
        PydanticFileMetadata(file_name="test_file", organization_id=default_organization.id, source_id=default_source.id),
        actor=default_user,
    )
    yield file


@pytest.fixture
async def another_file(server: SyncServer, default_source, default_user, default_organization):
    """Create and return another file."""
    pf = PydanticFileMetadata(
        file_name="another_file",
        organization_id=default_organization.id,
        source_id=default_source.id,
    )
    file = await server.file_manager.create_file(pf, actor=default_user)
    yield file


# ======================================================================================================================
# Tool Fixtures
# ======================================================================================================================


@pytest.fixture
async def print_tool(server: SyncServer, default_user, default_organization):
    """Create and return a print tool."""

    def print_tool(message: str):
        """
        Args:
            message (str): The message to print.

        Returns:
            str: The message that was printed.
        """
        print(message)
        return message

    # Set up tool details
    source_code = parse_source_code(print_tool)
    source_type = "python"
    description = "test_description"
    tags = ["test"]
    metadata = {"a": "b"}

    tool = PydanticTool(description=description, tags=tags, source_code=source_code, source_type=source_type, metadata_=metadata)
    derived_json_schema = derive_openai_json_schema(source_code=tool.source_code, name=tool.name)

    derived_name = derived_json_schema["name"]
    tool.json_schema = derived_json_schema
    tool.name = derived_name

    tool = await server.tool_manager.create_or_update_tool_async(tool, actor=default_user)
    yield tool


@pytest.fixture
async def bash_tool(server: SyncServer, default_user, default_organization):
    """Create and return a bash tool with requires_approval."""

    def bash_tool(operation: str):
        """
        Args:
            operation (str): The bash operation to execute.

        Returns:
            str: The result of the executed operation.
        """
        print("scary bash operation")
        return "success"

    # Set up tool details
    source_code = parse_source_code(bash_tool)
    source_type = "python"
    description = "test_description"
    tags = ["test"]
    metadata = {"a": "b"}

    tool = PydanticTool(description=description, tags=tags, source_code=source_code, source_type=source_type, metadata_=metadata)
    derived_json_schema = derive_openai_json_schema(source_code=tool.source_code, name=tool.name)

    derived_name = derived_json_schema["name"]
    tool.json_schema = derived_json_schema
    tool.name = derived_name
    tool.default_requires_approval = True

    tool = await server.tool_manager.create_or_update_tool_async(tool, actor=default_user)
    yield tool


@pytest.fixture
async def other_tool(server: SyncServer, default_user, default_organization):
    """Create and return another tool."""

    def print_other_tool(message: str):
        """
        Args:
            message (str): The message to print.

        Returns:
            str: The message that was printed.
        """
        print(message)
        return message

    # Set up tool details
    source_code = parse_source_code(print_other_tool)
    source_type = "python"
    description = "other_tool_description"
    tags = ["test"]

    tool = PydanticTool(description=description, tags=tags, source_code=source_code, source_type=source_type)
    derived_json_schema = derive_openai_json_schema(source_code=tool.source_code, name=tool.name)

    derived_name = derived_json_schema["name"]
    tool.json_schema = derived_json_schema
    tool.name = derived_name

    tool = await server.tool_manager.create_or_update_tool_async(tool, actor=default_user)
    yield tool


# ======================================================================================================================
# Block Fixtures
# ======================================================================================================================


@pytest.fixture
async def default_block(server: SyncServer, default_user):
    """Create and return a default block."""
    block_manager = BlockManager()
    block_data = PydanticBlock(
        label="default_label",
        value="Default Block Content",
        description="A default test block",
        limit=1000,
        metadata={"type": "test"},
    )
    block = await block_manager.create_or_update_block_async(block_data, actor=default_user)
    yield block


@pytest.fixture
async def other_block(server: SyncServer, default_user):
    """Create and return another block."""
    block_manager = BlockManager()
    block_data = PydanticBlock(
        label="other_label",
        value="Other Block Content",
        description="Another test block",
        limit=500,
        metadata={"type": "test"},
    )
    block = await block_manager.create_or_update_block_async(block_data, actor=default_user)
    yield block


# ======================================================================================================================
# Agent Fixtures
# ======================================================================================================================


@pytest.fixture
async def sarah_agent(server: SyncServer, default_user, default_organization):
    """Create and return a sample agent named 'sarah_agent'."""
    agent_state = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="sarah_agent",
            memory_blocks=[],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            include_base_tools=False,
        ),
        actor=default_user,
    )
    yield agent_state


@pytest.fixture
async def charles_agent(server: SyncServer, default_user, default_organization):
    """Create and return a sample agent named 'charles_agent'."""
    agent_state = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="charles_agent",
            memory_blocks=[CreateBlock(label="human", value="Charles"), CreateBlock(label="persona", value="I am a helpful assistant")],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            include_base_tools=False,
        ),
        actor=default_user,
    )
    yield agent_state


@pytest.fixture
async def comprehensive_test_agent_fixture(server: SyncServer, default_user, print_tool, default_source, default_block) -> Tuple:
    """Create a comprehensive test agent with all features."""
    memory_blocks = [CreateBlock(label="human", value="BananaBoy"), CreateBlock(label="persona", value="I am a helpful assistant")]
    create_agent_request = CreateAgent(
        system="test system",
        memory_blocks=memory_blocks,
        llm_config=LLMConfig.default_config("gpt-4o-mini"),
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
        block_ids=[default_block.id],
        tool_ids=[print_tool.id],
        source_ids=[default_source.id],
        tags=["a", "b"],
        description="test_description",
        metadata={"test_key": "test_value"},
        tool_rules=[InitToolRule(tool_name=print_tool.name)],
        initial_message_sequence=[MessageCreate(role=MessageRole.user, content="hello world")],
        tool_exec_environment_variables={"test_env_var_key_a": "test_env_var_value_a", "test_env_var_key_b": "test_env_var_value_b"},
        message_buffer_autoclear=True,
        include_base_tools=False,
    )
    created_agent = await server.agent_manager.create_agent_async(
        create_agent_request,
        actor=default_user,
    )

    yield created_agent, create_agent_request


# ======================================================================================================================
# Archive and Passage Fixtures
# ======================================================================================================================


@pytest.fixture
async def default_archive(server: SyncServer, default_user):
    """Create and return a default archive."""
    archive = await server.archive_manager.create_archive_async(
        "test", embedding_config=EmbeddingConfig.default_config(provider="openai"), actor=default_user
    )
    yield archive


@pytest.fixture
async def agent_passage_fixture(server: SyncServer, default_user, sarah_agent):
    """Create an agent passage."""
    # Get or create default archive for the agent
    archive = await server.archive_manager.get_or_create_default_archive_for_agent_async(agent_state=sarah_agent, actor=default_user)

    passage = await server.passage_manager.create_agent_passage_async(
        PydanticPassage(
            text="Hello, I am an agent passage",
            archive_id=archive.id,
            organization_id=default_user.organization_id,
            embedding=[0.1],
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
            metadata={"type": "test"},
        ),
        actor=default_user,
    )
    yield passage


@pytest.fixture
async def source_passage_fixture(server: SyncServer, default_user, default_file, default_source):
    """Create a source passage."""
    passage = await server.passage_manager.create_source_passage_async(
        PydanticPassage(
            text="Hello, I am a source passage",
            source_id=default_source.id,
            file_id=default_file.id,
            organization_id=default_user.organization_id,
            embedding=[0.1],
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
            metadata={"type": "test"},
        ),
        file_metadata=default_file,
        actor=default_user,
    )
    yield passage


# ======================================================================================================================
# Message Fixtures
# ======================================================================================================================


@pytest.fixture
async def hello_world_message_fixture(server: SyncServer, default_user, sarah_agent):
    """Create a hello world message."""
    message = PydanticMessage(
        agent_id=sarah_agent.id,
        role="user",
        content=[TextContent(text="Hello, world!")],
    )

    msg = await server.message_manager.create_many_messages_async([message], actor=default_user)
    yield msg[0]


# ======================================================================================================================
# Sandbox Fixtures
# ======================================================================================================================


@pytest.fixture
async def sandbox_config_fixture(server: SyncServer, default_user):
    """Create a sandbox configuration."""
    sandbox_config_create = SandboxConfigCreate(
        config=E2BSandboxConfig(),
    )
    created_config = await server.sandbox_config_manager.create_or_update_sandbox_config_async(sandbox_config_create, actor=default_user)
    yield created_config


@pytest.fixture
async def sandbox_env_var_fixture(server: SyncServer, sandbox_config_fixture, default_user):
    """Create a sandbox environment variable."""
    env_var_create = SandboxEnvironmentVariableCreate(
        key="SAMPLE_VAR",
        value="sample_value",
        description="A sample environment variable for testing.",
    )
    created_env_var = await server.sandbox_config_manager.create_sandbox_env_var_async(
        env_var_create, sandbox_config_id=sandbox_config_fixture.id, actor=default_user
    )
    yield created_env_var


# ======================================================================================================================
# File Attachment Fixtures
# ======================================================================================================================


@pytest.fixture
async def file_attachment(server: SyncServer, default_user, sarah_agent, default_file):
    """Create a file attachment to an agent."""
    assoc, closed_files = await server.file_agent_manager.attach_file(
        agent_id=sarah_agent.id,
        file_id=default_file.id,
        file_name=default_file.file_name,
        source_id=default_file.source_id,
        actor=default_user,
        visible_content="initial",
        max_files_open=sarah_agent.max_files_open,
    )
    yield assoc


# ======================================================================================================================
# Job Fixtures
# ======================================================================================================================


@pytest.fixture
async def default_job(server: SyncServer, default_user):
    """Create and return a default job."""
    job_pydantic = PydanticJob(
        user_id=default_user.id,
        status=JobStatus.pending,
    )
    job = await server.job_manager.create_job_async(pydantic_job=job_pydantic, actor=default_user)
    yield job


@pytest.fixture
async def default_run(server: SyncServer, default_user, sarah_agent):
    """Create and return a default run."""
    run_pydantic = PydanticRun(
        agent_id=sarah_agent.id,
        status=RunStatus.created,
    )
    run = await server.run_manager.create_run(pydantic_run=run_pydantic, actor=default_user)
    yield run


@pytest.fixture
async def letta_batch_job(server: SyncServer, default_user):
    """Create a batch job."""
    return await server.job_manager.create_job_async(BatchJob(user_id=default_user.id), actor=default_user)


# ======================================================================================================================
# MCP Tool Fixtures
# ======================================================================================================================


@pytest.fixture
async def mcp_tool(server: SyncServer, default_user):
    """Create an MCP tool."""
    mcp_tool = MCPTool(
        name="weather_lookup",
        description="Fetches the current weather for a given location.",
        inputSchema={
            "type": "object",
            "properties": {
                "location": {"type": "string", "description": "The name of the city or location."},
                "units": {
                    "type": "string",
                    "enum": ["metric", "imperial"],
                    "description": "The unit system for temperature (metric or imperial).",
                },
            },
            "required": ["location"],
        },
    )
    mcp_server_name = "test"
    mcp_server_id = "test-server-id"  # Mock server ID for testing
    tool_create = ToolCreate.from_mcp(mcp_server_name=mcp_server_name, mcp_tool=mcp_tool)
    tool = await server.tool_manager.create_or_update_mcp_tool_async(
        tool_create=tool_create, mcp_server_name=mcp_server_name, mcp_server_id=mcp_server_id, actor=default_user
    )
    yield tool


# ======================================================================================================================
# Test Data Creation Fixtures
# ======================================================================================================================


@pytest.fixture
async def create_test_passages(server: SyncServer, default_file, default_user, sarah_agent, default_source):
    """Helper function to create test passages for all tests."""
    # Get or create default archive for the agent
    archive = await server.archive_manager.get_or_create_default_archive_for_agent(
        agent_id=sarah_agent.id, agent_name=sarah_agent.name, actor=default_user
    )

    # Create agent passages
    passages = []
    for i in range(5):
        passage = await server.passage_manager.create_agent_passage(
            PydanticPassage(
                text=f"Agent passage {i}",
                archive_id=archive.id,
                organization_id=default_user.organization_id,
                embedding=[0.1],
                embedding_config=DEFAULT_EMBEDDING_CONFIG,
                metadata={"type": "test"},
            ),
            actor=default_user,
        )
        passages.append(passage)
        if USING_SQLITE:
            time.sleep(CREATE_DELAY_SQLITE)

    # Create source passages
    for i in range(5):
        passage = await server.passage_manager.create_source_passage(
            PydanticPassage(
                text=f"Source passage {i}",
                source_id=default_source.id,
                file_id=default_file.id,
                organization_id=default_user.organization_id,
                embedding=[0.1],
                embedding_config=DEFAULT_EMBEDDING_CONFIG,
                metadata={"type": "test"},
            ),
            file_metadata=default_file,
            actor=default_user,
        )
        passages.append(passage)
        if USING_SQLITE:
            time.sleep(CREATE_DELAY_SQLITE)

    return passages


@pytest.fixture
async def agent_passages_setup(server: SyncServer, default_archive, default_source, default_file, default_user, sarah_agent):
    """Setup fixture for agent passages tests."""
    agent_id = sarah_agent.id
    actor = default_user

    await server.agent_manager.attach_source_async(agent_id=agent_id, source_id=default_source.id, actor=actor)

    # Create some source passages
    source_passages = []
    for i in range(3):
        passage = await server.passage_manager.create_source_passage_async(
            PydanticPassage(
                organization_id=actor.organization_id,
                source_id=default_source.id,
                file_id=default_file.id,
                text=f"Source passage {i}",
                embedding=[0.1],  # Default OpenAI embedding size
                embedding_config=DEFAULT_EMBEDDING_CONFIG,
            ),
            file_metadata=default_file,
            actor=actor,
        )
        source_passages.append(passage)

    # attach archive
    await server.archive_manager.attach_agent_to_archive_async(
        agent_id=agent_id, archive_id=default_archive.id, is_owner=True, actor=default_user
    )

    # Create some agent passages
    agent_passages = []
    for i in range(2):
        passage = await server.passage_manager.create_agent_passage_async(
            PydanticPassage(
                organization_id=actor.organization_id,
                archive_id=default_archive.id,
                text=f"Agent passage {i}",
                embedding=[0.1],  # Default OpenAI embedding size
                embedding_config=DEFAULT_EMBEDDING_CONFIG,
            ),
            actor=actor,
        )
        agent_passages.append(passage)

    yield agent_passages, source_passages

    # Cleanup
    await server.source_manager.delete_source(default_source.id, actor=actor)


@pytest.fixture
async def agent_with_tags(server: SyncServer, default_user):
    """Create agents with specific tags."""
    agent1 = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="agent1",
            tags=["primary_agent", "benefit_1"],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            memory_blocks=[],
            include_base_tools=False,
        ),
        actor=default_user,
    )

    agent2 = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="agent2",
            tags=["primary_agent", "benefit_2"],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            memory_blocks=[],
            include_base_tools=False,
        ),
        actor=default_user,
    )

    agent3 = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="agent3",
            tags=["primary_agent", "benefit_1", "benefit_2"],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            memory_blocks=[],
            include_base_tools=False,
        ),
        actor=default_user,
    )

    return [agent1, agent2, agent3]


# ======================================================================================================================
# LLM and Step State Fixtures
# ======================================================================================================================


@pytest.fixture
def dummy_llm_config() -> LLMConfig:
    """Create a dummy LLM config."""
    return LLMConfig.default_config("gpt-4o-mini")


@pytest.fixture
def dummy_tool_rules_solver() -> ToolRulesSolver:
    """Create a dummy tool rules solver."""
    return ToolRulesSolver(tool_rules=[InitToolRule(tool_name="send_message")])


@pytest.fixture
def dummy_step_state(dummy_tool_rules_solver: ToolRulesSolver) -> AgentStepState:
    """Create a dummy step state."""
    return AgentStepState(step_number=1, tool_rules_solver=dummy_tool_rules_solver)


@pytest.fixture
def dummy_successful_response() -> BetaMessageBatchIndividualResponse:
    """Create a dummy successful Anthropic message batch response."""
    return BetaMessageBatchIndividualResponse(
        custom_id="my-second-request",
        result=BetaMessageBatchSucceededResult(
            type="succeeded",
            message=BetaMessage(
                id="msg_abc123",
                role="assistant",
                type="message",
                model="claude-3-5-sonnet-20240620",
                content=[{"type": "text", "text": "hi!"}],
                usage={"input_tokens": 5, "output_tokens": 7},
                stop_reason="end_turn",
            ),
        ),
    )


# ======================================================================================================================
# Environment Setup Fixtures
# ======================================================================================================================


@pytest.fixture(params=[None, "PRODUCTION"])
def set_letta_environment(request, monkeypatch):
    """Parametrized fixture to test with different environment settings."""
    from letta.settings import settings

    # Patch the settings.environment attribute
    original = settings.environment
    monkeypatch.setattr(settings, "environment", request.param)
    yield request.param
    # Restore original environment
    monkeypatch.setattr(settings, "environment", original)
