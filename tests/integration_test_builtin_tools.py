import json
import os
import threading
import time
import uuid
from typing import List
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import requests
from dotenv import load_dotenv
from letta_client import Letta, MessageCreate
from letta_client.types import ToolReturnMessage

from letta.constants import WEB_SEARCH_MODEL_ENV_VAR_NAME
from letta.functions.types import SearchTask
from letta.schemas.agent import AgentState
from letta.schemas.llm_config import LLMConfig
from letta.services.tool_executor.builtin_tool_executor import LettaBuiltinToolExecutor
from letta.settings import tool_settings

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

    yield url


@pytest.fixture(scope="module")
def client(server_url: str) -> Letta:
    """
    Creates and returns a synchronous Letta REST client for testing.
    """
    client_instance = Letta(base_url=server_url)
    yield client_instance


@pytest.fixture(scope="function")
def agent_state(client: Letta) -> AgentState:
    """
    Creates and returns an agent state for testing with a pre-configured agent.
    """
    client.tools.upsert_base_tools()

    send_message_tool = client.tools.list(name="send_message")[0]
    run_code_tool = client.tools.list(name="run_code")[0]
    web_search_tool = client.tools.list(name="web_search")[0]
    agent_state_instance = client.agents.create(
        name="test_builtin_tools_agent",
        include_base_tools=False,
        tool_ids=[send_message_tool.id, run_code_tool.id, web_search_tool.id],
        model="openai/gpt-4o",
        embedding="letta/letta-free",
        tags=["test_builtin_tools_agent"],
    )
    yield agent_state_instance


@pytest.fixture(scope="module")
def agent_state_with_firecrawl_key(client: Letta) -> AgentState:
    """
    Creates and returns an agent state for testing with a pre-configured agent.
    """
    client.tools.upsert_base_tools()

    send_message_tool = client.tools.list(name="send_message")[0]
    run_code_tool = client.tools.list(name="run_code")[0]
    web_search_tool = client.tools.list(name="web_search")[0]
    agent_state_instance = client.agents.create(
        name="test_builtin_tools_agent",
        include_base_tools=False,
        tool_ids=[send_message_tool.id, run_code_tool.id, web_search_tool.id],
        model="openai/gpt-4o",
        embedding="letta/letta-free",
        tags=["test_builtin_tools_agent"],
        tool_exec_environment_variables={"FIRECRAWL_API_KEY": tool_settings.firecrawl_api_key},
    )
    yield agent_state_instance


@pytest.fixture(scope="module")
def agent_state_with_web_search_env_var(client: Letta) -> AgentState:
    """
    Creates and returns an agent state for testing with a pre-configured agent.
    """
    client.tools.upsert_base_tools()

    send_message_tool = client.tools.list(name="send_message")[0]
    run_code_tool = client.tools.list(name="run_code")[0]
    web_search_tool = client.tools.list(name="web_search")[0]
    agent_state_instance = client.agents.create(
        name="test_builtin_tools_agent",
        include_base_tools=False,
        tool_ids=[send_message_tool.id, run_code_tool.id, web_search_tool.id],
        model="openai/gpt-4o",
        embedding="letta/letta-free",
        tags=["test_builtin_tools_agent"],
        tool_exec_environment_variables={WEB_SEARCH_MODEL_ENV_VAR_NAME: "gpt-4o"},
    )
    yield agent_state_instance


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
        content="I am executing a test. Use the web search tool to find where I, Charles Packer, the CEO of Letta, went to school.",
        otid=USER_MESSAGE_OTID,
    )

    response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=[user_message],
    )

    tool_returns = [m for m in response.messages if isinstance(m, ToolReturnMessage)]
    assert tool_returns, "No ToolReturnMessage found"

    returns = [m.tool_return for m in tool_returns]
    print(returns)

    # Parse the JSON response from web_search
    assert len(returns) > 0, "No tool returns found"
    response_json = json.loads(returns[0])

    # Basic structure assertions
    assert "api_key_source" in response_json, "Missing 'api_key_source' field in response"
    assert "results" in response_json, "Missing 'results' field in response"
    assert response_json["api_key_source"] == "system_settings"

    # Get the first result from the results dictionary
    results = response_json["results"]
    assert len(results) > 0, "No results found in response"

    # Get the first (and typically only) result
    first_result_key = list(results.keys())[0]
    result_data = results[first_result_key]

    # Basic structure assertions for the result data
    assert "query" in result_data, "Missing 'query' field in result"
    assert "question" in result_data, "Missing 'question' field in result"

    # Check if we have the new response format with raw_results
    if "raw_results" in result_data:
        # New format with raw_results
        assert "raw_results" in result_data, "Missing 'raw_results' field in result"
        raw_results = result_data["raw_results"]

        assert "success" in raw_results, "Missing 'success' field in raw_results"
        assert "data" in raw_results, "Missing 'data' field in raw_results"

        # Verify we got search results
        assert len(raw_results["data"]) > 0, "Should have found at least one search result"

        # Check if we found education-related information in the search results
        found_education_info = False
        for item in raw_results["data"]:
            # Check in description
            if "description" in item:
                desc_lower = item["description"].lower()
                if any(keyword in desc_lower for keyword in ["berkeley", "university", "education", "phd", "student"]):
                    found_education_info = True
                    break

            # Also check in markdown content if available
            if "markdown" in item:
                markdown_lower = item["markdown"].lower()
                if any(keyword in markdown_lower for keyword in ["berkeley", "university", "phd", "student"]):
                    found_education_info = True
                    break

        # We should find education info since we now have successful scraping with markdown content
        assert found_education_info, "Should have found education-related information about Charles Packer"

    else:
        # Parsed format with total_sources, total_citations, sources
        assert "total_sources" in result_data, "Missing 'total_sources' field in result"
        assert "total_citations" in result_data, "Missing 'total_citations' field in result"
        assert "sources" in result_data, "Missing 'sources' field in result"

        # Content assertions
        assert result_data["total_sources"] > 0, "Should have found at least one source"
        assert result_data["total_citations"] > 0, "Should have found at least one citation"
        assert len(result_data["sources"]) == result_data["total_sources"], "Sources count mismatch"

        # Verify we found information about Charles Packer's education
        found_education_info = False
        for source in result_data["sources"]:
            assert "url" in source, "Source missing URL"
            assert "title" in source, "Source missing title"
            assert "citations" in source, "Source missing citations"

            for citation in source["citations"]:
                assert "text" in citation, "Citation missing text"

                # Check if we found education-related information
                if any(keyword in citation["text"].lower() for keyword in ["berkeley", "phd", "ph.d", "university", "student"]):
                    found_education_info = True

        assert found_education_info, "Should have found education-related information about Charles Packer"

    # API key source should be valid
    assert response_json["api_key_source"] in [
        "agent_environment",
        "system_settings",
    ], f"Invalid api_key_source: {response_json['api_key_source']}"


