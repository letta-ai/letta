import logging
import os
from datetime import datetime, timezone
from typing import Generator

import pytest
from anthropic.types.beta.messages import BetaMessageBatch, BetaMessageBatchRequestCounts

from letta.server.db import db_registry
from letta.services.organization_manager import OrganizationManager
from letta.services.user_manager import UserManager
from letta.settings import tool_settings


def pytest_configure(config):
    logging.basicConfig(level=logging.DEBUG)


@pytest.fixture(scope="session", autouse=True)
def disable_db_pooling_for_tests():
    """Disable database connection pooling for the entire test session."""
    os.environ["LETTA_DISABLE_SQLALCHEMY_POOLING"] = "true"
    yield
    if "LETTA_DISABLE_SQLALCHEMY_POOLING" in os.environ:
        del os.environ["LETTA_DISABLE_SQLALCHEMY_POOLING"]


@pytest.fixture(autouse=True)
async def cleanup_db_connections():
    """Cleanup database connections after each test."""
    yield
    try:
        if hasattr(db_registry, "_async_engines"):
            for engine in db_registry._async_engines.values():
                if engine:
                    try:
                        await engine.dispose()
                    except Exception:
                        # Suppress common teardown errors that don't affect test validity
                        pass
        db_registry._initialized["async"] = False
        db_registry._async_engines.clear()
        db_registry._async_session_factories.clear()
    except Exception:
        # Suppress all cleanup errors to avoid confusing test failures
        pass


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
def e2b_sandbox_mode(request) -> Generator[None, None, None]:
    """
    Parametrizable fixture to enable/disable E2B sandbox mode.

    Usage:
        @pytest.mark.parametrize("e2b_sandbox_mode", [True, False], indirect=True)
        def test_function(e2b_sandbox_mode, ...):
            # Test runs twice - once with E2B enabled, once disabled
    """
    from letta.settings import tool_settings

    enable_e2b = request.param
    original_api_key = tool_settings.e2b_api_key

    if not enable_e2b:
        # Disable E2B by setting API key to None
        tool_settings.e2b_api_key = None
    # If enable_e2b is True, leave the original API key unchanged

    yield

    # Restore original API key
    tool_settings.e2b_api_key = original_api_key


@pytest.fixture
def disable_pinecone() -> Generator[None, None, None]:
    """
    Temporarily disables Pinecone by setting `settings.enable_pinecone` to False
    and `settings.pinecone_api_key` to None for the duration of the test.
    Restores the original values afterward.
    """
    from letta.settings import settings

    original_enable_pinecone = settings.enable_pinecone
    original_pinecone_api_key = settings.pinecone_api_key
    settings.enable_pinecone = False
    settings.pinecone_api_key = None
    yield
    settings.enable_pinecone = original_enable_pinecone
    settings.pinecone_api_key = original_pinecone_api_key


@pytest.fixture
def disable_turbopuffer() -> Generator[None, None, None]:
    """
    Temporarily disables Turbopuffer by setting `settings.use_tpuf` to False
    and `settings.tpuf_api_key` to None for the duration of the test.
    Also sets environment to DEV for testing.
    Restores the original values afterward.
    """
    from letta.settings import settings

    original_use_tpuf = settings.use_tpuf
    original_tpuf_api_key = settings.tpuf_api_key
    original_environment = settings.environment
    settings.use_tpuf = False
    settings.tpuf_api_key = None
    settings.environment = "DEV"
    yield
    settings.use_tpuf = original_use_tpuf
    settings.tpuf_api_key = original_tpuf_api_key
    settings.environment = original_environment


@pytest.fixture
def turbopuffer_mode(request) -> Generator[None, None, None]:
    """
    Parametrizable fixture to enable/disable Turbopuffer mode.

    Usage:
        @pytest.mark.parametrize("turbopuffer_mode", [True, False], indirect=True)
        def test_function(turbopuffer_mode, ...):
            # Test runs twice - once with Turbopuffer enabled, once disabled
    """
    from letta.settings import settings

    enable_tpuf = request.param
    original_use_tpuf = settings.use_tpuf
    original_tpuf_api_key = settings.tpuf_api_key
    original_environment = settings.environment

    # Set environment to DEV for testing
    settings.environment = "DEV"

    if not enable_tpuf:
        # Disable Turbopuffer by setting use_tpuf to False
        settings.use_tpuf = False
        settings.tpuf_api_key = None
    # If enable_tpuf is True, leave the original settings unchanged

    yield

    # Restore original settings
    settings.use_tpuf = original_use_tpuf
    settings.tpuf_api_key = original_tpuf_api_key
    settings.environment = original_environment


@pytest.fixture
def check_e2b_key_is_set():
    from letta.settings import tool_settings

    original_api_key = tool_settings.e2b_api_key
    assert original_api_key is not None, "Missing e2b key! Cannot execute these tests."
    yield


@pytest.fixture
def check_modal_key_is_set():
    from letta.settings import tool_settings

    assert tool_settings.modal_token_id is not None, "Missing modal token id! Cannot execute these tests."
    assert tool_settings.modal_token_secret is not None, "Missing modal token secret! Cannot execute these tests."
    yield


@pytest.fixture
async def default_organization():
    """Fixture to create and return the default organization."""
    manager = OrganizationManager()
    org = await manager.create_default_organization_async()
    yield org


@pytest.fixture
async def default_user(default_organization):
    """Fixture to create and return the default user within the default organization."""
    manager = UserManager()
    user = await manager.create_default_actor_async(org_id=default_organization.id)
    yield user


# --- Tool Fixtures ---
@pytest.fixture
def weather_tool_func():
    def get_weather(location: str) -> str:
        """
        Fetches the current weather for a given location.

        Args:
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
