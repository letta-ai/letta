import json
import logging
import uuid
from typing import Callable, List, Optional, Sequence

from letta.llm_api.helpers import unpack_inner_thoughts_from_kwargs
from letta.schemas.block import CreateBlock
from letta.schemas.tool_rule import BaseToolRule
from letta.server.server import SyncServer

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

from letta.config import LettaConfig
from letta.constants import DEFAULT_HUMAN, DEFAULT_PERSONA
from letta.errors import InvalidInnerMonologueError, InvalidToolCallError, MissingInnerMonologueError, MissingToolCallError
from letta.llm_api.llm_client import LLMClient
from letta.local_llm.constants import INNER_THOUGHTS_KWARG
from letta.schemas.agent import AgentState, CreateAgent
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.letta_message import LettaMessage, ReasoningMessage, ToolCallMessage
from letta.schemas.letta_response import LettaResponse
from letta.schemas.llm_config import LLMConfig
from letta.schemas.openai.chat_completion_response import Choice, FunctionCall, Message
from letta.utils import get_human_text, get_persona_text

# Generate uuid for agent name for this example
namespace = uuid.NAMESPACE_DNS
agent_uuid = str(uuid.uuid5(namespace, "test-endpoints-agent"))

# defaults (letta hosted)
EMBEDDING_CONFIG_PATH = "tests/configs/embedding_model_configs/letta-hosted.json"
LLM_CONFIG_PATH = "tests/configs/llm_model_configs/letta-hosted.json"


# ======================================================================================================================
# Section: Test Setup
# These functions help setup the test
# ======================================================================================================================


async def setup_agent(
    server: SyncServer,
    filename: str,
    memory_human_str: str = get_human_text(DEFAULT_HUMAN),
    memory_persona_str: str = get_persona_text(DEFAULT_PERSONA),
    tool_ids: Optional[List[str]] = None,
    tool_rules: Optional[List[BaseToolRule]] = None,
    agent_uuid: str = agent_uuid,
    include_base_tools: bool = True,
    include_base_tool_rules: bool = True,
) -> AgentState:
    with open(filename, "r") as f:
        config_data = json.load(f)
    llm_config = LLMConfig(**config_data)
    with open(EMBEDDING_CONFIG_PATH, "r") as f:
        embedding_config = EmbeddingConfig(**json.load(f))

    # setup config
    config = LettaConfig()
    config.default_llm_config = llm_config
    config.default_embedding_config = embedding_config
    config.save()

    request = CreateAgent(
        name=agent_uuid,
        llm_config=llm_config,
        embedding_config=embedding_config,
        memory_blocks=[
            CreateBlock(
                label="human",
                value=memory_human_str,
            ),
            CreateBlock(
                label="persona",
                value=memory_persona_str,
            ),
        ],
        tool_ids=tool_ids,
        tool_rules=tool_rules,
        include_base_tools=include_base_tools,
        include_base_tool_rules=include_base_tool_rules,
    )
    actor = await server.user_manager.get_actor_or_default_async()
    agent_state = await server.create_agent_async(request=request, actor=actor)

    return agent_state


# ======================================================================================================================
# Section: Complex E2E Tests
# These functions describe individual testing scenarios.
# ======================================================================================================================


async def run_embedding_endpoint(filename, actor=None):
    # load JSON file
    with open(filename, "r") as f:
        config_data = json.load(f)
    print(config_data)
    embedding_config = EmbeddingConfig(**config_data)

    # Use the new LLMClient for embeddings
    client = LLMClient.create(
        provider_type=embedding_config.embedding_endpoint_type,
        actor=actor,
    )

    query_text = "hello"
    query_vecs = await client.request_embeddings([query_text], embedding_config)
    query_vec = query_vecs[0]
    print("vector dim", len(query_vec))
    assert query_vec is not None


# ======================================================================================================================
# Section: Letta Message Assertions
# These functions are validating elements of parsed Letta Messsage
# ======================================================================================================================


def assert_sanity_checks(response: LettaResponse):
    assert response is not None, response
    assert response.messages is not None, response
    assert len(response.messages) > 0, response


