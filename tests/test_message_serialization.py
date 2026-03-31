from openai.types.chat.chat_completion_message_tool_call import ChatCompletionMessageToolCall, Function

from letta.llm_api.openai_client import fill_image_content_in_responses_input
from letta.schemas.enums import MessageRole
from letta.schemas.letta_message_content import Base64Image, ImageContent, TextContent
from letta.schemas.message import Message


def _user_message_with_image_first(text: str) -> Message:
    image = ImageContent(source=Base64Image(media_type="image/png", data="dGVzdA=="))
    return Message(role=MessageRole.user, content=[image, TextContent(text=text)])


def test_to_openai_responses_dicts_handles_image_first_content():
    message = _user_message_with_image_first("hello world")
    serialized = Message.to_openai_responses_dicts_from_list([message])
    parts = serialized[0]["content"]
    assert any(part["type"] == "input_text" and part["text"] == "hello world" for part in parts)
    assert any(part["type"] == "input_image" for part in parts)


def test_fill_image_content_in_responses_input_includes_image_parts():
    message = _user_message_with_image_first("describe image")
    serialized = Message.to_openai_responses_dicts_from_list([message])
    rewritten = fill_image_content_in_responses_input(serialized, [message])
    assert rewritten == serialized


def test_to_openai_responses_dicts_handles_image_only_content():
    image = ImageContent(source=Base64Image(media_type="image/png", data="dGVzdA=="))
    message = Message(role=MessageRole.user, content=[image])
    serialized = Message.to_openai_responses_dicts_from_list([message])
    parts = serialized[0]["content"]
    assert parts[0]["type"] == "input_image"


def test_to_anthropic_dict_falls_back_for_malformed_tool_call_arguments():
    malformed_args = '{"message": "unterminated}'
    msg = Message(
        role=MessageRole.assistant,
        content=[TextContent(text="thinking")],
        tool_calls=[
            ChatCompletionMessageToolCall(
                id="call_test_malformed",
                type="function",
                function=Function(name="send_message", arguments=malformed_args),
            )
        ],
    )

    serialized = msg.to_anthropic_dict(
        current_model="anthropic/claude-sonnet-4-5-20250929",
        inner_thoughts_xml_tag="thinking",
        put_inner_thoughts_in_kwargs=False,
    )

    tool_use_items = [item for item in serialized["content"] if item.get("type") == "tool_use"]
    assert len(tool_use_items) == 1
    assert tool_use_items[0]["input"] == {"_malformed_tool_arguments": malformed_args}


def test_to_google_dict_falls_back_for_malformed_tool_call_arguments():
    malformed_args = '{"message": "unterminated}'
    msg = Message(
        role=MessageRole.assistant,
        content=[],
        tool_calls=[
            ChatCompletionMessageToolCall(
                id="call_test_malformed_google",
                type="function",
                function=Function(name="send_message", arguments=malformed_args),
            )
        ],
    )

    serialized = msg.to_google_dict(
        current_model="google/gemini-2.5-pro",
    )

    function_calls = [item for item in serialized["parts"] if item.get("functionCall")]
    assert len(function_calls) == 1
    assert function_calls[0]["functionCall"]["args"] == {"_malformed_tool_arguments": malformed_args}


def test_to_google_dict_preserves_thought_signature_on_empty_content():
    """When Gemini returns a function call without reasoning text, the
    thought_signature must still appear on the serialized functionCall part.
    Regression test for LET-8166 / GitHub #3221."""
    sig = "EoQHsomebase64signaturedata=="
    msg = Message(
        role=MessageRole.assistant,
        content=[TextContent(text="", signature=sig)],
        tool_calls=[
            ChatCompletionMessageToolCall(
                id="call_test_thought_sig",
                type="function",
                function=Function(name="archival_memory_search", arguments='{"query": "test"}'),
            )
        ],
    )

    serialized = msg.to_google_dict(current_model="google/gemini-3-flash")

    function_calls = [p for p in serialized["parts"] if "functionCall" in p]
    assert len(function_calls) == 1
    assert function_calls[0].get("thought_signature") == sig


def test_to_google_dict_no_signature_when_absent():
    """Without a signature, functionCall parts should not include
    thought_signature (no sentinel, no empty string)."""
    msg = Message(
        role=MessageRole.assistant,
        content=[],
        tool_calls=[
            ChatCompletionMessageToolCall(
                id="call_test_no_sig",
                type="function",
                function=Function(name="send_message", arguments='{"message": "hi"}'),
            )
        ],
    )

    serialized = msg.to_google_dict(current_model="google/gemini-3-flash")

    function_calls = [p for p in serialized["parts"] if "functionCall" in p]
    assert len(function_calls) == 1
    assert "thought_signature" not in function_calls[0]
