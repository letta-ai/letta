from openai.types.chat.chat_completion_message_tool_call import ChatCompletionMessageToolCall as OpenAIToolCall, Function as OpenAIFunction

from letta.llm_api.openai_client import fill_image_content_in_responses_input
from letta.schemas.enums import MessageRole
from letta.schemas.letta_message import ApprovalReturn
from letta.schemas.letta_message_content import Base64Image, ImageContent, TextContent
from letta.schemas.message import Message, ToolReturn


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


def _create_tool_call(tool_call_id: str, name: str, arguments: str = "{}") -> OpenAIToolCall:
    """Helper to create an OpenAI-style tool call."""
    return OpenAIToolCall(
        id=tool_call_id,
        type="function",
        function=OpenAIFunction(name=name, arguments=arguments),
    )


def test_filter_orphaned_approval_request_at_end():
    """
    Test that a lone approval_request at the end of messages is filtered out.
    This is the original behavior that should still work.
    """
    system_msg = Message(role=MessageRole.system, content=[TextContent(text="You are a helpful assistant.")])
    user_msg = Message(role=MessageRole.user, content=[TextContent(text="Do something")])
    # Approval request with tool_calls but no response
    approval_request = Message(
        role=MessageRole.approval,
        tool_calls=[_create_tool_call("tc_123", "some_tool")],
    )

    messages = [system_msg, user_msg, approval_request]
    filtered = Message.filter_messages_for_llm_api(messages)

    # The orphaned approval_request should be removed
    assert len(filtered) == 2
    assert filtered[0].role == MessageRole.system
    assert filtered[1].role == MessageRole.user


def test_filter_orphaned_approval_request_in_middle():
    """
    Test that an orphaned approval_request message in the MIDDLE of the message list
    is properly filtered before sending to LLM.

    This is the key scenario for the race condition bug:
    - approval_request gets persisted
    - User sends another message before responding to approval
    - Due to race conditions, the orphaned approval_request ends up in context without tool_return
    """
    system_msg = Message(role=MessageRole.system, content=[TextContent(text="You are a helpful assistant.")])
    user_msg1 = Message(role=MessageRole.user, content=[TextContent(text="Do something")])
    # Orphaned approval_request with tool_calls but no response
    orphaned_approval = Message(
        role=MessageRole.approval,
        tool_calls=[_create_tool_call("tc_orphan", "dangerous_tool")],
    )
    # User sends another message (race condition scenario)
    user_msg2 = Message(role=MessageRole.user, content=[TextContent(text="Actually do something else")])

    messages = [system_msg, user_msg1, orphaned_approval, user_msg2]
    filtered = Message.filter_messages_for_llm_api(messages)

    # The orphaned approval_request should be removed, but user messages stay
    assert len(filtered) == 3
    assert all(msg.role != MessageRole.approval for msg in filtered)
    # Verify the messages are in correct order
    assert filtered[0].role == MessageRole.system
    assert filtered[1].role == MessageRole.user
    assert filtered[2].role == MessageRole.user


def test_filter_preserves_approval_with_tool_return():
    """
    Test that approval_request messages WITH corresponding tool_return are NOT filtered.
    This is the normal happy path that should not be affected by the fix.
    """
    system_msg = Message(role=MessageRole.system, content=[TextContent(text="You are a helpful assistant.")])
    # Approval request
    approval_request = Message(
        role=MessageRole.approval,
        tool_calls=[_create_tool_call("tc_valid", "approved_tool")],
    )
    # Tool return with matching tool_call_id
    tool_return_msg = Message(
        role=MessageRole.tool,
        tool_returns=[ToolReturn(tool_call_id="tc_valid", status="success", func_response="done")],
    )

    messages = [system_msg, approval_request, tool_return_msg]
    filtered = Message.filter_messages_for_llm_api(messages)

    # All messages should be preserved
    assert len(filtered) == 3
    assert filtered[1].role == MessageRole.approval
    assert filtered[2].role == MessageRole.tool


