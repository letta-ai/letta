"""Tests for HTTPS proxy header handling in trailing-slash redirects.

Verifies that when Letta is deployed behind an HTTPS-terminating reverse proxy
(e.g., Cloudflare Tunnels, nginx, Traefik), trailing-slash redirects preserve
the original HTTPS scheme from the X-Forwarded-Proto header instead of
downgrading to HTTP.

See: https://github.com/letta-ai/letta/issues/3189
"""

from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware


def _build_app_with_proxy_middleware() -> FastAPI:
    """Build a minimal FastAPI app with uvicorn's ProxyHeadersMiddleware.

    In production, uvicorn injects ``ProxyHeadersMiddleware`` when
    ``proxy_headers=True`` is passed to ``uvicorn.run()``.  We replicate
    that here so the test exercises the same ASGI middleware chain that
    runs in a real deployment behind a reverse proxy.
    """
    app = FastAPI(redirect_slashes=True)

    @app.get("/v1/health/")
    async def health():
        return {"status": "ok"}

    @app.post("/v1/conversations/")
    async def create_conversation():
        return {"id": "conv-123"}

    return app


def _wrap_with_proxy_middleware(app: FastAPI) -> ProxyHeadersMiddleware:
    """Wrap a FastAPI app with uvicorn's ProxyHeadersMiddleware.

    This simulates the middleware that uvicorn adds when
    ``proxy_headers=True`` and ``forwarded_allow_ips="*"`` are passed
    to ``uvicorn.run()``.
    """
    return ProxyHeadersMiddleware(app, trusted_hosts="*")


@pytest.fixture
def app():
    return _build_app_with_proxy_middleware()


@pytest.fixture
def proxy_client(app):
    """Client with ProxyHeadersMiddleware (simulates uvicorn proxy_headers=True)."""
    wrapped = _wrap_with_proxy_middleware(app)
    return TestClient(wrapped, raise_server_exceptions=False)


@pytest.fixture
def plain_client(app):
    """Client without ProxyHeadersMiddleware (simulates missing proxy_headers)."""
    return TestClient(app, raise_server_exceptions=False)


class TestTrailingSlashRedirectScheme:
    """Trailing-slash redirects must preserve the scheme from X-Forwarded-Proto."""

    def test_redirect_preserves_https_with_proxy_middleware(self, proxy_client):
        """With ProxyHeadersMiddleware, redirect must use HTTPS scheme."""
        response = proxy_client.get(
            "/v1/health",
            headers={"X-Forwarded-Proto": "https", "Host": "letta.example.com"},
            follow_redirects=False,
        )
        assert response.status_code == 307
        location = response.headers["location"]
        assert location.startswith("https://"), f"Expected HTTPS redirect, got: {location}"
        assert "letta.example.com" in location
        assert location.endswith("/v1/health/")

    def test_redirect_downgrades_without_proxy_middleware(self, plain_client):
        """Without ProxyHeadersMiddleware, X-Forwarded-Proto is ignored."""
        response = plain_client.get(
            "/v1/health",
            headers={"X-Forwarded-Proto": "https", "Host": "letta.example.com"},
            follow_redirects=False,
        )
        assert response.status_code == 307
        location = response.headers["location"]
        assert location.startswith("http://"), f"Without middleware, should be HTTP: {location}"

    def test_post_redirect_preserves_https_with_proxy_middleware(self, proxy_client):
        """POST trailing-slash redirect should also preserve HTTPS scheme."""
        response = proxy_client.post(
            "/v1/conversations",
            headers={"X-Forwarded-Proto": "https", "Host": "letta.example.com"},
            follow_redirects=False,
        )
        assert response.status_code == 307
        location = response.headers["location"]
        assert location.startswith("https://"), f"Expected HTTPS redirect, got: {location}"

    def test_redirect_preserves_http_when_no_proxy_header(self, proxy_client):
        """Without X-Forwarded-Proto header, redirect should default to HTTP."""
        response = proxy_client.get(
            "/v1/health",
            headers={"Host": "letta.example.com"},
            follow_redirects=False,
        )
        assert response.status_code == 307
        location = response.headers["location"]
        assert location.startswith("http://"), f"Expected HTTP redirect, got: {location}"

    def test_direct_request_with_trailing_slash_no_redirect(self, proxy_client):
        """Request with trailing slash should not redirect at all."""
        response = proxy_client.get(
            "/v1/health/",
            headers={"X-Forwarded-Proto": "https", "Host": "letta.example.com"},
            follow_redirects=False,
        )
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


class TestStartServerProxyConfig:
    """Verify that start_server passes proxy_headers to uvicorn.run."""

    @patch("letta.server.rest_api.app.uvicorn.run")
    @patch("letta.server.rest_api.app.settings")
    def test_start_server_passes_proxy_headers(self, mock_settings, mock_uvicorn_run):
        """uvicorn.run must receive proxy_headers=True and forwarded_allow_ips='*'."""
        mock_settings.use_uvloop = False
        mock_settings.use_granian = False
        mock_settings.uvicorn_workers = 1
        mock_settings.uvicorn_reload = False
        mock_settings.uvicorn_timeout_keep_alive = 5

        from letta.server.rest_api.app import start_server

        start_server(port=8283, host="localhost")

        mock_uvicorn_run.assert_called_once()
        call_kwargs = mock_uvicorn_run.call_args[1]
        assert call_kwargs.get("proxy_headers") is True, "proxy_headers should be True"
        assert call_kwargs.get("forwarded_allow_ips") == "*", "forwarded_allow_ips should be '*'"

    @patch("letta.server.rest_api.app.uvicorn.run")
    @patch("letta.server.rest_api.app.settings")
    def test_start_server_https_passes_proxy_headers(self, mock_settings, mock_uvicorn_run):
        """uvicorn.run with LOCAL_HTTPS must also receive proxy_headers."""
        import os

        mock_settings.use_uvloop = False
        mock_settings.use_granian = False
        mock_settings.uvicorn_workers = 1
        mock_settings.uvicorn_reload = False
        mock_settings.uvicorn_timeout_keep_alive = 5

        from letta.server.rest_api.app import start_server

        with patch.dict(os.environ, {"LOCAL_HTTPS": "true"}):
            start_server(port=8283, host="localhost")

        mock_uvicorn_run.assert_called_once()
        call_kwargs = mock_uvicorn_run.call_args[1]
        assert call_kwargs.get("proxy_headers") is True, "proxy_headers should be True in HTTPS mode"
        assert call_kwargs.get("forwarded_allow_ips") == "*", "forwarded_allow_ips should be '*' in HTTPS mode"
