import json
import os
import shutil
import uuid
import warnings
from typing import List, Tuple
from unittest.mock import patch

import pytest
from sqlalchemy import delete

import letta.utils as utils
from letta.agents.agent_loop import AgentLoop
from letta.constants import BASE_MEMORY_TOOLS, BASE_TOOLS, LETTA_DIR, LETTA_TOOL_EXECUTION_DIR
from letta.orm import Provider, Step
from letta.schemas.block import CreateBlock
from letta.schemas.enums import MessageRole, ProviderType
from letta.schemas.letta_message import LettaMessage, ReasoningMessage, SystemMessage, ToolCallMessage, ToolReturnMessage, UserMessage
from letta.schemas.llm_config import LLMConfig
from letta.schemas.providers import Provider as PydanticProvider, ProviderCreate
from letta.schemas.sandbox_config import SandboxType
from letta.schemas.user import User

utils.DEBUG = True
from letta.config import LettaConfig
from letta.orm.errors import NoResultFound
from letta.schemas.agent import CreateAgent, UpdateAgent
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.job import Job as PydanticJob
from letta.schemas.message import Message, MessageCreate
from letta.schemas.run import Run as PydanticRun
from letta.schemas.source import Source as PydanticSource
from letta.server.server import SyncServer
from letta.system import unpack_message

from .utils import DummyDataConnector


@pytest.fixture
async def server():
    config = LettaConfig.load()
    config.save()
    server = SyncServer(init_with_default_org_and_user=True)
    await server.init_async()
    await server.tool_manager.upsert_base_tools_async(actor=server.default_user)

    yield server


@pytest.fixture
async def org_id(server):
    # create org
    org = await server.organization_manager.create_default_organization_async()

    yield org.id

    # cleanup
    await server.organization_manager.delete_organization_by_id_async(org.id)


@pytest.fixture
async def user(server, org_id):
    user = await server.user_manager.create_default_actor_async(org_id=org_id)
    yield user


@pytest.fixture
def user_id(server, user):
    # create user
    yield user.id


provider_name = "custom-anthropic29"


@pytest.fixture
async def custom_anthropic_provider(server: SyncServer, user_id: str):
    actor = await server.user_manager.get_actor_or_default_async()

    # check if provider already exists
    existing_providers = await server.provider_manager.list_providers_async(actor=actor)
    for provider in existing_providers:
        if provider.name == provider_name:
            # delete provider
            await server.provider_manager.delete_provider_by_id_async(provider.id, actor=actor)

    provider = await server.provider_manager.create_provider_async(
        ProviderCreate(
            name=provider_name,
            provider_type=ProviderType.anthropic,
            api_key=os.getenv("ANTHROPIC_API_KEY"),
        ),
        actor=actor,
    )
    yield provider
    # Try to delete provider if it still exists (test may have already deleted it)
    try:
        await server.provider_manager.delete_provider_by_id_async(provider.id, actor=actor)
    except NoResultFound:
        pass  # Provider was already deleted in the test


@pytest.fixture
async def agent(server: SyncServer, user: User):
    actor = await server.user_manager.get_actor_or_default_async()
    agent = await server.create_agent_async(
        CreateAgent(
            agent_type="memgpt_v2_agent",
        ),
    )
    return agent


@pytest.mark.asyncio
async def test_messages_with_provider_override(server: SyncServer, custom_anthropic_provider: PydanticProvider, user):
    # list the models
    models = await server.list_llm_models_async(actor=user)
    for model in models:
        if model.provider_name == provider_name:
            print(model.model)

    actor = await server.user_manager.get_actor_or_default_async()
    agent = await server.create_agent_async(
        CreateAgent(
            agent_type="letta_v1_agent",
            memory_blocks=[],
            model=f"{provider_name}/claude-sonnet-4-5-20250929",
            context_window_limit=100000,
            embedding="openai/text-embedding-ada-002",
            include_base_tools=False,
        ),
        actor=actor,
    )

    existing_messages = await server.message_manager.list_messages(agent_id=agent.id, actor=actor)

    # send a message
    run = await server.run_manager.create_run(
        pydantic_run=PydanticRun(
            agent_id=agent.id,
            background=False,
        ),
        actor=actor,
    )
    agent_loop = AgentLoop.load(agent_state=agent, actor=actor)
    response = await agent_loop.step(
        input_messages=[MessageCreate(role=MessageRole.user, content="Test message")],
        run_id=run.id,
    )
    usage = response.usage
    messages = response.messages

    get_messages_response = await server.message_manager.list_messages(agent_id=agent.id, actor=actor, after=existing_messages[-1].id)

    # usage = await server.message_manager.create_message(user_id=actor.id, agent_id=agent.id, message="Test message")
    # assert usage, "Sending message failed"

    # get_messages_response = await server.message_manager.list_messages_for_agent_async(agent_id=agent.id, actor=actor, after=existing_messages[-1].id)
    # assert len(get_messages_response) > 0, "Retrieving messages failed"

    step_ids = set([msg.step_id for msg in get_messages_response])
    completion_tokens, prompt_tokens, total_tokens = 0, 0, 0
    for step_id in step_ids:
        step = await server.step_manager.get_step_async(step_id=step_id, actor=actor)
        assert step, "Step was not logged correctly"
        # assert step.provider_id == custom_anthropic_provider.id
        assert step.provider_name == agent.llm_config.model_endpoint_type
        assert step.model == agent.llm_config.model
        assert step.context_window_limit == agent.llm_config.context_window
        completion_tokens += int(step.completion_tokens)
        prompt_tokens += int(step.prompt_tokens)
        total_tokens += int(step.total_tokens)

    assert completion_tokens == usage.completion_tokens
    assert prompt_tokens == usage.prompt_tokens
    assert total_tokens == usage.total_tokens

    # await server.provider_manager.delete_provider_by_id_async(custom_anthropic_provider.id, actor=actor)

    # existing_messages = await server.message_manager.list_messages(agent_id=agent.id, actor=actor)

    ## with pytest.raises(NoResultFound):
    # agent_loop = AgentLoop.load(agent_state=agent, actor=actor)
    # response = await agent_loop.step(
    #    input_messages=[MessageCreate(role=MessageRole.user, content="Test message")],
    #    run_id=run.id,
    # )
    # print("RESULT", response)

    # usage = await server.message_manager.create_user_message_async(user_id=actor.id, agent_id=agent.id, message="Test message")
    # assert usage, "Sending message failed"

    # get_messages_response = await server.message_manager.list_messages_for_agent_async(agent_id=agent.id, actor=actor, after=existing_messages[-1].id)
    # assert len(get_messages_response) > 0, "Retrieving messages failed"

    # step_ids = set([msg.step_id for msg in get_messages_response])
    # completion_tokens, prompt_tokens, total_tokens = 0, 0, 0
    # for step_id in step_ids:
    #    step = await server.step_manager.get_step_async(step_id=step_id, actor=actor)
    #    assert step, "Step was not logged correctly"
    #    assert step.provider_id == None
    #    assert step.provider_name == agent.llm_config.model_endpoint_type
    #    assert step.model == agent.llm_config.model
    #    assert step.context_window_limit == agent.llm_config.context_window
    #    completion_tokens += int(step.completion_tokens)
    #    prompt_tokens += int(step.prompt_tokens)
    #    total_tokens += int(step.total_tokens)

    # assert completion_tokens == usage.completion_tokens
    # assert prompt_tokens == usage.prompt_tokens
    # assert total_tokens == usage.total_tokens


