from enum import Enum
from typing import Annotated, List, Literal, Optional, Union

from openai.types import Reasoning
from pydantic import BaseModel, Field


class MessageContentType(str, Enum):
    text = "text"
    image = "image"
    tool_call = "tool_call"
    tool_return = "tool_return"
    # For Anthropic extended thinking
    reasoning = "reasoning"
    redacted_reasoning = "redacted_reasoning"
    # Generic "hidden" (unsavailable) reasoning
    omitted_reasoning = "omitted_reasoning"
    # For OpenAI Responses API
    summarized_reasoning = "summarized_reasoning"


class MessageContent(BaseModel):
    type: MessageContentType = Field(..., description="The type of the message.")

    def to_text(self) -> Optional[str]:
        """Extract text representation from this content type.

        Returns:
            Text representation of the content, None if no text available.
        """
        return None


# -------------------------------
# Text Content
# -------------------------------


class TextContent(MessageContent):
    type: Literal[MessageContentType.text] = Field(default=MessageContentType.text, description="The type of the message.")
    text: str = Field(..., description="The text content of the message.")
    signature: Optional[str] = Field(
        default=None, description="Stores a unique identifier for any reasoning associated with this text content."
    )

    def to_text(self) -> str:
        """Return the text content."""
        return self.text


# -------------------------------
# Image Content
# -------------------------------


class ImageSourceType(str, Enum):
    url = "url"
    base64 = "base64"
    letta = "letta"


class ImageSource(BaseModel):
    type: ImageSourceType = Field(..., description="The source type for the image.")


class UrlImage(ImageSource):
    type: Literal[ImageSourceType.url] = Field(default=ImageSourceType.url, description="The source type for the image.")
    url: str = Field(..., description="The URL of the image.")


class Base64Image(ImageSource):
    type: Literal[ImageSourceType.base64] = Field(default=ImageSourceType.base64, description="The source type for the image.")
    media_type: str = Field(..., description="The media type for the image.")
    data: str = Field(..., description="The base64 encoded image data.")
    detail: Optional[str] = Field(
        default=None,
        description="What level of detail to use when processing and understanding the image (low, high, or auto to let the model decide)",
    )


class LettaImage(ImageSource):
    type: Literal[ImageSourceType.letta] = Field(default=ImageSourceType.letta, description="The source type for the image.")
    file_id: str = Field(..., description="The unique identifier of the image file persisted in storage.")
    media_type: Optional[str] = Field(default=None, description="The media type for the image.")
    data: Optional[str] = Field(default=None, description="The base64 encoded image data.")
    detail: Optional[str] = Field(
        default=None,
        description="What level of detail to use when processing and understanding the image (low, high, or auto to let the model decide)",
    )


ImageSourceUnion = Annotated[Union[UrlImage, Base64Image, LettaImage], Field(discriminator="type")]


class ImageContent(MessageContent):
    type: Literal[MessageContentType.image] = Field(default=MessageContentType.image, description="The type of the message.")
    source: ImageSourceUnion = Field(..., description="The source of the image.")


# -------------------------------
# User Content Types
# -------------------------------


LettaUserMessageContentUnion = Annotated[
    Union[TextContent, ImageContent],
    Field(discriminator="type"),
]


def create_letta_user_message_content_union_schema():
    return {
        "oneOf": [
            {"$ref": "#/components/schemas/TextContent"},
            {"$ref": "#/components/schemas/ImageContent"},
        ],
        "discriminator": {
            "propertyName": "type",
            "mapping": {
                "text": "#/components/schemas/TextContent",
                "image": "#/components/schemas/ImageContent",
            },
        },
    }


def get_letta_user_message_content_union_str_json_schema():
    return {
        "anyOf": [
            {
                "type": "array",
                "items": {
                    "$ref": "#/components/schemas/LettaUserMessageContentUnion",
                },
            },
            {"type": "string"},
        ],
    }


# -------------------------------
# Assistant Content Types
# -------------------------------


LettaAssistantMessageContentUnion = Annotated[
    Union[TextContent],
    Field(discriminator="type"),
]


def create_letta_assistant_message_content_union_schema():
    return {
        "oneOf": [
            {"$ref": "#/components/schemas/TextContent"},
        ],
        "discriminator": {
            "propertyName": "type",
            "mapping": {
                "text": "#/components/schemas/TextContent",
            },
        },
    }


def get_letta_assistant_message_content_union_str_json_schema():
    return {
        "anyOf": [
            {
                "type": "array",
                "items": {
                    "$ref": "#/components/schemas/LettaAssistantMessageContentUnion",
                },
            },
            {"type": "string"},
        ],
    }


# -------------------------------
# Intermediate Step Content Types
# -------------------------------


class ToolCallContent(MessageContent):
    type: Literal[MessageContentType.tool_call] = Field(
        default=MessageContentType.tool_call, description="Indicates this content represents a tool call event."
    )
    id: str = Field(..., description="A unique identifier for this specific tool call instance.")
    name: str = Field(..., description="The name of the tool being called.")
    input: dict = Field(
        ..., description="The parameters being passed to the tool, structured as a dictionary of parameter names to values."
    )
    signature: Optional[str] = Field(
        default=None, description="Stores a unique identifier for any reasoning associated with this tool call."
    )

    def to_text(self) -> str:
        """Return a text representation of the tool call."""
        import json

        input_str = json.dumps(self.input, indent=2)
        return f"Tool call: {self.name}({input_str})"


