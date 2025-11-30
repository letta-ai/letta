"""
Integration tests for token counting APIs.

These tests verify that the token counting implementations actually hit the real APIs
for Anthropic, Google Gemini, and OpenAI (tiktoken) by calling get_context_window
on an imported agent.
"""

import json
import os

import pytest

from letta.config import LettaConfig
from letta.orm import Base
from letta.schemas.agent import UpdateAgent
from letta.schemas.agent_file import AgentFileSchema
from letta.schemas.llm_config import LLMConfig
from letta.schemas.organization import Organization
from letta.schemas.user import User
from letta.server.server import SyncServer

# ============================================================================
# LLM Configs to test
# ============================================================================


def get_llm_config(filename: str, llm_config_dir: str = "tests/configs/llm_model_configs") -> LLMConfig:
    """Load LLM configuration from JSON file."""
    filename = os.path.join(llm_config_dir, filename)
    with open(filename, "r") as f:
        config_data = json.load(f)
    return LLMConfig(**config_data)


LLM_CONFIG_FILES = [
    "openai-gpt-4o-mini.json",
    "claude-4-5-sonnet.json",
    "gemini-2.5-pro.json",
]

LLM_CONFIGS = [pytest.param(get_llm_config(f), id=f.replace(".json", "")) for f in LLM_CONFIG_FILES]


# ============================================================================
# Fixtures
# ============================================================================


async def _clear_tables():
    from letta.server.db import db_registry

    async with db_registry.async_session() as session:
        for table in reversed(Base.metadata.sorted_tables):
            await session.execute(table.delete())
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
async def imported_agent_id(server: SyncServer, other_user):
    """Import the test agent from the .af file and return the agent ID."""
    file_path = os.path.join(os.path.dirname(__file__), "test_agent_files", "test_agent.af")

    with open(file_path, "r") as f:
        agent_file_json = json.load(f)

    agent_schema = AgentFileSchema.model_validate(agent_file_json)

    import_result = await server.agent_serialization_manager.import_file(
        schema=agent_schema,
        actor=other_user,
        append_copy_suffix=False,
        override_existing_tools=True,
    )

    assert import_result.success, f"Failed to import agent: {import_result.message}"

    # Get the imported agent ID
    agent_id = next(db_id for file_id, db_id in import_result.id_mappings.items() if file_id.startswith("agent-"))
    yield agent_id


# ============================================================================
# Token Counter Integration Test
# ============================================================================


@pytest.mark.asyncio
@pytest.mark.parametrize("llm_config", LLM_CONFIGS)
async def test_get_context_window(server: SyncServer, imported_agent_id: str, other_user, llm_config: LLMConfig):
    """Test get_context_window with different LLM providers."""
    # Update the agent to use the specified LLM config
    await server.agent_manager.update_agent_async(
        agent_id=imported_agent_id,
        agent_update=UpdateAgent(llm_config=llm_config),
        actor=other_user,
    )

    # Call get_context_window which will use the appropriate token counting API
    context_window = await server.agent_manager.get_context_window(agent_id=imported_agent_id, actor=other_user)

    # Verify we got valid token counts
    assert context_window.context_window_size_current > 0
    assert context_window.num_tokens_system >= 0
    assert context_window.num_tokens_messages >= 0
    assert context_window.num_tokens_functions_definitions >= 0

    print(f"{llm_config.model_endpoint_type} ({llm_config.model}) context window:")
    print(f"  Total tokens: {context_window.context_window_size_current}")
    print(f"  System tokens: {context_window.num_tokens_system}")
    print(f"  Message tokens: {context_window.num_tokens_messages}")
    print(f"  Function tokens: {context_window.num_tokens_functions_definitions}")


# ============================================================================
# Edge Case Tests
# ============================================================================


@pytest.mark.asyncio
@pytest.mark.parametrize("llm_config", LLM_CONFIGS)
async def test_count_empty_text_tokens(llm_config: LLMConfig):
    """Test that empty text returns 0 tokens for all providers."""
    from letta.llm_api.anthropic_client import AnthropicClient
    from letta.llm_api.google_ai_client import GoogleAIClient
    from letta.llm_api.google_vertex_client import GoogleVertexClient
    from letta.services.context_window_calculator.token_counter import (
        AnthropicTokenCounter,
        ApproxTokenCounter,
        GeminiTokenCounter,
    )

    if llm_config.model_endpoint_type == "anthropic":
        token_counter = AnthropicTokenCounter(AnthropicClient(), llm_config.model)
    elif llm_config.model_endpoint_type in ("google_vertex", "google_ai"):
        client = GoogleAIClient() if llm_config.model_endpoint_type == "google_ai" else GoogleVertexClient()
        token_counter = GeminiTokenCounter(client, llm_config.model)
    else:
        token_counter = ApproxTokenCounter()

    token_count = await token_counter.count_text_tokens("")
    assert token_count == 0


@pytest.mark.asyncio
@pytest.mark.parametrize("llm_config", LLM_CONFIGS)
async def test_count_empty_messages_tokens(llm_config: LLMConfig):
    """Test that empty message list returns 0 tokens for all providers."""
    from letta.llm_api.anthropic_client import AnthropicClient
    from letta.llm_api.google_ai_client import GoogleAIClient
    from letta.llm_api.google_vertex_client import GoogleVertexClient
    from letta.services.context_window_calculator.token_counter import (
        AnthropicTokenCounter,
        ApproxTokenCounter,
        GeminiTokenCounter,
    )

    if llm_config.model_endpoint_type == "anthropic":
        token_counter = AnthropicTokenCounter(AnthropicClient(), llm_config.model)
    elif llm_config.model_endpoint_type in ("google_vertex", "google_ai"):
        client = GoogleAIClient() if llm_config.model_endpoint_type == "google_ai" else GoogleVertexClient()
        token_counter = GeminiTokenCounter(client, llm_config.model)
    else:
        token_counter = ApproxTokenCounter()

    token_count = await token_counter.count_message_tokens([])
    assert token_count == 0


@pytest.mark.asyncio
@pytest.mark.parametrize("llm_config", LLM_CONFIGS)
async def test_count_empty_tools_tokens(llm_config: LLMConfig):
    """Test that empty tools list returns 0 tokens for all providers."""
    from letta.llm_api.anthropic_client import AnthropicClient
    from letta.llm_api.google_ai_client import GoogleAIClient
    from letta.llm_api.google_vertex_client import GoogleVertexClient
    from letta.services.context_window_calculator.token_counter import (
        AnthropicTokenCounter,
        ApproxTokenCounter,
        GeminiTokenCounter,
    )

    if llm_config.model_endpoint_type == "anthropic":
        token_counter = AnthropicTokenCounter(AnthropicClient(), llm_config.model)
    elif llm_config.model_endpoint_type in ("google_vertex", "google_ai"):
        client = GoogleAIClient() if llm_config.model_endpoint_type == "google_ai" else GoogleVertexClient()
        token_counter = GeminiTokenCounter(client, llm_config.model)
    else:
        token_counter = ApproxTokenCounter()

    token_count = await token_counter.count_tool_tokens([])
    assert token_count == 0
