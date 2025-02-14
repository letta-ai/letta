import pytest
from fastapi.testclient import TestClient

from letta.config import LettaConfig
from letta.constants import COMPOSIO_ENTITY_ENV_VAR_KEY
from letta.log import get_logger
from letta.schemas.agent import CreateAgent, UpdateAgent
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.llm_config import LLMConfig
from letta.schemas.tool import ToolCreate
from letta.server.rest_api.app import app
from letta.server.server import SyncServer

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
def composio_gmail_get_profile_tool(server, default_user):
    tool_create = ToolCreate.from_composio(action_name="GMAIL_GET_PROFILE")
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


def test_composio_tool_execution_e2e(check_composio_key_set, composio_gmail_get_profile_tool, server: SyncServer, default_user):
    agent_state = server.agent_manager.create_agent(
        agent_create=CreateAgent(
            name="sarah_agent",
            memory_blocks=[],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
        ),
        actor=default_user,
    )
    agent = server.load_agent(agent_state.id, actor=default_user)
    response = agent.execute_tool_and_persist_state(composio_gmail_get_profile_tool.name, {}, composio_gmail_get_profile_tool)
    assert response[0]["response_data"]["emailAddress"] == "sarah@letta.com"

    # Add agent variable changing the entity ID
    agent_state = server.agent_manager.update_agent(
        agent_id=agent_state.id,
        agent_update=UpdateAgent(tool_exec_environment_variables={COMPOSIO_ENTITY_ENV_VAR_KEY: "matt"}),
        actor=default_user,
    )
    agent = server.load_agent(agent_state.id, actor=default_user)
    response = agent.execute_tool_and_persist_state(composio_gmail_get_profile_tool.name, {}, composio_gmail_get_profile_tool)
    assert response[0]["response_data"]["emailAddress"] == "matt@letta.com"
