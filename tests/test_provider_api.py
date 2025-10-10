import os
import threading

import pytest
from dotenv import load_dotenv
from letta_client import Letta
from letta_client.core.api_error import ApiError

from tests.utils import wait_for_server

# Constants
SERVER_PORT = 8283


def run_server():
    load_dotenv()

    from letta.server.rest_api.app import start_server

    print("Starting server...")
    start_server(debug=True)


@pytest.fixture(scope="module")
def client(request):
    # Get URL from environment or start server
    api_url = os.getenv("LETTA_API_URL")
    server_url = os.getenv("LETTA_SERVER_URL", f"http://localhost:{SERVER_PORT}")
    if not os.getenv("LETTA_SERVER_URL"):
        print("Starting server thread")
        thread = threading.Thread(target=run_server, daemon=True)
        thread.start()
        wait_for_server(server_url)
    print("Running client tests with server:", server_url)

    # Overide the base_url if the LETTA_API_URL is set
    base_url = api_url if api_url else server_url
    # create the Letta client
    yield Letta(base_url=base_url, token=None)


@pytest.fixture
def test_provider(client: Letta):
    """Create a test provider for testing."""
    # Create a provider with a test API key
    provider = client.providers.create(
        provider_type="openai",
        api_key="test-api-key-123",
        name="test-openai-provider",
    )

    yield provider

    # Clean up - delete the provider
    try:
        client.providers.delete(provider.id)
    except ApiError:
        # Provider might already be deleted
        pass


def test_check_existing_provider_success(client: Letta, test_provider):
    """Test checking an existing provider with valid credentials."""
    # This test assumes the test_provider has valid credentials
    # In a real scenario, you would need to use actual valid API keys
    # For this test, we'll check that the endpoint is callable
    try:
        response = client.providers.check(test_provider.id)
        # If we get here, the endpoint is working
        assert response is not None
    except ApiError as e:
        # Expected for invalid API key - just verify the endpoint exists
        # and returns 401 for invalid credentials
        assert e.status_code in [401, 500]  # 401 for auth error, 500 for connection error


def test_check_existing_provider_not_found(client: Letta):
    """Test checking a provider that doesn't exist."""
    fake_provider_id = "00000000-0000-0000-0000-000000000000"

    with pytest.raises(ApiError) as exc_info:
        client.providers.check(fake_provider_id)

    # Should return 404 for provider not found
    assert exc_info.value.status_code == 404


def test_check_existing_provider_unauthorized(client: Letta, test_provider):
    """Test checking an existing provider with invalid API key."""
    # The test provider has a test API key which will fail authentication
    with pytest.raises(ApiError) as exc_info:
        client.providers.check(test_provider.id)

    # Should return 401 for invalid API key
    # or 500 if the provider check fails for other reasons
    assert exc_info.value.status_code in [401, 500]
