"""
Unit tests for Venice AI helper functions.

Tests for venice_get_model_list_async and related utilities.
"""

import pytest
from unittest.mock import AsyncMock, Mock, patch

import httpx

from letta.llm_api.venice import venice_get_model_list_async


class TestVeniceGetModelListAsync:
    """Test venice_get_model_list_async function."""

    @pytest.mark.asyncio
    async def test_get_model_list_success(self):
        """Test successful model list retrieval."""
        mock_response_data = {
            "data": [
                {"id": "llama-3.3-70b", "type": "text"},
                {"id": "gpt-4", "type": "text"},
            ]
        }

        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_response_data
        mock_response.raise_for_status = AsyncMock()

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.aclose = AsyncMock()

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = await venice_get_model_list_async("https://api.venice.ai/api/v1", api_key="test-key")

            assert result == mock_response_data
            mock_client.get.assert_called_once()
            call_args = mock_client.get.call_args
            assert call_args[0][0] == "https://api.venice.ai/api/v1/models"
            assert "Authorization" in call_args[1]["headers"]
            assert call_args[1]["headers"]["Authorization"] == "Bearer test-key"
            mock_client.aclose.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_model_list_without_api_key(self):
        """Test model list retrieval without API key."""
        mock_response_data = {"data": []}

        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_response_data
        mock_response.raise_for_status = AsyncMock()

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.aclose = AsyncMock()

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = await venice_get_model_list_async("https://api.venice.ai/api/v1", api_key=None)

            assert result == mock_response_data
            call_args = mock_client.get.call_args
            # Should not have Authorization header
            assert "Authorization" not in call_args[1]["headers"]

    @pytest.mark.asyncio
    async def test_get_model_list_url_normalization(self):
        """Test that URL is normalized correctly."""
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"data": []}
        mock_response.raise_for_status = AsyncMock()

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.aclose = AsyncMock()

        test_cases = [
            ("https://api.venice.ai", "https://api.venice.ai/api/v1/models"),
            ("https://api.venice.ai/", "https://api.venice.ai/api/v1/models"),
            ("https://api.venice.ai/api/v1", "https://api.venice.ai/api/v1/models"),
            ("https://custom.venice.ai/api/v1", "https://custom.venice.ai/api/v1/models"),
        ]

        with patch("httpx.AsyncClient", return_value=mock_client):
            for input_url, expected_url in test_cases:
                await venice_get_model_list_async(input_url, api_key="test-key")
                call_args = mock_client.get.call_args
                assert call_args[0][0] == expected_url
                mock_client.get.reset_mock()

    @pytest.mark.asyncio
    async def test_get_model_list_with_existing_client(self):
        """Test using an existing httpx client."""
        mock_response_data = {"data": []}

        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_response_data
        mock_response.raise_for_status = AsyncMock()

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        # Client should not be closed if provided
        mock_client.aclose = AsyncMock()

        result = await venice_get_model_list_async("https://api.venice.ai/api/v1", api_key="test-key", client=mock_client)

        assert result == mock_response_data
        mock_client.get.assert_called_once()
        # Should not close provided client
        mock_client.aclose.assert_not_called()

    @pytest.mark.asyncio
    async def test_get_model_list_http_error(self):
        """Test handling HTTP errors."""
        mock_response = AsyncMock()
        mock_response.status_code = 401
        mock_response.json.return_value = {"error": {"message": "Unauthorized"}}
        mock_response.raise_for_status = AsyncMock(side_effect=httpx.HTTPStatusError("401", request=Mock(), response=mock_response))

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.aclose = AsyncMock()

        with patch("httpx.AsyncClient", return_value=mock_client):
            with pytest.raises(httpx.HTTPStatusError):
                await venice_get_model_list_async("https://api.venice.ai/api/v1", api_key="invalid-key")

    @pytest.mark.asyncio
    async def test_get_model_list_connection_error(self):
        """Test handling connection errors."""
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=httpx.RequestError("Connection failed"))
        mock_client.aclose = AsyncMock()

        with patch("httpx.AsyncClient", return_value=mock_client):
            with pytest.raises(httpx.RequestError):
                await venice_get_model_list_async("https://api.venice.ai/api/v1", api_key="test-key")

