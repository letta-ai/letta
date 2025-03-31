from typing import Optional

import pytest

from letta.llm_api.google_ai_client import GoogleAIClient
from letta.local_llm.constants import INNER_THOUGHTS_KWARG, INNER_THOUGHTS_KWARG_DESCRIPTION
from letta.schemas.llm_config import LLMConfig
from letta.schemas.openai.chat_completion_request import FunctionSchema, Tool


# Mock LLMConfig class
class MockLLMConfig:
    def __init__(self, put_inner_thoughts_in_kwargs: bool = False):
        self.model = "gemini-2.0-flash"
        self.model_endpoint = "https://generativelanguage.googleapis.com"
        self.model_endpoint_type = "google_ai"
        self.model_wrapper = None
        self.context_window = 8192
        self.put_inner_thoughts_in_kwargs = put_inner_thoughts_in_kwargs


# Mock LLMClientBase for inheritance
class MockLLMClientBase:
    def __init__(
        self,
        llm_config: LLMConfig,
        put_inner_thoughts_first: Optional[bool] = True,
        use_structured_output: Optional[bool] = True,
        use_tool_naming: bool = True,
    ):
        self.llm_config = llm_config
        self.put_inner_thoughts_first = put_inner_thoughts_first
        self.use_tool_naming = use_tool_naming


GoogleAIClient.__bases__ = (MockLLMClientBase,)


@pytest.fixture
def google_ai_client(put_inner_thoughts: bool = False):
    config = MockLLMConfig(put_inner_thoughts_in_kwargs=put_inner_thoughts)
    return GoogleAIClient(llm_config=config)


@pytest.fixture
def composio_search_tool():
    return Tool(
        type="function",
        function=FunctionSchema(
            name="composio_search_tavily_search",
            description="The composio LLM search class serves as a gateway to the composio LLM search API, allowing users to perform searches across a broad range of content with multiple filtering options.",
            parameters={
                "type": "object",
                "properties": {
                    "inner_thoughts": {"type": "string", "description": "Deep inner monologue private to you only."},
                    "query": {"type": "string", "description": "The primary text used to perform the search."},
                    "search_depth": {
                        "type": "string",
                        "description": "Determines the thoroughness of the search.",
                        "default": "basic",
                        "enum": ["basic", "advanced"],
                    },
                    "include_images": {"type": "boolean", "description": "A flag indicating whether to include images.", "default": False},
                    "max_results": {"type": "integer", "description": "The maximum number of search results.", "default": 5},
                    "request_heartbeat": {"type": "boolean", "description": "Request an immediate heartbeat after function execution."},
                },
                "required": ["inner_thoughts", "query", "request_heartbeat"],
            },
            strict=False,
        ),
    )


@pytest.fixture
def simple_tool():
    return Tool(
        type="function",
        function=FunctionSchema(
            name="simple_search",
            description="A simple search function.",
            parameters={
                "type": "object",
                "properties": {"query": {"type": "string", "description": "Search query."}},
                "required": ["query"],
            },
            strict=False,
        ),
    )


@pytest.mark.parametrize("put_inner_thoughts", [False, True])
def test_convert_tools_to_google_ai_format_composio(google_ai_client, composio_search_tool, put_inner_thoughts):
    """Test conversion of the complex Composio search tool schema."""
    google_ai_client.llm_config.put_inner_thoughts_in_kwargs = put_inner_thoughts
    result = google_ai_client.convert_tools_to_google_ai_format([composio_search_tool])

    assert len(result) == 1, "Expected a single function declaration block"
    assert "functionDeclarations" in result[0], "Expected 'functionDeclarations' key"
    assert len(result[0]["functionDeclarations"]) == 1, "Expected one function"

    func = result[0]["functionDeclarations"][0]
    assert func["name"] == "composio_search_tavily_search"
    assert func["description"] == composio_search_tool.function.description
    assert func["parameters"]["type"] == "OBJECT"

    props = func["parameters"]["properties"]
    assert props["query"]["type"] == "STRING"
    assert props["search_depth"]["type"] == "STRING"
    assert "default" not in props["search_depth"], "'default' should be removed"
    assert props["search_depth"]["enum"] == ["basic", "advanced"]
    assert props["include_images"]["type"] == "BOOLEAN"
    assert "default" not in props["include_images"], "'default' should be removed"
    assert props["max_results"]["type"] == "INTEGER"
    assert "default" not in props["max_results"], "'default' should be removed"
    assert props["request_heartbeat"]["type"] == "BOOLEAN"

    # Check inner_thoughts handling
    if put_inner_thoughts:
        assert INNER_THOUGHTS_KWARG in props
        assert props[INNER_THOUGHTS_KWARG]["type"] == "STRING"
        assert props[INNER_THOUGHTS_KWARG]["description"] == INNER_THOUGHTS_KWARG_DESCRIPTION
        assert INNER_THOUGHTS_KWARG in func["parameters"]["required"]
    else:
        assert "inner_thoughts" in props  # Original field remains
        assert props["inner_thoughts"]["type"] == "STRING"
        assert "inner_thoughts" in func["parameters"]["required"]

    # Verify required fields
    expected_required = ["inner_thoughts", "query", "request_heartbeat"]
    if put_inner_thoughts:
        expected_required.append(INNER_THOUGHTS_KWARG)
    assert sorted(func["parameters"]["required"]) == sorted(expected_required)


def test_convert_tools_to_google_ai_format_simple(google_ai_client, simple_tool):
    """Test conversion of a simple tool schema without defaults or inner thoughts."""
    result = google_ai_client.convert_tools_to_google_ai_format([simple_tool])

    assert len(result) == 1
    assert "functionDeclarations" in result[0]
    assert len(result[0]["functionDeclarations"]) == 1

    func = result[0]["functionDeclarations"][0]
    assert func["name"] == "simple_search"
    assert func["description"] == "A simple search function."
    assert func["parameters"]["type"] == "OBJECT"

    props = func["parameters"]["properties"]
    assert len(props) == 1
    assert props["query"]["type"] == "STRING"
    assert "default" not in props["query"]

    assert func["parameters"]["required"] == ["query"]
