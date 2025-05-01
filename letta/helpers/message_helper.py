from letta import system
from letta.schemas.enums import MessageRole
from letta.schemas.letta_message_content import TextContent
from letta.schemas.message import Message, MessageCreate


def convert_message_creates_to_messages(
    messages: list[MessageCreate],
    agent_id: str,
    wrap_user_message: bool = True,
    wrap_system_message: bool = True,
) -> list[Message]:
    return [
        _convert_message_create_to_message(
            message=message,
            agent_id=agent_id,
            wrap_user_message=wrap_user_message,
            wrap_system_message=wrap_system_message,
        )
        for message in messages
    ]


def _convert_message_create_to_message(
    message: MessageCreate,
    agent_id: str,
    wrap_user_message: bool = True,
    wrap_system_message: bool = True,
) -> Message:
    """Converts a MessageCreate object into a Message object, applying wrapping if needed."""
    # TODO: This seems like extra boilerplate with little benefit
    assert isinstance(message, MessageCreate)

    # Extract message content
    if isinstance(message.content, str):
        message_content = message.content
    elif message.content and len(message.content) > 0 and isinstance(message.content[0], TextContent):
        message_content = message.content[0].text
    else:
        raise ValueError("Message content is empty or invalid")

    # Apply wrapping if needed
    if message.role not in {MessageRole.user, MessageRole.system}:
        raise ValueError(f"Invalid message role: {message.role}")
    elif message.role == MessageRole.user and wrap_user_message:
        message_content = system.package_user_message(user_message=message_content)
    elif message.role == MessageRole.system and wrap_system_message:
        message_content = system.package_system_message(system_message=message_content)

    return Message(
        agent_id=agent_id,
        role=message.role,
        content=[TextContent(text=message_content)] if message_content else [],
        name=message.name,
        model=None,  # assigned later?
        tool_calls=None,  # irrelevant
        tool_call_id=None,
        otid=message.otid,
        sender_id=message.sender_id,
        group_id=message.group_id,
    )
