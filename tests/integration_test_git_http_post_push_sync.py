import os
import subprocess
import tempfile
import time
from pathlib import Path

import httpx
import pytest
from letta_client import Letta


def _run(cmd: list[str], cwd: str | None = None) -> None:
    subprocess.run(cmd, cwd=cwd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)


def _run_capture(cmd: list[str], cwd: str | None = None) -> str:
    result = subprocess.run(cmd, cwd=cwd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    return result.stdout


def _git_push_memory_update(server_url: str, agent_id: str, user_id: str, rel_markdown_path: str, markdown_content: str) -> None:
    with tempfile.TemporaryDirectory(prefix="git-http-push-") as tmpdir:
        repo_dir = Path(tmpdir) / "repo"
        remote = f"{server_url}/v1/git/{agent_id}/state.git"

        _run(["git", "clone", remote, str(repo_dir)])
        _run(["git", "config", "user.name", "Test User"], cwd=str(repo_dir))
        _run(["git", "config", "user.email", "test@example.com"], cwd=str(repo_dir))

        target = repo_dir / rel_markdown_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(markdown_content, encoding="utf-8")

        _run(["git", "add", rel_markdown_path], cwd=str(repo_dir))
        _run(["git", "commit", "-m", "Update memory via git HTTP"], cwd=str(repo_dir))

        env = os.environ.copy()
        existing = env.get("GIT_CONFIG_COUNT", "0")
        idx = int(existing)
        env["GIT_CONFIG_COUNT"] = str(idx + 2)
        env[f"GIT_CONFIG_KEY_{idx}"] = "http.extraHeader"
        env[f"GIT_CONFIG_VALUE_{idx}"] = f"user_id: {user_id}"
        env[f"GIT_CONFIG_KEY_{idx + 1}"] = "http.extraHeader"
        env[f"GIT_CONFIG_VALUE_{idx + 1}"] = "Accept: application/x-git-receive-pack-result"

        subprocess.run(
            ["git", "push", "origin", "HEAD"],
            cwd=str(repo_dir),
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env,
        )


def _poll_block_value(client: Letta, agent_id: str, block_label: str, expected_substring: str, timeout_seconds: float = 20.0) -> str:
    deadline = time.time() + timeout_seconds
    last_value = ""

    while time.time() < deadline:
        block = client.agents.blocks.retrieve(agent_id=agent_id, block_label=block_label)
        last_value = block.value or ""
        if expected_substring in last_value:
            return last_value
        time.sleep(0.25)

    raise AssertionError(f"Timed out waiting for block '{block_label}' to contain '{expected_substring}'. Last value: {last_value!r}")


@pytest.mark.skipif(not bool(os.getenv("LETTA_MEMFS_SERVICE_URL")), reason="requires memfs service configured")
def test_git_http_push_updates_core_block_cache_end_to_end(server_url: str):
    client = Letta(base_url=server_url)

    agent = client.agents.create(
        name="git-http-sync-e2e",
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
        tags=["git-memory-enabled"],
        memory_blocks=[
            {
                "label": "human",
                "value": "initial",
                "description": "human",
            }
        ],
    )

    try:
        actor_id = "user-00000000-0000-4000-8000-000000000000"
        marker = "GIT_PUSH_E2E_MARKER_123"
        markdown = f"---\ndescription: human\n---\n{marker}\n"

        _git_push_memory_update(
            server_url=server_url,
            agent_id=agent.id,
            user_id=actor_id,
            rel_markdown_path="system/human.md",
            markdown_content=markdown,
        )

        updated = _poll_block_value(
            client=client,
            agent_id=agent.id,
            block_label="system/human",
            expected_substring=marker,
        )
        assert marker in updated
    finally:
        client.agents.delete(agent.id)


@pytest.mark.skipif(not bool(os.getenv("LETTA_MEMFS_SERVICE_URL")), reason="requires memfs service configured")
def test_git_http_failed_receive_pack_does_not_sync_blocks(server_url: str):
    client = Letta(base_url=server_url)

    agent = client.agents.create(
        name="git-http-fail-no-sync",
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
        tags=["git-memory-enabled"],
        memory_blocks=[
            {
                "label": "human",
                "value": "initial-value",
                "description": "human",
            }
        ],
    )

    try:
        actor_id = "user-00000000-0000-4000-8000-000000000000"
        path = f"{agent.id}/state.git/git-receive-pack"

        with httpx.Client(timeout=10.0) as http:
            resp = http.post(
                f"{server_url}/v1/git/{path}",
                headers={
                    "user_id": actor_id,
                    "content-type": "application/x-git-receive-pack-request",
                    "accept": "application/x-git-receive-pack-result",
                },
                content=b"not-a-valid-receive-pack-payload",
            )

        assert resp.status_code >= 400

        block = client.agents.blocks.retrieve(agent_id=agent.id, block_label="system/human")
        assert block.value == "initial-value"
    finally:
        client.agents.delete(agent.id)


@pytest.mark.skipif(not bool(os.getenv("LETTA_MEMFS_SERVICE_URL")), reason="requires memfs service configured")
def test_git_http_post_push_sync_retries_transient_head_read(server_url: str, monkeypatch):
    client = Letta(base_url=server_url)

    agent = client.agents.create(
        name="git-http-retry-e2e",
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
        tags=["git-memory-enabled"],
        memory_blocks=[
            {
                "label": "human",
                "value": "initial",
                "description": "human",
            }
        ],
    )

    try:
        from letta.server.rest_api.app import server as app_server

        actor_id = "user-00000000-0000-4000-8000-000000000000"
        marker = "GIT_RETRY_E2E_MARKER_456"
        markdown = f"---\ndescription: human\n---\n{marker}\n"

        real_get_files = app_server.memory_repo_manager.git.get_files
        attempts = {"count": 0}

        async def flaky_get_files(agent_id: str, org_id: str, ref: str = "HEAD"):
            if agent_id == agent.id and attempts["count"] < 2:
                attempts["count"] += 1
                raise RuntimeError("simulated transient HEAD-read failure")
            return await real_get_files(agent_id=agent_id, org_id=org_id, ref=ref)

        monkeypatch.setattr(app_server.memory_repo_manager.git, "get_files", flaky_get_files)

        _git_push_memory_update(
            server_url=server_url,
            agent_id=agent.id,
            user_id=actor_id,
            rel_markdown_path="system/human.md",
            markdown_content=markdown,
        )

        updated = _poll_block_value(
            client=client,
            agent_id=agent.id,
            block_label="system/human",
            expected_substring=marker,
            timeout_seconds=25.0,
        )
        assert marker in updated
        assert attempts["count"] == 2
    finally:
        client.agents.delete(agent.id)
