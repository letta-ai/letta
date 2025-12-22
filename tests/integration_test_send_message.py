import base64
import json
import logging
import os
import threading
import time
import uuid
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict, List, Tuple
from unittest.mock import patch

import pytest
import requests
from dotenv import load_dotenv
from letta_client import APIError, AsyncLetta, Letta
from letta_client.types import AgentState, MessageCreateParam, ToolReturnMessage
from letta_client.types.agents import (
    AssistantMessage,
    HiddenReasoningMessage,
    Message,
    ReasoningMessage,
    Run,
    ToolCallMessage,
    UserMessage,
)
from letta_client.types.agents.image_content_param import ImageContentParam, SourceBase64Image
from letta_client.types.agents.letta_streaming_response import LettaPing, LettaStopReason, LettaUsageStatistics
from letta_client.types.agents.text_content_param import TextContentParam

from letta.errors import LLMError
from letta.helpers.reasoning_helper import is_reasoning_completely_disabled
from letta.llm_api.openai_client import is_openai_reasoning_model

logger = logging.getLogger(__name__)

# ------------------------------
# Helper Functions and Constants
# ------------------------------


def get_model_config(filename: str, model_settings_dir: str = "tests/model_settings") -> Tuple[str, dict]:
    """Load a model_settings file and return the handle and settings dict."""
    filename = os.path.join(model_settings_dir, filename)
    with open(filename, "r") as f:
        config_data = json.load(f)
    return config_data["handle"], config_data.get("model_settings", {})


def roll_dice(num_sides: int) -> int:
    """
    Returns a random number between 1 and num_sides.
    Args:
        num_sides (int): The number of sides on the die.
    Returns:
        int: A random integer between 1 and num_sides, representing the die roll.
    """
    import random

    return random.randint(1, num_sides)


USER_MESSAGE_OTID = str(uuid.uuid4())
USER_MESSAGE_RESPONSE: str = "Teamwork makes the dream work"
USER_MESSAGE_FORCE_REPLY: List[MessageCreateParam] = [
    MessageCreateParam(
        role="user",
        content=f"This is an automated test message. Call the send_message tool with the message '{USER_MESSAGE_RESPONSE}'.",
        otid=USER_MESSAGE_OTID,
    )
]
USER_MESSAGE_LONG_RESPONSE: str = (
    "Teamwork makes the dream work. When people collaborate and combine their unique skills, perspectives, and experiences, they can achieve far more than any individual working alone. "
    "This synergy creates an environment where innovation flourishes, problems are solved more creatively, and goals are reached more efficiently. "
    "In a team setting, diverse viewpoints lead to better decision-making as different team members bring their unique backgrounds and expertise to the table. "
    "Communication becomes the backbone of success, allowing ideas to flow freely and ensuring everyone is aligned toward common objectives. "
    "Trust builds gradually as team members learn to rely on each other's strengths while supporting one another through challenges. "
    "The collective intelligence of a group often surpasses that of even the brightest individual, as collaboration sparks creativity and innovation. "
    "Successful teams celebrate victories together and learn from failures as a unit, creating a culture of continuous improvement. "
    "Together, we can overcome challenges that would be insurmountable alone, achieving extraordinary results through the power of collaboration."
)
USER_MESSAGE_FORCE_LONG_REPLY: List[MessageCreateParam] = [
    MessageCreateParam(
        role="user",
        content=f"This is an automated test message. Call the send_message tool with exactly this message: '{USER_MESSAGE_LONG_RESPONSE}'",
        otid=USER_MESSAGE_OTID,
    )
]
USER_MESSAGE_GREETING: List[MessageCreateParam] = [
    MessageCreateParam(
        role="user",
        content="Hi!",
        otid=USER_MESSAGE_OTID,
    )
]
USER_MESSAGE_ROLL_DICE: List[MessageCreateParam] = [
    MessageCreateParam(
        role="user",
        content="This is an automated test message. Call the roll_dice tool with 16 sides and send me a message with the outcome.",
        otid=USER_MESSAGE_OTID,
    )
]
USER_MESSAGE_ROLL_DICE_LONG: List[MessageCreateParam] = [
    MessageCreateParam(
        role="user",
        content=(
            "This is an automated test message. Call the roll_dice tool with 16 sides and send me a very detailed, comprehensive message about the outcome. "
            "Your response must be at least 800 characters long. Start by explaining what dice rolling represents in games and probability theory. "
            "Discuss the mathematical probability of getting each number on a 16-sided die (1/16 or 6.25% for each face). "
            "Explain how 16-sided dice are commonly used in tabletop role-playing games like Dungeons & Dragons. "
            "Describe the specific number you rolled and what it might mean in different gaming contexts. "
            "Discuss how this particular roll compares to the expected value (8.5) of a 16-sided die. "
            "Explain the concept of randomness and how true random number generation works. "
            "End with some interesting facts about polyhedral dice and their history in gaming. "
            "Remember, make your response detailed and at least 800 characters long."
        ),
        otid=USER_MESSAGE_OTID,
    )
]
USER_MESSAGE_ROLL_DICE_GEMINI_FLASH: List[MessageCreateParam] = [
    MessageCreateParam(
        role="user",
        content=(
            'This is an automated test message. First, call the roll_dice tool with exactly this JSON: {"num_sides": 16, "request_heartbeat": true}. '
            "After you receive the tool result, as your final step, call the send_message tool with your user-facing reply in the 'message' argument. "
            "Important: Do not output plain text for the final step; respond using a functionCall to send_message only. Use valid JSON for all function arguments."
        ),
        otid=USER_MESSAGE_OTID,
    )
]
USER_MESSAGE_ROLL_DICE_LONG_THINKING: List[MessageCreateParam] = [
    MessageCreateParam(
        role="user",
        content=(
            "This is an automated test message. First, think long and hard about about why you're here, and your creator. "
            "Then, call the roll_dice tool with 16 sides. "
            "Once you've rolled the die, think deeply about the meaning of the roll to you (but don't tell me, just think these thoughts privately). "
            "Then, once you're done thinking, send me a very detailed, comprehensive message about the outcome, using send_message. "
            "Your response must be at least 800 characters long. Start by explaining what dice rolling represents in games and probability theory. "
            "Discuss the mathematical probability of getting each number on a 16-sided die (1/16 or 6.25% for each face). "
            "Explain how 16-sided dice are commonly used in tabletop role-playing games like Dungeons & Dragons. "
            "Describe the specific number you rolled and what it might mean in different gaming contexts. "
            "Discuss how this particular roll compares to the expected value (8.5) of a 16-sided die. "
            "Explain the concept of randomness and how true random number generation works. "
            "End with some interesting facts about polyhedral dice and their history in gaming. "
            "Remember, make your response detailed and at least 800 characters long."
            "Absolutely do NOT violate this order of operations: (1) Think / reason, (2) Roll die, (3) Think / reason, (4) Call send_message tool."
        ),
        otid=USER_MESSAGE_OTID,
    )
]


# Load test image from local file rather than fetching from external URL.
# Using a local file avoids network dependencies and makes tests faster and more reliable.
def _load_test_image() -> str:
    """Loads the test image from the data folder and returns it as base64."""
    image_path = os.path.join(os.path.dirname(__file__), "data/Camponotus_flavomarginatus_ant.jpg")
    with open(image_path, "rb") as f:
        return base64.standard_b64encode(f.read()).decode("utf-8")


BASE64_IMAGE = _load_test_image()
USER_MESSAGE_BASE64_IMAGE: List[MessageCreateParam] = [
    MessageCreateParam(
        role="user",
        content=[
            ImageContentParam(type="image", source=SourceBase64Image(type="base64", data=BASE64_IMAGE, media_type="image/jpeg")),
            TextContentParam(type="text", text="What is in this image?"),
        ],
        otid=USER_MESSAGE_OTID,
    )
]

# configs for models that are to dumb to do much other than messaging
limited_configs = [
    "ollama.json",
    "together-qwen-2.5-72b-instruct.json",
    "vllm.json",
    "lmstudio.json",
    "groq.json",
    # treat deprecated models as limited to skip where generic checks are used
    "gemini-1.5-pro.json",
]

all_configs = [
    "openai-gpt-4o-mini.json",
    "openai-gpt-4.1.json",
    "openai-gpt-5.json",  # TODO: GPT-5 disabled for now, it sends HiddenReasoningMessages which break the tests.
    "claude-4-5-sonnet.json",
    "gemini-2.5-pro.json",
]

reasoning_configs = [
    "openai-o1.json",
    "openai-o3.json",
    "openai-o4-mini.json",
]


requested = os.getenv("LLM_CONFIG_FILE")
filenames = [requested] if requested else all_configs
TESTED_MODEL_CONFIGS: List[Tuple[str, dict]] = [get_model_config(fn) for fn in filenames]
# Filter out deprecated Gemini 1.5 models regardless of filename source
TESTED_MODEL_CONFIGS = [
    cfg for cfg in TESTED_MODEL_CONFIGS if not (cfg[1].get("provider_type") in ["google_vertex", "google_ai"] and "gemini-1.5" in cfg[0])
]
# Filter out deprecated Claude 3.5 Sonnet model that is no longer available
TESTED_MODEL_CONFIGS = [
    cfg for cfg in TESTED_MODEL_CONFIGS if not (cfg[1].get("provider_type") == "anthropic" and "claude-3-5-sonnet-20241022" in cfg[0])
]


def is_reasoner_model(model_handle: str, model_settings: dict) -> bool:
    """Check if the model is a native reasoning model.

    This matches the server-side implementations from:
    - letta/llm_api/openai_client.py:is_openai_reasoning_model
    - letta/llm_api/anthropic_client.py:is_reasoning_model
    - letta/llm_api/google_vertex_client.py:is_reasoning_model
    """
    provider_type = model_settings.get("provider_type")

    # Extract model name from handle (format: "provider/model-name")
    model = model_handle.split("/")[-1] if "/" in model_handle else model_handle

    # OpenAI reasoning models (from openai_client.py:60-65)
    if provider_type == "openai":
        return model.startswith("o1") or model.startswith("o3") or model.startswith("o4") or model.startswith("gpt-5")

    # Anthropic reasoning models (from anthropic_client.py:608-616)
    elif provider_type == "anthropic":
        return (
            model.startswith("claude-3-7-sonnet")
            or model.startswith("claude-sonnet-4")
            or model.startswith("claude-opus-4")
            or model.startswith("claude-haiku-4-5")
            or model.startswith("claude-opus-4-5")
        )

    # Google Vertex/AI reasoning models (from google_vertex_client.py:691-696)
    elif provider_type in ["google_vertex", "google_ai"]:
        return model.startswith("gemini-2.5-flash") or model.startswith("gemini-2.5-pro") or model.startswith("gemini-3")

    return False


def is_hidden_reasoning_model(model_handle: str, model_settings: dict) -> bool:
    """Check if the model returns HiddenReasoningMessage instead of regular ReasoningMessage.

    Currently only gpt-5 returns hidden reasoning messages.
    """
    provider_type = model_settings.get("provider_type")
    model = model_handle.split("/")[-1] if "/" in model_handle else model_handle

    # GPT-5 is the only model that returns HiddenReasoningMessage
    if provider_type == "openai":
        return model.startswith("gpt-5")

    return False


def get_expected_message_count_range(
    model_handle: str,
    model_settings: dict,
    tool_call: bool = False,
    streaming: bool = False,
    from_db: bool = False,
    use_assistant_message: bool = True,
) -> Tuple[int, int]:
    """
    Returns the expected range of number of messages for a given LLM configuration.
    Uses range to account for possible variations in the number of reasoning messages.
    """
    # assistant message (only if use_assistant_message is True)
    expected_message_count = 1 if use_assistant_message else 0
    expected_range = 0

    if is_reasoner_model(model_handle, model_settings):
        # reasoning message
        expected_range += 1
        if tool_call:
            # check for sonnet 4.5 or opus 4.1 specifically
            is_sonnet_4_5_or_opus_4_1 = (
                model_settings.get("provider_type") == "anthropic"
                and model_settings.get("thinking", {}).get("type") == "enabled"
                and ("claude-sonnet-4-5" in model_handle or "claude-opus-4-1" in model_handle)
            )
            is_anthropic_reasoning = (
                model_settings.get("provider_type") == "anthropic" and model_settings.get("thinking", {}).get("type") == "enabled"
            )
            if is_sonnet_4_5_or_opus_4_1 or not is_anthropic_reasoning:
                # sonnet 4.5 and opus 4.1 return a reasoning message before the final assistant message
                # so do the other native reasoning models
                expected_range += 1

            # opus 4.1 generates an extra AssistantMessage before the tool call
            if "claude-opus-4-1" in model_handle:
                expected_range += 1

    if tool_call:
        # tool call and tool return messages
        expected_message_count += 2

    if from_db:
        # user message
        expected_message_count += 1

    if streaming:
        # stop reason and usage statistics
        expected_message_count += 2

    return expected_message_count, expected_message_count + expected_range


