from datetime import datetime
from unittest.mock import MagicMock, Mock, patch

import pytest
from composio.client.collections import ActionModel, ActionParametersModel, ActionResponseModel, AppModel
from fastapi.testclient import TestClient

from letta.orm.errors import NoResultFound
from letta.schemas.block import Block, BlockUpdate, CreateBlock
from letta.schemas.message import UserMessage
from letta.schemas.tool import ToolCreate, ToolUpdate
from letta.server.rest_api.app import app
from letta.server.rest_api.utils import get_letta_server
from tests.helpers.utils import create_tool_from_func


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def mock_sync_server():
    mock_server = Mock()
    app.dependency_overrides[get_letta_server] = lambda: mock_server
    return mock_server


@pytest.fixture
def add_integers_tool():
    def add(x: int, y: int) -> int:
        """
        Simple function that adds two integers.

        Parameters:
            x (int): The first integer to add.
            y (int): The second integer to add.

        Returns:
            int: The result of adding x and y.
        """
        return x + y

    tool = create_tool_from_func(add)
    yield tool


@pytest.fixture
def create_integers_tool(add_integers_tool):
    tool_create = ToolCreate(
        name=add_integers_tool.name,
        description=add_integers_tool.description,
        tags=add_integers_tool.tags,
        source_code=add_integers_tool.source_code,
        source_type=add_integers_tool.source_type,
        json_schema=add_integers_tool.json_schema,
    )
    yield tool_create


@pytest.fixture
def update_integers_tool(add_integers_tool):
    tool_update = ToolUpdate(
        name=add_integers_tool.name,
        description=add_integers_tool.description,
        tags=add_integers_tool.tags,
        source_code=add_integers_tool.source_code,
        source_type=add_integers_tool.source_type,
        json_schema=add_integers_tool.json_schema,
    )
    yield tool_update


@pytest.fixture
def composio_apps():
    affinity_app = AppModel(
        name="affinity",
        key="affinity",
        appId="3a7d2dc7-c58c-4491-be84-f64b1ff498a8",
        description="Affinity helps private capital investors to find, manage, and close more deals",
        categories=["CRM"],
        meta={
            "is_custom_app": False,
            "triggersCount": 0,
            "actionsCount": 20,
            "documentation_doc_text": None,
            "configuration_docs_text": None,
        },
        logo="https://cdn.jsdelivr.net/gh/ComposioHQ/open-logos@master/affinity.jpeg",
        docs=None,
        group=None,
        status=None,
        enabled=False,
        no_auth=False,
        auth_schemes=None,
        testConnectors=None,
        documentation_doc_text=None,
        configuration_docs_text=None,
    )
    yield [affinity_app]


@pytest.fixture
def composio_actions():
    yield [
        ActionModel(
            name="AFFINITY_GET_ALL_COMPANIES",
            display_name="Get all companies",
            parameters=ActionParametersModel(
                properties={
                    "cursor": {"default": None, "description": "Cursor for the next or previous page", "title": "Cursor", "type": "string"},
                    "limit": {"default": 100, "description": "Number of items to include in the page", "title": "Limit", "type": "integer"},
                    "ids": {"default": None, "description": "Company IDs", "items": {"type": "integer"}, "title": "Ids", "type": "array"},
                    "fieldIds": {
                        "default": None,
                        "description": "Field IDs for which to return field data",
                        "items": {"type": "string"},
                        "title": "Fieldids",
                        "type": "array",
                    },
                    "fieldTypes": {
                        "default": None,
                        "description": "Field Types for which to return field data",
                        "items": {"enum": ["enriched", "global", "relationship-intelligence"], "title": "FieldtypesEnm", "type": "string"},
                        "title": "Fieldtypes",
                        "type": "array",
                    },
                },
                title="GetAllCompaniesRequest",
                type="object",
                required=None,
            ),
            response=ActionResponseModel(
                properties={
                    "data": {"title": "Data", "type": "object"},
                    "successful": {
                        "description": "Whether or not the action execution was successful or not",
                        "title": "Successful",
                        "type": "boolean",
                    },
                    "error": {
                        "anyOf": [{"type": "string"}, {"type": "null"}],
                        "default": None,
                        "description": "Error if any occurred during the execution of the action",
                        "title": "Error",
                    },
                },
                title="GetAllCompaniesResponse",
                type="object",
                required=["data", "successful"],
            ),
            appName="affinity",
            appId="affinity",
            tags=["companies", "important"],
            enabled=False,
            logo="https://cdn.jsdelivr.net/gh/ComposioHQ/open-logos@master/affinity.jpeg",
            description="Affinity Api Allows Paginated Access To Company Info And Custom Fields. Use `Field Ids` Or `Field Types` To Specify Data In A Request. Retrieve Field I Ds/Types Via Get `/V2/Companies/Fields`. Export Permission Needed.",
        )
    ]


