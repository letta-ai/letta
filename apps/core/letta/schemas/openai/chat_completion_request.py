from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field, field_validator


class SystemMessage(BaseModel):
    content: str
    role: str = "system"
    name: Optional[str] = None


class UserMessage(BaseModel):
    content: Union[str, List[str], List[dict]]
    role: str = "user"
    name: Optional[str] = None


class ToolCallFunction(BaseModel):
    name: str
    arguments: str


class ToolCall(BaseModel):
    id: str
    type: Literal["function"] = "function"
    function: ToolCallFunction


class AssistantMessage(BaseModel):
    content: Optional[str] = None
    role: str = "assistant"
    name: Optional[str] = None
    tool_calls: Optional[List[ToolCall]] = None


class ToolMessage(BaseModel):
    content: str
    role: str = "tool"
    tool_call_id: str


ChatMessage = Union[SystemMessage, UserMessage, AssistantMessage, ToolMessage]


# TODO: this might not be necessary with the validator
def cast_message_to_subtype(m_dict: dict) -> ChatMessage:
    """Cast a dictionary to one of the individual message types"""
    role = m_dict.get("role")
    if role == "system" or role == "developer":
        return SystemMessage(**m_dict)
    elif role == "user":
        return UserMessage(**m_dict)
    elif role == "assistant" or role == "approval":
        return AssistantMessage(**m_dict)
    elif role == "tool":
        return ToolMessage(**m_dict)
    else:
        raise ValueError(f"Unknown message role: {role}")


class ResponseFormat(BaseModel):
    type: str = Field(default="text", pattern="^(text|json_object)$")


## tool_choice ##
class FunctionCall(BaseModel):
    name: str


class ToolFunctionChoice(BaseModel):
    # The type of the tool. Currently, only function is supported
    type: Literal["function"] = "function"
    # type: str = Field(default="function", const=True)
    function: FunctionCall


class AnthropicToolChoiceTool(BaseModel):
    type: str = "tool"
    name: str
    disable_parallel_tool_use: Optional[bool] = False


class AnthropicToolChoiceAny(BaseModel):
    type: str = "any"
    disable_parallel_tool_use: Optional[bool] = False


class AnthropicToolChoiceAuto(BaseModel):
    type: str = "auto"
    disable_parallel_tool_use: Optional[bool] = False


ToolChoice = Union[
    Literal["none", "auto", "required", "any"], ToolFunctionChoice, AnthropicToolChoiceTool, AnthropicToolChoiceAny, AnthropicToolChoiceAuto
]


## tools ##
class FunctionSchema(BaseModel):
    name: str
    description: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None  # JSON Schema for the parameters
    strict: bool = False


class Tool(BaseModel):
    # The type of the tool. Currently, only function is supported
    type: Literal["function"] = "function"
    # type: str = Field(default="function", const=True)
    function: FunctionSchema


## function_call ##
FunctionCallChoice = Union[Literal["none", "auto"], FunctionCall]


class ChatCompletionRequest(BaseModel):
    """https://platform.openai.com/docs/api-reference/chat/create"""

    model: str
    messages: List[Union[ChatMessage, Dict]]
    frequency_penalty: Optional[float] = 0
    logit_bias: Optional[Dict[str, int]] = None
    logprobs: Optional[bool] = False
    top_logprobs: Optional[int] = None
    max_completion_tokens: Optional[int] = None
    n: Optional[int] = 1
    presence_penalty: Optional[float] = 0
    response_format: Optional[ResponseFormat] = None
    seed: Optional[int] = None
    stop: Optional[Union[str, List[str]]] = None
    stream: Optional[bool] = False
    temperature: Optional[float] = 1
    top_p: Optional[float] = 1
    user: Optional[str] = None  # unique ID of the end-user (for monitoring)
    parallel_tool_calls: Optional[bool] = None
    instructions: Optional[str] = None
    verbosity: Optional[Literal["low", "medium", "high"]] = None  # For verbosity control in GPT-5 models
    reasoning_effort: Optional[Literal["minimal", "low", "medium", "high"]] = None  # For reasoning effort control in reasoning models

    # function-calling related
    tools: Optional[List[Tool]] = None
    tool_choice: Optional[ToolChoice] = None  # "none" means don't call a tool
    # deprecated scheme
    functions: Optional[List[FunctionSchema]] = None
    function_call: Optional[FunctionCallChoice] = None

    @field_validator("messages", mode="before")
    @classmethod
    def cast_all_messages(cls, v):
        return [cast_message_to_subtype(m) if isinstance(m, dict) else m for m in v]