def assert_invoked_send_message_with_keyword(messages: Sequence[LettaMessage], keyword: str, case_sensitive: bool = False) -> None:
    # Find first instance of send_message
    target_message = None
    for message in messages:
        if isinstance(message, ToolCallMessage) and message.tool_call.name == "send_message":
            target_message = message
            break

    # No messages found with `send_messages`
    if target_message is None:
        raise MissingToolCallError(messages=messages, explanation="Missing `send_message` function call")

    send_message_function_call = target_message.tool_call
    try:
        arguments = json.loads(send_message_function_call.arguments)
    except:
        raise InvalidToolCallError(messages=[target_message], explanation="Function call arguments could not be loaded into JSON")

    # Message field not in send_message
    if "message" not in arguments:
        raise InvalidToolCallError(
            messages=[target_message], explanation="send_message function call does not have required field `message`"
        )

    # Check that the keyword is in the message arguments
    if not case_sensitive:
        keyword = keyword.lower()
        arguments["message"] = arguments["message"].lower()

    if keyword not in arguments["message"]:
        raise InvalidToolCallError(messages=[target_message], explanation=f"Message argument did not contain keyword={keyword}")


def assert_invoked_function_call(messages: Sequence[LettaMessage], function_name: str) -> None:
    for message in messages:
        if isinstance(message, ToolCallMessage) and message.tool_call.name == function_name:
            # Found it, do nothing
            return

    raise MissingToolCallError(messages=messages, explanation=f"No messages were found invoking function call with name: {function_name}")


def assert_inner_monologue_is_present_and_valid(messages: List[LettaMessage]) -> None:
    for message in messages:
        if isinstance(message, ReasoningMessage):
            # Found it, do nothing
            return

    raise MissingInnerMonologueError(messages=messages)


# ======================================================================================================================
# Section: Raw API Assertions
# These functions are validating elements of the (close to) raw LLM API's response
# ======================================================================================================================


def assert_contains_valid_function_call(
    message: Message,
    function_call_validator: Optional[Callable[[FunctionCall], bool]] = None,
    validation_failure_summary: Optional[str] = None,
) -> None:
    """
    Helper function to check that a message contains a valid function call.

    There is an Optional parameter `function_call_validator` that specifies a validator function.
    This function gets called on the resulting function_call to validate the function is what we expect.
    """
    if (hasattr(message, "function_call") and message.function_call is not None) and (
        hasattr(message, "tool_calls") and message.tool_calls is not None
    ):
        raise InvalidToolCallError(messages=[message], explanation="Both function_call and tool_calls is present in the message")
    elif hasattr(message, "function_call") and message.function_call is not None:
        function_call = message.function_call
    elif hasattr(message, "tool_calls") and message.tool_calls is not None:
        # Note: We only take the first one for now. Is this a problem? @charles
        # This seems to be standard across the repo
        function_call = message.tool_calls[0].function
    else:
        # Throw a missing function call error
        raise MissingToolCallError(messages=[message])

    if function_call_validator and not function_call_validator(function_call):
        raise InvalidToolCallError(messages=[message], explanation=validation_failure_summary)


def assert_inner_monologue_is_valid(message: Message) -> None:
    """
    Helper function to check that the inner monologue is valid.
    """
    # Sometimes the syntax won't be correct and internal syntax will leak into message
    invalid_phrases = ["functions", "send_message", "arguments"]

    monologue = message.content
    for phrase in invalid_phrases:
        if phrase in monologue:
            raise InvalidInnerMonologueError(messages=[message], explanation=f"{phrase} is in monologue")


def assert_contains_correct_inner_monologue(
    choice: Choice,
    inner_thoughts_in_kwargs: bool,
    validate_inner_monologue_contents: bool = True,
) -> None:
    """
    Helper function to check that the inner monologue exists and is valid.
    """
    # Unpack inner thoughts out of function kwargs, and repackage into choice
    if inner_thoughts_in_kwargs:
        choice = unpack_inner_thoughts_from_kwargs(choice, INNER_THOUGHTS_KWARG)

    message = choice.message
    monologue = message.content
    if not monologue or monologue is None or monologue == "":
        raise MissingInnerMonologueError(messages=[message])

    if validate_inner_monologue_contents:
        assert_inner_monologue_is_valid(message)