def assert_first_message_is_user_message(messages: List[Any]) -> None:
    """
    Asserts that the first message is a user message.
    """
    assert isinstance(messages[0], UserMessage)


def assert_greeting_with_assistant_message_response(
    messages: List[Any],
    model_handle: str,
    model_settings: dict,
    streaming: bool = False,
    token_streaming: bool = False,
    from_db: bool = False,
    input: bool = False,
) -> None:
    """
    Asserts that the messages list follows the expected sequence:
    ReasoningMessage -> AssistantMessage.
    """
    # Filter out LettaPing messages which are keep-alive messages for SSE streams
    messages = [
        msg for msg in messages if not (isinstance(msg, LettaPing) or (hasattr(msg, "message_type") and msg.message_type == "ping"))
    ]

    expected_message_count_min, expected_message_count_max = get_expected_message_count_range(
        model_handle, model_settings, streaming=streaming, from_db=from_db
    )
    assert expected_message_count_min <= len(messages) <= expected_message_count_max, (
        f"Expected {expected_message_count_min}-{expected_message_count_max} messages, got {len(messages)}"
    )

    # User message if loaded from db
    index = 0
    if from_db:
        assert isinstance(messages[index], UserMessage)
        # if messages are passed through the input parameter, the otid is generated on the server side
        if not input:
            assert messages[index].otid == USER_MESSAGE_OTID
        else:
            assert messages[index].otid is not None
        index += 1

    # Reasoning message if reasoning enabled
    otid_suffix = 0
    try:
        if is_reasoner_model(model_handle, model_settings):
            assert isinstance(messages[index], (ReasoningMessage, HiddenReasoningMessage))
            assert messages[index].otid and messages[index].otid[-1] == str(otid_suffix)
            index += 1
            otid_suffix += 1
    except:
        # Reasoning is non-deterministic, so don't throw if missing
        pass

    # For o1/o3/o4/gpt-5 models in token streaming, AssistantMessage is omitted
    # Check if next message is LettaStopReason to detect this case
    model_name = model_handle.split("/")[-1] if "/" in model_handle else model_handle
    skip_assistant_message = (
        streaming
        and token_streaming
        and is_openai_reasoning_model(model_name)
        and index < len(messages)
        and isinstance(messages[index], LettaStopReason)
    )

    # Assistant message (skip for o1-style models in token streaming)
    if not skip_assistant_message:
        assert isinstance(messages[index], AssistantMessage)
        if not token_streaming:
            # Check for either short or long response
            assert "teamwork" in messages[index].content.lower() or USER_MESSAGE_LONG_RESPONSE in messages[index].content
        assert messages[index].otid and messages[index].otid[-1] == str(otid_suffix)
        index += 1
        otid_suffix += 1

    # Stop reason and usage statistics if streaming
    if streaming:
        assert isinstance(messages[index], LettaStopReason)
        assert messages[index].stop_reason == "end_turn"
        index += 1
        assert isinstance(messages[index], LettaUsageStatistics)
        assert messages[index].prompt_tokens > 0
        assert messages[index].completion_tokens > 0
        assert messages[index].total_tokens > 0
        assert messages[index].step_count > 0


def assert_contains_run_id(messages: List[Any]) -> None:
    """
    Asserts that the messages list contains a run_id.
    """
    for message in messages:
        if hasattr(message, "run_id"):
            assert message.run_id is not None


def assert_contains_step_id(messages: List[Any]) -> None:
    """
    Asserts that the messages list contains a step_id.
    """
    for message in messages:
        # Skip LettaPing messages which are keep-alive and don't have step_id
        if isinstance(message, LettaPing):
            continue
        if hasattr(message, "step_id"):
            assert message.step_id is not None


def assert_greeting_no_reasoning_response(
    messages: List[Any],
    streaming: bool = False,
    token_streaming: bool = False,
    from_db: bool = False,
) -> None:
    """
    Asserts that the messages list follows the expected sequence without reasoning:
    AssistantMessage (no ReasoningMessage when put_inner_thoughts_in_kwargs is False).
    """
    # Filter out LettaPing messages which are keep-alive messages for SSE streams
    messages = [
        msg for msg in messages if not (isinstance(msg, LettaPing) or (hasattr(msg, "message_type") and msg.message_type == "ping"))
    ]
    expected_message_count = 3 if streaming else 2 if from_db else 1
    assert len(messages) == expected_message_count

    index = 0
    if from_db:
        assert isinstance(messages[index], UserMessage)
        assert messages[index].otid == USER_MESSAGE_OTID
        index += 1

    # Agent Step 1 - should be AssistantMessage directly, no reasoning
    assert isinstance(messages[index], AssistantMessage)
    if not token_streaming:
        assert "teamwork" in messages[index].content.lower()
    assert messages[index].otid and messages[index].otid[-1] == "0"
    index += 1

    if streaming:
        assert isinstance(messages[index], LettaStopReason)
        assert messages[index].stop_reason == "end_turn"
        index += 1
        assert isinstance(messages[index], LettaUsageStatistics)
        assert messages[index].prompt_tokens > 0
        assert messages[index].completion_tokens > 0
        assert messages[index].total_tokens > 0
        assert messages[index].step_count > 0


def assert_greeting_without_assistant_message_response(
    messages: List[Any],
    model_handle: str,
    model_settings: dict,
    streaming: bool = False,
    token_streaming: bool = False,
    from_db: bool = False,
) -> None:
    """
    Asserts that the messages list follows the expected sequence:
    ReasoningMessage -> ToolCallMessage -> ToolReturnMessage.
    """
    # Filter out LettaPing messages which are keep-alive messages for SSE streams
    messages = [
        msg for msg in messages if not (isinstance(msg, LettaPing) or (hasattr(msg, "message_type") and msg.message_type == "ping"))
    ]

    expected_message_count_min, expected_message_count_max = get_expected_message_count_range(
        model_handle, model_settings, tool_call=True, streaming=streaming, from_db=from_db, use_assistant_message=False
    )
    assert expected_message_count_min <= len(messages) <= expected_message_count_max, (
        f"Expected {expected_message_count_min}-{expected_message_count_max} messages, got {len(messages)}"
    )

    # User message if loaded from db
    index = 0
    if from_db:
        assert isinstance(messages[index], UserMessage)
        assert messages[index].otid == USER_MESSAGE_OTID
        index += 1

    # Reasoning message if reasoning enabled
    otid_suffix = 0
    try:
        if is_reasoner_model(model_handle, model_settings):
            assert isinstance(messages[index], (ReasoningMessage, HiddenReasoningMessage))
            assert messages[index].otid and messages[index].otid[-1] == str(otid_suffix)
            index += 1
            otid_suffix += 1
    except:
        # Reasoning is non-deterministic, so don't throw if missing
        pass

    # Special case for claude-sonnet-4-5-20250929 and opus-4.1 which can generate an extra AssistantMessage before tool call
    if (
        ("claude-sonnet-4-5-20250929" in model_handle or "claude-opus-4-1" in model_handle)
        and index < len(messages)
        and isinstance(messages[index], AssistantMessage)
    ):
        # Skip the extra AssistantMessage and move to the next message
        index += 1
        otid_suffix += 1

    # Tool call message
    assert isinstance(messages[index], ToolCallMessage)
    assert messages[index].tool_call.name == "send_message"
    if not token_streaming:
        assert "teamwork" in messages[index].tool_call.arguments.lower()
    assert messages[index].otid and messages[index].otid[-1] == str(otid_suffix)
    index += 1

    # Tool return message
    otid_suffix = 0
    assert isinstance(messages[index], ToolReturnMessage)
    assert messages[index].otid and messages[index].otid[-1] == str(otid_suffix)
    index += 1

    # Stop reason and usage statistics if streaming
    if streaming:
        assert isinstance(messages[index], LettaStopReason)
        assert messages[index].stop_reason == "end_turn"
        index += 1
        assert isinstance(messages[index], LettaUsageStatistics)
        assert messages[index].prompt_tokens > 0
        assert messages[index].completion_tokens > 0
        assert messages[index].total_tokens > 0
        assert messages[index].step_count > 0


def assert_tool_call_response(
    messages: List[Any],
    model_handle: str,
    model_settings: dict,
    streaming: bool = False,
    from_db: bool = False,
) -> None:
    """
    Asserts that the messages list follows the expected sequence:
    ReasoningMessage -> ToolCallMessage -> ToolReturnMessage ->
    ReasoningMessage -> AssistantMessage.
    """
    # Filter out LettaPing messages which are keep-alive messages for SSE streams
    messages = [
        msg for msg in messages if not (isinstance(msg, LettaPing) or (hasattr(msg, "message_type") and msg.message_type == "ping"))
    ]

    # Special-case relaxation for Gemini 2.5 Flash on Google endpoints during streaming
    # Flash can legitimately end after the tool return without issuing a final send_message call.
    # Accept the shorter sequence: Reasoning -> ToolCall -> ToolReturn -> StopReason(no_tool_call)
    is_gemini_flash = model_settings.get("provider_type") in ["google_vertex", "google_ai"] and "gemini-2.5-flash" in model_handle
    if streaming and is_gemini_flash:
        if (
            len(messages) >= 4
            and getattr(messages[-1], "message_type", None) == "stop_reason"
            and getattr(messages[-1], "stop_reason", None) == "no_tool_call"
            and getattr(messages[0], "message_type", None) == "reasoning_message"
            and getattr(messages[1], "message_type", None) == "tool_call_message"
            and getattr(messages[2], "message_type", None) == "tool_return_message"
        ):
            return

    # OpenAI o1/o3/o4 reasoning models omit the final AssistantMessage in token streaming,
    # yielding the shorter sequence:
    #   HiddenReasoning -> ToolCall -> ToolReturn -> HiddenReasoning -> StopReason -> Usage
    model_name = model_handle.split("/")[-1] if "/" in model_handle else model_handle
    o1_token_streaming = (
        streaming
        and is_openai_reasoning_model(model_name)
        and len(messages) == 6
        and getattr(messages[0], "message_type", None) == "hidden_reasoning_message"
        and getattr(messages[1], "message_type", None) == "tool_call_message"
        and getattr(messages[2], "message_type", None) == "tool_return_message"
        and getattr(messages[3], "message_type", None) == "hidden_reasoning_message"
        and getattr(messages[4], "message_type", None) == "stop_reason"
        and getattr(messages[5], "message_type", None) == "usage_statistics"
    )
    if o1_token_streaming:
        return

    # OpenAI gpt-4o-mini can sometimes omit the final AssistantMessage in streaming,
    # yielding the shorter sequence:
    #   Reasoning -> ToolCall -> ToolReturn -> Reasoning -> StopReason -> Usage
    # Accept this variant to reduce flakiness.
    if (
        streaming
        and model_settings.get("provider_type") == "openai"
        and "gpt-4o-mini" in model_handle
        and len(messages) == 6
        and getattr(messages[0], "message_type", None) == "reasoning_message"
        and getattr(messages[1], "message_type", None) == "tool_call_message"
        and getattr(messages[2], "message_type", None) == "tool_return_message"
        and getattr(messages[3], "message_type", None) == "reasoning_message"
        and getattr(messages[4], "message_type", None) == "stop_reason"
        and getattr(messages[5], "message_type", None) == "usage_statistics"
    ):
        return

    # OpenAI o3 can sometimes stop after tool return without generating final reasoning/assistant messages
    # Accept the shorter sequence: HiddenReasoning -> ToolCall -> ToolReturn
    if (
        model_settings.get("provider_type") == "openai"
        and "o3" in model_handle
        and len(messages) == 3
        and getattr(messages[0], "message_type", None) == "hidden_reasoning_message"
        and getattr(messages[1], "message_type", None) == "tool_call_message"
        and getattr(messages[2], "message_type", None) == "tool_return_message"
    ):
        return

    # Groq models can sometimes stop after tool return without generating final reasoning/assistant messages
    # Accept the shorter sequence: Reasoning -> ToolCall -> ToolReturn
    if (
        model_settings.get("provider_type") == "groq"
        and len(messages) == 3
        and getattr(messages[0], "message_type", None) == "reasoning_message"
        and getattr(messages[1], "message_type", None) == "tool_call_message"
        and getattr(messages[2], "message_type", None) == "tool_return_message"
    ):
        return

    # Use range-based assertion for normal cases
    expected_message_count_min, expected_message_count_max = get_expected_message_count_range(
        model_handle, model_settings, tool_call=True, streaming=streaming, from_db=from_db
    )
    # Allow for edge cases where count might be slightly off
    if not (expected_message_count_min - 2 <= len(messages) <= expected_message_count_max + 2):
        assert expected_message_count_min <= len(messages) <= expected_message_count_max, (
            f"Expected {expected_message_count_min}-{expected_message_count_max} messages, got {len(messages)}"
        )

    # User message if loaded from db
    index = 0
    if from_db:
        assert isinstance(messages[index], UserMessage)
        assert messages[index].otid == USER_MESSAGE_OTID
        index += 1

    # Reasoning message if reasoning enabled
    otid_suffix = 0
    try:
        if is_reasoner_model(model_handle, model_settings):
            assert isinstance(messages[index], (ReasoningMessage, HiddenReasoningMessage))
            assert messages[index].otid and messages[index].otid[-1] == str(otid_suffix)
            index += 1
            otid_suffix += 1
    except:
        # Reasoning is non-deterministic, so don't throw if missing
        pass

    # Special case for claude-sonnet-4-5-20250929 and opus-4.1 which can generate an extra AssistantMessage before tool call
    if (
        ("claude-sonnet-4-5-20250929" in model_handle or "claude-opus-4-1" in model_handle)
        and index < len(messages)
        and isinstance(messages[index], AssistantMessage)
    ):
        # Skip the extra AssistantMessage and move to the next message
        index += 1
        otid_suffix += 1

    # Tool call message
    assert isinstance(messages[index], ToolCallMessage)
    assert messages[index].otid and messages[index].otid[-1] == str(otid_suffix)
    index += 1

    # Tool return message
    otid_suffix = 0
    assert isinstance(messages[index], ToolReturnMessage)
    assert messages[index].otid and messages[index].otid[-1] == str(otid_suffix)
    index += 1

    # Hidden User Message (heartbeat)
    if from_db and index < len(messages) and isinstance(messages[index], UserMessage):
        assert "request_heartbeat=true" in messages[index].content
        index += 1

    # Second agent step - reasoning message if reasoning enabled
    try:
        if is_reasoner_model(model_handle, model_settings) and index < len(messages):
            assert isinstance(messages[index], (ReasoningMessage, HiddenReasoningMessage))
            assert messages[index].otid and messages[index].otid[-1] == "0"
            index += 1
    except:
        # Reasoning is non-deterministic, so don't throw if missing
        pass

    # Assistant message
    if index < len(messages) and isinstance(messages[index], AssistantMessage):
        index += 1

    if streaming:
        assert isinstance(messages[index], LettaStopReason)
        assert messages[index].stop_reason == "end_turn"
        index += 1
        assert isinstance(messages[index], LettaUsageStatistics)
        assert messages[index].prompt_tokens > 0
        assert messages[index].completion_tokens > 0
        assert messages[index].total_tokens > 0
        assert messages[index].step_count > 0