def test_filter_orphaned_approval_removes_related_assistant_message():
    """
    Test that when an orphaned approval_request is removed, the preceding assistant
    message with overlapping tool_calls is also removed.

    In parallel tool calling scenarios, tool_calls might be split between
    assistant and approval messages - both need to be removed to avoid orphaned tool_use blocks.
    """
    system_msg = Message(role=MessageRole.system, content=[TextContent(text="You are a helpful assistant.")])
    # Assistant message with tool_calls
    assistant_msg = Message(
        role=MessageRole.assistant,
        tool_calls=[_create_tool_call("tc_shared", "some_tool")],
    )
    # Orphaned approval_request with same tool_call_id
    orphaned_approval = Message(
        role=MessageRole.approval,
        tool_calls=[_create_tool_call("tc_shared", "some_tool")],
    )
    user_msg = Message(role=MessageRole.user, content=[TextContent(text="Do something else")])

    messages = [system_msg, assistant_msg, orphaned_approval, user_msg]
    filtered = Message.filter_messages_for_llm_api(messages)

    # Both assistant and approval messages should be removed
    assert len(filtered) == 2
    assert filtered[0].role == MessageRole.system
    assert filtered[1].role == MessageRole.user


def test_no_orphaned_tool_use_blocks_after_filter():
    """
    Comprehensive test: After filtering, verify there are NO tool_use blocks
    without corresponding tool_result blocks.

    This is the ultimate test for the Anthropic API requirement:
    "tool_use ids were found without tool_result blocks immediately after"
    """
    system_msg = Message(role=MessageRole.system, content=[TextContent(text="You are a helpful assistant.")])
    user_msg = Message(role=MessageRole.user, content=[TextContent(text="Do something")])
    # Multiple orphaned approval_requests scattered in the list
    orphaned1 = Message(
        role=MessageRole.approval,
        tool_calls=[_create_tool_call("tc_orphan1", "tool1")],
    )
    orphaned2 = Message(
        role=MessageRole.approval,
        tool_calls=[_create_tool_call("tc_orphan2", "tool2"), _create_tool_call("tc_orphan3", "tool3")],
    )
    user_msg2 = Message(role=MessageRole.user, content=[TextContent(text="Another message")])

    messages = [system_msg, user_msg, orphaned1, orphaned2, user_msg2]
    filtered = Message.filter_messages_for_llm_api(messages)

    # Collect all tool_call_ids from messages with tool_calls
    tool_call_ids = set()
    for msg in filtered:
        if msg.tool_calls:
            for tc in msg.tool_calls:
                tool_call_ids.add(tc.id)

    # Collect all tool_return ids
    tool_return_ids = set()
    for msg in filtered:
        if msg.role == MessageRole.tool:
            if msg.tool_returns:
                for tr in msg.tool_returns:
                    if tr.tool_call_id:
                        tool_return_ids.add(tr.tool_call_id)
            elif msg.tool_call_id:
                tool_return_ids.add(msg.tool_call_id)

    # Every tool_call_id must have a corresponding tool_return
    orphaned_tool_calls = tool_call_ids - tool_return_ids
    assert len(orphaned_tool_calls) == 0, f"Found orphaned tool_use blocks without tool_result: {orphaned_tool_calls}"


def test_filter_approval_with_only_approval_return_is_still_orphaned():
    """
    Test that an approval_request followed by approval_response with only ApprovalReturn
    (approve/deny decision without tool_result) is STILL treated as orphaned.

    ApprovalReturn only contains approve=True/False, not the actual tool_result content.
    The LLM API requires tool_use blocks to have matching tool_result blocks.
    """
    system_msg = Message(role=MessageRole.system, content=[TextContent(text="You are a helpful assistant.")])
    # Approval request with tool_calls
    approval_request = Message(
        role=MessageRole.approval,
        tool_calls=[_create_tool_call("tc_approved", "some_tool")],
    )
    # Approval response with ApprovalReturn (approve=True but NO tool_result)
    approval_response = Message(
        role=MessageRole.approval,
        approve=None,  # New API pattern: approve=None with approvals list
        approvals=[ApprovalReturn(tool_call_id="tc_approved", approve=True)],
    )
    user_msg = Message(role=MessageRole.user, content=[TextContent(text="Continue")])

    messages = [system_msg, approval_request, approval_response, user_msg]
    filtered = Message.filter_messages_for_llm_api(messages)

    # The approval_request should be removed because ApprovalReturn doesn't have tool_result
    assert all(not (msg.role == MessageRole.approval and msg.tool_calls) for msg in filtered), (
        "Orphaned approval_request with only ApprovalReturn should be filtered"
    )


