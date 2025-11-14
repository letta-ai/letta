"""
Test for sandbox credentials service functionality.

To run this test:
    python -m pytest letta/services/sandbox_credentials_service_test.py -v

To test with actual webhook:
    export SANDBOX_CREDENTIALS_WEBHOOK=https://your-webhook-url.com/endpoint
    export SANDBOX_CREDENTIALS_KEY=your-secret-key
    python -m pytest letta/services/sandbox_credentials_service_test.py -v
"""

import os
from unittest.mock import AsyncMock, patch

import pytest

from letta.schemas.user import User
from letta.services.sandbox_credentials_service import SandboxCredentialsService


@pytest.mark.asyncio
async def test_credentials_not_configured():
    """Test that credentials fetch returns empty dict when URL is not configured."""
    with patch.dict(os.environ, {}, clear=True):
        service = SandboxCredentialsService()
        mock_user = User(id="user_123", organization_id="org_456")
        result = await service.fetch_credentials(mock_user)
        assert result == {}


@pytest.mark.asyncio
async def test_credentials_fetch_success():
    """Test successful credentials fetch."""
    with patch.dict(
        os.environ,
        {"SANDBOX_CREDENTIALS_WEBHOOK": "https://example.com/credentials", "SANDBOX_CREDENTIALS_KEY": "test-key"},
    ):
        service = SandboxCredentialsService()
        mock_user = User(id="user_123", organization_id="org_456")

        with patch("httpx.AsyncClient") as mock_client:
            mock_response = AsyncMock()
            mock_response.status_code = 200
            mock_response.raise_for_status = AsyncMock()
            mock_response.json = AsyncMock(return_value={"API_KEY": "secret_key_123", "OTHER_VAR": "value"})

            mock_post = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.post = mock_post

            result = await service.fetch_credentials(mock_user, tool_name="my_tool", agent_id="agent_789")

            assert result == {"API_KEY": "secret_key_123", "OTHER_VAR": "value"}
            mock_post.assert_called_once()
            call_args = mock_post.call_args
            assert call_args.kwargs["json"] == {
                "user_id": "user_123",
                "organization_id": "org_456",
                "tool_name": "my_tool",
                "agent_id": "agent_789",
            }
            assert call_args.kwargs["headers"]["Authorization"] == "Bearer test-key"


@pytest.mark.asyncio
async def test_credentials_fetch_without_auth():
    """Test credentials fetch without authentication key."""
    with patch.dict(os.environ, {"SANDBOX_CREDENTIALS_WEBHOOK": "https://example.com/credentials"}, clear=True):
        service = SandboxCredentialsService()
        mock_user = User(id="user_123", organization_id="org_456")

        with patch("httpx.AsyncClient") as mock_client:
            mock_response = AsyncMock()
            mock_response.status_code = 200
            mock_response.raise_for_status = AsyncMock()
            mock_response.json = AsyncMock(return_value={"API_KEY": "secret_key_123"})

            mock_post = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.post = mock_post

            result = await service.fetch_credentials(mock_user)

            assert result == {"API_KEY": "secret_key_123"}
            call_args = mock_post.call_args
            # Should not have Authorization header
            assert "Authorization" not in call_args.kwargs["headers"]


@pytest.mark.asyncio
async def test_credentials_fetch_timeout():
    """Test credentials fetch timeout handling."""
    with patch.dict(os.environ, {"SANDBOX_CREDENTIALS_WEBHOOK": "https://example.com/credentials"}):
        service = SandboxCredentialsService()
        mock_user = User(id="user_123", organization_id="org_456")

        with patch("httpx.AsyncClient") as mock_client:
            import httpx

            mock_post = AsyncMock(side_effect=httpx.TimeoutException("Request timed out"))
            mock_client.return_value.__aenter__.return_value.post = mock_post

            result = await service.fetch_credentials(mock_user)

            assert result == {}


@pytest.mark.asyncio
async def test_credentials_fetch_http_error():
    """Test credentials fetch HTTP error handling."""
    with patch.dict(os.environ, {"SANDBOX_CREDENTIALS_WEBHOOK": "https://example.com/credentials"}):
        service = SandboxCredentialsService()
        mock_user = User(id="user_123", organization_id="org_456")

        with patch("httpx.AsyncClient") as mock_client:
            import httpx

            mock_response = AsyncMock()
            mock_response.status_code = 500
            mock_response.raise_for_status = AsyncMock(
                side_effect=httpx.HTTPStatusError("Server error", request=None, response=mock_response)
            )

            mock_post = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.post = mock_post

            result = await service.fetch_credentials(mock_user)

            assert result == {}


@pytest.mark.asyncio
async def test_credentials_fetch_invalid_response():
    """Test credentials fetch with invalid response format."""
    with patch.dict(os.environ, {"SANDBOX_CREDENTIALS_WEBHOOK": "https://example.com/credentials"}):
        service = SandboxCredentialsService()
        mock_user = User(id="user_123", organization_id="org_456")

        with patch("httpx.AsyncClient") as mock_client:
            mock_response = AsyncMock()
            mock_response.status_code = 200
            mock_response.raise_for_status = AsyncMock()
            mock_response.json = AsyncMock(return_value="not a dict")

            mock_post = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.post = mock_post

            result = await service.fetch_credentials(mock_user)

            assert result == {}