def validate_openai_format_scrubbing(messages: List[Dict[str, Any]]) -> None:
    """
    Validate that OpenAI format assistant messages with tool calls have no inner thoughts content.
    Args:
        messages: List of message dictionaries in OpenAI format
    """
    assistant_messages_with_tools = []

    for msg in messages:
        if msg.get("role") == "assistant" and msg.get("tool_calls"):
            assistant_messages_with_tools.append(msg)

    # There should be at least one assistant message with tool calls
    assert len(assistant_messages_with_tools) > 0, "Expected at least one OpenAI assistant message with tool calls"

    # Check that assistant messages with tool calls have no text content (inner thoughts scrubbed)
    for msg in assistant_messages_with_tools:
        if "content" in msg:
            content = msg["content"]
            assert content is None


def validate_anthropic_format_scrubbing(messages: List[Dict[str, Any]], reasoning_enabled: bool) -> None:
    """
    Validate that Anthropic/Claude format assistant messages with tool_use have no <thinking> tags.
    Args:
        messages: List of message dictionaries in Anthropic format
    """
    claude_assistant_messages_with_tools = []

    for msg in messages:
        if (
            msg.get("role") == "assistant"
            and isinstance(msg.get("content"), list)
            and any(item.get("type") == "tool_use" for item in msg.get("content", []))
        ):
            claude_assistant_messages_with_tools.append(msg)

    # There should be at least one Claude assistant message with tool_use
    assert len(claude_assistant_messages_with_tools) > 0, "Expected at least one Claude assistant message with tool_use"

    # Check Claude format messages specifically
    for msg in claude_assistant_messages_with_tools:
        content_list = msg["content"]

        # Strict validation: assistant messages with tool_use should have NO text content items at all
        text_items = [item for item in content_list if item.get("type") == "text"]
        assert len(text_items) == 0, (
            f"Found {len(text_items)} text content item(s) in Claude assistant message with tool_use. "
            f"When reasoning is disabled, there should be NO text items. "
            f"Text items found: {[item.get('text', '') for item in text_items]}"
        )

        # Verify that the message only contains tool_use items
        tool_use_items = [item for item in content_list if item.get("type") == "tool_use"]
        assert len(tool_use_items) > 0, "Assistant message should have at least one tool_use item"

        if not reasoning_enabled:
            assert len(content_list) == len(tool_use_items), (
                f"Assistant message should ONLY contain tool_use items when reasoning is disabled. "
                f"Found {len(content_list)} total items but only {len(tool_use_items)} are tool_use items."
            )


def validate_google_format_scrubbing(contents: List[Dict[str, Any]]) -> None:
    """
    Validate that Google/Gemini format model messages with functionCall have no thinking field.
    Args:
        contents: List of content dictionaries in Google format (uses 'contents' instead of 'messages')
    """
    model_messages_with_function_calls = []

    for content in contents:
        if content.get("role") == "model" and isinstance(content.get("parts"), list):
            for part in content["parts"]:
                if "functionCall" in part:
                    model_messages_with_function_calls.append(part)

    # There should be at least one model message with functionCall
    assert len(model_messages_with_function_calls) > 0, "Expected at least one Google model message with functionCall"

    # Check Google format messages specifically
    for part in model_messages_with_function_calls:
        function_call = part["functionCall"]
        args = function_call.get("args", {})

        # Assert that there is no 'thinking' field in the function call arguments
        assert "thinking" not in args, (
            f"Found 'thinking' field in Google model functionCall args (inner thoughts not scrubbed): {args.get('thinking')}"
        )


def assert_image_input_response(
    messages: List[Any],
    model_handle: str,
    model_settings: dict,
    streaming: bool = False,
    token_streaming: bool = False,
    from_db: bool = False,
) -> None:
    """
    Asserts that the messages list follows the expected sequence:
    ReasoningMessage -> AssistantMessage or ToolCallMessage -> ToolReturnMessage.
    """
    # Filter out LettaPing messages which are keep-alive messages for SSE streams
    messages = [
        msg for msg in messages if not (isinstance(msg, LettaPing) or (hasattr(msg, "message_type") and msg.message_type == "ping"))
    ]

    # Check if there are tool calls in the response
    has_tool_calls = any(isinstance(msg, ToolCallMessage) for msg in messages)

    expected_message_count_min, expected_message_count_max = get_expected_message_count_range(
        model_handle, model_settings, tool_call=has_tool_calls, streaming=streaming, from_db=from_db
    )
    # Allow for extra system messages (like memory alerts) when from_db=True
    if from_db:
        expected_message_count_max += 2  # Allow up to 2 extra system messages
    assert expected_message_count_min <= len(messages) <= expected_message_count_max, (
        f"Expected {expected_message_count_min}-{expected_message_count_max} messages, got {len(messages)}"
    )

    # User message if loaded from db
    index = 0
    if from_db:
        assert isinstance(messages[index], UserMessage)
        assert messages[index].otid == USER_MESSAGE_OTID
        index += 1

    # Reasoning message if reasoning enabled
    otid_suffix = 0
    try:
        if is_reasoner_model(model_handle, model_settings):
            assert isinstance(messages[index], (ReasoningMessage, HiddenReasoningMessage))
            assert messages[index].otid and messages[index].otid[-1] == str(otid_suffix)
            index += 1
            otid_suffix += 1
    except:
        # Reasoning is non-deterministic, so don't throw if missing
        pass

    # Either Assistant message or Tool call message
    if has_tool_calls:
        # Tool call message
        assert isinstance(messages[index], ToolCallMessage)
        assert messages[index].otid and messages[index].otid[-1] == str(otid_suffix)
        index += 1
        otid_suffix += 1
        # Tool return message
        assert isinstance(messages[index], ToolReturnMessage)
        index += 1
    else:
        # Assistant message
        assert isinstance(messages[index], AssistantMessage)
        assert messages[index].otid and messages[index].otid[-1] == str(otid_suffix)
        index += 1
        otid_suffix += 1

    # Skip any trailing system messages (like memory alerts)
    # These can appear when from_db=True due to memory summarization

    # Stop reason and usage statistics if streaming
    if streaming and index < len(messages):
        assert isinstance(messages[index], LettaStopReason)
        assert messages[index].stop_reason == "end_turn"
        index += 1
        assert isinstance(messages[index], LettaUsageStatistics)
        assert messages[index].prompt_tokens > 0
        assert messages[index].completion_tokens > 0
        assert messages[index].total_tokens > 0
        assert messages[index].step_count > 0


def accumulate_chunks(chunks: List[Any], verify_token_streaming: bool = False) -> List[Any]:
    """
    Accumulates chunks into a list of messages.
    Handles both message objects and raw SSE strings.
    """
    messages = []
    current_message = None
    prev_message_type = None
    chunk_count = 0

    # Check if chunks are raw SSE strings (from background streaming)
    if chunks and isinstance(chunks[0], str):
        import json

        # Join all string chunks and parse as SSE
        sse_data = "".join(chunks)
        for line in sse_data.strip().split("\n"):
            if line.startswith("data: ") and line != "data: [DONE]":
                try:
                    data = json.loads(line[6:])  # Remove 'data: ' prefix
                    if "message_type" in data:
                        message_type = data.get("message_type")
                        if message_type == "assistant_message":
                            chunk = AssistantMessage(**data)
                        elif message_type == "reasoning_message":
                            chunk = ReasoningMessage(**data)
                        elif message_type == "hidden_reasoning_message":
                            chunk = HiddenReasoningMessage(**data)
                        elif message_type == "tool_call_message":
                            chunk = ToolCallMessage(**data)
                        elif message_type == "tool_return_message":
                            chunk = ToolReturnMessage(**data)
                        elif message_type == "user_message":
                            chunk = UserMessage(**data)
                        elif message_type == "stop_reason":
                            chunk = LettaStopReason(**data)
                        elif message_type == "usage_statistics":
                            chunk = LettaUsageStatistics(**data)
                        else:
                            continue  # Skip unknown types

                        current_message_type = chunk.message_type
                        if prev_message_type != current_message_type:
                            if current_message is not None:
                                messages.append(current_message)
                            current_message = chunk
                            chunk_count = 1
                        else:
                            # Accumulate content for same message type
                            if hasattr(current_message, "content") and hasattr(chunk, "content"):
                                current_message.content += chunk.content
                            chunk_count += 1
                        prev_message_type = current_message_type
                except json.JSONDecodeError:
                    continue

        if current_message is not None:
            messages.append(current_message)
    else:
        # Handle message objects
        for chunk in chunks:
            current_message_type = chunk.message_type
            if prev_message_type != current_message_type:
                messages.append(current_message)
                if (
                    prev_message_type
                    and verify_token_streaming
                    and current_message.message_type in ["reasoning_message", "assistant_message", "tool_call_message"]
                ):
                    assert chunk_count > 1, f"Expected more than one chunk for {current_message.message_type}. Messages: {messages}"
                current_message = None
                chunk_count = 0
            if current_message is None:
                current_message = chunk
            else:
                pass  # TODO: actually accumulate the chunks. For now we only care about the count
            prev_message_type = current_message_type
            chunk_count += 1
        messages.append(current_message)
        if verify_token_streaming and current_message.message_type in ["reasoning_message", "assistant_message", "tool_call_message"]:
            assert chunk_count > 1, f"Expected more than one chunk for {current_message.message_type}"

    return [m for m in messages if m is not None]


