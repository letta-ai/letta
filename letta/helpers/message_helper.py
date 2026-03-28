import asyncio
import base64
import mimetypes
from urllib.parse import urlparse

import httpx

from letta import __version__, system
from letta.errors import LettaImageFetchError, LettaInvalidArgumentError
from letta.schemas.enums import MessageRole
from letta.schemas.letta_message_content import Base64Image, ImageContent, ImageSourceType, TextContent
from letta.schemas.message import Message, MessageCreate


async def _fetch_image_from_url(url: str, max_retries: int = 1, timeout_seconds: float = 5.0) -> tuple[bytes, str | None]:
    """
    Async helper to fetch image from URL without blocking the event loop.
    Retries once on timeout to handle transient network issues.

    Args:
        url: URL of the image to fetch
        max_retries: Number of retry attempts (default: 1)
        timeout_seconds: Total timeout in seconds (default: 5.0)

    Returns:
        Tuple of (image_bytes, media_type)

    Raises:
        LettaImageFetchError: If image fetch fails after all retries
    """
    # Connect timeout is half of total timeout, capped at 3 seconds
    connect_timeout = min(timeout_seconds / 2, 3.0)
    timeout = httpx.Timeout(timeout_seconds, connect=connect_timeout)
    headers = {"User-Agent": f"Letta/{__version__}"}

    last_exception = None
    for attempt in range(max_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=timeout, headers=headers) as client:
                image_response = await client.get(url, follow_redirects=True)
                image_response.raise_for_status()
                image_bytes = image_response.content
                image_media_type = image_response.headers.get("content-type")
                return image_bytes, image_media_type
        except httpx.TimeoutException as e:
            last_exception = e
            if attempt < max_retries:
                # Brief delay before retry
                await asyncio.sleep(0.5)
                continue
            # Final attempt failed
            raise LettaImageFetchError(url=url, reason=f"Timeout after {max_retries + 1} attempts: {e}")
        except (httpx.RemoteProtocolError, httpx.HTTPStatusError) as e:
            # Don't retry on protocol errors or HTTP errors (4xx, 5xx)
            raise LettaImageFetchError(url=url, reason=str(e))
        except Exception as e:
            raise LettaImageFetchError(url=url, reason=f"Unexpected error: {e}")

    # Should never reach here, but just in case
    raise LettaImageFetchError(url=url, reason=f"Failed after {max_retries + 1} attempts: {last_exception}")


def _validate_image_source_url(url: str) -> str:
    """Validate supported image URL schemes before any fetch/resolve happens."""
    parsed_url = urlparse(url)
    scheme = parsed_url.scheme.lower()

    if scheme in ("http", "https", "data"):
        return scheme

    raise LettaInvalidArgumentError(
        message=(
            f"Unsupported image URL scheme '{parsed_url.scheme or '<missing>'}'. "
            "Only 'http', 'https', and 'data' image URLs are supported. "
            "Local file paths (file://) are not allowed."
        ),
        argument_name="url",
    )


def _parse_data_image_url(url: str) -> tuple[str, str]:
    """Parse a data URL and return its base64 payload and media type."""
    try:
        header, image_data = url.split(",", 1)
        header_parts = header.split(";")
        image_media_type = header_parts[0].replace("data:", "") or "image/jpeg"
        return image_data, image_media_type
    except ValueError as exc:
        raise LettaImageFetchError(url=url[:100] + "...", reason="Invalid data URL format") from exc


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
    if not isinstance(message_create, MessageCreate):
        raise ValueError(f"Expected MessageCreate, got {type(message_create).__name__}")

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
                url_scheme = _validate_image_source_url(url)

                if url_scheme == "data":
                    image_data, image_media_type = _parse_data_image_url(url)
                    content.source = Base64Image(media_type=image_media_type, data=image_data)
                    continue

                image_bytes, image_media_type = await _fetch_image_from_url(url)
                if not image_media_type:
                    image_media_type, _ = mimetypes.guess_type(url)

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


async def _resolve_url_to_base64(url: str) -> tuple[str, str]:
    """Resolve URL to base64 data and media type."""
    url_scheme = _validate_image_source_url(url)

    if url_scheme == "data":
        return _parse_data_image_url(url)

    image_bytes, media_type = await _fetch_image_from_url(url)
    media_type = media_type or mimetypes.guess_type(url)[0] or "image/png"

    image_data = base64.standard_b64encode(image_bytes).decode("utf-8")
    return image_data, media_type


async def resolve_tool_return_images(func_response: str | list) -> str | list:
    """Resolve URL and LettaImage sources to base64 for tool returns."""
    if isinstance(func_response, str):
        return func_response

    resolved = []
    for part in func_response:
        if isinstance(part, ImageContent):
            if part.source.type == ImageSourceType.url:
                image_data, media_type = await _resolve_url_to_base64(part.source.url)
                part.source = Base64Image(media_type=media_type, data=image_data)
            elif part.source.type == ImageSourceType.letta and not part.source.data:
                pass
            resolved.append(part)
        elif isinstance(part, TextContent):
            resolved.append(part)
        elif isinstance(part, dict):
            if part.get("type") == "image" and part.get("source", {}).get("type") == "url":
                url = part["source"].get("url")
                if url:
                    image_data, media_type = await _resolve_url_to_base64(url)
                    resolved.append(
                        ImageContent(
                            source=Base64Image(
                                media_type=media_type,
                                data=image_data,
                                detail=part.get("source", {}).get("detail"),
                            )
                        )
                    )
                else:
                    resolved.append(part)
            elif part.get("type") == "text":
                resolved.append(TextContent(text=part.get("text", "")))
            else:
                resolved.append(part)
        else:
            resolved.append(part)

    return resolved