def configure_mock_sync_server(mock_sync_server):
    # Mock sandbox config manager to return a valid API key
    mock_api_key = Mock()
    mock_api_key.value = "mock_composio_api_key"
    mock_sync_server.sandbox_config_manager.list_sandbox_env_vars_by_key.return_value = [mock_api_key]

    # Mock user retrieval
    mock_sync_server.user_manager.get_user_or_default.return_value = Mock()  # Provide additional attributes if needed


# ======================================================================================================================
# Tools Routes Tests
# ======================================================================================================================
def test_delete_tool(client, mock_sync_server, add_integers_tool):
    mock_sync_server.tool_manager.delete_tool_by_id = MagicMock()

    response = client.delete(f"/v1/tools/{add_integers_tool.id}", headers={"user_id": "test_user"})

    assert response.status_code == 200
    mock_sync_server.tool_manager.delete_tool_by_id.assert_called_once_with(
        tool_id=add_integers_tool.id, actor=mock_sync_server.user_manager.get_user_or_default.return_value
    )


def test_get_tool(client, mock_sync_server, add_integers_tool):
    mock_sync_server.tool_manager.get_tool_by_id.return_value = add_integers_tool

    response = client.get(f"/v1/tools/{add_integers_tool.id}", headers={"user_id": "test_user"})

    assert response.status_code == 200
    assert response.json()["id"] == add_integers_tool.id
    assert response.json()["source_code"] == add_integers_tool.source_code
    mock_sync_server.tool_manager.get_tool_by_id.assert_called_once_with(
        tool_id=add_integers_tool.id, actor=mock_sync_server.user_manager.get_user_or_default.return_value
    )


def test_get_tool_404(client, mock_sync_server, add_integers_tool):
    mock_sync_server.tool_manager.get_tool_by_id.return_value = None

    response = client.get(f"/v1/tools/{add_integers_tool.id}", headers={"user_id": "test_user"})

    assert response.status_code == 404
    assert response.json()["detail"] == f"Tool with id {add_integers_tool.id} not found."


def test_list_tools(client, mock_sync_server, add_integers_tool):
    mock_sync_server.tool_manager.list_tools.return_value = [add_integers_tool]

    response = client.get("/v1/tools", headers={"user_id": "test_user"})

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["id"] == add_integers_tool.id
    mock_sync_server.tool_manager.list_tools.assert_called_once()


def test_create_tool(client, mock_sync_server, create_integers_tool, add_integers_tool):
    mock_sync_server.tool_manager.create_tool.return_value = add_integers_tool

    response = client.post("/v1/tools", json=create_integers_tool.model_dump(), headers={"user_id": "test_user"})

    assert response.status_code == 200
    assert response.json()["id"] == add_integers_tool.id
    mock_sync_server.tool_manager.create_tool.assert_called_once()


def test_upsert_tool(client, mock_sync_server, create_integers_tool, add_integers_tool):
    mock_sync_server.tool_manager.create_or_update_tool.return_value = add_integers_tool

    response = client.put("/v1/tools", json=create_integers_tool.model_dump(), headers={"user_id": "test_user"})

    assert response.status_code == 200
    assert response.json()["id"] == add_integers_tool.id
    mock_sync_server.tool_manager.create_or_update_tool.assert_called_once()