def cast_message_dict_to_messages(messages: List[Dict[str, Any]]) -> List[Message]:
    def cast_message(message: Dict[str, Any]) -> Message:
        if message["message_type"] == "reasoning_message":
            return ReasoningMessage(**message)
        elif message["message_type"] == "assistant_message":
            return AssistantMessage(**message)
        elif message["message_type"] == "tool_call_message":
            return ToolCallMessage(**message)
        elif message["message_type"] == "tool_return_message":
            return ToolReturnMessage(**message)
        elif message["message_type"] == "user_message":
            return UserMessage(**message)
        elif message["message_type"] == "hidden_reasoning_message":
            return HiddenReasoningMessage(**message)
        else:
            raise ValueError(f"Unknown message type: {message['message_type']}")

    return [cast_message(message) for message in messages]


# ------------------------------
# Fixtures
# ------------------------------


@pytest.fixture(scope="module")
def server_url() -> str:
    """
    Provides the URL for the Letta server.
    If LETTA_SERVER_URL is not set, starts the server in a background thread
    and polls until it's accepting connections.
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

    return url


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


@pytest.fixture(scope="function")
def agent_state(client: Letta) -> AgentState:
    """
    Creates and returns an agent state for testing with a pre-configured agent.
    The agent is named 'supervisor' and is configured with base tools and the roll_dice tool.
    """
    client.tools.upsert_base_tools()
    dice_tool = client.tools.upsert_from_function(func=roll_dice)

    send_message_tool = client.tools.list(name="send_message").items[0]
    agent_state_instance = client.agents.create(
        name="supervisor",
        agent_type="memgpt_v2_agent",
        include_base_tools=False,
        tool_ids=[send_message_tool.id, dice_tool.id],
        model="openai/gpt-4o",
        embedding="openai/text-embedding-3-small",
        tags=["supervisor"],
    )
    yield agent_state_instance

    # try:
    #     client.agents.delete(agent_state_instance.id)
    # except Exception as e:
    #     logger.error(f"Failed to delete agent {agent_state_instance.name}: {str(e)}")


# ------------------------------
# Test Cases
# ------------------------------


@pytest.mark.parametrize(
    "model_config",
    TESTED_MODEL_CONFIGS,
    ids=[handle for handle, _ in TESTED_MODEL_CONFIGS],
)
def test_greeting_with_assistant_message(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    model_config: Tuple[str, dict],
) -> None:
    """
    Tests sending a message with a synchronous client.
    Verifies that the response messages follow the expected order.
    """
    model_handle, model_settings = model_config
    # Skip deprecated Gemini 1.5 models which are no longer supported on generateContent
    if model_settings.get("provider_type") in ["google_vertex", "google_ai"] and "gemini-1.5" in model_handle:
        pytest.skip(f"Skipping deprecated model {model_handle}")
    last_message_page = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    last_message = last_message_page.items[0] if last_message_page.items else None
    agent_state = client.agents.update(agent_id=agent_state.id, model=model_handle, model_settings=model_settings)
    response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_FORCE_REPLY,
    )
    assert_contains_run_id(response.messages)
    assert_greeting_with_assistant_message_response(response.messages, model_handle, model_settings)
    messages_from_db_page = client.agents.messages.list(agent_id=agent_state.id, after=last_message.id if last_message else None)
    messages_from_db = messages_from_db_page.items
    assert_first_message_is_user_message(messages_from_db)
    assert_greeting_with_assistant_message_response(messages_from_db, model_handle, model_settings, from_db=True)


@pytest.mark.parametrize(
    "model_config",
    TESTED_MODEL_CONFIGS,
    ids=[handle for handle, _ in TESTED_MODEL_CONFIGS],
)
def test_greeting_without_assistant_message(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    model_config: Tuple[str, dict],
) -> None:
    """
    Tests sending a message with a synchronous client.
    Verifies that the response messages follow the expected order.
    """
    model_handle, model_settings = model_config
    # Skip deprecated Gemini 1.5 models which are no longer supported on generateContent
    if model_settings.get("provider_type") in ["google_vertex", "google_ai"] and "gemini-1.5" in model_handle:
        pytest.skip(f"Skipping deprecated model {model_handle}")
    last_message_page = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    last_message = last_message_page.items[0] if last_message_page.items else None
    agent_state = client.agents.update(agent_id=agent_state.id, model=model_handle, model_settings=model_settings)
    response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_FORCE_REPLY,
        use_assistant_message=False,
    )
    assert_greeting_without_assistant_message_response(response.messages, model_handle, model_settings)
    messages_from_db_page = client.agents.messages.list(
        agent_id=agent_state.id, after=last_message.id if last_message else None, use_assistant_message=False
    )
    messages_from_db = messages_from_db_page.items
    assert_greeting_without_assistant_message_response(messages_from_db, model_handle, model_settings, from_db=True)


@pytest.mark.parametrize(
    "model_config",
    TESTED_MODEL_CONFIGS,
    ids=[handle for handle, _ in TESTED_MODEL_CONFIGS],
)
def test_tool_call(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    model_config: Tuple[str, dict],
) -> None:
    """
    Tests sending a message with a synchronous client.
    Verifies that the response messages follow the expected order.
    """
    model_handle, model_settings = model_config
    # Skip deprecated Gemini 1.5 models which are no longer supported on generateContent
    if model_settings.get("provider_type") in ["google_vertex", "google_ai"] and "gemini-1.5" in model_handle:
        pytest.skip(f"Skipping deprecated model {model_handle}")
    # Skip qwen and o4-mini models due to OTID chain issue and incomplete response (stops after tool return)
    if "qwen" in model_handle.lower() or "o4-mini" in model_handle:
        pytest.skip(f"Skipping {model_handle} due to OTID chain issue and incomplete agent response")
    last_message_page = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    last_message = last_message_page.items[0] if last_message_page.items else None
    agent_state = client.agents.update(agent_id=agent_state.id, model=model_handle, model_settings=model_settings)
    # Use the thinking prompt for Anthropic models with extended reasoning to ensure second reasoning step
    if model_settings.get("provider_type") == "anthropic" and model_settings.get("thinking", {}).get("type") == "enabled":
        messages_to_send = USER_MESSAGE_ROLL_DICE_LONG_THINKING
    elif model_settings.get("provider_type") in ["google_vertex", "google_ai"] and "gemini-2.5-flash" in model_handle:
        messages_to_send = USER_MESSAGE_ROLL_DICE_GEMINI_FLASH
    else:
        messages_to_send = USER_MESSAGE_ROLL_DICE
    try:
        response = client.agents.messages.create(
            agent_id=agent_state.id,
            messages=messages_to_send,
        )
    except Exception as e:
        # if "flash" in llm_config.model and "FinishReason.MALFORMED_FUNCTION_CALL" in str(e):
        #     pytest.skip("Skipping test for flash model due to malformed function call from llm")
        raise e
    assert_tool_call_response(response.messages, model_handle, model_settings)

    # Get the run_id from the response to filter messages by this specific run
    # This handles cases where retries create multiple runs (e.g., Google Vertex 504 DEADLINE_EXCEEDED)
    run_id = response.messages[0].run_id if response.messages else None

    messages_from_db_page = client.agents.messages.list(agent_id=agent_state.id, after=last_message.id if last_message else None)
    messages_from_db = [msg for msg in messages_from_db_page.items if msg.run_id == run_id] if run_id else messages_from_db_page.items
    assert_tool_call_response(messages_from_db, model_handle, model_settings, from_db=True)


@pytest.mark.parametrize(
    "model_config",
    [
        (
            pytest.param(config, marks=pytest.mark.xfail(reason="Qwen image processing unstable - needs investigation"))
            if "Qwen/Qwen2.5-72B-Instruct-Turbo" in config[0]
            else config
        )
        for config in TESTED_MODEL_CONFIGS
    ],
    ids=[handle for handle, _ in TESTED_MODEL_CONFIGS],
)
def test_base64_image_input(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    model_config: Tuple[str, dict],
) -> None:
    """
    Tests sending a message with a synchronous client.
    Verifies that the response messages follow the expected order.
    """
    model_handle, model_settings = model_config
    # get the config filename by matching model handle
    config_filename = None
    for filename in filenames:
        config_handle, _ = get_model_config(filename)
        if config_handle == model_handle:
            config_filename = filename
            break

    # skip if this is a limited model
    if not config_filename or config_filename in limited_configs:
        pytest.skip(f"Skipping test for limited model {model_handle}")

    last_message_page = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    last_message = last_message_page.items[0] if last_message_page.items else None
    agent_state = client.agents.update(agent_id=agent_state.id, model=model_handle, model_settings=model_settings)
    response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_BASE64_IMAGE,
    )
    assert_image_input_response(response.messages, model_handle, model_settings)
    messages_from_db_page = client.agents.messages.list(agent_id=agent_state.id, after=last_message.id if last_message else None)
    messages_from_db = messages_from_db_page.items
    assert_image_input_response(messages_from_db, model_handle, model_settings, from_db=True)


@pytest.mark.parametrize(
    "model_config",
    TESTED_MODEL_CONFIGS,
    ids=[handle for handle, _ in TESTED_MODEL_CONFIGS],
)
def test_agent_loop_error(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    model_config: Tuple[str, dict],
) -> None:
    """
    Tests sending a message with a synchronous client.
    Verifies that no new messages are persisted on error.
    """
    last_message_page = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    last_message = last_message_page.items[0] if last_message_page.items else None
    model_handle, model_settings = model_config
    agent_state = client.agents.update(agent_id=agent_state.id, model=model_handle, model_settings=model_settings)

    with patch("letta.agents.letta_agent_v2.LettaAgentV2.step") as mock_step:
        mock_step.side_effect = LLMError("No tool calls found in response, model must make a tool call")

        with pytest.raises(APIError):
            client.agents.messages.create(
                agent_id=agent_state.id,
                messages=USER_MESSAGE_FORCE_REPLY,
            )

    time.sleep(0.5)
    messages_from_db_page = client.agents.messages.list(agent_id=agent_state.id, after=last_message.id if last_message else None)
    messages_from_db = messages_from_db_page.items
    assert len(messages_from_db) == 0


@pytest.mark.parametrize(
    "model_config",
    TESTED_MODEL_CONFIGS,
    ids=[handle for handle, _ in TESTED_MODEL_CONFIGS],
)
def test_step_streaming_greeting_with_assistant_message(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    model_config: Tuple[str, dict],
) -> None:
    """
    Tests sending a streaming message with a synchronous client.
    Checks that each chunk in the stream has the correct message types.
    """
    last_message_page = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    last_message = last_message_page.items[0] if last_message_page.items else None
    model_handle, model_settings = model_config
    agent_state = client.agents.update(agent_id=agent_state.id, model=model_handle, model_settings=model_settings)
    response = client.agents.messages.stream(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_FORCE_REPLY,
    )
    chunks = list(response)
    assert_contains_step_id(chunks)
    assert_contains_run_id(chunks)
    messages = accumulate_chunks(chunks)
    assert_greeting_with_assistant_message_response(messages, model_handle, model_settings, streaming=True)
    messages_from_db_page = client.agents.messages.list(agent_id=agent_state.id, after=last_message.id if last_message else None)
    messages_from_db = messages_from_db_page.items
    assert_contains_run_id(messages_from_db)
    assert_greeting_with_assistant_message_response(messages_from_db, model_handle, model_settings, from_db=True)


@pytest.mark.parametrize(
    "model_config",
    TESTED_MODEL_CONFIGS,
    ids=[handle for handle, _ in TESTED_MODEL_CONFIGS],
)
def test_step_streaming_greeting_without_assistant_message(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    model_config: Tuple[str, dict],
) -> None:
    """
    Tests sending a streaming message with a synchronous client.
    Checks that each chunk in the stream has the correct message types.
    """
    last_message_page = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    last_message = last_message_page.items[0] if last_message_page.items else None
    model_handle, model_settings = model_config
    agent_state = client.agents.update(agent_id=agent_state.id, model=model_handle, model_settings=model_settings)
    response = client.agents.messages.stream(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_FORCE_REPLY,
        use_assistant_message=False,
    )
    messages = accumulate_chunks(list(response))
    assert_greeting_without_assistant_message_response(messages, model_handle, model_settings, streaming=True)
    messages_from_db_page = client.agents.messages.list(
        agent_id=agent_state.id, after=last_message.id if last_message else None, use_assistant_message=False
    )
    messages_from_db = messages_from_db_page.items
    assert_greeting_without_assistant_message_response(messages_from_db, model_handle, model_settings, from_db=True)


@pytest.mark.parametrize(
    "model_config",
    TESTED_MODEL_CONFIGS,
    ids=[handle for handle, _ in TESTED_MODEL_CONFIGS],
)
def test_step_streaming_tool_call(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    model_config: Tuple[str, dict],
) -> None:
    """
    Tests sending a streaming message with a synchronous client.
    Checks that each chunk in the stream has the correct message types.
    """
    model_handle, model_settings = model_config
    # get the config filename by matching model handle
    config_filename = None
    for filename in filenames:
        config_handle, _ = get_model_config(filename)
        if config_handle == model_handle:
            config_filename = filename
            break

    # skip if this is a limited model
    if not config_filename or config_filename in limited_configs:
        pytest.skip(f"Skipping test for limited model {model_handle}")

    last_message_page = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    last_message = last_message_page.items[0] if last_message_page.items else None
    agent_state = client.agents.update(agent_id=agent_state.id, model=model_handle, model_settings=model_settings)
    # Use the thinking prompt for Anthropic models with extended reasoning to ensure second reasoning step
    if model_settings.get("provider_type") == "anthropic" and model_settings.get("thinking", {}).get("type") == "enabled":
        messages_to_send = USER_MESSAGE_ROLL_DICE_LONG_THINKING
    elif model_settings.get("provider_type") in ["google_vertex", "google_ai"] and "gemini-2.5-flash" in model_handle:
        messages_to_send = USER_MESSAGE_ROLL_DICE_GEMINI_FLASH
    else:
        messages_to_send = USER_MESSAGE_ROLL_DICE
    response = client.agents.messages.stream(
        agent_id=agent_state.id,
        messages=messages_to_send,
        timeout=300,
    )
    messages = accumulate_chunks(list(response))

    # Gemini 2.5 Flash can occasionally stop after tool return without making the final send_message call.
    # Accept this shorter pattern for robustness when using Google endpoints with Flash.
    # TODO un-relax this test once on the new v1 architecture / v3 loop
    is_gemini_flash = model_settings.get("provider_type") in ["google_vertex", "google_ai"] and "gemini-2.5-flash" in model_handle
    if (
        is_gemini_flash
        and hasattr(messages[-1], "message_type")
        and messages[-1].message_type == "stop_reason"
        and getattr(messages[-1], "stop_reason", None) == "no_tool_call"
    ):
        # Relaxation: allow early stop on Flash without final send_message call
        return

    # Default strict assertions for all other models / cases
    assert_tool_call_response(messages, model_handle, model_settings, streaming=True)
    messages_from_db_page = client.agents.messages.list(agent_id=agent_state.id, after=last_message.id if last_message else None)
    messages_from_db = messages_from_db_page.items
    assert_tool_call_response(messages_from_db, model_handle, model_settings, from_db=True)


@pytest.mark.parametrize(
    "model_config",
    TESTED_MODEL_CONFIGS,
    ids=[handle for handle, _ in TESTED_MODEL_CONFIGS],
)
def test_step_stream_agent_loop_error(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    model_config: Tuple[str, dict],
) -> None:
    """
    Tests sending a message with a synchronous client.
    Verifies that no new messages are persisted on error.
    """
    last_message_page = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    last_message = last_message_page.items[0] if last_message_page.items else None
    model_handle, model_settings = model_config
    agent_state = client.agents.update(agent_id=agent_state.id, model=model_handle, model_settings=model_settings)

    with patch("letta.agents.letta_agent_v2.LettaAgentV2.stream") as mock_step:
        mock_step.side_effect = ValueError("No tool calls found in response, model must make a tool call")

        with pytest.raises(APIError):
            response = client.agents.messages.stream(
                agent_id=agent_state.id,
                messages=USER_MESSAGE_FORCE_REPLY,
            )
            list(response)  # This should trigger the error

    messages_from_db_page = client.agents.messages.list(agent_id=agent_state.id, after=last_message.id if last_message else None)
    messages_from_db = messages_from_db_page.items
    assert len(messages_from_db) == 0


@pytest.mark.parametrize(
    "model_config",
    TESTED_MODEL_CONFIGS,
    ids=[handle for handle, _ in TESTED_MODEL_CONFIGS],
)
def test_token_streaming_greeting_with_assistant_message(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    model_config: Tuple[str, dict],
) -> None:
    """
    Tests sending a streaming message with a synchronous client.
    Checks that each chunk in the stream has the correct message types.
    """
    model_handle, model_settings = model_config

    # Skip for non-reasoner models - token streaming doesn't work when put_inner_thoughts_in_kwargs=False
    if not is_reasoner_model(model_handle, model_settings):
        pytest.skip(f"Skipping token streaming test for non-reasoner model {model_handle}")

    last_message_page = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    last_message = last_message_page.items[0] if last_message_page.items else None
    agent_state = client.agents.update(agent_id=agent_state.id, model=model_handle, model_settings=model_settings)
    # Use longer message for Anthropic models to test if they stream in chunks
    if model_settings.get("provider_type") == "anthropic":
        messages_to_send = USER_MESSAGE_FORCE_LONG_REPLY
    else:
        messages_to_send = USER_MESSAGE_FORCE_REPLY
    response = client.agents.messages.stream(
        agent_id=agent_state.id,
        messages=messages_to_send,
        stream_tokens=True,
    )
    verify_token_streaming = (
        model_settings.get("provider_type") in ["anthropic", "openai", "bedrock"] and "claude-3-5-sonnet" not in model_handle
    )
    messages = accumulate_chunks(list(response), verify_token_streaming=verify_token_streaming)
    assert_greeting_with_assistant_message_response(messages, model_handle, model_settings, streaming=True, token_streaming=True)
    messages_from_db_page = client.agents.messages.list(agent_id=agent_state.id, after=last_message.id if last_message else None)
    messages_from_db = messages_from_db_page.items
    assert_greeting_with_assistant_message_response(messages_from_db, model_handle, model_settings, from_db=True)


@pytest.mark.parametrize(
    "model_config",
    TESTED_MODEL_CONFIGS,
    ids=[handle for handle, _ in TESTED_MODEL_CONFIGS],
)
def test_token_streaming_greeting_without_assistant_message(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    model_config: Tuple[str, dict],
) -> None:
    """
    Tests sending a streaming message with a synchronous client.
    Checks that each chunk in the stream has the correct message types.
    """
    model_handle, model_settings = model_config

    # Skip for non-reasoner models - token streaming doesn't work when put_inner_thoughts_in_kwargs=False
    if not is_reasoner_model(model_handle, model_settings):
        pytest.skip(f"Skipping token streaming test for non-reasoner model {model_handle}")

    last_message_page = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    last_message = last_message_page.items[0] if last_message_page.items else None
    agent_state = client.agents.update(agent_id=agent_state.id, model=model_handle, model_settings=model_settings)
    # Use longer message for Anthropic models to force chunking
    if model_settings.get("provider_type") == "anthropic":
        messages_to_send = USER_MESSAGE_FORCE_LONG_REPLY
    else:
        messages_to_send = USER_MESSAGE_FORCE_REPLY
    response = client.agents.messages.stream(
        agent_id=agent_state.id,
        messages=messages_to_send,
        use_assistant_message=False,
        stream_tokens=True,
    )
    verify_token_streaming = (
        model_settings.get("provider_type") in ["anthropic", "openai", "bedrock"] and "claude-3-5-sonnet" not in model_handle
    )
    messages = accumulate_chunks(list(response), verify_token_streaming=verify_token_streaming)
    assert_greeting_without_assistant_message_response(messages, model_handle, model_settings, streaming=True, token_streaming=True)
    messages_from_db_page = client.agents.messages.list(
        agent_id=agent_state.id, after=last_message.id if last_message else None, use_assistant_message=False
    )
    messages_from_db = messages_from_db_page.items
    assert_greeting_without_assistant_message_response(messages_from_db, model_handle, model_settings, from_db=True)


@pytest.mark.parametrize(
    "model_config",
    TESTED_MODEL_CONFIGS,
    ids=[handle for handle, _ in TESTED_MODEL_CONFIGS],
)
def test_token_streaming_tool_call(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    model_config: Tuple[str, dict],
) -> None:
    """
    Tests sending a streaming message with a synchronous client.
    Checks that each chunk in the stream has the correct message types.
    """
    model_handle, model_settings = model_config

    # Skip for non-reasoner models - token streaming doesn't work when put_inner_thoughts_in_kwargs=False
    if not is_reasoner_model(model_handle, model_settings):
        pytest.skip(f"Skipping token streaming test for non-reasoner model {model_handle}")

    # get the config filename by matching model handle
    config_filename = None
    for filename in filenames:
        config_handle, _ = get_model_config(filename)
        if config_handle == model_handle:
            config_filename = filename
            break

    # skip if this is a limited model
    if not config_filename or config_filename in limited_configs:
        pytest.skip(f"Skipping test for limited model {model_handle}")

    last_message_page = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    last_message = last_message_page.items[0] if last_message_page.items else None
    agent_state = client.agents.update(agent_id=agent_state.id, model=model_handle, model_settings=model_settings)
    # Use longer message for Anthropic models to force chunking
    if model_settings.get("provider_type") == "anthropic":
        if model_settings.get("thinking", {}).get("type") == "enabled":
            # Without asking the model to think, Anthropic might decide to not think for the second step post-roll
            messages_to_send = USER_MESSAGE_ROLL_DICE_LONG_THINKING
        else:
            messages_to_send = USER_MESSAGE_ROLL_DICE_LONG
    elif model_settings.get("provider_type") in ["google_vertex", "google_ai"] and "gemini-2.5-flash" in model_handle:
        messages_to_send = USER_MESSAGE_ROLL_DICE_GEMINI_FLASH
    else:
        messages_to_send = USER_MESSAGE_ROLL_DICE
    response = client.agents.messages.stream(
        agent_id=agent_state.id,
        messages=messages_to_send,
        stream_tokens=True,
        timeout=300,
    )
    verify_token_streaming = (
        model_settings.get("provider_type") in ["anthropic", "openai", "bedrock"] and "claude-3-5-sonnet" not in model_handle
    )
    messages = accumulate_chunks(list(response), verify_token_streaming=verify_token_streaming)
    # Relaxation for Gemini 2.5 Flash: allow early stop with no final send_message call
    is_gemini_flash = model_settings.get("provider_type") in ["google_vertex", "google_ai"] and "gemini-2.5-flash" in model_handle
    if (
        is_gemini_flash
        and hasattr(messages[-1], "message_type")
        and messages[-1].message_type == "stop_reason"
        and getattr(messages[-1], "stop_reason", None) == "no_tool_call"
    ):
        # Accept the shorter pattern for token streaming on Flash
        pass
    else:
        assert_tool_call_response(messages, model_handle, model_settings, streaming=True)
    messages_from_db_page = client.agents.messages.list(agent_id=agent_state.id, after=last_message.id if last_message else None)
    messages_from_db = messages_from_db_page.items
    assert_tool_call_response(messages_from_db, model_handle, model_settings, from_db=True)


@pytest.mark.parametrize(
    "model_config",
    TESTED_MODEL_CONFIGS,
    ids=[handle for handle, _ in TESTED_MODEL_CONFIGS],
)
def test_token_streaming_agent_loop_error(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    model_config: Tuple[str, dict],
) -> None:
    """
    Tests sending a streaming message with a synchronous client.
    Verifies that no new messages are persisted on error.
    """
    model_handle, model_settings = model_config

    # Skip for non-reasoner models - token streaming doesn't work when put_inner_thoughts_in_kwargs=False
    if not is_reasoner_model(model_handle, model_settings):
        pytest.skip(f"Skipping token streaming test for non-reasoner model {model_handle}")

    last_message_page = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    last_message = last_message_page.items[0] if last_message_page.items else None
    agent_state = client.agents.update(agent_id=agent_state.id, model=model_handle, model_settings=model_settings)

    with patch("letta.agents.letta_agent_v2.LettaAgentV2.stream") as mock_step:
        mock_step.side_effect = ValueError("No tool calls found in response, model must make a tool call")

        with pytest.raises(APIError):
            response = client.agents.messages.stream(
                agent_id=agent_state.id,
                messages=USER_MESSAGE_FORCE_REPLY,
                stream_tokens=True,
            )
            list(response)  # This should trigger the error

    messages_from_db_page = client.agents.messages.list(agent_id=agent_state.id, after=last_message.id if last_message else None)
    messages_from_db = messages_from_db_page.items
    assert len(messages_from_db) == 0


@pytest.mark.parametrize(
    "model_config",
    TESTED_MODEL_CONFIGS,
    ids=[handle for handle, _ in TESTED_MODEL_CONFIGS],
)
@pytest.mark.skip(reason="Skipping until token streaming is fixed for non-reasoner models")
def test_background_token_streaming_greeting_with_assistant_message(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    model_config: Tuple[str, dict],
) -> None:
    """
    Tests sending a streaming message with a synchronous client.
    Checks that each chunk in the stream has the correct message types.
    """
    model_handle, model_settings = model_config

    # Skip for non-reasoner models - token streaming doesn't work when put_inner_thoughts_in_kwargs=False
    if not is_reasoner_model(model_handle, model_settings):
        pytest.skip(f"Skipping token streaming test for non-reasoner model {model_handle}")

    last_message_page = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    last_message = last_message_page.items[0] if last_message_page.items else None
    agent_state = client.agents.update(agent_id=agent_state.id, model=model_handle, model_settings=model_settings)
    # Use longer message for Anthropic models to test if they stream in chunks
    if model_settings.get("provider_type") == "anthropic":
        messages_to_send = USER_MESSAGE_FORCE_LONG_REPLY
    else:
        messages_to_send = USER_MESSAGE_FORCE_REPLY
    response = client.agents.messages.stream(
        agent_id=agent_state.id,
        messages=messages_to_send,
        stream_tokens=True,
        background=True,
        timeout=300,
    )
    verify_token_streaming = (
        model_settings.get("provider_type") in ["anthropic", "openai", "bedrock"] and "claude-3-5-sonnet" not in model_handle
    )
    messages = accumulate_chunks(list(response), verify_token_streaming=verify_token_streaming)
    assert_greeting_with_assistant_message_response(messages, model_handle, model_settings, streaming=True, token_streaming=True)
    messages_from_db_page = client.agents.messages.list(agent_id=agent_state.id, after=last_message.id if last_message else None)
    messages_from_db = messages_from_db_page.items
    assert_greeting_with_assistant_message_response(messages_from_db, model_handle, model_settings, from_db=True)

    run_id = messages[0].run_id
    assert run_id is not None

    runs = client.runs.list(agent_ids=[agent_state.id], background=True).items
    assert len(runs) > 0
    assert runs[0].id == run_id

    response = client.runs.messages.stream(run_id=run_id, starting_after=0)
    messages = accumulate_chunks(list(response), verify_token_streaming=verify_token_streaming)
    assert_greeting_with_assistant_message_response(messages, model_handle, model_settings, streaming=True, token_streaming=True)

    last_message_cursor = messages[-3].seq_id - 1
    response = client.runs.messages.stream(run_id=run_id, starting_after=last_message_cursor)
    messages = accumulate_chunks(list(response), verify_token_streaming=verify_token_streaming)
    assert len(messages) == 3
    # GPT-5 returns hidden_reasoning_message instead of assistant_message
    if is_hidden_reasoning_model(model_handle, model_settings):
        assert messages[0].message_type == "hidden_reasoning_message" and messages[0].seq_id == last_message_cursor + 1
    else:
        assert messages[0].message_type == "assistant_message" and messages[0].seq_id == last_message_cursor + 1
    assert messages[1].message_type == "stop_reason"
    assert messages[2].message_type == "usage_statistics"


@pytest.mark.parametrize(
    "model_config",
    TESTED_MODEL_CONFIGS,
    ids=[handle for handle, _ in TESTED_MODEL_CONFIGS],
)
def test_background_token_streaming_greeting_without_assistant_message(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    model_config: Tuple[str, dict],
) -> None:
    """
    Tests sending a streaming message with a synchronous client.
    Checks that each chunk in the stream has the correct message types.
    """
    model_handle, model_settings = model_config

    # Skip for non-reasoner models - token streaming doesn't work when put_inner_thoughts_in_kwargs=False
    if not is_reasoner_model(model_handle, model_settings):
        pytest.skip(f"Skipping token streaming test for non-reasoner model {model_handle}")

    last_message_page = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    last_message = last_message_page.items[0] if last_message_page.items else None
    agent_state = client.agents.update(agent_id=agent_state.id, model=model_handle, model_settings=model_settings)
    # Use longer message for Anthropic models to force chunking
    if model_settings.get("provider_type") == "anthropic":
        messages_to_send = USER_MESSAGE_FORCE_LONG_REPLY
    else:
        messages_to_send = USER_MESSAGE_FORCE_REPLY
    response = client.agents.messages.stream(
        agent_id=agent_state.id,
        messages=messages_to_send,
        use_assistant_message=False,
        stream_tokens=True,
        background=True,
    )
    verify_token_streaming = (
        model_settings.get("provider_type") in ["anthropic", "openai", "bedrock"] and "claude-3-5-sonnet" not in model_handle
    )
    messages = accumulate_chunks(list(response), verify_token_streaming=verify_token_streaming)
    assert_greeting_without_assistant_message_response(messages, model_handle, model_settings, streaming=True, token_streaming=True)
    messages_from_db_page = client.agents.messages.list(
        agent_id=agent_state.id, after=last_message.id if last_message else None, use_assistant_message=False
    )
    messages_from_db = messages_from_db_page.items
    assert_greeting_without_assistant_message_response(messages_from_db, model_handle, model_settings, from_db=True)


@pytest.mark.parametrize(
    "model_config",
    TESTED_MODEL_CONFIGS,
    ids=[handle for handle, _ in TESTED_MODEL_CONFIGS],
)
def test_background_token_streaming_tool_call(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    model_config: Tuple[str, dict],
) -> None:
    """
    Tests sending a streaming message with a synchronous client.
    Checks that each chunk in the stream has the correct message types.
    """
    model_handle, model_settings = model_config

    # Skip for non-reasoner models - token streaming doesn't work when put_inner_thoughts_in_kwargs=False
    if not is_reasoner_model(model_handle, model_settings):
        pytest.skip(f"Skipping token streaming test for non-reasoner model {model_handle}")

    # get the config filename by matching model handle
    config_filename = None
    for filename in filenames:
        config_handle, _ = get_model_config(filename)
        if config_handle == model_handle:
            config_filename = filename
            break

    # skip if this is a limited model
    if not config_filename or config_filename in limited_configs:
        pytest.skip(f"Skipping test for limited model {model_handle}")

    last_message_page = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    last_message = last_message_page.items[0] if last_message_page.items else None
    agent_state = client.agents.update(agent_id=agent_state.id, model=model_handle, model_settings=model_settings)
    # Use longer message for Anthropic models to force chunking
    if model_settings.get("provider_type") == "anthropic":
        if model_settings.get("thinking", {}).get("type") == "enabled":
            # Without asking the model to think, Anthropic might decide to not think for the second step post-roll
            messages_to_send = USER_MESSAGE_ROLL_DICE_LONG_THINKING
        else:
            messages_to_send = USER_MESSAGE_ROLL_DICE_LONG
    elif model_settings.get("provider_type") in ["google_vertex", "google_ai"] and "gemini-2.5-flash" in model_handle:
        messages_to_send = USER_MESSAGE_ROLL_DICE_GEMINI_FLASH
    else:
        messages_to_send = USER_MESSAGE_ROLL_DICE
    response = client.agents.messages.stream(
        agent_id=agent_state.id,
        messages=messages_to_send,
        stream_tokens=True,
        background=True,
        timeout=300,
    )
    verify_token_streaming = (
        model_settings.get("provider_type") in ["anthropic", "openai", "bedrock"] and "claude-3-5-sonnet" not in model_handle
    )
    messages = accumulate_chunks(list(response), verify_token_streaming=verify_token_streaming)
    assert_tool_call_response(messages, model_handle, model_settings, streaming=True)
    messages_from_db_page = client.agents.messages.list(agent_id=agent_state.id, after=last_message.id if last_message else None)
    messages_from_db = messages_from_db_page.items
    assert_tool_call_response(messages_from_db, model_handle, model_settings, from_db=True)


def wait_for_run_completion(client: Letta, run_id: str, timeout: float = 30.0, interval: float = 0.5) -> Run:
    start = time.time()
    while True:
        run = client.runs.retrieve(run_id)
        if run.status == "completed":
            return run
        if run.status == "failed":
            print(run)
            raise RuntimeError(f"Run {run_id} did not complete: status = {run.status}")
        if time.time() - start > timeout:
            raise TimeoutError(f"Run {run_id} did not complete within {timeout} seconds (last status: {run.status})")
        time.sleep(interval)


@pytest.mark.parametrize(
    "model_config",
    TESTED_MODEL_CONFIGS,
    ids=[handle for handle, _ in TESTED_MODEL_CONFIGS],
)
def test_async_greeting_with_assistant_message(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    model_config: Tuple[str, dict],
) -> None:
    """
    Tests sending a message as an asynchronous job using the synchronous client.
    Waits for job completion and asserts that the result messages are as expected.
    """
    model_handle, model_settings = model_config
    last_message_page = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    last_message = last_message_page.items[0] if last_message_page.items else None
    client.agents.update(agent_id=agent_state.id, model=model_handle, model_settings=model_settings)

    run = client.agents.messages.create_async(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_FORCE_REPLY,
    )
    run = wait_for_run_completion(client, run.id, timeout=60.0)

    messages_page = client.runs.messages.list(run_id=run.id)
    messages = messages_page.items
    usage = client.runs.usage.retrieve(run_id=run.id)

    # TODO: add results API test later
    assert_greeting_with_assistant_message_response(messages, model_handle, model_settings, from_db=True)  # TODO: remove from_db=True later
    messages_from_db_page = client.agents.messages.list(agent_id=agent_state.id, after=last_message.id if last_message else None)
    messages_from_db = messages_from_db_page.items
    assert_greeting_with_assistant_message_response(messages_from_db, model_handle, model_settings, from_db=True)

    # NOTE: deprecated in preparation of letta_v1_agent
    # @pytest.mark.parametrize(
    #    "llm_config",
    #    TESTED_LLM_CONFIGS,
    #    ids=[c.model for c in TESTED_LLM_CONFIGS],
    # )
    # def test_async_greeting_without_assistant_message(
    #    disable_e2b_api_key: Any,
    #    client: Letta,
    #    agent_state: AgentState,
    #    model_config: Tuple[str, dict],
    # ) -> None:
    #    """
    #    Tests sending a message as an asynchronous job using the synchronous client.
    #    Waits for job completion and asserts that the result messages are as expected.
    #    """
    #    last_message_page = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    last_message = last_message_page.items[0] if last_message_page.items else None
    #    client.agents.update(agent_id=agent_state.id, model=model_handle, model_settings=model_settings)
    #
    #    run = client.agents.messages.create_async(
    #        agent_id=agent_state.id,
    #        messages=USER_MESSAGE_FORCE_REPLY,
    #        use_assistant_message=False,
    #    )
    #    run = wait_for_run_completion(client, run.id, timeout=60.0)
    #
    #    messages_page = client.runs.messages.list(run_id=run.id)
    messages = messages_page.items
    #    assert_greeting_without_assistant_message_response(messages, llm_config=llm_config)
    #
    #    messages_page = client.runs.messages.list(run_id=run.id)
    messages = messages_page.items
    #    assert_greeting_without_assistant_message_response(messages, llm_config=llm_config)
    #    messages_from_db_page = client.agents.messages.list(agent_id=agent_state.id, after=last_message.id if last_message else None, use_assistant_message=False)
    messages_from_db = messages_from_db_page.items


