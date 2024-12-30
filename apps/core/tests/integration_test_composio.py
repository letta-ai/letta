import pytest
from fastapi.testclient import TestClient

from letta.server.rest_api.app import app


@pytest.fixture
def client():
    return TestClient(app)


def test_list_composio_apps(client):
    response = client.get("/v1/tools/composio/apps")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_list_composio_actions_by_app(client):
    response = client.get("/v1/tools/composio/apps/github/actions")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_add_composio_tool(client):
    response = client.post("/v1/tools/composio/GITHUB_STAR_A_REPOSITORY_FOR_THE_AUTHENTICATED_USER")
    assert response.status_code == 200
    assert "id" in response.json()
    assert "name" in response.json()