def test_update_tool(client, mock_sync_server, update_integers_tool, add_integers_tool):
    mock_sync_server.tool_manager.update_tool_by_id.return_value = add_integers_tool

    response = client.patch(f"/v1/tools/{add_integers_tool.id}", json=update_integers_tool.model_dump(), headers={"user_id": "test_user"})

    assert response.status_code == 200
    assert response.json()["id"] == add_integers_tool.id
    mock_sync_server.tool_manager.update_tool_by_id.assert_called_once_with(
        tool_id=add_integers_tool.id, tool_update=update_integers_tool, actor=mock_sync_server.user_manager.get_user_or_default.return_value
    )


def test_upsert_base_tools(client, mock_sync_server, add_integers_tool):
    mock_sync_server.tool_manager.upsert_base_tools.return_value = [add_integers_tool]

    response = client.post("/v1/tools/add-base-tools", headers={"user_id": "test_user"})

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["id"] == add_integers_tool.id
    mock_sync_server.tool_manager.upsert_base_tools.assert_called_once_with(
        actor=mock_sync_server.user_manager.get_user_or_default.return_value
    )


def test_list_composio_apps(client, mock_sync_server, composio_apps):
    configure_mock_sync_server(mock_sync_server)

    mock_sync_server.get_composio_apps.return_value = composio_apps

    response = client.get("/v1/tools/composio/apps")

    assert response.status_code == 200
    assert len(response.json()) == 1
    mock_sync_server.get_composio_apps.assert_called_once()


def test_list_composio_actions_by_app(client, mock_sync_server, composio_actions):
    configure_mock_sync_server(mock_sync_server)

    mock_sync_server.get_composio_actions_from_app_name.return_value = composio_actions

    response = client.get("/v1/tools/composio/apps/App1/actions")

    assert response.status_code == 200
    assert len(response.json()) == 1
    mock_sync_server.get_composio_actions_from_app_name.assert_called_once_with(composio_app_name="App1", api_key="mock_composio_api_key")


def test_add_composio_tool(client, mock_sync_server, add_integers_tool):
    configure_mock_sync_server(mock_sync_server)

    # Mock ToolCreate.from_composio to return the expected ToolCreate object
    with patch("letta.schemas.tool.ToolCreate.from_composio") as mock_from_composio:
        mock_from_composio.return_value = ToolCreate(
            name=add_integers_tool.name,
            source_code=add_integers_tool.source_code,
            json_schema=add_integers_tool.json_schema,
        )

        # Mock server behavior
        mock_sync_server.tool_manager.create_or_update_composio_tool.return_value = add_integers_tool

        # Perform the request
        response = client.post(f"/v1/tools/composio/{add_integers_tool.name}", headers={"user_id": "test_user"})

        # Assertions
        assert response.status_code == 200
        assert response.json()["id"] == add_integers_tool.id
        mock_sync_server.tool_manager.create_or_update_composio_tool.assert_called_once()

        # Verify the mocked from_composio method was called
        mock_from_composio.assert_called_once_with(action_name=add_integers_tool.name)


# ======================================================================================================================
# Runs Routes Tests
# ======================================================================================================================


def test_get_run_messages(client, mock_sync_server):
    """Test getting messages for a run."""
    # Create properly formatted mock messages
    current_time = datetime.utcnow()
    mock_messages = [
        UserMessage(
            id=f"message-{i:08x}",
            date=current_time,
            content=f"Test message {i}",
        )
        for i in range(2)
    ]

    # Configure mock server responses
    mock_sync_server.user_manager.get_user_or_default.return_value = Mock(id="user-123")
    mock_sync_server.job_manager.get_run_messages.return_value = mock_messages

    # Test successful retrieval
    response = client.get(
        "/v1/runs/run-12345678/messages",
        headers={"user_id": "user-123"},
        params={
            "limit": 10,
            "before": "message-1234",
            "after": "message-6789",
            "role": "user",
            "order": "desc",
        },
    )
    assert response.status_code == 200
    assert len(response.json()) == 2
    assert response.json()[0]["id"] == mock_messages[0].id
    assert response.json()[1]["id"] == mock_messages[1].id

    # Verify mock calls
    mock_sync_server.user_manager.get_user_or_default.assert_called_once_with(user_id="user-123")
    mock_sync_server.job_manager.get_run_messages.assert_called_once_with(
        run_id="run-12345678",
        actor=mock_sync_server.user_manager.get_user_or_default.return_value,
        limit=10,
        before="message-1234",
        after="message-6789",
        ascending=False,
        role="user",
    )