def test_filter_preserves_approval_with_tool_return_in_approvals():
    """
    Test that approval_request followed by approval_response containing ToolReturn
    (actual tool result) is NOT filtered - this is a valid completed flow.
    """
    system_msg = Message(role=MessageRole.system, content=[TextContent(text="You are a helpful assistant.")])
    # Approval request with tool_calls
    approval_request = Message(
        role=MessageRole.approval,
        tool_calls=[_create_tool_call("tc_with_result", "some_tool")],
    )
    # Approval response with ToolReturn (has actual func_response content)
    # Using the local ToolReturn from message.py (not LettaToolReturn from letta_message.py)
    approval_response = Message(
        role=MessageRole.approval,
        approve=None,
        approvals=[ToolReturn(tool_call_id="tc_with_result", status="success", func_response="result data")],
    )

    messages = [system_msg, approval_request, approval_response]
    filtered = Message.filter_messages_for_llm_api(messages)

    # All messages should be preserved - this is a valid flow
    assert len(filtered) == 3
    assert filtered[1].role == MessageRole.approval
    assert filtered[1].tool_calls is not None  # approval_request preserved


def test_filter_legacy_single_tool_call_id():
    """
    Test that the legacy single tool_call_id field on tool messages is correctly
    recognized as having a tool_return (not just tool_returns array).
    """
    system_msg = Message(role=MessageRole.system, content=[TextContent(text="You are a helpful assistant.")])
    # Approval request
    approval_request = Message(
        role=MessageRole.approval,
        tool_calls=[_create_tool_call("tc_legacy", "some_tool")],
    )
    # Tool message with legacy single tool_call_id (not tool_returns array)
    tool_msg = Message(
        role=MessageRole.tool,
        tool_call_id="tc_legacy",
        content=[TextContent(text="Tool result")],
    )

    messages = [system_msg, approval_request, tool_msg]
    filtered = Message.filter_messages_for_llm_api(messages)

    # All messages should be preserved
    assert len(filtered) == 3
    assert filtered[1].role == MessageRole.approval
    assert filtered[1].tool_calls is not None


def test_filter_tool_return_before_approval_request_still_orphaned():
    """
    Test that an approval_request is still filtered as orphaned even if a tool_return
    with matching ID exists BEFORE it in the message list.

    The LLM API requires tool_result to come AFTER tool_use. A tool_return before
    the approval_request doesn't satisfy this requirement.

    This catches the ordering bug where position-unaware lookups would incorrectly
    keep the approval_request because a matching tool_return "exists somewhere".
    """
    system_msg = Message(role=MessageRole.system, content=[TextContent(text="You are a helpful assistant.")])
    # Tool return BEFORE the approval_request (wrong order)
    tool_return_msg = Message(
        role=MessageRole.tool,
        tool_returns=[ToolReturn(tool_call_id="tc_wrong_order", status="success", func_response="done")],
    )
    # Approval request with same tool_call_id
    approval_request = Message(
        role=MessageRole.approval,
        tool_calls=[_create_tool_call("tc_wrong_order", "some_tool")],
    )
    user_msg = Message(role=MessageRole.user, content=[TextContent(text="Continue")])

    messages = [system_msg, tool_return_msg, approval_request, user_msg]
    filtered = Message.filter_messages_for_llm_api(messages)

    # The approval_request should be removed because tool_return is BEFORE it, not after
    assert all(not (msg.role == MessageRole.approval and msg.tool_calls) for msg in filtered), (
        "Approval_request with tool_return BEFORE it should still be filtered as orphaned"
    )