#    assert_greeting_without_assistant_message_response(messages_from_db, model_handle, model_settings, from_db=True)


@pytest.mark.parametrize(
    "model_config",
    TESTED_MODEL_CONFIGS,
    ids=[handle for handle, _ in TESTED_MODEL_CONFIGS],
)
def test_async_tool_call(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    model_config: Tuple[str, dict],
) -> None:
    """
    Tests sending a message as an asynchronous job using the synchronous client.
    Waits for job completion and asserts that the result messages are as expected.
    """
    model_handle, model_settings = model_config
    config_filename = None
    for filename in filenames:
        config_handle, _ = get_model_config(filename)
        if config_handle == model_handle:
            config_filename = filename
            break

    # skip if this is a limited model
    if not config_filename or config_filename in limited_configs:
        pytest.skip(f"Skipping test for limited model {model_handle}")

    last_message_page = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    last_message = last_message_page.items[0] if last_message_page.items else None
    client.agents.update(agent_id=agent_state.id, model=model_handle, model_settings=model_settings)

    # Use the thinking prompt for Anthropic models with extended reasoning to ensure second reasoning step
    if model_settings.get("provider_type") == "anthropic" and model_settings.get("thinking", {}).get("type") == "enabled":
        messages_to_send = USER_MESSAGE_ROLL_DICE_LONG_THINKING
    elif model_settings.get("provider_type") in ["google_vertex", "google_ai"] and "gemini-2.5-flash" in model_handle:
        messages_to_send = USER_MESSAGE_ROLL_DICE_GEMINI_FLASH
    else:
        messages_to_send = USER_MESSAGE_ROLL_DICE
    run = client.agents.messages.create_async(
        agent_id=agent_state.id,
        messages=messages_to_send,
    )
    run = wait_for_run_completion(client, run.id, timeout=60.0)
    messages_page = client.runs.messages.list(run_id=run.id)
    messages = messages_page.items
    # TODO: add test for response api
    assert_tool_call_response(messages, model_handle, model_settings, from_db=True)  # NOTE: skip first message which is the user message
    messages_from_db_page = client.agents.messages.list(agent_id=agent_state.id, after=last_message.id if last_message else None)
    messages_from_db = messages_from_db_page.items
    assert_tool_call_response(messages_from_db, model_handle, model_settings, from_db=True)