def test_get_run_messages_not_found(client, mock_sync_server):
    """Test getting messages for a non-existent run."""
    # Configure mock responses
    error_message = "Run 'run-nonexistent' not found"
    mock_sync_server.user_manager.get_user_or_default.return_value = Mock(id="user-123")
    mock_sync_server.job_manager.get_run_messages.side_effect = NoResultFound(error_message)

    response = client.get("/v1/runs/run-nonexistent/messages", headers={"user_id": "user-123"})

    assert response.status_code == 404
    assert error_message in response.json()["detail"]


def test_get_run_usage(client, mock_sync_server):
    """Test getting usage statistics for a run."""
    # Configure mock responses
    mock_sync_server.user_manager.get_user_or_default.return_value = Mock(id="user-123")
    mock_usage = Mock(
        completion_tokens=100,
        prompt_tokens=200,
        total_tokens=300,
    )
    mock_sync_server.job_manager.get_job_usage.return_value = mock_usage

    # Make request
    response = client.get("/v1/runs/run-12345678/usage", headers={"user_id": "user-123"})

    # Check response
    assert response.status_code == 200
    assert response.json() == {
        "completion_tokens": 100,
        "prompt_tokens": 200,
        "total_tokens": 300,
    }

    # Verify mock calls
    mock_sync_server.user_manager.get_user_or_default.assert_called_once_with(user_id="user-123")
    mock_sync_server.job_manager.get_job_usage.assert_called_once_with(
        job_id="run-12345678",
        actor=mock_sync_server.user_manager.get_user_or_default.return_value,
    )


def test_get_run_usage_not_found(client, mock_sync_server):
    """Test getting usage statistics for a non-existent run."""
    # Configure mock responses
    error_message = "Run 'run-nonexistent' not found"
    mock_sync_server.user_manager.get_user_or_default.return_value = Mock(id="user-123")
    mock_sync_server.job_manager.get_job_usage.side_effect = NoResultFound(error_message)

    # Make request
    response = client.get("/v1/runs/run-nonexistent/usage", headers={"user_id": "user-123"})

    assert response.status_code == 404
    assert error_message in response.json()["detail"]


# ======================================================================================================================
# Tags Routes Tests
# ======================================================================================================================


def test_get_tags(client, mock_sync_server):
    """Test basic tag listing"""
    mock_sync_server.agent_manager.list_tags.return_value = ["tag1", "tag2"]

    response = client.get("/v1/tags", headers={"user_id": "test_user"})

    assert response.status_code == 200
    assert response.json() == ["tag1", "tag2"]
    mock_sync_server.agent_manager.list_tags.assert_called_once_with(
        actor=mock_sync_server.user_manager.get_user_or_default.return_value, after=None, limit=50, query_text=None
    )


def test_get_tags_with_pagination(client, mock_sync_server):
    """Test tag listing with pagination parameters"""
    mock_sync_server.agent_manager.list_tags.return_value = ["tag3", "tag4"]

    response = client.get("/v1/tags", params={"after": "tag2", "limit": 2}, headers={"user_id": "test_user"})

    assert response.status_code == 200
    assert response.json() == ["tag3", "tag4"]
    mock_sync_server.agent_manager.list_tags.assert_called_once_with(
        actor=mock_sync_server.user_manager.get_user_or_default.return_value, after="tag2", limit=2, query_text=None
    )


def test_get_tags_with_search(client, mock_sync_server):
    """Test tag listing with text search"""
    mock_sync_server.agent_manager.list_tags.return_value = ["user_tag1", "user_tag2"]

    response = client.get("/v1/tags", params={"query_text": "user"}, headers={"user_id": "test_user"})

    assert response.status_code == 200
    assert response.json() == ["user_tag1", "user_tag2"]
    mock_sync_server.agent_manager.list_tags.assert_called_once_with(
        actor=mock_sync_server.user_manager.get_user_or_default.return_value, after=None, limit=50, query_text="user"
    )