@pytest.mark.asyncio(scope="function")
async def test_web_search_uses_agent_env_var_model():
    """Test that web search uses the model specified in agent tool exec env vars."""

    # create mock agent state with web search model env var
    mock_agent_state = MagicMock()
    mock_agent_state.get_agent_env_vars_as_dict.return_value = {WEB_SEARCH_MODEL_ENV_VAR_NAME: "gpt-4o"}

    # mock openai response
    mock_openai_response = MagicMock()
    mock_openai_response.usage = MagicMock()
    mock_openai_response.usage.total_tokens = 100
    mock_openai_response.usage.prompt_tokens = 80
    mock_openai_response.usage.completion_tokens = 20
    mock_openai_response.choices = [MagicMock()]
    mock_openai_response.choices[0].message.parsed = MagicMock()
    mock_openai_response.choices[0].message.parsed.citations = []

    with (
        patch("openai.AsyncOpenAI") as mock_openai_class,
        patch("letta.services.tool_executor.builtin_tool_executor.model_settings") as mock_model_settings,
        patch.dict(os.environ, {WEB_SEARCH_MODEL_ENV_VAR_NAME: "gpt-4o"}),
        patch("firecrawl.AsyncFirecrawlApp") as mock_firecrawl_class,
    ):

        # setup mocks
        mock_model_settings.openai_api_key = "test-key"

        mock_openai_client = AsyncMock()
        mock_openai_class.return_value = mock_openai_client
        mock_openai_client.beta.chat.completions.parse.return_value = mock_openai_response

        # Mock Firecrawl
        mock_firecrawl_app = AsyncMock()
        mock_firecrawl_class.return_value = mock_firecrawl_app

        # Mock search results with markdown content
        mock_search_result = {
            "data": [
                {
                    "url": "https://example.com/test",
                    "title": "Test Result",
                    "description": "Test description",
                    "markdown": "This is test markdown content for the search result.",
                }
            ]
        }
        mock_firecrawl_app.search.return_value = mock_search_result

        # create executor with mock dependencies
        executor = LettaBuiltinToolExecutor(
            message_manager=MagicMock(),
            agent_manager=MagicMock(),
            block_manager=MagicMock(),
            job_manager=MagicMock(),
            passage_manager=MagicMock(),
            actor=MagicMock(),
        )

        task = SearchTask(query="test query", question="test question")

        await executor.web_search(agent_state=mock_agent_state, tasks=[task], limit=1, return_raw=False)

        # verify correct model was used
        mock_openai_client.beta.chat.completions.parse.assert_called_once()
        call_args = mock_openai_client.beta.chat.completions.parse.call_args
        assert call_args[1]["model"] == "gpt-4o"


@pytest.mark.parametrize("llm_config", TESTED_LLM_CONFIGS, ids=[c.model for c in TESTED_LLM_CONFIGS])
def test_web_search_using_agent_state_env_var(
    client: Letta,
    agent_state_with_firecrawl_key: AgentState,
    llm_config: LLMConfig,
) -> None:
    user_message = MessageCreate(
        role="user",
        content="I am executing a test. Use the web search tool to find where I, Charles Packer, the CEO of Letta, went to school.",
        otid=USER_MESSAGE_OTID,
    )

    response = client.agents.messages.create(
        agent_id=agent_state_with_firecrawl_key.id,
        messages=[user_message],
    )

    tool_returns = [m for m in response.messages if isinstance(m, ToolReturnMessage)]
    assert tool_returns, "No ToolReturnMessage found"

    returns = [m.tool_return for m in tool_returns]
    print(returns)

    # Parse the JSON response from web search
    assert len(returns) > 0, "No tool returns found"
    response_json = json.loads(returns[0])

    # Basic structure assertions
    assert "api_key_source" in response_json, "Missing 'api_key_source' field in response"
    assert "results" in response_json, "Missing 'results' field in response"
    assert response_json["api_key_source"] == "agent_environment"