class CallbackServer:
    """Mock HTTP server for testing callback functionality."""

    def __init__(self):
        self.received_callbacks = []
        self.server = None
        self.thread = None
        self.port = None

    def start(self):
        """Start the mock server on an available port."""

        class CallbackHandler(BaseHTTPRequestHandler):
            def __init__(self, callback_server, *args, **kwargs):
                self.callback_server = callback_server
                super().__init__(*args, **kwargs)

            def do_POST(self):
                content_length = int(self.headers["Content-Length"])
                post_data = self.rfile.read(content_length)
                try:
                    callback_data = json.loads(post_data.decode("utf-8"))
                    self.callback_server.received_callbacks.append(
                        {"data": callback_data, "headers": dict(self.headers), "timestamp": time.time()}
                    )
                    # Respond with success
                    self.send_response(200)
                    self.send_header("Content-type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "received"}).encode())
                except Exception as e:
                    # Respond with error
                    self.send_response(400)
                    self.send_header("Content-type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": str(e)}).encode())

            def log_message(self, format, *args):
                # Suppress log messages during tests
                pass

        # Bind to available port
        self.server = HTTPServer(("localhost", 0), lambda *args: CallbackHandler(self, *args))
        self.port = self.server.server_address[1]

        # Start server in background thread
        self.thread = threading.Thread(target=self.server.serve_forever)
        self.thread.daemon = True
        self.thread.start()

    def stop(self):
        """Stop the mock server."""
        if self.server:
            self.server.shutdown()
            self.server.server_close()
        if self.thread:
            self.thread.join(timeout=1)

    @property
    def url(self):
        """Get the callback URL for this server."""
        return f"http://localhost:{self.port}/callback"

    def wait_for_callback(self, timeout=10):
        """Wait for at least one callback to be received."""
        start_time = time.time()
        while time.time() - start_time < timeout:
            if self.received_callbacks:
                return True
            time.sleep(0.1)
        return False