# ======================================================================================================================
# Blocks Routes Tests
# ======================================================================================================================


def test_list_blocks(client, mock_sync_server):
    """
    Test the GET /v1/blocks endpoint to list blocks.
    """
    # Arrange: mock return from block_manager
    mock_block = Block(label="human", value="Hi", is_template=True)
    mock_sync_server.block_manager.get_blocks.return_value = [mock_block]

    # Act
    response = client.get("/v1/blocks", headers={"user_id": "test_user"})

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == mock_block.id
    mock_sync_server.block_manager.get_blocks.assert_called_once_with(
        actor=mock_sync_server.user_manager.get_user_or_default.return_value,
        label=None,
        is_template=True,
        template_name=None,
    )


def test_create_block(client, mock_sync_server):
    """
    Test the POST /v1/blocks endpoint to create a block.
    """
    new_block = CreateBlock(label="system", value="Some system text")
    returned_block = Block(**new_block.model_dump())

    mock_sync_server.block_manager.create_or_update_block.return_value = returned_block

    response = client.post("/v1/blocks", json=new_block.model_dump(), headers={"user_id": "test_user"})
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == returned_block.id

    mock_sync_server.block_manager.create_or_update_block.assert_called_once()


def test_modify_block(client, mock_sync_server):
    """
    Test the PATCH /v1/blocks/{block_id} endpoint to update a block.
    """
    block_update = BlockUpdate(value="Updated text", description="New description")
    updated_block = Block(label="human", value="Updated text", description="New description")
    mock_sync_server.block_manager.update_block.return_value = updated_block

    response = client.patch(f"/v1/blocks/{updated_block.id}", json=block_update.model_dump(), headers={"user_id": "test_user"})
    assert response.status_code == 200
    data = response.json()
    assert data["value"] == "Updated text"
    assert data["description"] == "New description"

    mock_sync_server.block_manager.update_block.assert_called_once_with(
        block_id=updated_block.id,
        block_update=block_update,
        actor=mock_sync_server.user_manager.get_user_or_default.return_value,
    )


def test_delete_block(client, mock_sync_server):
    """
    Test the DELETE /v1/blocks/{block_id} endpoint.
    """
    deleted_block = Block(label="persona", value="Deleted text")
    mock_sync_server.block_manager.delete_block.return_value = deleted_block

    response = client.delete(f"/v1/blocks/{deleted_block.id}", headers={"user_id": "test_user"})
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == deleted_block.id

    mock_sync_server.block_manager.delete_block.assert_called_once_with(
        block_id=deleted_block.id, actor=mock_sync_server.user_manager.get_user_or_default.return_value
    )


def test_retrieve_block(client, mock_sync_server):
    """
    Test the GET /v1/blocks/{block_id} endpoint.
    """
    existing_block = Block(label="human", value="Hello")
    mock_sync_server.block_manager.get_block_by_id.return_value = existing_block

    response = client.get(f"/v1/blocks/{existing_block.id}", headers={"user_id": "test_user"})
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == existing_block.id

    mock_sync_server.block_manager.get_block_by_id.assert_called_once_with(
        block_id=existing_block.id, actor=mock_sync_server.user_manager.get_user_or_default.return_value
    )


def test_retrieve_block_404(client, mock_sync_server):
    """
    Test that retrieving a non-existent block returns 404.
    """
    mock_sync_server.block_manager.get_block_by_id.return_value = None

    response = client.get("/v1/blocks/block-999", headers={"user_id": "test_user"})
    assert response.status_code == 404
    assert "Block not found" in response.json()["detail"]


def test_list_agents_for_block(client, mock_sync_server):
    """
    Test the GET /v1/blocks/{block_id}/agents endpoint.
    """
    mock_sync_server.block_manager.get_agents_for_block.return_value = []

    response = client.get("/v1/blocks/block-abc/agents", headers={"user_id": "test_user"})
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 0

    mock_sync_server.block_manager.get_agents_for_block.assert_called_once_with(
        block_id="block-abc",
        actor=mock_sync_server.user_manager.get_user_or_default.return_value,
    )
