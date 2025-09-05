from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field, field_validator

from openai.types.responses import (
    # Input content types
    ResponseInputText,
    ResponseInputImage,
    ResponseFormatTextConfig,
    ResponseFormatTextJSONSchemaConfig,
)

# Reasoning configuration types
class Reasoning(BaseModel):
    """Configuration for reasoning in responses API"""
    effort: Literal["minimal", "low", "medium", "high"]
    
# Constants for reasoning efforts
class ReasoningEffort:
    MINIMAL = "minimal"
    LOW = "low" 
    MEDIUM = "medium"
    HIGH = "high"

# Input content types - inherit from OpenAI base types for extensibility
class ResponseInputTextContent(ResponseInputText):
    """Text input for Responses API. Extends OpenAI base type for future customization."""
    pass

class ResponseInputImageContent(ResponseInputImage):
    """Image input for Responses API. Extends OpenAI base type for future customization."""
    pass

# Input content union type
ResponseInputUnion = Union[str, List[Union[ResponseInputTextContent, ResponseInputImageContent]]]

# Message types for conversation history
class ResponseSystemMessage(BaseModel):
    content: str
    role: Literal["system"] = "system"
    name: Optional[str] = None

class ResponseUserMessage(BaseModel):
    content: Union[str, List[Union[ResponseInputTextContent, ResponseInputImageContent]]]
    role: Literal["user"] = "user"
    name: Optional[str] = None

class ResponseDeveloperMessage(BaseModel):
    content: Union[str, List[Union[ResponseInputTextContent, ResponseInputImageContent]]]
    role: Literal["developer"] = "developer"
    name: Optional[str] = None

class ResponseAssistantMessage(BaseModel):
    content: Optional[str] = None
    role: Literal["assistant"] = "assistant"
    name: Optional[str] = None

# Union type for conversation messages
ResponseMessage = Union[ResponseSystemMessage, ResponseUserMessage, ResponseDeveloperMessage, ResponseAssistantMessage]

# Tool types - inherit from OpenAI base types
class ResponseFunctionSchema(BaseModel):
    """Function schema for Responses API tools"""
    name: str
    description: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None  # JSON Schema for the parameters
    strict: Optional[bool] = False

class ResponseFunctionTool(BaseModel):
    """Function tool for Responses API. Compatible with OpenAI structure."""
    type: Literal["function"] = "function"
    function: ResponseFunctionSchema

# Tool choice and format types - use OpenAI types directly
ResponseTool = Union[ResponseFunctionTool]  # Only function tools, no file search or web search
ResponseToolChoice = Union[Literal["auto", "none", "required"], Dict[str, Any]]
ResponseFormat = Union[ResponseFormatTextConfig, ResponseFormatTextJSONSchemaConfig]

def cast_response_message_to_subtype(m_dict: dict) -> ResponseMessage:
    """Cast a dictionary to one of the individual response message types"""
    role = m_dict.get("role")
    if role == "system":
        return ResponseSystemMessage(**m_dict)
    elif role == "user":
        return ResponseUserMessage(**m_dict)
    elif role == "developer":
        return ResponseDeveloperMessage(**m_dict)
    elif role == "assistant":
        return ResponseAssistantMessage(**m_dict)
    else:
        raise ValueError(f"Unknown message role: {role}")

class ResponsesRequest(BaseModel):
    """OpenAI Responses API request schema
    
    Compatible with OpenAI's Responses API create endpoint.
    Equivalent functionality to ChatCompletionRequest but for Responses API.
    Based on: https://platform.openai.com/docs/api-reference/responses/create
    """
    
    # Required parameters (equivalent to ChatCompletionRequest)
    model: str
    
    # Input content - equivalent to messages in ChatCompletionRequest
    input: ResponseInputUnion
    
    # Optional parameters with equivalent functionality to ChatCompletionRequest
    instructions: Optional[str] = None  # equivalent to system message
    conversation: Optional[List[Union[ResponseMessage, Dict]]] = None  # equivalent to messages
    
    # Tool support (equivalent to ChatCompletionRequest tools)
    tools: Optional[List[ResponseTool]] = None
    tool_choice: Optional[ResponseToolChoice] = None
    
    # Response configuration (equivalent to ChatCompletionRequest)
    response_format: Optional[ResponseFormat] = None
    max_output_tokens: Optional[int] = None  # equivalent to max_completion_tokens
    
    # Control parameters (equivalent to ChatCompletionRequest)
    temperature: Optional[float] = None
    top_p: Optional[float] = None
    stream: Optional[bool] = False
    user: Optional[str] = None  # unique ID of the end-user (for monitoring)
    
    # Responses API specific parameters
    background: Optional[bool] = False
    include: Optional[List[str]] = None  # e.g., ["reasoning.encrypted_content"]
    store: bool = Field(default=False, description="Always False - responses are not stored by default")
    metadata: Optional[Dict[str, Any]] = None
    
    # Reasoning parameters (for reasoning models, equivalent to reasoning_effort in ChatCompletionRequest)
    reasoning: Optional[Reasoning] = None  # e.g., ReasoningConfig(effort="high")
    
    @field_validator("conversation", mode="before")
    @classmethod
    def cast_all_conversation_messages(cls, v):
        if v is None:
            return v
        return [cast_response_message_to_subtype(m) if isinstance(m, dict) else m for m in v]

# Alias for consistency with chat completions naming
ChatResponsesRequest = ResponsesRequest

# Legacy aliases for backwards compatibility
TextInputTypes = ResponseInputTextContent
ImageInputType = ResponseInputImageContent

# Example usage:
# request = ResponsesRequest(
#     model="gpt-4",
#     input="Hello world",
#     reasoning=Reasoning(effort=ReasoningEffort.HIGH)
# )
# 
# Or using the literal:
# request = ResponsesRequest(
#     model="gpt-4", 
#     input="Hello world",
#     reasoning=Reasoning(effort="high")
# )

# role user is assumed if input is just a string -> logic handled in client