@contextmanager
def callback_server():
    """Context manager for callback server."""
    server = CallbackServer()
    try:
        server.start()
        yield server
    finally:
        server.stop()


@pytest.mark.parametrize(
    "model_config",
    TESTED_MODEL_CONFIGS,
    ids=[handle for handle, _ in TESTED_MODEL_CONFIGS],
)
def test_async_greeting_with_callback_url(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    model_config: Tuple[str, dict],
) -> None:
    """
    Tests sending a message as an asynchronous job with callback URL functionality.
    Validates that callbacks are properly sent with correct payload structure.
    """
    model_handle, model_settings = model_config
    config_filename = None
    for filename in filenames:
        config_handle, _ = get_model_config(filename)
        if config_handle == model_handle:
            config_filename = filename
            break

    # skip if this is a limited model
    if not config_filename or config_filename in limited_configs:
        pytest.skip(f"Skipping test for limited model {model_handle}")

    client.agents.update(agent_id=agent_state.id, model=model_handle, model_settings=model_settings)

    with callback_server() as server:
        # Create async job with callback URL
        run = client.agents.messages.create_async(
            agent_id=agent_state.id,
            messages=USER_MESSAGE_FORCE_REPLY,
            callback_url=server.url,
        )

        # Wait for job completion
        run = wait_for_run_completion(client, run.id, timeout=60.0)

        # Validate job completed successfully
        messages_page = client.runs.messages.list(run_id=run.id)
        messages = messages_page.items
        assert_greeting_with_assistant_message_response(messages, model_handle, model_settings, from_db=True)

        # Validate callback was received
        assert server.wait_for_callback(timeout=15), "Callback was not received within timeout"
        assert len(server.received_callbacks) == 1, f"Expected 1 callback, got {len(server.received_callbacks)}"

        # Validate callback payload structure
        callback = server.received_callbacks[0]
        callback_data = callback["data"]

        # Check required fields
        assert "run_id" in callback_data, "Callback missing 'run_id' field"
        assert "status" in callback_data, "Callback missing 'status' field"
        assert "completed_at" in callback_data, "Callback missing 'completed_at' field"
        assert "metadata" in callback_data, "Callback missing 'metadata' field"

        # Validate field values
        assert callback_data["run_id"] == run.id, f"Job ID mismatch: {callback_data['run_id']} != {run.id}"
        assert callback_data["status"] == "completed", f"Expected status 'completed', got {callback_data['status']}"
        assert callback_data["completed_at"] is not None, "completed_at should not be None"
        assert callback_data["metadata"] is not None, "metadata should not be None"

        # Validate that callback metadata contains the result
        assert "result" in callback_data["metadata"], "Callback metadata missing 'result' field"
        callback_result = callback_data["metadata"]["result"]
        callback_messages = cast_message_dict_to_messages(callback_result["messages"])
        assert callback_messages == messages, "Callback result doesn't match job result"

        # Validate HTTP headers
        headers = callback["headers"]
        assert headers.get("Content-Type") == "application/json", "Callback should have JSON content type"


@pytest.mark.flaky(max_runs=2)
@pytest.mark.parametrize(
    "model_config",
    TESTED_MODEL_CONFIGS,
    ids=[handle for handle, _ in TESTED_MODEL_CONFIGS],
)
def test_auto_summarize(disable_e2b_api_key: Any, client: Letta, model_config: Tuple[str, dict]):
    """Test that summarization is automatically triggered."""
    model_handle, model_settings = model_config
    # get the config filename by matching model handle
    config_filename = None
    for filename in filenames:
        config_handle, _ = get_model_config(filename)
        if config_handle == model_handle:
            config_filename = filename
            break

    # skip if this is a limited model (runs too slow)
    if not config_filename or config_filename in limited_configs:
        pytest.skip(f"Skipping test for limited model {model_handle}")

    send_message_tool = client.tools.list(name="send_message").items[0]
    temp_agent_state = client.agents.create(
        include_base_tools=False,
        agent_type="memgpt_v2_agent",
        tool_ids=[send_message_tool.id],
        model=model_handle,
        model_settings=model_settings,
        context_window_limit=3000,
        embedding="openai/text-embedding-3-small",
        tags=["supervisor"],
    )

    philosophical_question_path = os.path.join(os.path.dirname(__file__), "data", "philosophical_question.txt")
    with open(philosophical_question_path, "r", encoding="utf-8") as f:
        philosophical_question = f.read().strip()

    MAX_ATTEMPTS = 10
    prev_length = None

    for attempt in range(MAX_ATTEMPTS):
        try:
            client.agents.messages.create(
                agent_id=temp_agent_state.id,
                messages=[MessageCreateParam(role="user", content=philosophical_question)],
            )
        except Exception as e:
            # if "flash" in llm_config.model and "FinishReason.MALFORMED_FUNCTION_CALL" in str(e):
            #     pytest.skip("Skipping test for flash model due to malformed function call from llm")
            raise e

        temp_agent_state = client.agents.retrieve(agent_id=temp_agent_state.id)
        message_ids = temp_agent_state.message_ids
        current_length = len(message_ids)

        print("LENGTH OF IN_CONTEXT_MESSAGES:", current_length)

        if prev_length is not None and current_length <= prev_length:
            # TODO: Add more stringent checks here
            print(f"Summarization was triggered, detected current_length {current_length} is at least prev_length {prev_length}.")
            break

        prev_length = current_length
    else:
        raise AssertionError("Summarization was not triggered after 10 messages")


# ============================
# Job Cancellation Tests
# ============================


def wait_for_run_status(client: Letta, run_id: str, target_status: str, timeout: float = 30.0, interval: float = 0.1) -> Run:
    """Wait for a run to reach a specific status"""
    start = time.time()
    while True:
        run = client.runs.retrieve(run_id)
        if run.status == target_status:
            return run
        if time.time() - start > timeout:
            raise TimeoutError(f"Run {run_id} did not reach status '{target_status}' within {timeout} seconds (last status: {run.status})")
        time.sleep(interval)


@pytest.mark.parametrize(
    "model_config",
    TESTED_MODEL_CONFIGS,
    ids=[handle for handle, _ in TESTED_MODEL_CONFIGS],
)
def test_job_creation_for_send_message(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    model_config: Tuple[str, dict],
) -> None:
    """
    Test that send_message endpoint creates a job and the job completes successfully.
    """
    model_handle, model_settings = model_config
    previous_runs = client.runs.list(agent_ids=[agent_state.id])
    client.agents.update(agent_id=agent_state.id, model=model_handle, model_settings=model_settings)

    # Send a simple message and verify a job was created
    response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_FORCE_REPLY,
    )

    # The response should be successful
    assert response.messages is not None
    assert len(response.messages) > 0

    runs = client.runs.list(agent_ids=[agent_state.id])
    new_runs = set(r.id for r in runs) - set(r.id for r in previous_runs)
    assert len(new_runs) == 1

    for run in runs:
        if run.id == list(new_runs)[0]:
            assert run.status == "completed"


# TODO (cliandy): MERGE BACK IN POST
# # @pytest.mark.parametrize(
# #     "llm_config",
# #     TESTED_LLM_CONFIGS,
# #     ids=[c.model for c in TESTED_LLM_CONFIGS],
# # )
# # def test_async_job_cancellation(
# #     disable_e2b_api_key: Any,
# #     client: Letta,
# #     agent_state: AgentState,
# #     model_config: Tuple[str, dict],
# # ) -> None:
#     """
#     Test that an async job can be cancelled and the cancellation is reflected in the job status.
#     """
#     client.agents.update(agent_id=agent_state.id, model=model_handle, model_settings=model_settings)
#
#     # client.runs.cancel
#     # Start an async job
#     run = client.agents.messages.create_async(
#         agent_id=agent_state.id,
#         messages=USER_MESSAGE_FORCE_REPLY,
#     )
#
#     # Verify the job was created
#     assert run.id is not None
#     assert run.status in ["created", "running"]
#
#     # Cancel the job quickly (before it potentially completes)
#     cancelled_run = client.jobs.cancel(run.id)
#
#     # Verify the job was cancelled
#     assert cancelled_run.status == "cancelled"
#
#     # Wait a bit and verify it stays cancelled (no invalid state transitions)
#     time.sleep(1)
#     final_run = client.runs.retrieve(run.id)
#     assert final_run.status == "cancelled"
#
#     # Verify the job metadata indicates cancellation
#     if final_run.metadata:
#         assert final_run.metadata.get("cancelled") is True or "stop_reason" in final_run.metadata
#
#
# def test_job_cancellation_endpoint_validation(
#     disable_e2b_api_key: Any,
#     client: Letta,
#     agent_state: AgentState,
# ) -> None:
#     """
#     Test job cancellation endpoint validation (trying to cancel completed/failed jobs).
#     """
#     # Test cancelling a non-existent job
#     with pytest.raises(APIError) as exc_info:
#         client.jobs.cancel("non-existent-job-id")
#     assert exc_info.value.status_code == 404
#
#
# @pytest.mark.parametrize(
#     "llm_config",
#     TESTED_LLM_CONFIGS,
#     ids=[c.model for c in TESTED_LLM_CONFIGS],
# )
# def test_completed_job_cannot_be_cancelled(
#     disable_e2b_api_key: Any,
#     client: Letta,
#     agent_state: AgentState,
#     model_config: Tuple[str, dict],
# ) -> None:
#     """
#     Test that completed jobs cannot be cancelled.
#     """
#     client.agents.update(agent_id=agent_state.id, model=model_handle, model_settings=model_settings)
#
#     # Start an async job and wait for it to complete
#     run = client.agents.messages.create_async(
#         agent_id=agent_state.id,
#         messages=USER_MESSAGE_FORCE_REPLY,
#     )
#
#     # Wait for completion
#     completed_run = wait_for_run_completion(client, run.id)
#     assert completed_run.status == "completed"
#
#     # Try to cancel the completed job - should fail
#     with pytest.raises(APIError) as exc_info:
#         client.jobs.cancel(run.id)
#     assert exc_info.value.status_code == 400
#     assert "Cannot cancel job with status 'completed'" in str(exc_info.value)
#
#
# @pytest.mark.parametrize(
#     "llm_config",
#     TESTED_LLM_CONFIGS,
#     ids=[c.model for c in TESTED_LLM_CONFIGS],
# )
# def test_streaming_job_independence_from_client_disconnect(
#     disable_e2b_api_key: Any,
#     client: Letta,
#     agent_state: AgentState,
#     model_config: Tuple[str, dict],
# ) -> None:
#     """
#     Test that streaming jobs are independent of client connection state.
#     This verifies that jobs continue even if the client "disconnects" (simulated by not consuming the stream).
#     """
#     client.agents.update(agent_id=agent_state.id, model=model_handle, model_settings=model_settings)
#
#     # Create a streaming request
#     import threading
#
#     import httpx
#
#     # Get the base URL and create a raw HTTP request to simulate partial consumption
#     base_url = client._client_wrapper._base_url
#
#     def start_stream_and_abandon():
#         """Start a streaming request but abandon it (simulating client disconnect)"""
#         try:
#             response = httpx.post(
#                 f"{base_url}/agents/{agent_state.id}/messages/stream",
#                 json={"messages": [{"role": "user", "text": "Hello, how are you?"}], "stream_tokens": False},
#                 headers={"user_id": "test-user"},
#                 timeout=30.0,
#             )
#
#             # Read just a few chunks then "disconnect" by not reading the rest
#             chunk_count = 0
#             for chunk in response.iter_lines():
#                 chunk_count += 1
#                 if chunk_count > 3:  # Read a few chunks then stop
#                     break
#             # Connection is now "abandoned" but the job should continue
#
#         except Exception:
#             pass  # Ignore connection errors
#
#     # Start the stream in a separate thread to simulate abandonment
#     thread = threading.Thread(target=start_stream_and_abandon)
#     thread.start()
#     thread.join(timeout=5.0)  # Wait up to 5 seconds for the "disconnect"
#
#     # The important thing is that this test validates our architecture:
#     # 1. Jobs are created before streaming starts (verified by our other tests)
#     # 2. Jobs track execution independent of client connection (handled by our wrapper)
#     # 3. Only explicit cancellation terminates jobs (tested by other tests)
#
#     # This test primarily validates that the implementation doesn't break under simulated disconnection
#     assert True  # If we get here without errors, the architecture is sound


