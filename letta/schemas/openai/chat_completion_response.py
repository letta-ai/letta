import datetime
from typing import List, Literal, Optional, Union

from pydantic import BaseModel

# class ToolCallFunction(BaseModel):
#     name: str
#     arguments: str


class FunctionCall(BaseModel):
    arguments: str
    name: str


class ToolCall(BaseModel):
    id: str
    # "Currently, only function is supported"
    type: Literal["function"] = "function"
    # function: ToolCallFunction
    function: FunctionCall


class LogProbToken(BaseModel):
    token: str
    logprob: float
    bytes: Optional[List[int]]


# Legacy?
class MessageContentLogProb(BaseModel):
    token: str
    logprob: float
    bytes: Optional[List[int]]
    top_logprobs: Optional[List[LogProbToken]]


class TopLogprob(BaseModel):
    token: str
    bytes: Optional[List[int]] = None
    logprob: float


class ChatCompletionTokenLogprob(BaseModel):
    token: str
    bytes: Optional[List[int]] = None
    logprob: float
    top_logprobs: List[TopLogprob]


class ChoiceLogprobs(BaseModel):
    content: Optional[List[ChatCompletionTokenLogprob]] = None

    refusal: Optional[List[ChatCompletionTokenLogprob]] = None


class Message(BaseModel):
    content: Optional[str] = None
    tool_calls: Optional[List[ToolCall]] = None
    role: str
    function_call: Optional[FunctionCall] = None  # Deprecated
    reasoning_content: Optional[str] = None  # Used in newer reasoning APIs, e.g. DeepSeek
    reasoning_content_signature: Optional[str] = None  # NOTE: for Anthropic
    redacted_reasoning_content: Optional[str] = None  # NOTE: for Anthropic
    omitted_reasoning_content: bool = False  # NOTE: for OpenAI o1/o3


class Choice(BaseModel):
    finish_reason: str
    index: int
    message: Message
    logprobs: Optional[ChoiceLogprobs] = None
    seed: Optional[int] = None  # found in TogetherAI


class UsageStatisticsPromptTokenDetails(BaseModel):
    cached_tokens: int = 0
    # NOTE: OAI specific
    # audio_tokens: int = 0

    def __add__(self, other: "UsageStatisticsPromptTokenDetails") -> "UsageStatisticsPromptTokenDetails":
        return UsageStatisticsPromptTokenDetails(
            cached_tokens=self.cached_tokens + other.cached_tokens,
        )


class UsageStatisticsCompletionTokenDetails(BaseModel):
    reasoning_tokens: int = 0
    # NOTE: OAI specific
    # audio_tokens: int = 0
    # accepted_prediction_tokens: int = 0
    # rejected_prediction_tokens: int = 0

    def __add__(self, other: "UsageStatisticsCompletionTokenDetails") -> "UsageStatisticsCompletionTokenDetails":
        return UsageStatisticsCompletionTokenDetails(
            reasoning_tokens=self.reasoning_tokens + other.reasoning_tokens,
        )


class UsageStatistics(BaseModel):
    completion_tokens: int = 0
    prompt_tokens: int = 0
    total_tokens: int = 0

    prompt_tokens_details: Optional[UsageStatisticsPromptTokenDetails] = None
    completion_tokens_details: Optional[UsageStatisticsCompletionTokenDetails] = None

    def __add__(self, other: "UsageStatistics") -> "UsageStatistics":
        if self.prompt_tokens_details is None and other.prompt_tokens_details is None:
            total_prompt_tokens_details = None
        elif self.prompt_tokens_details is None:
            total_prompt_tokens_details = other.prompt_tokens_details
        elif other.prompt_tokens_details is None:
            total_prompt_tokens_details = self.prompt_tokens_details
        else:
            total_prompt_tokens_details = self.prompt_tokens_details + other.prompt_tokens_details

        if self.completion_tokens_details is None and other.completion_tokens_details is None:
            total_completion_tokens_details = None
        elif self.completion_tokens_details is None:
            total_completion_tokens_details = other.completion_tokens_details
        elif other.completion_tokens_details is None:
            total_completion_tokens_details = self.completion_tokens_details
        else:
            total_completion_tokens_details = self.completion_tokens_details + other.completion_tokens_details

        return UsageStatistics(
            completion_tokens=self.completion_tokens + other.completion_tokens,
            prompt_tokens=self.prompt_tokens + other.prompt_tokens,
            total_tokens=self.total_tokens + other.total_tokens,
            prompt_tokens_details=total_prompt_tokens_details,
            completion_tokens_details=total_completion_tokens_details,
        )


class ChatCompletionResponse(BaseModel):
    """https://platform.openai.com/docs/api-reference/chat/object"""

    id: str
    choices: List[Choice]
    created: Union[datetime.datetime, int]
    model: Optional[str] = None  # NOTE: this is not consistent with OpenAI API standard, however is necessary to support local LLMs
    # system_fingerprint: str  # docs say this is mandatory, but in reality API returns None
    system_fingerprint: Optional[str] = None
    # object: str = Field(default="chat.completion")
    object: Literal["chat.completion"] = "chat.completion"
    usage: UsageStatistics

    def __str__(self):
        return self.model_dump_json(indent=4)


class FunctionCallDelta(BaseModel):
    # arguments: Optional[str] = None
    name: Optional[str] = None
    arguments: Optional[str] = None
    # name: str


class ToolCallDelta(BaseModel):
    index: int
    id: Optional[str] = None
    # "Currently, only function is supported"
    type: Literal["function"] = "function"
    # function: ToolCallFunction
    function: Optional[FunctionCallDelta] = None


class MessageDelta(BaseModel):
    """Partial delta stream of a Message

    Example ChunkResponse:
    {
        'id': 'chatcmpl-9EOCkKdicNo1tiL1956kPvCnL2lLS',
        'object': 'chat.completion.chunk',
        'created': 1713216662,
        'model': 'gpt-4-0613',
        'system_fingerprint': None,
        'choices': [{
            'index': 0,
            'delta': {'content': 'User'},
            'logprobs': None,
            'finish_reason': None
        }]
    }
    """

    content: Optional[str] = None
    reasoning_content: Optional[str] = None
    reasoning_content_signature: Optional[str] = None  # NOTE: for Anthropic
    redacted_reasoning_content: Optional[str] = None  # NOTE: for Anthropic
    tool_calls: Optional[List[ToolCallDelta]] = None
    role: Optional[str] = None
    function_call: Optional[FunctionCallDelta] = None  # Deprecated


class ChunkChoice(BaseModel):
    finish_reason: Optional[str] = None  # NOTE: when streaming will be null
    index: int
    delta: MessageDelta
    logprobs: Optional[ChoiceLogprobs] = None


class ChatCompletionChunkResponse(BaseModel):
    """https://platform.openai.com/docs/api-reference/chat/streaming"""

    id: str
    choices: List[ChunkChoice]
    created: Union[datetime.datetime, int]
    model: str
    # system_fingerprint: str  # docs say this is mandatory, but in reality API returns None
    system_fingerprint: Optional[str] = None
    # object: str = Field(default="chat.completion")
    object: Literal["chat.completion.chunk"] = "chat.completion.chunk"
    output_tokens: int = 0
