import json
import os
import threading
import time
import uuid
from unittest.mock import MagicMock, patch

import pytest
import requests
from dotenv import load_dotenv
from letta_client import Letta
from letta_client.types import AgentState, MessageCreateParam, ToolReturnMessage
from letta_client.types.agents import ToolCallMessage

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
    Uses system-level EXA_API_KEY setting.
    """
    client.tools.upsert_base_tools()

    send_message_tool = client.tools.list(name="send_message").items[0]
    run_code_tool = client.tools.list(name="run_code").items[0]
    web_search_tool = client.tools.list(name="web_search").items[0]
    agent_state_instance = client.agents.create(
        name="test_builtin_tools_agent",
        include_base_tools=False,
        tool_ids=[send_message_tool.id, run_code_tool.id, web_search_tool.id],
        model="openai/gpt-4o",
        embedding="openai/text-embedding-3-small",
        tags=["test_builtin_tools_agent"],
    )
    yield agent_state_instance


# ------------------------------
# Helper Functions and Constants
# ------------------------------

USER_MESSAGE_OTID = str(uuid.uuid4())
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
def test_run_code(
    client: Letta,
    agent_state: AgentState,
    language: str,
) -> None:
    """
    Sends a reference Python implementation, asks the model to translate & run it
    in different languages, and verifies the exact partition(100) result.
    """
    expected = str(reference_partition(100))

    user_message = MessageCreateParam(
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
        f"For language={language!r}, expected to find '{expected}' in tool_return, but got {returns!r}"
    )


@pytest.mark.asyncio(scope="function")
async def test_web_search() -> None:
    """Test web search tool with mocked Exa API."""

    # create mock agent state with exa api key
    mock_agent_state = MagicMock()
    mock_agent_state.get_agent_env_vars_as_dict.return_value = {"EXA_API_KEY": "test-exa-key"}

    # Mock Exa search result with education information
    mock_exa_result = MagicMock()
    mock_exa_result.results = [
        MagicMock(
            title="Charles Packer - UC Berkeley PhD in Computer Science",
            url="https://example.com/charles-packer-profile",
            published_date="2023-01-01",
            author="UC Berkeley",
            text=None,
            highlights=["Charles Packer completed his PhD at UC Berkeley", "Research in artificial intelligence and machine learning"],
            summary="Charles Packer is the CEO of Letta who earned his PhD in Computer Science from UC Berkeley, specializing in AI research.",
        ),
        MagicMock(
            title="Letta Leadership Team",
            url="https://letta.com/team",
            published_date="2023-06-01",
            author="Letta",
            text=None,
            highlights=["CEO Charles Packer brings academic expertise"],
            summary="Leadership team page featuring CEO Charles Packer's educational background.",
        ),
    ]

    with patch("exa_py.Exa") as mock_exa_class:
        # Setup mock
        mock_exa_client = MagicMock()
        mock_exa_class.return_value = mock_exa_client
        mock_exa_client.search_and_contents.return_value = mock_exa_result

        # create executor with mock dependencies
        executor = LettaBuiltinToolExecutor(
            message_manager=MagicMock(),
            agent_manager=MagicMock(),
            block_manager=MagicMock(),
            run_manager=MagicMock(),
            passage_manager=MagicMock(),
            actor=MagicMock(),
        )

        # call web_search directly
        result = await executor.web_search(
            agent_state=mock_agent_state,
            query="where did Charles Packer, CEO of Letta, go to school",
            num_results=10,
            include_text=False,
        )

        # Parse the JSON response from web_search
        response_json = json.loads(result)

        # Basic structure assertions for new Exa format
        assert "query" in response_json, "Missing 'query' field in response"
        assert "results" in response_json, "Missing 'results' field in response"

        # Verify we got search results
        results = response_json["results"]
        assert len(results) == 2, "Should have found exactly 2 search results from mock"

        # Check each result has the expected structure
        found_education_info = False
        for result in results:
            assert "title" in result, "Result missing title"
            assert "url" in result, "Result missing URL"

            # text should not be present since include_text=False by default
            assert "text" not in result or result["text"] is None, "Text should not be included by default"

            # Check for education-related information in summary and highlights
            result_text = ""
            if "summary" in result and result["summary"]:
                result_text += " " + result["summary"].lower()
            if "highlights" in result and result["highlights"]:
                for highlight in result["highlights"]:
                    result_text += " " + highlight.lower()

            # Look for education keywords
            if any(keyword in result_text for keyword in ["berkeley", "university", "phd", "ph.d", "education", "student"]):
                found_education_info = True

        assert found_education_info, "Should have found education-related information about Charles Packer"

        # Verify Exa was called with correct parameters
        mock_exa_class.assert_called_once_with(api_key="test-exa-key")
        mock_exa_client.search_and_contents.assert_called_once()
        call_args = mock_exa_client.search_and_contents.call_args
        assert call_args[1]["type"] == "auto"
        assert call_args[1]["text"] is False  # Default is False now


@pytest.mark.asyncio(scope="function")
async def test_web_search_uses_exa():
    """Test that web search uses Exa API correctly."""

    # create mock agent state with exa api key
    mock_agent_state = MagicMock()
    mock_agent_state.get_agent_env_vars_as_dict.return_value = {"EXA_API_KEY": "test-exa-key"}

    # Mock exa search result
    mock_exa_result = MagicMock()
    mock_exa_result.results = [
        MagicMock(
            title="Test Result",
            url="https://example.com/test",
            published_date="2023-01-01",
            author="Test Author",
            text="This is test content from the search result.",
            highlights=["This is a highlight"],
            summary="This is a summary of the content.",
        )
    ]

    with patch("exa_py.Exa") as mock_exa_class:
        # Mock Exa
        mock_exa_client = MagicMock()
        mock_exa_class.return_value = mock_exa_client
        mock_exa_client.search_and_contents.return_value = mock_exa_result

        # create executor with mock dependencies
        executor = LettaBuiltinToolExecutor(
            message_manager=MagicMock(),
            agent_manager=MagicMock(),
            block_manager=MagicMock(),
            run_manager=MagicMock(),
            passage_manager=MagicMock(),
            actor=MagicMock(),
        )

        result = await executor.web_search(agent_state=mock_agent_state, query="test query", num_results=3, include_text=True)

        # Verify Exa was called correctly
        mock_exa_class.assert_called_once_with(api_key="test-exa-key")
        mock_exa_client.search_and_contents.assert_called_once()

        # Check the call arguments
        call_args = mock_exa_client.search_and_contents.call_args
        assert call_args[1]["query"] == "test query"
        assert call_args[1]["num_results"] == 3
        assert call_args[1]["type"] == "auto"
        assert call_args[1]["text"] == True

        # Verify the response format
        response_json = json.loads(result)
        assert "query" in response_json
        assert "results" in response_json
        assert response_json["query"] == "test query"
        assert len(response_json["results"]) == 1


# ------------------------------
# Programmatic Tool Calling Tests
# ------------------------------


ADD_TOOL_SOURCE = """
def add(a: int, b: int) -> int:
    \"\"\"Add two numbers together.

    Args:
        a (int): The first number.
        b (int): The second number.

    Returns:
        int: The sum of a and b.
    \"\"\"
    return a + b
