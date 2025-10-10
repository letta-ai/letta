from typing import Any, Dict, Iterable, List, Literal, Optional, Union

from openai import NOT_GIVEN
from openai.types import Metadata, Reasoning, ResponsesModel

# from openai._types import Headers, Query, Body
from openai.types.responses import (
    ResponseIncludable,
    ResponseInputParam,
    ResponsePromptParam,
    ResponseTextConfigParam,
    ToolParam,
    response_create_params,
)

# import httpx
from pydantic import BaseModel, Field


class ResponsesRequest(BaseModel):
    background: Optional[bool] = Field(default=NOT_GIVEN)
    include: Optional[List[ResponseIncludable]] = Field(default=NOT_GIVEN)
    input: Optional[Union[str, ResponseInputParam]] = Field(default=NOT_GIVEN)
    instructions: Optional[str] = Field(default=NOT_GIVEN)
    max_output_tokens: Optional[int] = Field(default=NOT_GIVEN)
    max_tool_calls: Optional[int] = Field(default=NOT_GIVEN)
    metadata: Optional[Metadata] = Field(default=NOT_GIVEN)
    model: Optional[ResponsesModel] = Field(default=NOT_GIVEN)
    parallel_tool_calls: Optional[bool] = Field(default=NOT_GIVEN)
    previous_response_id: Optional[str] = Field(default=NOT_GIVEN)
    prompt: Optional[ResponsePromptParam] = Field(default=NOT_GIVEN)
    prompt_cache_key: Optional[str] = Field(default=NOT_GIVEN)
    reasoning: Optional[Reasoning] = Field(default=NOT_GIVEN)
    safety_identifier: Optional[str] = Field(default=NOT_GIVEN)
    service_tier: Optional[Literal["auto", "default", "flex", "scale", "priority"]] = Field(default=NOT_GIVEN)
    store: Optional[bool] = Field(default=NOT_GIVEN)
    stream: Optional[Literal[False]] = Field(default=NOT_GIVEN)
    stream_options: Optional[response_create_params.StreamOptions] = Field(default=NOT_GIVEN)
    temperature: Optional[float] = Field(default=NOT_GIVEN)
    text: Optional[ResponseTextConfigParam] = Field(default=NOT_GIVEN)
    tool_choice: Optional[response_create_params.ToolChoice] = Field(default=NOT_GIVEN)
    tools: Optional[Iterable[ToolParam]] = Field(default=NOT_GIVEN)
    top_logprobs: Optional[int] = Field(default=NOT_GIVEN)
    top_p: Optional[float] = Field(default=NOT_GIVEN)
    truncation: Optional[Literal["auto", "disabled"]] = Field(default=NOT_GIVEN)
    user: Optional[str] = Field(default=NOT_GIVEN)
    # Use the following arguments if you need to pass additional parameters to the API that aren't available via kwargs.
    # The extra values given here take precedence over values defined on the client or passed to this method.
    # extra_headers: Headers | None = (None,)
    # extra_query: Query | None = (None,)
    # extra_body: Body | None = (None,)
    # timeout: float | httpx.Timeout | None | NotGiven = (NOT_GIVEN,)

    def model_dump(self, **kwargs) -> Dict[str, Any]:
        """Custom model_dump that properly serializes complex OpenAI types for JSON compatibility."""
        # Force JSON mode to ensure full serialization of complex OpenAI types
        # This prevents SerializationIterator objects from being created
        kwargs["mode"] = "json"

        # Get the JSON-serialized dump
        data = super().model_dump(**kwargs)

        # The API expects dicts, which JSON mode provides
        return data
