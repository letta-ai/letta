import logging
from datetime import datetime, timezone
from typing import Generator

import pytest
from anthropic.types.beta.messages import BetaMessageBatch, BetaMessageBatchRequestCounts

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


@pytest.fixture
def check_composio_key_set():
    original_api_key = tool_settings.composio_api_key
    assert original_api_key is not None, "Missing composio key! Cannot execute this test."
    yield


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