"""

MULTIPLY_TOOL_SOURCE = """
def multiply(a: int, b: int) -> int:
    \"\"\"Multiply two numbers together.

    Args:
        a (int): The first number.
        b (int): The second number.

    Returns:
        int: The product of a and b.
    \"\"\"
    return a * b
"""


@pytest.fixture(scope="function")
def agent_with_custom_tools(client: Letta) -> AgentState:
    """
    Creates an agent with custom add/multiply tools and run_code tool
    to test programmatic tool calling.
    """
    client.tools.upsert_base_tools()

    # Create custom tools
    add_tool = client.tools.create(source_code=ADD_TOOL_SOURCE)
    multiply_tool = client.tools.create(source_code=MULTIPLY_TOOL_SOURCE)

    # Get the run_code tool
    run_code_tool = client.tools.list(name="run_code").items[0]
    send_message_tool = client.tools.list(name="send_message").items[0]

    agent_state_instance = client.agents.create(
        name="test_programmatic_tool_calling_agent",
        include_base_tools=False,
        tool_ids=[send_message_tool.id, run_code_tool.id, add_tool.id, multiply_tool.id],
        model="openai/gpt-4o",
        embedding="openai/text-embedding-3-small",
        tags=["test_programmatic_tool_calling"],
    )
    yield agent_state_instance

    # Cleanup
    client.agents.delete(agent_state_instance.id)
    client.tools.delete(add_tool.id)
    client.tools.delete(multiply_tool.id)


def test_programmatic_tool_calling_compose_tools(
    client: Letta,
    agent_with_custom_tools: AgentState,
) -> None:
    """
    Tests that run_code can compose agent tools programmatically in a SINGLE call.
    This validates that:
    1. Tool source code is injected into the sandbox
    2. Claude composes tools in one run_code call, not multiple separate tool calls
    3. The result is computed correctly: add(multiply(4, 5), 6) = 26
    """
    # Expected result: multiply(4, 5) = 20, add(20, 6) = 26
    expected = "26"

    user_message = MessageCreateParam(
        role="user",
        content=(
            "Use the run_code tool to execute Python code that composes the add and multiply tools. "
            "Calculate add(multiply(4, 5), 6) and return the result. "
            "The add and multiply functions are already available in the code execution environment. "
            "Do this in a SINGLE run_code call - do NOT call add or multiply as separate tools."
        ),
        otid=str(uuid.uuid4()),
    )

    response = client.agents.messages.create(
        agent_id=agent_with_custom_tools.id,
        messages=[user_message],
    )

    # Extract all tool calls
    tool_calls = [m for m in response.messages if isinstance(m, ToolCallMessage)]
    assert tool_calls, "No ToolCallMessage found for programmatic tool calling test"

    # Verify the agent used run_code to compose tools, not direct add/multiply calls
    tool_names = [m.tool_call.name for m in tool_calls]
    run_code_calls = [name for name in tool_names if name == "run_code"]
    direct_add_calls = [name for name in tool_names if name == "add"]
    direct_multiply_calls = [name for name in tool_names if name == "multiply"]

    # The key assertion: tools should be composed via run_code, not called directly
    assert len(run_code_calls) >= 1, f"Expected at least one run_code call, but got tool calls: {tool_names}"
    assert len(direct_add_calls) == 0, (
        f"Expected no direct 'add' tool calls (should be called via run_code), but found {len(direct_add_calls)}"
    )
    assert len(direct_multiply_calls) == 0, (
        f"Expected no direct 'multiply' tool calls (should be called via run_code), but found {len(direct_multiply_calls)}"
    )

    # Verify the result is correct
    tool_returns = [m for m in response.messages if isinstance(m, ToolReturnMessage)]
    returns = [m.tool_return for m in tool_returns]
    assert any(expected in ret for ret in returns), f"Expected to find '{expected}' in tool_return, but got {returns!r}"


@pytest.mark.asyncio(scope="function")
async def test_run_code_injects_tool_source_code() -> None:
    """
    Unit test that verifies run_code injects agent tool source code into the sandbox.
    This test directly calls run_code with a mocked agent_state containing tools.
    """
    from letta.schemas.tool import Tool

    # Create mock agent state with tools that have source code
    mock_agent_state = MagicMock()
    mock_agent_state.tools = [
        Tool(
            id="tool-00000001",
            name="add",
            source_code=ADD_TOOL_SOURCE.strip(),
        ),
        Tool(
            id="tool-00000002",
            name="multiply",
            source_code=MULTIPLY_TOOL_SOURCE.strip(),
        ),
    ]

    # Skip if E2B_API_KEY is not set
    if not tool_settings.e2b_api_key:
        pytest.skip("E2B_API_KEY not set, skipping run_code test")

    # Create executor with mock dependencies
    executor = LettaBuiltinToolExecutor(
        message_manager=MagicMock(),
        agent_manager=MagicMock(),
        block_manager=MagicMock(),
        run_manager=MagicMock(),
        passage_manager=MagicMock(),
        actor=MagicMock(),
    )

    # Execute code that composes the tools
    # Note: We don't define add/multiply in the code - they should be injected from tool source
    result = await executor.run_code(
        agent_state=mock_agent_state,
        code="print(add(multiply(4, 5), 6))",
        language="python",
    )

    response_json = json.loads(result)

    # Verify execution succeeded and returned correct result
    assert "error" not in response_json or response_json.get("error") is None, f"Code execution failed: {response_json}"
    assert "26" in str(response_json["results"]) or "26" in str(response_json["logs"]["stdout"]), (
        f"Expected '26' in results, got: {response_json}"
    )
