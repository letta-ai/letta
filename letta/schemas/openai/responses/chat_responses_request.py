from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field, field_validator

from openai.types.responses import (
    # Input content types
    ResponseInputText,
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
class ResponsesInputTextContent(ResponseInputText):
    """Text input for Responses API. Can extend if needed."""
    pass


# Input content union type

# Message types for conversation history
class ResponsesSystemMessage(BaseModel):
    content: Union[str, ResponsesInputTextContent]
    role: Literal["system"] = "system"

class ResponsesUserMessage(BaseModel):
    content: Union[str, ResponsesInputTextContent]
    role: Literal["user"] = "user"

class ResponsesDeveloperMessage(BaseModel):
    content: Union[str, ResponsesInputTextContent]
    role: Literal["developer"] = "developer"

# Tool call structures for assistant messages
class ResponsesToolCall(BaseModel):
    id: str
    call_id: str
    type: Literal["function_call"] = "function_call"
    name: str
    arguments: str
    status: Literal["in_progress", "error", "completed"]

class ResponsesAssistantMessage(BaseModel):
    content: Optional[Union[str, ResponsesInputTextContent]] = "" #assistant message should not be nulable
    role: Literal["assistant"] = "assistant"

# For returning tool call output to model in input
# https://platform.openai.com/docs/guides/function-calling
class ResponsesToolMessage(BaseModel):
    output: str # json formatter string
    type: Literal["function_call_output"] = "function_call_output"
    call_id: str

# Union type for conversation messages
ResponsesMessage = Union[str, ResponsesSystemMessage, ResponsesUserMessage, ResponsesDeveloperMessage, ResponsesAssistantMessage, ResponsesToolMessage, ResponsesToolCall]

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


class ResponsesToolDefinition(BaseModel):
    # The type of the tool. Currently, only function is supported
    type: Literal["function"] = "function"
    name: str  # Required: The name of the function
    description: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None  # JSON Schema for the parameters
    strict: bool = True # responses defaults to strict as true, should we default to false?
    additionalProperties: bool = False


## tool_choice ##
class FunctionCall(BaseModel):
    name: str

# for specifying tools in tool choice
class ToolChoiceFunction(BaseModel):
    # The type of the tool. Currently, only function is supported
    type: Literal["function"] = "function"
    function: FunctionCall



ResponsesToolChoice = Union[
    Literal["none", "auto", "required", "any"], ToolChoiceFunction, AnthropicToolChoiceTool, AnthropicToolChoiceAny, AnthropicToolChoiceAuto
]
ResponsesFormat = Union[ResponseFormatTextConfig, ResponseFormatTextJSONSchemaConfig]

def cast_responses_message_to_subtype(m_dict: dict) -> ResponsesMessage:
    """Cast a dictionary to one of the individual responses message types"""
    role = m_dict.get("role")
    if role == "system":
        return ResponsesSystemMessage(**m_dict)
    elif role == "user":
        return ResponsesUserMessage(**m_dict)
    elif role == "developer":
        return ResponsesDeveloperMessage(**m_dict)
    elif role == "assistant":
        return ResponsesAssistantMessage(**m_dict)
    elif role == "tool":
        return ResponsesToolMessage(**m_dict)
    else:
        raise ValueError(f"Unknown message role: {role}")

class ResponsesRequest(BaseModel):
    """OpenAI Responses API request schema
    
    Compatible with OpenAI's Responses API create endpoint.
    Equivalent functionality to ChatCompletionRequest but for Responses API.
    Based on: https://platform.openai.com/docs/api-reference/responses/create
    """
    
    model: str
    
    input: Union[ResponsesMessage, List[ResponsesMessage]] #input is either plain string for single message w assumed user role or conversation history
    
    # Optional parameters with equivalent functionality to ChatCompletionRequest
    instructions: Optional[str] = None  # equivalent to some stateful system message? mostly used for stateful i think
    conversation: Optional[List[Union[str, dict]]] = None  # equivalent to messages/conversation history for stateful -> can probably ignore or remove
    
    # Tool support (equivalent to ChatCompletionRequest tools)
    tools: Optional[List[ResponsesToolDefinition]] = None
    tool_choice: Optional[ResponsesToolChoice] = None
    
    # Response configuration (equivalent to ChatCompletionRequest)
    text: Optional[ResponsesFormat] = None
    max_output_tokens: Optional[int] = None  # equivalent to max_completion_tokens
    
    # inference parameters (equivalent to ChatCompletionRequest)
    temperature: Optional[float] = None
    top_p: Optional[float] = None
    top_logprobs: Optional[int] = None
    stream: Optional[bool] = False
    user: Optional[str] = None  # unique ID of the end-user (for monitoring) -> do we need this?
    
    # Responses API specific parameters
    background: Optional[bool] = False
    include: Optional[List[str]] = None  # e.g., ["reasoning.encrypted_content"]
    store: bool = Field(default=False, description="Always False - responses are not stored by default")
    metadata: Optional[Dict[str, Any]] = None
    
    # Reasoning parameters (for reasoning models, equivalent to reasoning_effort in ChatCompletionRequest)
    reasoning: Optional[Reasoning] = None  # e.g., ReasoningConfig(effort="high")

    #Verbosity weirdly goes under text
    #https://github.com/openai/openai-python/issues/2528
    # verbosity: Optional[Literal["low", "medium", "high"]] = None  # For verbosity control in GPT-5 models

    
    @field_validator("input", mode="before")
    @classmethod
    def validate_input(cls, v):
        """Validate and process input field"""
        if v is None:
            return v
        
        # If it's already a string, return as-is
        if isinstance(v, str):
            return v
            
        # If it's a list, ensure all items are proper content objects
        if isinstance(v, list):
            processed_items = []
            for item in v:
                if isinstance(item, dict):
                    # Convert dict to appropriate content type based on 'type' field
                    if item.get('type') == 'text':
                        processed_items.append(ResponsesInputTextContent(**item))
                    else:
                        # Default to text if no type specified but has text content
                        if 'text' in item:
                            processed_items.append(ResponsesInputTextContent(**item))
                        else:
                            processed_items.append(item)
                else:
                    processed_items.append(item)
            return processed_items
            
        return v
    
    @field_validator("conversation", mode="before")
    @classmethod
    def cast_all_conversation_messages(cls, v):
        if v is None:
            return v
        return [cast_responses_message_to_subtype(m) if isinstance(m, dict) else m for m in v]



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

# role user is assumed if input is just a string -> logic should be handled in client


# Testing Here



if __name__ == "__main__":
    import json
    from openai import OpenAI
    import os
    
    # Initialize OpenAI client
    # You can set your API key as an environment variable: export OPENAI_API_KEY="your-key-here"
    # Or pass it directly: client = OpenAI(api_key="your-key-here")
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
    def test_single_user_message(verbosity=None, reasoning_effort=None):
        """Test single user message with optional verbosity and reasoning effort"""
        print(f"\n=== Testing Single User Message (verbosity={verbosity}, reasoning_effort={reasoning_effort}) ===")
        
        # Build request parameters
        request_params = {
            "model": "gpt-4o",
            "input": "What is the capital of France?",
            "instructions": "Return your answer in French always"
        }
        
        if verbosity:
            request_params["verbosity"] = verbosity
        if reasoning_effort:
            request_params["reasoning"] = Reasoning(effort=reasoning_effort)
            
        try:
            request = ResponsesRequest(**request_params)
            print("Request Data:", json.dumps(request.model_dump(), indent=2))
            
            # Make actual API call to OpenAI responses endpoint
            response = client.responses.create(**request.model_dump())
            print("Response:", json.dumps(response.model_dump() if hasattr(response, 'model_dump') else dict(response), indent=2))
        except Exception as e:
            print(f"Error: {e}")
    
    def test_conversation_history(verbosity=None):
        """Test text-only conversation history"""
        print(f"\n=== Testing Conversation History (verbosity={verbosity}) ===")
        
        # Create conversation history using local schema types
        input = [
            ResponsesUserMessage(content="Hello, I need help with math"),
            ResponsesAssistantMessage(content="I'd be happy to help you with math! What specific topic are you working on?"),
            ResponsesUserMessage(content="I'm struggling with calculus derivatives"),
            ResponsesAssistantMessage(content="Derivatives can be tricky! Let's start with the basics. What's your current understanding of limits?")
        ]
        
        request_params = {
            "model": "gpt-4o",
            "input": input        }
        
        if verbosity:
            request_params["verbosity"] = verbosity
            
        try:
            request = ResponsesRequest(**request_params)
            print("Request Data:", json.dumps(request.model_dump(), indent=2))
            
            # Make actual API call to OpenAI responses endpoint
            response = client.responses.create(**request.model_dump())
            print("Response:", json.dumps(response.model_dump() if hasattr(response, 'model_dump') else dict(response), indent=2))
        except Exception as e:
            print(f"Error: {e}")
    
    def test_with_tools(reasoning_effort=None):
        """Test single user message with sample tools"""
        print(f"\n=== Testing with Tools (reasoning_effort={reasoning_effort}) ===")
        
        # Create tools using local schema
        tools = [
            ResponsesToolDefinition(
                type="function",
                name="get_weather",
                description="Get the current weather for a location",
                parameters={
                    "type": "object",
                    "properties": {
                        "location": {
                            "type": "string",
                            "description": "The city and state, e.g. San Francisco, CA"
                        }
                    },
                    "required": ["location"],
                    "additionalProperties": False
                }
            ),
            ResponsesToolDefinition(
                type="function",
                name="calculate",
                description="Perform mathematical calculations",
                parameters={
                    "type": "object", 
                    "properties": {
                        "expression": {
                            "type": "string",
                            "description": "Mathematical expression to evaluate"
                        }
                    },
                    "required": ["expression"],
                    "additionalProperties": False
                }
            )
        ]
        
        request_params = {
            "model": "gpt-4o",
            "input": "What's the weather like in New York and calculate 15 * 23 for me?",
            "tools": tools,
            "tool_choice": "auto"
        }
        
        if reasoning_effort:
            request_params["reasoning"] = Reasoning(effort=reasoning_effort)
        
        try:
            request = ResponsesRequest(**request_params)
            print("Request Data:", json.dumps(request.model_dump(), indent=2))
            
            # Make actual API call to OpenAI responses endpoint
            response = client.responses.create(**request.model_dump())
            print("Response:", json.dumps(response.model_dump() if hasattr(response, 'model_dump') else dict(response), indent=2))
        except Exception as e:
            print(f"Error: {e}")
    
    def test_reasoning_effort_levels():
        """Test different reasoning effort levels"""
        print(f"\n=== Testing Reasoning Effort Levels ===")
        
        reasoning_levels = ["minimal", "low", "medium", "high"]
        
        for effort in reasoning_levels:
            print(f"\n--- Testing reasoning_effort={effort} ---")
            test_single_user_message(reasoning_effort=effort)
    
    def test_verbosity_levels():
        """Test different verbosity levels"""
        print(f"\n=== Testing Verbosity Levels ===")
        
        verbosity_levels = ["low", "medium", "high"]
        
        for verbosity in verbosity_levels:
            print(f"\n--- Testing verbosity={verbosity} ---")
            test_single_user_message(verbosity=verbosity)
    
    def test_parameter_combinations():
        """Test combinations of different parameters"""
        print(f"\n=== Testing Parameter Combinations ===")
        
        # Test reasoning + tools
        print(f"\n--- Testing reasoning_effort=medium + tools ---")
        test_with_tools(reasoning_effort="medium")
        
        # Test conversation history
        print(f"\n--- Testing conversation history ---")
        test_conversation_history()
    
    def test_tool_calling_conversation():
        """Test conversation with tool calling"""
        print(f"\n=== Testing Tool Calling Conversation ===")
        
        # Create conversation with function calls and function call outputs
        input = [
            ResponsesUserMessage(content="What's the weather like in San Francisco?"),
            ResponsesAssistantMessage(content="I'll check the weather for you."),
            ResponsesToolCall(
                id="fc_abc123",
                call_id="call_abc123",
                type="function_call",
                name="get_weather",
                arguments='{"location": "San Francisco, CA"}',
                status="completed"
            ),
            ResponsesToolMessage(
                output='{"temperature": 72, "condition": "sunny", "humidity": 65}',
                call_id="call_abc123"
            ),
            ResponsesAssistantMessage(
                content="The weather in San Francisco is currently sunny with a temperature of 72°F and 65% humidity. It's a beautiful day!"
            )
        ]
        
        request_params = {
            "model": "gpt-4o",
            "input": input + [{"role": "user", "content": "What about in New York?"}],
            "tools": [
                ResponsesToolDefinition(
                    type="function",
                    name="get_weather",
                    description="Get current weather for a location",
                    parameters={
                        "type": "object",
                        "properties": {
                            "location": {
                                "type": "string",
                                "description": "City and state/country"
                            }
                        },
                        "required": ["location"],
                        "additionalProperties": False
                    }
                )
            ],
            "tool_choice": "auto"
        }
        
        try:
            request = ResponsesRequest(**request_params)
            print("Request Data:", json.dumps(request.model_dump(), indent=2))
            
            # Make actual API call to OpenAI responses endpoint
            response = client.responses.create(**request.model_dump())
            print("Response:", json.dumps(response.model_dump() if hasattr(response, 'model_dump') else dict(response), indent=2))
        except Exception as e:
            print(f"Error: {e}")
    
    # Run all tests
    print("Starting OpenAI Responses API Tests...")
    print("Make sure to set your OpenAI API key as OPENAI_API_KEY environment variable")
    print("or update the client initialization with your key.")
    
    # # Basic tests - start with simple ones
    # print("\n" + "="*50)
    test_single_user_message()
    
    # print("\n" + "="*50)
    test_conversation_history()
    
    # print("\n" + "="*50)
    test_with_tools()
    
    # Uncomment to test more advanced scenarios
    # print("\n" + "="*50)
    test_tool_calling_conversation()
    

    
    print("\n=== All tests completed ===")