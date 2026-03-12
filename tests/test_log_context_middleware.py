from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import letta.server.rest_api.routers.v1.git_http as git_http_router
from letta.log_context import get_log_context
from letta.server.rest_api.middleware import LoggingMiddleware


@pytest.fixture
def app():
    app = FastAPI()
    app.add_middleware(LoggingMiddleware)

    @app.get("/v1/agents/{agent_id}")
    async def get_agent(agent_id: str):
        context = get_log_context()
        return {"agent_id": agent_id, "context": context}

    @app.get("/v1/agents/{agent_id}/tools/{tool_id}")
    async def get_agent_tool(agent_id: str, tool_id: str):
        context = get_log_context()
        return {"agent_id": agent_id, "tool_id": tool_id, "context": context}

    @app.get("/v1/organizations/{org_id}/users/{user_id}")
    async def get_org_user(org_id: str, user_id: str):
        context = get_log_context()
        return {"org_id": org_id, "user_id": user_id, "context": context}

    return app


@pytest.fixture
def client(app):
    return TestClient(app)


class TestLogContextMiddleware:
    @pytest.mark.asyncio
    async def test_sync_after_push_syncs_nested_block_labels_to_postgres(self, monkeypatch):
        """Regression test: nested labels (e.g., system/human) are synced from git files."""

        synced_calls = []

        class DummyActor:
            id = "user-123"
            organization_id = "org-123"

        class DummyGit:
            async def get_files(self, agent_id, org_id, ref):
                assert ref == "HEAD"
                return {
                    "system/human.md": "---\ndescription: human\n---\nname: sarah",
                    "system/persona.md": "---\ndescription: persona\n---\nbe helpful",
                    "skills/research-helper/SKILL.md": (
                        "---\n"
                        "name: research-helper\n"
                        "description: Search the web and summarize findings.\n"
                        "---\n"
                        "# Research Helper\n\n"
                        "Use this skill to do deep web research and summarize results.\n"
                    ),
                    "skills/research-helper/references/details.md": "---\ndescription: nested\n---\nShould not be synced",
                }

        class DummyMemoryRepoManager:
            git = DummyGit()

        class DummyBlockManager:
            async def _sync_block_to_postgres(self, **kwargs):
                synced_calls.append(kwargs)

        class DummyAgentManager:
            async def list_agent_blocks_async(self, **kwargs):
                return []

        class DummyUserManager:
            async def get_actor_by_id_async(self, actor_id):
                return DummyActor()

        class DummyServer:
            user_manager = DummyUserManager()
            memory_repo_manager = DummyMemoryRepoManager()
            block_manager = DummyBlockManager()
            agent_manager = DummyAgentManager()

        class DummyGitEnabledBlockManager(DummyBlockManager):
            pass

        dummy_server = DummyServer()
        dummy_server.block_manager = DummyGitEnabledBlockManager()

        monkeypatch.setattr(git_http_router, "_server_instance", dummy_server)

        from letta.settings import settings as core_settings

        monkeypatch.setattr(core_settings, "memfs_service_url", "http://memfs.test")

        with patch("letta.services.block_manager_git.GitEnabledBlockManager", DummyGitEnabledBlockManager):
            await git_http_router._sync_after_push(actor_id="user-123", agent_id="agent-123")

        labels = {call["label"] for call in synced_calls}
        assert "system/human" in labels
        assert "system/persona" in labels
        assert "skills/research-helper" in labels
        assert "skills/research-helper/references/details" not in labels

        by_label = {call["label"]: call for call in synced_calls}
        assert by_label["skills/research-helper"]["description"] == "Search the web and summarize findings."
        assert by_label["skills/research-helper"]["value"].startswith("# Research Helper")

    def test_extracts_actor_id_from_headers(self, client):
        response = client.get("/v1/agents/agent-123e4567-e89b-42d3-8456-426614174000", headers={"user_id": "user-abc123"})
        assert response.status_code == 200
        data = response.json()
        assert data["context"]["actor_id"] == "user-abc123"

    def test_extracts_agent_id_from_path(self, client):
        agent_id = "agent-123e4567-e89b-42d3-8456-426614174000"
        response = client.get(f"/v1/agents/{agent_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["context"]["agent_id"] == agent_id

    def test_extracts_multiple_primitive_ids_from_path(self, client):
        agent_id = "agent-123e4567-e89b-42d3-8456-426614174000"
        tool_id = "tool-987e6543-e21c-42d3-9456-426614174000"
        response = client.get(f"/v1/agents/{agent_id}/tools/{tool_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["context"]["agent_id"] == agent_id
        assert data["context"]["tool_id"] == tool_id

    def test_extracts_org_id_with_custom_mapping(self, client):
        org_id = "org-123e4567-e89b-42d3-8456-426614174000"
        user_id = "user-987e6543-e21c-42d3-9456-426614174000"
        response = client.get(f"/v1/organizations/{org_id}/users/{user_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["context"]["org_id"] == org_id
        assert data["context"]["user_id"] == user_id

    def test_extracts_both_header_and_path_context(self, client):
        agent_id = "agent-123e4567-e89b-42d3-8456-426614174000"
        response = client.get(f"/v1/agents/{agent_id}", headers={"user_id": "user-abc123"})
        assert response.status_code == 200
        data = response.json()
        assert data["context"]["actor_id"] == "user-abc123"
        assert data["context"]["agent_id"] == agent_id

    def test_handles_request_without_context(self, client):
        response = client.get("/v1/health")
        assert response.status_code == 404

    def test_context_cleared_between_requests(self, client):
        agent_id_1 = "agent-111e4567-e89b-42d3-8456-426614174000"
        agent_id_2 = "agent-222e4567-e89b-42d3-8456-426614174000"

        response1 = client.get(f"/v1/agents/{agent_id_1}", headers={"user_id": "user-1"})
        assert response1.status_code == 200
        data1 = response1.json()
        assert data1["context"]["agent_id"] == agent_id_1
        assert data1["context"]["actor_id"] == "user-1"

        response2 = client.get(f"/v1/agents/{agent_id_2}", headers={"user_id": "user-2"})
        assert response2.status_code == 200
        data2 = response2.json()
        assert data2["context"]["agent_id"] == agent_id_2
        assert data2["context"]["actor_id"] == "user-2"
