from enum import Enum
from typing import Annotated, Any, Dict, Literal, Union

from pydantic import BaseModel, Field, field_validator


class ResponseFormatType(str, Enum):
    """Enum defining the possible response format types."""

    text = "text"
    json_schema = "json_schema"
    json_object = "json_object"


class ResponseFormat(BaseModel):
    """Base class for all response formats."""

    type: ResponseFormatType = Field(
        ...,
        description="The type of the response format.",
        # why use this?
        example=ResponseFormatType.text,
    )


# ---------------------
# Response Format Types
# ---------------------

# SQLAlchemy type for database mapping
ResponseFormatDict = Dict[str, Any]


class TextResponseFormat(ResponseFormat):
    """Response format for plain text responses."""

    type: Literal[ResponseFormatType.text] = Field(
        ResponseFormatType.text,
        description="The type of the response format.",
    )


class JsonSchemaResponseFormat(ResponseFormat):
    """Response format for JSON schema-based responses."""

    type: Literal[ResponseFormatType.json_schema] = Field(
        ResponseFormatType.json_schema,
        description="The type of the response format.",
    )
    json_schema: Dict[str, Any] = Field(
        ...,
        description="The JSON schema of the response.",
    )

    @classmethod
    @field_validator("json_schema")
    def validate_json_schema(cls, v: Dict[str, Any]) -> Dict[str, Any]:
        """Validate that the provided schema is a valid JSON schema."""
        if "schema" not in v:
            raise ValueError("JSON schema should include a schema property")
        return v


class JsonObjectResponseFormat(ResponseFormat):
    """Response format for JSON object responses."""

    type: Literal[ResponseFormatType.json_object] = Field(
        ResponseFormatType.json_object,
        description="The type of the response format.",
    )


# Pydantic type for validation
ResponseFormatUnion = Annotated[
    Union[TextResponseFormat | JsonSchemaResponseFormat | JsonObjectResponseFormat],
    Field(discriminator="type"),
]
