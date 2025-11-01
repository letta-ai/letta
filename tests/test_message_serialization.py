from letta.schemas.enums import MessageRole
from letta.schemas.letta_message_content import TextContent
from letta.schemas.message import Message, ToolReturn


def test_openai_responses_use_tool_returns_when_content_empty():
    tool_return = ToolReturn(tool_call_id="call_abc123", status="success", func_response="tool payload")
    message = Message(
        role=MessageRole.tool,
        content=[],
        agent_id="agent-1",
        model="gpt-5",
        tool_call_id="call_abc123",
        tool_returns=[tool_return],
    )

    serialized = Message.to_openai_responses_dicts_from_list([message])

    assert serialized == [
        {
            "type": "function_call_output",
            "call_id": "call_abc123",
            "output": "tool payload",
        }
    ]


def test_openai_responses_fallbacks_to_content_when_no_tool_returns():
    message = Message(
        role=MessageRole.tool,
        content=[TextContent(text="legacy payload")],
        agent_id="agent-legacy",
        model="gpt-5",
        tool_call_id="call_legacy",
    )

    serialized = Message.to_openai_responses_dicts_from_list([message])

    assert serialized == [
        {
            "type": "function_call_output",
            "call_id": "call_legacy",
            "output": "legacy payload",
        }
    ]
