from enum import Enum
from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field


class MessageContentType(str, Enum):
    text = "text"


class MessageContent(BaseModel):
    type: MessageContentType = Field(..., description="The type of the message.")


# -------------------------------
# Multi-Modal Content Types
# -------------------------------


class TextContent(MessageContent):
    type: Literal[MessageContentType.text] = Field(MessageContentType.text, description="The type of the message.")
    text: str = Field(..., description="The text content of the message.")


LettaMessageContentUnion = Annotated[
    Union[TextContent],
    Field(discriminator="type"),
]


def create_letta_message_content_union_schema():
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
