import logging
import os
import socket
import threading
import time
from datetime import datetime, timezone
from typing import Generator

import pytest
import requests
from anthropic.types.beta.messages import BetaMessageBatch, BetaMessageBatchRequestCounts
from dotenv import load_dotenv
from letta_client import AsyncLetta, Letta

from letta.schemas.agent import AgentState
from letta.schemas.llm_config import LLMConfig
from letta.services.organization_manager import OrganizationManager
from letta.services.user_manager import UserManager
from letta.settings import tool_settings


def pytest_configure(config):
    logging.basicConfig(level=logging.DEBUG)


@pytest.fixture
def disable_e2b_api_key() -> Generator[None, None, None]:
    """
    Temporarily disables the E2B API key by setting `tool_settings.e2b_api_key` to None
    for the duration of the test. Restores the original value afterward.
    """
    from letta.settings import tool_settings

    original_api_key = tool_settings.e2b_api_key
    tool_settings.e2b_api_key = None
    yield
    tool_settings.e2b_api_key = original_api_key


@pytest.fixture
def check_e2b_key_is_set():
    from letta.settings import tool_settings

    original_api_key = tool_settings.e2b_api_key
    assert original_api_key is not None, "Missing e2b key! Cannot execute these tests."
    yield


@pytest.fixture
def default_organization():
    """Fixture to create and return the default organization."""
    manager = OrganizationManager()
    org = manager.create_default_organization()
    yield org


@pytest.fixture
def default_user(default_organization):
    """Fixture to create and return the default user within the default organization."""
    manager = UserManager()
    user = manager.create_default_user(org_id=default_organization.id)
    yield user


# --- Tool Fixtures ---
@pytest.fixture
def weather_tool_func():
    def get_weather(location: str) -> str:
        """
        Fetches the current weather for a given location.

        Parameters:
            location (str): The location to get the weather for.

        Returns:
            str: A formatted string describing the weather in the given location.

        Raises:
            RuntimeError: If the request to fetch weather data fails.
        """
        import requests

        url = f"https://wttr.in/{location}?format=%C+%t"

        response = requests.get(url)
        if response.status_code == 200:
            weather_data = response.text
            return f"The weather in {location} is {weather_data}."
        else:
            raise RuntimeError(f"Failed to get weather data, status code: {response.status_code}")

    yield get_weather


@pytest.fixture
def print_tool_func():
    """Fixture to create a tool with default settings and clean up after the test."""

    def print_tool(message: str):
        """
        Args:
            message (str): The message to print.

        Returns:
            str: The message that was printed.
        """
        print(message)
        return message

    yield print_tool


@pytest.fixture
def roll_dice_tool_func():
    def roll_dice():
        """
        Rolls a 6 sided die.

        Returns:
            str: The roll result.
        """
        import time

        time.sleep(1)
        return "Rolled a 10!"

    yield roll_dice


@pytest.fixture
def dummy_beta_message_batch() -> BetaMessageBatch:
    return BetaMessageBatch(
        id="msgbatch_013Zva2CMHLNnXjNJJKqJ2EF",
        archived_at=datetime(2024, 8, 20, 18, 37, 24, 100435, tzinfo=timezone.utc),
        cancel_initiated_at=datetime(2024, 8, 20, 18, 37, 24, 100435, tzinfo=timezone.utc),
        created_at=datetime(2024, 8, 20, 18, 37, 24, 100435, tzinfo=timezone.utc),
        ended_at=datetime(2024, 8, 20, 18, 37, 24, 100435, tzinfo=timezone.utc),
        expires_at=datetime(2024, 8, 20, 18, 37, 24, 100435, tzinfo=timezone.utc),
        processing_status="in_progress",
        request_counts=BetaMessageBatchRequestCounts(
            canceled=10,
            errored=30,
            expired=10,
            processing=100,
            succeeded=50,
        ),
        results_url="https://api.anthropic.com/v1/messages/batches/msgbatch_013Zva2CMHLNnXjNJJKqJ2EF/results",
        type="message_batch",
    )


# --- Model Sweep ---
# Global flag to track server state
_server_started = False
_server_url = None


def _start_server_once() -> str:
    """Start server exactly once, return URL"""
    global _server_started, _server_url

    if _server_started and _server_url:
        return _server_url

    url = os.getenv("LETTA_SERVER_URL", "http://localhost:8283")

    # Check if already running
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        if s.connect_ex(("localhost", 8283)) == 0:
            _server_started = True
            _server_url = url
            return url

    # Start server (your existing logic)
    if not os.getenv("LETTA_SERVER_URL"):

        def _run_server():
            load_dotenv()
            from letta.server.rest_api.app import start_server

            start_server(debug=True)

        thread = threading.Thread(target=_run_server, daemon=True)
        thread.start()

        # Poll until up
        timeout_seconds = 30
        deadline = time.time() + timeout_seconds
        while time.time() < deadline:
            try:
                resp = requests.get(url + "/v1/health")
                if resp.status_code < 500:
                    break
            except requests.exceptions.RequestException:
                pass
            time.sleep(0.1)
        else:
            raise RuntimeError(f"Could not reach {url} within {timeout_seconds}s")

    _server_started = True
    _server_url = url
    return url


# ------------------------------
# Fixtures
# ------------------------------


@pytest.fixture(scope="module")
def server_url() -> str:
    """Return URL of already-started server"""
    return _start_server_once()


@pytest.fixture(scope="module")
def client(server_url: str) -> Letta:
    """
    Creates and returns a synchronous Letta REST client for testing.
    """
    client_instance = Letta(base_url=server_url)
    yield client_instance


@pytest.fixture(scope="function")
def async_client(server_url: str) -> AsyncLetta:
    """
    Creates and returns an asynchronous Letta REST client for testing.
    """
    async_client_instance = AsyncLetta(base_url=server_url)
    yield async_client_instance


@pytest.fixture(scope="module")
def agent_state(client: Letta) -> AgentState:
    """
    Creates and returns an agent state for testing with a pre-configured agent.
    The agent is named 'supervisor' and is configured with base tools and the roll_dice tool.
    """
    client.tools.upsert_base_tools()

    send_message_tool = client.tools.list(name="send_message")[0]
    agent_state_instance = client.agents.create(
        name="supervisor",
        include_base_tools=False,
        tool_ids=[send_message_tool.id],
        model="openai/gpt-4o",
        embedding="letta/letta-free",
        tags=["supervisor"],
    )
    yield agent_state_instance

    client.agents.delete(agent_state_instance.id)


@pytest.fixture(scope="module")
def all_available_llm_configs(client: Letta) -> [LLMConfig]:
    """
    Returns a list of all available LLM configs.
    """
    llm_configs = client.models.list()
    return llm_configs


# create a client to the started server started at
def get_available_llm_configs() -> [LLMConfig]:
    """Get configs, starting server if needed"""
    server_url = _start_server_once()
    temp_client = Letta(base_url=server_url)
    return temp_client.models.list()


# dynamically insert llm_config paramter at collection time
def pytest_generate_tests(metafunc):
    """Dynamically parametrize tests that need llm_config."""
    if "llm_config" in metafunc.fixturenames:
        configs = get_available_llm_configs()
        if configs:
            metafunc.parametrize("llm_config", configs, ids=[c.model for c in configs])
