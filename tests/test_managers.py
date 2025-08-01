import asyncio
import json
import logging
import os
import random
import re
import string
import time
from datetime import datetime, timedelta, timezone
from typing import List
from unittest.mock import Mock

# tests/test_file_content_flow.py
import pytest
from _pytest.python_api import approx
from anthropic.types.beta import BetaMessage
from anthropic.types.beta.messages import BetaMessageBatchIndividualResponse, BetaMessageBatchSucceededResult
from openai.types.chat.chat_completion_message_tool_call import ChatCompletionMessageToolCall as OpenAIToolCall
from openai.types.chat.chat_completion_message_tool_call import Function as OpenAIFunction
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, InvalidRequestError
from sqlalchemy.orm.exc import StaleDataError

from letta.config import LettaConfig
from letta.constants import (
    BASE_MEMORY_TOOLS,
    BASE_SLEEPTIME_TOOLS,
    BASE_TOOLS,
    BASE_VOICE_SLEEPTIME_CHAT_TOOLS,
    BASE_VOICE_SLEEPTIME_TOOLS,
    BUILTIN_TOOLS,
    DEFAULT_ORG_ID,
    DEFAULT_ORG_NAME,
    FILES_TOOLS,
    LETTA_TOOL_EXECUTION_DIR,
    LETTA_TOOL_SET,
    LOCAL_ONLY_MULTI_AGENT_TOOLS,
    MCP_TOOL_TAG_NAME_PREFIX,
    MULTI_AGENT_TOOLS,
)
from letta.data_sources.redis_client import NoopAsyncRedisClient, get_redis_client
from letta.functions.functions import derive_openai_json_schema, parse_source_code
from letta.functions.mcp_client.types import MCPTool
from letta.helpers import ToolRulesSolver
from letta.helpers.datetime_helpers import AsyncTimer
from letta.jobs.types import ItemUpdateInfo, RequestStatusUpdateInfo, StepStatusUpdateInfo
from letta.orm import Base, Block
from letta.orm.block_history import BlockHistory
from letta.orm.enums import ToolType
from letta.orm.errors import NoResultFound, UniqueConstraintViolationError
from letta.orm.file import FileContent as FileContentModel
from letta.orm.file import FileMetadata as FileMetadataModel
from letta.schemas.agent import CreateAgent, UpdateAgent
from letta.schemas.block import Block as PydanticBlock
from letta.schemas.block import BlockUpdate, CreateBlock
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import ActorType, AgentStepStatus, FileProcessingStatus, JobStatus, JobType, MessageRole, ProviderType, SandboxType
from letta.schemas.environment_variables import SandboxEnvironmentVariableCreate, SandboxEnvironmentVariableUpdate
from letta.schemas.file import FileMetadata
from letta.schemas.file import FileMetadata as PydanticFileMetadata
from letta.schemas.identity import IdentityCreate, IdentityProperty, IdentityPropertyType, IdentityType, IdentityUpdate, IdentityUpsert
from letta.schemas.job import BatchJob
from letta.schemas.job import Job
from letta.schemas.job import Job as PydanticJob
from letta.schemas.job import JobUpdate, LettaRequestConfig
from letta.schemas.letta_message import UpdateAssistantMessage, UpdateReasoningMessage, UpdateSystemMessage, UpdateUserMessage
from letta.schemas.letta_message_content import TextContent
from letta.schemas.llm_batch_job import AgentStepState, LLMBatchItem
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message as PydanticMessage
from letta.schemas.message import MessageCreate, MessageUpdate
from letta.schemas.openai.chat_completion_response import UsageStatistics
from letta.schemas.organization import Organization
from letta.schemas.organization import Organization as PydanticOrganization
from letta.schemas.organization import OrganizationUpdate
from letta.schemas.passage import Passage as PydanticPassage
from letta.schemas.pip_requirement import PipRequirement
from letta.schemas.run import Run as PydanticRun
from letta.schemas.sandbox_config import E2BSandboxConfig, LocalSandboxConfig, SandboxConfigCreate, SandboxConfigUpdate
from letta.schemas.source import Source as PydanticSource
from letta.schemas.source import SourceUpdate
from letta.schemas.tool import Tool as PydanticTool
from letta.schemas.tool import ToolCreate, ToolUpdate
from letta.schemas.tool_rule import InitToolRule
from letta.schemas.user import User as PydanticUser
from letta.schemas.user import UserUpdate
from letta.server.db import db_registry
from letta.server.server import SyncServer
from letta.services.block_manager import BlockManager
from letta.services.helpers.agent_manager_helper import calculate_base_tools, calculate_multi_agent_tools, validate_agent_exists_async
from letta.services.step_manager import FeedbackType
from letta.settings import tool_settings
from letta.utils import calculate_file_defaults_based_on_context_window
from tests.helpers.utils import comprehensive_agent_checks, validate_context_window_overview
from tests.utils import random_string

DEFAULT_EMBEDDING_CONFIG = EmbeddingConfig.default_config(provider="openai")
CREATE_DELAY_SQLITE = 1
USING_SQLITE = not bool(os.getenv("LETTA_PG_URI"))


async def _count_file_content_rows(session, file_id: str) -> int:
    q = select(func.count()).select_from(FileContentModel).where(FileContentModel.file_id == file_id)
    result = await session.execute(q)
    return result.scalar_one()


@pytest.fixture
async def async_session():
    async with db_registry.async_session() as session:
        yield session


@pytest.fixture(autouse=True)
async def _clear_tables(async_session):
    from sqlalchemy import text

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


@pytest.fixture
async def default_organization(server: SyncServer):
    """Fixture to create and return the default organization."""
    org = server.organization_manager.create_default_organization()
    yield org


@pytest.fixture
async def other_organization(server: SyncServer):
    """Fixture to create and return the default organization."""
    org = server.organization_manager.create_organization(pydantic_org=Organization(name="letta"))
    yield org


@pytest.fixture
def default_user(server: SyncServer, default_organization):
    """Fixture to create and return the default user within the default organization."""
    user = server.user_manager.create_default_user(org_id=default_organization.id)
    yield user


@pytest.fixture
async def other_user(server: SyncServer, default_organization):
    """Fixture to create and return the default user within the default organization."""
    user = await server.user_manager.create_actor_async(PydanticUser(name="other", organization_id=default_organization.id))
    yield user


@pytest.fixture
async def other_user_different_org(server: SyncServer, other_organization):
    """Fixture to create and return the default user within the default organization."""
    user = await server.user_manager.create_actor_async(PydanticUser(name="other", organization_id=other_organization.id))
    yield user


@pytest.fixture
async def default_source(server: SyncServer, default_user):
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
    file = await server.file_manager.create_file(
        PydanticFileMetadata(file_name="test_file", organization_id=default_organization.id, source_id=default_source.id),
        actor=default_user,
    )
    yield file


@pytest.fixture
async def print_tool(server: SyncServer, default_user, default_organization):
    """Fixture to create a tool with default settings and clean up after the test."""

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

    # Yield the created tool
    yield tool


@pytest.fixture
def composio_github_star_tool(server, default_user):
    tool_create = ToolCreate.from_composio(action_name="GITHUB_STAR_A_REPOSITORY_FOR_THE_AUTHENTICATED_USER")
    tool = server.tool_manager.create_or_update_composio_tool(tool_create=tool_create, actor=default_user)
    yield tool


@pytest.fixture
def mcp_tool(server, default_user):
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
    tool = server.tool_manager.create_or_update_mcp_tool(
        tool_create=tool_create, mcp_server_name=mcp_server_name, mcp_server_id=mcp_server_id, actor=default_user
    )
    yield tool


@pytest.fixture
async def default_job(server: SyncServer, default_user):
    """Fixture to create and return a default job."""
    job_pydantic = PydanticJob(
        user_id=default_user.id,
        status=JobStatus.pending,
    )
    job = await server.job_manager.create_job_async(pydantic_job=job_pydantic, actor=default_user)
    yield job


@pytest.fixture
async def default_run(server: SyncServer, default_user):
    """Fixture to create and return a default job."""
    run_pydantic = PydanticRun(
        user_id=default_user.id,
        status=JobStatus.pending,
    )
    run = await server.job_manager.create_job_async(pydantic_job=run_pydantic, actor=default_user)
    yield run


@pytest.fixture
def agent_passage_fixture(server: SyncServer, default_user, sarah_agent):
    """Fixture to create an agent passage."""
    passage = server.passage_manager.create_agent_passage(
        PydanticPassage(
            text="Hello, I am an agent passage",
            agent_id=sarah_agent.id,
            organization_id=default_user.organization_id,
            embedding=[0.1],
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
            metadata={"type": "test"},
        ),
        actor=default_user,
    )
    yield passage


@pytest.fixture
def source_passage_fixture(server: SyncServer, default_user, default_file, default_source):
    """Fixture to create a source passage."""
    passage = server.passage_manager.create_source_passage(
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


@pytest.fixture
def create_test_passages(server: SyncServer, default_file, default_user, sarah_agent, default_source):
    """Helper function to create test passages for all tests."""
    # Create agent passages
    passages = []
    for i in range(5):
        passage = server.passage_manager.create_agent_passage(
            PydanticPassage(
                text=f"Agent passage {i}",
                agent_id=sarah_agent.id,
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
        passage = server.passage_manager.create_source_passage(
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
def hello_world_message_fixture(server: SyncServer, default_user, sarah_agent):
    """Fixture to create a tool with default settings and clean up after the test."""
    # Set up message
    message = PydanticMessage(
        agent_id=sarah_agent.id,
        role="user",
        content=[TextContent(text="Hello, world!")],
    )

    msg = server.message_manager.create_message(message, actor=default_user)
    yield msg


@pytest.fixture
def sandbox_config_fixture(server: SyncServer, default_user):
    sandbox_config_create = SandboxConfigCreate(
        config=E2BSandboxConfig(),
    )
    created_config = server.sandbox_config_manager.create_or_update_sandbox_config(sandbox_config_create, actor=default_user)
    yield created_config


@pytest.fixture
def sandbox_env_var_fixture(server: SyncServer, sandbox_config_fixture, default_user):
    env_var_create = SandboxEnvironmentVariableCreate(
        key="SAMPLE_VAR",
        value="sample_value",
        description="A sample environment variable for testing.",
    )
    created_env_var = server.sandbox_config_manager.create_sandbox_env_var(
        env_var_create, sandbox_config_id=sandbox_config_fixture.id, actor=default_user
    )
    yield created_env_var


@pytest.fixture
def default_block(server: SyncServer, default_user):
    """Fixture to create and return a default block."""
    block_manager = BlockManager()
    block_data = PydanticBlock(
        label="default_label",
        value="Default Block Content",
        description="A default test block",
        limit=1000,
        metadata={"type": "test"},
    )
    block = block_manager.create_or_update_block(block_data, actor=default_user)
    yield block


@pytest.fixture
def other_block(server: SyncServer, default_user):
    """Fixture to create and return another block."""
    block_manager = BlockManager()
    block_data = PydanticBlock(
        label="other_label",
        value="Other Block Content",
        description="Another test block",
        limit=500,
        metadata={"type": "test"},
    )
    block = block_manager.create_or_update_block(block_data, actor=default_user)
    yield block


@pytest.fixture
async def other_tool(server: SyncServer, default_user, default_organization):
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

    # Yield the created tool
    yield tool


@pytest.fixture
async def sarah_agent(server: SyncServer, default_user, default_organization):
    """Fixture to create and return a sample agent within the default organization."""
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
    """Fixture to create and return a sample agent within the default organization."""
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
async def comprehensive_test_agent_fixture(server: SyncServer, default_user, print_tool, default_source, default_block):
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


@pytest.fixture(scope="module")
def server():
    config = LettaConfig.load()

    config.save()

    server = SyncServer(init_with_default_org_and_user=False)
    return server


@pytest.fixture
@pytest.mark.asyncio
async def agent_passages_setup(server, default_source, default_file, default_user, sarah_agent, event_loop):
    """Setup fixture for agent passages tests"""
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

    # Create some agent passages
    agent_passages = []
    for i in range(2):
        passage = await server.passage_manager.create_agent_passage_async(
            PydanticPassage(
                organization_id=actor.organization_id,
                agent_id=agent_id,
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
    """Fixture to create agents with specific tags."""
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


@pytest.fixture
def dummy_llm_config() -> LLMConfig:
    return LLMConfig.default_config("gpt-4o-mini")


@pytest.fixture
def dummy_tool_rules_solver() -> ToolRulesSolver:
    return ToolRulesSolver(tool_rules=[InitToolRule(tool_name="send_message")])


@pytest.fixture
def dummy_step_state(dummy_tool_rules_solver: ToolRulesSolver) -> AgentStepState:
    return AgentStepState(step_number=1, tool_rules_solver=dummy_tool_rules_solver)


@pytest.fixture
def dummy_successful_response() -> BetaMessageBatchIndividualResponse:
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


@pytest.fixture
def letta_batch_job(server: SyncServer, default_user) -> Job:
    return server.job_manager.create_job(BatchJob(user_id=default_user.id), actor=default_user)


@pytest.fixture(scope="session")
def event_loop(request):
    """Create an instance of the default event loop for each test case."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def file_attachment(server, default_user, sarah_agent, default_file):
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


@pytest.fixture
async def another_file(server, default_source, default_user, default_organization):
    pf = PydanticFileMetadata(
        file_name="another_file",
        organization_id=default_organization.id,
        source_id=default_source.id,
    )
    return await server.file_manager.create_file(pf, actor=default_user)


# ======================================================================================================================
# AgentManager Tests - Basic
# ======================================================================================================================
@pytest.mark.asyncio
async def test_validate_agent_exists_async(server: SyncServer, comprehensive_test_agent_fixture, default_user):
    """Test the validate_agent_exists_async helper function"""
    created_agent, _ = comprehensive_test_agent_fixture

    # test with valid agent
    async with db_registry.async_session() as session:
        # should not raise exception
        await validate_agent_exists_async(session, created_agent.id, default_user)

    # test with non-existent agent
    async with db_registry.async_session() as session:
        with pytest.raises(NoResultFound):
            await validate_agent_exists_async(session, "non-existent-id", default_user)


@pytest.mark.asyncio
async def test_create_get_list_agent(server: SyncServer, comprehensive_test_agent_fixture, default_user, event_loop):
    # Test agent creation
    created_agent, create_agent_request = comprehensive_test_agent_fixture
    comprehensive_agent_checks(created_agent, create_agent_request, actor=default_user)

    # Test get agent
    get_agent = await server.agent_manager.get_agent_by_id_async(agent_id=created_agent.id, actor=default_user)
    comprehensive_agent_checks(get_agent, create_agent_request, actor=default_user)

    # Test get agent name
    get_agent_name = server.agent_manager.get_agent_by_name(agent_name=created_agent.name, actor=default_user)
    comprehensive_agent_checks(get_agent_name, create_agent_request, actor=default_user)

    # Test list agent
    list_agents = await server.agent_manager.list_agents_async(actor=default_user)
    assert len(list_agents) == 1
    comprehensive_agent_checks(list_agents[0], create_agent_request, actor=default_user)

    # Test deleting the agent
    server.agent_manager.delete_agent(get_agent.id, default_user)
    list_agents = await server.agent_manager.list_agents_async(actor=default_user)
    assert len(list_agents) == 0


@pytest.mark.asyncio
async def test_create_agent_include_base_tools(server: SyncServer, default_user, event_loop):
    """Test agent creation with include_default_source=True"""
    # Upsert base tools
    server.tool_manager.upsert_base_tools(actor=default_user)

    memory_blocks = [CreateBlock(label="human", value="TestUser"), CreateBlock(label="persona", value="I am a test assistant")]

    create_agent_request = CreateAgent(
        name="test_default_source_agent",
        system="test system",
        memory_blocks=memory_blocks,
        llm_config=LLMConfig.default_config("gpt-4o-mini"),
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
        include_base_tools=True,
    )

    # Create the agent
    created_agent = await server.agent_manager.create_agent_async(
        create_agent_request,
        actor=default_user,
    )

    # Assert the tools exist
    tool_names = [t.name for t in created_agent.tools]
    expected_tools = calculate_base_tools(is_v2=True)
    assert sorted(tool_names) == sorted(expected_tools)


def test_calculate_multi_agent_tools(set_letta_environment):
    """Test that calculate_multi_agent_tools excludes local-only tools in production."""
    result = calculate_multi_agent_tools()

    if set_letta_environment == "PRODUCTION":
        # Production environment should exclude local-only tools
        expected_tools = set(MULTI_AGENT_TOOLS) - set(LOCAL_ONLY_MULTI_AGENT_TOOLS)
        assert result == expected_tools, "Production should exclude local-only multi-agent tools"
        assert not set(LOCAL_ONLY_MULTI_AGENT_TOOLS).intersection(result), "Production should not include local-only tools"

        # Verify specific tools
        assert "send_message_to_agent_and_wait_for_reply" in result, "Standard multi-agent tools should be in production"
        assert "send_message_to_agents_matching_tags" in result, "Standard multi-agent tools should be in production"
        assert "send_message_to_agent_async" not in result, "Local-only tools should not be in production"
    else:
        # Non-production environment should include all multi-agent tools
        assert result == set(MULTI_AGENT_TOOLS), "Non-production should include all multi-agent tools"
        assert set(LOCAL_ONLY_MULTI_AGENT_TOOLS).issubset(result), "Non-production should include local-only tools"

        # Verify specific tools
        assert "send_message_to_agent_and_wait_for_reply" in result, "All multi-agent tools should be in non-production"
        assert "send_message_to_agents_matching_tags" in result, "All multi-agent tools should be in non-production"
        assert "send_message_to_agent_async" in result, "Local-only tools should be in non-production"


async def test_upsert_base_tools_excludes_local_only_in_production(server: SyncServer, default_user, set_letta_environment, event_loop):
    """Test that upsert_base_tools excludes local-only multi-agent tools in production."""
    # Upsert all base tools
    tools = await server.tool_manager.upsert_base_tools_async(actor=default_user)
    tool_names = {tool.name for tool in tools}

    if set_letta_environment == "PRODUCTION":
        # Production environment should exclude local-only multi-agent tools
        for local_only_tool in LOCAL_ONLY_MULTI_AGENT_TOOLS:
            assert local_only_tool not in tool_names, f"Local-only tool '{local_only_tool}' should not be upserted in production"

        # But should include standard multi-agent tools
        standard_multi_agent_tools = set(MULTI_AGENT_TOOLS) - set(LOCAL_ONLY_MULTI_AGENT_TOOLS)
        for standard_tool in standard_multi_agent_tools:
            assert standard_tool in tool_names, f"Standard multi-agent tool '{standard_tool}' should be upserted in production"
    else:
        # Non-production environment should include all multi-agent tools
        for tool in MULTI_AGENT_TOOLS:
            assert tool in tool_names, f"Multi-agent tool '{tool}' should be upserted in non-production"


async def test_upsert_multi_agent_tools_only(server: SyncServer, default_user, set_letta_environment, event_loop):
    """Test that upserting only multi-agent tools respects production filtering."""
    from letta.orm.enums import ToolType

    # Upsert only multi-agent tools
    tools = await server.tool_manager.upsert_base_tools_async(actor=default_user, allowed_types={ToolType.LETTA_MULTI_AGENT_CORE})
    tool_names = {tool.name for tool in tools}

    if set_letta_environment == "PRODUCTION":
        # Should only have non-local multi-agent tools
        expected_tools = set(MULTI_AGENT_TOOLS) - set(LOCAL_ONLY_MULTI_AGENT_TOOLS)
        assert tool_names == expected_tools, "Production multi-agent upsert should exclude local-only tools"
        assert "send_message_to_agent_async" not in tool_names, "Local-only async tool should not be upserted in production"
    else:
        # Should have all multi-agent tools
        assert tool_names == set(MULTI_AGENT_TOOLS), "Non-production multi-agent upsert should include all tools"
        assert "send_message_to_agent_async" in tool_names, "Local-only async tool should be upserted in non-production"


@pytest.mark.asyncio
async def test_create_agent_with_default_source(server: SyncServer, default_user, print_tool, default_block, event_loop):
    """Test agent creation with include_default_source=True"""
    memory_blocks = [CreateBlock(label="human", value="TestUser"), CreateBlock(label="persona", value="I am a test assistant")]

    create_agent_request = CreateAgent(
        name="test_default_source_agent",
        system="test system",
        memory_blocks=memory_blocks,
        llm_config=LLMConfig.default_config("gpt-4o-mini"),
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
        block_ids=[default_block.id],
        tool_ids=[print_tool.id],
        include_default_source=True,  # This is the key field we're testing
        include_base_tools=False,
    )

    # Create the agent
    created_agent = await server.agent_manager.create_agent_async(
        create_agent_request,
        actor=default_user,
    )

    # Verify agent was created
    assert created_agent is not None
    assert created_agent.name == "test_default_source_agent"

    # Verify that a default source was created and attached
    attached_sources = await server.agent_manager.list_attached_sources_async(agent_id=created_agent.id, actor=default_user)

    # Should have exactly one source (the default one)
    assert len(attached_sources) == 1
    auto_default_source = attached_sources[0]

    # Verify the default source properties
    assert created_agent.name in auto_default_source.name
    assert auto_default_source.embedding_config.embedding_endpoint_type == "openai"

    # Test with include_default_source=False
    create_agent_request_no_source = CreateAgent(
        name="test_no_default_source_agent",
        system="test system",
        memory_blocks=memory_blocks,
        llm_config=LLMConfig.default_config("gpt-4o-mini"),
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
        block_ids=[default_block.id],
        tool_ids=[print_tool.id],
        include_default_source=False,  # Explicitly set to False
        include_base_tools=False,
    )

    created_agent_no_source = await server.agent_manager.create_agent_async(
        create_agent_request_no_source,
        actor=default_user,
    )

    # Verify no sources are attached
    attached_sources_no_source = await server.agent_manager.list_attached_sources_async(
        agent_id=created_agent_no_source.id, actor=default_user
    )

    assert len(attached_sources_no_source) == 0

    # Clean up
    server.agent_manager.delete_agent(created_agent.id, default_user)
    server.agent_manager.delete_agent(created_agent_no_source.id, default_user)


@pytest.fixture(params=["", "PRODUCTION"])
def set_letta_environment(request):
    original = os.environ.get("LETTA_ENVIRONMENT")
    os.environ["LETTA_ENVIRONMENT"] = request.param
    yield request.param
    # Restore original environment variable
    if original is not None:
        os.environ["LETTA_ENVIRONMENT"] = original
    else:
        os.environ.pop("LETTA_ENVIRONMENT", None)


@pytest.mark.asyncio
async def test_get_context_window_basic(
    server: SyncServer, comprehensive_test_agent_fixture, default_user, default_file, event_loop, set_letta_environment
):
    # Test agent creation
    created_agent, create_agent_request = comprehensive_test_agent_fixture

    # Attach a file
    assoc, closed_files = await server.file_agent_manager.attach_file(
        agent_id=created_agent.id,
        file_id=default_file.id,
        file_name=default_file.file_name,
        source_id=default_file.source_id,
        actor=default_user,
        visible_content="hello",
        max_files_open=created_agent.max_files_open,
    )

    # Get context window and check for basic appearances
    context_window_overview = await server.agent_manager.get_context_window(agent_id=created_agent.id, actor=default_user)
    validate_context_window_overview(created_agent, context_window_overview, assoc)

    # Test deleting the agent
    server.agent_manager.delete_agent(created_agent.id, default_user)
    list_agents = await server.agent_manager.list_agents_async(actor=default_user)
    assert len(list_agents) == 0


@pytest.mark.asyncio
async def test_create_agent_passed_in_initial_messages(server: SyncServer, default_user, default_block, event_loop):
    memory_blocks = [CreateBlock(label="human", value="BananaBoy"), CreateBlock(label="persona", value="I am a helpful assistant")]
    create_agent_request = CreateAgent(
        system="test system",
        memory_blocks=memory_blocks,
        llm_config=LLMConfig.default_config("gpt-4o-mini"),
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
        block_ids=[default_block.id],
        tags=["a", "b"],
        description="test_description",
        initial_message_sequence=[MessageCreate(role=MessageRole.user, content="hello world")],
        include_base_tools=False,
    )
    agent_state = await server.agent_manager.create_agent_async(
        create_agent_request,
        actor=default_user,
    )
    assert await server.message_manager.size_async(agent_id=agent_state.id, actor=default_user) == 2
    init_messages = await server.message_manager.get_messages_by_ids_async(message_ids=agent_state.message_ids, actor=default_user)

    # Check that the system appears in the first initial message
    assert create_agent_request.system in init_messages[0].content[0].text
    assert create_agent_request.memory_blocks[0].value in init_messages[0].content[0].text
    # Check that the second message is the passed in initial message seq
    assert create_agent_request.initial_message_sequence[0].role == init_messages[1].role
    assert create_agent_request.initial_message_sequence[0].content in init_messages[1].content[0].text


@pytest.mark.asyncio
async def test_create_agent_default_initial_message(server: SyncServer, default_user, default_block, event_loop):
    memory_blocks = [CreateBlock(label="human", value="BananaBoy"), CreateBlock(label="persona", value="I am a helpful assistant")]
    create_agent_request = CreateAgent(
        system="test system",
        memory_blocks=memory_blocks,
        llm_config=LLMConfig.default_config("gpt-4o-mini"),
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
        block_ids=[default_block.id],
        tags=["a", "b"],
        description="test_description",
        include_base_tools=False,
    )
    agent_state = await server.agent_manager.create_agent_async(
        create_agent_request,
        actor=default_user,
    )
    assert await server.message_manager.size_async(agent_id=agent_state.id, actor=default_user) == 4
    init_messages = await server.message_manager.get_messages_by_ids_async(message_ids=agent_state.message_ids, actor=default_user)
    # Check that the system appears in the first initial message
    assert create_agent_request.system in init_messages[0].content[0].text
    assert create_agent_request.memory_blocks[0].value in init_messages[0].content[0].text


@pytest.mark.asyncio
async def test_create_agent_with_json_in_system_message(server: SyncServer, default_user, default_block, event_loop):
    system_prompt = (
        "You are an expert teaching agent with encyclopedic knowledge. "
        "When you receive a topic, query the external database for more "
        "information. Format the queries as a JSON list of queries making "
        "sure to include your reasoning for that query, e.g. "
        "{'query1' : 'reason1', 'query2' : 'reason2'}"
    )
    create_agent_request = CreateAgent(
        system=system_prompt,
        llm_config=LLMConfig.default_config("gpt-4o-mini"),
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
        block_ids=[default_block.id],
        tags=["a", "b"],
        description="test_description",
        include_base_tools=False,
    )
    agent_state = await server.agent_manager.create_agent_async(
        create_agent_request,
        actor=default_user,
    )
    assert agent_state is not None
    system_message_id = agent_state.message_ids[0]
    system_message = await server.message_manager.get_message_by_id_async(message_id=system_message_id, actor=default_user)
    assert system_prompt in system_message.content[0].text
    assert default_block.value in system_message.content[0].text
    server.agent_manager.delete_agent(agent_id=agent_state.id, actor=default_user)


@pytest.mark.asyncio
async def test_update_agent(
    server: SyncServer, comprehensive_test_agent_fixture, other_tool, other_source, other_block, default_user, event_loop
):
    agent, _ = comprehensive_test_agent_fixture
    update_agent_request = UpdateAgent(
        name="train_agent",
        description="train description",
        tool_ids=[other_tool.id],
        source_ids=[other_source.id],
        block_ids=[other_block.id],
        tool_rules=[InitToolRule(tool_name=other_tool.name)],
        tags=["c", "d"],
        system="train system",
        llm_config=LLMConfig.default_config("gpt-4o-mini"),
        embedding_config=EmbeddingConfig.default_config(model_name="letta"),
        message_ids=["10", "20"],
        metadata={"train_key": "train_value"},
        tool_exec_environment_variables={"test_env_var_key_a": "a", "new_tool_exec_key": "n"},
        message_buffer_autoclear=False,
    )

    last_updated_timestamp = agent.updated_at
    updated_agent = await server.agent_manager.update_agent_async(agent.id, update_agent_request, actor=default_user)
    comprehensive_agent_checks(updated_agent, update_agent_request, actor=default_user)
    assert updated_agent.message_ids == update_agent_request.message_ids
    assert updated_agent.updated_at > last_updated_timestamp


@pytest.mark.asyncio
async def test_agent_file_defaults_based_on_context_window(server: SyncServer, default_user, default_block, event_loop):
    """Test that file-related defaults are set based on the model's context window size"""

    # test with small context window model (8k)
    llm_config_small = LLMConfig.default_config("gpt-4o-mini")
    llm_config_small.context_window = 8000
    create_agent_request = CreateAgent(
        name="test_agent_small_context",
        llm_config=llm_config_small,
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
        block_ids=[default_block.id],
        include_base_tools=False,
    )
    agent_state = await server.agent_manager.create_agent_async(
        create_agent_request,
        actor=default_user,
    )
    assert agent_state.max_files_open == 3
    assert (
        agent_state.per_file_view_window_char_limit == calculate_file_defaults_based_on_context_window(llm_config_small.context_window)[1]
    )
    server.agent_manager.delete_agent(agent_id=agent_state.id, actor=default_user)

    # test with medium context window model (32k)
    llm_config_medium = LLMConfig.default_config("gpt-4o-mini")
    llm_config_medium.context_window = 32000
    create_agent_request = CreateAgent(
        name="test_agent_medium_context",
        llm_config=llm_config_medium,
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
        block_ids=[default_block.id],
        include_base_tools=False,
    )
    agent_state = await server.agent_manager.create_agent_async(
        create_agent_request,
        actor=default_user,
    )
    assert agent_state.max_files_open == 5
    assert (
        agent_state.per_file_view_window_char_limit == calculate_file_defaults_based_on_context_window(llm_config_medium.context_window)[1]
    )
    server.agent_manager.delete_agent(agent_id=agent_state.id, actor=default_user)

    # test with large context window model (128k)
    llm_config_large = LLMConfig.default_config("gpt-4o-mini")
    llm_config_large.context_window = 128000
    create_agent_request = CreateAgent(
        name="test_agent_large_context",
        llm_config=llm_config_large,
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
        block_ids=[default_block.id],
        include_base_tools=False,
    )
    agent_state = await server.agent_manager.create_agent_async(
        create_agent_request,
        actor=default_user,
    )
    assert agent_state.max_files_open == 10
    assert (
        agent_state.per_file_view_window_char_limit == calculate_file_defaults_based_on_context_window(llm_config_large.context_window)[1]
    )
    server.agent_manager.delete_agent(agent_id=agent_state.id, actor=default_user)


@pytest.mark.asyncio
async def test_agent_file_defaults_explicit_values(server: SyncServer, default_user, default_block, event_loop):
    """Test that explicitly set file-related values are respected"""

    llm_config_explicit = LLMConfig.default_config("gpt-4o-mini")
    llm_config_explicit.context_window = 32000  # would normally get defaults of 5 and 30k
    create_agent_request = CreateAgent(
        name="test_agent_explicit_values",
        llm_config=llm_config_explicit,
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
        block_ids=[default_block.id],
        include_base_tools=False,
        max_files_open=20,  # explicit value
        per_file_view_window_char_limit=500_000,  # explicit value
    )
    agent_state = await server.agent_manager.create_agent_async(
        create_agent_request,
        actor=default_user,
    )
    # verify explicit values are used instead of defaults
    assert agent_state.max_files_open == 20
    assert agent_state.per_file_view_window_char_limit == 500_000
    server.agent_manager.delete_agent(agent_id=agent_state.id, actor=default_user)


@pytest.mark.asyncio
async def test_update_agent_file_fields(server: SyncServer, comprehensive_test_agent_fixture, default_user, event_loop):
    """Test updating file-related fields on an existing agent"""

    agent, _ = comprehensive_test_agent_fixture

    # update file-related fields
    update_request = UpdateAgent(
        max_files_open=15,
        per_file_view_window_char_limit=150_000,
    )
    updated_agent = await server.agent_manager.update_agent_async(agent.id, update_request, actor=default_user)

    assert updated_agent.max_files_open == 15
    assert updated_agent.per_file_view_window_char_limit == 150_000


# ======================================================================================================================
# AgentManager Tests - Listing
# ======================================================================================================================


@pytest.mark.asyncio
async def test_list_agents_select_fields_empty(server: SyncServer, comprehensive_test_agent_fixture, default_user, event_loop):
    # Create an agent using the comprehensive fixture.
    created_agent, create_agent_request = comprehensive_test_agent_fixture

    # List agents using an empty list for select_fields.
    agents = await server.agent_manager.list_agents_async(actor=default_user, include_relationships=[])
    # Assert that the agent is returned and basic fields are present.
    assert len(agents) >= 1
    agent = agents[0]
    assert agent.id is not None
    assert agent.name is not None

    # Assert no relationships were loaded
    assert len(agent.tools) == 0
    assert len(agent.tags) == 0


@pytest.mark.asyncio
async def test_list_agents_select_fields_none(server: SyncServer, comprehensive_test_agent_fixture, default_user, event_loop):
    # Create an agent using the comprehensive fixture.
    created_agent, create_agent_request = comprehensive_test_agent_fixture

    # List agents using an empty list for select_fields.
    agents = await server.agent_manager.list_agents_async(actor=default_user, include_relationships=None)
    # Assert that the agent is returned and basic fields are present.
    assert len(agents) >= 1
    agent = agents[0]
    assert agent.id is not None
    assert agent.name is not None

    # Assert no relationships were loaded
    assert len(agent.tools) > 0
    assert len(agent.tags) > 0


@pytest.mark.asyncio
async def test_list_agents_select_fields_specific(server: SyncServer, comprehensive_test_agent_fixture, default_user, event_loop):
    created_agent, create_agent_request = comprehensive_test_agent_fixture

    # Choose a subset of valid relationship fields.
    valid_fields = ["tools", "tags"]
    agents = await server.agent_manager.list_agents_async(actor=default_user, include_relationships=valid_fields)
    assert len(agents) >= 1
    agent = agents[0]
    # Depending on your to_pydantic() implementation,
    # verify that the fields exist in the returned pydantic model.
    # (Note: These assertions may require that your CreateAgent fixture sets up these relationships.)
    assert agent.tools
    assert sorted(agent.tags) == ["a", "b"]
    assert not agent.memory.blocks


@pytest.mark.asyncio
async def test_list_agents_select_fields_invalid(server: SyncServer, comprehensive_test_agent_fixture, default_user, event_loop):
    created_agent, create_agent_request = comprehensive_test_agent_fixture

    # Provide field names that are not recognized.
    invalid_fields = ["foobar", "nonexistent_field"]
    # The expectation is that these fields are simply ignored.
    agents = await server.agent_manager.list_agents_async(actor=default_user, include_relationships=invalid_fields)
    assert len(agents) >= 1
    agent = agents[0]
    # Verify that standard fields are still present.c
    assert agent.id is not None
    assert agent.name is not None


@pytest.mark.asyncio
async def test_list_agents_select_fields_duplicates(server: SyncServer, comprehensive_test_agent_fixture, default_user, event_loop):
    created_agent, create_agent_request = comprehensive_test_agent_fixture

    # Provide duplicate valid field names.
    duplicate_fields = ["tools", "tools", "tags", "tags"]
    agents = await server.agent_manager.list_agents_async(actor=default_user, include_relationships=duplicate_fields)
    assert len(agents) >= 1
    agent = agents[0]
    # Verify that the agent pydantic representation includes the relationships.
    # Even if duplicates were provided, the query should not break.
    assert isinstance(agent.tools, list)
    assert isinstance(agent.tags, list)


@pytest.mark.asyncio
async def test_list_agents_select_fields_mixed(server: SyncServer, comprehensive_test_agent_fixture, default_user, event_loop):
    created_agent, create_agent_request = comprehensive_test_agent_fixture

    # Mix valid fields with an invalid one.
    mixed_fields = ["tools", "invalid_field"]
    agents = await server.agent_manager.list_agents_async(actor=default_user, include_relationships=mixed_fields)
    assert len(agents) >= 1
    agent = agents[0]
    # Valid fields should be loaded and accessible.
    assert agent.tools
    # Since "invalid_field" is not recognized, it should have no adverse effect.
    # You might optionally check that no extra attribute is created on the pydantic model.
    assert not hasattr(agent, "invalid_field")


@pytest.mark.asyncio
async def test_list_agents_ascending(server: SyncServer, default_user, event_loop):
    # Create two agents with known names
    agent1 = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="agent_oldest",
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            memory_blocks=[],
            include_base_tools=False,
        ),
        actor=default_user,
    )

    if USING_SQLITE:
        time.sleep(CREATE_DELAY_SQLITE)

    agent2 = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="agent_newest",
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            memory_blocks=[],
            include_base_tools=False,
        ),
        actor=default_user,
    )

    agents = await server.agent_manager.list_agents_async(actor=default_user, ascending=True)
    names = [agent.name for agent in agents]
    assert names.index("agent_oldest") < names.index("agent_newest")


@pytest.mark.asyncio
async def test_list_agents_descending(server: SyncServer, default_user, event_loop):
    # Create two agents with known names
    agent1 = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="agent_oldest",
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            memory_blocks=[],
            include_base_tools=False,
        ),
        actor=default_user,
    )

    if USING_SQLITE:
        time.sleep(CREATE_DELAY_SQLITE)

    agent2 = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="agent_newest",
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            memory_blocks=[],
            include_base_tools=False,
        ),
        actor=default_user,
    )

    agents = await server.agent_manager.list_agents_async(actor=default_user, ascending=False)
    names = [agent.name for agent in agents]
    assert names.index("agent_newest") < names.index("agent_oldest")


@pytest.mark.asyncio
async def test_list_agents_ordering_and_pagination(server: SyncServer, default_user, event_loop):
    names = ["alpha_agent", "beta_agent", "gamma_agent"]
    created_agents = []

    # Create agents in known order
    for name in names:
        agent = await server.agent_manager.create_agent_async(
            agent_create=CreateAgent(
                name=name,
                memory_blocks=[],
                llm_config=LLMConfig.default_config("gpt-4o-mini"),
                embedding_config=EmbeddingConfig.default_config(provider="openai"),
                include_base_tools=False,
            ),
            actor=default_user,
        )
        created_agents.append(agent)
        if USING_SQLITE:
            time.sleep(CREATE_DELAY_SQLITE)

    agent_ids = {agent.name: agent.id for agent in created_agents}

    # Ascending (oldest to newest)
    agents_asc = await server.agent_manager.list_agents_async(actor=default_user, ascending=True)
    asc_names = [agent.name for agent in agents_asc]
    assert asc_names.index("alpha_agent") < asc_names.index("beta_agent") < asc_names.index("gamma_agent")

    # Descending (newest to oldest)
    agents_desc = await server.agent_manager.list_agents_async(actor=default_user, ascending=False)
    desc_names = [agent.name for agent in agents_desc]
    assert desc_names.index("gamma_agent") < desc_names.index("beta_agent") < desc_names.index("alpha_agent")

    # After: Get agents after alpha_agent in ascending order (should exclude alpha)
    after_alpha = await server.agent_manager.list_agents_async(actor=default_user, after=agent_ids["alpha_agent"], ascending=True)
    after_names = [a.name for a in after_alpha]
    assert "alpha_agent" not in after_names
    assert "beta_agent" in after_names
    assert "gamma_agent" in after_names
    assert after_names == ["beta_agent", "gamma_agent"]

    # Before: Get agents before gamma_agent in ascending order (should exclude gamma)
    before_gamma = await server.agent_manager.list_agents_async(actor=default_user, before=agent_ids["gamma_agent"], ascending=True)
    before_names = [a.name for a in before_gamma]
    assert "gamma_agent" not in before_names
    assert "alpha_agent" in before_names
    assert "beta_agent" in before_names
    assert before_names == ["alpha_agent", "beta_agent"]

    # After: Get agents after gamma_agent in descending order (should exclude gamma, return beta then alpha)
    after_gamma_desc = await server.agent_manager.list_agents_async(actor=default_user, after=agent_ids["gamma_agent"], ascending=False)
    after_names_desc = [a.name for a in after_gamma_desc]
    assert after_names_desc == ["beta_agent", "alpha_agent"]

    # Before: Get agents before alpha_agent in descending order (should exclude alpha)
    before_alpha_desc = await server.agent_manager.list_agents_async(actor=default_user, before=agent_ids["alpha_agent"], ascending=False)
    before_names_desc = [a.name for a in before_alpha_desc]
    assert before_names_desc == ["gamma_agent", "beta_agent"]


# ======================================================================================================================
# AgentManager Tests - Tools Relationship
# ======================================================================================================================


@pytest.mark.asyncio
async def test_attach_tool(server: SyncServer, sarah_agent, print_tool, default_user, event_loop):
    """Test attaching a tool to an agent."""
    # Attach the tool
    await server.agent_manager.attach_tool_async(agent_id=sarah_agent.id, tool_id=print_tool.id, actor=default_user)

    # Verify attachment through get_agent_by_id
    agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    assert print_tool.id in [t.id for t in agent.tools]

    # Verify that attaching the same tool again doesn't cause duplication
    await server.agent_manager.attach_tool_async(agent_id=sarah_agent.id, tool_id=print_tool.id, actor=default_user)
    agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    assert len([t for t in agent.tools if t.id == print_tool.id]) == 1


@pytest.mark.asyncio
async def test_detach_tool(server: SyncServer, sarah_agent, print_tool, default_user, event_loop):
    """Test detaching a tool from an agent."""
    # Attach the tool first
    await server.agent_manager.attach_tool_async(agent_id=sarah_agent.id, tool_id=print_tool.id, actor=default_user)

    # Verify it's attached
    agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    assert print_tool.id in [t.id for t in agent.tools]

    # Detach the tool
    await server.agent_manager.detach_tool_async(agent_id=sarah_agent.id, tool_id=print_tool.id, actor=default_user)

    # Verify it's detached
    agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    assert print_tool.id not in [t.id for t in agent.tools]

    # Verify that detaching an already detached tool doesn't cause issues
    await server.agent_manager.detach_tool_async(agent_id=sarah_agent.id, tool_id=print_tool.id, actor=default_user)


@pytest.mark.asyncio
async def test_bulk_detach_tools(server: SyncServer, sarah_agent, print_tool, other_tool, default_user, event_loop):
    """Test bulk detaching multiple tools from an agent."""
    # First attach both tools
    tool_ids = [print_tool.id, other_tool.id]
    await server.agent_manager.bulk_attach_tools_async(agent_id=sarah_agent.id, tool_ids=tool_ids, actor=default_user)

    # Verify both tools are attached
    agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    assert print_tool.id in [t.id for t in agent.tools]
    assert other_tool.id in [t.id for t in agent.tools]

    # Bulk detach both tools
    await server.agent_manager.bulk_detach_tools_async(agent_id=sarah_agent.id, tool_ids=tool_ids, actor=default_user)

    # Verify both tools are detached
    agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    assert print_tool.id not in [t.id for t in agent.tools]
    assert other_tool.id not in [t.id for t in agent.tools]


@pytest.mark.asyncio
async def test_bulk_detach_tools_partial(server: SyncServer, sarah_agent, print_tool, other_tool, default_user, event_loop):
    """Test bulk detaching tools when some are not attached."""
    # Only attach one tool
    await server.agent_manager.attach_tool_async(agent_id=sarah_agent.id, tool_id=print_tool.id, actor=default_user)

    # Try to bulk detach both tools (one attached, one not)
    tool_ids = [print_tool.id, other_tool.id]
    await server.agent_manager.bulk_detach_tools_async(agent_id=sarah_agent.id, tool_ids=tool_ids, actor=default_user)

    # Verify the attached tool was detached
    agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    assert print_tool.id not in [t.id for t in agent.tools]
    assert other_tool.id not in [t.id for t in agent.tools]


@pytest.mark.asyncio
async def test_bulk_detach_tools_empty_list(server: SyncServer, sarah_agent, print_tool, default_user, event_loop):
    """Test bulk detaching empty list of tools."""
    # Attach a tool first
    await server.agent_manager.attach_tool_async(agent_id=sarah_agent.id, tool_id=print_tool.id, actor=default_user)

    # Bulk detach empty list
    await server.agent_manager.bulk_detach_tools_async(agent_id=sarah_agent.id, tool_ids=[], actor=default_user)

    # Verify the tool is still attached
    agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    assert print_tool.id in [t.id for t in agent.tools]


@pytest.mark.asyncio
async def test_bulk_detach_tools_idempotent(server: SyncServer, sarah_agent, print_tool, other_tool, default_user, event_loop):
    """Test that bulk detach is idempotent."""
    # Attach both tools
    tool_ids = [print_tool.id, other_tool.id]
    await server.agent_manager.bulk_attach_tools_async(agent_id=sarah_agent.id, tool_ids=tool_ids, actor=default_user)

    # Bulk detach once
    await server.agent_manager.bulk_detach_tools_async(agent_id=sarah_agent.id, tool_ids=tool_ids, actor=default_user)

    # Verify tools are detached
    agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    assert len(agent.tools) == 0

    # Bulk detach again (should be no-op, no errors)
    await server.agent_manager.bulk_detach_tools_async(agent_id=sarah_agent.id, tool_ids=tool_ids, actor=default_user)

    # Verify still no tools
    agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    assert len(agent.tools) == 0


@pytest.mark.asyncio
async def test_bulk_detach_tools_nonexistent_agent(server: SyncServer, print_tool, other_tool, default_user, event_loop):
    """Test bulk detaching tools from a nonexistent agent."""
    nonexistent_agent_id = "nonexistent-agent-id"
    tool_ids = [print_tool.id, other_tool.id]

    with pytest.raises(NoResultFound):
        await server.agent_manager.bulk_detach_tools_async(agent_id=nonexistent_agent_id, tool_ids=tool_ids, actor=default_user)


@pytest.mark.asyncio
async def test_attach_tool_nonexistent_agent(server: SyncServer, print_tool, default_user):
    """Test attaching a tool to a nonexistent agent."""
    with pytest.raises(NoResultFound):
        await server.agent_manager.attach_tool_async(agent_id="nonexistent-agent-id", tool_id=print_tool.id, actor=default_user)


@pytest.mark.asyncio
async def test_attach_tool_nonexistent_tool(server: SyncServer, sarah_agent, default_user):
    """Test attaching a nonexistent tool to an agent."""
    with pytest.raises(NoResultFound):
        await server.agent_manager.attach_tool_async(agent_id=sarah_agent.id, tool_id="nonexistent-tool-id", actor=default_user)


@pytest.mark.asyncio
async def test_detach_tool_nonexistent_agent(server: SyncServer, print_tool, default_user):
    """Test detaching a tool from a nonexistent agent."""
    with pytest.raises(NoResultFound):
        await server.agent_manager.detach_tool_async(agent_id="nonexistent-agent-id", tool_id=print_tool.id, actor=default_user)


@pytest.mark.asyncio
async def test_list_attached_tools(server: SyncServer, sarah_agent, print_tool, other_tool, default_user, event_loop):
    """Test listing tools attached to an agent."""
    # Initially should have no tools
    agent = await server.agent_manager.get_agent_by_id_async(sarah_agent.id, actor=default_user)
    assert len(agent.tools) == 0

    # Attach tools
    await server.agent_manager.attach_tool_async(agent_id=sarah_agent.id, tool_id=print_tool.id, actor=default_user)
    await server.agent_manager.attach_tool_async(agent_id=sarah_agent.id, tool_id=other_tool.id, actor=default_user)

    # List tools and verify
    agent = await server.agent_manager.get_agent_by_id_async(sarah_agent.id, actor=default_user)
    attached_tool_ids = [t.id for t in agent.tools]
    assert len(attached_tool_ids) == 2
    assert print_tool.id in attached_tool_ids
    assert other_tool.id in attached_tool_ids


@pytest.mark.asyncio
async def test_bulk_attach_tools(server: SyncServer, sarah_agent, print_tool, other_tool, default_user, event_loop):
    """Test bulk attaching multiple tools to an agent."""
    # Bulk attach both tools
    tool_ids = [print_tool.id, other_tool.id]
    await server.agent_manager.bulk_attach_tools_async(agent_id=sarah_agent.id, tool_ids=tool_ids, actor=default_user)

    # Verify both tools are attached
    agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    attached_tool_ids = [t.id for t in agent.tools]
    assert print_tool.id in attached_tool_ids
    assert other_tool.id in attached_tool_ids


@pytest.mark.asyncio
async def test_bulk_attach_tools_with_duplicates(server: SyncServer, sarah_agent, print_tool, other_tool, default_user, event_loop):
    """Test bulk attaching tools handles duplicates correctly."""
    # First attach one tool
    await server.agent_manager.attach_tool_async(agent_id=sarah_agent.id, tool_id=print_tool.id, actor=default_user)

    # Bulk attach both tools (one already attached)
    tool_ids = [print_tool.id, other_tool.id]
    await server.agent_manager.bulk_attach_tools_async(agent_id=sarah_agent.id, tool_ids=tool_ids, actor=default_user)

    # Verify both tools are attached and no duplicates
    agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    attached_tool_ids = [t.id for t in agent.tools]
    assert len(attached_tool_ids) == 2
    assert print_tool.id in attached_tool_ids
    assert other_tool.id in attached_tool_ids
    # Ensure no duplicates
    assert len(set(attached_tool_ids)) == len(attached_tool_ids)


@pytest.mark.asyncio
async def test_bulk_attach_tools_empty_list(server: SyncServer, sarah_agent, default_user, event_loop):
    """Test bulk attaching empty list of tools."""
    # Bulk attach empty list
    await server.agent_manager.bulk_attach_tools_async(agent_id=sarah_agent.id, tool_ids=[], actor=default_user)

    # Verify no tools are attached
    agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    assert len(agent.tools) == 0


@pytest.mark.asyncio
async def test_bulk_attach_tools_nonexistent_tool(server: SyncServer, sarah_agent, print_tool, default_user, event_loop):
    """Test bulk attaching tools with a nonexistent tool ID."""
    # Try to bulk attach with one valid and one invalid tool ID
    nonexistent_id = "nonexistent-tool-id"
    tool_ids = [print_tool.id, nonexistent_id]

    with pytest.raises(NoResultFound) as exc_info:
        await server.agent_manager.bulk_attach_tools_async(agent_id=sarah_agent.id, tool_ids=tool_ids, actor=default_user)

    # Verify error message contains the missing tool ID
    assert nonexistent_id in str(exc_info.value)

    # Verify no tools were attached (transaction should have rolled back)
    agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    assert len(agent.tools) == 0


@pytest.mark.asyncio
async def test_bulk_attach_tools_nonexistent_agent(server: SyncServer, print_tool, other_tool, default_user, event_loop):
    """Test bulk attaching tools to a nonexistent agent."""
    nonexistent_agent_id = "nonexistent-agent-id"
    tool_ids = [print_tool.id, other_tool.id]

    with pytest.raises(NoResultFound):
        await server.agent_manager.bulk_attach_tools_async(agent_id=nonexistent_agent_id, tool_ids=tool_ids, actor=default_user)


@pytest.mark.asyncio
async def test_attach_missing_files_tools_async(server: SyncServer, sarah_agent, default_user, event_loop):
    """Test attaching missing file tools to an agent."""
    # First ensure file tools exist in the system
    await server.tool_manager.upsert_base_tools_async(actor=default_user, allowed_types={ToolType.LETTA_FILES_CORE})

    # Get initial agent state (should have no file tools)
    agent_state = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    initial_tool_count = len(agent_state.tools)

    # Attach missing file tools
    updated_agent_state = await server.agent_manager.attach_missing_files_tools_async(agent_state=agent_state, actor=default_user)

    # Verify all file tools are now attached
    file_tool_names = {tool.name for tool in updated_agent_state.tools if tool.tool_type == ToolType.LETTA_FILES_CORE}
    assert file_tool_names == set(FILES_TOOLS)

    # Verify the total tool count increased by the number of file tools
    assert len(updated_agent_state.tools) == initial_tool_count + len(FILES_TOOLS)


@pytest.mark.asyncio
async def test_attach_missing_files_tools_async_partial(server: SyncServer, sarah_agent, default_user, event_loop):
    """Test attaching missing file tools when some are already attached."""
    # First ensure file tools exist in the system
    await server.tool_manager.upsert_base_tools_async(actor=default_user, allowed_types={ToolType.LETTA_FILES_CORE})

    # Get file tool IDs
    all_tools = await server.tool_manager.list_tools_async(actor=default_user)
    file_tools = [tool for tool in all_tools if tool.tool_type == ToolType.LETTA_FILES_CORE and tool.name in FILES_TOOLS]

    # Manually attach just the first file tool
    await server.agent_manager.attach_tool_async(agent_id=sarah_agent.id, tool_id=file_tools[0].id, actor=default_user)

    # Get agent state with one file tool already attached
    agent_state = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    assert len([t for t in agent_state.tools if t.tool_type == ToolType.LETTA_FILES_CORE]) == 1

    # Attach missing file tools
    updated_agent_state = await server.agent_manager.attach_missing_files_tools_async(agent_state=agent_state, actor=default_user)

    # Verify all file tools are now attached
    file_tool_names = {tool.name for tool in updated_agent_state.tools if tool.tool_type == ToolType.LETTA_FILES_CORE}
    assert file_tool_names == set(FILES_TOOLS)

    # Verify no duplicates
    all_tool_ids = [tool.id for tool in updated_agent_state.tools]
    assert len(all_tool_ids) == len(set(all_tool_ids))


@pytest.mark.asyncio
async def test_attach_missing_files_tools_async_idempotent(server: SyncServer, sarah_agent, default_user, event_loop):
    """Test that attach_missing_files_tools is idempotent."""
    # First ensure file tools exist in the system
    await server.tool_manager.upsert_base_tools_async(actor=default_user, allowed_types={ToolType.LETTA_FILES_CORE})

    # Get initial agent state
    agent_state = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)

    # Attach missing file tools the first time
    updated_agent_state = await server.agent_manager.attach_missing_files_tools_async(agent_state=agent_state, actor=default_user)
    first_tool_count = len(updated_agent_state.tools)

    # Call attach_missing_files_tools again (should be no-op)
    final_agent_state = await server.agent_manager.attach_missing_files_tools_async(agent_state=updated_agent_state, actor=default_user)

    # Verify tool count didn't change
    assert len(final_agent_state.tools) == first_tool_count

    # Verify still have all file tools
    file_tool_names = {tool.name for tool in final_agent_state.tools if tool.tool_type == ToolType.LETTA_FILES_CORE}
    assert file_tool_names == set(FILES_TOOLS)


@pytest.mark.asyncio
async def test_detach_all_files_tools_async(server: SyncServer, sarah_agent, default_user, event_loop):
    """Test detaching all file tools from an agent."""
    # First ensure file tools exist and attach them
    await server.tool_manager.upsert_base_tools_async(actor=default_user, allowed_types={ToolType.LETTA_FILES_CORE})

    # Get initial agent state and attach file tools
    agent_state = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    agent_state = await server.agent_manager.attach_missing_files_tools_async(agent_state=agent_state, actor=default_user)

    # Verify file tools are attached
    file_tool_count_before = len([t for t in agent_state.tools if t.tool_type == ToolType.LETTA_FILES_CORE])
    assert file_tool_count_before == len(FILES_TOOLS)

    # Detach all file tools
    updated_agent_state = await server.agent_manager.detach_all_files_tools_async(agent_state=agent_state, actor=default_user)

    # Verify all file tools are detached
    file_tool_count_after = len([t for t in updated_agent_state.tools if t.tool_type == ToolType.LETTA_FILES_CORE])
    assert file_tool_count_after == 0

    # Verify the returned state was modified in-place (no DB reload)
    assert updated_agent_state.id == agent_state.id
    assert len(updated_agent_state.tools) == len(agent_state.tools) - file_tool_count_before


@pytest.mark.asyncio
async def test_detach_all_files_tools_async_empty(server: SyncServer, sarah_agent, default_user, event_loop):
    """Test detaching all file tools when no file tools are attached."""
    # Get agent state (should have no file tools initially)
    agent_state = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    initial_tool_count = len(agent_state.tools)

    # Verify no file tools attached
    file_tool_count = len([t for t in agent_state.tools if t.tool_type == ToolType.LETTA_FILES_CORE])
    assert file_tool_count == 0

    # Call detach_all_files_tools (should be no-op)
    updated_agent_state = await server.agent_manager.detach_all_files_tools_async(agent_state=agent_state, actor=default_user)

    # Verify nothing changed
    assert len(updated_agent_state.tools) == initial_tool_count
    assert updated_agent_state == agent_state  # Should be the same object since no changes


@pytest.mark.asyncio
async def test_detach_all_files_tools_async_with_other_tools(server: SyncServer, sarah_agent, print_tool, default_user, event_loop):
    """Test detaching all file tools preserves non-file tools."""
    # First ensure file tools exist
    await server.tool_manager.upsert_base_tools_async(actor=default_user, allowed_types={ToolType.LETTA_FILES_CORE})

    # Attach a non-file tool
    await server.agent_manager.attach_tool_async(agent_id=sarah_agent.id, tool_id=print_tool.id, actor=default_user)

    # Get agent state and attach file tools
    agent_state = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    agent_state = await server.agent_manager.attach_missing_files_tools_async(agent_state=agent_state, actor=default_user)

    # Verify both file tools and print tool are attached
    file_tools = [t for t in agent_state.tools if t.tool_type == ToolType.LETTA_FILES_CORE]
    assert len(file_tools) == len(FILES_TOOLS)
    assert print_tool.id in [t.id for t in agent_state.tools]

    # Detach all file tools
    updated_agent_state = await server.agent_manager.detach_all_files_tools_async(agent_state=agent_state, actor=default_user)

    # Verify only file tools were removed, print tool remains
    remaining_file_tools = [t for t in updated_agent_state.tools if t.tool_type == ToolType.LETTA_FILES_CORE]
    assert len(remaining_file_tools) == 0
    assert print_tool.id in [t.id for t in updated_agent_state.tools]
    assert len(updated_agent_state.tools) == 1


@pytest.mark.asyncio
async def test_detach_all_files_tools_async_idempotent(server: SyncServer, sarah_agent, default_user, event_loop):
    """Test that detach_all_files_tools is idempotent."""
    # First ensure file tools exist and attach them
    await server.tool_manager.upsert_base_tools_async(actor=default_user, allowed_types={ToolType.LETTA_FILES_CORE})

    # Get initial agent state and attach file tools
    agent_state = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    agent_state = await server.agent_manager.attach_missing_files_tools_async(agent_state=agent_state, actor=default_user)

    # Detach all file tools once
    agent_state = await server.agent_manager.detach_all_files_tools_async(agent_state=agent_state, actor=default_user)

    # Verify no file tools
    assert len([t for t in agent_state.tools if t.tool_type == ToolType.LETTA_FILES_CORE]) == 0
    tool_count_after_first = len(agent_state.tools)

    # Detach all file tools again (should be no-op)
    final_agent_state = await server.agent_manager.detach_all_files_tools_async(agent_state=agent_state, actor=default_user)

    # Verify still no file tools and same tool count
    assert len([t for t in final_agent_state.tools if t.tool_type == ToolType.LETTA_FILES_CORE]) == 0
    assert len(final_agent_state.tools) == tool_count_after_first


# ======================================================================================================================
# AgentManager Tests - Sources Relationship
# ======================================================================================================================


@pytest.mark.asyncio
async def test_attach_source(server: SyncServer, sarah_agent, default_source, default_user, event_loop):
    """Test attaching a source to an agent."""
    # Attach the source
    await server.agent_manager.attach_source_async(agent_id=sarah_agent.id, source_id=default_source.id, actor=default_user)

    # Verify attachment through get_agent_by_id
    agent = await server.agent_manager.get_agent_by_id_async(sarah_agent.id, actor=default_user)
    assert default_source.id in [s.id for s in agent.sources]

    # Verify that attaching the same source again doesn't cause issues
    await server.agent_manager.attach_source_async(agent_id=sarah_agent.id, source_id=default_source.id, actor=default_user)
    agent = await server.agent_manager.get_agent_by_id_async(sarah_agent.id, actor=default_user)
    assert len([s for s in agent.sources if s.id == default_source.id]) == 1


@pytest.mark.asyncio
async def test_list_attached_source_ids(server: SyncServer, sarah_agent, default_source, other_source, default_user, event_loop):
    """Test listing source IDs attached to an agent."""
    # Initially should have no sources
    sources = await server.agent_manager.list_attached_sources_async(sarah_agent.id, actor=default_user)
    assert len(sources) == 0

    # Attach sources
    await server.agent_manager.attach_source_async(sarah_agent.id, default_source.id, actor=default_user)
    await server.agent_manager.attach_source_async(sarah_agent.id, other_source.id, actor=default_user)

    # List sources and verify
    sources = await server.agent_manager.list_attached_sources_async(sarah_agent.id, actor=default_user)
    assert len(sources) == 2
    source_ids = [s.id for s in sources]
    assert default_source.id in source_ids
    assert other_source.id in source_ids


@pytest.mark.asyncio
async def test_detach_source(server: SyncServer, sarah_agent, default_source, default_user, event_loop):
    """Test detaching a source from an agent."""
    # Attach source
    await server.agent_manager.attach_source_async(sarah_agent.id, default_source.id, actor=default_user)

    # Verify it's attached
    agent = await server.agent_manager.get_agent_by_id_async(sarah_agent.id, actor=default_user)
    assert default_source.id in [s.id for s in agent.sources]

    # Detach source
    await server.agent_manager.detach_source_async(sarah_agent.id, default_source.id, actor=default_user)

    # Verify it's detached
    agent = await server.agent_manager.get_agent_by_id_async(sarah_agent.id, actor=default_user)
    assert default_source.id not in [s.id for s in agent.sources]

    # Verify that detaching an already detached source doesn't cause issues
    await server.agent_manager.detach_source_async(sarah_agent.id, default_source.id, actor=default_user)


@pytest.mark.asyncio
async def test_attach_source_nonexistent_agent(server: SyncServer, default_source, default_user, event_loop):
    """Test attaching a source to a nonexistent agent."""
    with pytest.raises(NoResultFound):
        await server.agent_manager.attach_source_async(agent_id="nonexistent-agent-id", source_id=default_source.id, actor=default_user)


@pytest.mark.asyncio
async def test_attach_source_nonexistent_source(server: SyncServer, sarah_agent, default_user, event_loop):
    """Test attaching a nonexistent source to an agent."""
    with pytest.raises(NoResultFound):
        await server.agent_manager.attach_source_async(agent_id=sarah_agent.id, source_id="nonexistent-source-id", actor=default_user)


@pytest.mark.asyncio
async def test_detach_source_nonexistent_agent(server: SyncServer, default_source, default_user, event_loop):
    """Test detaching a source from a nonexistent agent."""
    with pytest.raises(NoResultFound):
        await server.agent_manager.detach_source_async(agent_id="nonexistent-agent-id", source_id=default_source.id, actor=default_user)


@pytest.mark.asyncio
async def test_list_attached_source_ids_nonexistent_agent(server: SyncServer, default_user, event_loop):
    """Test listing sources for a nonexistent agent."""
    with pytest.raises(NoResultFound):
        await server.agent_manager.list_attached_sources_async(agent_id="nonexistent-agent-id", actor=default_user)


@pytest.mark.asyncio
async def test_list_attached_agents(server: SyncServer, sarah_agent, charles_agent, default_source, default_user, event_loop):
    """Test listing agents that have a particular source attached."""
    # Initially should have no attached agents
    attached_agents = await server.source_manager.list_attached_agents(source_id=default_source.id, actor=default_user)
    assert len(attached_agents) == 0

    # Attach source to first agent
    await server.agent_manager.attach_source_async(agent_id=sarah_agent.id, source_id=default_source.id, actor=default_user)

    # Verify one agent is now attached
    attached_agents = await server.source_manager.list_attached_agents(source_id=default_source.id, actor=default_user)
    assert len(attached_agents) == 1
    assert sarah_agent.id in [a.id for a in attached_agents]

    # Attach source to second agent
    await server.agent_manager.attach_source_async(agent_id=charles_agent.id, source_id=default_source.id, actor=default_user)

    # Verify both agents are now attached
    attached_agents = await server.source_manager.list_attached_agents(source_id=default_source.id, actor=default_user)
    assert len(attached_agents) == 2
    attached_agent_ids = [a.id for a in attached_agents]
    assert sarah_agent.id in attached_agent_ids
    assert charles_agent.id in attached_agent_ids

    # Detach source from first agent
    await server.agent_manager.detach_source_async(agent_id=sarah_agent.id, source_id=default_source.id, actor=default_user)

    # Verify only second agent remains attached
    attached_agents = await server.source_manager.list_attached_agents(source_id=default_source.id, actor=default_user)
    assert len(attached_agents) == 1
    assert charles_agent.id in [a.id for a in attached_agents]


@pytest.mark.asyncio
async def test_list_attached_agents_nonexistent_source(server: SyncServer, default_user):
    """Test listing agents for a nonexistent source."""
    with pytest.raises(NoResultFound):
        await server.source_manager.list_attached_agents(source_id="nonexistent-source-id", actor=default_user)


# ======================================================================================================================
# AgentManager Tests - Tags Relationship
# ======================================================================================================================


@pytest.mark.asyncio
async def test_list_agents_matching_all_tags(server: SyncServer, default_user, agent_with_tags, event_loop):
    agents = await server.agent_manager.list_agents_matching_tags_async(
        actor=default_user,
        match_all=["primary_agent", "benefit_1"],
        match_some=[],
    )
    assert len(agents) == 2  # agent1 and agent3 match
    assert {a.name for a in agents} == {"agent1", "agent3"}


@pytest.mark.asyncio
async def test_list_agents_matching_some_tags(server: SyncServer, default_user, agent_with_tags, event_loop):
    agents = await server.agent_manager.list_agents_matching_tags_async(
        actor=default_user,
        match_all=["primary_agent"],
        match_some=["benefit_1", "benefit_2"],
    )
    assert len(agents) == 3  # All agents match
    assert {a.name for a in agents} == {"agent1", "agent2", "agent3"}


@pytest.mark.asyncio
async def test_list_agents_matching_all_and_some_tags(server: SyncServer, default_user, agent_with_tags, event_loop):
    agents = await server.agent_manager.list_agents_matching_tags_async(
        actor=default_user,
        match_all=["primary_agent", "benefit_1"],
        match_some=["benefit_2", "nonexistent"],
    )
    assert len(agents) == 1  # Only agent3 matches
    assert agents[0].name == "agent3"


@pytest.mark.asyncio
async def test_list_agents_matching_no_tags(server: SyncServer, default_user, agent_with_tags, event_loop):
    agents = await server.agent_manager.list_agents_matching_tags_async(
        actor=default_user,
        match_all=["primary_agent", "nonexistent_tag"],
        match_some=["benefit_1", "benefit_2"],
    )
    assert len(agents) == 0  # No agent should match


@pytest.mark.asyncio
async def test_list_agents_by_tags_match_all(server: SyncServer, sarah_agent, charles_agent, default_user, event_loop):
    """Test listing agents that have ALL specified tags."""
    # Create agents with multiple tags
    await server.agent_manager.update_agent_async(sarah_agent.id, UpdateAgent(tags=["test", "production", "gpt4"]), actor=default_user)
    await server.agent_manager.update_agent_async(charles_agent.id, UpdateAgent(tags=["test", "development", "gpt4"]), actor=default_user)

    # Search for agents with all specified tags
    agents = await server.agent_manager.list_agents_async(actor=default_user, tags=["test", "gpt4"], match_all_tags=True)
    assert len(agents) == 2
    agent_ids = [a.id for a in agents]
    assert sarah_agent.id in agent_ids
    assert charles_agent.id in agent_ids

    # Search for tags that only sarah_agent has
    agents = await server.agent_manager.list_agents_async(actor=default_user, tags=["test", "production"], match_all_tags=True)
    assert len(agents) == 1
    assert agents[0].id == sarah_agent.id


@pytest.mark.asyncio
async def test_list_agents_by_tags_match_any(server: SyncServer, sarah_agent, charles_agent, default_user, event_loop):
    """Test listing agents that have ANY of the specified tags."""
    # Create agents with different tags
    await server.agent_manager.update_agent_async(sarah_agent.id, UpdateAgent(tags=["production", "gpt4"]), actor=default_user)
    await server.agent_manager.update_agent_async(charles_agent.id, UpdateAgent(tags=["development", "gpt3"]), actor=default_user)

    # Search for agents with any of the specified tags
    agents = await server.agent_manager.list_agents_async(actor=default_user, tags=["production", "development"], match_all_tags=False)
    assert len(agents) == 2
    agent_ids = [a.id for a in agents]
    assert sarah_agent.id in agent_ids
    assert charles_agent.id in agent_ids

    # Search for tags where only sarah_agent matches
    agents = await server.agent_manager.list_agents_async(actor=default_user, tags=["production", "nonexistent"], match_all_tags=False)
    assert len(agents) == 1
    assert agents[0].id == sarah_agent.id


@pytest.mark.asyncio
async def test_list_agents_by_tags_no_matches(server: SyncServer, sarah_agent, charles_agent, default_user, event_loop):
    """Test listing agents when no tags match."""
    # Create agents with tags
    await server.agent_manager.update_agent_async(sarah_agent.id, UpdateAgent(tags=["production", "gpt4"]), actor=default_user)
    await server.agent_manager.update_agent_async(charles_agent.id, UpdateAgent(tags=["development", "gpt3"]), actor=default_user)

    # Search for nonexistent tags
    agents = await server.agent_manager.list_agents_async(actor=default_user, tags=["nonexistent1", "nonexistent2"], match_all_tags=True)
    assert len(agents) == 0

    agents = await server.agent_manager.list_agents_async(actor=default_user, tags=["nonexistent1", "nonexistent2"], match_all_tags=False)
    assert len(agents) == 0


@pytest.mark.asyncio
async def test_list_agents_by_tags_with_other_filters(server: SyncServer, sarah_agent, charles_agent, default_user, event_loop):
    """Test combining tag search with other filters."""
    # Create agents with specific names and tags
    await server.agent_manager.update_agent_async(
        sarah_agent.id, UpdateAgent(name="production_agent", tags=["production", "gpt4"]), actor=default_user
    )
    await server.agent_manager.update_agent_async(
        charles_agent.id, UpdateAgent(name="test_agent", tags=["production", "gpt3"]), actor=default_user
    )

    # List agents with specific tag and name pattern
    agents = await server.agent_manager.list_agents_async(
        actor=default_user, tags=["production"], match_all_tags=True, name="production_agent"
    )
    assert len(agents) == 1
    assert agents[0].id == sarah_agent.id


@pytest.mark.asyncio
async def test_list_agents_by_tags_pagination(server: SyncServer, default_user, default_organization, event_loop):
    """Test pagination when listing agents by tags."""
    # Create first agent
    agent1 = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="agent1",
            tags=["pagination_test", "tag1"],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            memory_blocks=[],
            include_base_tools=False,
        ),
        actor=default_user,
    )

    if USING_SQLITE:
        time.sleep(CREATE_DELAY_SQLITE)  # Ensure distinct created_at timestamps

    # Create second agent
    agent2 = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="agent2",
            tags=["pagination_test", "tag2"],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            memory_blocks=[],
            include_base_tools=False,
        ),
        actor=default_user,
    )

    # Get first page
    first_page = await server.agent_manager.list_agents_async(actor=default_user, tags=["pagination_test"], match_all_tags=True, limit=1)
    assert len(first_page) == 1
    first_agent_id = first_page[0].id

    # Get second page using cursor
    second_page = await server.agent_manager.list_agents_async(
        actor=default_user, tags=["pagination_test"], match_all_tags=True, after=first_agent_id, limit=1
    )
    assert len(second_page) == 1
    assert second_page[0].id != first_agent_id

    # Get previous page using before
    prev_page = await server.agent_manager.list_agents_async(
        actor=default_user, tags=["pagination_test"], match_all_tags=True, before=second_page[0].id, limit=1
    )
    assert len(prev_page) == 1
    assert prev_page[0].id == first_agent_id

    # Verify we got both agents with no duplicates
    all_ids = {first_page[0].id, second_page[0].id}
    assert len(all_ids) == 2
    assert agent1.id in all_ids
    assert agent2.id in all_ids


@pytest.mark.asyncio
async def test_list_agents_query_text_pagination(server: SyncServer, default_user, default_organization, event_loop):
    """Test listing agents with query text filtering and pagination."""
    # Create test agents with specific names and descriptions
    agent1 = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="Search Agent One",
            memory_blocks=[],
            description="This is a search agent for testing",
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            include_base_tools=False,
        ),
        actor=default_user,
    )

    # at least 1 second to force unique timestamps in sqlite for deterministic pagination assertions
    await asyncio.sleep(1.1)

    agent2 = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="Search Agent Two",
            memory_blocks=[],
            description="Another search agent for testing",
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            include_base_tools=False,
        ),
        actor=default_user,
    )

    # at least 1 second to force unique timestamps in sqlite for deterministic pagination assertions
    await asyncio.sleep(1.1)

    agent3 = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="Different Agent",
            memory_blocks=[],
            description="This is a different agent",
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            include_base_tools=False,
        ),
        actor=default_user,
    )

    # Test query text filtering
    search_results = await server.agent_manager.list_agents_async(actor=default_user, query_text="search agent")
    assert len(search_results) == 2
    search_agent_ids = {agent.id for agent in search_results}
    assert agent1.id in search_agent_ids
    assert agent2.id in search_agent_ids
    assert agent3.id not in search_agent_ids

    different_results = await server.agent_manager.list_agents_async(actor=default_user, query_text="different agent")
    assert len(different_results) == 1
    assert different_results[0].id == agent3.id

    # Test pagination with query text
    first_page = await server.agent_manager.list_agents_async(actor=default_user, query_text="search agent", limit=1)
    assert len(first_page) == 1
    first_agent_id = first_page[0].id

    # Get second page using cursor
    second_page = await server.agent_manager.list_agents_async(actor=default_user, query_text="search agent", after=first_agent_id, limit=1)
    assert len(second_page) == 1
    assert second_page[0].id != first_agent_id

    # Test before and after
    all_agents = await server.agent_manager.list_agents_async(actor=default_user, query_text="agent")
    assert len(all_agents) == 3
    first_agent, second_agent, third_agent = all_agents
    middle_agent = await server.agent_manager.list_agents_async(
        actor=default_user, query_text="search agent", before=third_agent.id, after=first_agent.id
    )
    assert len(middle_agent) == 1
    assert middle_agent[0].id == second_agent.id

    # Verify we got both search agents with no duplicates
    all_ids = {first_page[0].id, second_page[0].id}
    assert len(all_ids) == 2
    assert all_ids == {agent1.id, agent2.id}


# ======================================================================================================================
# AgentManager Tests - Messages Relationship
# ======================================================================================================================


@pytest.mark.asyncio
async def test_reset_messages_no_messages(server: SyncServer, sarah_agent, default_user, event_loop):
    """
    Test that resetting messages on an agent that has zero messages
    does not fail and clears out message_ids if somehow it's non-empty.
    """
    assert len(sarah_agent.message_ids) == 4
    og_message_ids = sarah_agent.message_ids

    # Reset messages
    reset_agent = await server.agent_manager.reset_messages_async(agent_id=sarah_agent.id, actor=default_user)
    assert len(reset_agent.message_ids) == 1
    assert og_message_ids[0] == reset_agent.message_ids[0]
    # Double check that physically no messages exist
    assert await server.message_manager.size_async(agent_id=sarah_agent.id, actor=default_user) == 1


@pytest.mark.asyncio
async def test_reset_messages_default_messages(server: SyncServer, sarah_agent, default_user, event_loop):
    """
    Test that resetting messages on an agent that has zero messages
    does not fail and clears out message_ids if somehow it's non-empty.
    """
    assert len(sarah_agent.message_ids) == 4
    og_message_ids = sarah_agent.message_ids

    # Reset messages
    reset_agent = await server.agent_manager.reset_messages_async(
        agent_id=sarah_agent.id, actor=default_user, add_default_initial_messages=True
    )
    assert len(reset_agent.message_ids) == 4
    assert og_message_ids[0] == reset_agent.message_ids[0]
    assert og_message_ids[1] != reset_agent.message_ids[1]
    assert og_message_ids[2] != reset_agent.message_ids[2]
    assert og_message_ids[3] != reset_agent.message_ids[3]
    # Double check that physically no messages exist
    assert await server.message_manager.size_async(agent_id=sarah_agent.id, actor=default_user) == 4


@pytest.mark.asyncio
async def test_reset_messages_with_existing_messages(server: SyncServer, sarah_agent, default_user, event_loop):
    """
    Test that resetting messages on an agent with actual messages
    deletes them from the database and clears message_ids.
    """
    # 1. Create multiple messages for the agent
    msg1 = server.message_manager.create_message(
        PydanticMessage(
            agent_id=sarah_agent.id,
            role="user",
            content=[TextContent(text="Hello, Sarah!")],
        ),
        actor=default_user,
    )
    msg2 = server.message_manager.create_message(
        PydanticMessage(
            agent_id=sarah_agent.id,
            role="assistant",
            content=[TextContent(text="Hello, user!")],
        ),
        actor=default_user,
    )

    # Verify the messages were created
    agent_before = await server.agent_manager.get_agent_by_id_async(sarah_agent.id, default_user)
    # This is 4 because creating the message does not necessarily add it to the in context message ids
    assert len(agent_before.message_ids) == 4
    assert await server.message_manager.size_async(agent_id=sarah_agent.id, actor=default_user) == 6

    # 2. Reset all messages
    reset_agent = await server.agent_manager.reset_messages_async(agent_id=sarah_agent.id, actor=default_user)

    # 3. Verify the agent now has zero message_ids
    assert len(reset_agent.message_ids) == 1

    # 4. Verify the messages are physically removed
    assert await server.message_manager.size_async(agent_id=sarah_agent.id, actor=default_user) == 1


@pytest.mark.asyncio
async def test_reset_messages_idempotency(server: SyncServer, sarah_agent, default_user, event_loop):
    """
    Test that calling reset_messages multiple times has no adverse effect.
    """
    # Clear messages first
    await server.message_manager.delete_messages_by_ids_async(message_ids=sarah_agent.message_ids[1:], actor=default_user)

    # Create a single message
    server.message_manager.create_message(
        PydanticMessage(
            agent_id=sarah_agent.id,
            role="user",
            content=[TextContent(text="Hello, Sarah!")],
        ),
        actor=default_user,
    )
    # First reset
    reset_agent = await server.agent_manager.reset_messages_async(agent_id=sarah_agent.id, actor=default_user)
    assert len(reset_agent.message_ids) == 1
    assert await server.message_manager.size_async(agent_id=sarah_agent.id, actor=default_user) == 1

    # Second reset should do nothing new
    reset_agent_again = await server.agent_manager.reset_messages_async(agent_id=sarah_agent.id, actor=default_user)
    assert len(reset_agent.message_ids) == 1
    assert await server.message_manager.size_async(agent_id=sarah_agent.id, actor=default_user) == 1


@pytest.mark.asyncio
async def test_reset_messages_preserves_system_message_id(server: SyncServer, sarah_agent, default_user, event_loop):
    """
    Test that resetting messages preserves the original system message ID.
    """
    # Get the original system message ID
    original_agent = await server.agent_manager.get_agent_by_id_async(sarah_agent.id, default_user)
    original_system_message_id = original_agent.message_ids[0]

    # Add some user messages
    server.message_manager.create_message(
        PydanticMessage(
            agent_id=sarah_agent.id,
            role="user",
            content=[TextContent(text="Hello!")],
        ),
        actor=default_user,
    )

    # Reset messages
    reset_agent = await server.agent_manager.reset_messages_async(agent_id=sarah_agent.id, actor=default_user)

    # Verify the system message ID is preserved
    assert len(reset_agent.message_ids) == 1
    assert reset_agent.message_ids[0] == original_system_message_id

    # Verify the system message still exists in the database
    system_message = await server.message_manager.get_message_by_id_async(message_id=original_system_message_id, actor=default_user)
    assert system_message.role == "system"


@pytest.mark.asyncio
async def test_reset_messages_preserves_system_message_content(server: SyncServer, sarah_agent, default_user, event_loop):
    """
    Test that resetting messages preserves the original system message content.
    """
    # Get the original system message
    original_agent = await server.agent_manager.get_agent_by_id_async(sarah_agent.id, default_user)
    original_system_message = await server.message_manager.get_message_by_id_async(
        message_id=original_agent.message_ids[0], actor=default_user
    )

    # Add some messages and reset
    server.message_manager.create_message(
        PydanticMessage(
            agent_id=sarah_agent.id,
            role="user",
            content=[TextContent(text="Hello!")],
        ),
        actor=default_user,
    )

    reset_agent = await server.agent_manager.reset_messages_async(agent_id=sarah_agent.id, actor=default_user)

    # Verify the system message content is unchanged
    preserved_system_message = await server.message_manager.get_message_by_id_async(
        message_id=reset_agent.message_ids[0], actor=default_user
    )

    assert preserved_system_message.content == original_system_message.content
    assert preserved_system_message.role == "system"
    assert preserved_system_message.id == original_system_message.id


@pytest.mark.asyncio
async def test_modify_letta_message(server: SyncServer, sarah_agent, default_user, event_loop):
    """
    Test updating a message.
    """

    messages = server.message_manager.list_messages_for_agent(agent_id=sarah_agent.id, actor=default_user)
    letta_messages = PydanticMessage.to_letta_messages_from_list(messages=messages)

    system_message = [msg for msg in letta_messages if msg.message_type == "system_message"][0]
    assistant_message = [msg for msg in letta_messages if msg.message_type == "assistant_message"][0]
    user_message = [msg for msg in letta_messages if msg.message_type == "user_message"][0]
    reasoning_message = [msg for msg in letta_messages if msg.message_type == "reasoning_message"][0]

    # user message
    update_user_message = UpdateUserMessage(content="Hello, Sarah!")
    original_user_message = await server.message_manager.get_message_by_id_async(message_id=user_message.id, actor=default_user)
    assert original_user_message.content[0].text != update_user_message.content
    server.message_manager.update_message_by_letta_message(
        message_id=user_message.id, letta_message_update=update_user_message, actor=default_user
    )
    updated_user_message = await server.message_manager.get_message_by_id_async(message_id=user_message.id, actor=default_user)
    assert updated_user_message.content[0].text == update_user_message.content

    # system message
    update_system_message = UpdateSystemMessage(content="You are a friendly assistant!")
    original_system_message = await server.message_manager.get_message_by_id_async(message_id=system_message.id, actor=default_user)
    assert original_system_message.content[0].text != update_system_message.content
    server.message_manager.update_message_by_letta_message(
        message_id=system_message.id, letta_message_update=update_system_message, actor=default_user
    )
    updated_system_message = await server.message_manager.get_message_by_id_async(message_id=system_message.id, actor=default_user)
    assert updated_system_message.content[0].text == update_system_message.content

    # reasoning message
    update_reasoning_message = UpdateReasoningMessage(reasoning="I am thinking")
    original_reasoning_message = await server.message_manager.get_message_by_id_async(message_id=reasoning_message.id, actor=default_user)
    assert original_reasoning_message.content[0].text != update_reasoning_message.reasoning
    server.message_manager.update_message_by_letta_message(
        message_id=reasoning_message.id, letta_message_update=update_reasoning_message, actor=default_user
    )
    updated_reasoning_message = await server.message_manager.get_message_by_id_async(message_id=reasoning_message.id, actor=default_user)
    assert updated_reasoning_message.content[0].text == update_reasoning_message.reasoning

    # assistant message
    def parse_send_message(tool_call):
        import json

        function_call = tool_call.function
        arguments = json.loads(function_call.arguments)
        return arguments["message"]

    update_assistant_message = UpdateAssistantMessage(content="I am an agent!")
    original_assistant_message = await server.message_manager.get_message_by_id_async(message_id=assistant_message.id, actor=default_user)
    print("ORIGINAL", original_assistant_message.tool_calls)
    print("MESSAGE", parse_send_message(original_assistant_message.tool_calls[0]))
    assert parse_send_message(original_assistant_message.tool_calls[0]) != update_assistant_message.content
    server.message_manager.update_message_by_letta_message(
        message_id=assistant_message.id, letta_message_update=update_assistant_message, actor=default_user
    )
    updated_assistant_message = await server.message_manager.get_message_by_id_async(message_id=assistant_message.id, actor=default_user)
    print("UPDATED", updated_assistant_message.tool_calls)
    print("MESSAGE", parse_send_message(updated_assistant_message.tool_calls[0]))
    assert parse_send_message(updated_assistant_message.tool_calls[0]) == update_assistant_message.content

    # TODO: tool calls/responses


# ======================================================================================================================
# AgentManager Tests - Blocks Relationship
# ======================================================================================================================


@pytest.mark.asyncio
async def test_attach_block(server: SyncServer, sarah_agent, default_block, default_user, event_loop):
    """Test attaching a block to an agent."""
    # Attach block
    server.agent_manager.attach_block(agent_id=sarah_agent.id, block_id=default_block.id, actor=default_user)

    # Verify attachment
    agent = await server.agent_manager.get_agent_by_id_async(sarah_agent.id, actor=default_user)
    assert len(agent.memory.blocks) == 1
    assert agent.memory.blocks[0].id == default_block.id
    assert agent.memory.blocks[0].label == default_block.label


# Test should work with both SQLite and PostgreSQL
def test_attach_block_duplicate_label(server: SyncServer, sarah_agent, default_block, other_block, default_user):
    """Test attempting to attach a block with a duplicate label."""
    # Set up both blocks with same label
    server.block_manager.update_block(default_block.id, BlockUpdate(label="same_label"), actor=default_user)
    server.block_manager.update_block(other_block.id, BlockUpdate(label="same_label"), actor=default_user)

    # Attach first block
    server.agent_manager.attach_block(agent_id=sarah_agent.id, block_id=default_block.id, actor=default_user)

    # Attempt to attach second block with same label
    with pytest.raises(IntegrityError):
        server.agent_manager.attach_block(agent_id=sarah_agent.id, block_id=other_block.id, actor=default_user)


@pytest.mark.asyncio
async def test_detach_block(server: SyncServer, sarah_agent, default_block, default_user, event_loop):
    """Test detaching a block by ID."""
    # Set up: attach block
    server.agent_manager.attach_block(agent_id=sarah_agent.id, block_id=default_block.id, actor=default_user)

    # Detach block
    server.agent_manager.detach_block(agent_id=sarah_agent.id, block_id=default_block.id, actor=default_user)

    # Verify detachment
    agent = await server.agent_manager.get_agent_by_id_async(sarah_agent.id, actor=default_user)
    assert len(agent.memory.blocks) == 0

    # Check that block still exists
    block = server.block_manager.get_block_by_id(block_id=default_block.id, actor=default_user)
    assert block


def test_detach_nonexistent_block(server: SyncServer, sarah_agent, default_user):
    """Test detaching a block that isn't attached."""
    with pytest.raises(NoResultFound):
        server.agent_manager.detach_block(agent_id=sarah_agent.id, block_id="nonexistent-block-id", actor=default_user)


@pytest.mark.asyncio
async def test_update_block_label(server: SyncServer, sarah_agent, default_block, default_user, event_loop):
    """Test updating a block's label updates the relationship."""
    # Attach block
    server.agent_manager.attach_block(agent_id=sarah_agent.id, block_id=default_block.id, actor=default_user)

    # Update block label
    new_label = "new_label"
    server.block_manager.update_block(default_block.id, BlockUpdate(label=new_label), actor=default_user)

    # Verify relationship is updated
    agent = await server.agent_manager.get_agent_by_id_async(sarah_agent.id, actor=default_user)
    block = agent.memory.blocks[0]
    assert block.id == default_block.id
    assert block.label == new_label


@pytest.mark.asyncio
async def test_update_block_label_multiple_agents(server: SyncServer, sarah_agent, charles_agent, default_block, default_user, event_loop):
    """Test updating a block's label updates relationships for all agents."""
    # Attach block to both agents
    server.agent_manager.attach_block(agent_id=sarah_agent.id, block_id=default_block.id, actor=default_user)
    server.agent_manager.attach_block(agent_id=charles_agent.id, block_id=default_block.id, actor=default_user)

    # Update block label
    new_label = "new_label"
    server.block_manager.update_block(default_block.id, BlockUpdate(label=new_label), actor=default_user)

    # Verify both relationships are updated
    for agent_id in [sarah_agent.id, charles_agent.id]:
        agent = await server.agent_manager.get_agent_by_id_async(agent_id, actor=default_user)
        # Find our specific block by ID
        block = next(b for b in agent.memory.blocks if b.id == default_block.id)
        assert block.label == new_label


def test_get_block_with_label(server: SyncServer, sarah_agent, default_block, default_user):
    """Test retrieving a block by its label."""
    # Attach block
    server.agent_manager.attach_block(agent_id=sarah_agent.id, block_id=default_block.id, actor=default_user)

    # Get block by label
    block = server.agent_manager.get_block_with_label(agent_id=sarah_agent.id, block_label=default_block.label, actor=default_user)

    assert block.id == default_block.id
    assert block.label == default_block.label


@pytest.mark.asyncio
async def test_refresh_memory_async(server: SyncServer, default_user, event_loop):
    block = server.block_manager.create_or_update_block(
        PydanticBlock(
            label="test",
            value="test",
            limit=1000,
        ),
        actor=default_user,
    )
    block_human = server.block_manager.create_or_update_block(
        PydanticBlock(
            label="human",
            value="name: caren",
            limit=1000,
        ),
        actor=default_user,
    )
    agent = server.agent_manager.create_agent(
        CreateAgent(
            name="test",
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            include_base_tools=False,
            block_ids=[block.id, block_human.id],
        ),
        actor=default_user,
    )
    block = server.block_manager.update_block(
        block_id=block.id,
        block_update=BlockUpdate(
            value="test2",
        ),
        actor=default_user,
    )
    assert len(agent.memory.blocks) == 2
    agent = await server.agent_manager.refresh_memory_async(agent_state=agent, actor=default_user)
    assert len(agent.memory.blocks) == 2
    assert any([block.value == "test2" for block in agent.memory.blocks])


# ======================================================================================================================
# Agent Manager - Passages Tests
# ======================================================================================================================


@pytest.mark.asyncio
async def test_agent_list_passages_basic(server, default_user, sarah_agent, agent_passages_setup, event_loop):
    """Test basic listing functionality of agent passages"""

    all_passages = await server.agent_manager.list_passages_async(actor=default_user, agent_id=sarah_agent.id)
    assert len(all_passages) == 5  # 3 source + 2 agent passages

    source_passages = await server.agent_manager.list_source_passages_async(actor=default_user, agent_id=sarah_agent.id)
    assert len(source_passages) == 3  # 3 source + 2 agent passages

    agent_passages = await server.agent_manager.list_agent_passages_async(actor=default_user, agent_id=sarah_agent.id)
    assert len(agent_passages) == 2  # 3 source + 2 agent passages


@pytest.mark.asyncio
async def test_agent_list_passages_ordering(server, default_user, sarah_agent, agent_passages_setup, event_loop):
    """Test ordering of agent passages"""

    # Test ascending order
    asc_passages = await server.agent_manager.list_passages_async(actor=default_user, agent_id=sarah_agent.id, ascending=True)
    assert len(asc_passages) == 5
    for i in range(1, len(asc_passages)):
        assert asc_passages[i - 1].created_at <= asc_passages[i].created_at

    # Test descending order
    desc_passages = await server.agent_manager.list_passages_async(actor=default_user, agent_id=sarah_agent.id, ascending=False)
    assert len(desc_passages) == 5
    for i in range(1, len(desc_passages)):
        assert desc_passages[i - 1].created_at >= desc_passages[i].created_at


@pytest.mark.asyncio
async def test_agent_list_passages_pagination(server, default_user, sarah_agent, agent_passages_setup, event_loop):
    """Test pagination of agent passages"""

    # Test limit
    limited_passages = await server.agent_manager.list_passages_async(actor=default_user, agent_id=sarah_agent.id, limit=3)
    assert len(limited_passages) == 3

    # Test cursor-based pagination
    first_page = await server.agent_manager.list_passages_async(actor=default_user, agent_id=sarah_agent.id, limit=2, ascending=True)
    assert len(first_page) == 2

    second_page = await server.agent_manager.list_passages_async(
        actor=default_user, agent_id=sarah_agent.id, after=first_page[-1].id, limit=2, ascending=True
    )
    assert len(second_page) == 2
    assert first_page[-1].id != second_page[0].id
    assert first_page[-1].created_at <= second_page[0].created_at

    """
    [1]   [2]
    * * | * *

       [mid]
    * | * * | *
    """
    middle_page = await server.agent_manager.list_passages_async(
        actor=default_user, agent_id=sarah_agent.id, before=second_page[-1].id, after=first_page[0].id, ascending=True
    )
    assert len(middle_page) == 2
    assert middle_page[0].id == first_page[-1].id
    assert middle_page[1].id == second_page[0].id

    middle_page_desc = await server.agent_manager.list_passages_async(
        actor=default_user, agent_id=sarah_agent.id, before=second_page[-1].id, after=first_page[0].id, ascending=False
    )
    assert len(middle_page_desc) == 2
    assert middle_page_desc[0].id == second_page[0].id
    assert middle_page_desc[1].id == first_page[-1].id


@pytest.mark.asyncio
async def test_agent_list_passages_text_search(server, default_user, sarah_agent, agent_passages_setup, event_loop):
    """Test text search functionality of agent passages"""

    # Test text search for source passages
    source_text_passages = await server.agent_manager.list_passages_async(
        actor=default_user, agent_id=sarah_agent.id, query_text="Source passage"
    )
    assert len(source_text_passages) == 3

    # Test text search for agent passages
    agent_text_passages = await server.agent_manager.list_passages_async(
        actor=default_user, agent_id=sarah_agent.id, query_text="Agent passage"
    )
    assert len(agent_text_passages) == 2


@pytest.mark.asyncio
async def test_agent_list_passages_agent_only(server, default_user, sarah_agent, agent_passages_setup, event_loop):
    """Test text search functionality of agent passages"""

    # Test text search for agent passages
    agent_text_passages = await server.agent_manager.list_passages_async(actor=default_user, agent_id=sarah_agent.id, agent_only=True)
    assert len(agent_text_passages) == 2


@pytest.mark.asyncio
async def test_agent_list_passages_filtering(server, default_user, sarah_agent, default_source, agent_passages_setup, event_loop):
    """Test filtering functionality of agent passages"""

    # Test source filtering
    source_filtered = await server.agent_manager.list_passages_async(
        actor=default_user, agent_id=sarah_agent.id, source_id=default_source.id
    )
    assert len(source_filtered) == 3

    # Test date filtering
    now = datetime.now(timezone.utc)
    future_date = now + timedelta(days=1)
    past_date = now - timedelta(days=1)

    date_filtered = await server.agent_manager.list_passages_async(
        actor=default_user, agent_id=sarah_agent.id, start_date=past_date, end_date=future_date
    )
    assert len(date_filtered) == 5


@pytest.fixture
def mock_embeddings():
    """Load mock embeddings from JSON file"""
    fixture_path = os.path.join(os.path.dirname(__file__), "data", "test_embeddings.json")
    with open(fixture_path, "r") as f:
        return json.load(f)


@pytest.fixture
def mock_embed_model(mock_embeddings):
    """Mock embedding model that returns predefined embeddings"""
    mock_model = Mock()
    mock_model.get_text_embedding = lambda text: mock_embeddings.get(text, [0.0] * 1536)
    return mock_model


@pytest.mark.asyncio
async def test_agent_list_passages_vector_search(
    server, default_user, sarah_agent, default_source, default_file, event_loop, mock_embed_model
):
    """Test vector search functionality of agent passages"""
    embed_model = mock_embed_model

    # Create passages with known embeddings
    passages = []

    # Create passages with different embeddings
    test_passages = [
        "I like red",
        "random text",
        "blue shoes",
    ]

    await server.agent_manager.attach_source_async(agent_id=sarah_agent.id, source_id=default_source.id, actor=default_user)

    for i, text in enumerate(test_passages):
        embedding = embed_model.get_text_embedding(text)
        if i % 2 == 0:
            # Create agent passage
            passage = PydanticPassage(
                text=text,
                organization_id=default_user.organization_id,
                agent_id=sarah_agent.id,
                embedding_config=DEFAULT_EMBEDDING_CONFIG,
                embedding=embedding,
            )
            created_passage = await server.passage_manager.create_agent_passage_async(passage, default_user)
        else:
            # Create source passage
            passage = PydanticPassage(
                text=text,
                organization_id=default_user.organization_id,
                source_id=default_source.id,
                file_id=default_file.id,
                embedding_config=DEFAULT_EMBEDDING_CONFIG,
                embedding=embedding,
            )
            created_passage = await server.passage_manager.create_source_passage_async(passage, default_file, default_user)
        passages.append(created_passage)

    # Query vector similar to "red" embedding
    query_key = "What's my favorite color?"

    # Test vector search with all passages
    results = await server.agent_manager.list_passages_async(
        actor=default_user,
        agent_id=sarah_agent.id,
        query_text=query_key,
        embedding_config=DEFAULT_EMBEDDING_CONFIG,
        embed_query=True,
    )

    # Verify results are ordered by similarity
    assert len(results) == 3
    assert results[0].text == "I like red"
    assert "random" in results[1].text or "random" in results[2].text
    assert "blue" in results[1].text or "blue" in results[2].text

    # Test vector search with agent_only=True
    agent_only_results = await server.agent_manager.list_passages_async(
        actor=default_user,
        agent_id=sarah_agent.id,
        query_text=query_key,
        embedding_config=DEFAULT_EMBEDDING_CONFIG,
        embed_query=True,
        agent_only=True,
    )

    # Verify agent-only results
    assert len(agent_only_results) == 2
    assert agent_only_results[0].text == "I like red"
    assert agent_only_results[1].text == "blue shoes"


@pytest.mark.asyncio
async def test_list_source_passages_only(server: SyncServer, default_user, default_source, agent_passages_setup, event_loop):
    """Test listing passages from a source without specifying an agent."""

    # List passages by source_id without agent_id
    source_passages = await server.agent_manager.list_passages_async(
        actor=default_user,
        source_id=default_source.id,
    )

    # Verify we get only source passages (3 from agent_passages_setup)
    assert len(source_passages) == 3
    assert all(p.source_id == default_source.id for p in source_passages)
    assert all(p.agent_id is None for p in source_passages)


# ======================================================================================================================
# Organization Manager Tests
# ======================================================================================================================
@pytest.mark.asyncio
async def test_list_organizations(server: SyncServer, event_loop):
    # Create a new org and confirm that it is created correctly
    org_name = "test"
    org = await server.organization_manager.create_organization_async(pydantic_org=PydanticOrganization(name=org_name))

    orgs = await server.organization_manager.list_organizations_async()
    assert len(orgs) == 1
    assert orgs[0].name == org_name

    # Delete it after
    await server.organization_manager.delete_organization_by_id_async(org.id)
    orgs = await server.organization_manager.list_organizations_async()
    assert len(orgs) == 0


@pytest.mark.asyncio
async def test_create_default_organization(server: SyncServer, event_loop):
    await server.organization_manager.create_default_organization_async()
    retrieved = await server.organization_manager.get_default_organization_async()
    assert retrieved.name == DEFAULT_ORG_NAME


@pytest.mark.asyncio
async def test_update_organization_name(server: SyncServer, event_loop):
    org_name_a = "a"
    org_name_b = "b"
    org = await server.organization_manager.create_organization_async(pydantic_org=PydanticOrganization(name=org_name_a))
    assert org.name == org_name_a
    org = await server.organization_manager.update_organization_name_using_id_async(org_id=org.id, name=org_name_b)
    assert org.name == org_name_b


@pytest.mark.asyncio
async def test_update_organization_privileged_tools(server: SyncServer, event_loop):
    org_name = "test"
    org = await server.organization_manager.create_organization_async(pydantic_org=PydanticOrganization(name=org_name))
    assert org.privileged_tools == False
    org = await server.organization_manager.update_organization_async(org_id=org.id, org_update=OrganizationUpdate(privileged_tools=True))
    assert org.privileged_tools == True


@pytest.mark.asyncio
async def test_list_organizations_pagination(server: SyncServer, event_loop):
    await server.organization_manager.create_organization_async(pydantic_org=PydanticOrganization(name="a"))
    await server.organization_manager.create_organization_async(pydantic_org=PydanticOrganization(name="b"))

    orgs_x = await server.organization_manager.list_organizations_async(limit=1)
    assert len(orgs_x) == 1

    orgs_y = await server.organization_manager.list_organizations_async(after=orgs_x[0].id, limit=1)
    assert len(orgs_y) == 1
    assert orgs_y[0].name != orgs_x[0].name

    orgs = await server.organization_manager.list_organizations_async(after=orgs_y[0].id, limit=1)
    assert len(orgs) == 0


# ======================================================================================================================
# Passage Manager Tests
# ======================================================================================================================


def test_passage_create_agentic(server: SyncServer, agent_passage_fixture, default_user):
    """Test creating a passage using agent_passage_fixture fixture"""
    assert agent_passage_fixture.id is not None
    assert agent_passage_fixture.text == "Hello, I am an agent passage"

    # Verify we can retrieve it
    retrieved = server.passage_manager.get_passage_by_id(
        agent_passage_fixture.id,
        actor=default_user,
    )
    assert retrieved is not None
    assert retrieved.id == agent_passage_fixture.id
    assert retrieved.text == agent_passage_fixture.text


def test_passage_create_source(server: SyncServer, source_passage_fixture, default_user):
    """Test creating a source passage."""
    assert source_passage_fixture is not None
    assert source_passage_fixture.text == "Hello, I am a source passage"

    # Verify we can retrieve it
    retrieved = server.passage_manager.get_passage_by_id(
        source_passage_fixture.id,
        actor=default_user,
    )
    assert retrieved is not None
    assert retrieved.id == source_passage_fixture.id
    assert retrieved.text == source_passage_fixture.text


@pytest.mark.asyncio
async def test_passage_create_invalid(server: SyncServer, agent_passage_fixture, default_user, event_loop):
    """Test creating an agent passage."""
    assert agent_passage_fixture is not None
    assert agent_passage_fixture.text == "Hello, I am an agent passage"

    # Try to create an invalid passage (with both agent_id and source_id)
    with pytest.raises(AssertionError):
        await server.passage_manager.create_passage_async(
            PydanticPassage(
                text="Invalid passage",
                agent_id="123",
                source_id="456",
                organization_id=default_user.organization_id,
                embedding=[0.1] * 1024,
                embedding_config=DEFAULT_EMBEDDING_CONFIG,
            ),
            actor=default_user,
        )


def test_passage_get_by_id(server: SyncServer, agent_passage_fixture, source_passage_fixture, default_user):
    """Test retrieving a passage by ID"""
    retrieved = server.passage_manager.get_passage_by_id(agent_passage_fixture.id, actor=default_user)
    assert retrieved is not None
    assert retrieved.id == agent_passage_fixture.id
    assert retrieved.text == agent_passage_fixture.text

    retrieved = server.passage_manager.get_passage_by_id(source_passage_fixture.id, actor=default_user)
    assert retrieved is not None
    assert retrieved.id == source_passage_fixture.id
    assert retrieved.text == source_passage_fixture.text


@pytest.mark.asyncio
async def test_passage_cascade_deletion(
    server: SyncServer, agent_passage_fixture, source_passage_fixture, default_user, default_source, sarah_agent, event_loop
):
    """Test that passages are deleted when their parent (agent or source) is deleted."""
    # Verify passages exist
    agent_passage = server.passage_manager.get_passage_by_id(agent_passage_fixture.id, default_user)
    source_passage = server.passage_manager.get_passage_by_id(source_passage_fixture.id, default_user)
    assert agent_passage is not None
    assert source_passage is not None

    # Delete agent and verify its passages are deleted
    server.agent_manager.delete_agent(sarah_agent.id, default_user)
    agentic_passages = await server.agent_manager.list_passages_async(actor=default_user, agent_id=sarah_agent.id, agent_only=True)
    assert len(agentic_passages) == 0


def test_create_agent_passage_specific(server: SyncServer, default_user, sarah_agent):
    """Test creating an agent passage using the new agent-specific method."""
    passage = server.passage_manager.create_agent_passage(
        PydanticPassage(
            text="Test agent passage via specific method",
            agent_id=sarah_agent.id,
            organization_id=default_user.organization_id,
            embedding=[0.1],
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
            metadata={"type": "test_specific"},
        ),
        actor=default_user,
    )

    assert passage.id is not None
    assert passage.text == "Test agent passage via specific method"
    assert passage.agent_id == sarah_agent.id
    assert passage.source_id is None


def test_create_source_passage_specific(server: SyncServer, default_user, default_file, default_source):
    """Test creating a source passage using the new source-specific method."""
    passage = server.passage_manager.create_source_passage(
        PydanticPassage(
            text="Test source passage via specific method",
            source_id=default_source.id,
            file_id=default_file.id,
            organization_id=default_user.organization_id,
            embedding=[0.1],
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
            metadata={"type": "test_specific"},
        ),
        file_metadata=default_file,
        actor=default_user,
    )

    assert passage.id is not None
    assert passage.text == "Test source passage via specific method"
    assert passage.source_id == default_source.id
    assert passage.agent_id is None


def test_create_agent_passage_validation(server: SyncServer, default_user, default_source, sarah_agent):
    """Test that agent passage creation validates inputs correctly."""
    # Should fail if agent_id is missing
    with pytest.raises(ValueError, match="Agent passage must have agent_id"):
        server.passage_manager.create_agent_passage(
            PydanticPassage(
                text="Invalid agent passage",
                organization_id=default_user.organization_id,
                embedding=[0.1],
                embedding_config=DEFAULT_EMBEDDING_CONFIG,
            ),
            actor=default_user,
        )

    # Should fail if source_id is present
    with pytest.raises(ValueError, match="Agent passage cannot have source_id"):
        server.passage_manager.create_agent_passage(
            PydanticPassage(
                text="Invalid agent passage",
                agent_id=sarah_agent.id,
                source_id=default_source.id,
                organization_id=default_user.organization_id,
                embedding=[0.1],
                embedding_config=DEFAULT_EMBEDDING_CONFIG,
            ),
            actor=default_user,
        )


def test_create_source_passage_validation(server: SyncServer, default_user, default_file, default_source, sarah_agent):
    """Test that source passage creation validates inputs correctly."""
    # Should fail if source_id is missing
    with pytest.raises(ValueError, match="Source passage must have source_id"):
        server.passage_manager.create_source_passage(
            PydanticPassage(
                text="Invalid source passage",
                organization_id=default_user.organization_id,
                embedding=[0.1],
                embedding_config=DEFAULT_EMBEDDING_CONFIG,
            ),
            file_metadata=default_file,
            actor=default_user,
        )

    # Should fail if agent_id is present
    with pytest.raises(ValueError, match="Source passage cannot have agent_id"):
        server.passage_manager.create_source_passage(
            PydanticPassage(
                text="Invalid source passage",
                source_id=default_source.id,
                agent_id=sarah_agent.id,
                organization_id=default_user.organization_id,
                embedding=[0.1],
                embedding_config=DEFAULT_EMBEDDING_CONFIG,
            ),
            file_metadata=default_file,
            actor=default_user,
        )


def test_get_agent_passage_by_id_specific(server: SyncServer, default_user, sarah_agent):
    """Test retrieving an agent passage using the new agent-specific method."""
    # Create an agent passage
    passage = server.passage_manager.create_agent_passage(
        PydanticPassage(
            text="Agent passage for retrieval test",
            agent_id=sarah_agent.id,
            organization_id=default_user.organization_id,
            embedding=[0.1],
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        actor=default_user,
    )

    # Retrieve it using the specific method
    retrieved = server.passage_manager.get_agent_passage_by_id(passage.id, actor=default_user)
    assert retrieved is not None
    assert retrieved.id == passage.id
    assert retrieved.text == passage.text
    assert retrieved.agent_id == sarah_agent.id


def test_get_source_passage_by_id_specific(server: SyncServer, default_user, default_file, default_source):
    """Test retrieving a source passage using the new source-specific method."""
    # Create a source passage
    passage = server.passage_manager.create_source_passage(
        PydanticPassage(
            text="Source passage for retrieval test",
            source_id=default_source.id,
            file_id=default_file.id,
            organization_id=default_user.organization_id,
            embedding=[0.1],
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        file_metadata=default_file,
        actor=default_user,
    )

    # Retrieve it using the specific method
    retrieved = server.passage_manager.get_source_passage_by_id(passage.id, actor=default_user)
    assert retrieved is not None
    assert retrieved.id == passage.id
    assert retrieved.text == passage.text
    assert retrieved.source_id == default_source.id


def test_get_wrong_passage_type_fails(server: SyncServer, default_user, sarah_agent, default_file, default_source):
    """Test that trying to get the wrong passage type with specific methods fails."""
    # Create an agent passage
    agent_passage = server.passage_manager.create_agent_passage(
        PydanticPassage(
            text="Agent passage",
            agent_id=sarah_agent.id,
            organization_id=default_user.organization_id,
            embedding=[0.1],
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        actor=default_user,
    )

    # Create a source passage
    source_passage = server.passage_manager.create_source_passage(
        PydanticPassage(
            text="Source passage",
            source_id=default_source.id,
            file_id=default_file.id,
            organization_id=default_user.organization_id,
            embedding=[0.1],
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        file_metadata=default_file,
        actor=default_user,
    )

    # Trying to get agent passage with source method should fail
    with pytest.raises(NoResultFound):
        server.passage_manager.get_source_passage_by_id(agent_passage.id, actor=default_user)

    # Trying to get source passage with agent method should fail
    with pytest.raises(NoResultFound):
        server.passage_manager.get_agent_passage_by_id(source_passage.id, actor=default_user)


def test_update_agent_passage_specific(server: SyncServer, default_user, sarah_agent):
    """Test updating an agent passage using the new agent-specific method."""
    # Create an agent passage
    passage = server.passage_manager.create_agent_passage(
        PydanticPassage(
            text="Original agent passage text",
            agent_id=sarah_agent.id,
            organization_id=default_user.organization_id,
            embedding=[0.1],
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        actor=default_user,
    )

    # Update it
    updated_passage = server.passage_manager.update_agent_passage_by_id(
        passage.id,
        PydanticPassage(
            text="Updated agent passage text",
            agent_id=sarah_agent.id,
            organization_id=default_user.organization_id,
            embedding=[0.2],
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        actor=default_user,
    )

    assert updated_passage.text == "Updated agent passage text"
    assert updated_passage.embedding[0] == approx(0.2)
    assert updated_passage.id == passage.id


def test_update_source_passage_specific(server: SyncServer, default_user, default_file, default_source):
    """Test updating a source passage using the new source-specific method."""
    # Create a source passage
    passage = server.passage_manager.create_source_passage(
        PydanticPassage(
            text="Original source passage text",
            source_id=default_source.id,
            file_id=default_file.id,
            organization_id=default_user.organization_id,
            embedding=[0.1],
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        file_metadata=default_file,
        actor=default_user,
    )

    # Update it
    updated_passage = server.passage_manager.update_source_passage_by_id(
        passage.id,
        PydanticPassage(
            text="Updated source passage text",
            source_id=default_source.id,
            file_id=default_file.id,
            organization_id=default_user.organization_id,
            embedding=[0.2],
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        actor=default_user,
    )

    assert updated_passage.text == "Updated source passage text"
    assert updated_passage.embedding[0] == approx(0.2)
    assert updated_passage.id == passage.id


def test_delete_agent_passage_specific(server: SyncServer, default_user, sarah_agent):
    """Test deleting an agent passage using the new agent-specific method."""
    # Create an agent passage
    passage = server.passage_manager.create_agent_passage(
        PydanticPassage(
            text="Agent passage to delete",
            agent_id=sarah_agent.id,
            organization_id=default_user.organization_id,
            embedding=[0.1],
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        actor=default_user,
    )

    # Verify it exists
    retrieved = server.passage_manager.get_agent_passage_by_id(passage.id, actor=default_user)
    assert retrieved is not None

    # Delete it
    result = server.passage_manager.delete_agent_passage_by_id(passage.id, actor=default_user)
    assert result is True

    # Verify it's gone
    with pytest.raises(NoResultFound):
        server.passage_manager.get_agent_passage_by_id(passage.id, actor=default_user)


def test_delete_source_passage_specific(server: SyncServer, default_user, default_file, default_source):
    """Test deleting a source passage using the new source-specific method."""
    # Create a source passage
    passage = server.passage_manager.create_source_passage(
        PydanticPassage(
            text="Source passage to delete",
            source_id=default_source.id,
            file_id=default_file.id,
            organization_id=default_user.organization_id,
            embedding=[0.1],
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        file_metadata=default_file,
        actor=default_user,
    )

    # Verify it exists
    retrieved = server.passage_manager.get_source_passage_by_id(passage.id, actor=default_user)
    assert retrieved is not None

    # Delete it
    result = server.passage_manager.delete_source_passage_by_id(passage.id, actor=default_user)
    assert result is True

    # Verify it's gone
    with pytest.raises(NoResultFound):
        server.passage_manager.get_source_passage_by_id(passage.id, actor=default_user)


@pytest.mark.asyncio
async def test_create_many_agent_passages_async(server: SyncServer, default_user, sarah_agent, event_loop):
    """Test creating multiple agent passages using the new batch method."""
    passages = [
        PydanticPassage(
            text=f"Batch agent passage {i}",
            agent_id=sarah_agent.id,
            organization_id=default_user.organization_id,
            embedding=[0.1 * i],
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        )
        for i in range(3)
    ]

    created_passages = await server.passage_manager.create_many_agent_passages_async(passages, actor=default_user)

    assert len(created_passages) == 3
    for i, passage in enumerate(created_passages):
        assert passage.text == f"Batch agent passage {i}"
        assert passage.agent_id == sarah_agent.id
        assert passage.source_id is None


@pytest.mark.asyncio
async def test_create_many_source_passages_async(server: SyncServer, default_user, default_file, default_source, event_loop):
    """Test creating multiple source passages using the new batch method."""
    passages = [
        PydanticPassage(
            text=f"Batch source passage {i}",
            source_id=default_source.id,
            file_id=default_file.id,
            organization_id=default_user.organization_id,
            embedding=[0.1 * i],
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        )
        for i in range(3)
    ]

    created_passages = await server.passage_manager.create_many_source_passages_async(
        passages, file_metadata=default_file, actor=default_user
    )

    assert len(created_passages) == 3
    for i, passage in enumerate(created_passages):
        assert passage.text == f"Batch source passage {i}"
        assert passage.source_id == default_source.id
        assert passage.agent_id is None


def test_agent_passage_size(server: SyncServer, default_user, sarah_agent):
    """Test counting agent passages using the new agent-specific size method."""
    initial_size = server.passage_manager.agent_passage_size(actor=default_user, agent_id=sarah_agent.id)

    # Create some agent passages
    for i in range(3):
        server.passage_manager.create_agent_passage(
            PydanticPassage(
                text=f"Agent passage {i} for size test",
                agent_id=sarah_agent.id,
                organization_id=default_user.organization_id,
                embedding=[0.1],
                embedding_config=DEFAULT_EMBEDDING_CONFIG,
            ),
            actor=default_user,
        )

    final_size = server.passage_manager.agent_passage_size(actor=default_user, agent_id=sarah_agent.id)
    assert final_size == initial_size + 3


def test_deprecated_methods_show_warnings(server: SyncServer, default_user, sarah_agent):
    """Test that deprecated methods show deprecation warnings."""
    import warnings

    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")

        # Test deprecated create_passage
        passage = server.passage_manager.create_passage(
            PydanticPassage(
                text="Test deprecated method",
                agent_id=sarah_agent.id,
                organization_id=default_user.organization_id,
                embedding=[0.1],
                embedding_config=DEFAULT_EMBEDDING_CONFIG,
            ),
            actor=default_user,
        )

        # Test deprecated get_passage_by_id
        server.passage_manager.get_passage_by_id(passage.id, actor=default_user)

        # Test deprecated size
        server.passage_manager.size(actor=default_user, agent_id=sarah_agent.id)

        # Check that deprecation warnings were issued
        assert len(w) >= 3
        assert any("create_passage is deprecated" in str(warning.message) for warning in w)
        assert any("get_passage_by_id is deprecated" in str(warning.message) for warning in w)
        assert any("size is deprecated" in str(warning.message) for warning in w)


# ======================================================================================================================
# User Manager Tests
# ======================================================================================================================
@pytest.mark.asyncio
async def test_list_users(server: SyncServer, event_loop):
    # Create default organization
    org = await server.organization_manager.create_default_organization_async()

    user_name = "user"
    user = await server.user_manager.create_actor_async(PydanticUser(name=user_name, organization_id=org.id))

    users = await server.user_manager.list_actors_async()
    assert len(users) == 1
    assert users[0].name == user_name

    # Delete it after
    await server.user_manager.delete_actor_by_id_async(user.id)
    assert len(await server.user_manager.list_actors_async()) == 0


@pytest.mark.asyncio
async def test_create_default_user(server: SyncServer, event_loop):
    org = await server.organization_manager.create_default_organization_async()
    await server.user_manager.create_default_actor_async(org_id=org.id)
    retrieved = await server.user_manager.get_default_actor_async()
    assert retrieved.name == server.user_manager.DEFAULT_USER_NAME


@pytest.mark.asyncio
async def test_update_user(server: SyncServer, event_loop):
    # Create default organization
    default_org = server.organization_manager.create_default_organization()
    test_org = server.organization_manager.create_organization(PydanticOrganization(name="test_org"))

    user_name_a = "a"
    user_name_b = "b"

    # Assert it's been created
    user = await server.user_manager.create_actor_async(PydanticUser(name=user_name_a, organization_id=default_org.id))
    assert user.name == user_name_a

    # Adjust name
    user = await server.user_manager.update_actor_async(UserUpdate(id=user.id, name=user_name_b))
    assert user.name == user_name_b
    assert user.organization_id == DEFAULT_ORG_ID

    # Adjust org id
    user = await server.user_manager.update_actor_async(UserUpdate(id=user.id, organization_id=test_org.id))
    assert user.name == user_name_b
    assert user.organization_id == test_org.id


@pytest.mark.asyncio
async def test_user_caching(server: SyncServer, event_loop, default_user, performance_pct=0.4):
    if isinstance(await get_redis_client(), NoopAsyncRedisClient):
        pytest.skip("redis not available")
    # Invalidate previous cache behavior.
    await server.user_manager._invalidate_actor_cache(default_user.id)
    before_stats = server.user_manager.get_actor_by_id_async.cache_stats
    before_cache_misses = before_stats.misses
    before_cache_hits = before_stats.hits

    # First call (expected to miss the cache)
    async with AsyncTimer() as timer:
        actor = await server.user_manager.get_actor_by_id_async(default_user.id)
    duration_first = timer.elapsed_ns
    print(f"Call 1: {duration_first:.2e}ns")
    assert actor.id == default_user.id
    assert duration_first > 0  # Sanity check: took non-zero time
    cached_hits = 10
    durations = []
    for i in range(cached_hits):
        async with AsyncTimer() as timer:
            actor_cached = await server.user_manager.get_actor_by_id_async(default_user.id)
        duration = timer.elapsed_ns
        durations.append(duration)
        print(f"Call {i+2}: {duration:.2e}ns")
        assert actor_cached == actor
    for d in durations:
        assert d < duration_first * performance_pct
    stats = server.user_manager.get_actor_by_id_async.cache_stats

    print(f"Before calls: {before_stats}")
    print(f"After calls: {stats}")
    # Assert cache stats
    assert stats.misses - before_cache_misses == 1
    assert stats.hits - before_cache_hits == cached_hits


# ======================================================================================================================
# ToolManager Tests
# ======================================================================================================================


def test_create_tool(server: SyncServer, print_tool, default_user, default_organization):
    # Assertions to ensure the created tool matches the expected values
    assert print_tool.created_by_id == default_user.id
    assert print_tool.tool_type == ToolType.CUSTOM


def test_create_composio_tool(server: SyncServer, composio_github_star_tool, default_user, default_organization):
    # Assertions to ensure the created tool matches the expected values
    assert composio_github_star_tool.created_by_id == default_user.id
    assert composio_github_star_tool.tool_type == ToolType.EXTERNAL_COMPOSIO


def test_create_mcp_tool(server: SyncServer, mcp_tool, default_user, default_organization):
    # Assertions to ensure the created tool matches the expected values
    assert mcp_tool.created_by_id == default_user.id
    assert mcp_tool.tool_type == ToolType.EXTERNAL_MCP
    assert mcp_tool.metadata_[MCP_TOOL_TAG_NAME_PREFIX]["server_name"] == "test"
    assert mcp_tool.metadata_[MCP_TOOL_TAG_NAME_PREFIX]["server_id"] == "test-server-id"


# Test should work with both SQLite and PostgreSQL
def test_create_tool_duplicate_name(server: SyncServer, print_tool, default_user, default_organization):
    data = print_tool.model_dump(exclude=["id"])
    tool = PydanticTool(**data)

    with pytest.raises(UniqueConstraintViolationError):
        server.tool_manager.create_tool(tool, actor=default_user)


def test_get_tool_by_id(server: SyncServer, print_tool, default_user):
    # Fetch the tool by ID using the manager method
    fetched_tool = server.tool_manager.get_tool_by_id(print_tool.id, actor=default_user)

    # Assertions to check if the fetched tool matches the created tool
    assert fetched_tool.id == print_tool.id
    assert fetched_tool.name == print_tool.name
    assert fetched_tool.description == print_tool.description
    assert fetched_tool.tags == print_tool.tags
    assert fetched_tool.metadata_ == print_tool.metadata_
    assert fetched_tool.source_code == print_tool.source_code
    assert fetched_tool.source_type == print_tool.source_type
    assert fetched_tool.tool_type == ToolType.CUSTOM


def test_get_tool_with_actor(server: SyncServer, print_tool, default_user):
    # Fetch the print_tool by name and organization ID
    fetched_tool = server.tool_manager.get_tool_by_name(print_tool.name, actor=default_user)

    # Assertions to check if the fetched tool matches the created tool
    assert fetched_tool.id == print_tool.id
    assert fetched_tool.name == print_tool.name
    assert fetched_tool.created_by_id == default_user.id
    assert fetched_tool.description == print_tool.description
    assert fetched_tool.tags == print_tool.tags
    assert fetched_tool.source_code == print_tool.source_code
    assert fetched_tool.source_type == print_tool.source_type
    assert fetched_tool.tool_type == ToolType.CUSTOM


@pytest.mark.asyncio
async def test_list_tools(server: SyncServer, print_tool, default_user, event_loop):
    # List tools (should include the one created by the fixture)
    tools = await server.tool_manager.list_tools_async(actor=default_user, upsert_base_tools=False)

    # Assertions to check that the created tool is listed
    assert len(tools) == 1
    assert any(t.id == print_tool.id for t in tools)


def test_update_tool_by_id(server: SyncServer, print_tool, default_user):
    updated_description = "updated_description"
    return_char_limit = 10000

    # Create a ToolUpdate object to modify the print_tool's description
    tool_update = ToolUpdate(description=updated_description, return_char_limit=return_char_limit)

    # Update the tool using the manager method
    server.tool_manager.update_tool_by_id(print_tool.id, tool_update, actor=default_user)

    # Fetch the updated tool to verify the changes
    updated_tool = server.tool_manager.get_tool_by_id(print_tool.id, actor=default_user)

    # Assertions to check if the update was successful
    assert updated_tool.description == updated_description
    assert updated_tool.return_char_limit == return_char_limit
    assert updated_tool.tool_type == ToolType.CUSTOM

    # Dangerous: we bypass safety to give it another tool type
    server.tool_manager.update_tool_by_id(print_tool.id, tool_update, actor=default_user, updated_tool_type=ToolType.EXTERNAL_MCP)
    updated_tool = server.tool_manager.get_tool_by_id(print_tool.id, actor=default_user)
    assert updated_tool.tool_type == ToolType.EXTERNAL_MCP


def test_update_tool_source_code_refreshes_schema_and_name(server: SyncServer, print_tool, default_user):
    def counter_tool(counter: int):
        """
        Args:
            counter (int): The counter to count to.

        Returns:
            bool: If it successfully counted to the counter.
        """
        for c in range(counter):
            print(c)

        return True

    # Test begins
    og_json_schema = print_tool.json_schema

    source_code = parse_source_code(counter_tool)

    # Create a ToolUpdate object to modify the tool's source_code
    tool_update = ToolUpdate(source_code=source_code)

    # Update the tool using the manager method
    server.tool_manager.update_tool_by_id(print_tool.id, tool_update, actor=default_user)

    # Fetch the updated tool to verify the changes
    updated_tool = server.tool_manager.get_tool_by_id(print_tool.id, actor=default_user)

    # Assertions to check if the update was successful, and json_schema is updated as well
    assert updated_tool.source_code == source_code
    assert updated_tool.json_schema != og_json_schema

    new_schema = derive_openai_json_schema(source_code=updated_tool.source_code)
    assert updated_tool.json_schema == new_schema
    assert updated_tool.tool_type == ToolType.CUSTOM


def test_update_tool_source_code_refreshes_schema_only(server: SyncServer, print_tool, default_user):
    def counter_tool(counter: int):
        """
        Args:
            counter (int): The counter to count to.

        Returns:
            bool: If it successfully counted to the counter.
        """
        for c in range(counter):
            print(c)

        return True

    # Test begins
    og_json_schema = print_tool.json_schema

    source_code = parse_source_code(counter_tool)
    name = "counter_tool"

    # Create a ToolUpdate object to modify the tool's source_code
    tool_update = ToolUpdate(source_code=source_code)

    # Update the tool using the manager method
    server.tool_manager.update_tool_by_id(print_tool.id, tool_update, actor=default_user)

    # Fetch the updated tool to verify the changes
    updated_tool = server.tool_manager.get_tool_by_id(print_tool.id, actor=default_user)

    # Assertions to check if the update was successful, and json_schema is updated as well
    assert updated_tool.source_code == source_code
    assert updated_tool.json_schema != og_json_schema

    new_schema = derive_openai_json_schema(source_code=updated_tool.source_code, name=updated_tool.name)
    assert updated_tool.json_schema == new_schema
    assert updated_tool.name == name
    assert updated_tool.tool_type == ToolType.CUSTOM


def test_update_tool_multi_user(server: SyncServer, print_tool, default_user, other_user):
    updated_description = "updated_description"

    # Create a ToolUpdate object to modify the print_tool's description
    tool_update = ToolUpdate(description=updated_description)

    # Update the print_tool using the manager method, but WITH THE OTHER USER'S ID!
    server.tool_manager.update_tool_by_id(print_tool.id, tool_update, actor=other_user)

    # Check that the created_by and last_updated_by fields are correct
    # Fetch the updated print_tool to verify the changes
    updated_tool = server.tool_manager.get_tool_by_id(print_tool.id, actor=default_user)

    assert updated_tool.last_updated_by_id == other_user.id
    assert updated_tool.created_by_id == default_user.id


@pytest.mark.asyncio
async def test_delete_tool_by_id(server: SyncServer, print_tool, default_user, event_loop):
    # Delete the print_tool using the manager method
    server.tool_manager.delete_tool_by_id(print_tool.id, actor=default_user)

    tools = await server.tool_manager.list_tools_async(actor=default_user, upsert_base_tools=False)
    assert len(tools) == 0


@pytest.mark.asyncio
async def test_upsert_base_tools(server: SyncServer, default_user, event_loop):
    tools = await server.tool_manager.upsert_base_tools_async(actor=default_user)

    # Calculate expected tools accounting for production filtering
    if os.getenv("LETTA_ENVIRONMENT") == "PRODUCTION":
        expected_tool_names = sorted(LETTA_TOOL_SET - set(LOCAL_ONLY_MULTI_AGENT_TOOLS))
    else:
        expected_tool_names = sorted(LETTA_TOOL_SET)

    assert sorted([t.name for t in tools]) == expected_tool_names

    # Call it again to make sure it doesn't create duplicates
    tools = await server.tool_manager.upsert_base_tools_async(actor=default_user)
    assert sorted([t.name for t in tools]) == expected_tool_names

    # Confirm that the return tools have no source_code, but a json_schema
    for t in tools:
        if t.name in BASE_TOOLS:
            assert t.tool_type == ToolType.LETTA_CORE
        elif t.name in BASE_MEMORY_TOOLS:
            assert t.tool_type == ToolType.LETTA_MEMORY_CORE
        elif t.name in MULTI_AGENT_TOOLS:
            assert t.tool_type == ToolType.LETTA_MULTI_AGENT_CORE
        elif t.name in BASE_SLEEPTIME_TOOLS:
            assert t.tool_type == ToolType.LETTA_SLEEPTIME_CORE
        elif t.name in BASE_VOICE_SLEEPTIME_TOOLS:
            assert t.tool_type == ToolType.LETTA_VOICE_SLEEPTIME_CORE
        elif t.name in BASE_VOICE_SLEEPTIME_CHAT_TOOLS:
            assert t.tool_type == ToolType.LETTA_VOICE_SLEEPTIME_CORE
        elif t.name in BUILTIN_TOOLS:
            assert t.tool_type == ToolType.LETTA_BUILTIN
        elif t.name in FILES_TOOLS:
            assert t.tool_type == ToolType.LETTA_FILES_CORE
        else:
            pytest.fail(f"The tool name is unrecognized as a base tool: {t.name}")
        assert t.source_code is None
        assert t.json_schema


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "tool_type,expected_names",
    [
        (ToolType.LETTA_CORE, BASE_TOOLS),
        (ToolType.LETTA_MEMORY_CORE, BASE_MEMORY_TOOLS),
        (ToolType.LETTA_MULTI_AGENT_CORE, MULTI_AGENT_TOOLS),
        (ToolType.LETTA_SLEEPTIME_CORE, BASE_SLEEPTIME_TOOLS),
        (ToolType.LETTA_VOICE_SLEEPTIME_CORE, sorted(set(BASE_VOICE_SLEEPTIME_TOOLS + BASE_VOICE_SLEEPTIME_CHAT_TOOLS) - {"send_message"})),
        (ToolType.LETTA_BUILTIN, BUILTIN_TOOLS),
        (ToolType.LETTA_FILES_CORE, FILES_TOOLS),
    ],
)
async def test_upsert_filtered_base_tools(server: SyncServer, default_user, tool_type, expected_names):
    tools = await server.tool_manager.upsert_base_tools_async(actor=default_user, allowed_types={tool_type})
    tool_names = sorted([t.name for t in tools])

    # Adjust expected names for multi-agent tools in production
    if tool_type == ToolType.LETTA_MULTI_AGENT_CORE and os.getenv("LETTA_ENVIRONMENT") == "PRODUCTION":
        expected_sorted = sorted(set(expected_names) - set(LOCAL_ONLY_MULTI_AGENT_TOOLS))
    else:
        expected_sorted = sorted(expected_names)

    assert tool_names == expected_sorted
    assert all(t.tool_type == tool_type for t in tools)


@pytest.mark.asyncio
async def test_upsert_multiple_tool_types(server: SyncServer, default_user):
    allowed = {ToolType.LETTA_CORE, ToolType.LETTA_BUILTIN, ToolType.LETTA_FILES_CORE}
    tools = await server.tool_manager.upsert_base_tools_async(actor=default_user, allowed_types=allowed)
    tool_names = {t.name for t in tools}
    expected = set(BASE_TOOLS + BUILTIN_TOOLS + FILES_TOOLS)

    assert tool_names == expected
    assert all(t.tool_type in allowed for t in tools)


@pytest.mark.asyncio
async def test_upsert_base_tools_with_empty_type_filter(server: SyncServer, default_user):
    tools = await server.tool_manager.upsert_base_tools_async(actor=default_user, allowed_types=set())
    assert tools == []


@pytest.mark.asyncio
async def test_bulk_upsert_tools_async(server: SyncServer, default_user):
    """Test bulk upserting multiple tools at once"""
    # create multiple test tools
    tools_data = []
    for i in range(5):
        tool = PydanticTool(
            name=f"bulk_test_tool_{i}",
            description=f"Test tool {i} for bulk operations",
            tags=["bulk", "test"],
            source_code=f"def bulk_test_tool_{i}():\n    '''Test tool {i} function'''\n    return 'result_{i}'",
            source_type="python",
        )
        tools_data.append(tool)

    # initial bulk upsert - should create all tools
    created_tools = await server.tool_manager.bulk_upsert_tools_async(tools_data, default_user)
    assert len(created_tools) == 5
    assert all(t.name.startswith("bulk_test_tool_") for t in created_tools)
    assert all(t.description for t in created_tools)

    # verify all tools were created
    for i in range(5):
        tool = await server.tool_manager.get_tool_by_name_async(f"bulk_test_tool_{i}", default_user)
        assert tool is not None
        assert tool.description == f"Test tool {i} for bulk operations"

    # modify some tools and upsert again - should update existing tools
    tools_data[0].description = "Updated description for tool 0"
    tools_data[2].tags = ["bulk", "test", "updated"]

    updated_tools = await server.tool_manager.bulk_upsert_tools_async(tools_data, default_user)
    assert len(updated_tools) == 5

    # verify updates were applied
    tool_0 = await server.tool_manager.get_tool_by_name_async("bulk_test_tool_0", default_user)
    assert tool_0.description == "Updated description for tool 0"

    tool_2 = await server.tool_manager.get_tool_by_name_async("bulk_test_tool_2", default_user)
    assert "updated" in tool_2.tags

    # test with empty list
    empty_result = await server.tool_manager.bulk_upsert_tools_async([], default_user)
    assert empty_result == []

    # test with tools missing descriptions (should auto-generate from json schema)
    no_desc_tool = PydanticTool(
        name="no_description_tool",
        tags=["test"],
        source_code="def no_description_tool():\n    '''This is a docstring description'''\n    return 'result'",
        source_type="python",
    )
    result = await server.tool_manager.bulk_upsert_tools_async([no_desc_tool], default_user)
    assert len(result) == 1
    assert result[0].description is not None  # should be auto-generated from docstring


@pytest.mark.asyncio
async def test_bulk_upsert_tools_name_conflict(server: SyncServer, default_user):
    """Test bulk upserting tools handles name+org_id unique constraint correctly"""

    # create a tool with a specific name
    original_tool = PydanticTool(
        name="unique_name_tool",
        description="Original description",
        tags=["original"],
        source_code="def unique_name_tool():\n    '''Original function'''\n    return 'original'",
        source_type="python",
    )

    # create it
    created = await server.tool_manager.create_tool_async(original_tool, default_user)
    original_id = created.id

    # now try to bulk upsert with same name but different id
    conflicting_tool = PydanticTool(
        name="unique_name_tool",  # same name
        description="Updated via bulk upsert",
        tags=["updated", "bulk"],
        source_code="def unique_name_tool():\n    '''Updated function'''\n    return 'updated'",
        source_type="python",
    )

    # bulk upsert should update the existing tool based on name conflict
    result = await server.tool_manager.bulk_upsert_tools_async([conflicting_tool], default_user)
    assert len(result) == 1
    assert result[0].name == "unique_name_tool"
    assert result[0].description == "Updated via bulk upsert"
    assert "updated" in result[0].tags
    assert "bulk" in result[0].tags

    # verify only one tool exists with this name
    all_tools = await server.tool_manager.list_tools_async(actor=default_user)
    tools_with_name = [t for t in all_tools if t.name == "unique_name_tool"]
    assert len(tools_with_name) == 1

    # the id should remain the same as the original
    assert tools_with_name[0].id == original_id


@pytest.mark.asyncio
async def test_bulk_upsert_tools_mixed_create_update(server: SyncServer, default_user):
    """Test bulk upserting with mix of new tools and updates to existing ones"""

    # create some existing tools
    existing_tools = []
    for i in range(3):
        tool = PydanticTool(
            name=f"existing_tool_{i}",
            description=f"Existing tool {i}",
            tags=["existing"],
            source_code=f"def existing_tool_{i}():\n    '''Existing {i}'''\n    return 'existing_{i}'",
            source_type="python",
        )
        created = await server.tool_manager.create_tool_async(tool, default_user)
        existing_tools.append(created)

    # prepare bulk upsert with mix of updates and new tools
    bulk_tools = []

    # update existing tool 0 by name
    bulk_tools.append(
        PydanticTool(
            name="existing_tool_0",  # matches by name
            description="Updated existing tool 0",
            tags=["existing", "updated"],
            source_code="def existing_tool_0():\n    '''Updated 0'''\n    return 'updated_0'",
            source_type="python",
        )
    )

    # update existing tool 1 by name (since bulk upsert matches by name, not id)
    bulk_tools.append(
        PydanticTool(
            name="existing_tool_1",  # matches by name
            description="Updated existing tool 1",
            tags=["existing", "updated"],
            source_code="def existing_tool_1():\n    '''Updated 1'''\n    return 'updated_1'",
            source_type="python",
        )
    )

    # add completely new tools
    for i in range(3, 6):
        bulk_tools.append(
            PydanticTool(
                name=f"new_tool_{i}",
                description=f"New tool {i}",
                tags=["new"],
                source_code=f"def new_tool_{i}():\n    '''New {i}'''\n    return 'new_{i}'",
                source_type="python",
            )
        )

    # perform bulk upsert
    result = await server.tool_manager.bulk_upsert_tools_async(bulk_tools, default_user)
    assert len(result) == 5  # 2 updates + 3 new

    # verify updates
    tool_0 = await server.tool_manager.get_tool_by_name_async("existing_tool_0", default_user)
    assert tool_0.description == "Updated existing tool 0"
    assert "updated" in tool_0.tags
    assert tool_0.id == existing_tools[0].id  # id should remain same

    # verify tool 1 was updated
    tool_1 = await server.tool_manager.get_tool_by_id_async(existing_tools[1].id, default_user)
    assert tool_1.name == "existing_tool_1"  # name stays same
    assert tool_1.description == "Updated existing tool 1"
    assert "updated" in tool_1.tags

    # verify new tools were created
    for i in range(3, 6):
        new_tool = await server.tool_manager.get_tool_by_name_async(f"new_tool_{i}", default_user)
        assert new_tool is not None
        assert new_tool.description == f"New tool {i}"
        assert "new" in new_tool.tags

    # verify existing_tool_2 was not affected
    tool_2 = await server.tool_manager.get_tool_by_id_async(existing_tools[2].id, default_user)
    assert tool_2.name == "existing_tool_2"
    assert tool_2.description == "Existing tool 2"
    assert tool_2.tags == ["existing"]


@pytest.mark.asyncio
async def test_create_tool_with_pip_requirements(server: SyncServer, default_user, default_organization):
    def test_tool_with_deps():
        """
        A test tool with pip dependencies.

        Returns:
            str: Hello message.
        """
        return "hello"

    # Create pip requirements
    pip_reqs = [
        PipRequirement(name="requests", version="2.28.0"),
        PipRequirement(name="numpy"),  # No version specified
    ]

    # Set up tool details
    source_code = parse_source_code(test_tool_with_deps)
    source_type = "python"
    description = "A test tool with pip dependencies"
    tags = ["test"]
    metadata = {"test": "pip_requirements"}

    tool = PydanticTool(
        description=description, tags=tags, source_code=source_code, source_type=source_type, metadata_=metadata, pip_requirements=pip_reqs
    )
    derived_json_schema = derive_openai_json_schema(source_code=tool.source_code, name=tool.name)
    derived_name = derived_json_schema["name"]
    tool.json_schema = derived_json_schema
    tool.name = derived_name

    created_tool = await server.tool_manager.create_or_update_tool_async(tool, actor=default_user)

    # Assertions
    assert created_tool.pip_requirements is not None
    assert len(created_tool.pip_requirements) == 2
    assert created_tool.pip_requirements[0].name == "requests"
    assert created_tool.pip_requirements[0].version == "2.28.0"
    assert created_tool.pip_requirements[1].name == "numpy"
    assert created_tool.pip_requirements[1].version is None


@pytest.mark.asyncio
async def test_create_tool_without_pip_requirements(server: SyncServer, print_tool):
    # Verify that tools without pip_requirements have the field as None
    assert print_tool.pip_requirements is None


@pytest.mark.asyncio
async def test_update_tool_pip_requirements(server: SyncServer, print_tool, default_user):
    # Add pip requirements to existing tool
    pip_reqs = [
        PipRequirement(name="pandas", version="1.5.0"),
        PipRequirement(name="sumy"),
    ]

    tool_update = ToolUpdate(pip_requirements=pip_reqs)
    await server.tool_manager.update_tool_by_id_async(print_tool.id, tool_update, actor=default_user)

    # Fetch the updated tool
    updated_tool = await server.tool_manager.get_tool_by_id_async(print_tool.id, actor=default_user)

    # Assertions
    assert updated_tool.pip_requirements is not None
    assert len(updated_tool.pip_requirements) == 2
    assert updated_tool.pip_requirements[0].name == "pandas"
    assert updated_tool.pip_requirements[0].version == "1.5.0"
    assert updated_tool.pip_requirements[1].name == "sumy"
    assert updated_tool.pip_requirements[1].version is None


@pytest.mark.asyncio
async def test_update_tool_clear_pip_requirements(server: SyncServer, default_user, default_organization):
    def test_tool_clear_deps():
        """
        A test tool to clear dependencies.

        Returns:
            str: Hello message.
        """
        return "hello"

    # Create a tool with pip requirements
    pip_reqs = [PipRequirement(name="requests")]

    # Set up tool details
    source_code = parse_source_code(test_tool_clear_deps)
    source_type = "python"
    description = "A test tool to clear dependencies"
    tags = ["test"]
    metadata = {"test": "clear_deps"}

    tool = PydanticTool(
        description=description, tags=tags, source_code=source_code, source_type=source_type, metadata_=metadata, pip_requirements=pip_reqs
    )
    derived_json_schema = derive_openai_json_schema(source_code=tool.source_code, name=tool.name)
    derived_name = derived_json_schema["name"]
    tool.json_schema = derived_json_schema
    tool.name = derived_name

    created_tool = await server.tool_manager.create_or_update_tool_async(tool, actor=default_user)

    # Verify it has requirements
    assert created_tool.pip_requirements is not None
    assert len(created_tool.pip_requirements) == 1

    # Clear the requirements
    tool_update = ToolUpdate(pip_requirements=[])
    await server.tool_manager.update_tool_by_id_async(created_tool.id, tool_update, actor=default_user)

    # Fetch the updated tool
    updated_tool = await server.tool_manager.get_tool_by_id_async(created_tool.id, actor=default_user)

    # Assertions
    assert updated_tool.pip_requirements == []


@pytest.mark.asyncio
async def test_pip_requirements_roundtrip(server: SyncServer, default_user, default_organization):
    def roundtrip_test_tool():
        """
        Test pip requirements roundtrip.

        Returns:
            str: Test message.
        """
        return "test"

    # Create pip requirements with various version formats
    pip_reqs = [
        PipRequirement(name="requests", version="2.28.0"),
        PipRequirement(name="flask", version="2.0"),
        PipRequirement(name="django", version="4.1.0-beta"),
        PipRequirement(name="numpy"),  # No version
    ]

    # Set up tool details
    source_code = parse_source_code(roundtrip_test_tool)
    source_type = "python"
    description = "Test pip requirements roundtrip"
    tags = ["test"]
    metadata = {"test": "roundtrip"}

    tool = PydanticTool(
        description=description, tags=tags, source_code=source_code, source_type=source_type, metadata_=metadata, pip_requirements=pip_reqs
    )
    derived_json_schema = derive_openai_json_schema(source_code=tool.source_code, name=tool.name)
    derived_name = derived_json_schema["name"]
    tool.json_schema = derived_json_schema
    tool.name = derived_name

    created_tool = await server.tool_manager.create_or_update_tool_async(tool, actor=default_user)

    # Fetch by ID
    fetched_tool = await server.tool_manager.get_tool_by_id_async(created_tool.id, actor=default_user)

    # Verify all requirements match exactly
    assert fetched_tool.pip_requirements is not None
    assert len(fetched_tool.pip_requirements) == 4

    # Check each requirement
    reqs_dict = {req.name: req.version for req in fetched_tool.pip_requirements}
    assert reqs_dict["requests"] == "2.28.0"
    assert reqs_dict["flask"] == "2.0"
    assert reqs_dict["django"] == "4.1.0-beta"
    assert reqs_dict["numpy"] is None


# ======================================================================================================================
# Message Manager Tests
# ======================================================================================================================


def test_message_create(server: SyncServer, hello_world_message_fixture, default_user):
    """Test creating a message using hello_world_message_fixture fixture"""
    assert hello_world_message_fixture.id is not None
    assert hello_world_message_fixture.content[0].text == "Hello, world!"
    assert hello_world_message_fixture.role == "user"

    # Verify we can retrieve it
    retrieved = server.message_manager.get_message_by_id(
        hello_world_message_fixture.id,
        actor=default_user,
    )
    assert retrieved is not None
    assert retrieved.id == hello_world_message_fixture.id
    assert retrieved.content[0].text == hello_world_message_fixture.content[0].text
    assert retrieved.role == hello_world_message_fixture.role


def test_message_get_by_id(server: SyncServer, hello_world_message_fixture, default_user):
    """Test retrieving a message by ID"""
    retrieved = server.message_manager.get_message_by_id(hello_world_message_fixture.id, actor=default_user)
    assert retrieved is not None
    assert retrieved.id == hello_world_message_fixture.id
    assert retrieved.content[0].text == hello_world_message_fixture.content[0].text


def test_message_update(server: SyncServer, hello_world_message_fixture, default_user, other_user):
    """Test updating a message"""
    new_text = "Updated text"
    updated = server.message_manager.update_message_by_id(hello_world_message_fixture.id, MessageUpdate(content=new_text), actor=other_user)
    assert updated is not None
    assert updated.content[0].text == new_text
    retrieved = server.message_manager.get_message_by_id(hello_world_message_fixture.id, actor=default_user)
    assert retrieved.content[0].text == new_text

    # Assert that orm metadata fields are populated
    assert retrieved.created_by_id == default_user.id
    assert retrieved.last_updated_by_id == other_user.id


def test_message_delete(server: SyncServer, hello_world_message_fixture, default_user):
    """Test deleting a message"""
    server.message_manager.delete_message_by_id(hello_world_message_fixture.id, actor=default_user)
    retrieved = server.message_manager.get_message_by_id(hello_world_message_fixture.id, actor=default_user)
    assert retrieved is None


def test_message_size(server: SyncServer, hello_world_message_fixture, default_user):
    """Test counting messages with filters"""
    base_message = hello_world_message_fixture

    # Create additional test messages
    messages = [
        PydanticMessage(
            agent_id=base_message.agent_id,
            role=base_message.role,
            content=[TextContent(text=f"Test message {i}")],
        )
        for i in range(4)
    ]
    server.message_manager.create_many_messages(messages, actor=default_user)

    # Test total count
    total = server.message_manager.size(actor=default_user, role=MessageRole.user)
    assert total == 6  # login message + base message + 4 test messages
    # TODO: change login message to be a system not user message

    # Test count with agent filter
    agent_count = server.message_manager.size(actor=default_user, agent_id=base_message.agent_id, role=MessageRole.user)
    assert agent_count == 6

    # Test count with role filter
    role_count = server.message_manager.size(actor=default_user, role=base_message.role)
    assert role_count == 6

    # Test count with non-existent filter
    empty_count = server.message_manager.size(actor=default_user, agent_id="non-existent", role=MessageRole.user)
    assert empty_count == 0


def create_test_messages(server: SyncServer, base_message: PydanticMessage, default_user) -> list[PydanticMessage]:
    """Helper function to create test messages for all tests"""
    messages = [
        PydanticMessage(
            agent_id=base_message.agent_id,
            role=base_message.role,
            content=[TextContent(text=f"Test message {i}")],
        )
        for i in range(4)
    ]
    server.message_manager.create_many_messages(messages, actor=default_user)
    return messages


def test_get_messages_by_ids(server: SyncServer, hello_world_message_fixture, default_user, sarah_agent):
    """Test basic message listing with limit"""
    messages = create_test_messages(server, hello_world_message_fixture, default_user)
    message_ids = [m.id for m in messages]

    results = server.message_manager.get_messages_by_ids(message_ids=message_ids, actor=default_user)
    assert sorted(message_ids) == sorted([r.id for r in results])


def test_message_listing_basic(server: SyncServer, hello_world_message_fixture, default_user, sarah_agent):
    """Test basic message listing with limit"""
    create_test_messages(server, hello_world_message_fixture, default_user)

    results = server.message_manager.list_user_messages_for_agent(agent_id=sarah_agent.id, limit=3, actor=default_user)
    assert len(results) == 3


def test_message_listing_cursor(server: SyncServer, hello_world_message_fixture, default_user, sarah_agent):
    """Test cursor-based pagination functionality"""
    create_test_messages(server, hello_world_message_fixture, default_user)

    # Make sure there are 6 messages
    assert server.message_manager.size(actor=default_user, role=MessageRole.user) == 6

    # Get first page
    first_page = server.message_manager.list_user_messages_for_agent(agent_id=sarah_agent.id, actor=default_user, limit=3)
    assert len(first_page) == 3

    last_id_on_first_page = first_page[-1].id

    # Get second page
    second_page = server.message_manager.list_user_messages_for_agent(
        agent_id=sarah_agent.id, actor=default_user, after=last_id_on_first_page, limit=3
    )
    assert len(second_page) == 3  # Should have 3 remaining messages
    assert all(r1.id != r2.id for r1 in first_page for r2 in second_page)

    # Get the middle
    middle_page = server.message_manager.list_user_messages_for_agent(
        agent_id=sarah_agent.id, actor=default_user, before=second_page[1].id, after=first_page[0].id
    )
    assert len(middle_page) == 3
    assert middle_page[0].id == first_page[1].id
    assert middle_page[1].id == first_page[-1].id
    assert middle_page[-1].id == second_page[0].id

    middle_page_desc = server.message_manager.list_user_messages_for_agent(
        agent_id=sarah_agent.id, actor=default_user, before=second_page[1].id, after=first_page[0].id, ascending=False
    )
    assert len(middle_page_desc) == 3
    assert middle_page_desc[0].id == second_page[0].id
    assert middle_page_desc[1].id == first_page[-1].id
    assert middle_page_desc[-1].id == first_page[1].id


def test_message_listing_filtering(server: SyncServer, hello_world_message_fixture, default_user, sarah_agent):
    """Test filtering messages by agent ID"""
    create_test_messages(server, hello_world_message_fixture, default_user)

    agent_results = server.message_manager.list_user_messages_for_agent(agent_id=sarah_agent.id, actor=default_user, limit=10)
    assert len(agent_results) == 6  # login message + base message + 4 test messages
    assert all(msg.agent_id == hello_world_message_fixture.agent_id for msg in agent_results)


def test_message_listing_text_search(server: SyncServer, hello_world_message_fixture, default_user, sarah_agent):
    """Test searching messages by text content"""
    create_test_messages(server, hello_world_message_fixture, default_user)

    search_results = server.message_manager.list_user_messages_for_agent(
        agent_id=sarah_agent.id, actor=default_user, query_text="Test message", limit=10
    )
    assert len(search_results) == 4
    assert all("Test message" in msg.content[0].text for msg in search_results)

    # Test no results
    search_results = server.message_manager.list_user_messages_for_agent(
        agent_id=sarah_agent.id, actor=default_user, query_text="Letta", limit=10
    )
    assert len(search_results) == 0


# ======================================================================================================================
# Block Manager Tests - Basic
# ======================================================================================================================


def test_create_block(server: SyncServer, default_user):
    block_manager = BlockManager()
    block_create = PydanticBlock(
        label="human",
        is_template=True,
        value="Sample content",
        template_name="sample_template",
        description="A test block",
        limit=1000,
        metadata={"example": "data"},
    )

    block = block_manager.create_or_update_block(block_create, actor=default_user)

    # Assertions to ensure the created block matches the expected values
    assert block.label == block_create.label
    assert block.is_template == block_create.is_template
    assert block.value == block_create.value
    assert block.template_name == block_create.template_name
    assert block.description == block_create.description
    assert block.limit == block_create.limit
    assert block.metadata == block_create.metadata


@pytest.mark.asyncio
async def test_batch_create_blocks_async(server: SyncServer, default_user):
    """Test batch creating multiple blocks at once"""
    block_manager = BlockManager()

    # create multiple test blocks
    blocks_data = []
    for i in range(5):
        block = PydanticBlock(
            label=f"test_block_{i}",
            is_template=False,
            value=f"Content for block {i}",
            description=f"Test block {i} for batch operations",
            limit=1000 + i * 100,  # varying limits
            metadata={"index": i, "batch": "test"},
        )
        blocks_data.append(block)

    # batch create all blocks at once
    created_blocks = await block_manager.batch_create_blocks_async(blocks_data, default_user)

    # verify all blocks were created
    assert len(created_blocks) == 5
    assert all(b.label.startswith("test_block_") for b in created_blocks)

    # verify block properties were preserved
    for i, block in enumerate(created_blocks):
        assert block.label == f"test_block_{i}"
        assert block.value == f"Content for block {i}"
        assert block.description == f"Test block {i} for batch operations"
        assert block.limit == 1000 + i * 100
        assert block.metadata["index"] == i
        assert block.metadata["batch"] == "test"
        assert block.id is not None  # should have generated ids
        # blocks have organization_id at the orm level, not in the pydantic model

    # verify blocks can be retrieved individually
    for created_block in created_blocks:
        retrieved = await block_manager.get_block_by_id_async(created_block.id, default_user)
        assert retrieved.id == created_block.id
        assert retrieved.label == created_block.label
        assert retrieved.value == created_block.value

    # test with empty list
    empty_result = await block_manager.batch_create_blocks_async([], default_user)
    assert empty_result == []

    # test creating blocks with same labels (should create separate blocks since no unique constraint)
    duplicate_blocks = [
        PydanticBlock(label="duplicate_label", value="Block 1"),
        PydanticBlock(label="duplicate_label", value="Block 2"),
        PydanticBlock(label="duplicate_label", value="Block 3"),
    ]

    created_duplicates = await block_manager.batch_create_blocks_async(duplicate_blocks, default_user)
    assert len(created_duplicates) == 3
    assert all(b.label == "duplicate_label" for b in created_duplicates)
    # all should have different ids
    ids = [b.id for b in created_duplicates]
    assert len(set(ids)) == 3  # all unique ids
    # but different values
    values = [b.value for b in created_duplicates]
    assert set(values) == {"Block 1", "Block 2", "Block 3"}


@pytest.mark.asyncio
async def test_get_blocks(server, default_user, event_loop):
    block_manager = BlockManager()

    # Create blocks to retrieve later
    block_manager.create_or_update_block(PydanticBlock(label="human", value="Block 1"), actor=default_user)
    block_manager.create_or_update_block(PydanticBlock(label="persona", value="Block 2"), actor=default_user)

    # Retrieve blocks by different filters
    all_blocks = await block_manager.get_blocks_async(actor=default_user)
    assert len(all_blocks) == 2

    human_blocks = await block_manager.get_blocks_async(actor=default_user, label="human")
    assert len(human_blocks) == 1
    assert human_blocks[0].label == "human"

    persona_blocks = await block_manager.get_blocks_async(actor=default_user, label="persona")
    assert len(persona_blocks) == 1
    assert persona_blocks[0].label == "persona"


@pytest.mark.asyncio
async def test_get_blocks_comprehensive(server, default_user, other_user_different_org, event_loop):
    def random_label(prefix="label"):
        return f"{prefix}_{''.join(random.choices(string.ascii_lowercase, k=6))}"

    def random_value():
        return "".join(random.choices(string.ascii_letters + string.digits, k=12))

    block_manager = BlockManager()

    # Create 10 blocks for default_user
    default_user_blocks = []
    for _ in range(10):
        label = random_label("default")
        value = random_value()
        block_manager.create_or_update_block(PydanticBlock(label=label, value=value), actor=default_user)
        default_user_blocks.append((label, value))

    # Create 3 blocks for other_user
    other_user_blocks = []
    for _ in range(3):
        label = random_label("other")
        value = random_value()
        block_manager.create_or_update_block(PydanticBlock(label=label, value=value), actor=other_user_different_org)
        other_user_blocks.append((label, value))

    # Check default_user sees only their blocks
    retrieved_default_blocks = await block_manager.get_blocks_async(actor=default_user)
    assert len(retrieved_default_blocks) == 10
    retrieved_labels = {b.label for b in retrieved_default_blocks}
    for label, value in default_user_blocks:
        assert label in retrieved_labels

    # Check individual filtering for default_user
    for label, value in default_user_blocks:
        filtered = await block_manager.get_blocks_async(actor=default_user, label=label)
        assert len(filtered) == 1
        assert filtered[0].label == label
        assert filtered[0].value == value

    # Check other_user sees only their blocks
    retrieved_other_blocks = await block_manager.get_blocks_async(actor=other_user_different_org)
    assert len(retrieved_other_blocks) == 3
    retrieved_labels = {b.label for b in retrieved_other_blocks}
    for label, value in other_user_blocks:
        assert label in retrieved_labels

    # Other user shouldn't see default_user's blocks
    for label, _ in default_user_blocks:
        assert (await block_manager.get_blocks_async(actor=other_user_different_org, label=label)) == []

    # Default user shouldn't see other_user's blocks
    for label, _ in other_user_blocks:
        assert (await block_manager.get_blocks_async(actor=default_user, label=label)) == []


def test_update_block(server: SyncServer, default_user):
    block_manager = BlockManager()
    block = block_manager.create_or_update_block(PydanticBlock(label="persona", value="Original Content"), actor=default_user)

    # Update block's content
    update_data = BlockUpdate(value="Updated Content", description="Updated description")
    block_manager.update_block(block_id=block.id, block_update=update_data, actor=default_user)

    # Retrieve the updated block
    updated_block = block_manager.get_block_by_id(actor=default_user, block_id=block.id)

    # Assertions to verify the update
    assert updated_block.value == "Updated Content"
    assert updated_block.description == "Updated description"


def test_update_block_limit(server: SyncServer, default_user):
    block_manager = BlockManager()
    block = block_manager.create_or_update_block(PydanticBlock(label="persona", value="Original Content"), actor=default_user)

    limit = len("Updated Content") * 2000
    update_data = BlockUpdate(value="Updated Content" * 2000, description="Updated description")

    # Check that exceeding the block limit raises an exception
    with pytest.raises(ValueError):
        block_manager.update_block(block_id=block.id, block_update=update_data, actor=default_user)

    # Ensure the update works when within limits
    update_data = BlockUpdate(value="Updated Content" * 2000, description="Updated description", limit=limit)
    block_manager.update_block(block_id=block.id, block_update=update_data, actor=default_user)

    # Retrieve the updated block and validate the update
    updated_block = block_manager.get_block_by_id(actor=default_user, block_id=block.id)

    assert updated_block.value == "Updated Content" * 2000
    assert updated_block.description == "Updated description"


def test_update_block_limit_does_not_reset(server: SyncServer, default_user):
    block_manager = BlockManager()
    new_content = "Updated Content" * 2000
    limit = len(new_content)
    block = block_manager.create_or_update_block(PydanticBlock(label="persona", value="Original Content", limit=limit), actor=default_user)

    # Ensure the update works
    update_data = BlockUpdate(value=new_content)
    block_manager.update_block(block_id=block.id, block_update=update_data, actor=default_user)

    # Retrieve the updated block and validate the update
    updated_block = block_manager.get_block_by_id(actor=default_user, block_id=block.id)
    assert updated_block.value == new_content


@pytest.mark.asyncio
async def test_delete_block(server: SyncServer, default_user, event_loop):
    block_manager = BlockManager()

    # Create and delete a block
    block = block_manager.create_or_update_block(PydanticBlock(label="human", value="Sample content"), actor=default_user)
    block_manager.delete_block(block_id=block.id, actor=default_user)

    # Verify that the block was deleted
    blocks = await block_manager.get_blocks_async(actor=default_user)
    assert len(blocks) == 0


@pytest.mark.asyncio
async def test_delete_block_detaches_from_agent(server: SyncServer, sarah_agent, default_user, event_loop):
    # Create and delete a block
    block = server.block_manager.create_or_update_block(PydanticBlock(label="human", value="Sample content"), actor=default_user)
    agent_state = server.agent_manager.attach_block(agent_id=sarah_agent.id, block_id=block.id, actor=default_user)

    # Check that block has been attached
    assert block.id in [b.id for b in agent_state.memory.blocks]

    # Now attempt to delete the block
    server.block_manager.delete_block(block_id=block.id, actor=default_user)

    # Verify that the block was deleted
    blocks = await server.block_manager.get_blocks_async(actor=default_user)
    assert len(blocks) == 0

    # Check that block has been detached too
    agent_state = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    assert not (block.id in [b.id for b in agent_state.memory.blocks])


@pytest.mark.asyncio
async def test_get_agents_for_block(server: SyncServer, sarah_agent, charles_agent, default_user, event_loop):
    # Create and delete a block
    block = server.block_manager.create_or_update_block(PydanticBlock(label="alien", value="Sample content"), actor=default_user)
    sarah_agent = server.agent_manager.attach_block(agent_id=sarah_agent.id, block_id=block.id, actor=default_user)
    charles_agent = server.agent_manager.attach_block(agent_id=charles_agent.id, block_id=block.id, actor=default_user)

    # Check that block has been attached to both
    assert block.id in [b.id for b in sarah_agent.memory.blocks]
    assert block.id in [b.id for b in charles_agent.memory.blocks]

    # Get the agents for that block
    agent_states = await server.block_manager.get_agents_for_block_async(block_id=block.id, actor=default_user)
    assert len(agent_states) == 2

    # Check both agents are in the list
    agent_state_ids = [a.id for a in agent_states]
    assert sarah_agent.id in agent_state_ids
    assert charles_agent.id in agent_state_ids


@pytest.mark.asyncio
async def test_batch_create_multiple_blocks(server: SyncServer, default_user, event_loop):
    block_manager = BlockManager()
    num_blocks = 10

    # Prepare distinct blocks
    blocks_to_create = [PydanticBlock(label=f"batch_label_{i}", value=f"batch_value_{i}") for i in range(num_blocks)]

    # Create the blocks
    created_blocks = block_manager.batch_create_blocks(blocks_to_create, actor=default_user)
    assert len(created_blocks) == num_blocks

    # Map created blocks by label for lookup
    created_by_label = {blk.label: blk for blk in created_blocks}

    # Assert all blocks were created correctly
    for i in range(num_blocks):
        label = f"batch_label_{i}"
        value = f"batch_value_{i}"
        assert label in created_by_label, f"Missing label: {label}"
        blk = created_by_label[label]
        assert blk.value == value
        assert blk.id is not None

    # Confirm all created blocks exist in the full list from get_blocks
    all_labels = {blk.label for blk in await block_manager.get_blocks_async(actor=default_user)}
    expected_labels = {f"batch_label_{i}" for i in range(num_blocks)}
    assert expected_labels.issubset(all_labels)


@pytest.mark.asyncio
async def test_bulk_update_skips_missing_and_truncates_then_returns_none(
    server: SyncServer, default_user: PydanticUser, caplog, event_loop
):
    mgr = BlockManager()

    # create one block with a small limit
    b = mgr.create_or_update_block(
        PydanticBlock(label="human", value="orig", limit=5),
        actor=default_user,
    )

    # prepare updates: one real id with an over‐limit value, plus one missing id
    long_val = random_string(10)  # length > limit==5
    updates = {
        b.id: long_val,
        "nonexistent-id": "whatever",
    }

    caplog.set_level(logging.WARNING)
    result = await mgr.bulk_update_block_values_async(updates, actor=default_user)
    # default return_hydrated=False → should be None
    assert result is None

    # warnings should mention skipping the missing ID and truncation
    assert "skipping during bulk update" in caplog.text
    assert "truncating" in caplog.text

    # confirm the value was truncated to `limit` characters
    reloaded = mgr.get_block_by_id(actor=default_user, block_id=b.id)
    assert len(reloaded.value) == 5
    assert reloaded.value == long_val[:5]


@pytest.mark.asyncio
@pytest.mark.skip(reason="TODO: implement for async")
async def test_bulk_update_return_hydrated_true(server: SyncServer, default_user: PydanticUser, event_loop):
    mgr = BlockManager()

    # create a block
    b = await mgr.create_or_update_block_async(
        PydanticBlock(label="persona", value="foo", limit=20),
        actor=default_user,
    )

    updates = {b.id: "new-val"}
    updated = await mgr.bulk_update_block_values_async(updates, actor=default_user, return_hydrated=True)

    # with return_hydrated=True, we get back a list of schemas
    assert isinstance(updated, list) and len(updated) == 1
    assert updated[0].id == b.id
    assert updated[0].value == "new-val"


@pytest.mark.asyncio
async def test_bulk_update_respects_org_scoping(
    server: SyncServer, default_user: PydanticUser, other_user_different_org: PydanticUser, caplog, event_loop
):
    mgr = BlockManager()

    # one block in each org
    mine = mgr.create_or_update_block(
        PydanticBlock(label="human", value="mine", limit=100),
        actor=default_user,
    )
    theirs = mgr.create_or_update_block(
        PydanticBlock(label="human", value="theirs", limit=100),
        actor=other_user_different_org,
    )

    updates = {
        mine.id: "updated-mine",
        theirs.id: "updated-theirs",
    }

    caplog.set_level(logging.WARNING)
    await mgr.bulk_update_block_values_async(updates, actor=default_user)

    # mine should be updated...
    reloaded_mine = mgr.get_block_by_id(actor=default_user, block_id=mine.id)
    assert reloaded_mine.value == "updated-mine"

    # ...theirs should remain untouched
    reloaded_theirs = mgr.get_block_by_id(actor=other_user_different_org, block_id=theirs.id)
    assert reloaded_theirs.value == "theirs"

    # warning should mention skipping the other-org ID
    assert "skipping during bulk update" in caplog.text


# ======================================================================================================================
# Block Manager Tests - Checkpointing
# ======================================================================================================================


def test_checkpoint_creates_history(server: SyncServer, default_user):
    """
    Ensures that calling checkpoint_block creates a BlockHistory row and updates
    the block's current_history_entry_id appropriately.
    """

    block_manager = BlockManager()

    # Create a block
    initial_value = "Initial block content"
    created_block = block_manager.create_or_update_block(PydanticBlock(label="test_checkpoint", value=initial_value), actor=default_user)

    # Act: checkpoint it
    block_manager.checkpoint_block(block_id=created_block.id, actor=default_user)

    with db_registry.session() as session:
        # Get BlockHistory entries for this block
        history_entries: List[BlockHistory] = session.query(BlockHistory).filter(BlockHistory.block_id == created_block.id).all()
        assert len(history_entries) == 1, "Exactly one history entry should be created"
        hist = history_entries[0]

        # Fetch ORM block for internal checks
        db_block = session.get(Block, created_block.id)

        assert hist.sequence_number == 1
        assert hist.value == initial_value
        assert hist.actor_type == ActorType.LETTA_USER
        assert hist.actor_id == default_user.id
        assert db_block.current_history_entry_id == hist.id


def test_multiple_checkpoints(server: SyncServer, default_user):
    block_manager = BlockManager()

    # Create a block
    block = block_manager.create_or_update_block(PydanticBlock(label="test_multi_checkpoint", value="v1"), actor=default_user)

    # 1) First checkpoint
    block_manager.checkpoint_block(block_id=block.id, actor=default_user)

    # 2) Update block content
    updated_block_data = PydanticBlock(**block.model_dump())
    updated_block_data.value = "v2"
    block_manager.create_or_update_block(updated_block_data, actor=default_user)

    # 3) Second checkpoint
    block_manager.checkpoint_block(block_id=block.id, actor=default_user)

    with db_registry.session() as session:
        history_entries = (
            session.query(BlockHistory).filter(BlockHistory.block_id == block.id).order_by(BlockHistory.sequence_number.asc()).all()
        )
        assert len(history_entries) == 2, "Should have two history entries"

        # First is seq=1, value='v1'
        assert history_entries[0].sequence_number == 1
        assert history_entries[0].value == "v1"

        # Second is seq=2, value='v2'
        assert history_entries[1].sequence_number == 2
        assert history_entries[1].value == "v2"

        # The block should now point to the second entry
        db_block = session.get(Block, block.id)
        assert db_block.current_history_entry_id == history_entries[1].id


def test_checkpoint_with_agent_id(server: SyncServer, default_user, sarah_agent):
    """
    Ensures that if we pass agent_id to checkpoint_block, we get
    actor_type=LETTA_AGENT, actor_id=<agent.id> in BlockHistory.
    """
    block_manager = BlockManager()

    # Create a block
    block = block_manager.create_or_update_block(PydanticBlock(label="test_agent_checkpoint", value="Agent content"), actor=default_user)

    # Checkpoint with agent_id
    block_manager.checkpoint_block(block_id=block.id, actor=default_user, agent_id=sarah_agent.id)

    # Verify
    with db_registry.session() as session:
        hist_entry = session.query(BlockHistory).filter(BlockHistory.block_id == block.id).one()
        assert hist_entry.actor_type == ActorType.LETTA_AGENT
        assert hist_entry.actor_id == sarah_agent.id


def test_checkpoint_with_no_state_change(server: SyncServer, default_user):
    """
    If we call checkpoint_block twice without any edits,
    we expect two entries or only one, depending on your policy.
    """
    block_manager = BlockManager()

    # Create block
    block = block_manager.create_or_update_block(PydanticBlock(label="test_no_change", value="original"), actor=default_user)

    # 1) checkpoint
    block_manager.checkpoint_block(block_id=block.id, actor=default_user)
    # 2) checkpoint again (no changes)
    block_manager.checkpoint_block(block_id=block.id, actor=default_user)

    with db_registry.session() as session:
        all_hist = session.query(BlockHistory).filter(BlockHistory.block_id == block.id).all()
        assert len(all_hist) == 2


def test_checkpoint_concurrency_stale(server: SyncServer, default_user):
    block_manager = BlockManager()

    # create block
    block = block_manager.create_or_update_block(PydanticBlock(label="test_stale_checkpoint", value="hello"), actor=default_user)

    # session1 loads
    with db_registry.session() as s1:
        block_s1 = s1.get(Block, block.id)  # version=1

    # session2 loads
    with db_registry.session() as s2:
        block_s2 = s2.get(Block, block.id)  # also version=1

    # session1 checkpoint => version=2
    with db_registry.session() as s1:
        block_s1 = s1.merge(block_s1)
        block_manager.checkpoint_block(
            block_id=block_s1.id,
            actor=default_user,
            use_preloaded_block=block_s1,  # let manager use the object in memory
        )
        # commits inside checkpoint_block => version goes to 2

    # session2 tries to checkpoint => sees old version=1 => stale error
    with pytest.raises(StaleDataError):
        with db_registry.session() as s2:
            block_s2 = s2.merge(block_s2)
            block_manager.checkpoint_block(
                block_id=block_s2.id,
                actor=default_user,
                use_preloaded_block=block_s2,
            )


def test_checkpoint_no_future_states(server: SyncServer, default_user):
    """
    Ensures that if the block is already at the highest sequence,
    creating a new checkpoint does NOT delete anything.
    """

    block_manager = BlockManager()

    # 1) Create block with "v1" and checkpoint => seq=1
    block_v1 = block_manager.create_or_update_block(PydanticBlock(label="no_future_test", value="v1"), actor=default_user)
    block_manager.checkpoint_block(block_id=block_v1.id, actor=default_user)

    # 2) Create "v2" and checkpoint => seq=2
    updated_data = PydanticBlock(**block_v1.model_dump())
    updated_data.value = "v2"
    block_manager.create_or_update_block(updated_data, actor=default_user)
    block_manager.checkpoint_block(block_id=block_v1.id, actor=default_user)

    # So we have seq=1: v1, seq=2: v2. No "future" states.
    # 3) Another checkpoint (no changes made) => should become seq=3, not delete anything
    block_manager.checkpoint_block(block_id=block_v1.id, actor=default_user)

    with db_registry.session() as session:
        # We expect 3 rows in block_history, none removed
        history_rows = (
            session.query(BlockHistory).filter(BlockHistory.block_id == block_v1.id).order_by(BlockHistory.sequence_number.asc()).all()
        )
        # Should be seq=1, seq=2, seq=3
        assert len(history_rows) == 3
        assert history_rows[0].value == "v1"
        assert history_rows[1].value == "v2"
        # The last is also "v2" if we didn't change it, or the same current fields
        assert history_rows[2].sequence_number == 3
        # There's no leftover row that was deleted


# ======================================================================================================================
# Block Manager Tests - Undo
# ======================================================================================================================


def test_undo_checkpoint_block(server: SyncServer, default_user):
    """
    Verifies that we can undo to the previous checkpoint:
      1) Create a block and checkpoint -> sequence_number=1
      2) Update block content and checkpoint -> sequence_number=2
      3) Undo -> should revert block to sequence_number=1's content
    """
    block_manager = BlockManager()

    # 1) Create block
    initial_value = "Version 1 content"
    created_block = block_manager.create_or_update_block(PydanticBlock(label="undo_test", value=initial_value), actor=default_user)

    # 2) First checkpoint => seq=1
    block_manager.checkpoint_block(block_id=created_block.id, actor=default_user)

    # 3) Update block content to "Version 2"
    updated_data = PydanticBlock(**created_block.model_dump())
    updated_data.value = "Version 2 content"
    block_manager.create_or_update_block(updated_data, actor=default_user)

    # 4) Second checkpoint => seq=2
    block_manager.checkpoint_block(block_id=created_block.id, actor=default_user)

    # 5) Undo => revert to seq=1
    undone_block = block_manager.undo_checkpoint_block(block_id=created_block.id, actor=default_user)

    # 6) Verify the block is now restored to "Version 1" content
    assert undone_block.value == initial_value, "Block should revert to version 1 content"
    assert undone_block.label == "undo_test", "Label should also revert if changed (or remain the same if unchanged)"


def test_checkpoint_deletes_future_states_after_undo(server: SyncServer, default_user):
    """
    Verifies that once we've undone to an earlier checkpoint, creating a new
    checkpoint removes any leftover 'future' states that existed beyond that sequence.
    """
    block_manager = BlockManager()

    # 1) Create block
    block_init = PydanticBlock(label="test_truncation", value="v1")
    block_v1 = block_manager.create_or_update_block(block_init, actor=default_user)
    # Checkpoint => seq=1
    block_manager.checkpoint_block(block_id=block_v1.id, actor=default_user)

    # 2) Update to "v2", checkpoint => seq=2
    block_v2 = PydanticBlock(**block_v1.model_dump())
    block_v2.value = "v2"
    block_manager.create_or_update_block(block_v2, actor=default_user)
    block_manager.checkpoint_block(block_id=block_v1.id, actor=default_user)

    # 3) Update to "v3", checkpoint => seq=3
    block_v3 = PydanticBlock(**block_v1.model_dump())
    block_v3.value = "v3"
    block_manager.create_or_update_block(block_v3, actor=default_user)
    block_manager.checkpoint_block(block_id=block_v1.id, actor=default_user)

    # We now have three states in history: seq=1 (v1), seq=2 (v2), seq=3 (v3).

    # Undo from seq=3 -> seq=2
    block_undo_1 = block_manager.undo_checkpoint_block(block_v1.id, actor=default_user)
    assert block_undo_1.value == "v2"

    # Undo from seq=2 -> seq=1
    block_undo_2 = block_manager.undo_checkpoint_block(block_v1.id, actor=default_user)
    assert block_undo_2.value == "v1"

    # 4) Now we are at seq=1. If we checkpoint again, we should remove the old seq=2,3
    #    because the new code truncates future states beyond seq=1.

    # Let's do a new edit: "v1.5"
    block_v1_5 = PydanticBlock(**block_undo_2.model_dump())
    block_v1_5.value = "v1.5"
    block_manager.create_or_update_block(block_v1_5, actor=default_user)

    # 5) Checkpoint => new seq=2, removing the old seq=2 and seq=3
    block_manager.checkpoint_block(block_id=block_v1.id, actor=default_user)

    with db_registry.session() as session:
        # Let's see which BlockHistory rows remain
        history_entries = (
            session.query(BlockHistory).filter(BlockHistory.block_id == block_v1.id).order_by(BlockHistory.sequence_number.asc()).all()
        )

        # We expect two rows: seq=1 => "v1", seq=2 => "v1.5"
        assert len(history_entries) == 2, f"Expected 2 entries, got {len(history_entries)}"
        assert history_entries[0].sequence_number == 1
        assert history_entries[0].value == "v1"
        assert history_entries[1].sequence_number == 2
        assert history_entries[1].value == "v1.5"

        # No row should contain "v2" or "v3"
        existing_values = {h.value for h in history_entries}
        assert "v2" not in existing_values, "Old seq=2 should have been removed."
        assert "v3" not in existing_values, "Old seq=3 should have been removed."


def test_undo_no_history(server: SyncServer, default_user):
    """
    If a block has never been checkpointed (no current_history_entry_id),
    undo_checkpoint_block should raise a ValueError.
    """
    block_manager = BlockManager()

    # Create a block but don't checkpoint it
    block = block_manager.create_or_update_block(PydanticBlock(label="no_history_test", value="initial"), actor=default_user)

    # Attempt to undo
    with pytest.raises(ValueError, match="has no history entry - cannot undo"):
        block_manager.undo_checkpoint_block(block_id=block.id, actor=default_user)


def test_undo_first_checkpoint(server: SyncServer, default_user):
    """
    If the block is at the first checkpoint (sequence_number=1),
    undo should fail because there's no prior checkpoint.
    """
    block_manager = BlockManager()

    # 1) Create the block
    block_data = PydanticBlock(label="first_checkpoint", value="Version1")
    block = block_manager.create_or_update_block(block_data, actor=default_user)

    # 2) First checkpoint => seq=1
    block_manager.checkpoint_block(block_id=block.id, actor=default_user)

    # Attempt undo -> expect ValueError
    with pytest.raises(ValueError, match="Cannot undo further"):
        block_manager.undo_checkpoint_block(block_id=block.id, actor=default_user)


def test_undo_multiple_checkpoints(server: SyncServer, default_user):
    """
    Tests multiple checkpoints in a row, then undo repeatedly
    from seq=3 -> seq=2 -> seq=1, verifying each revert.
    """
    block_manager = BlockManager()

    # Step 1: Create block
    block_data = PydanticBlock(label="multi_checkpoint", value="v1")
    block_v1 = block_manager.create_or_update_block(block_data, actor=default_user)
    # checkpoint => seq=1
    block_manager.checkpoint_block(block_id=block_v1.id, actor=default_user)

    # Step 2: Update to v2, checkpoint => seq=2
    block_data_v2 = PydanticBlock(**block_v1.model_dump())
    block_data_v2.value = "v2"
    block_manager.create_or_update_block(block_data_v2, actor=default_user)
    block_manager.checkpoint_block(block_id=block_v1.id, actor=default_user)

    # Step 3: Update to v3, checkpoint => seq=3
    block_data_v3 = PydanticBlock(**block_v1.model_dump())
    block_data_v3.value = "v3"
    block_manager.create_or_update_block(block_data_v3, actor=default_user)
    block_manager.checkpoint_block(block_id=block_v1.id, actor=default_user)

    # Now we have 3 seq: v1, v2, v3
    # Undo from seq=3 -> seq=2
    undone_block = block_manager.undo_checkpoint_block(block_v1.id, actor=default_user)
    assert undone_block.value == "v2"

    # Undo from seq=2 -> seq=1
    undone_block = block_manager.undo_checkpoint_block(block_v1.id, actor=default_user)
    assert undone_block.value == "v1"

    # Try once more -> fails because seq=1 is the earliest
    with pytest.raises(ValueError, match="Cannot undo further"):
        block_manager.undo_checkpoint_block(block_v1.id, actor=default_user)


def test_undo_concurrency_stale(server: SyncServer, default_user):
    """
    Demonstrate concurrency: both sessions start with the block at seq=2,
    one session undoes first -> block now seq=1, version increments,
    the other session tries to undo with stale data -> StaleDataError.
    """
    block_manager = BlockManager()

    # 1) create block
    block_data = PydanticBlock(label="concurrency_undo", value="v1")
    block_v1 = block_manager.create_or_update_block(block_data, actor=default_user)
    # checkpoint => seq=1
    block_manager.checkpoint_block(block_v1.id, actor=default_user)

    # 2) update to v2
    block_data_v2 = PydanticBlock(**block_v1.model_dump())
    block_data_v2.value = "v2"
    block_manager.create_or_update_block(block_data_v2, actor=default_user)
    # checkpoint => seq=2
    block_manager.checkpoint_block(block_v1.id, actor=default_user)

    # Now block is at seq=2

    # session1 preloads the block
    with db_registry.session() as s1:
        block_s1 = s1.get(Block, block_v1.id)  # version=? let's say 2 in memory

    # session2 also preloads the block
    with db_registry.session() as s2:
        block_s2 = s2.get(Block, block_v1.id)  # also version=2

    # Session1 -> undo to seq=1
    block_manager.undo_checkpoint_block(
        block_id=block_v1.id, actor=default_user, use_preloaded_block=block_s1  # stale object from session1
    )
    # This commits first => block now points to seq=1, version increments

    # Session2 tries the same undo, but it's stale
    with pytest.raises(StaleDataError):
        block_manager.undo_checkpoint_block(block_id=block_v1.id, actor=default_user, use_preloaded_block=block_s2)  # also seq=2 in memory


# ======================================================================================================================
# Block Manager Tests - Redo
# ======================================================================================================================


def test_redo_checkpoint_block(server: SyncServer, default_user):
    """
    1) Create a block with value v1 -> checkpoint => seq=1
    2) Update to v2 -> checkpoint => seq=2
    3) Update to v3 -> checkpoint => seq=3
    4) Undo once (seq=3 -> seq=2)
    5) Redo once (seq=2 -> seq=3)
    """

    block_manager = BlockManager()

    # 1) Create block, set value='v1'; checkpoint => seq=1
    block_v1 = block_manager.create_or_update_block(PydanticBlock(label="redo_test", value="v1"), actor=default_user)
    block_manager.checkpoint_block(block_id=block_v1.id, actor=default_user)

    # 2) Update to 'v2'; checkpoint => seq=2
    block_v2 = PydanticBlock(**block_v1.model_dump())
    block_v2.value = "v2"
    block_manager.create_or_update_block(block_v2, actor=default_user)
    block_manager.checkpoint_block(block_id=block_v1.id, actor=default_user)

    # 3) Update to 'v3'; checkpoint => seq=3
    block_v3 = PydanticBlock(**block_v1.model_dump())
    block_v3.value = "v3"
    block_manager.create_or_update_block(block_v3, actor=default_user)
    block_manager.checkpoint_block(block_id=block_v1.id, actor=default_user)

    # Undo from seq=3 -> seq=2
    undone_block = block_manager.undo_checkpoint_block(block_v1.id, actor=default_user)
    assert undone_block.value == "v2", "After undo, block should revert to v2"

    # Redo from seq=2 -> seq=3
    redone_block = block_manager.redo_checkpoint_block(block_v1.id, actor=default_user)
    assert redone_block.value == "v3", "After redo, block should go back to v3"


def test_redo_no_history(server: SyncServer, default_user):
    """
    If a block has no current_history_entry_id (never checkpointed),
    then redo_checkpoint_block should raise ValueError.
    """
    block_manager = BlockManager()

    # Create block with no checkpoint
    block = block_manager.create_or_update_block(PydanticBlock(label="redo_no_history", value="v0"), actor=default_user)

    # Attempt to redo => expect ValueError
    with pytest.raises(ValueError, match="no history entry - cannot redo"):
        block_manager.redo_checkpoint_block(block.id, actor=default_user)


def test_redo_at_highest_checkpoint(server: SyncServer, default_user):
    """
    If the block is at the maximum sequence number, there's no higher checkpoint to move to.
    redo_checkpoint_block should raise ValueError.
    """
    block_manager = BlockManager()

    # 1) Create block => checkpoint => seq=1
    b_init = block_manager.create_or_update_block(PydanticBlock(label="redo_highest", value="v1"), actor=default_user)
    block_manager.checkpoint_block(b_init.id, actor=default_user)

    # 2) Another edit => seq=2
    b_next = PydanticBlock(**b_init.model_dump())
    b_next.value = "v2"
    block_manager.create_or_update_block(b_next, actor=default_user)
    block_manager.checkpoint_block(b_init.id, actor=default_user)

    # We are at seq=2, which is the highest checkpoint.
    # Attempt redo => there's no seq=3
    with pytest.raises(ValueError, match="Cannot redo further"):
        block_manager.redo_checkpoint_block(b_init.id, actor=default_user)


def test_redo_after_multiple_undo(server: SyncServer, default_user):
    """
    1) Create and checkpoint versions: v1 -> seq=1, v2 -> seq=2, v3 -> seq=3, v4 -> seq=4
    2) Undo thrice => from seq=4 to seq=1
    3) Redo thrice => from seq=1 back to seq=4
    """
    block_manager = BlockManager()

    # Step 1: create initial block => seq=1
    b_init = block_manager.create_or_update_block(PydanticBlock(label="redo_multi", value="v1"), actor=default_user)
    block_manager.checkpoint_block(b_init.id, actor=default_user)

    # seq=2
    b_v2 = PydanticBlock(**b_init.model_dump())
    b_v2.value = "v2"
    block_manager.create_or_update_block(b_v2, actor=default_user)
    block_manager.checkpoint_block(b_init.id, actor=default_user)

    # seq=3
    b_v3 = PydanticBlock(**b_init.model_dump())
    b_v3.value = "v3"
    block_manager.create_or_update_block(b_v3, actor=default_user)
    block_manager.checkpoint_block(b_init.id, actor=default_user)

    # seq=4
    b_v4 = PydanticBlock(**b_init.model_dump())
    b_v4.value = "v4"
    block_manager.create_or_update_block(b_v4, actor=default_user)
    block_manager.checkpoint_block(b_init.id, actor=default_user)

    # We have 4 checkpoints: v1...v4. Current is seq=4.

    # 2) Undo thrice => from seq=4 -> seq=1
    for expected_value in ["v3", "v2", "v1"]:
        undone_block = block_manager.undo_checkpoint_block(b_init.id, actor=default_user)
        assert undone_block.value == expected_value, f"Undo should get us back to {expected_value}"

    # 3) Redo thrice => from seq=1 -> seq=4
    for expected_value in ["v2", "v3", "v4"]:
        redone_block = block_manager.redo_checkpoint_block(b_init.id, actor=default_user)
        assert redone_block.value == expected_value, f"Redo should get us forward to {expected_value}"


def test_redo_concurrency_stale(server: SyncServer, default_user):
    block_manager = BlockManager()

    # 1) Create block => checkpoint => seq=1
    block = block_manager.create_or_update_block(PydanticBlock(label="redo_concurrency", value="v1"), actor=default_user)
    block_manager.checkpoint_block(block.id, actor=default_user)

    # 2) Another edit => checkpoint => seq=2
    block_v2 = PydanticBlock(**block.model_dump())
    block_v2.value = "v2"
    block_manager.create_or_update_block(block_v2, actor=default_user)
    block_manager.checkpoint_block(block.id, actor=default_user)

    # 3) Another edit => checkpoint => seq=3
    block_v3 = PydanticBlock(**block.model_dump())
    block_v3.value = "v3"
    block_manager.create_or_update_block(block_v3, actor=default_user)
    block_manager.checkpoint_block(block.id, actor=default_user)
    # Now the block is at seq=3 in the DB

    # 4) Undo from seq=3 -> seq=2 so that we have a known future state at seq=3
    undone_block = block_manager.undo_checkpoint_block(block.id, actor=default_user)
    assert undone_block.value == "v2"

    # At this point the block is physically at seq=2 in DB,
    # but there's a valid row for seq=3 in block_history (the 'v3' state).

    # 5) Simulate concurrency: two sessions each read the block at seq=2
    with db_registry.session() as s1:
        block_s1 = s1.get(Block, block.id)
    with db_registry.session() as s2:
        block_s2 = s2.get(Block, block.id)

    # 6) Session1 redoes to seq=3 first -> success
    block_manager.redo_checkpoint_block(block_id=block.id, actor=default_user, use_preloaded_block=block_s1)
    # commits => block is now seq=3 in DB, version increments

    # 7) Session2 tries to do the same from stale version
    # => we expect StaleDataError, because the second session is using
    #    an out-of-date version of the block
    with pytest.raises(StaleDataError):
        block_manager.redo_checkpoint_block(block_id=block.id, actor=default_user, use_preloaded_block=block_s2)


# ======================================================================================================================
# Identity Manager Tests
# ======================================================================================================================


@pytest.mark.asyncio
async def test_create_and_upsert_identity(server: SyncServer, default_user, event_loop):
    identity_create = IdentityCreate(
        identifier_key="1234",
        name="caren",
        identity_type=IdentityType.user,
        properties=[
            IdentityProperty(key="email", value="caren@letta.com", type=IdentityPropertyType.string),
            IdentityProperty(key="age", value=28, type=IdentityPropertyType.number),
        ],
    )

    identity = await server.identity_manager.create_identity_async(identity_create, actor=default_user)

    # Assertions to ensure the created identity matches the expected values
    assert identity.identifier_key == identity_create.identifier_key
    assert identity.name == identity_create.name
    assert identity.identity_type == identity_create.identity_type
    assert identity.properties == identity_create.properties
    assert identity.agent_ids == []
    assert identity.project_id is None

    with pytest.raises(UniqueConstraintViolationError):
        await server.identity_manager.create_identity_async(
            IdentityCreate(identifier_key="1234", name="sarah", identity_type=IdentityType.user),
            actor=default_user,
        )

    identity_create.properties = [IdentityProperty(key="age", value=29, type=IdentityPropertyType.number)]

    identity = await server.identity_manager.upsert_identity_async(
        identity=IdentityUpsert(**identity_create.model_dump()), actor=default_user
    )

    identity = await server.identity_manager.get_identity_async(identity_id=identity.id, actor=default_user)
    assert len(identity.properties) == 1
    assert identity.properties[0].key == "age"
    assert identity.properties[0].value == 29

    await server.identity_manager.delete_identity_async(identity_id=identity.id, actor=default_user)


@pytest.mark.asyncio
async def test_get_identities(server, default_user):
    # Create identities to retrieve later
    user = await server.identity_manager.create_identity_async(
        IdentityCreate(name="caren", identifier_key="1234", identity_type=IdentityType.user), actor=default_user
    )
    org = await server.identity_manager.create_identity_async(
        IdentityCreate(name="letta", identifier_key="0001", identity_type=IdentityType.org), actor=default_user
    )

    # Retrieve identities by different filters
    all_identities = await server.identity_manager.list_identities_async(actor=default_user)
    assert len(all_identities) == 2

    user_identities = await server.identity_manager.list_identities_async(actor=default_user, identity_type=IdentityType.user)
    assert len(user_identities) == 1
    assert user_identities[0].name == user.name

    org_identities = await server.identity_manager.list_identities_async(actor=default_user, identity_type=IdentityType.org)
    assert len(org_identities) == 1
    assert org_identities[0].name == org.name

    await server.identity_manager.delete_identity_async(identity_id=user.id, actor=default_user)
    await server.identity_manager.delete_identity_async(identity_id=org.id, actor=default_user)


@pytest.mark.asyncio
async def test_update_identity(server: SyncServer, sarah_agent, charles_agent, default_user, event_loop):
    identity = await server.identity_manager.create_identity_async(
        IdentityCreate(name="caren", identifier_key="1234", identity_type=IdentityType.user), actor=default_user
    )

    # Update identity fields
    update_data = IdentityUpdate(
        agent_ids=[sarah_agent.id, charles_agent.id],
        properties=[IdentityProperty(key="email", value="caren@letta.com", type=IdentityPropertyType.string)],
    )
    await server.identity_manager.update_identity_async(identity_id=identity.id, identity=update_data, actor=default_user)

    # Retrieve the updated identity
    updated_identity = await server.identity_manager.get_identity_async(identity_id=identity.id, actor=default_user)

    # Assertions to verify the update
    assert updated_identity.agent_ids.sort() == update_data.agent_ids.sort()
    assert updated_identity.properties == update_data.properties

    agent_state = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    assert identity.id in agent_state.identity_ids
    agent_state = await server.agent_manager.get_agent_by_id_async(agent_id=charles_agent.id, actor=default_user)
    assert identity.id in agent_state.identity_ids

    await server.identity_manager.delete_identity_async(identity_id=identity.id, actor=default_user)


@pytest.mark.asyncio
async def test_attach_detach_identity_from_agent(server: SyncServer, sarah_agent, default_user, event_loop):
    # Create an identity
    identity = await server.identity_manager.create_identity_async(
        IdentityCreate(name="caren", identifier_key="1234", identity_type=IdentityType.user), actor=default_user
    )
    agent_state = await server.agent_manager.update_agent_async(
        agent_id=sarah_agent.id, agent_update=UpdateAgent(identity_ids=[identity.id]), actor=default_user
    )

    # Check that identity has been attached
    assert identity.id in agent_state.identity_ids

    # Now attempt to delete the identity
    await server.identity_manager.delete_identity_async(identity_id=identity.id, actor=default_user)

    # Verify that the identity was deleted
    identities = await server.identity_manager.list_identities_async(actor=default_user)
    assert len(identities) == 0

    # Check that block has been detached too
    agent_state = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    assert not identity.id in agent_state.identity_ids


@pytest.mark.asyncio
async def test_get_set_agents_for_identities(server: SyncServer, sarah_agent, charles_agent, default_user, event_loop):
    identity = await server.identity_manager.create_identity_async(
        IdentityCreate(name="caren", identifier_key="1234", identity_type=IdentityType.user, agent_ids=[sarah_agent.id, charles_agent.id]),
        actor=default_user,
    )

    agent_with_identity = await server.create_agent_async(
        CreateAgent(
            memory_blocks=[],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            identity_ids=[identity.id],
            include_base_tools=False,
        ),
        actor=default_user,
    )
    agent_without_identity = server.create_agent(
        CreateAgent(
            memory_blocks=[],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            include_base_tools=False,
        ),
        actor=default_user,
    )

    # Get the agents for identity id
    agent_states = await server.agent_manager.list_agents_async(identity_id=identity.id, actor=default_user)
    assert len(agent_states) == 3

    # Check all agents are in the list
    agent_state_ids = [a.id for a in agent_states]
    assert sarah_agent.id in agent_state_ids
    assert charles_agent.id in agent_state_ids
    assert agent_with_identity.id in agent_state_ids
    assert not agent_without_identity.id in agent_state_ids

    # Get the agents for identifier key
    agent_states = await server.agent_manager.list_agents_async(identifier_keys=[identity.identifier_key], actor=default_user)
    assert len(agent_states) == 3

    # Check all agents are in the list
    agent_state_ids = [a.id for a in agent_states]
    assert sarah_agent.id in agent_state_ids
    assert charles_agent.id in agent_state_ids
    assert agent_with_identity.id in agent_state_ids
    assert not agent_without_identity.id in agent_state_ids

    # Delete new agents
    server.agent_manager.delete_agent(agent_id=agent_with_identity.id, actor=default_user)
    server.agent_manager.delete_agent(agent_id=agent_without_identity.id, actor=default_user)

    # Get the agents for identity id
    agent_states = server.agent_manager.list_agents(identity_id=identity.id, actor=default_user)
    assert len(agent_states) == 2

    # Check only initial agents are in the list
    agent_state_ids = [a.id for a in agent_states]
    assert sarah_agent.id in agent_state_ids
    assert charles_agent.id in agent_state_ids

    await server.identity_manager.delete_identity_async(identity_id=identity.id, actor=default_user)


@pytest.mark.asyncio
async def test_attach_detach_identity_from_block(server: SyncServer, default_block, default_user, event_loop):
    # Create an identity
    identity = await server.identity_manager.create_identity_async(
        IdentityCreate(name="caren", identifier_key="1234", identity_type=IdentityType.user, block_ids=[default_block.id]),
        actor=default_user,
    )

    # Check that identity has been attached
    blocks = await server.block_manager.get_blocks_async(identity_id=identity.id, actor=default_user)
    assert len(blocks) == 1 and blocks[0].id == default_block.id

    # Now attempt to delete the identity
    await server.identity_manager.delete_identity_async(identity_id=identity.id, actor=default_user)

    # Verify that the identity was deleted
    identities = await server.identity_manager.list_identities_async(actor=default_user)
    assert len(identities) == 0

    # Check that block has been detached too
    blocks = await server.block_manager.get_blocks_async(identity_id=identity.id, actor=default_user)
    assert len(blocks) == 0


@pytest.mark.asyncio
async def test_get_set_blocks_for_identities(server: SyncServer, default_block, default_user, event_loop):
    block_manager = BlockManager()
    block_with_identity = block_manager.create_or_update_block(PydanticBlock(label="persona", value="Original Content"), actor=default_user)
    block_without_identity = block_manager.create_or_update_block(PydanticBlock(label="user", value="Original Content"), actor=default_user)
    identity = await server.identity_manager.create_identity_async(
        IdentityCreate(
            name="caren", identifier_key="1234", identity_type=IdentityType.user, block_ids=[default_block.id, block_with_identity.id]
        ),
        actor=default_user,
    )

    # Get the blocks for identity id
    blocks = await server.block_manager.get_blocks_async(identity_id=identity.id, actor=default_user)
    assert len(blocks) == 2

    # Check blocks are in the list
    block_ids = [b.id for b in blocks]
    assert default_block.id in block_ids
    assert block_with_identity.id in block_ids
    assert not block_without_identity.id in block_ids

    # Get the blocks for identifier key
    blocks = await server.block_manager.get_blocks_async(identifier_keys=[identity.identifier_key], actor=default_user)
    assert len(blocks) == 2

    # Check blocks are in the list
    block_ids = [b.id for b in blocks]
    assert default_block.id in block_ids
    assert block_with_identity.id in block_ids
    assert not block_without_identity.id in block_ids

    # Delete new agents
    server.block_manager.delete_block(block_id=block_with_identity.id, actor=default_user)
    server.block_manager.delete_block(block_id=block_without_identity.id, actor=default_user)

    # Get the blocks for identity id
    blocks = await server.block_manager.get_blocks_async(identity_id=identity.id, actor=default_user)
    assert len(blocks) == 1

    # Check only initial block in the list
    block_ids = [b.id for b in blocks]
    assert default_block.id in block_ids
    assert not block_with_identity.id in block_ids
    assert not block_without_identity.id in block_ids

    await server.identity_manager.delete_identity_async(identity_id=identity.id, actor=default_user)


@pytest.mark.asyncio
async def test_upsert_properties(server: SyncServer, default_user, event_loop):
    identity_create = IdentityCreate(
        identifier_key="1234",
        name="caren",
        identity_type=IdentityType.user,
        properties=[
            IdentityProperty(key="email", value="caren@letta.com", type=IdentityPropertyType.string),
            IdentityProperty(key="age", value=28, type=IdentityPropertyType.number),
        ],
    )

    identity = await server.identity_manager.create_identity_async(identity_create, actor=default_user)
    properties = [
        IdentityProperty(key="email", value="caren@gmail.com", type=IdentityPropertyType.string),
        IdentityProperty(key="age", value="28", type=IdentityPropertyType.string),
        IdentityProperty(key="test", value=123, type=IdentityPropertyType.number),
    ]

    updated_identity = await server.identity_manager.upsert_identity_properties_async(
        identity_id=identity.id,
        properties=properties,
        actor=default_user,
    )
    assert updated_identity.properties == properties

    await server.identity_manager.delete_identity_async(identity_id=identity.id, actor=default_user)


# ======================================================================================================================
# SourceManager Tests - Sources
# ======================================================================================================================


@pytest.mark.asyncio
async def test_create_source(server: SyncServer, default_user, event_loop):
    """Test creating a new source."""
    source_pydantic = PydanticSource(
        name="Test Source",
        description="This is a test source.",
        metadata={"type": "test"},
        embedding_config=DEFAULT_EMBEDDING_CONFIG,
    )
    source = await server.source_manager.create_source(source=source_pydantic, actor=default_user)

    # Assertions to check the created source
    assert source.name == source_pydantic.name
    assert source.description == source_pydantic.description
    assert source.metadata == source_pydantic.metadata
    assert source.organization_id == default_user.organization_id


@pytest.mark.asyncio
async def test_create_sources_with_same_name_raises_error(server: SyncServer, default_user):
    """Test that creating sources with the same name raises an IntegrityError due to unique constraint."""
    name = "Test Source"
    source_pydantic = PydanticSource(
        name=name,
        description="This is a test source.",
        metadata={"type": "medical"},
        embedding_config=DEFAULT_EMBEDDING_CONFIG,
    )
    source = await server.source_manager.create_source(source=source_pydantic, actor=default_user)

    # Attempting to create another source with the same name should raise an IntegrityError
    source_pydantic = PydanticSource(
        name=name,
        description="This is a different test source.",
        metadata={"type": "legal"},
        embedding_config=DEFAULT_EMBEDDING_CONFIG,
    )
    with pytest.raises(UniqueConstraintViolationError):
        await server.source_manager.create_source(source=source_pydantic, actor=default_user)


@pytest.mark.asyncio
async def test_update_source(server: SyncServer, default_user):
    """Test updating an existing source."""
    source_pydantic = PydanticSource(name="Original Source", description="Original description", embedding_config=DEFAULT_EMBEDDING_CONFIG)
    source = await server.source_manager.create_source(source=source_pydantic, actor=default_user)

    # Update the source
    update_data = SourceUpdate(name="Updated Source", description="Updated description", metadata={"type": "updated"})
    updated_source = await server.source_manager.update_source(source_id=source.id, source_update=update_data, actor=default_user)

    # Assertions to verify update
    assert updated_source.name == update_data.name
    assert updated_source.description == update_data.description
    assert updated_source.metadata == update_data.metadata


@pytest.mark.asyncio
async def test_delete_source(server: SyncServer, default_user):
    """Test deleting a source."""
    source_pydantic = PydanticSource(
        name="To Delete", description="This source will be deleted.", embedding_config=DEFAULT_EMBEDDING_CONFIG
    )
    source = await server.source_manager.create_source(source=source_pydantic, actor=default_user)

    # Delete the source
    deleted_source = await server.source_manager.delete_source(source_id=source.id, actor=default_user)

    # Assertions to verify deletion
    assert deleted_source.id == source.id

    # Verify that the source no longer appears in list_sources
    sources = await server.source_manager.list_sources(actor=default_user)
    assert len(sources) == 0


@pytest.mark.asyncio
async def test_delete_attached_source(server: SyncServer, sarah_agent, default_user, event_loop):
    """Test deleting a source."""
    source_pydantic = PydanticSource(
        name="To Delete", description="This source will be deleted.", embedding_config=DEFAULT_EMBEDDING_CONFIG
    )
    source = await server.source_manager.create_source(source=source_pydantic, actor=default_user)

    await server.agent_manager.attach_source_async(agent_id=sarah_agent.id, source_id=source.id, actor=default_user)

    # Delete the source
    deleted_source = await server.source_manager.delete_source(source_id=source.id, actor=default_user)

    # Assertions to verify deletion
    assert deleted_source.id == source.id

    # Verify that the source no longer appears in list_sources
    sources = await server.source_manager.list_sources(actor=default_user)
    assert len(sources) == 0

    # Verify that agent is not deleted
    agent = await server.agent_manager.get_agent_by_id_async(sarah_agent.id, actor=default_user)
    assert agent is not None


@pytest.mark.asyncio
async def test_list_sources(server: SyncServer, default_user):
    """Test listing sources with pagination."""
    # Create multiple sources
    await server.source_manager.create_source(
        PydanticSource(name="Source 1", embedding_config=DEFAULT_EMBEDDING_CONFIG), actor=default_user
    )
    if USING_SQLITE:
        time.sleep(CREATE_DELAY_SQLITE)
    await server.source_manager.create_source(
        PydanticSource(name="Source 2", embedding_config=DEFAULT_EMBEDDING_CONFIG), actor=default_user
    )

    # List sources without pagination
    sources = await server.source_manager.list_sources(actor=default_user)
    assert len(sources) == 2

    # List sources with pagination
    paginated_sources = await server.source_manager.list_sources(actor=default_user, limit=1)
    assert len(paginated_sources) == 1

    # Ensure cursor-based pagination works
    next_page = await server.source_manager.list_sources(actor=default_user, after=paginated_sources[-1].id, limit=1)
    assert len(next_page) == 1
    assert next_page[0].name != paginated_sources[0].name


@pytest.mark.asyncio
async def test_get_source_by_id(server: SyncServer, default_user):
    """Test retrieving a source by ID."""
    source_pydantic = PydanticSource(
        name="Retrieve by ID", description="Test source for ID retrieval", embedding_config=DEFAULT_EMBEDDING_CONFIG
    )
    source = await server.source_manager.create_source(source=source_pydantic, actor=default_user)

    # Retrieve the source by ID
    retrieved_source = await server.source_manager.get_source_by_id(source_id=source.id, actor=default_user)

    # Assertions to verify the retrieved source matches the created one
    assert retrieved_source.id == source.id
    assert retrieved_source.name == source.name
    assert retrieved_source.description == source.description


@pytest.mark.asyncio
async def test_get_source_by_name(server: SyncServer, default_user):
    """Test retrieving a source by name."""
    source_pydantic = PydanticSource(
        name="Unique Source", description="Test source for name retrieval", embedding_config=DEFAULT_EMBEDDING_CONFIG
    )
    source = await server.source_manager.create_source(source=source_pydantic, actor=default_user)

    # Retrieve the source by name
    retrieved_source = await server.source_manager.get_source_by_name(source_name=source.name, actor=default_user)

    # Assertions to verify the retrieved source matches the created one
    assert retrieved_source.name == source.name
    assert retrieved_source.description == source.description


@pytest.mark.asyncio
async def test_update_source_no_changes(server: SyncServer, default_user):
    """Test update_source with no actual changes to verify logging and response."""
    source_pydantic = PydanticSource(name="No Change Source", description="No changes", embedding_config=DEFAULT_EMBEDDING_CONFIG)
    source = await server.source_manager.create_source(source=source_pydantic, actor=default_user)

    # Attempt to update the source with identical data
    update_data = SourceUpdate(name="No Change Source", description="No changes")
    updated_source = await server.source_manager.update_source(source_id=source.id, source_update=update_data, actor=default_user)

    # Assertions to ensure the update returned the source but made no modifications
    assert updated_source.id == source.id
    assert updated_source.name == source.name
    assert updated_source.description == source.description


@pytest.mark.asyncio
async def test_bulk_upsert_sources_async(server: SyncServer, default_user):
    """Test bulk upserting sources."""
    sources_data = [
        PydanticSource(
            name="Bulk Source 1",
            description="First bulk source",
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        PydanticSource(
            name="Bulk Source 2",
            description="Second bulk source",
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        PydanticSource(
            name="Bulk Source 3",
            description="Third bulk source",
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
    ]

    # Bulk upsert sources
    created_sources = await server.source_manager.bulk_upsert_sources_async(sources_data, default_user)

    # Verify all sources were created
    assert len(created_sources) == 3

    # Verify source details
    created_names = {source.name for source in created_sources}
    expected_names = {"Bulk Source 1", "Bulk Source 2", "Bulk Source 3"}
    assert created_names == expected_names

    # Verify organization assignment
    for source in created_sources:
        assert source.organization_id == default_user.organization_id


@pytest.mark.asyncio
async def test_bulk_upsert_sources_name_conflict(server: SyncServer, default_user):
    """Test bulk upserting sources with name conflicts."""
    # Create an existing source
    existing_source = await server.source_manager.create_source(
        PydanticSource(
            name="Existing Source",
            description="Already exists",
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        default_user,
    )

    # Try to bulk upsert with the same name
    sources_data = [
        PydanticSource(
            name="Existing Source",  # Same name as existing
            description="Updated description",
            metadata={"updated": True},
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        PydanticSource(
            name="New Bulk Source",
            description="Completely new",
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
    ]

    # Bulk upsert should update existing and create new
    result_sources = await server.source_manager.bulk_upsert_sources_async(sources_data, default_user)

    # Should return 2 sources
    assert len(result_sources) == 2

    # Find the updated source
    updated_source = next(s for s in result_sources if s.name == "Existing Source")

    # Verify the existing source was updated, not replaced
    assert updated_source.id == existing_source.id  # ID should be preserved
    assert updated_source.description == "Updated description"
    assert updated_source.metadata == {"updated": True}

    # Verify new source was created
    new_source = next(s for s in result_sources if s.name == "New Bulk Source")
    assert new_source.description == "Completely new"


@pytest.mark.asyncio
async def test_bulk_upsert_sources_mixed_create_update(server: SyncServer, default_user):
    """Test bulk upserting with a mix of creates and updates."""
    # Create some existing sources
    existing1 = await server.source_manager.create_source(
        PydanticSource(
            name="Mixed Source 1",
            description="Original 1",
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        default_user,
    )
    existing2 = await server.source_manager.create_source(
        PydanticSource(
            name="Mixed Source 2",
            description="Original 2",
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        default_user,
    )

    # Bulk upsert with updates and new sources
    sources_data = [
        PydanticSource(
            name="Mixed Source 1",  # Update existing
            description="Updated 1",
            instructions="New instructions 1",
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        PydanticSource(
            name="Mixed Source 3",  # Create new
            description="New 3",
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        PydanticSource(
            name="Mixed Source 2",  # Update existing
            description="Updated 2",
            metadata={"version": 2},
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        PydanticSource(
            name="Mixed Source 4",  # Create new
            description="New 4",
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
    ]

    # Perform bulk upsert
    result_sources = await server.source_manager.bulk_upsert_sources_async(sources_data, default_user)

    # Should return 4 sources
    assert len(result_sources) == 4

    # Verify updates preserved IDs
    source1 = next(s for s in result_sources if s.name == "Mixed Source 1")
    assert source1.id == existing1.id
    assert source1.description == "Updated 1"
    assert source1.instructions == "New instructions 1"

    source2 = next(s for s in result_sources if s.name == "Mixed Source 2")
    assert source2.id == existing2.id
    assert source2.description == "Updated 2"
    assert source2.metadata == {"version": 2}

    # Verify new sources were created
    source3 = next(s for s in result_sources if s.name == "Mixed Source 3")
    assert source3.description == "New 3"
    assert source3.id != existing1.id and source3.id != existing2.id

    source4 = next(s for s in result_sources if s.name == "Mixed Source 4")
    assert source4.description == "New 4"
    assert source4.id != existing1.id and source4.id != existing2.id


# ======================================================================================================================
# Source Manager Tests - Files
# ======================================================================================================================


@pytest.mark.asyncio
async def test_get_file_by_id(server: SyncServer, default_user, default_source):
    """Test retrieving a file by ID."""
    file_metadata = PydanticFileMetadata(
        file_name="Retrieve File",
        file_path="/path/to/retrieve_file.txt",
        file_type="text/plain",
        file_size=2048,
        source_id=default_source.id,
    )
    created_file = await server.file_manager.create_file(file_metadata=file_metadata, actor=default_user)

    # Retrieve the file by ID
    retrieved_file = await server.file_manager.get_file_by_id(file_id=created_file.id, actor=default_user)

    # Assertions to verify the retrieved file matches the created one
    assert retrieved_file.id == created_file.id
    assert retrieved_file.file_name == created_file.file_name
    assert retrieved_file.file_path == created_file.file_path
    assert retrieved_file.file_type == created_file.file_type


@pytest.mark.asyncio
async def test_create_and_retrieve_file_with_content(server, default_user, default_source, async_session):
    text_body = "Line 1\nLine 2\nLine 3"

    meta = PydanticFileMetadata(
        file_name="with_body.txt",
        file_path="/tmp/with_body.txt",
        file_type="text/plain",
        file_size=len(text_body),
        source_id=default_source.id,
    )

    created = await server.file_manager.create_file(
        file_metadata=meta,
        actor=default_user,
        text=text_body,
    )

    # -- metadata-only return: content is NOT present
    assert created.content is None

    # body row exists
    assert await _count_file_content_rows(async_session, created.id) == 1

    # -- now fetch WITH the body
    loaded = await server.file_manager.get_file_by_id(created.id, actor=default_user, include_content=True)
    assert loaded.content == text_body


@pytest.mark.asyncio
async def test_create_file_without_content(server, default_user, default_source, async_session):
    meta = PydanticFileMetadata(
        file_name="no_body.txt",
        file_path="/tmp/no_body.txt",
        file_type="text/plain",
        file_size=123,
        source_id=default_source.id,
    )
    created = await server.file_manager.create_file(file_metadata=meta, actor=default_user)

    # no content row
    assert await _count_file_content_rows(async_session, created.id) == 0

    # include_content=True still works, returns None
    loaded = await server.file_manager.get_file_by_id(created.id, actor=default_user, include_content=True)
    assert loaded.content is None


@pytest.mark.asyncio
async def test_lazy_raise_guard(server, default_user, default_source, async_session):
    text_body = "lazy-raise"

    meta = PydanticFileMetadata(
        file_name="lazy_raise.txt",
        file_path="/tmp/lazy_raise.txt",
        file_type="text/plain",
        file_size=len(text_body),
        source_id=default_source.id,
    )
    created = await server.file_manager.create_file(file_metadata=meta, actor=default_user, text=text_body)

    # Grab ORM instance WITHOUT selectinload(FileMetadata.content)
    orm = await async_session.get(FileMetadataModel, created.id)

    # to_pydantic(include_content=True) should raise – guard works
    with pytest.raises(InvalidRequestError):
        await orm.to_pydantic_async(include_content=True)


@pytest.mark.asyncio
async def test_list_files_content_none(server, default_user, default_source):
    files = await server.file_manager.list_files(source_id=default_source.id, actor=default_user)
    assert all(f.content is None for f in files)


@pytest.mark.asyncio
async def test_delete_cascades_to_content(server, default_user, default_source, async_session):
    text_body = "to be deleted"
    meta = PydanticFileMetadata(
        file_name="delete_me.txt",
        file_path="/tmp/delete_me.txt",
        file_type="text/plain",
        file_size=len(text_body),
        source_id=default_source.id,
    )
    created = await server.file_manager.create_file(file_metadata=meta, actor=default_user, text=text_body)

    # ensure row exists first
    assert await _count_file_content_rows(async_session, created.id) == 1

    # delete
    await server.file_manager.delete_file(created.id, actor=default_user)

    # content row gone
    assert await _count_file_content_rows(async_session, created.id) == 0


@pytest.mark.asyncio
async def test_get_file_by_original_name_and_source_found(server: SyncServer, default_user, default_source):
    """Test retrieving a file by original filename and source when it exists."""
    original_filename = "test_original_file.txt"
    file_metadata = PydanticFileMetadata(
        file_name="some_generated_name.txt",
        original_file_name=original_filename,
        file_path="/path/to/test_file.txt",
        file_type="text/plain",
        file_size=1024,
        source_id=default_source.id,
    )
    created_file = await server.file_manager.create_file(file_metadata=file_metadata, actor=default_user)

    # Retrieve the file by original name and source
    retrieved_file = await server.file_manager.get_file_by_original_name_and_source(
        original_filename=original_filename, source_id=default_source.id, actor=default_user
    )

    # Assertions to verify the retrieved file matches the created one
    assert retrieved_file is not None
    assert retrieved_file.id == created_file.id
    assert retrieved_file.original_file_name == original_filename
    assert retrieved_file.source_id == default_source.id


@pytest.mark.asyncio
async def test_get_file_by_original_name_and_source_not_found(server: SyncServer, default_user, default_source):
    """Test retrieving a file by original filename and source when it doesn't exist."""
    non_existent_filename = "does_not_exist.txt"

    # Try to retrieve a non-existent file
    retrieved_file = await server.file_manager.get_file_by_original_name_and_source(
        original_filename=non_existent_filename, source_id=default_source.id, actor=default_user
    )

    # Should return None for non-existent file
    assert retrieved_file is None


@pytest.mark.asyncio
async def test_get_file_by_original_name_and_source_different_sources(server: SyncServer, default_user, default_source):
    """Test that files with same original name in different sources are handled correctly."""
    from letta.schemas.source import Source as PydanticSource

    # Create a second source
    second_source_pydantic = PydanticSource(
        name="second_test_source",
        description="This is a test source.",
        metadata={"type": "test"},
        embedding_config=DEFAULT_EMBEDDING_CONFIG,
    )
    second_source = await server.source_manager.create_source(source=second_source_pydantic, actor=default_user)

    original_filename = "shared_filename.txt"

    # Create file in first source
    file_metadata_1 = PydanticFileMetadata(
        file_name="file_in_source_1.txt",
        original_file_name=original_filename,
        file_path="/path/to/file1.txt",
        file_type="text/plain",
        file_size=1024,
        source_id=default_source.id,
    )
    created_file_1 = await server.file_manager.create_file(file_metadata=file_metadata_1, actor=default_user)

    # Create file with same original name in second source
    file_metadata_2 = PydanticFileMetadata(
        file_name="file_in_source_2.txt",
        original_file_name=original_filename,
        file_path="/path/to/file2.txt",
        file_type="text/plain",
        file_size=2048,
        source_id=second_source.id,
    )
    created_file_2 = await server.file_manager.create_file(file_metadata=file_metadata_2, actor=default_user)

    # Retrieve file from first source
    retrieved_file_1 = await server.file_manager.get_file_by_original_name_and_source(
        original_filename=original_filename, source_id=default_source.id, actor=default_user
    )

    # Retrieve file from second source
    retrieved_file_2 = await server.file_manager.get_file_by_original_name_and_source(
        original_filename=original_filename, source_id=second_source.id, actor=default_user
    )

    # Should retrieve different files
    assert retrieved_file_1 is not None
    assert retrieved_file_2 is not None
    assert retrieved_file_1.id == created_file_1.id
    assert retrieved_file_2.id == created_file_2.id
    assert retrieved_file_1.id != retrieved_file_2.id
    assert retrieved_file_1.source_id == default_source.id
    assert retrieved_file_2.source_id == second_source.id


@pytest.mark.asyncio
async def test_get_file_by_original_name_and_source_ignores_deleted(server: SyncServer, default_user, default_source):
    """Test that deleted files are ignored when searching by original name and source."""
    original_filename = "to_be_deleted.txt"
    file_metadata = PydanticFileMetadata(
        file_name="deletable_file.txt",
        original_file_name=original_filename,
        file_path="/path/to/deletable.txt",
        file_type="text/plain",
        file_size=512,
        source_id=default_source.id,
    )
    created_file = await server.file_manager.create_file(file_metadata=file_metadata, actor=default_user)

    # Verify file can be found before deletion
    retrieved_file = await server.file_manager.get_file_by_original_name_and_source(
        original_filename=original_filename, source_id=default_source.id, actor=default_user
    )
    assert retrieved_file is not None
    assert retrieved_file.id == created_file.id

    # Delete the file
    await server.file_manager.delete_file(created_file.id, actor=default_user)

    # Try to retrieve the deleted file
    retrieved_file_after_delete = await server.file_manager.get_file_by_original_name_and_source(
        original_filename=original_filename, source_id=default_source.id, actor=default_user
    )

    # Should return None for deleted file
    assert retrieved_file_after_delete is None


@pytest.mark.asyncio
async def test_list_files(server: SyncServer, default_user, default_source):
    """Test listing files with pagination."""
    # Create multiple files
    await server.file_manager.create_file(
        PydanticFileMetadata(file_name="File 1", file_path="/path/to/file1.txt", file_type="text/plain", source_id=default_source.id),
        actor=default_user,
    )
    if USING_SQLITE:
        time.sleep(CREATE_DELAY_SQLITE)
    await server.file_manager.create_file(
        PydanticFileMetadata(file_name="File 2", file_path="/path/to/file2.txt", file_type="text/plain", source_id=default_source.id),
        actor=default_user,
    )

    # List files without pagination
    files = await server.file_manager.list_files(source_id=default_source.id, actor=default_user)
    assert len(files) == 2

    # List files with pagination
    paginated_files = await server.file_manager.list_files(source_id=default_source.id, actor=default_user, limit=1)
    assert len(paginated_files) == 1

    # Ensure cursor-based pagination works
    next_page = await server.file_manager.list_files(source_id=default_source.id, actor=default_user, after=paginated_files[-1].id, limit=1)
    assert len(next_page) == 1
    assert next_page[0].file_name != paginated_files[0].file_name


@pytest.mark.asyncio
async def test_delete_file(server: SyncServer, default_user, default_source):
    """Test deleting a file."""
    file_metadata = PydanticFileMetadata(
        file_name="Delete File", file_path="/path/to/delete_file.txt", file_type="text/plain", source_id=default_source.id
    )
    created_file = await server.file_manager.create_file(file_metadata=file_metadata, actor=default_user)

    # Delete the file
    deleted_file = await server.file_manager.delete_file(file_id=created_file.id, actor=default_user)

    # Assertions to verify deletion
    assert deleted_file.id == created_file.id

    # Verify that the file no longer appears in list_files
    files = await server.file_manager.list_files(source_id=default_source.id, actor=default_user)
    assert len(files) == 0


@pytest.mark.asyncio
async def test_update_file_status_basic(server, default_user, default_source):
    """Update processing status and error message for a file."""
    meta = PydanticFileMetadata(
        file_name="status_test.txt",
        file_path="/tmp/status_test.txt",
        file_type="text/plain",
        file_size=100,
        source_id=default_source.id,
    )
    created = await server.file_manager.create_file(file_metadata=meta, actor=default_user)

    # Update status only
    updated = await server.file_manager.update_file_status(
        file_id=created.id,
        actor=default_user,
        processing_status=FileProcessingStatus.PARSING,
    )
    assert updated.processing_status == FileProcessingStatus.PARSING
    assert updated.error_message is None

    # Update both status and error message
    updated = await server.file_manager.update_file_status(
        file_id=created.id,
        actor=default_user,
        processing_status=FileProcessingStatus.ERROR,
        error_message="Parse failed",
    )
    assert updated.processing_status == FileProcessingStatus.ERROR
    assert updated.error_message == "Parse failed"


@pytest.mark.asyncio
async def test_update_file_status_error_only(server, default_user, default_source):
    """Update just the error message, leave status unchanged."""
    meta = PydanticFileMetadata(
        file_name="error_only.txt",
        file_path="/tmp/error_only.txt",
        file_type="text/plain",
        file_size=123,
        source_id=default_source.id,
    )
    created = await server.file_manager.create_file(file_metadata=meta, actor=default_user)

    updated = await server.file_manager.update_file_status(
        file_id=created.id,
        actor=default_user,
        error_message="Timeout while embedding",
    )
    assert updated.error_message == "Timeout while embedding"
    assert updated.processing_status == FileProcessingStatus.PENDING  # default from creation


@pytest.mark.asyncio
async def test_update_file_status_with_chunks(server, default_user, default_source):
    """Update chunk progress fields along with status."""
    meta = PydanticFileMetadata(
        file_name="chunks_test.txt",
        file_path="/tmp/chunks_test.txt",
        file_type="text/plain",
        file_size=500,
        source_id=default_source.id,
    )
    created = await server.file_manager.create_file(file_metadata=meta, actor=default_user)

    # First transition: PENDING -> PARSING
    updated = await server.file_manager.update_file_status(
        file_id=created.id,
        actor=default_user,
        processing_status=FileProcessingStatus.PARSING,
    )
    assert updated.processing_status == FileProcessingStatus.PARSING

    # Next transition: PARSING -> EMBEDDING with chunk progress
    updated = await server.file_manager.update_file_status(
        file_id=created.id,
        actor=default_user,
        processing_status=FileProcessingStatus.EMBEDDING,
        total_chunks=100,
        chunks_embedded=50,
    )
    assert updated.processing_status == FileProcessingStatus.EMBEDDING
    assert updated.total_chunks == 100
    assert updated.chunks_embedded == 50

    # Update only chunk progress
    updated = await server.file_manager.update_file_status(
        file_id=created.id,
        actor=default_user,
        chunks_embedded=100,
    )
    assert updated.chunks_embedded == 100
    assert updated.total_chunks == 100  # unchanged
    assert updated.processing_status == FileProcessingStatus.EMBEDDING  # unchanged


@pytest.mark.asyncio
async def test_file_status_valid_transitions(server, default_user, default_source):
    """Test valid state transitions follow the expected flow."""
    meta = PydanticFileMetadata(
        file_name="valid_transitions.txt",
        file_path="/tmp/valid_transitions.txt",
        file_type="text/plain",
        file_size=100,
        source_id=default_source.id,
    )
    created = await server.file_manager.create_file(file_metadata=meta, actor=default_user)
    assert created.processing_status == FileProcessingStatus.PENDING

    # PENDING -> PARSING
    updated = await server.file_manager.update_file_status(
        file_id=created.id,
        actor=default_user,
        processing_status=FileProcessingStatus.PARSING,
    )
    assert updated.processing_status == FileProcessingStatus.PARSING

    # PARSING -> EMBEDDING
    updated = await server.file_manager.update_file_status(
        file_id=created.id,
        actor=default_user,
        processing_status=FileProcessingStatus.EMBEDDING,
    )
    assert updated.processing_status == FileProcessingStatus.EMBEDDING

    # EMBEDDING -> COMPLETED
    updated = await server.file_manager.update_file_status(
        file_id=created.id,
        actor=default_user,
        processing_status=FileProcessingStatus.COMPLETED,
    )
    assert updated.processing_status == FileProcessingStatus.COMPLETED


@pytest.mark.asyncio
async def test_file_status_invalid_transitions(server, default_user, default_source):
    """Test that invalid state transitions are blocked."""
    # Test PENDING -> COMPLETED (skipping PARSING and EMBEDDING)
    meta = PydanticFileMetadata(
        file_name="invalid_pending_to_completed.txt",
        file_path="/tmp/invalid1.txt",
        file_type="text/plain",
        file_size=100,
        source_id=default_source.id,
    )
    created = await server.file_manager.create_file(file_metadata=meta, actor=default_user)

    with pytest.raises(ValueError, match="Invalid state transition.*pending.*COMPLETED"):
        await server.file_manager.update_file_status(
            file_id=created.id,
            actor=default_user,
            processing_status=FileProcessingStatus.COMPLETED,
        )

    # Test PARSING -> COMPLETED (skipping EMBEDDING)
    meta2 = PydanticFileMetadata(
        file_name="invalid_parsing_to_completed.txt",
        file_path="/tmp/invalid2.txt",
        file_type="text/plain",
        file_size=100,
        source_id=default_source.id,
    )
    created2 = await server.file_manager.create_file(file_metadata=meta2, actor=default_user)
    await server.file_manager.update_file_status(
        file_id=created2.id,
        actor=default_user,
        processing_status=FileProcessingStatus.PARSING,
    )

    with pytest.raises(ValueError, match="Invalid state transition.*parsing.*COMPLETED"):
        await server.file_manager.update_file_status(
            file_id=created2.id,
            actor=default_user,
            processing_status=FileProcessingStatus.COMPLETED,
        )

    # Test PENDING -> EMBEDDING (skipping PARSING)
    meta3 = PydanticFileMetadata(
        file_name="invalid_pending_to_embedding.txt",
        file_path="/tmp/invalid3.txt",
        file_type="text/plain",
        file_size=100,
        source_id=default_source.id,
    )
    created3 = await server.file_manager.create_file(file_metadata=meta3, actor=default_user)

    with pytest.raises(ValueError, match="Invalid state transition.*pending.*EMBEDDING"):
        await server.file_manager.update_file_status(
            file_id=created3.id,
            actor=default_user,
            processing_status=FileProcessingStatus.EMBEDDING,
        )


@pytest.mark.asyncio
async def test_file_status_terminal_states(server, default_user, default_source):
    """Test that terminal states (COMPLETED and ERROR) cannot be updated."""
    # Test COMPLETED is terminal
    meta = PydanticFileMetadata(
        file_name="completed_terminal.txt",
        file_path="/tmp/completed_terminal.txt",
        file_type="text/plain",
        file_size=100,
        source_id=default_source.id,
    )
    created = await server.file_manager.create_file(file_metadata=meta, actor=default_user)

    # Move through valid transitions to COMPLETED
    await server.file_manager.update_file_status(file_id=created.id, actor=default_user, processing_status=FileProcessingStatus.PARSING)
    await server.file_manager.update_file_status(file_id=created.id, actor=default_user, processing_status=FileProcessingStatus.EMBEDDING)
    await server.file_manager.update_file_status(file_id=created.id, actor=default_user, processing_status=FileProcessingStatus.COMPLETED)

    # Cannot transition from COMPLETED to any state
    with pytest.raises(ValueError, match="Cannot update.*terminal state completed"):
        await server.file_manager.update_file_status(
            file_id=created.id,
            actor=default_user,
            processing_status=FileProcessingStatus.EMBEDDING,
        )

    with pytest.raises(ValueError, match="Cannot update.*terminal state completed"):
        await server.file_manager.update_file_status(
            file_id=created.id,
            actor=default_user,
            processing_status=FileProcessingStatus.ERROR,
            error_message="Should not work",
        )

    # Test ERROR is terminal
    meta2 = PydanticFileMetadata(
        file_name="error_terminal.txt",
        file_path="/tmp/error_terminal.txt",
        file_type="text/plain",
        file_size=100,
        source_id=default_source.id,
    )
    created2 = await server.file_manager.create_file(file_metadata=meta2, actor=default_user)

    await server.file_manager.update_file_status(
        file_id=created2.id,
        actor=default_user,
        processing_status=FileProcessingStatus.ERROR,
        error_message="Test error",
    )

    # Cannot transition from ERROR to any state
    with pytest.raises(ValueError, match="Cannot update.*terminal state error"):
        await server.file_manager.update_file_status(
            file_id=created2.id,
            actor=default_user,
            processing_status=FileProcessingStatus.PARSING,
        )


@pytest.mark.asyncio
async def test_file_status_error_transitions(server, default_user, default_source):
    """Test that any non-terminal state can transition to ERROR."""
    # PENDING -> ERROR
    meta1 = PydanticFileMetadata(
        file_name="pending_to_error.txt",
        file_path="/tmp/pending_error.txt",
        file_type="text/plain",
        file_size=100,
        source_id=default_source.id,
    )
    created1 = await server.file_manager.create_file(file_metadata=meta1, actor=default_user)

    updated1 = await server.file_manager.update_file_status(
        file_id=created1.id,
        actor=default_user,
        processing_status=FileProcessingStatus.ERROR,
        error_message="Failed at PENDING",
    )
    assert updated1.processing_status == FileProcessingStatus.ERROR
    assert updated1.error_message == "Failed at PENDING"

    # PARSING -> ERROR
    meta2 = PydanticFileMetadata(
        file_name="parsing_to_error.txt",
        file_path="/tmp/parsing_error.txt",
        file_type="text/plain",
        file_size=100,
        source_id=default_source.id,
    )
    created2 = await server.file_manager.create_file(file_metadata=meta2, actor=default_user)
    await server.file_manager.update_file_status(
        file_id=created2.id,
        actor=default_user,
        processing_status=FileProcessingStatus.PARSING,
    )

    updated2 = await server.file_manager.update_file_status(
        file_id=created2.id,
        actor=default_user,
        processing_status=FileProcessingStatus.ERROR,
        error_message="Failed at PARSING",
    )
    assert updated2.processing_status == FileProcessingStatus.ERROR
    assert updated2.error_message == "Failed at PARSING"

    # EMBEDDING -> ERROR
    meta3 = PydanticFileMetadata(
        file_name="embedding_to_error.txt",
        file_path="/tmp/embedding_error.txt",
        file_type="text/plain",
        file_size=100,
        source_id=default_source.id,
    )
    created3 = await server.file_manager.create_file(file_metadata=meta3, actor=default_user)
    await server.file_manager.update_file_status(file_id=created3.id, actor=default_user, processing_status=FileProcessingStatus.PARSING)
    await server.file_manager.update_file_status(file_id=created3.id, actor=default_user, processing_status=FileProcessingStatus.EMBEDDING)

    updated3 = await server.file_manager.update_file_status(
        file_id=created3.id,
        actor=default_user,
        processing_status=FileProcessingStatus.ERROR,
        error_message="Failed at EMBEDDING",
    )
    assert updated3.processing_status == FileProcessingStatus.ERROR
    assert updated3.error_message == "Failed at EMBEDDING"


@pytest.mark.asyncio
async def test_file_status_terminal_state_non_status_updates(server, default_user, default_source):
    """Test that terminal states block ALL updates, not just status changes."""
    # Create file and move to COMPLETED
    meta = PydanticFileMetadata(
        file_name="terminal_blocks_all.txt",
        file_path="/tmp/terminal_all.txt",
        file_type="text/plain",
        file_size=100,
        source_id=default_source.id,
    )
    created = await server.file_manager.create_file(file_metadata=meta, actor=default_user)

    await server.file_manager.update_file_status(file_id=created.id, actor=default_user, processing_status=FileProcessingStatus.PARSING)
    await server.file_manager.update_file_status(file_id=created.id, actor=default_user, processing_status=FileProcessingStatus.EMBEDDING)
    await server.file_manager.update_file_status(file_id=created.id, actor=default_user, processing_status=FileProcessingStatus.COMPLETED)

    # Cannot update chunks_embedded in COMPLETED state
    with pytest.raises(ValueError, match="Cannot update.*terminal state completed"):
        await server.file_manager.update_file_status(
            file_id=created.id,
            actor=default_user,
            chunks_embedded=50,
        )

    # Cannot update total_chunks in COMPLETED state
    with pytest.raises(ValueError, match="Cannot update.*terminal state completed"):
        await server.file_manager.update_file_status(
            file_id=created.id,
            actor=default_user,
            total_chunks=100,
        )

    # Cannot update error_message in COMPLETED state
    with pytest.raises(ValueError, match="Cannot update.*terminal state completed"):
        await server.file_manager.update_file_status(
            file_id=created.id,
            actor=default_user,
            error_message="This should fail",
        )

    # Test same for ERROR state
    meta2 = PydanticFileMetadata(
        file_name="error_blocks_all.txt",
        file_path="/tmp/error_all.txt",
        file_type="text/plain",
        file_size=100,
        source_id=default_source.id,
    )
    created2 = await server.file_manager.create_file(file_metadata=meta2, actor=default_user)
    await server.file_manager.update_file_status(
        file_id=created2.id,
        actor=default_user,
        processing_status=FileProcessingStatus.ERROR,
        error_message="Initial error",
    )

    # Cannot update chunks_embedded in ERROR state
    with pytest.raises(ValueError, match="Cannot update.*terminal state error"):
        await server.file_manager.update_file_status(
            file_id=created2.id,
            actor=default_user,
            chunks_embedded=25,
        )


@pytest.mark.asyncio
async def test_file_status_race_condition_prevention(server, default_user, default_source):
    """Test that race conditions are prevented when multiple updates happen."""
    meta = PydanticFileMetadata(
        file_name="race_condition_test.txt",
        file_path="/tmp/race_test.txt",
        file_type="text/plain",
        file_size=100,
        source_id=default_source.id,
    )
    created = await server.file_manager.create_file(file_metadata=meta, actor=default_user)

    # Move to PARSING
    await server.file_manager.update_file_status(
        file_id=created.id,
        actor=default_user,
        processing_status=FileProcessingStatus.PARSING,
    )

    # Simulate race condition: Try to update from PARSING to PARSING again (stale read)
    # This should now be allowed (same-state transition) to prevent race conditions
    updated_again = await server.file_manager.update_file_status(
        file_id=created.id,
        actor=default_user,
        processing_status=FileProcessingStatus.PARSING,
    )
    assert updated_again.processing_status == FileProcessingStatus.PARSING

    # Move to ERROR
    await server.file_manager.update_file_status(
        file_id=created.id,
        actor=default_user,
        processing_status=FileProcessingStatus.ERROR,
        error_message="Simulated error",
    )

    # Try to continue with EMBEDDING as if error didn't happen (race condition)
    # This should fail because file is in ERROR state
    with pytest.raises(ValueError, match="Cannot update.*terminal state error"):
        await server.file_manager.update_file_status(
            file_id=created.id,
            actor=default_user,
            processing_status=FileProcessingStatus.EMBEDDING,
        )


@pytest.mark.asyncio
async def test_file_status_backwards_transitions(server, default_user, default_source):
    """Test that backwards transitions are not allowed."""
    meta = PydanticFileMetadata(
        file_name="backwards_transitions.txt",
        file_path="/tmp/backwards.txt",
        file_type="text/plain",
        file_size=100,
        source_id=default_source.id,
    )
    created = await server.file_manager.create_file(file_metadata=meta, actor=default_user)

    # Move to EMBEDDING
    await server.file_manager.update_file_status(file_id=created.id, actor=default_user, processing_status=FileProcessingStatus.PARSING)
    await server.file_manager.update_file_status(file_id=created.id, actor=default_user, processing_status=FileProcessingStatus.EMBEDDING)

    # Cannot go back to PARSING
    with pytest.raises(ValueError, match="Invalid state transition.*embedding.*PARSING"):
        await server.file_manager.update_file_status(
            file_id=created.id,
            actor=default_user,
            processing_status=FileProcessingStatus.PARSING,
        )

    # Cannot go back to PENDING
    with pytest.raises(ValueError, match="Cannot transition to PENDING state.*PENDING is only valid as initial state"):
        await server.file_manager.update_file_status(
            file_id=created.id,
            actor=default_user,
            processing_status=FileProcessingStatus.PENDING,
        )


@pytest.mark.asyncio
async def test_file_status_update_with_chunks_progress(server, default_user, default_source):
    """Test updating chunk progress during EMBEDDING state."""
    meta = PydanticFileMetadata(
        file_name="chunk_progress.txt",
        file_path="/tmp/chunks.txt",
        file_type="text/plain",
        file_size=1000,
        source_id=default_source.id,
    )
    created = await server.file_manager.create_file(file_metadata=meta, actor=default_user)

    # Move to EMBEDDING with initial chunk info
    await server.file_manager.update_file_status(file_id=created.id, actor=default_user, processing_status=FileProcessingStatus.PARSING)
    updated = await server.file_manager.update_file_status(
        file_id=created.id,
        actor=default_user,
        processing_status=FileProcessingStatus.EMBEDDING,
        total_chunks=100,
        chunks_embedded=0,
    )
    assert updated.total_chunks == 100
    assert updated.chunks_embedded == 0

    # Update chunk progress without changing status
    updated = await server.file_manager.update_file_status(
        file_id=created.id,
        actor=default_user,
        chunks_embedded=50,
    )
    assert updated.chunks_embedded == 50
    assert updated.processing_status == FileProcessingStatus.EMBEDDING

    # Update to completion
    updated = await server.file_manager.update_file_status(
        file_id=created.id,
        actor=default_user,
        chunks_embedded=100,
    )
    assert updated.chunks_embedded == 100

    # Move to COMPLETED
    updated = await server.file_manager.update_file_status(
        file_id=created.id,
        actor=default_user,
        processing_status=FileProcessingStatus.COMPLETED,
    )
    assert updated.processing_status == FileProcessingStatus.COMPLETED
    assert updated.chunks_embedded == 100  # preserved


@pytest.mark.asyncio
async def test_same_state_transitions_allowed(server, default_user, default_source):
    """Test that same-state transitions are allowed to prevent race conditions."""
    # Create file
    created = await server.file_manager.create_file(
        FileMetadata(
            file_name="same_state_test.txt",
            source_id=default_source.id,
            processing_status=FileProcessingStatus.PENDING,
        ),
        default_user,
    )

    # Test PARSING -> PARSING
    await server.file_manager.update_file_status(file_id=created.id, actor=default_user, processing_status=FileProcessingStatus.PARSING)
    updated = await server.file_manager.update_file_status(
        file_id=created.id, actor=default_user, processing_status=FileProcessingStatus.PARSING
    )
    assert updated.processing_status == FileProcessingStatus.PARSING

    # Test EMBEDDING -> EMBEDDING
    await server.file_manager.update_file_status(file_id=created.id, actor=default_user, processing_status=FileProcessingStatus.EMBEDDING)
    updated = await server.file_manager.update_file_status(
        file_id=created.id, actor=default_user, processing_status=FileProcessingStatus.EMBEDDING, chunks_embedded=5
    )
    assert updated.processing_status == FileProcessingStatus.EMBEDDING
    assert updated.chunks_embedded == 5

    # Test COMPLETED -> COMPLETED
    await server.file_manager.update_file_status(file_id=created.id, actor=default_user, processing_status=FileProcessingStatus.COMPLETED)
    updated = await server.file_manager.update_file_status(
        file_id=created.id, actor=default_user, processing_status=FileProcessingStatus.COMPLETED, total_chunks=10
    )
    assert updated.processing_status == FileProcessingStatus.COMPLETED
    assert updated.total_chunks == 10


@pytest.mark.asyncio
async def test_upsert_file_content_basic(server: SyncServer, default_user, default_source, async_session):
    """Test creating and updating file content with upsert_file_content()."""
    initial_text = "Initial content"
    updated_text = "Updated content"

    # Step 1: Create file with no content
    meta = PydanticFileMetadata(
        file_name="upsert_body.txt",
        file_path="/tmp/upsert_body.txt",
        file_type="text/plain",
        file_size=len(initial_text),
        source_id=default_source.id,
    )
    created = await server.file_manager.create_file(file_metadata=meta, actor=default_user)
    assert created.content is None

    # Step 2: Insert new content
    file_with_content = await server.file_manager.upsert_file_content(
        file_id=created.id,
        text=initial_text,
        actor=default_user,
    )
    assert file_with_content.content == initial_text

    # Verify body row exists
    count = await _count_file_content_rows(async_session, created.id)
    assert count == 1

    # Step 3: Update existing content
    file_with_updated_content = await server.file_manager.upsert_file_content(
        file_id=created.id,
        text=updated_text,
        actor=default_user,
    )
    assert file_with_updated_content.content == updated_text

    # Ensure still only 1 row in content table
    count = await _count_file_content_rows(async_session, created.id)
    assert count == 1

    # Ensure `updated_at` is bumped
    orm_file = await async_session.get(FileMetadataModel, created.id)
    assert orm_file.updated_at >= orm_file.created_at


@pytest.mark.asyncio
async def test_get_organization_sources_metadata(server, default_user):
    """Test getting organization sources metadata with aggregated file information."""
    # Create test sources
    source1 = await server.source_manager.create_source(
        source=PydanticSource(
            name="test_source_1",
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        actor=default_user,
    )

    source2 = await server.source_manager.create_source(
        source=PydanticSource(
            name="test_source_2",
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        actor=default_user,
    )

    # Create test files for source1
    file1_meta = PydanticFileMetadata(
        source_id=source1.id,
        file_name="file1.txt",
        file_type="text/plain",
        file_size=1024,
    )
    file1 = await server.file_manager.create_file(file_metadata=file1_meta, actor=default_user)

    file2_meta = PydanticFileMetadata(
        source_id=source1.id,
        file_name="file2.txt",
        file_type="text/plain",
        file_size=2048,
    )
    file2 = await server.file_manager.create_file(file_metadata=file2_meta, actor=default_user)

    # Create test file for source2
    file3_meta = PydanticFileMetadata(
        source_id=source2.id,
        file_name="file3.txt",
        file_type="text/plain",
        file_size=512,
    )
    file3 = await server.file_manager.create_file(file_metadata=file3_meta, actor=default_user)

    # Test 1: Get organization metadata without detailed per-source metadata (default behavior)
    metadata_summary = await server.file_manager.get_organization_sources_metadata(
        actor=default_user, include_detailed_per_source_metadata=False
    )

    # Verify top-level aggregations are present
    assert metadata_summary.total_sources >= 2  # May have other sources from other tests
    assert metadata_summary.total_files >= 3
    assert metadata_summary.total_size >= 3584

    # Verify sources list is empty when include_detailed_per_source_metadata=False
    assert len(metadata_summary.sources) == 0

    # Test 2: Get organization metadata with detailed per-source metadata
    metadata_detailed = await server.file_manager.get_organization_sources_metadata(
        actor=default_user, include_detailed_per_source_metadata=True
    )

    # Verify top-level aggregations are the same
    assert metadata_detailed.total_sources == metadata_summary.total_sources
    assert metadata_detailed.total_files == metadata_summary.total_files
    assert metadata_detailed.total_size == metadata_summary.total_size

    # Find our test sources in the detailed results
    source1_meta = next((s for s in metadata_detailed.sources if s.source_id == source1.id), None)
    source2_meta = next((s for s in metadata_detailed.sources if s.source_id == source2.id), None)

    assert source1_meta is not None
    assert source1_meta.source_name == "test_source_1"
    assert source1_meta.file_count == 2
    assert source1_meta.total_size == 3072  # 1024 + 2048
    assert len(source1_meta.files) == 2

    # Verify file details in source1
    file1_stats = next((f for f in source1_meta.files if f.file_id == file1.id), None)
    file2_stats = next((f for f in source1_meta.files if f.file_id == file2.id), None)

    assert file1_stats is not None
    assert file1_stats.file_name == "file1.txt"
    assert file1_stats.file_size == 1024

    assert file2_stats is not None
    assert file2_stats.file_name == "file2.txt"
    assert file2_stats.file_size == 2048

    assert source2_meta is not None
    assert source2_meta.source_name == "test_source_2"
    assert source2_meta.file_count == 1
    assert source2_meta.total_size == 512
    assert len(source2_meta.files) == 1

    # Verify file details in source2
    file3_stats = source2_meta.files[0]
    assert file3_stats.file_id == file3.id
    assert file3_stats.file_name == "file3.txt"
    assert file3_stats.file_size == 512


# ======================================================================================================================
# SandboxConfigManager Tests - Sandbox Configs
# ======================================================================================================================


@pytest.mark.asyncio
async def test_create_or_update_sandbox_config(server: SyncServer, default_user, event_loop):
    sandbox_config_create = SandboxConfigCreate(
        config=E2BSandboxConfig(),
    )
    created_config = await server.sandbox_config_manager.create_or_update_sandbox_config_async(sandbox_config_create, actor=default_user)

    # Assertions
    assert created_config.type == SandboxType.E2B
    assert created_config.get_e2b_config() == sandbox_config_create.config
    assert created_config.organization_id == default_user.organization_id


@pytest.mark.asyncio
async def test_create_local_sandbox_config_defaults(server: SyncServer, default_user, event_loop):
    sandbox_config_create = SandboxConfigCreate(
        config=LocalSandboxConfig(),
    )
    created_config = await server.sandbox_config_manager.create_or_update_sandbox_config_async(sandbox_config_create, actor=default_user)

    # Assertions
    assert created_config.type == SandboxType.LOCAL
    assert created_config.get_local_config() == sandbox_config_create.config
    assert created_config.get_local_config().sandbox_dir in {LETTA_TOOL_EXECUTION_DIR, tool_settings.tool_exec_dir}
    assert created_config.organization_id == default_user.organization_id


@pytest.mark.asyncio
async def test_default_e2b_settings_sandbox_config(server: SyncServer, default_user, event_loop):
    created_config = await server.sandbox_config_manager.get_or_create_default_sandbox_config_async(
        sandbox_type=SandboxType.E2B, actor=default_user
    )
    e2b_config = created_config.get_e2b_config()

    # Assertions
    assert e2b_config.timeout == 5 * 60
    assert e2b_config.template == tool_settings.e2b_sandbox_template_id


@pytest.mark.asyncio
async def test_update_existing_sandbox_config(server: SyncServer, sandbox_config_fixture, default_user, event_loop):
    update_data = SandboxConfigUpdate(config=E2BSandboxConfig(template="template_2", timeout=120))
    updated_config = await server.sandbox_config_manager.update_sandbox_config_async(
        sandbox_config_fixture.id, update_data, actor=default_user
    )

    # Assertions
    assert updated_config.config["template"] == "template_2"
    assert updated_config.config["timeout"] == 120


@pytest.mark.asyncio
async def test_delete_sandbox_config(server: SyncServer, sandbox_config_fixture, default_user, event_loop):
    deleted_config = await server.sandbox_config_manager.delete_sandbox_config_async(sandbox_config_fixture.id, actor=default_user)

    # Assertions to verify deletion
    assert deleted_config.id == sandbox_config_fixture.id

    # Verify it no longer exists
    config_list = await server.sandbox_config_manager.list_sandbox_configs_async(actor=default_user)
    assert sandbox_config_fixture.id not in [config.id for config in config_list]


@pytest.mark.asyncio
async def test_get_sandbox_config_by_type(server: SyncServer, sandbox_config_fixture, default_user, event_loop):
    retrieved_config = await server.sandbox_config_manager.get_sandbox_config_by_type_async(sandbox_config_fixture.type, actor=default_user)

    # Assertions to verify correct retrieval
    assert retrieved_config.id == sandbox_config_fixture.id
    assert retrieved_config.type == sandbox_config_fixture.type


@pytest.mark.asyncio
async def test_list_sandbox_configs(server: SyncServer, default_user, event_loop):
    # Creating multiple sandbox configs
    config_e2b_create = SandboxConfigCreate(
        config=E2BSandboxConfig(),
    )
    config_local_create = SandboxConfigCreate(
        config=LocalSandboxConfig(sandbox_dir=""),
    )
    config_e2b = await server.sandbox_config_manager.create_or_update_sandbox_config_async(config_e2b_create, actor=default_user)
    if USING_SQLITE:
        time.sleep(CREATE_DELAY_SQLITE)
    config_local = await server.sandbox_config_manager.create_or_update_sandbox_config_async(config_local_create, actor=default_user)

    # List configs without pagination
    configs = await server.sandbox_config_manager.list_sandbox_configs_async(actor=default_user)
    assert len(configs) >= 2

    # List configs with pagination
    paginated_configs = await server.sandbox_config_manager.list_sandbox_configs_async(actor=default_user, limit=1)
    assert len(paginated_configs) == 1

    next_page = await server.sandbox_config_manager.list_sandbox_configs_async(actor=default_user, after=paginated_configs[-1].id, limit=1)
    assert len(next_page) == 1
    assert next_page[0].id != paginated_configs[0].id

    # List configs using sandbox_type filter
    configs = await server.sandbox_config_manager.list_sandbox_configs_async(actor=default_user, sandbox_type=SandboxType.E2B)
    assert len(configs) == 1
    assert configs[0].id == config_e2b.id

    configs = await server.sandbox_config_manager.list_sandbox_configs_async(actor=default_user, sandbox_type=SandboxType.LOCAL)
    assert len(configs) == 1
    assert configs[0].id == config_local.id


# ======================================================================================================================
# SandboxConfigManager Tests - Environment Variables
# ======================================================================================================================


@pytest.mark.asyncio
async def test_create_sandbox_env_var(server: SyncServer, sandbox_config_fixture, default_user, event_loop):
    env_var_create = SandboxEnvironmentVariableCreate(key="TEST_VAR", value="test_value", description="A test environment variable.")
    created_env_var = await server.sandbox_config_manager.create_sandbox_env_var_async(
        env_var_create, sandbox_config_id=sandbox_config_fixture.id, actor=default_user
    )

    # Assertions
    assert created_env_var.key == env_var_create.key
    assert created_env_var.value == env_var_create.value
    assert created_env_var.organization_id == default_user.organization_id


@pytest.mark.asyncio
async def test_update_sandbox_env_var(server: SyncServer, sandbox_env_var_fixture, default_user, event_loop):
    update_data = SandboxEnvironmentVariableUpdate(value="updated_value")
    updated_env_var = await server.sandbox_config_manager.update_sandbox_env_var_async(
        sandbox_env_var_fixture.id, update_data, actor=default_user
    )

    # Assertions
    assert updated_env_var.value == "updated_value"
    assert updated_env_var.id == sandbox_env_var_fixture.id


@pytest.mark.asyncio
async def test_delete_sandbox_env_var(server: SyncServer, sandbox_config_fixture, sandbox_env_var_fixture, default_user, event_loop):
    deleted_env_var = await server.sandbox_config_manager.delete_sandbox_env_var_async(sandbox_env_var_fixture.id, actor=default_user)

    # Assertions to verify deletion
    assert deleted_env_var.id == sandbox_env_var_fixture.id

    # Verify it no longer exists
    env_vars = await server.sandbox_config_manager.list_sandbox_env_vars_async(
        sandbox_config_id=sandbox_config_fixture.id, actor=default_user
    )
    assert sandbox_env_var_fixture.id not in [env_var.id for env_var in env_vars]


@pytest.mark.asyncio
async def test_list_sandbox_env_vars(server: SyncServer, sandbox_config_fixture, default_user, event_loop):
    # Creating multiple environment variables
    env_var_create_a = SandboxEnvironmentVariableCreate(key="VAR1", value="value1")
    env_var_create_b = SandboxEnvironmentVariableCreate(key="VAR2", value="value2")
    await server.sandbox_config_manager.create_sandbox_env_var_async(
        env_var_create_a, sandbox_config_id=sandbox_config_fixture.id, actor=default_user
    )
    if USING_SQLITE:
        time.sleep(CREATE_DELAY_SQLITE)
    await server.sandbox_config_manager.create_sandbox_env_var_async(
        env_var_create_b, sandbox_config_id=sandbox_config_fixture.id, actor=default_user
    )

    # List env vars without pagination
    env_vars = await server.sandbox_config_manager.list_sandbox_env_vars_async(
        sandbox_config_id=sandbox_config_fixture.id, actor=default_user
    )
    assert len(env_vars) >= 2

    # List env vars with pagination
    paginated_env_vars = await server.sandbox_config_manager.list_sandbox_env_vars_async(
        sandbox_config_id=sandbox_config_fixture.id, actor=default_user, limit=1
    )
    assert len(paginated_env_vars) == 1

    next_page = await server.sandbox_config_manager.list_sandbox_env_vars_async(
        sandbox_config_id=sandbox_config_fixture.id, actor=default_user, after=paginated_env_vars[-1].id, limit=1
    )
    assert len(next_page) == 1
    assert next_page[0].id != paginated_env_vars[0].id


@pytest.mark.asyncio
async def test_get_sandbox_env_var_by_key(server: SyncServer, sandbox_env_var_fixture, default_user, event_loop):
    retrieved_env_var = await server.sandbox_config_manager.get_sandbox_env_var_by_key_and_sandbox_config_id_async(
        sandbox_env_var_fixture.key, sandbox_env_var_fixture.sandbox_config_id, actor=default_user
    )

    # Assertions to verify correct retrieval
    assert retrieved_env_var.id == sandbox_env_var_fixture.id
    assert retrieved_env_var.key == sandbox_env_var_fixture.key


# ======================================================================================================================
# JobManager Tests
# ======================================================================================================================


@pytest.mark.asyncio
async def test_create_job(server: SyncServer, default_user, event_loop):
    """Test creating a job."""
    job_data = PydanticJob(
        status=JobStatus.created,
        metadata={"type": "test"},
    )

    created_job = await server.job_manager.create_job_async(pydantic_job=job_data, actor=default_user)

    # Assertions to ensure the created job matches the expected values
    assert created_job.user_id == default_user.id
    assert created_job.status == JobStatus.created
    assert created_job.metadata == {"type": "test"}


@pytest.mark.asyncio
async def test_get_job_by_id(server: SyncServer, default_user, event_loop):
    """Test fetching a job by ID."""
    # Create a job
    job_data = PydanticJob(
        status=JobStatus.created,
        metadata={"type": "test"},
    )
    created_job = await server.job_manager.create_job_async(pydantic_job=job_data, actor=default_user)

    # Fetch the job by ID
    fetched_job = await server.job_manager.get_job_by_id_async(created_job.id, actor=default_user)

    # Assertions to ensure the fetched job matches the created job
    assert fetched_job.id == created_job.id
    assert fetched_job.status == JobStatus.created
    assert fetched_job.metadata == {"type": "test"}


@pytest.mark.asyncio
async def test_list_jobs(server: SyncServer, default_user, event_loop):
    """Test listing jobs."""
    # Create multiple jobs
    for i in range(3):
        job_data = PydanticJob(
            status=JobStatus.created,
            metadata={"type": f"test-{i}"},
        )
        await server.job_manager.create_job_async(pydantic_job=job_data, actor=default_user)

    # List jobs
    jobs = await server.job_manager.list_jobs_async(actor=default_user)

    # Assertions to check that the created jobs are listed
    assert len(jobs) == 3
    assert all(job.user_id == default_user.id for job in jobs)
    assert all(job.metadata["type"].startswith("test") for job in jobs)


@pytest.mark.asyncio
async def test_list_jobs_with_metadata(server: SyncServer, default_user, event_loop):
    for i in range(3):
        job_data = PydanticJob(status=JobStatus.created, metadata={"source_id": f"source-test-{i}"})
        await server.job_manager.create_job_async(pydantic_job=job_data, actor=default_user)
    jobs = await server.job_manager.list_jobs_async(actor=default_user, source_id="source-test-2")
    assert len(jobs) == 1
    assert jobs[0].metadata["source_id"] == "source-test-2"


@pytest.mark.asyncio
async def test_update_job_by_id(server: SyncServer, default_user, event_loop):
    """Test updating a job by its ID."""
    # Create a job
    job_data = PydanticJob(
        status=JobStatus.created,
        metadata={"type": "test"},
    )
    created_job = await server.job_manager.create_job_async(pydantic_job=job_data, actor=default_user)
    assert created_job.metadata == {"type": "test"}

    # Update the job
    update_data = JobUpdate(status=JobStatus.completed, metadata={"type": "updated"})
    updated_job = await server.job_manager.update_job_by_id_async(created_job.id, update_data, actor=default_user)

    # Assertions to ensure the job was updated
    assert updated_job.status == JobStatus.completed
    assert updated_job.metadata == {"type": "updated"}
    assert updated_job.completed_at is not None


@pytest.mark.asyncio
async def test_delete_job_by_id(server: SyncServer, default_user, event_loop):
    """Test deleting a job by its ID."""
    # Create a job
    job_data = PydanticJob(
        status=JobStatus.created,
        metadata={"type": "test"},
    )
    created_job = await server.job_manager.create_job_async(pydantic_job=job_data, actor=default_user)

    # Delete the job
    await server.job_manager.delete_job_by_id_async(created_job.id, actor=default_user)

    # List jobs to ensure the job was deleted
    jobs = await server.job_manager.list_jobs_async(actor=default_user)
    assert len(jobs) == 0


@pytest.mark.asyncio
async def test_update_job_auto_complete(server: SyncServer, default_user, event_loop):
    """Test that updating a job's status to 'completed' automatically sets completed_at."""
    # Create a job
    job_data = PydanticJob(
        status=JobStatus.created,
        metadata={"type": "test"},
    )
    created_job = await server.job_manager.create_job_async(pydantic_job=job_data, actor=default_user)

    # Update the job's status to 'completed'
    update_data = JobUpdate(status=JobStatus.completed)
    updated_job = await server.job_manager.update_job_by_id_async(created_job.id, update_data, actor=default_user)

    # Assertions to check that completed_at was set
    assert updated_job.status == JobStatus.completed
    assert updated_job.completed_at is not None


@pytest.mark.asyncio
async def test_get_job_not_found(server: SyncServer, default_user, event_loop):
    """Test fetching a non-existent job."""
    non_existent_job_id = "nonexistent-id"
    with pytest.raises(NoResultFound):
        await server.job_manager.get_job_by_id_async(non_existent_job_id, actor=default_user)


@pytest.mark.asyncio
async def test_delete_job_not_found(server: SyncServer, default_user, event_loop):
    """Test deleting a non-existent job."""
    non_existent_job_id = "nonexistent-id"
    with pytest.raises(NoResultFound):
        await server.job_manager.delete_job_by_id_async(non_existent_job_id, actor=default_user)


@pytest.mark.asyncio
async def test_list_jobs_pagination(server: SyncServer, default_user, event_loop):
    """Test listing jobs with pagination."""
    # Create multiple jobs
    for i in range(10):
        job_data = PydanticJob(
            status=JobStatus.created,
            metadata={"type": f"test-{i}"},
        )
        await server.job_manager.create_job_async(pydantic_job=job_data, actor=default_user)

    # List jobs with a limit
    jobs = await server.job_manager.list_jobs_async(actor=default_user, limit=5)
    assert len(jobs) == 5
    assert all(job.user_id == default_user.id for job in jobs)

    # Test cursor-based pagination
    first_page = await server.job_manager.list_jobs_async(actor=default_user, limit=3, ascending=True)  # [J0, J1, J2]
    assert len(first_page) == 3
    assert first_page[0].created_at <= first_page[1].created_at <= first_page[2].created_at

    last_page = await server.job_manager.list_jobs_async(actor=default_user, limit=3, ascending=False)  # [J9, J8, J7]
    assert len(last_page) == 3
    assert last_page[0].created_at >= last_page[1].created_at >= last_page[2].created_at
    first_page_ids = set(job.id for job in first_page)
    last_page_ids = set(job.id for job in last_page)
    assert first_page_ids.isdisjoint(last_page_ids)

    # Test middle page using both before and after
    middle_page = await server.job_manager.list_jobs_async(
        actor=default_user, before=last_page[-1].id, after=first_page[-1].id, ascending=True
    )  # [J3, J4, J5, J6]
    assert len(middle_page) == 4  # Should include jobs between first and second page
    head_tail_jobs = first_page_ids.union(last_page_ids)
    assert all(job.id not in head_tail_jobs for job in middle_page)

    # Test descending order
    middle_page_desc = await server.job_manager.list_jobs_async(
        actor=default_user, before=last_page[-1].id, after=first_page[-1].id, ascending=False
    )  # [J6, J5, J4, J3]
    assert len(middle_page_desc) == 4
    assert middle_page_desc[0].id == middle_page[-1].id
    assert middle_page_desc[1].id == middle_page[-2].id
    assert middle_page_desc[2].id == middle_page[-3].id
    assert middle_page_desc[3].id == middle_page[-4].id

    # BONUS
    job_7 = last_page[-1].id
    earliest_jobs = await server.job_manager.list_jobs_async(actor=default_user, ascending=False, before=job_7)
    assert len(earliest_jobs) == 7
    assert all(j.id not in last_page_ids for j in earliest_jobs)
    assert all(earliest_jobs[i].created_at >= earliest_jobs[i + 1].created_at for i in range(len(earliest_jobs) - 1))


@pytest.mark.asyncio
async def test_list_jobs_by_status(server: SyncServer, default_user, event_loop):
    """Test listing jobs filtered by status."""
    # Create multiple jobs with different statuses
    job_data_created = PydanticJob(
        status=JobStatus.created,
        metadata={"type": "test-created"},
    )
    job_data_in_progress = PydanticJob(
        status=JobStatus.running,
        metadata={"type": "test-running"},
    )
    job_data_completed = PydanticJob(
        status=JobStatus.completed,
        metadata={"type": "test-completed"},
    )

    await server.job_manager.create_job_async(pydantic_job=job_data_created, actor=default_user)
    await server.job_manager.create_job_async(pydantic_job=job_data_in_progress, actor=default_user)
    await server.job_manager.create_job_async(pydantic_job=job_data_completed, actor=default_user)

    # List jobs filtered by status
    created_jobs = await server.job_manager.list_jobs_async(actor=default_user, statuses=[JobStatus.created])
    in_progress_jobs = await server.job_manager.list_jobs_async(actor=default_user, statuses=[JobStatus.running])
    completed_jobs = await server.job_manager.list_jobs_async(actor=default_user, statuses=[JobStatus.completed])

    # Assertions
    assert len(created_jobs) == 1
    assert created_jobs[0].metadata["type"] == job_data_created.metadata["type"]

    assert len(in_progress_jobs) == 1
    assert in_progress_jobs[0].metadata["type"] == job_data_in_progress.metadata["type"]

    assert len(completed_jobs) == 1
    assert completed_jobs[0].metadata["type"] == job_data_completed.metadata["type"]


@pytest.mark.asyncio
async def test_list_jobs_filter_by_type(server: SyncServer, default_user, default_job, event_loop):
    """Test that list_jobs correctly filters by job_type."""
    # Create a run job
    run_pydantic = PydanticJob(
        user_id=default_user.id,
        status=JobStatus.pending,
        job_type=JobType.RUN,
    )
    run = await server.job_manager.create_job_async(pydantic_job=run_pydantic, actor=default_user)

    # List only regular jobs
    jobs = await server.job_manager.list_jobs_async(actor=default_user)
    assert len(jobs) == 1
    assert jobs[0].id == default_job.id

    # List only run jobs
    jobs = await server.job_manager.list_jobs_async(actor=default_user, job_type=JobType.RUN)
    assert len(jobs) == 1
    assert jobs[0].id == run.id


@pytest.mark.asyncio
async def test_e2e_job_callback(monkeypatch, server: SyncServer, default_user):
    """Test that job callbacks are properly dispatched when a job is completed."""
    captured = {}

    # Create a simple mock for the async HTTP client
    class MockAsyncResponse:
        status_code = 202

    async def mock_post(url, json, timeout):
        captured["url"] = url
        captured["json"] = json
        return MockAsyncResponse()

    class MockAsyncClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def post(self, url, json, timeout):
            return await mock_post(url, json, timeout)

    # Patch the AsyncClient
    import letta.services.job_manager as job_manager_module

    monkeypatch.setattr(job_manager_module, "AsyncClient", MockAsyncClient)

    job_in = PydanticJob(status=JobStatus.created, metadata={"foo": "bar"}, callback_url="http://example.test/webhook/jobs")
    created = await server.job_manager.create_job_async(pydantic_job=job_in, actor=default_user)
    assert created.callback_url == "http://example.test/webhook/jobs"

    # Update the job status to completed, which should trigger the callback
    update = JobUpdate(status=JobStatus.completed)
    updated = await server.job_manager.update_job_by_id_async(created.id, update, actor=default_user)

    # Verify the callback was triggered with the correct parameters
    assert captured["url"] == created.callback_url, "Callback URL doesn't match"
    assert captured["json"]["job_id"] == created.id, "Job ID in callback doesn't match"
    assert captured["json"]["status"] == JobStatus.completed.value, "Job status in callback doesn't match"

    # Verify the completed_at timestamp is reasonable
    actual_dt = datetime.fromisoformat(captured["json"]["completed_at"]).replace(tzinfo=None)
    assert abs((actual_dt - updated.completed_at).total_seconds()) < 1, "Timestamp difference is too large"

    assert isinstance(updated.callback_sent_at, datetime)
    assert updated.callback_status_code == 202


# ======================================================================================================================
# JobManager Tests - Messages
# ======================================================================================================================


def test_job_messages_add(server: SyncServer, default_run, hello_world_message_fixture, default_user):
    """Test adding a message to a job."""
    # Add message to job
    server.job_manager.add_message_to_job(
        job_id=default_run.id,
        message_id=hello_world_message_fixture.id,
        actor=default_user,
    )

    # Verify message was added
    messages = server.job_manager.get_job_messages(
        job_id=default_run.id,
        actor=default_user,
    )
    assert len(messages) == 1
    assert messages[0].id == hello_world_message_fixture.id
    assert messages[0].content[0].text == hello_world_message_fixture.content[0].text


def test_job_messages_pagination(server: SyncServer, default_run, default_user, sarah_agent):
    """Test pagination of job messages."""
    # Create multiple messages
    message_ids = []
    for i in range(5):
        message = PydanticMessage(
            agent_id=sarah_agent.id,
            role=MessageRole.user,
            content=[TextContent(text=f"Test message {i}")],
        )
        msg = server.message_manager.create_message(message, actor=default_user)
        message_ids.append(msg.id)

        # Add message to job
        server.job_manager.add_message_to_job(
            job_id=default_run.id,
            message_id=msg.id,
            actor=default_user,
        )

    # Test pagination with limit
    messages = server.job_manager.get_job_messages(
        job_id=default_run.id,
        actor=default_user,
        limit=2,
    )
    assert len(messages) == 2
    assert messages[0].id == message_ids[0]
    assert messages[1].id == message_ids[1]

    # Test pagination with cursor
    first_page = server.job_manager.get_job_messages(
        job_id=default_run.id,
        actor=default_user,
        limit=2,
        ascending=True,  # [M0, M1]
    )
    assert len(first_page) == 2
    assert first_page[0].id == message_ids[0]
    assert first_page[1].id == message_ids[1]
    assert first_page[0].created_at <= first_page[1].created_at

    last_page = server.job_manager.get_job_messages(
        job_id=default_run.id,
        actor=default_user,
        limit=2,
        ascending=False,  # [M4, M3]
    )
    assert len(last_page) == 2
    assert last_page[0].id == message_ids[4]
    assert last_page[1].id == message_ids[3]
    assert last_page[0].created_at >= last_page[1].created_at

    first_page_ids = set(msg.id for msg in first_page)
    last_page_ids = set(msg.id for msg in last_page)
    assert first_page_ids.isdisjoint(last_page_ids)

    # Test middle page using both before and after
    middle_page = server.job_manager.get_job_messages(
        job_id=default_run.id,
        actor=default_user,
        before=last_page[-1].id,  # M3
        after=first_page[0].id,  # M0
        ascending=True,  # [M1, M2]
    )
    assert len(middle_page) == 2  # Should include message between first and last pages
    assert middle_page[0].id == message_ids[1]
    assert middle_page[1].id == message_ids[2]
    head_tail_msgs = first_page_ids.union(last_page_ids)
    assert middle_page[1].id not in head_tail_msgs
    assert middle_page[0].id in first_page_ids

    # Test descending order for middle page
    middle_page = server.job_manager.get_job_messages(
        job_id=default_run.id,
        actor=default_user,
        before=last_page[-1].id,  # M3
        after=first_page[0].id,  # M0
        ascending=False,  # [M2, M1]
    )
    assert len(middle_page) == 2  # Should include message between first and last pages
    assert middle_page[0].id == message_ids[2]
    assert middle_page[1].id == message_ids[1]

    # Test getting earliest messages
    msg_3 = last_page[-1].id
    earliest_msgs = server.job_manager.get_job_messages(
        job_id=default_run.id,
        actor=default_user,
        ascending=False,
        before=msg_3,  # Get messages after M3 in descending order
    )
    assert len(earliest_msgs) == 3  # Should get M2, M1, M0
    assert all(m.id not in last_page_ids for m in earliest_msgs)
    assert earliest_msgs[0].created_at > earliest_msgs[1].created_at > earliest_msgs[2].created_at

    # Test getting earliest messages with ascending order
    earliest_msgs_ascending = server.job_manager.get_job_messages(
        job_id=default_run.id,
        actor=default_user,
        ascending=True,
        before=msg_3,  # Get messages before M3 in ascending order
    )
    assert len(earliest_msgs_ascending) == 3  # Should get M0, M1, M2
    assert all(m.id not in last_page_ids for m in earliest_msgs_ascending)
    assert earliest_msgs_ascending[0].created_at < earliest_msgs_ascending[1].created_at < earliest_msgs_ascending[2].created_at


def test_job_messages_ordering(server: SyncServer, default_run, default_user, sarah_agent):
    """Test that messages are ordered by created_at."""
    # Create messages with different timestamps
    base_time = datetime.now(timezone.utc)
    message_times = [
        base_time - timedelta(minutes=2),
        base_time - timedelta(minutes=1),
        base_time,
    ]

    for i, created_at in enumerate(message_times):
        message = PydanticMessage(
            role=MessageRole.user,
            content=[TextContent(text="Test message")],
            agent_id=sarah_agent.id,
            created_at=created_at,
        )
        msg = server.message_manager.create_message(message, actor=default_user)

        # Add message to job
        server.job_manager.add_message_to_job(
            job_id=default_run.id,
            message_id=msg.id,
            actor=default_user,
        )

    # Verify messages are returned in chronological order
    returned_messages = server.job_manager.get_job_messages(
        job_id=default_run.id,
        actor=default_user,
    )

    assert len(returned_messages) == 3
    assert returned_messages[0].created_at < returned_messages[1].created_at
    assert returned_messages[1].created_at < returned_messages[2].created_at

    # Verify messages are returned in descending order
    returned_messages = server.job_manager.get_job_messages(
        job_id=default_run.id,
        actor=default_user,
        ascending=False,
    )

    assert len(returned_messages) == 3
    assert returned_messages[0].created_at > returned_messages[1].created_at
    assert returned_messages[1].created_at > returned_messages[2].created_at


def test_job_messages_empty(server: SyncServer, default_run, default_user):
    """Test getting messages for a job with no messages."""
    messages = server.job_manager.get_job_messages(
        job_id=default_run.id,
        actor=default_user,
    )
    assert len(messages) == 0


def test_job_messages_add_duplicate(server: SyncServer, default_run, hello_world_message_fixture, default_user):
    """Test adding the same message to a job twice."""
    # Add message to job first time
    server.job_manager.add_message_to_job(
        job_id=default_run.id,
        message_id=hello_world_message_fixture.id,
        actor=default_user,
    )

    # Attempt to add same message again
    with pytest.raises(IntegrityError):
        server.job_manager.add_message_to_job(
            job_id=default_run.id,
            message_id=hello_world_message_fixture.id,
            actor=default_user,
        )


def test_job_messages_filter(server: SyncServer, default_run, default_user, sarah_agent):
    """Test getting messages associated with a job."""
    # Create test messages with different roles and tool calls
    messages = [
        PydanticMessage(
            role=MessageRole.user,
            content=[TextContent(text="Hello")],
            agent_id=sarah_agent.id,
        ),
        PydanticMessage(
            role=MessageRole.assistant,
            content=[TextContent(text="Hi there!")],
            agent_id=sarah_agent.id,
        ),
        PydanticMessage(
            role=MessageRole.assistant,
            content=[TextContent(text="Let me help you with that")],
            agent_id=sarah_agent.id,
            tool_calls=[
                OpenAIToolCall(
                    id="call_1",
                    type="function",
                    function=OpenAIFunction(
                        name="test_tool",
                        arguments='{"arg1": "value1"}',
                    ),
                )
            ],
        ),
    ]

    # Add messages to job
    for msg in messages:
        created_msg = server.message_manager.create_message(msg, actor=default_user)
        server.job_manager.add_message_to_job(default_run.id, created_msg.id, actor=default_user)

    # Test getting all messages
    all_messages = server.job_manager.get_job_messages(job_id=default_run.id, actor=default_user)
    assert len(all_messages) == 3

    # Test filtering by role
    user_messages = server.job_manager.get_job_messages(job_id=default_run.id, actor=default_user, role=MessageRole.user)
    assert len(user_messages) == 1
    assert user_messages[0].role == MessageRole.user

    # Test limit
    limited_messages = server.job_manager.get_job_messages(job_id=default_run.id, actor=default_user, limit=2)
    assert len(limited_messages) == 2


def test_get_run_messages(server: SyncServer, default_user: PydanticUser, sarah_agent):
    """Test getting messages for a run with request config."""
    # Create a run with custom request config
    run = server.job_manager.create_job(
        pydantic_job=PydanticRun(
            user_id=default_user.id,
            status=JobStatus.created,
            request_config=LettaRequestConfig(
                use_assistant_message=False, assistant_message_tool_name="custom_tool", assistant_message_tool_kwarg="custom_arg"
            ),
        ),
        actor=default_user,
    )

    # Add some messages
    messages = [
        PydanticMessage(
            agent_id=sarah_agent.id,
            role=MessageRole.tool if i % 2 == 0 else MessageRole.assistant,
            content=[TextContent(text=f"Test message {i}" if i % 2 == 1 else '{"status": "OK"}')],
            tool_calls=(
                [{"type": "function", "id": f"call_{i//2}", "function": {"name": "custom_tool", "arguments": '{"custom_arg": "test"}'}}]
                if i % 2 == 1
                else None
            ),
            tool_call_id=f"call_{i//2}" if i % 2 == 0 else None,
        )
        for i in range(4)
    ]

    for msg in messages:
        created_msg = server.message_manager.create_message(msg, actor=default_user)
        server.job_manager.add_message_to_job(job_id=run.id, message_id=created_msg.id, actor=default_user)

    # Get messages and verify they're converted correctly
    result = server.job_manager.get_run_messages(run_id=run.id, actor=default_user)

    # Verify correct number of messages. Assistant messages should be parsed
    assert len(result) == 6

    # Verify assistant messages are parsed according to request config
    tool_call_messages = [msg for msg in result if msg.message_type == "tool_call_message"]
    reasoning_messages = [msg for msg in result if msg.message_type == "reasoning_message"]
    assert len(tool_call_messages) == 2
    assert len(reasoning_messages) == 2
    for msg in tool_call_messages:
        assert msg.tool_call is not None
        assert msg.tool_call.name == "custom_tool"


def test_get_run_messages_with_assistant_message(server: SyncServer, default_user: PydanticUser, sarah_agent):
    """Test getting messages for a run with request config."""
    # Create a run with custom request config
    run = server.job_manager.create_job(
        pydantic_job=PydanticRun(
            user_id=default_user.id,
            status=JobStatus.created,
            request_config=LettaRequestConfig(
                use_assistant_message=True, assistant_message_tool_name="custom_tool", assistant_message_tool_kwarg="custom_arg"
            ),
        ),
        actor=default_user,
    )

    # Add some messages
    messages = [
        PydanticMessage(
            agent_id=sarah_agent.id,
            role=MessageRole.tool if i % 2 == 0 else MessageRole.assistant,
            content=[TextContent(text=f"Test message {i}" if i % 2 == 1 else '{"status": "OK"}')],
            tool_calls=(
                [{"type": "function", "id": f"call_{i//2}", "function": {"name": "custom_tool", "arguments": '{"custom_arg": "test"}'}}]
                if i % 2 == 1
                else None
            ),
            tool_call_id=f"call_{i//2}" if i % 2 == 0 else None,
        )
        for i in range(4)
    ]

    for msg in messages:
        created_msg = server.message_manager.create_message(msg, actor=default_user)
        server.job_manager.add_message_to_job(job_id=run.id, message_id=created_msg.id, actor=default_user)

    # Get messages and verify they're converted correctly
    result = server.job_manager.get_run_messages(run_id=run.id, actor=default_user)

    # Verify correct number of messages. Assistant messages should be parsed
    assert len(result) == 4

    # Verify assistant messages are parsed according to request config
    assistant_messages = [msg for msg in result if msg.message_type == "assistant_message"]
    reasoning_messages = [msg for msg in result if msg.message_type == "reasoning_message"]
    assert len(assistant_messages) == 2
    assert len(reasoning_messages) == 2
    for msg in assistant_messages:
        assert msg.content == "test"
    for msg in reasoning_messages:
        assert "Test message" in msg.reasoning


# ======================================================================================================================
# JobManager Tests - Usage Statistics
# ======================================================================================================================


@pytest.mark.asyncio
async def test_job_usage_stats_add_and_get(server: SyncServer, sarah_agent, default_job, default_user, event_loop):
    """Test adding and retrieving job usage statistics."""
    job_manager = server.job_manager
    step_manager = server.step_manager

    # Add usage statistics
    await step_manager.log_step_async(
        agent_id=sarah_agent.id,
        provider_name="openai",
        provider_category="base",
        model="gpt-4o-mini",
        model_endpoint="https://api.openai.com/v1",
        context_window_limit=8192,
        job_id=default_job.id,
        usage=UsageStatistics(
            completion_tokens=100,
            prompt_tokens=50,
            total_tokens=150,
        ),
        actor=default_user,
        project_id=sarah_agent.project_id,
    )

    # Get usage statistics
    usage_stats = job_manager.get_job_usage(job_id=default_job.id, actor=default_user)

    # Verify the statistics
    assert usage_stats.completion_tokens == 100
    assert usage_stats.prompt_tokens == 50
    assert usage_stats.total_tokens == 150

    # get steps
    steps = job_manager.get_job_steps(job_id=default_job.id, actor=default_user)
    assert len(steps) == 1


def test_job_usage_stats_get_no_stats(server: SyncServer, default_job, default_user):
    """Test getting usage statistics for a job with no stats."""
    job_manager = server.job_manager

    # Get usage statistics for a job with no stats
    usage_stats = job_manager.get_job_usage(job_id=default_job.id, actor=default_user)

    # Verify default values
    assert usage_stats.completion_tokens == 0
    assert usage_stats.prompt_tokens == 0
    assert usage_stats.total_tokens == 0

    # get steps
    steps = job_manager.get_job_steps(job_id=default_job.id, actor=default_user)
    assert len(steps) == 0


@pytest.mark.asyncio
async def test_job_usage_stats_add_multiple(server: SyncServer, sarah_agent, default_job, default_user, event_loop):
    """Test adding multiple usage statistics entries for a job."""
    job_manager = server.job_manager
    step_manager = server.step_manager

    # Add first usage statistics entry
    await step_manager.log_step_async(
        agent_id=sarah_agent.id,
        provider_name="openai",
        provider_category="base",
        model="gpt-4o-mini",
        model_endpoint="https://api.openai.com/v1",
        context_window_limit=8192,
        job_id=default_job.id,
        usage=UsageStatistics(
            completion_tokens=100,
            prompt_tokens=50,
            total_tokens=150,
        ),
        actor=default_user,
        project_id=sarah_agent.project_id,
    )

    # Add second usage statistics entry
    await step_manager.log_step_async(
        agent_id=sarah_agent.id,
        provider_name="openai",
        provider_category="base",
        model="gpt-4o-mini",
        model_endpoint="https://api.openai.com/v1",
        context_window_limit=8192,
        job_id=default_job.id,
        usage=UsageStatistics(
            completion_tokens=200,
            prompt_tokens=100,
            total_tokens=300,
        ),
        actor=default_user,
        project_id=sarah_agent.project_id,
    )

    # Get usage statistics (should return the latest entry)
    usage_stats = job_manager.get_job_usage(job_id=default_job.id, actor=default_user)

    # Verify we get the most recent statistics
    assert usage_stats.completion_tokens == 300
    assert usage_stats.prompt_tokens == 150
    assert usage_stats.total_tokens == 450
    assert usage_stats.step_count == 2

    # get steps
    steps = job_manager.get_job_steps(job_id=default_job.id, actor=default_user)
    assert len(steps) == 2

    # get agent steps
    steps = await step_manager.list_steps_async(agent_id=sarah_agent.id, actor=default_user)
    assert len(steps) == 2

    # add step feedback
    step_manager = server.step_manager

    # Add feedback to first step
    await step_manager.add_feedback_async(step_id=steps[0].id, feedback=FeedbackType.POSITIVE, actor=default_user)

    # Test has_feedback filtering
    steps_with_feedback = await step_manager.list_steps_async(agent_id=sarah_agent.id, has_feedback=True, actor=default_user)
    assert len(steps_with_feedback) == 1

    steps_without_feedback = await step_manager.list_steps_async(agent_id=sarah_agent.id, actor=default_user)
    assert len(steps_without_feedback) == 2


def test_job_usage_stats_get_nonexistent_job(server: SyncServer, default_user):
    """Test getting usage statistics for a nonexistent job."""
    job_manager = server.job_manager

    with pytest.raises(NoResultFound):
        job_manager.get_job_usage(job_id="nonexistent_job", actor=default_user)


def test_list_tags(server: SyncServer, default_user, default_organization):
    """Test listing tags functionality."""
    # Create multiple agents with different tags
    agents = []
    tags = ["alpha", "beta", "gamma", "delta", "epsilon"]

    # Create agents with different combinations of tags
    for i in range(3):
        agent = server.agent_manager.create_agent(
            actor=default_user,
            agent_create=CreateAgent(
                name="tag_agent_" + str(i),
                memory_blocks=[],
                llm_config=LLMConfig.default_config("gpt-4o-mini"),
                embedding_config=EmbeddingConfig.default_config(provider="openai"),
                tags=tags[i : i + 3],  # Each agent gets 3 consecutive tags
                include_base_tools=False,
            ),
        )
        agents.append(agent)

    # Test basic listing - should return all unique tags in alphabetical order
    all_tags = server.agent_manager.list_tags(actor=default_user)
    assert all_tags == sorted(tags[:5])  # All tags should be present and sorted

    # Test pagination with limit
    limited_tags = server.agent_manager.list_tags(actor=default_user, limit=2)
    assert limited_tags == tags[:2]  # Should return first 2 tags

    # Test pagination with cursor
    cursor_tags = server.agent_manager.list_tags(actor=default_user, after="beta")
    assert cursor_tags == ["delta", "epsilon", "gamma"]  # Tags after "beta"

    # Test text search
    search_tags = server.agent_manager.list_tags(actor=default_user, query_text="ta")
    assert search_tags == ["beta", "delta"]  # Only tags containing "ta"

    # Test with non-matching search
    no_match_tags = server.agent_manager.list_tags(actor=default_user, query_text="xyz")
    assert no_match_tags == []  # Should return empty list

    # Test with different organization
    other_org = server.organization_manager.create_organization(pydantic_org=PydanticOrganization(name="Other Org"))
    other_user = server.user_manager.create_user(PydanticUser(name="Other User", organization_id=other_org.id))

    # Other org's tags should be empty
    other_org_tags = server.agent_manager.list_tags(actor=other_user)
    assert other_org_tags == []

    # Cleanup
    for agent in agents:
        server.agent_manager.delete_agent(agent.id, actor=default_user)


# ======================================================================================================================
# LLMBatchManager Tests
# ======================================================================================================================


@pytest.mark.asyncio
async def test_create_and_get_batch_request(server, default_user, dummy_beta_message_batch, letta_batch_job, event_loop):
    batch = await server.batch_manager.create_llm_batch_job_async(
        llm_provider=ProviderType.anthropic,
        status=JobStatus.created,
        create_batch_response=dummy_beta_message_batch,
        actor=default_user,
        letta_batch_job_id=letta_batch_job.id,
    )
    assert batch.id.startswith("batch_req-")
    assert batch.create_batch_response == dummy_beta_message_batch
    fetched = await server.batch_manager.get_llm_batch_job_by_id_async(batch.id, actor=default_user)
    assert fetched.id == batch.id


@pytest.mark.asyncio
async def test_update_batch_status(server, default_user, dummy_beta_message_batch, letta_batch_job, event_loop):
    batch = await server.batch_manager.create_llm_batch_job_async(
        llm_provider=ProviderType.anthropic,
        status=JobStatus.created,
        create_batch_response=dummy_beta_message_batch,
        actor=default_user,
        letta_batch_job_id=letta_batch_job.id,
    )
    before = datetime.now(timezone.utc)

    await server.batch_manager.update_llm_batch_status_async(
        llm_batch_id=batch.id,
        status=JobStatus.completed,
        latest_polling_response=dummy_beta_message_batch,
        actor=default_user,
    )

    updated = await server.batch_manager.get_llm_batch_job_by_id_async(batch.id, actor=default_user)
    assert updated.status == JobStatus.completed
    assert updated.latest_polling_response == dummy_beta_message_batch

    # Handle timezone comparison: if last_polled_at is naive, assume it's UTC
    last_polled_at = updated.last_polled_at
    if last_polled_at.tzinfo is None:
        last_polled_at = last_polled_at.replace(tzinfo=timezone.utc)
    assert last_polled_at >= before


@pytest.mark.asyncio
async def test_create_and_get_batch_item(
    server, default_user, sarah_agent, dummy_beta_message_batch, dummy_llm_config, dummy_step_state, letta_batch_job, event_loop
):
    batch = await server.batch_manager.create_llm_batch_job_async(
        llm_provider=ProviderType.anthropic,
        status=JobStatus.created,
        create_batch_response=dummy_beta_message_batch,
        actor=default_user,
        letta_batch_job_id=letta_batch_job.id,
    )

    item = await server.batch_manager.create_llm_batch_item_async(
        llm_batch_id=batch.id,
        agent_id=sarah_agent.id,
        llm_config=dummy_llm_config,
        step_state=dummy_step_state,
        actor=default_user,
    )

    assert item.llm_batch_id == batch.id
    assert item.agent_id == sarah_agent.id
    assert item.step_state == dummy_step_state

    fetched = await server.batch_manager.get_llm_batch_item_by_id_async(item.id, actor=default_user)
    assert fetched.id == item.id


@pytest.mark.asyncio
async def test_update_batch_item(
    server,
    default_user,
    sarah_agent,
    dummy_beta_message_batch,
    dummy_llm_config,
    dummy_step_state,
    dummy_successful_response,
    letta_batch_job,
    event_loop,
):
    batch = await server.batch_manager.create_llm_batch_job_async(
        llm_provider=ProviderType.anthropic,
        status=JobStatus.created,
        create_batch_response=dummy_beta_message_batch,
        actor=default_user,
        letta_batch_job_id=letta_batch_job.id,
    )

    item = await server.batch_manager.create_llm_batch_item_async(
        llm_batch_id=batch.id,
        agent_id=sarah_agent.id,
        llm_config=dummy_llm_config,
        step_state=dummy_step_state,
        actor=default_user,
    )

    updated_step_state = AgentStepState(step_number=2, tool_rules_solver=dummy_step_state.tool_rules_solver)

    await server.batch_manager.update_llm_batch_item_async(
        item_id=item.id,
        request_status=JobStatus.completed,
        step_status=AgentStepStatus.resumed,
        llm_request_response=dummy_successful_response,
        step_state=updated_step_state,
        actor=default_user,
    )

    updated = await server.batch_manager.get_llm_batch_item_by_id_async(item.id, actor=default_user)
    assert updated.request_status == JobStatus.completed
    assert updated.batch_request_result == dummy_successful_response


@pytest.mark.asyncio
async def test_delete_batch_item(
    server, default_user, sarah_agent, dummy_beta_message_batch, dummy_llm_config, dummy_step_state, letta_batch_job, event_loop
):
    batch = await server.batch_manager.create_llm_batch_job_async(
        llm_provider=ProviderType.anthropic,
        status=JobStatus.created,
        create_batch_response=dummy_beta_message_batch,
        actor=default_user,
        letta_batch_job_id=letta_batch_job.id,
    )

    item = await server.batch_manager.create_llm_batch_item_async(
        llm_batch_id=batch.id,
        agent_id=sarah_agent.id,
        llm_config=dummy_llm_config,
        step_state=dummy_step_state,
        actor=default_user,
    )

    await server.batch_manager.delete_llm_batch_item_async(item_id=item.id, actor=default_user)

    with pytest.raises(NoResultFound):
        await server.batch_manager.get_llm_batch_item_by_id_async(item.id, actor=default_user)


@pytest.mark.asyncio
async def test_list_running_batches(server, default_user, dummy_beta_message_batch, letta_batch_job, event_loop):
    # Create recent running batches
    num_running = 3

    for _ in range(num_running):
        await server.batch_manager.create_llm_batch_job_async(
            llm_provider=ProviderType.anthropic,
            status=JobStatus.running,
            create_batch_response=dummy_beta_message_batch,
            actor=default_user,
            letta_batch_job_id=letta_batch_job.id,
        )

    # Should return at least one running batch (no time filter)
    running_batches = await server.batch_manager.list_running_llm_batches_async(actor=default_user)
    assert len(running_batches) == num_running
    assert all(batch.status == JobStatus.running for batch in running_batches)

    # Should return the same when filtering by recent 1 week
    recent_batches = await server.batch_manager.list_running_llm_batches_async(actor=default_user, weeks=1)
    assert len(recent_batches) == num_running
    assert all(batch.status == JobStatus.running for batch in recent_batches)

    # Handle timezone comparison: if created_at is naive, assume it's UTC
    cutoff_time = datetime.now(timezone.utc) - timedelta(weeks=1)
    assert all(
        (batch.created_at.replace(tzinfo=timezone.utc) if batch.created_at.tzinfo is None else batch.created_at) >= cutoff_time
        for batch in recent_batches
    )

    # Filter by size
    recent_batches = await server.batch_manager.list_running_llm_batches_async(actor=default_user, weeks=1, batch_size=2)
    assert len(recent_batches) == 2
    assert all(batch.status == JobStatus.running for batch in recent_batches)
    # Handle timezone comparison: if created_at is naive, assume it's UTC
    cutoff_time = datetime.now(timezone.utc) - timedelta(weeks=1)
    assert all(
        (batch.created_at.replace(tzinfo=timezone.utc) if batch.created_at.tzinfo is None else batch.created_at) >= cutoff_time
        for batch in recent_batches
    )

    # Should return nothing if filtering by a very small timeframe (e.g., 0 weeks)
    future_batches = await server.batch_manager.list_running_llm_batches_async(actor=default_user, weeks=0)
    assert len(future_batches) == 0


@pytest.mark.asyncio
async def test_bulk_update_batch_statuses(server, default_user, dummy_beta_message_batch, letta_batch_job, event_loop):
    batch = await server.batch_manager.create_llm_batch_job_async(
        llm_provider=ProviderType.anthropic,
        status=JobStatus.created,
        create_batch_response=dummy_beta_message_batch,
        actor=default_user,
        letta_batch_job_id=letta_batch_job.id,
    )

    await server.batch_manager.bulk_update_llm_batch_statuses_async([(batch.id, JobStatus.completed, dummy_beta_message_batch)])

    updated = await server.batch_manager.get_llm_batch_job_by_id_async(batch.id, actor=default_user)
    assert updated.status == JobStatus.completed
    assert updated.latest_polling_response == dummy_beta_message_batch


@pytest.mark.asyncio
async def test_bulk_update_batch_items_results_by_agent(
    server,
    default_user,
    sarah_agent,
    dummy_beta_message_batch,
    dummy_llm_config,
    dummy_step_state,
    dummy_successful_response,
    letta_batch_job,
    event_loop,
):
    batch = await server.batch_manager.create_llm_batch_job_async(
        llm_provider=ProviderType.anthropic,
        create_batch_response=dummy_beta_message_batch,
        actor=default_user,
        letta_batch_job_id=letta_batch_job.id,
    )
    item = await server.batch_manager.create_llm_batch_item_async(
        llm_batch_id=batch.id,
        agent_id=sarah_agent.id,
        llm_config=dummy_llm_config,
        step_state=dummy_step_state,
        actor=default_user,
    )

    await server.batch_manager.bulk_update_batch_llm_items_results_by_agent_async(
        [ItemUpdateInfo(batch.id, sarah_agent.id, JobStatus.completed, dummy_successful_response)]
    )

    updated = await server.batch_manager.get_llm_batch_item_by_id_async(item.id, actor=default_user)
    assert updated.request_status == JobStatus.completed
    assert updated.batch_request_result == dummy_successful_response


@pytest.mark.asyncio
async def test_bulk_update_batch_items_step_status_by_agent(
    server, default_user, sarah_agent, dummy_beta_message_batch, dummy_llm_config, dummy_step_state, letta_batch_job, event_loop
):
    batch = await server.batch_manager.create_llm_batch_job_async(
        llm_provider=ProviderType.anthropic,
        create_batch_response=dummy_beta_message_batch,
        actor=default_user,
        letta_batch_job_id=letta_batch_job.id,
    )
    item = await server.batch_manager.create_llm_batch_item_async(
        llm_batch_id=batch.id,
        agent_id=sarah_agent.id,
        llm_config=dummy_llm_config,
        step_state=dummy_step_state,
        actor=default_user,
    )

    await server.batch_manager.bulk_update_llm_batch_items_step_status_by_agent_async(
        [StepStatusUpdateInfo(batch.id, sarah_agent.id, AgentStepStatus.resumed)]
    )

    updated = await server.batch_manager.get_llm_batch_item_by_id_async(item.id, actor=default_user)
    assert updated.step_status == AgentStepStatus.resumed


@pytest.mark.asyncio
async def test_list_batch_items_limit_and_filter(
    server, default_user, sarah_agent, dummy_beta_message_batch, dummy_llm_config, dummy_step_state, letta_batch_job, event_loop
):
    batch = await server.batch_manager.create_llm_batch_job_async(
        llm_provider=ProviderType.anthropic,
        create_batch_response=dummy_beta_message_batch,
        actor=default_user,
        letta_batch_job_id=letta_batch_job.id,
    )

    for _ in range(3):
        await server.batch_manager.create_llm_batch_item_async(
            llm_batch_id=batch.id,
            agent_id=sarah_agent.id,
            llm_config=dummy_llm_config,
            step_state=dummy_step_state,
            actor=default_user,
        )

    all_items = await server.batch_manager.list_llm_batch_items_async(llm_batch_id=batch.id, actor=default_user)
    limited_items = await server.batch_manager.list_llm_batch_items_async(llm_batch_id=batch.id, limit=2, actor=default_user)

    assert len(all_items) >= 3
    assert len(limited_items) == 2


@pytest.mark.asyncio
async def test_list_batch_items_pagination(
    server, default_user, sarah_agent, dummy_beta_message_batch, dummy_llm_config, dummy_step_state, letta_batch_job, event_loop
):
    # Create a batch job.
    batch = await server.batch_manager.create_llm_batch_job_async(
        llm_provider=ProviderType.anthropic,
        create_batch_response=dummy_beta_message_batch,
        actor=default_user,
        letta_batch_job_id=letta_batch_job.id,
    )

    # Create 10 batch items.
    created_items = []
    for i in range(10):
        item = await server.batch_manager.create_llm_batch_item_async(
            llm_batch_id=batch.id,
            agent_id=sarah_agent.id,
            llm_config=dummy_llm_config,
            step_state=dummy_step_state,
            actor=default_user,
        )
        created_items.append(item)

    # Retrieve all items (without pagination).
    all_items = await server.batch_manager.list_llm_batch_items_async(llm_batch_id=batch.id, actor=default_user)
    assert len(all_items) >= 10, f"Expected at least 10 items, got {len(all_items)}"

    # Verify the items are ordered ascending by id (based on our implementation).
    sorted_ids = [item.id for item in sorted(all_items, key=lambda i: i.id)]
    retrieved_ids = [item.id for item in all_items]
    assert retrieved_ids == sorted_ids, "Batch items are not ordered in ascending order by id"

    # Choose a cursor: the id of the 5th item.
    cursor = all_items[4].id

    # Retrieve items after the cursor.
    paged_items = await server.batch_manager.list_llm_batch_items_async(llm_batch_id=batch.id, actor=default_user, after=cursor)

    # All returned items should have an id greater than the cursor.
    for item in paged_items:
        assert item.id > cursor, f"Item id {item.id} is not greater than the cursor {cursor}"

    # Count expected remaining items.
    # Find the index of the cursor in our sorted list.
    cursor_index = sorted_ids.index(cursor)
    expected_remaining = len(sorted_ids) - cursor_index - 1
    assert len(paged_items) == expected_remaining, f"Expected {expected_remaining} items after cursor, got {len(paged_items)}"

    # Test pagination with a limit.
    limit = 3
    limited_page = await server.batch_manager.list_llm_batch_items_async(
        llm_batch_id=batch.id, actor=default_user, after=cursor, limit=limit
    )
    # If more than 'limit' items remain, we should only get exactly 'limit' items.
    assert len(limited_page) == min(
        limit, expected_remaining
    ), f"Expected {min(limit, expected_remaining)} items with limit {limit}, got {len(limited_page)}"

    # Optional: Test with a cursor beyond the last item returns an empty list.
    last_cursor = sorted_ids[-1]
    empty_page = await server.batch_manager.list_llm_batch_items_async(llm_batch_id=batch.id, actor=default_user, after=last_cursor)
    assert empty_page == [], "Expected an empty list when cursor is after the last item"


@pytest.mark.asyncio
async def test_bulk_update_batch_items_request_status_by_agent(
    server, default_user, sarah_agent, dummy_beta_message_batch, dummy_llm_config, dummy_step_state, letta_batch_job, event_loop
):
    # Create a batch job
    batch = await server.batch_manager.create_llm_batch_job_async(
        llm_provider=ProviderType.anthropic,
        create_batch_response=dummy_beta_message_batch,
        actor=default_user,
        letta_batch_job_id=letta_batch_job.id,
    )

    # Create a batch item
    item = await server.batch_manager.create_llm_batch_item_async(
        llm_batch_id=batch.id,
        agent_id=sarah_agent.id,
        llm_config=dummy_llm_config,
        step_state=dummy_step_state,
        actor=default_user,
    )

    # Update the request status using the bulk update method
    await server.batch_manager.bulk_update_llm_batch_items_request_status_by_agent_async(
        [RequestStatusUpdateInfo(batch.id, sarah_agent.id, JobStatus.expired)]
    )

    # Verify the update was applied
    updated = await server.batch_manager.get_llm_batch_item_by_id_async(item.id, actor=default_user)
    assert updated.request_status == JobStatus.expired


@pytest.mark.asyncio
async def test_bulk_update_nonexistent_items_should_error(
    server,
    default_user,
    dummy_beta_message_batch,
    dummy_successful_response,
    letta_batch_job,
    event_loop,
):
    # Create a batch job
    batch = await server.batch_manager.create_llm_batch_job_async(
        llm_provider=ProviderType.anthropic,
        create_batch_response=dummy_beta_message_batch,
        actor=default_user,
        letta_batch_job_id=letta_batch_job.id,
    )

    nonexistent_pairs = [(batch.id, "nonexistent-agent-id")]
    nonexistent_updates = [{"request_status": JobStatus.expired}]
    expected_err_msg = (
        f"Cannot bulk-update batch items: no records for the following "
        f"(llm_batch_id, agent_id) pairs: {{('{batch.id}', 'nonexistent-agent-id')}}"
    )

    with pytest.raises(ValueError, match=re.escape(expected_err_msg)):
        await server.batch_manager.bulk_update_llm_batch_items_async(nonexistent_pairs, nonexistent_updates)

    with pytest.raises(ValueError, match=re.escape(expected_err_msg)):
        await server.batch_manager.bulk_update_batch_llm_items_results_by_agent_async(
            [ItemUpdateInfo(batch.id, "nonexistent-agent-id", JobStatus.expired, dummy_successful_response)]
        )

    with pytest.raises(ValueError, match=re.escape(expected_err_msg)):
        await server.batch_manager.bulk_update_llm_batch_items_step_status_by_agent_async(
            [StepStatusUpdateInfo(batch.id, "nonexistent-agent-id", AgentStepStatus.resumed)]
        )

    with pytest.raises(ValueError, match=re.escape(expected_err_msg)):
        await server.batch_manager.bulk_update_llm_batch_items_request_status_by_agent_async(
            [RequestStatusUpdateInfo(batch.id, "nonexistent-agent-id", JobStatus.expired)]
        )


@pytest.mark.asyncio
async def test_bulk_update_nonexistent_items(
    server, default_user, dummy_beta_message_batch, dummy_successful_response, letta_batch_job, event_loop
):
    # Create a batch job
    batch = await server.batch_manager.create_llm_batch_job_async(
        llm_provider=ProviderType.anthropic,
        create_batch_response=dummy_beta_message_batch,
        actor=default_user,
        letta_batch_job_id=letta_batch_job.id,
    )

    # Attempt to update non-existent items should not raise errors

    # Test with the direct bulk_update_llm_batch_items method
    nonexistent_pairs = [(batch.id, "nonexistent-agent-id")]
    nonexistent_updates = [{"request_status": JobStatus.expired}]

    # This should not raise an error, just silently skip non-existent items
    await server.batch_manager.bulk_update_llm_batch_items_async(nonexistent_pairs, nonexistent_updates, strict=False)

    # Test with higher-level methods
    # Results by agent
    await server.batch_manager.bulk_update_batch_llm_items_results_by_agent_async(
        [ItemUpdateInfo(batch.id, "nonexistent-agent-id", JobStatus.expired, dummy_successful_response)], strict=False
    )

    # Step status by agent
    await server.batch_manager.bulk_update_llm_batch_items_step_status_by_agent_async(
        [StepStatusUpdateInfo(batch.id, "nonexistent-agent-id", AgentStepStatus.resumed)], strict=False
    )

    # Request status by agent
    await server.batch_manager.bulk_update_llm_batch_items_request_status_by_agent_async(
        [RequestStatusUpdateInfo(batch.id, "nonexistent-agent-id", JobStatus.expired)], strict=False
    )


@pytest.mark.asyncio
async def test_create_batch_items_bulk(
    server, default_user, sarah_agent, dummy_beta_message_batch, dummy_llm_config, dummy_step_state, letta_batch_job, event_loop
):
    # Create a batch job
    llm_batch_job = await server.batch_manager.create_llm_batch_job_async(
        llm_provider=ProviderType.anthropic,
        create_batch_response=dummy_beta_message_batch,
        actor=default_user,
        letta_batch_job_id=letta_batch_job.id,
    )

    # Prepare data for multiple batch items
    batch_items = []
    agent_ids = [sarah_agent.id, sarah_agent.id, sarah_agent.id]  # Using the same agent for simplicity

    for agent_id in agent_ids:
        batch_item = LLMBatchItem(
            llm_batch_id=llm_batch_job.id,
            agent_id=agent_id,
            llm_config=dummy_llm_config,
            request_status=JobStatus.created,
            step_status=AgentStepStatus.paused,
            step_state=dummy_step_state,
        )
        batch_items.append(batch_item)

    # Call the bulk create function
    created_items = await server.batch_manager.create_llm_batch_items_bulk_async(batch_items, actor=default_user)

    # Verify the correct number of items were created
    assert len(created_items) == len(agent_ids)

    # Verify each item has expected properties
    for item in created_items:
        assert item.id.startswith("batch_item-")
        assert item.llm_batch_id == llm_batch_job.id
        assert item.agent_id in agent_ids
        assert item.llm_config == dummy_llm_config
        assert item.request_status == JobStatus.created
        assert item.step_status == AgentStepStatus.paused
        assert item.step_state == dummy_step_state

    # Verify items can be retrieved from the database
    all_items = await server.batch_manager.list_llm_batch_items_async(llm_batch_id=llm_batch_job.id, actor=default_user)
    assert len(all_items) >= len(agent_ids)

    # Verify the IDs of created items match what's in the database
    created_ids = [item.id for item in created_items]
    for item_id in created_ids:
        fetched = await server.batch_manager.get_llm_batch_item_by_id_async(item_id, actor=default_user)
        assert fetched.id in created_ids


@pytest.mark.asyncio
async def test_count_batch_items(
    server, default_user, sarah_agent, dummy_beta_message_batch, dummy_llm_config, dummy_step_state, letta_batch_job, event_loop
):
    # Create a batch job first.
    batch = await server.batch_manager.create_llm_batch_job_async(
        llm_provider=ProviderType.anthropic,
        status=JobStatus.created,
        create_batch_response=dummy_beta_message_batch,
        actor=default_user,
        letta_batch_job_id=letta_batch_job.id,
    )

    # Create a specific number of batch items for this batch.
    num_items = 5
    for _ in range(num_items):
        await server.batch_manager.create_llm_batch_item_async(
            llm_batch_id=batch.id,
            agent_id=sarah_agent.id,
            llm_config=dummy_llm_config,
            step_state=dummy_step_state,
            actor=default_user,
        )

    # Use the count_llm_batch_items method to count the items.
    count = await server.batch_manager.count_llm_batch_items_async(llm_batch_id=batch.id)

    # Assert that the count matches the expected number.
    assert count == num_items, f"Expected {num_items} items, got {count}"


# ======================================================================================================================
# MCPManager Tests
# ======================================================================================================================


@pytest.mark.asyncio
async def test_create_mcp_server(server, default_user, event_loop):
    from letta.schemas.mcp import MCPServer, MCPServerType, SSEServerConfig, StdioServerConfig
    from letta.settings import tool_settings

    if tool_settings.mcp_read_from_config:
        return

    # Test with a valid StdioServerConfig
    server_config = StdioServerConfig(
        server_name="test_server", type=MCPServerType.STDIO, command="echo 'test'", args=["arg1", "arg2"], env={"ENV1": "value1"}
    )
    mcp_server = MCPServer(server_name="test_server", server_type=MCPServerType.STDIO, stdio_config=server_config)
    created_server = await server.mcp_manager.create_or_update_mcp_server(mcp_server, actor=default_user)
    print(created_server)
    assert created_server.server_name == server_config.server_name
    assert created_server.server_type == server_config.type

    # Test with a valid SSEServerConfig
    mcp_server_name = "devin"
    server_url = "https://mcp.deepwiki.com/sse"
    sse_mcp_config = SSEServerConfig(server_name=mcp_server_name, server_url=server_url)
    mcp_sse_server = MCPServer(server_name=mcp_server_name, server_type=MCPServerType.SSE, server_url=server_url)
    created_server = await server.mcp_manager.create_or_update_mcp_server(mcp_sse_server, actor=default_user)
    print(created_server)
    assert created_server.server_name == mcp_server_name
    assert created_server.server_type == MCPServerType.SSE

    # list mcp servers
    servers = await server.mcp_manager.list_mcp_servers(actor=default_user)
    print(servers)
    assert len(servers) > 0, "No MCP servers found"

    # list tools from sse server
    tools = await server.mcp_manager.list_mcp_server_tools(created_server.server_name, actor=default_user)
    print(tools)

    # call a tool from the sse server
    tool_name = "ask_question"
    tool_args = {"repoName": "letta-ai/letta", "question": "What is the primary programming language of this repository?"}
    result = await server.mcp_manager.execute_mcp_server_tool(
        created_server.server_name, tool_name=tool_name, tool_args=tool_args, actor=default_user, environment_variables={}
    )
    print(result)

    # add a tool
    tool = await server.mcp_manager.add_tool_from_mcp_server(created_server.server_name, tool_name, actor=default_user)
    print(tool)
    assert tool.name == tool_name
    assert f"mcp:{created_server.server_name}" in tool.tags, f"Expected tag {f'mcp:{created_server.server_name}'}, got {tool.tags}"
    print("TAGS", tool.tags)


async def test_get_mcp_servers_by_ids(server, default_user, event_loop):
    from letta.schemas.mcp import MCPServer, MCPServerType, SSEServerConfig, StdioServerConfig
    from letta.settings import tool_settings

    if tool_settings.mcp_read_from_config:
        return

    # Create multiple MCP servers for testing
    servers_data = [
        {
            "name": "test_server_1",
            "config": StdioServerConfig(
                server_name="test_server_1", type=MCPServerType.STDIO, command="echo 'test1'", args=["arg1"], env={"ENV1": "value1"}
            ),
            "type": MCPServerType.STDIO,
        },
        {
            "name": "test_server_2",
            "config": SSEServerConfig(server_name="test_server_2", server_url="https://test2.example.com/sse"),
            "type": MCPServerType.SSE,
        },
        {
            "name": "test_server_3",
            "config": SSEServerConfig(server_name="test_server_3", server_url="https://test3.example.com/mcp"),
            "type": MCPServerType.STREAMABLE_HTTP,
        },
    ]

    created_servers = []
    for server_data in servers_data:
        if server_data["type"] == MCPServerType.STDIO:
            mcp_server = MCPServer(server_name=server_data["name"], server_type=server_data["type"], stdio_config=server_data["config"])
        else:
            mcp_server = MCPServer(
                server_name=server_data["name"], server_type=server_data["type"], server_url=server_data["config"].server_url
            )

        created = await server.mcp_manager.create_or_update_mcp_server(mcp_server, actor=default_user)
        created_servers.append(created)

    # Test fetching multiple servers by IDs
    server_ids = [s.id for s in created_servers]
    fetched_servers = await server.mcp_manager.get_mcp_servers_by_ids(server_ids, actor=default_user)

    assert len(fetched_servers) == len(created_servers)
    fetched_ids = {s.id for s in fetched_servers}
    expected_ids = {s.id for s in created_servers}
    assert fetched_ids == expected_ids

    # Test fetching subset of servers
    subset_ids = server_ids[:2]
    subset_servers = await server.mcp_manager.get_mcp_servers_by_ids(subset_ids, actor=default_user)
    assert len(subset_servers) == 2
    assert all(s.id in subset_ids for s in subset_servers)

    # Test fetching with empty list
    empty_result = await server.mcp_manager.get_mcp_servers_by_ids([], actor=default_user)
    assert empty_result == []

    # Test fetching with non-existent ID mixed with valid IDs
    mixed_ids = [server_ids[0], "non-existent-id", server_ids[1]]
    mixed_result = await server.mcp_manager.get_mcp_servers_by_ids(mixed_ids, actor=default_user)
    # Should only return the existing servers
    assert len(mixed_result) == 2
    assert all(s.id in server_ids for s in mixed_result)

    # Test that servers from different organizations are not returned
    # This would require creating another user/org, but for now we'll just verify
    # that the function respects the actor's organization
    all_servers = await server.mcp_manager.list_mcp_servers(actor=default_user)
    all_server_ids = [s.id for s in all_servers]
    bulk_fetched = await server.mcp_manager.get_mcp_servers_by_ids(all_server_ids, actor=default_user)

    # All fetched servers should belong to the same organization
    assert all(s.organization_id == default_user.organization_id for s in bulk_fetched)


# ======================================================================================================================
# FileAgent Tests
# ======================================================================================================================


@pytest.mark.asyncio
async def test_attach_creates_association(server, default_user, sarah_agent, default_file):
    assoc, closed_files = await server.file_agent_manager.attach_file(
        agent_id=sarah_agent.id,
        file_id=default_file.id,
        file_name=default_file.file_name,
        source_id=default_file.source_id,
        actor=default_user,
        visible_content="hello",
        max_files_open=sarah_agent.max_files_open,
    )

    assert assoc.agent_id == sarah_agent.id
    assert assoc.file_id == default_file.id
    assert assoc.is_open is True
    assert assoc.visible_content == "hello"

    sarah_agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    file_blocks = sarah_agent.memory.file_blocks
    assert len(file_blocks) == 1
    assert file_blocks[0].value == assoc.visible_content
    assert file_blocks[0].label == default_file.file_name


@pytest.mark.asyncio
async def test_attach_is_idempotent(server, default_user, sarah_agent, default_file):
    a1, closed_files = await server.file_agent_manager.attach_file(
        agent_id=sarah_agent.id,
        file_id=default_file.id,
        file_name=default_file.file_name,
        source_id=default_file.source_id,
        actor=default_user,
        visible_content="first",
        max_files_open=sarah_agent.max_files_open,
    )

    # second attach with different params
    a2, closed_files = await server.file_agent_manager.attach_file(
        agent_id=sarah_agent.id,
        file_id=default_file.id,
        file_name=default_file.file_name,
        source_id=default_file.source_id,
        actor=default_user,
        is_open=False,
        visible_content="second",
        max_files_open=sarah_agent.max_files_open,
    )

    assert a1.id == a2.id
    assert a2.is_open is False
    assert a2.visible_content == "second"

    sarah_agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    file_blocks = sarah_agent.memory.file_blocks
    assert len(file_blocks) == 1
    assert file_blocks[0].value == ""  # not open
    assert file_blocks[0].label == default_file.file_name


@pytest.mark.asyncio
async def test_update_file_agent(server, file_attachment, default_user):
    updated = await server.file_agent_manager.update_file_agent_by_id(
        agent_id=file_attachment.agent_id,
        file_id=file_attachment.file_id,
        actor=default_user,
        is_open=False,
        visible_content="updated",
    )
    assert updated.is_open is False
    assert updated.visible_content == "updated"


@pytest.mark.asyncio
async def test_update_file_agent_by_file_name(server, file_attachment, default_user):
    updated = await server.file_agent_manager.update_file_agent_by_name(
        agent_id=file_attachment.agent_id,
        file_name=file_attachment.file_name,
        actor=default_user,
        is_open=False,
        visible_content="updated",
    )
    assert updated.is_open is False
    assert updated.visible_content == "updated"
    assert updated.start_line is None  # start_line should default to None
    assert updated.end_line is None  # end_line should default to None


@pytest.mark.asyncio
async def test_file_agent_line_tracking(server, default_user, sarah_agent, default_source):
    """Test that line information is captured when opening files with line ranges"""
    from letta.schemas.file import FileMetadata as PydanticFileMetadata

    # Create a test file with multiple lines
    test_content = "line 1\nline 2\nline 3\nline 4\nline 5"
    file_metadata = PydanticFileMetadata(
        file_name="test_lines.txt",
        organization_id=default_user.organization_id,
        source_id=default_source.id,
    )
    file = await server.file_manager.create_file(file_metadata=file_metadata, actor=default_user, text=test_content)

    # Test opening with line range using enforce_max_open_files_and_open
    closed_files, was_already_open, previous_ranges = await server.file_agent_manager.enforce_max_open_files_and_open(
        agent_id=sarah_agent.id,
        file_id=file.id,
        file_name=file.file_name,
        source_id=file.source_id,
        actor=default_user,
        visible_content="2: line 2\n3: line 3",
        max_files_open=sarah_agent.max_files_open,
        start_line=2,  # 1-indexed
        end_line=4,  # exclusive
    )

    # Retrieve and verify line tracking
    retrieved = await server.file_agent_manager.get_file_agent_by_id(
        agent_id=sarah_agent.id,
        file_id=file.id,
        actor=default_user,
    )

    assert retrieved.start_line == 2
    assert retrieved.end_line == 4
    assert previous_ranges == {}  # No previous range since it wasn't open before

    # Test opening without line range - should clear line info and capture previous range
    closed_files, was_already_open, previous_ranges = await server.file_agent_manager.enforce_max_open_files_and_open(
        agent_id=sarah_agent.id,
        file_id=file.id,
        file_name=file.file_name,
        source_id=file.source_id,
        actor=default_user,
        visible_content="full file content",
        max_files_open=sarah_agent.max_files_open,
        start_line=None,
        end_line=None,
    )

    # Retrieve and verify line info is cleared
    retrieved = await server.file_agent_manager.get_file_agent_by_id(
        agent_id=sarah_agent.id,
        file_id=file.id,
        actor=default_user,
    )

    assert retrieved.start_line is None
    assert retrieved.end_line is None
    assert previous_ranges == {file.file_name: (2, 4)}  # Should capture the previous range


@pytest.mark.asyncio
async def test_mark_access(server, file_attachment, default_user):
    old_ts = file_attachment.last_accessed_at
    if USING_SQLITE:
        time.sleep(CREATE_DELAY_SQLITE)
    else:
        await asyncio.sleep(0.01)

    await server.file_agent_manager.mark_access(
        agent_id=file_attachment.agent_id,
        file_id=file_attachment.file_id,
        actor=default_user,
    )
    refreshed = await server.file_agent_manager.get_file_agent_by_id(
        agent_id=file_attachment.agent_id,
        file_id=file_attachment.file_id,
        actor=default_user,
    )
    assert refreshed.last_accessed_at > old_ts


@pytest.mark.asyncio
async def test_list_files_and_agents(
    server,
    default_user,
    sarah_agent,
    charles_agent,
    default_file,
    another_file,
):
    # default_file ↔ charles  (open)
    await server.file_agent_manager.attach_file(
        agent_id=charles_agent.id,
        file_id=default_file.id,
        file_name=default_file.file_name,
        source_id=default_file.source_id,
        actor=default_user,
        max_files_open=charles_agent.max_files_open,
    )
    # default_file ↔ sarah    (open)
    await server.file_agent_manager.attach_file(
        agent_id=sarah_agent.id,
        file_id=default_file.id,
        file_name=default_file.file_name,
        source_id=default_file.source_id,
        actor=default_user,
        max_files_open=sarah_agent.max_files_open,
    )
    # another_file ↔ sarah    (closed)
    await server.file_agent_manager.attach_file(
        agent_id=sarah_agent.id,
        file_id=another_file.id,
        file_name=another_file.file_name,
        source_id=another_file.source_id,
        actor=default_user,
        is_open=False,
        max_files_open=sarah_agent.max_files_open,
    )

    files_for_sarah = await server.file_agent_manager.list_files_for_agent(
        sarah_agent.id, per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit, actor=default_user
    )
    assert {f.file_id for f in files_for_sarah} == {default_file.id, another_file.id}

    open_only = await server.file_agent_manager.list_files_for_agent(
        sarah_agent.id, per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit, actor=default_user, is_open_only=True
    )
    assert {f.file_id for f in open_only} == {default_file.id}

    agents_for_default = await server.file_agent_manager.list_agents_for_file(default_file.id, actor=default_user)
    assert {a.agent_id for a in agents_for_default} == {sarah_agent.id, charles_agent.id}

    sarah_agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    file_blocks = sarah_agent.memory.file_blocks
    assert len(file_blocks) == 2
    charles_agent = await server.agent_manager.get_agent_by_id_async(agent_id=charles_agent.id, actor=default_user)
    file_blocks = charles_agent.memory.file_blocks
    assert len(file_blocks) == 1
    assert file_blocks[0].value == ""
    assert file_blocks[0].label == default_file.file_name


@pytest.mark.asyncio
async def test_detach_file(server, file_attachment, default_user):
    await server.file_agent_manager.detach_file(
        agent_id=file_attachment.agent_id,
        file_id=file_attachment.file_id,
        actor=default_user,
    )
    res = await server.file_agent_manager.get_file_agent_by_id(
        agent_id=file_attachment.agent_id,
        file_id=file_attachment.file_id,
        actor=default_user,
    )
    assert res is None


@pytest.mark.asyncio
async def test_detach_file_bulk(
    server,
    default_user,
    sarah_agent,
    charles_agent,
    default_source,
):
    """Test bulk deletion of multiple agent-file associations."""
    # Create multiple files
    files = []
    for i in range(3):
        file_metadata = PydanticFileMetadata(
            file_name=f"test_file_{i}.txt",
            source_id=default_source.id,
            organization_id=default_user.organization_id,
        )
        file = await server.file_manager.create_file(file_metadata, actor=default_user)
        files.append(file)

    # Attach all files to both agents
    for file in files:
        await server.file_agent_manager.attach_file(
            agent_id=sarah_agent.id,
            file_id=file.id,
            file_name=file.file_name,
            source_id=file.source_id,
            actor=default_user,
            max_files_open=sarah_agent.max_files_open,
        )
        await server.file_agent_manager.attach_file(
            agent_id=charles_agent.id,
            file_id=file.id,
            file_name=file.file_name,
            source_id=file.source_id,
            actor=default_user,
            max_files_open=charles_agent.max_files_open,
        )

    # Verify all files are attached to both agents
    sarah_files = await server.file_agent_manager.list_files_for_agent(
        sarah_agent.id, per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit, actor=default_user
    )
    charles_files = await server.file_agent_manager.list_files_for_agent(
        charles_agent.id, per_file_view_window_char_limit=charles_agent.per_file_view_window_char_limit, actor=default_user
    )
    assert len(sarah_files) == 3
    assert len(charles_files) == 3

    # Test 1: Bulk delete specific files from specific agents
    agent_file_pairs = [
        (sarah_agent.id, files[0].id),  # Remove file 0 from sarah
        (sarah_agent.id, files[1].id),  # Remove file 1 from sarah
        (charles_agent.id, files[1].id),  # Remove file 1 from charles
    ]

    deleted_count = await server.file_agent_manager.detach_file_bulk(agent_file_pairs=agent_file_pairs, actor=default_user)
    assert deleted_count == 3

    # Verify the correct files were deleted
    sarah_files = await server.file_agent_manager.list_files_for_agent(
        sarah_agent.id, per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit, actor=default_user
    )
    charles_files = await server.file_agent_manager.list_files_for_agent(
        charles_agent.id, per_file_view_window_char_limit=charles_agent.per_file_view_window_char_limit, actor=default_user
    )

    # Sarah should only have file 2 left
    assert len(sarah_files) == 1
    assert sarah_files[0].file_id == files[2].id

    # Charles should have files 0 and 2 left
    assert len(charles_files) == 2
    charles_file_ids = {f.file_id for f in charles_files}
    assert charles_file_ids == {files[0].id, files[2].id}

    # Test 2: Empty list should return 0 and not fail
    deleted_count = await server.file_agent_manager.detach_file_bulk(agent_file_pairs=[], actor=default_user)
    assert deleted_count == 0

    # Test 3: Attempting to delete already deleted associations should return 0
    agent_file_pairs = [
        (sarah_agent.id, files[0].id),  # Already deleted
        (sarah_agent.id, files[1].id),  # Already deleted
    ]
    deleted_count = await server.file_agent_manager.detach_file_bulk(agent_file_pairs=agent_file_pairs, actor=default_user)
    assert deleted_count == 0


@pytest.mark.asyncio
async def test_org_scoping(
    server,
    default_user,
    other_user_different_org,
    sarah_agent,
    default_file,
):
    # attach as default_user
    await server.file_agent_manager.attach_file(
        agent_id=sarah_agent.id,
        file_id=default_file.id,
        file_name=default_file.file_name,
        source_id=default_file.source_id,
        actor=default_user,
        max_files_open=sarah_agent.max_files_open,
    )

    # other org should see nothing
    files = await server.file_agent_manager.list_files_for_agent(
        sarah_agent.id, per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit, actor=other_user_different_org
    )
    assert files == []


# ======================================================================================================================
# LRU File Management Tests
# ======================================================================================================================


@pytest.mark.asyncio
async def test_mark_access_bulk(server, default_user, sarah_agent, default_source):
    """Test that mark_access_bulk updates last_accessed_at for multiple files."""
    import time

    # Create multiple files and attach them
    files = []
    for i in range(3):
        file_metadata = PydanticFileMetadata(
            file_name=f"test_file_{i}.txt",
            organization_id=default_user.organization_id,
            source_id=default_source.id,
        )
        file = await server.file_manager.create_file(file_metadata=file_metadata, actor=default_user, text=f"test content {i}")
        files.append(file)

    # Attach all files (they'll be open by default)
    attached_files = []
    for file in files:
        file_agent, closed_files = await server.file_agent_manager.attach_file(
            agent_id=sarah_agent.id,
            file_id=file.id,
            file_name=file.file_name,
            source_id=file.source_id,
            actor=default_user,
            visible_content=f"content for {file.file_name}",
            max_files_open=sarah_agent.max_files_open,
        )
        attached_files.append(file_agent)

    # Get initial timestamps
    initial_times = {}
    for file_agent in attached_files:
        fa = await server.file_agent_manager.get_file_agent_by_id(agent_id=sarah_agent.id, file_id=file_agent.file_id, actor=default_user)
        initial_times[fa.file_name] = fa.last_accessed_at

    # Wait a moment to ensure timestamp difference
    time.sleep(1.1)

    # Use mark_access_bulk on subset of files
    file_names_to_mark = [files[0].file_name, files[2].file_name]
    await server.file_agent_manager.mark_access_bulk(agent_id=sarah_agent.id, file_names=file_names_to_mark, actor=default_user)

    # Check that only marked files have updated timestamps
    for i, file in enumerate(files):
        fa = await server.file_agent_manager.get_file_agent_by_id(agent_id=sarah_agent.id, file_id=file.id, actor=default_user)

        if file.file_name in file_names_to_mark:
            assert fa.last_accessed_at > initial_times[file.file_name], f"File {file.file_name} should have updated timestamp"
        else:
            assert fa.last_accessed_at == initial_times[file.file_name], f"File {file.file_name} should not have updated timestamp"


@pytest.mark.asyncio
async def test_lru_eviction_on_attach(server, default_user, sarah_agent, default_source):
    """Test that attaching files beyond max_files_open triggers LRU eviction."""
    import time

    # Use the agent's configured max_files_open
    max_files_open = sarah_agent.max_files_open

    # Create more files than the limit
    files = []
    for i in range(max_files_open + 2):  # e.g., 7 files for max_files_open=5
        file_metadata = PydanticFileMetadata(
            file_name=f"lru_test_file_{i}.txt",
            organization_id=default_user.organization_id,
            source_id=default_source.id,
        )
        file = await server.file_manager.create_file(file_metadata=file_metadata, actor=default_user, text=f"test content {i}")
        files.append(file)

    # Attach files one by one with small delays to ensure different timestamps
    attached_files = []
    all_closed_files = []

    for i, file in enumerate(files):
        if i > 0:
            time.sleep(0.1)  # Small delay to ensure different timestamps

        file_agent, closed_files = await server.file_agent_manager.attach_file(
            agent_id=sarah_agent.id,
            file_id=file.id,
            file_name=file.file_name,
            source_id=file.source_id,
            actor=default_user,
            visible_content=f"content for {file.file_name}",
            max_files_open=sarah_agent.max_files_open,
        )
        attached_files.append(file_agent)
        all_closed_files.extend(closed_files)

        # Check that we never exceed max_files_open
        open_files = await server.file_agent_manager.list_files_for_agent(
            sarah_agent.id,
            per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit,
            actor=default_user,
            is_open_only=True,
        )
        assert len(open_files) <= max_files_open, f"Should never exceed {max_files_open} open files"

    # Should have closed exactly 2 files (e.g., 7 - 5 = 2 for max_files_open=5)
    expected_closed_count = len(files) - max_files_open
    assert (
        len(all_closed_files) == expected_closed_count
    ), f"Should have closed {expected_closed_count} files, but closed: {all_closed_files}"

    # Check that the oldest files were closed (first N files attached)
    expected_closed = [files[i].file_name for i in range(expected_closed_count)]
    assert set(all_closed_files) == set(expected_closed), f"Wrong files closed. Expected {expected_closed}, got {all_closed_files}"

    # Check that exactly max_files_open files are open
    open_files = await server.file_agent_manager.list_files_for_agent(
        sarah_agent.id, per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit, actor=default_user, is_open_only=True
    )
    assert len(open_files) == max_files_open

    # Check that the most recently attached files are still open
    open_file_names = {f.file_name for f in open_files}
    expected_open = {files[i].file_name for i in range(expected_closed_count, len(files))}  # last max_files_open files
    assert open_file_names == expected_open


@pytest.mark.asyncio
async def test_lru_eviction_on_open_file(server, default_user, sarah_agent, default_source):
    """Test that opening a file beyond max_files_open triggers LRU eviction."""
    import time

    max_files_open = sarah_agent.max_files_open

    # Create files equal to the limit
    files = []
    for i in range(max_files_open + 1):  # 6 files for max_files_open=5
        file_metadata = PydanticFileMetadata(
            file_name=f"open_test_file_{i}.txt",
            organization_id=default_user.organization_id,
            source_id=default_source.id,
        )
        file = await server.file_manager.create_file(file_metadata=file_metadata, actor=default_user, text=f"test content {i}")
        files.append(file)

    # Attach first max_files_open files
    for i in range(max_files_open):
        time.sleep(0.1)  # Small delay for different timestamps
        await server.file_agent_manager.attach_file(
            agent_id=sarah_agent.id,
            file_id=files[i].id,
            file_name=files[i].file_name,
            source_id=files[i].source_id,
            actor=default_user,
            visible_content=f"content for {files[i].file_name}",
            max_files_open=sarah_agent.max_files_open,
        )

    # Attach the last file as closed
    await server.file_agent_manager.attach_file(
        agent_id=sarah_agent.id,
        file_id=files[-1].id,
        file_name=files[-1].file_name,
        source_id=files[-1].source_id,
        actor=default_user,
        is_open=False,
        visible_content=f"content for {files[-1].file_name}",
        max_files_open=sarah_agent.max_files_open,
    )

    # All files should be attached but only max_files_open should be open
    all_files = await server.file_agent_manager.list_files_for_agent(
        sarah_agent.id, per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit, actor=default_user
    )
    open_files = await server.file_agent_manager.list_files_for_agent(
        sarah_agent.id, per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit, actor=default_user, is_open_only=True
    )
    assert len(all_files) == max_files_open + 1
    assert len(open_files) == max_files_open

    # Wait a moment
    time.sleep(0.1)

    # Now "open" the last file using the efficient method
    closed_files, was_already_open, _ = await server.file_agent_manager.enforce_max_open_files_and_open(
        agent_id=sarah_agent.id,
        file_id=files[-1].id,
        file_name=files[-1].file_name,
        source_id=files[-1].source_id,
        actor=default_user,
        visible_content="updated content",
        max_files_open=sarah_agent.max_files_open,
    )

    # Should have closed 1 file (the oldest one)
    assert len(closed_files) == 1, f"Should have closed 1 file, got: {closed_files}"
    assert closed_files[0] == files[0].file_name, f"Should have closed oldest file {files[0].file_name}"

    # Check that exactly max_files_open files are still open
    open_files = await server.file_agent_manager.list_files_for_agent(
        sarah_agent.id, per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit, actor=default_user, is_open_only=True
    )
    assert len(open_files) == max_files_open

    # Check that the newly opened file is open and the oldest is closed
    last_file_agent = await server.file_agent_manager.get_file_agent_by_id(
        agent_id=sarah_agent.id, file_id=files[-1].id, actor=default_user
    )
    first_file_agent = await server.file_agent_manager.get_file_agent_by_id(
        agent_id=sarah_agent.id, file_id=files[0].id, actor=default_user
    )

    assert last_file_agent.is_open is True, "Last file should be open"
    assert first_file_agent.is_open is False, "First file should be closed"


@pytest.mark.asyncio
async def test_lru_no_eviction_when_reopening_same_file(server, default_user, sarah_agent, default_source):
    """Test that reopening an already open file doesn't trigger unnecessary eviction."""
    import time

    max_files_open = sarah_agent.max_files_open

    # Create files equal to the limit
    files = []
    for i in range(max_files_open):
        file_metadata = PydanticFileMetadata(
            file_name=f"reopen_test_file_{i}.txt",
            organization_id=default_user.organization_id,
            source_id=default_source.id,
        )
        file = await server.file_manager.create_file(file_metadata=file_metadata, actor=default_user, text=f"test content {i}")
        files.append(file)

    # Attach all files (they'll be open)
    for i, file in enumerate(files):
        time.sleep(0.1)  # Small delay for different timestamps
        await server.file_agent_manager.attach_file(
            agent_id=sarah_agent.id,
            file_id=file.id,
            file_name=file.file_name,
            source_id=file.source_id,
            actor=default_user,
            visible_content=f"content for {file.file_name}",
            max_files_open=sarah_agent.max_files_open,
        )

    # All files should be open
    open_files = await server.file_agent_manager.list_files_for_agent(
        sarah_agent.id, per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit, actor=default_user, is_open_only=True
    )
    assert len(open_files) == max_files_open
    initial_open_names = {f.file_name for f in open_files}

    # Wait a moment
    time.sleep(0.1)

    # "Reopen" the last file (which is already open)
    closed_files, was_already_open, _ = await server.file_agent_manager.enforce_max_open_files_and_open(
        agent_id=sarah_agent.id,
        file_id=files[-1].id,
        file_name=files[-1].file_name,
        source_id=files[-1].source_id,
        actor=default_user,
        visible_content="updated content",
        max_files_open=sarah_agent.max_files_open,
    )

    # Should not have closed any files since we're within the limit
    assert len(closed_files) == 0, f"Should not have closed any files when reopening, got: {closed_files}"
    assert was_already_open is True, "File should have been detected as already open"

    # All the same files should still be open
    open_files = await server.file_agent_manager.list_files_for_agent(
        sarah_agent.id, per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit, actor=default_user, is_open_only=True
    )
    assert len(open_files) == max_files_open
    final_open_names = {f.file_name for f in open_files}
    assert initial_open_names == final_open_names, "Same files should remain open"


@pytest.mark.asyncio
async def test_last_accessed_at_updates_correctly(server, default_user, sarah_agent, default_source):
    """Test that last_accessed_at is updated in the correct scenarios."""
    import time

    # Create and attach a file
    file_metadata = PydanticFileMetadata(
        file_name="timestamp_test.txt",
        organization_id=default_user.organization_id,
        source_id=default_source.id,
    )
    file = await server.file_manager.create_file(file_metadata=file_metadata, actor=default_user, text="test content")

    file_agent, closed_files = await server.file_agent_manager.attach_file(
        agent_id=sarah_agent.id,
        file_id=file.id,
        file_name=file.file_name,
        source_id=file.source_id,
        actor=default_user,
        visible_content="initial content",
        max_files_open=sarah_agent.max_files_open,
    )

    initial_time = file_agent.last_accessed_at
    time.sleep(1.1)

    # Test update_file_agent_by_id updates timestamp
    updated_agent = await server.file_agent_manager.update_file_agent_by_id(
        agent_id=sarah_agent.id, file_id=file.id, actor=default_user, visible_content="updated content"
    )
    assert updated_agent.last_accessed_at > initial_time, "update_file_agent_by_id should update timestamp"

    time.sleep(1.1)
    prev_time = updated_agent.last_accessed_at

    # Test update_file_agent_by_name updates timestamp
    updated_agent2 = await server.file_agent_manager.update_file_agent_by_name(
        agent_id=sarah_agent.id, file_name=file.file_name, actor=default_user, is_open=False
    )
    assert updated_agent2.last_accessed_at > prev_time, "update_file_agent_by_name should update timestamp"

    time.sleep(1.1)
    prev_time = updated_agent2.last_accessed_at

    # Test mark_access updates timestamp
    await server.file_agent_manager.mark_access(agent_id=sarah_agent.id, file_id=file.id, actor=default_user)

    final_agent = await server.file_agent_manager.get_file_agent_by_id(agent_id=sarah_agent.id, file_id=file.id, actor=default_user)
    assert final_agent.last_accessed_at > prev_time, "mark_access should update timestamp"


@pytest.mark.asyncio
async def test_attach_files_bulk_basic(server, default_user, sarah_agent, default_source):
    """Test basic functionality of attach_files_bulk method."""
    # Create multiple files
    files = []
    for i in range(3):
        file_metadata = PydanticFileMetadata(
            file_name=f"bulk_test_{i}.txt",
            organization_id=default_user.organization_id,
            source_id=default_source.id,
        )
        file = await server.file_manager.create_file(file_metadata=file_metadata, actor=default_user, text=f"content {i}")
        files.append(file)

    # Create visible content map
    visible_content_map = {f"bulk_test_{i}.txt": f"visible content {i}" for i in range(3)}

    # Bulk attach files
    closed_files = await server.file_agent_manager.attach_files_bulk(
        agent_id=sarah_agent.id,
        files_metadata=files,
        visible_content_map=visible_content_map,
        actor=default_user,
        max_files_open=sarah_agent.max_files_open,
    )

    # Should not close any files since we're under the limit
    assert closed_files == []

    # Verify all files are attached and open
    attached_files = await server.file_agent_manager.list_files_for_agent(
        sarah_agent.id, per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit, actor=default_user, is_open_only=True
    )
    assert len(attached_files) == 3

    attached_file_names = {f.file_name for f in attached_files}
    expected_names = {f"bulk_test_{i}.txt" for i in range(3)}
    assert attached_file_names == expected_names

    # Verify visible content is set correctly
    for i, attached_file in enumerate(attached_files):
        if attached_file.file_name == f"bulk_test_{i}.txt":
            assert attached_file.visible_content == f"visible content {i}"


@pytest.mark.asyncio
async def test_attach_files_bulk_deduplication(server, default_user, sarah_agent, default_source):
    """Test that attach_files_bulk properly deduplicates files with same names."""
    # Create files with same name (different IDs)
    file_metadata_1 = PydanticFileMetadata(
        file_name="duplicate_test.txt",
        organization_id=default_user.organization_id,
        source_id=default_source.id,
    )
    file1 = await server.file_manager.create_file(file_metadata=file_metadata_1, actor=default_user, text="content 1")

    file_metadata_2 = PydanticFileMetadata(
        file_name="duplicate_test.txt",
        organization_id=default_user.organization_id,
        source_id=default_source.id,
    )
    file2 = await server.file_manager.create_file(file_metadata=file_metadata_2, actor=default_user, text="content 2")

    # Try to attach both files (same name, different IDs)
    files_to_attach = [file1, file2]
    visible_content_map = {"duplicate_test.txt": "visible content"}

    # Bulk attach should deduplicate
    closed_files = await server.file_agent_manager.attach_files_bulk(
        agent_id=sarah_agent.id,
        files_metadata=files_to_attach,
        visible_content_map=visible_content_map,
        actor=default_user,
        max_files_open=sarah_agent.max_files_open,
    )

    # Should only attach one file (deduplicated)
    attached_files = await server.file_agent_manager.list_files_for_agent(
        sarah_agent.id, per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit, actor=default_user
    )
    assert len(attached_files) == 1
    assert attached_files[0].file_name == "duplicate_test.txt"


@pytest.mark.asyncio
async def test_attach_files_bulk_lru_eviction(server, default_user, sarah_agent, default_source):
    """Test that attach_files_bulk properly handles LRU eviction without duplicates."""
    import time

    max_files_open = sarah_agent.max_files_open

    # First, fill up to the max with individual files
    existing_files = []
    for i in range(max_files_open):
        file_metadata = PydanticFileMetadata(
            file_name=f"existing_{i}.txt",
            organization_id=default_user.organization_id,
            source_id=default_source.id,
        )
        file = await server.file_manager.create_file(file_metadata=file_metadata, actor=default_user, text=f"existing {i}")
        existing_files.append(file)

        time.sleep(0.05)  # Small delay for different timestamps
        await server.file_agent_manager.attach_file(
            agent_id=sarah_agent.id,
            file_id=file.id,
            file_name=file.file_name,
            source_id=file.source_id,
            actor=default_user,
            visible_content=f"existing content {i}",
            max_files_open=sarah_agent.max_files_open,
        )

    # Verify we're at the limit
    open_files = await server.file_agent_manager.list_files_for_agent(
        sarah_agent.id, per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit, actor=default_user, is_open_only=True
    )
    assert len(open_files) == max_files_open

    # Now bulk attach 3 new files (should trigger LRU eviction)
    new_files = []
    for i in range(3):
        file_metadata = PydanticFileMetadata(
            file_name=f"new_bulk_{i}.txt",
            organization_id=default_user.organization_id,
            source_id=default_source.id,
        )
        file = await server.file_manager.create_file(file_metadata=file_metadata, actor=default_user, text=f"new content {i}")
        new_files.append(file)

    visible_content_map = {f"new_bulk_{i}.txt": f"new visible {i}" for i in range(3)}

    # Bulk attach should evict oldest files
    closed_files = await server.file_agent_manager.attach_files_bulk(
        agent_id=sarah_agent.id,
        files_metadata=new_files,
        visible_content_map=visible_content_map,
        actor=default_user,
        max_files_open=sarah_agent.max_files_open,
    )

    # Should have closed exactly 3 files (oldest ones)
    assert len(closed_files) == 3

    # CRITICAL: Verify no duplicates in closed_files list
    assert len(closed_files) == len(set(closed_files)), f"Duplicate file names in closed_files: {closed_files}"

    # Verify expected files were closed (oldest 3)
    expected_closed = {f"existing_{i}.txt" for i in range(3)}
    actual_closed = set(closed_files)
    assert actual_closed == expected_closed

    # Verify we still have exactly max_files_open files open
    open_files_after = await server.file_agent_manager.list_files_for_agent(
        sarah_agent.id, per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit, actor=default_user, is_open_only=True
    )
    assert len(open_files_after) == max_files_open

    # Verify the new files are open
    open_file_names = {f.file_name for f in open_files_after}
    for i in range(3):
        assert f"new_bulk_{i}.txt" in open_file_names


@pytest.mark.asyncio
async def test_attach_files_bulk_mixed_existing_new(server, default_user, sarah_agent, default_source):
    """Test bulk attach with mix of existing and new files."""
    # Create and attach one file individually first
    existing_file_metadata = PydanticFileMetadata(
        file_name="existing_file.txt",
        organization_id=default_user.organization_id,
        source_id=default_source.id,
    )
    existing_file = await server.file_manager.create_file(file_metadata=existing_file_metadata, actor=default_user, text="existing")

    await server.file_agent_manager.attach_file(
        agent_id=sarah_agent.id,
        file_id=existing_file.id,
        file_name=existing_file.file_name,
        source_id=existing_file.source_id,
        actor=default_user,
        visible_content="old content",
        is_open=False,  # Start as closed
        max_files_open=sarah_agent.max_files_open,
    )

    # Create new files
    new_files = []
    for i in range(2):
        file_metadata = PydanticFileMetadata(
            file_name=f"new_file_{i}.txt",
            organization_id=default_user.organization_id,
            source_id=default_source.id,
        )
        file = await server.file_manager.create_file(file_metadata=file_metadata, actor=default_user, text=f"new {i}")
        new_files.append(file)

    # Bulk attach: existing file + new files
    files_to_attach = [existing_file] + new_files
    visible_content_map = {
        "existing_file.txt": "updated content",
        "new_file_0.txt": "new content 0",
        "new_file_1.txt": "new content 1",
    }

    closed_files = await server.file_agent_manager.attach_files_bulk(
        agent_id=sarah_agent.id,
        files_metadata=files_to_attach,
        visible_content_map=visible_content_map,
        actor=default_user,
        max_files_open=sarah_agent.max_files_open,
    )

    # Should not close any files
    assert closed_files == []

    # Verify all files are now open
    open_files = await server.file_agent_manager.list_files_for_agent(
        sarah_agent.id, per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit, actor=default_user, is_open_only=True
    )
    assert len(open_files) == 3

    # Verify existing file was updated
    existing_file_agent = await server.file_agent_manager.get_file_agent_by_file_name(
        agent_id=sarah_agent.id, file_name="existing_file.txt", actor=default_user
    )
    assert existing_file_agent.is_open is True
    assert existing_file_agent.visible_content == "updated content"


@pytest.mark.asyncio
async def test_attach_files_bulk_empty_list(server, default_user, sarah_agent):
    """Test attach_files_bulk with empty file list."""
    closed_files = await server.file_agent_manager.attach_files_bulk(
        agent_id=sarah_agent.id, files_metadata=[], visible_content_map={}, actor=default_user, max_files_open=sarah_agent.max_files_open
    )

    assert closed_files == []

    # Verify no files are attached
    attached_files = await server.file_agent_manager.list_files_for_agent(
        sarah_agent.id, per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit, actor=default_user
    )
    assert len(attached_files) == 0


@pytest.mark.asyncio
async def test_attach_files_bulk_oversized_bulk(server, default_user, sarah_agent, default_source):
    """Test bulk attach when trying to attach more files than max_files_open allows."""
    max_files_open = sarah_agent.max_files_open

    # Create more files than the limit allows
    oversized_files = []
    for i in range(max_files_open + 3):  # 3 more than limit
        file_metadata = PydanticFileMetadata(
            file_name=f"oversized_{i}.txt",
            organization_id=default_user.organization_id,
            source_id=default_source.id,
        )
        file = await server.file_manager.create_file(file_metadata=file_metadata, actor=default_user, text=f"oversized {i}")
        oversized_files.append(file)

    visible_content_map = {f"oversized_{i}.txt": f"oversized visible {i}" for i in range(max_files_open + 3)}

    # Bulk attach all files (more than limit)
    closed_files = await server.file_agent_manager.attach_files_bulk(
        agent_id=sarah_agent.id,
        files_metadata=oversized_files,
        visible_content_map=visible_content_map,
        actor=default_user,
        max_files_open=sarah_agent.max_files_open,
    )

    # Should have closed exactly 3 files (the excess)
    assert len(closed_files) == 3

    # CRITICAL: Verify no duplicates in closed_files list
    assert len(closed_files) == len(set(closed_files)), f"Duplicate file names in closed_files: {closed_files}"

    # Should have exactly max_files_open files open
    open_files_after = await server.file_agent_manager.list_files_for_agent(
        sarah_agent.id, per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit, actor=default_user, is_open_only=True
    )
    assert len(open_files_after) == max_files_open

    # All files should be attached (some open, some closed)
    all_files_after = await server.file_agent_manager.list_files_for_agent(
        sarah_agent.id, per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit, actor=default_user
    )
    assert len(all_files_after) == max_files_open + 3


# ======================================================================================================================
# Race Condition Tests - Blocks
# ======================================================================================================================
# TODO: These fail intermittently, need to investigate
"""
FAILED tests/test_managers.py::test_high_concurrency_stress_test - AssertionError: High concurrency stress test failed with errors: [{'error': "(sqlalchemy.dialects.postgresql.asyncpg.Error) <class 'asyncpg.exceptions.DeadlockDetectedError'>: deadlock detected\nDETAIL:  Process ***04 waits for ShareLock on transaction 30***3; blocked by process 84.\nProcess 84 waits for ShareLock on transaction 30***5; blocked by process ***04.\nHINT:  See server log for query details.\n[SQL: INSERT INTO blocks_agents (agent_id, block_id, block_label) VALUES ($***::VARCHAR, $2::VARCHAR, $3::VARCHAR), ($4::VARCHAR, $5::VARCHAR, $6::VARCHAR), ($7::VARCHAR, $8::VARCHAR, $9::VARCHAR), ($***0::VARCHAR, $***::VARCHAR, $***2::VARCHAR) ON CONFLICT DO NOTHING]\n[parameters: ('agent-f69c0ffc-48ea-47f3-a6e0-e26a4***de764d', 'block-4506d355-b84a-44cd-bfdb-63a5039***07f***', 'stress_block_7', 'agent-f69c0ffc-48ea-47f3-a6e0-e26a4***de764d', 'block-cf32229c-9b43-4ed9-b65f-fc7cb***3567bf', 'stress_block_6', 'agent-f69c0ffc-48ea-47f3-a6e0-e26a4***de764d', 'block-02a***8***e7-44d6-402***-85a0-2c3dc20d9fae', 'stress_block_8', 'agent-f69c0ffc-48ea-47f3-a6e0-e26a4***de764d', 'block-4cba5***c***-42b8-4afa-aa59-97022c29f7a2', 'stress_block_0')]\n(Background on this error at: https://sqlalche.me/e/20/dbapi)", 'task_id': 4}]
"""
#
# @pytest.mark.asyncio
# async def test_concurrent_block_updates_race_condition(
#     server: SyncServer, comprehensive_test_agent_fixture, default_user: PydanticUser, event_loop
# ):
#     """Test that concurrent block updates don't cause race conditions."""
#     agent, _ = comprehensive_test_agent_fixture
#
#     # Create multiple blocks to use in concurrent updates
#     blocks = []
#     for i in range(5):
#         block = await server.block_manager.create_or_update_block_async(
#             PydanticBlock(label=f"test_block_{i}", value=f"Test block content {i}", limit=1000), actor=default_user
#         )
#         blocks.append(block)
#
#     # Test concurrent updates with different block combinations
#     async def update_agent_blocks(block_subset):
#         """Update agent with a specific subset of blocks."""
#         update_request = UpdateAgent(block_ids=[b.id for b in block_subset])
#         try:
#             return await server.agent_manager.update_agent_async(agent.id, update_request, actor=default_user)
#         except Exception as e:
#             # Capture any errors that occur during concurrent updates
#             return {"error": str(e)}
#
#     # Run concurrent updates with different block combinations
#     tasks = [
#         update_agent_blocks(blocks[:2]),  # blocks 0, 1
#         update_agent_blocks(blocks[1:3]),  # blocks 1, 2
#         update_agent_blocks(blocks[2:4]),  # blocks 2, 3
#         update_agent_blocks(blocks[3:5]),  # blocks 3, 4
#         update_agent_blocks(blocks[:1]),  # block 0 only
#     ]
#
#     results = await asyncio.gather(*tasks, return_exceptions=True)
#
#     # Verify no exceptions occurred
#     errors = [r for r in results if isinstance(r, Exception) or (isinstance(r, dict) and "error" in r)]
#     assert len(errors) == 0, f"Concurrent updates failed with errors: {errors}"
#
#     # Verify all results are valid agent states
#     valid_results = [r for r in results if not isinstance(r, Exception) and not (isinstance(r, dict) and "error" in r)]
#     assert len(valid_results) == 5, "All concurrent updates should succeed"
#
#     # Verify final state is consistent
#     final_agent = await server.agent_manager.get_agent_by_id_async(agent.id, actor=default_user)
#     assert final_agent is not None
#     assert len(final_agent.memory.blocks) > 0
#
#     # Clean up
#     for block in blocks:
#         await server.block_manager.delete_block_async(block.id, actor=default_user)
#
#
# @pytest.mark.asyncio
# async def test_concurrent_same_block_updates_race_condition(
#     server: SyncServer, comprehensive_test_agent_fixture, default_user: PydanticUser, event_loop
# ):
#     """Test that multiple concurrent updates to the same block configuration don't cause issues."""
#     agent, _ = comprehensive_test_agent_fixture
#
#     # Create a single block configuration to use in all updates
#     block = await server.block_manager.create_or_update_block_async(
#         PydanticBlock(label="shared_block", value="Shared block content", limit=1000), actor=default_user
#     )
#
#     # Test multiple concurrent updates with the same block configuration
#     async def update_agent_with_same_blocks():
#         """Update agent with the same block configuration."""
#         update_request = UpdateAgent(block_ids=[block.id])
#         try:
#             return await server.agent_manager.update_agent_async(agent.id, update_request, actor=default_user)
#         except Exception as e:
#             return {"error": str(e)}
#
#     # Run 10 concurrent identical updates
#     tasks = [update_agent_with_same_blocks() for _ in range(10)]
#     results = await asyncio.gather(*tasks, return_exceptions=True)
#
#     # Verify no exceptions occurred
#     errors = [r for r in results if isinstance(r, Exception) or (isinstance(r, dict) and "error" in r)]
#     assert len(errors) == 0, f"Concurrent identical updates failed with errors: {errors}"
#
#     # Verify final state is consistent
#     final_agent = await server.agent_manager.get_agent_by_id_async(agent.id, actor=default_user)
#     assert len(final_agent.memory.blocks) == 1
#     assert final_agent.memory.blocks[0].id == block.id
#
#     # Clean up
#     await server.block_manager.delete_block_async(block.id, actor=default_user)
#
#
# @pytest.mark.asyncio
# async def test_concurrent_empty_block_updates_race_condition(
#     server: SyncServer, comprehensive_test_agent_fixture, default_user: PydanticUser, event_loop
# ):
#     """Test concurrent updates that remove all blocks."""
#     agent, _ = comprehensive_test_agent_fixture
#
#     # Test concurrent updates that clear all blocks
#     async def clear_agent_blocks():
#         """Update agent to have no blocks."""
#         update_request = UpdateAgent(block_ids=[])
#         try:
#             return await server.agent_manager.update_agent_async(agent.id, update_request, actor=default_user)
#         except Exception as e:
#             return {"error": str(e)}
#
#     # Run concurrent clear operations
#     tasks = [clear_agent_blocks() for _ in range(5)]
#     results = await asyncio.gather(*tasks, return_exceptions=True)
#
#     # Verify no exceptions occurred
#     errors = [r for r in results if isinstance(r, Exception) or (isinstance(r, dict) and "error" in r)]
#     assert len(errors) == 0, f"Concurrent clear operations failed with errors: {errors}"
#
#     # Verify final state is consistent (no blocks)
#     final_agent = await server.agent_manager.get_agent_by_id_async(agent.id, actor=default_user)
#     assert len(final_agent.memory.blocks) == 0
#
#
# @pytest.mark.asyncio
# async def test_concurrent_mixed_block_operations_race_condition(
#     server: SyncServer, comprehensive_test_agent_fixture, default_user: PydanticUser, event_loop
# ):
#     """Test mixed concurrent operations: some adding blocks, some removing."""
#     agent, _ = comprehensive_test_agent_fixture
#
#     # Create test blocks
#     blocks = []
#     for i in range(3):
#         block = await server.block_manager.create_or_update_block_async(
#             PydanticBlock(label=f"mixed_block_{i}", value=f"Mixed block content {i}", limit=1000), actor=default_user
#         )
#         blocks.append(block)
#
#     # Mix of operations: add blocks, remove blocks, clear all
#     async def mixed_operation(operation_type):
#         """Perform different types of block operations."""
#         if operation_type == "add_all":
#             update_request = UpdateAgent(block_ids=[b.id for b in blocks])
#         elif operation_type == "add_subset":
#             update_request = UpdateAgent(block_ids=[blocks[0].id])
#         elif operation_type == "clear":
#             update_request = UpdateAgent(block_ids=[])
#         else:
#             update_request = UpdateAgent(block_ids=[blocks[1].id, blocks[2].id])
#
#         try:
#             return await server.agent_manager.update_agent_async(agent.id, update_request, actor=default_user)
#         except Exception as e:
#             return {"error": str(e)}
#
#     # Run mixed concurrent operations
#     tasks = [
#         mixed_operation("add_all"),
#         mixed_operation("add_subset"),
#         mixed_operation("clear"),
#         mixed_operation("add_two"),
#         mixed_operation("add_all"),
#     ]
#
#     results = await asyncio.gather(*tasks, return_exceptions=True)
#
#     # Verify no exceptions occurred
#     errors = [r for r in results if isinstance(r, Exception) or (isinstance(r, dict) and "error" in r)]
#     assert len(errors) == 0, f"Mixed concurrent operations failed with errors: {errors}"
#
#     # Verify final state is consistent (any valid state is acceptable)
#     final_agent = await server.agent_manager.get_agent_by_id_async(agent.id, actor=default_user)
#     assert final_agent is not None
#
#     # Clean up
#     for block in blocks:
#         await server.block_manager.delete_block_async(block.id, actor=default_user)
#
#
# @pytest.mark.asyncio
# async def test_high_concurrency_stress_test(server: SyncServer, comprehensive_test_agent_fixture, default_user: PydanticUser, event_loop):
#     """Stress test with high concurrency to catch race conditions."""
#     agent, _ = comprehensive_test_agent_fixture
#
#     # Create many blocks for stress testing
#     blocks = []
#     for i in range(10):
#         block = await server.block_manager.create_or_update_block_async(
#             PydanticBlock(label=f"stress_block_{i}", value=f"Stress test content {i}", limit=1000), actor=default_user
#         )
#         blocks.append(block)
#
#     # Create many concurrent update tasks
#     async def stress_update(task_id):
#         """Perform a random block update operation."""
#         import random
#
#         # Random subset of blocks
#         num_blocks = random.randint(0, len(blocks))
#         selected_blocks = random.sample(blocks, num_blocks)
#
#         update_request = UpdateAgent(block_ids=[b.id for b in selected_blocks])
#
#         try:
#             return await server.agent_manager.update_agent_async(agent.id, update_request, actor=default_user)
#         except Exception as e:
#             return {"error": str(e), "task_id": task_id}
#
#     # Run 20 concurrent stress updates
#     tasks = [stress_update(i) for i in range(20)]
#     results = await asyncio.gather(*tasks, return_exceptions=True)
#
#     # Verify no exceptions occurred
#     errors = [r for r in results if isinstance(r, Exception) or (isinstance(r, dict) and "error" in r)]
#     assert len(errors) == 0, f"High concurrency stress test failed with errors: {errors}"
#
#     # Verify final state is consistent
#     final_agent = await server.agent_manager.get_agent_by_id_async(agent.id, actor=default_user)
#     assert final_agent is not None
#
#     # Clean up
#     for block in blocks:
#         await server.block_manager.delete_block_async(block.id, actor=default_user)
