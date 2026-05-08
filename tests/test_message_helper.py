import pytest

from letta.errors import LettaInvalidArgumentError
from letta.helpers.message_helper import convert_message_creates_to_messages, resolve_tool_return_images
from letta.schemas.letta_message_content import Base64Image, ImageContent, TextContent, UrlImage
from letta.schemas.message import MessageCreate


@pytest.mark.asyncio
async def test_convert_message_creates_to_messages_rejects_file_image_urls():
    message = MessageCreate(
        role="user",
        content=[
            TextContent(text="describe this image"),
            ImageContent(source=UrlImage(url="file:///etc/hostname")),
        ],
    )

    with pytest.raises(LettaInvalidArgumentError, match="Unsupported image URL scheme 'file'"):
        await convert_message_creates_to_messages(
            [message],
            agent_id="agent-test",
            timezone="UTC",
            run_id="run-test",
            wrap_user_message=False,
            wrap_system_message=False,
        )


@pytest.mark.asyncio
async def test_resolve_tool_return_images_rejects_file_image_urls():
    with pytest.raises(LettaInvalidArgumentError, match="Unsupported image URL scheme 'file'"):
        await resolve_tool_return_images([ImageContent(source=UrlImage(url="file:///etc/passwd"))])


@pytest.mark.asyncio
async def test_convert_message_creates_to_messages_keeps_data_urls_supported():
    message = MessageCreate(
        role="user",
        content=[ImageContent(source=UrlImage(url="data:image/png;base64,dGVzdA=="))],
    )

    converted_messages = await convert_message_creates_to_messages(
        [message],
        agent_id="agent-test",
        timezone="UTC",
        run_id="run-test",
        wrap_user_message=False,
        wrap_system_message=False,
    )

    image_source = converted_messages[0].content[0].source
    assert isinstance(image_source, Base64Image)
    assert image_source.media_type == "image/png"
    assert image_source.data == "dGVzdA=="
