import base64
import mimetypes

import httpx

from letta import system
from letta.schemas.enums import MessageRole
from letta.schemas.letta_message_content import Base64Image, ImageContent, ImageSourceType, TextContent
from letta.schemas.message import Message, MessageCreate


def convert_message_creates_to_messages(
    message_creates: list[MessageCreate],
    agent_id: str,
    wrap_user_message: bool = True,
    wrap_system_message: bool = True,
) -> list[Message]:
    return [
        _convert_message_create_to_message(
            message_create=create,
            agent_id=agent_id,
            wrap_user_message=wrap_user_message,
            wrap_system_message=wrap_system_message,
        )
        for create in message_creates
    ]


def _convert_message_create_to_message(
    message_create: MessageCreate,
    agent_id: str,
    wrap_user_message: bool = True,
    wrap_system_message: bool = True,
) -> Message:
    """Converts a MessageCreate object into a Message object, applying wrapping if needed."""
    # TODO: This seems like extra boilerplate with little benefit
    assert isinstance(message_create, MessageCreate)

    # Extract message content
    if isinstance(message_create.content, str):
        assert message_create.content != "", "Message content must not be empty"
        message_content = [TextContent(text=message_create.content)]
    elif isinstance(message_create.content, list) and len(message_create.content) > 0:
        message_content = message_create.content
    else:
        raise ValueError("Message content is empty or invalid")

    assert message_create.role in {MessageRole.user, MessageRole.system}, f"Invalid message role: {message_create.role}"
    for content in message_content:
        if isinstance(content, TextContent):
            # Apply wrapping if needed
            if message_create.role == MessageRole.user and wrap_user_message:
                content.text = system.package_user_message(user_message=content.text)
            elif message_create.role == MessageRole.system and wrap_system_message:
                content.text = system.package_system_message(system_message=content.text)
        elif isinstance(content, ImageContent):
            if content.source.type == ImageSourceType.url:
                # Convert URL image to Base64Image if needed
                image_response = httpx.get(content.source.url)
                image_response.raise_for_status()
                image_media_type = image_response.headers.get("content-type")
                if not image_media_type:
                    image_media_type, _ = mimetypes.guess_type(content.source.url)
                image_data = base64.standard_b64encode(image_response.content).decode("utf-8")
                content.source = Base64Image(media_type=image_media_type, data=image_data)
            if content.source.type == ImageSourceType.letta and not content.source.data:
                # TODO: hydrate letta image with data from db
                pass

    return Message(
        agent_id=agent_id,
        role=message_create.role,
        content=message_content,
        name=message_create.name,
        model=None,  # assigned later?
        tool_calls=None,  # irrelevant
        tool_call_id=None,
        otid=message_create.otid,
        sender_id=message_create.sender_id,
        group_id=message_create.group_id,
        batch_item_id=message_create.batch_item_id,
    )
