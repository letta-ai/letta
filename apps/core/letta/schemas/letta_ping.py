from typing import Literal

from pydantic import BaseModel, Field


def create_letta_ping_schema():
    return {
        "properties": {
            "message_type": {
                "type": "string",
                "const": "ping",
                "title": "Message Type",
                "description": "The type of the message.",
                "default": "ping",
            }
        },
        "type": "object",
        "required": ["message_type"],
        "title": "LettaPing",
        "description": "Ping messages are a keep-alive to prevent SSE streams from timing out during long running requests.",
    }


class LettaPing(BaseModel):
    message_type: Literal["ping"] = Field(
        "ping",
        description="The type of the message. Ping messages are a keep-alive to prevent SSE streams from timing out during long running requests.",
    )
