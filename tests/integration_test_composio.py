import pytest
from fastapi.testclient import TestClient

from letta.config import LettaConfig
from letta.log import get_logger
from letta.schemas.agent import CreateAgent
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.llm_config import LLMConfig
from letta.schemas.tool import ToolCreate
from letta.server.rest_api.app import app
from letta.server.server import SyncServer
from letta.services.tool_executor.tool_execution_manager import ToolExecutionManager

logger = get_logger(__name__)


@pytest.fixture
def fastapi_client():
    return TestClient(app)


@pytest.fixture(scope="module")
def server():
    config = LettaConfig.load()
    print("CONFIG PATH", config.config_path)

    config.save()

    server = SyncServer()
    return server


@pytest.fixture
def composio_get_emojis(server, default_user):
    tool_create = ToolCreate.from_composio(action_name="GITHUB_GET_EMOJIS")
    tool = server.tool_manager.create_or_update_composio_tool(tool_create=tool_create, actor=default_user)
    yield tool


def test_list_composio_apps(fastapi_client):
    response = fastapi_client.get("/v1/tools/composio/apps")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_list_composio_actions_by_app(fastapi_client):
    response = fastapi_client.get("/v1/tools/composio/apps/github/actions")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_add_composio_tool(fastapi_client):
    response = fastapi_client.post("/v1/tools/composio/GITHUB_STAR_A_REPOSITORY_FOR_THE_AUTHENTICATED_USER")
    assert response.status_code == 200
    assert "id" in response.json()
    assert "name" in response.json()


async def test_composio_tool_execution_e2e(check_composio_key_set, composio_get_emojis, server: SyncServer, default_user):
    agent_state = server.agent_manager.create_agent(
        agent_create=CreateAgent(
            name="sarah_agent",
            memory_blocks=[],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
        ),
        actor=default_user,
    )

    tool_executor = ToolExecutionManager(
        message_manager=server.message_manager,
        agent_manager=server.agent_manager,
        block_manager=server.block_manager,
        job_manager=server.job_manager,
        passage_manager=server.passage_manager,
        agent_state=agent_state,
        actor=default_user,
    )
    tool_execution_result = await tool_executor.execute_tool_async(
        function_name=composio_get_emojis.name, function_args={}, tool=composio_get_emojis
    )

    # Small check, it should return something at least
    assert len(tool_execution_result.func_return) > 100
