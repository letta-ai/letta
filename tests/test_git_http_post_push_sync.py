from typing import ClassVar

import pytest
from starlette.requests import Request

import letta.server.rest_api.routers.v1.git_http as git_http_router
from letta.server.rest_api.dependencies import HeaderParams


def _build_request(method: str, path: str) -> Request:
    received = False

    async def receive():
        nonlocal received
        if received:
            return {"type": "http.disconnect"}
        received = True
        return {"type": "http.request", "body": b"", "more_body": False}

    scope = {
        "type": "http",
        "http_version": "1.1",
        "method": method,
        "scheme": "http",
        "path": f"/v1/git/{path}",
        "raw_path": f"/v1/git/{path}".encode(),
        "query_string": b"",
        "headers": [(b"user-agent", b"pytest")],
        "client": ("127.0.0.1", 12345),
        "server": ("testserver", 80),
    }
    return Request(scope, receive)


@pytest.mark.asyncio
async def test_post_push_sync_runs_after_stream_close(monkeypatch):
    events: list[str] = []

    class DummyActor:
        id = "user-123"
        organization_id = "org-123"

    class DummyUserManager:
        async def get_actor_or_default_async(self, actor_id=None):
            return DummyActor()

    class DummyAgentManager:
        async def get_agent_by_id_async(self, **kwargs):
            return object()

    class DummyServer:
        user_manager = DummyUserManager()
        agent_manager = DummyAgentManager()

    class DummyUpstream:
        status_code = 200
        headers: ClassVar[dict[str, str]] = {"content-type": "application/x-git-receive-pack-result"}

        async def aiter_raw(self):
            events.append("iter_start")
            yield b"pkt"
            events.append("iter_end")

        async def aclose(self):
            events.append("upstream_close")

    class DummyAsyncClient:
        def __init__(self, timeout=None):
            pass

        def build_request(self, **kwargs):
            return object()

        async def send(self, req, stream=True):
            events.append("send")
            return DummyUpstream()

        async def aclose(self):
            events.append("client_close")

    async def fake_sync_after_push(actor_id: str, agent_id: str):
        events.append("sync")
        assert actor_id == "user-123"
        assert agent_id == "agent-123"

    from letta.settings import settings as core_settings

    monkeypatch.setattr(core_settings, "memfs_service_url", "http://memfs.test")
    monkeypatch.setattr(git_http_router.httpx, "AsyncClient", DummyAsyncClient)
    monkeypatch.setattr(git_http_router, "_sync_after_push", fake_sync_after_push)

    path = "agent-123/state.git/git-receive-pack"
    request = _build_request(method="POST", path=path)
    response = await git_http_router.proxy_git_http(
        path=path,
        request=request,
        server=DummyServer(),
        headers=HeaderParams(actor_id="user-123"),
    )

    body = b""
    async for chunk in response.body_iterator:
        body += chunk

    assert body == b"pkt"
    assert "sync" not in events

    await response.background()

    assert "sync" in events
    assert events.index("sync") > events.index("iter_end")
