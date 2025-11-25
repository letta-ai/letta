import asyncio
import base64
import mimetypes
from urllib.parse import unquote, urlparse

import httpx

from letta import __version__, system
from letta.errors import LettaImageFetchError
from letta.schemas.enums import MessageRole
from letta.schemas.letta_message_content import Base64Image, ImageContent, ImageSourceType, TextContent
from letta.schemas.message import Message, MessageCreate


async def _fetch_image_from_url(url: str) -> tuple[bytes, str | None]:
    """
    Async helper to fetch image from URL without blocking the event loop.
    """
    timeout = httpx.Timeout(15.0, connect=5.0)
    headers = {"User-Agent": f"Letta/{__version__}"}
    try:
        async with httpx.AsyncClient(timeout=timeout, headers=headers) as client:
            image_response = await client.get(url, follow_redirects=True)
            image_response.raise_for_status()
            image_bytes = image_response.content
            image_media_type = image_response.headers.get("content-type")
            return image_bytes, image_media_type
    except (httpx.RemoteProtocolError, httpx.TimeoutException, httpx.HTTPStatusError) as e:
        raise LettaImageFetchError(url=url, reason=str(e))
    except Exception as e:
        raise LettaImageFetchError(url=url, reason=f"Unexpected error: {e}")


async def convert_message_creates_to_messages(
    message_creates: list[MessageCreate],
    agent_id: str,
    timezone: str,
    run_id: str,
    wrap_user_message: bool = True,
    wrap_system_message: bool = True,
) -> list[Message]:
    # Process all messages concurrently
    tasks = [
        _convert_message_create_to_message(
            message_create=create,
            agent_id=agent_id,
            timezone=timezone,
            run_id=run_id,
            wrap_user_message=wrap_user_message,
            wrap_system_message=wrap_system_message,
        )
        for create in message_creates
    ]
    return await asyncio.gather(*tasks)


async def _convert_message_create_to_message(
    message_create: MessageCreate,
    agent_id: str,
    timezone: str,
    run_id: str,
    wrap_user_message: bool = True,
    wrap_system_message: bool = True,
) -> Message:
    """Converts a MessageCreate object into a Message object, applying wrapping if needed."""
    # TODO: This seems like extra boilerplate with little benefit
    assert isinstance(message_create, MessageCreate)

    # Extract message content
    if isinstance(message_create.content, str) and message_create.content != "":
        message_content = [TextContent(text=message_create.content)]
    elif isinstance(message_create.content, list) and len(message_create.content) > 0:
        message_content = message_create.content
    else:
        raise ValueError("Message content is empty or invalid")

    # Validate message role (assistant messages are allowed but won't be wrapped)
    assert message_create.role in {
        MessageRole.user,
        MessageRole.system,
        MessageRole.assistant,
    }, f"Invalid message role: {message_create.role}"

    for content in message_content:
        if isinstance(content, TextContent):
            # Apply wrapping only to user and system messages
            if message_create.role == MessageRole.user and wrap_user_message:
                content.text = system.package_user_message(user_message=content.text, timezone=timezone)
            elif message_create.role == MessageRole.system and wrap_system_message:
                content.text = system.package_system_message(system_message=content.text, timezone=timezone)
        elif isinstance(content, ImageContent):
            if content.source.type == ImageSourceType.url:
                # Convert URL image to Base64Image if needed
                url = content.source.url

                # Handle file:// URLs for local filesystem access
                if url.startswith("file://"):
                    # Parse file path from file:// URL
                    parsed = urlparse(url)
                    file_path = unquote(parsed.path)

                    # Read file directly from filesystem (wrapped to avoid blocking event loop)
                    def _read_file():
                        with open(file_path, "rb") as f:
                            return f.read()

                    image_bytes = await asyncio.to_thread(_read_file)

                    # Guess media type from file extension
                    image_media_type, _ = mimetypes.guess_type(file_path)
                    if not image_media_type:
                        image_media_type = "image/jpeg"  # default fallback
                else:
                    # Handle http(s):// URLs using async httpx
                    image_bytes, image_media_type = await _fetch_image_from_url(url)
                    if not image_media_type:
                        image_media_type, _ = mimetypes.guess_type(url)

                # Convert to base64 (common path for both file:// and http(s)://)
                image_data = base64.standard_b64encode(image_bytes).decode("utf-8")
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
        run_id=run_id,
    )