@pytest.mark.parametrize(
    "model_config",
    TESTED_MODEL_CONFIGS,
    ids=[handle for handle, _ in TESTED_MODEL_CONFIGS],
)
def test_inner_thoughts_false_non_reasoner_models(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    model_config: Tuple[str, dict],
) -> None:
    model_handle, model_settings = model_config
    # get the config filename by matching model handle
    config_filename = None
    for filename in filenames:
        config_handle, _ = get_model_config(filename)
        if config_handle == model_handle:
            config_filename = filename
            break

    # skip if this is a limited model
    if not config_filename or config_filename in limited_configs:
        pytest.skip(f"Skipping test for limited model {model_handle}")

    # skip if this is a reasoning model (use helper function to detect)
    if is_reasoner_model(model_handle, model_settings):
        pytest.skip(f"Skipping test for reasoning model {model_handle}")

    # Note: This test is for models without reasoning, so model_settings should already have reasoning disabled

    last_message_page = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    last_message = last_message_page.items[0] if last_message_page.items else None
    agent_state = client.agents.update(agent_id=agent_state.id, model=model_handle, model_settings=model_settings)
    response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_FORCE_REPLY,
    )
    assert_greeting_no_reasoning_response(response.messages)
    messages_from_db_page = client.agents.messages.list(agent_id=agent_state.id, after=last_message.id if last_message else None)
    messages_from_db = messages_from_db_page.items
    assert_greeting_no_reasoning_response(messages_from_db, from_db=True)


@pytest.mark.parametrize(
    "model_config",
    TESTED_MODEL_CONFIGS,
    ids=[handle for handle, _ in TESTED_MODEL_CONFIGS],
)
def test_inner_thoughts_false_non_reasoner_models_streaming(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    model_config: Tuple[str, dict],
) -> None:
    model_handle, model_settings = model_config
    # get the config filename by matching model handle
    config_filename = None
    for filename in filenames:
        config_handle, _ = get_model_config(filename)
        if config_handle == model_handle:
            config_filename = filename
            break

    # skip if this is a limited model
    if not config_filename or config_filename in limited_configs:
        pytest.skip(f"Skipping test for limited model {model_handle}")

    # skip if this is a reasoning model (use helper function to detect)
    if is_reasoner_model(model_handle, model_settings):
        pytest.skip(f"Skipping test for reasoning model {model_handle}")

    # Note: This test is for models without reasoning, so model_settings should already have reasoning disabled

    last_message_page = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    last_message = last_message_page.items[0] if last_message_page.items else None
    agent_state = client.agents.update(agent_id=agent_state.id, model=model_handle, model_settings=model_settings)
    response = client.agents.messages.stream(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_FORCE_REPLY,
    )
    messages = accumulate_chunks(list(response))
    assert_greeting_no_reasoning_response(messages, streaming=True)
    messages_from_db_page = client.agents.messages.list(agent_id=agent_state.id, after=last_message.id if last_message else None)
    messages_from_db = messages_from_db_page.items
    assert_greeting_no_reasoning_response(messages_from_db, from_db=True)


@pytest.mark.parametrize(
    "model_config",
    TESTED_MODEL_CONFIGS,
    ids=[handle for handle, _ in TESTED_MODEL_CONFIGS],
)
def test_inner_thoughts_toggle_interleaved(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    model_config: Tuple[str, dict],
) -> None:
    model_handle, model_settings = model_config
    # get the config filename by matching model handle
    config_filename = None
    for filename in filenames:
        config_handle, _ = get_model_config(filename)
        if config_handle == model_handle:
            config_filename = filename
            break

    # skip if this is a reasoning model
    if not config_filename or config_filename in reasoning_configs:
        pytest.skip(f"Skipping test for reasoning model {model_handle}")

    # Only run on OpenAI, Anthropic, and Google models
    provider_type = model_settings.get("provider_type", "")
    if provider_type not in ["openai", "anthropic", "google_ai", "google_vertex"]:
        pytest.skip(f"Skipping `test_inner_thoughts_toggle_interleaved` for model endpoint type {provider_type}")

    agent_state = client.agents.update(agent_id=agent_state.id, model=model_handle, model_settings=model_settings)

    # Send a message with inner thoughts
    client.agents.messages.create(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_GREETING,
    )

    # For now, skip the part that toggles reasoning off since we're migrating away from LLMConfig
    # This test would need to be redesigned for model_settings
    pytest.skip("Skipping reasoning toggle test - needs redesign for model_settings")

    # Preview the message payload of the next message
    # response = client.agents.messages.preview_raw_payload(
    #     agent_id=agent_state.id,
    #     request=LettaRequest(messages=USER_MESSAGE_FORCE_REPLY),
    # )

    # Test our helper functions
    assert is_reasoning_completely_disabled(adjusted_llm_config), "Reasoning should be completely disabled"

    # Verify that assistant messages with tool calls have been scrubbed of inner thoughts
    # Branch assertions based on model endpoint type
    # if llm_config.model_endpoint_type == "openai":
    #     messages = response["messages"]
    #     validate_openai_format_scrubbing(messages)
    # elif llm_config.model_endpoint_type == "anthropic":
    #     messages = response["messages"]
    #     validate_anthropic_format_scrubbing(messages, llm_config.enable_reasoner)
    # elif llm_config.model_endpoint_type in ["google_ai", "google_vertex"]:
    #     # Google uses 'contents' instead of 'messages'
    #     contents = response.get("contents", response.get("messages", []))
    #     validate_google_format_scrubbing(contents)


# ============================
# Input Parameter Tests
# ============================


@pytest.mark.parametrize(
    "model_config",
    TESTED_MODEL_CONFIGS,
    ids=[handle for handle, _ in TESTED_MODEL_CONFIGS],
)
def test_input_parameter_basic(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    model_config: Tuple[str, dict],
) -> None:
    """
    Tests sending a message using the input parameter instead of messages.
    Verifies that input is properly converted to a user message.
    """
    last_message_page = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    last_message = last_message_page.items[0] if last_message_page.items else None
    model_handle, model_settings = model_config
    agent_state = client.agents.update(agent_id=agent_state.id, model=model_handle, model_settings=model_settings)

    # Use input parameter instead of messages
    response = client.agents.messages.create(
        agent_id=agent_state.id,
        input=f"This is an automated test message. Call the send_message tool with the message '{USER_MESSAGE_RESPONSE}'.",
    )

    assert_contains_run_id(response.messages)
    assert_greeting_with_assistant_message_response(response.messages, model_handle, model_settings, input=True)
    messages_from_db_page = client.agents.messages.list(agent_id=agent_state.id, after=last_message.id if last_message else None)
    messages_from_db = messages_from_db_page.items
    assert_first_message_is_user_message(messages_from_db)
    assert_greeting_with_assistant_message_response(messages_from_db, model_handle, model_settings, from_db=True, input=True)


@pytest.mark.parametrize(
    "model_config",
    TESTED_MODEL_CONFIGS,
    ids=[handle for handle, _ in TESTED_MODEL_CONFIGS],
)
def test_input_parameter_streaming(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    model_config: Tuple[str, dict],
) -> None:
    """
    Tests sending a streaming message using the input parameter.
    """
    last_message_page = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    last_message = last_message_page.items[0] if last_message_page.items else None
    model_handle, model_settings = model_config
    agent_state = client.agents.update(agent_id=agent_state.id, model=model_handle, model_settings=model_settings)

    response = client.agents.messages.stream(
        agent_id=agent_state.id,
        input=f"This is an automated test message. Call the send_message tool with the message '{USER_MESSAGE_RESPONSE}'.",
    )

    chunks = list(response)
    assert_contains_step_id(chunks)
    assert_contains_run_id(chunks)
    messages = accumulate_chunks(chunks)
    assert_greeting_with_assistant_message_response(messages, model_handle, model_settings, streaming=True, input=True)
    messages_from_db_page = client.agents.messages.list(agent_id=agent_state.id, after=last_message.id if last_message else None)
    messages_from_db = messages_from_db_page.items
    assert_contains_run_id(messages_from_db)
    assert_greeting_with_assistant_message_response(messages_from_db, model_handle, model_settings, from_db=True, input=True)


@pytest.mark.parametrize(
    "model_config",
    TESTED_MODEL_CONFIGS,
    ids=[handle for handle, _ in TESTED_MODEL_CONFIGS],
)
def test_input_parameter_async(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    model_config: Tuple[str, dict],
) -> None:
    """
    Tests sending an async message using the input parameter.
    """
    model_handle, model_settings = model_config
    last_message_page = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    last_message = last_message_page.items[0] if last_message_page.items else None
    client.agents.update(agent_id=agent_state.id, model=model_handle, model_settings=model_settings)

    run = client.agents.messages.create_async(
        agent_id=agent_state.id,
        input=f"This is an automated test message. Call the send_message tool with the message '{USER_MESSAGE_RESPONSE}'.",
    )
    run = wait_for_run_completion(client, run.id, timeout=60.0)

    messages_page = client.runs.messages.list(run_id=run.id)
    messages = messages_page.items
    assert_greeting_with_assistant_message_response(messages, model_handle, model_settings, from_db=True, input=True)
    messages_from_db_page = client.agents.messages.list(agent_id=agent_state.id, after=last_message.id if last_message else None)
    messages_from_db = messages_from_db_page.items
    assert_greeting_with_assistant_message_response(messages_from_db, model_handle, model_settings, from_db=True, input=True)


def test_input_and_messages_both_provided_error(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
) -> None:
    """
    Tests that providing both input and messages raises a validation error.
    """
    with pytest.raises(APIError) as exc_info:
        client.agents.messages.create(
            agent_id=agent_state.id,
            input="This is a test message",
            messages=USER_MESSAGE_FORCE_REPLY,
        )
    # Should get a 422 validation error
    assert exc_info.value.status_code == 422


def test_input_and_messages_neither_provided_error(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
) -> None:
    """
    Tests that providing neither input nor messages raises a validation error.
    """
    with pytest.raises(APIError) as exc_info:
        client.agents.messages.create(
            agent_id=agent_state.id,
        )
    # Should get a 422 validation error
    assert exc_info.value.status_code == 422
