import json
import os
import threading
import time
import uuid
from typing import List

import pytest
import requests
from dotenv import load_dotenv
from letta_client import Letta, MessageCreate
from letta_client.types import ToolReturnMessage

from letta.schemas.agent import AgentState
from letta.schemas.llm_config import LLMConfig
from letta.settings import settings

# ------------------------------
# Fixtures
# ------------------------------


@pytest.fixture(scope="module")
def server_url() -> str:
    """
    Provides the URL for the Letta server.
    If LETTA_SERVER_URL is not set, starts the server in a background thread
    and polls until it’s accepting connections.
    """

    def _run_server() -> None:
        load_dotenv()
        from letta.server.rest_api.app import start_server

        start_server(debug=True)

    url: str = os.getenv("LETTA_SERVER_URL", "http://localhost:8283")

    if not os.getenv("LETTA_SERVER_URL"):
        thread = threading.Thread(target=_run_server, daemon=True)
        thread.start()

        # Poll until the server is up (or timeout)
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

    temp = settings.use_experimental
    settings.use_experimental = True
    yield url
    settings.use_experimental = temp


@pytest.fixture(scope="module")
def client(server_url: str) -> Letta:
    """
    Creates and returns a synchronous Letta REST client for testing.
    """
    client_instance = Letta(base_url=server_url)
    yield client_instance


@pytest.fixture(scope="module")
def agent_state(client: Letta) -> AgentState:
    """
    Creates and returns an agent state for testing with a pre-configured agent.
    The agent is named 'supervisor' and is configured with base tools and the roll_dice tool.
    """
    client.tools.upsert_base_tools()

    send_message_tool = client.tools.list(name="send_message")[0]
    run_code_tool = client.tools.list(name="run_code")[0]
    web_search_tool = client.tools.list(name="web_search")[0]
    agent_state_instance = client.agents.create(
        name="supervisor",
        include_base_tools=False,
        tool_ids=[send_message_tool.id, run_code_tool.id, web_search_tool.id],
        model="openai/gpt-4o",
        embedding="letta/letta-free",
        tags=["supervisor"],
    )
    yield agent_state_instance

    client.agents.delete(agent_state_instance.id)


# ------------------------------
# Helper Functions and Constants
# ------------------------------


def get_llm_config(filename: str, llm_config_dir: str = "tests/configs/llm_model_configs") -> LLMConfig:
    filename = os.path.join(llm_config_dir, filename)
    config_data = json.load(open(filename, "r"))
    llm_config = LLMConfig(**config_data)
    return llm_config


USER_MESSAGE_OTID = str(uuid.uuid4())
all_configs = [
    "openai-gpt-4o-mini.json",
]
requested = os.getenv("LLM_CONFIG_FILE")
filenames = [requested] if requested else all_configs
TESTED_LLM_CONFIGS: List[LLMConfig] = [get_llm_config(fn) for fn in filenames]

TEST_LANGUAGES = ["Python", "Javascript", "Typescript"]
EXPECTED_INTEGER_PARTITION_OUTPUT = "190569292"


# Reference implementation in Python, to embed in the user prompt
REFERENCE_CODE = """\
def reference_partition(n):
    partitions = [1] + [0] * (n + 1)
    for k in range(1, n + 1):
        for i in range(k, n + 1):
            partitions[i] += partitions[i - k]
    return partitions[n]
"""


def reference_partition(n: int) -> int:
    # Same logic, used to compute expected result in the test
    partitions = [1] + [0] * (n + 1)
    for k in range(1, n + 1):
        for i in range(k, n + 1):
            partitions[i] += partitions[i - k]
    return partitions[n]


# ------------------------------
# Test Cases
# ------------------------------


@pytest.mark.parametrize("language", TEST_LANGUAGES, ids=TEST_LANGUAGES)
@pytest.mark.parametrize("llm_config", TESTED_LLM_CONFIGS, ids=[c.model for c in TESTED_LLM_CONFIGS])
def test_run_code(
    client: Letta,
    agent_state: AgentState,
    llm_config: LLMConfig,
    language: str,
) -> None:
    """
    Sends a reference Python implementation, asks the model to translate & run it
    in different languages, and verifies the exact partition(100) result.
    """
    expected = str(reference_partition(100))

    user_message = MessageCreate(
        role="user",
        content=(
            "Here is a Python reference implementation:\n\n"
            f"{REFERENCE_CODE}\n"
            f"Please translate and execute this code in {language} to compute p(100), "
            "and return **only** the result with no extra formatting."
        ),
        otid=USER_MESSAGE_OTID,
    )

    response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=[user_message],
    )

    tool_returns = [m for m in response.messages if isinstance(m, ToolReturnMessage)]
    assert tool_returns, f"No ToolReturnMessage found for language: {language}"

    returns = [m.tool_return for m in tool_returns]
    assert any(expected in ret for ret in returns), (
        f"For language={language!r}, expected to find '{expected}' in tool_return, " f"but got {returns!r}"
    )


@pytest.mark.parametrize("llm_config", TESTED_LLM_CONFIGS, ids=[c.model for c in TESTED_LLM_CONFIGS])
def test_web_search(
    client: Letta,
    agent_state: AgentState,
    llm_config: LLMConfig,
) -> None:
    user_message = MessageCreate(
        role="user",
        content="Use the web search tool to find the latest news about San Francisco.",
        otid=USER_MESSAGE_OTID,
    )

    response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=[user_message],
    )

    tool_returns = [m for m in response.messages if isinstance(m, ToolReturnMessage)]
    assert tool_returns, "No ToolReturnMessage found"

    returns = [m.tool_return for m in tool_returns]
    expected = "RESULT 1:"
    assert any(expected in ret for ret in returns), f"Expected to find '{expected}' in tool_return, " f"but got {returns!r}"