@pytest.mark.asyncio
async def test_messages_with_provider_override_legacy_agent(server: SyncServer, custom_anthropic_provider: PydanticProvider, user):
    # list the models
    models = await server.list_llm_models_async(actor=user)
    for model in models:
        if model.provider_name == provider_name:
            print(model.model)

    actor = await server.user_manager.get_actor_or_default_async()
    agent = await server.create_agent_async(
        CreateAgent(
            agent_type="memgpt_v2_agent",
            memory_blocks=[],
            model=f"{provider_name}/claude-sonnet-4-5-20250929",
            context_window_limit=100000,
            embedding="openai/text-embedding-ada-002",
        ),
        actor=actor,
    )

    existing_messages = await server.message_manager.list_messages(agent_id=agent.id, actor=actor)

    # send a message
    run = await server.run_manager.create_run(
        pydantic_run=PydanticRun(
            agent_id=agent.id,
            background=False,
        ),
        actor=actor,
    )
    agent_loop = AgentLoop.load(agent_state=agent, actor=actor)
    response = await agent_loop.step(
        input_messages=[MessageCreate(role=MessageRole.user, content="Test message")],
        run_id=run.id,
    )
    usage = response.usage
    messages = response.messages

    get_messages_response = await server.message_manager.list_messages(agent_id=agent.id, actor=actor, after=existing_messages[-1].id)

    # usage = await server.message_manager.create_message(user_id=actor.id, agent_id=agent.id, message="Test message")
    # assert usage, "Sending message failed"

    # get_messages_response = await server.message_manager.list_messages_for_agent_async(agent_id=agent.id, actor=actor, after=existing_messages[-1].id)
    # assert len(get_messages_response) > 0, "Retrieving messages failed"

    step_ids = set([msg.step_id for msg in get_messages_response])
    completion_tokens, prompt_tokens, total_tokens = 0, 0, 0
    for step_id in step_ids:
        step = await server.step_manager.get_step_async(step_id=step_id, actor=actor)
        assert step, "Step was not logged correctly"
        # assert step.provider_id == custom_anthropic_provider.id
        assert step.provider_name == agent.llm_config.model_endpoint_type
        assert step.model == agent.llm_config.model
        assert step.context_window_limit == agent.llm_config.context_window
        completion_tokens += int(step.completion_tokens)
        prompt_tokens += int(step.prompt_tokens)
        total_tokens += int(step.total_tokens)

    assert completion_tokens == usage.completion_tokens
    assert prompt_tokens == usage.prompt_tokens
    assert total_tokens == usage.total_tokens

    # await server.provider_manager.delete_provider_by_id_async(custom_anthropic_provider.id, actor=actor)

    # existing_messages = await server.message_manager.list_messages(agent_id=agent.id, actor=actor)

    ## with pytest.raises(NoResultFound):
    # agent_loop = AgentLoop.load(agent_state=agent, actor=actor)
    # response = await agent_loop.step(
    #    input_messages=[MessageCreate(role=MessageRole.user, content="Test message")],
    #    run_id=run.id,
    # )
    # print("RESULT", response)


@pytest.mark.asyncio
async def test_unique_handles_for_provider_configs(server: SyncServer, user: User):
    models = await server.list_llm_models_async(actor=user)
    model_handles = [model.handle for model in models]
    assert sorted(model_handles) == sorted(list(set(model_handles))), "All models should have unique handles"
    embeddings = await server.list_embedding_models_async(actor=user)
    embedding_handles = [embedding.handle for embedding in embeddings]
    assert sorted(embedding_handles) == sorted(list(set(embedding_handles))), "All embeddings should have unique handles"
