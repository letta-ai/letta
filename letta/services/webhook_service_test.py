"""
Simple test to verify webhook service functionality.

To run this test:
    python -m pytest letta/services/webhook_service_test.py -v

To test with actual webhook:
    export STEP_COMPLETE_WEBHOOK=https://your-webhook-url.com/endpoint
    export STEP_COMPLETE_KEY=your-secret-key
    python -m pytest letta/services/webhook_service_test.py -v

These tests verify the webhook service works in both:
- Temporal mode (when webhooks are called as Temporal activities)
- Non-Temporal mode (when webhooks are called directly from StepManager)
"""

import os
from unittest.mock import AsyncMock, patch

import pytest

from letta.services.webhook_service import WebhookService


@pytest.mark.asyncio
async def test_webhook_not_configured():
    """Test that webhook does not send when URL is not configured."""
    with patch.dict(os.environ, {}, clear=True):
        service = WebhookService()
        result = await service.notify_step_complete("step_123")
        assert result is False


@pytest.mark.asyncio
async def test_webhook_success():
    """Test successful webhook notification."""
    with patch.dict(
        os.environ,
        {"STEP_COMPLETE_WEBHOOK": "https://example.com/webhook", "STEP_COMPLETE_KEY": "test-key"},
    ):
        service = WebhookService()

        with patch("httpx.AsyncClient") as mock_client:
            mock_response = AsyncMock()
            mock_response.status_code = 200
            mock_response.raise_for_status = AsyncMock()

            mock_post = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.post = mock_post

            result = await service.notify_step_complete("step_123")

            assert result is True
            mock_post.assert_called_once()
            call_args = mock_post.call_args
            assert call_args.kwargs["json"] == {"step_id": "step_123"}
            assert call_args.kwargs["headers"]["Authorization"] == "Bearer test-key"


@pytest.mark.asyncio
async def test_webhook_without_auth():
    """Test webhook notification without authentication key."""
    with patch.dict(os.environ, {"STEP_COMPLETE_WEBHOOK": "https://example.com/webhook"}, clear=True):
        service = WebhookService()

        with patch("httpx.AsyncClient") as mock_client:
            mock_response = AsyncMock()
            mock_response.status_code = 200
            mock_response.raise_for_status = AsyncMock()

            mock_post = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.post = mock_post

            result = await service.notify_step_complete("step_123")

            assert result is True
            call_args = mock_post.call_args
            # Should not have Authorization header
            assert "Authorization" not in call_args.kwargs["headers"]


@pytest.mark.asyncio
async def test_webhook_timeout():
    """Test webhook notification timeout handling."""
    with patch.dict(os.environ, {"STEP_COMPLETE_WEBHOOK": "https://example.com/webhook"}):
        service = WebhookService()

        with patch("httpx.AsyncClient") as mock_client:
            import httpx

            mock_post = AsyncMock(side_effect=httpx.TimeoutException("Request timed out"))
            mock_client.return_value.__aenter__.return_value.post = mock_post

            result = await service.notify_step_complete("step_123")

            assert result is False


@pytest.mark.asyncio
async def test_webhook_http_error():
    """Test webhook notification HTTP error handling."""
    with patch.dict(os.environ, {"STEP_COMPLETE_WEBHOOK": "https://example.com/webhook"}):
        service = WebhookService()

        with patch("httpx.AsyncClient") as mock_client:
            import httpx

            mock_response = AsyncMock()
            mock_response.status_code = 500
            mock_response.raise_for_status = AsyncMock(
                side_effect=httpx.HTTPStatusError("Server error", request=None, response=mock_response)
            )

            mock_post = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.post = mock_post

            result = await service.notify_step_complete("step_123")

            assert result is False