class ToolReturnContent(MessageContent):
    type: Literal[MessageContentType.tool_return] = Field(
        default=MessageContentType.tool_return, description="Indicates this content represents a tool return event."
    )
    tool_call_id: str = Field(..., description="References the ID of the ToolCallContent that initiated this tool call.")
    content: str = Field(..., description="The content returned by the tool execution.")
    is_error: bool = Field(..., description="Indicates whether the tool execution resulted in an error.")

    def to_text(self) -> str:
        """Return the tool return content."""
        prefix = "Tool error: " if self.is_error else "Tool result: "
        return f"{prefix}{self.content}"


class ReasoningContent(MessageContent):
    """Sent via the Anthropic Messages API"""

    type: Literal[MessageContentType.reasoning] = Field(
        default=MessageContentType.reasoning, description="Indicates this is a reasoning/intermediate step."
    )
    is_native: bool = Field(..., description="Whether the reasoning content was generated by a reasoner model that processed this step.")
    reasoning: str = Field(..., description="The intermediate reasoning or thought process content.")
    signature: Optional[str] = Field(default=None, description="A unique identifier for this reasoning step.")

    def to_text(self) -> str:
        """Return the reasoning content."""
        return self.reasoning


class RedactedReasoningContent(MessageContent):
    """Sent via the Anthropic Messages API"""

    type: Literal[MessageContentType.redacted_reasoning] = Field(
        default=MessageContentType.redacted_reasoning, description="Indicates this is a redacted thinking step."
    )
    data: str = Field(..., description="The redacted or filtered intermediate reasoning content.")


class OmittedReasoningContent(MessageContent):
    """A placeholder for reasoning content we know is present, but isn't returned by the provider (e.g. OpenAI GPT-5 on ChatCompletions)"""

    type: Literal[MessageContentType.omitted_reasoning] = Field(
        default=MessageContentType.omitted_reasoning, description="Indicates this is an omitted reasoning step."
    )
    signature: Optional[str] = Field(default=None, description="A unique identifier for this reasoning step.")
    # NOTE: dropping because we don't track this kind of information for the other reasoning types
    # tokens: int = Field(..., description="The reasoning token count for intermediate reasoning content.")


class SummarizedReasoningContentPart(BaseModel):
    index: int = Field(..., description="The index of the summary part.")
    text: str = Field(..., description="The text of the summary part.")


class SummarizedReasoningContent(MessageContent):
    """The style of reasoning content returned by the OpenAI Responses API"""

    # TODO consider expanding ReasoningContent to support this superset?
    # Or alternatively, rename `ReasoningContent` to `AnthropicReasoningContent`,
    # and rename this one to `OpenAIReasoningContent`?

    # NOTE: I think the argument for putting thie in ReasoningContent as an additional "summary" field is that it keeps the
    # rendering and GET / listing code a lot simpler, you just need to know how to render "TextContent" and "ReasoningContent"
    # vs breaking out into having to know how to render additional types
    # NOTE: I think the main issue is that we need to track provenance of which provider the reasoning came from
    # so that we don't attempt eg to put Anthropic encrypted reasoning into a GPT-5 responses payload
    type: Literal[MessageContentType.summarized_reasoning] = Field(
        default=MessageContentType.summarized_reasoning, description="Indicates this is a summarized reasoning step."
    )

    # OpenAI requires holding a string
    id: str = Field(..., description="The unique identifier for this reasoning step.")  # NOTE: I don't think this is actually needed?
    # OpenAI returns a list of summary objects, each a string
    # Straying a bit from the OpenAI schema so that we can enforce ordering on the deltas that come out
    # summary: List[str] = Field(..., description="Summaries of the reasoning content.")
    summary: List[SummarizedReasoningContentPart] = Field(..., description="Summaries of the reasoning content.")
    encrypted_content: str = Field(default=None, description="The encrypted reasoning content.")

    # Temporary stop-gap until the SDKs are updated
    def to_reasoning_content(self) -> Optional[ReasoningContent]:
        # Merge the summary parts with a '\n' join
        parts = [s.text for s in self.summary if s.text != ""]
        if not parts or len(parts) == 0:
            return None
        else:
            combined_summary = "\n\n".join(parts)
            return ReasoningContent(
                is_native=True,
                reasoning=combined_summary,
                signature=self.encrypted_content,
            )


LettaMessageContentUnion = Annotated[
    Union[
        TextContent,
        ImageContent,
        ToolCallContent,
        ToolReturnContent,
        ReasoningContent,
        RedactedReasoningContent,
        OmittedReasoningContent,
        SummarizedReasoningContent,
    ],
    Field(discriminator="type"),
]


def create_letta_message_content_union_schema():
    return {
        "oneOf": [
            {"$ref": "#/components/schemas/TextContent"},
            {"$ref": "#/components/schemas/ImageContent"},
            {"$ref": "#/components/schemas/ToolCallContent"},
            {"$ref": "#/components/schemas/ToolReturnContent"},
            {"$ref": "#/components/schemas/ReasoningContent"},
            {"$ref": "#/components/schemas/RedactedReasoningContent"},
            {"$ref": "#/components/schemas/OmittedReasoningContent"},
        ],
        "discriminator": {
            "propertyName": "type",
            "mapping": {
                "text": "#/components/schemas/TextContent",
                "image": "#/components/schemas/ImageContent",
                "tool_call": "#/components/schemas/ToolCallContent",
                "tool_return": "#/components/schemas/ToolCallContent",
                "reasoning": "#/components/schemas/ReasoningContent",
                "redacted_reasoning": "#/components/schemas/RedactedReasoningContent",
                "omitted_reasoning": "#/components/schemas/OmittedReasoningContent",
            },
        },
    }


def get_letta_message_content_union_str_json_schema():
    return {
        "anyOf": [
            {
                "type": "array",
                "items": {
                    "$ref": "#/components/schemas/LettaMessageContentUnion",
                },
            },
            {"type": "string"},
        ],
    }
