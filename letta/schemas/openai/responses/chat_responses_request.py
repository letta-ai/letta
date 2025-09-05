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

# role user is assumed if input is just a string -> logic should be handled in client


# Testing Here



if __name__ == "__main__":
    import json
    from openai import OpenAI
    
    # Initialize OpenAI client
    # You can set your API key as an environment variable: export OPENAI_API_KEY="your-key-here"
    # Or pass it directly: client = OpenAI(api_key="your-key-here")
    client = OpenAI(
        api_key=""
    )
    
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
                arguments='{"location": "San Francisco, CA"}'
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
    # test_single_user_message()
    
    # print("\n" + "="*50)
    # test_conversation_history()
    
    # print("\n" + "="*50)
    # test_with_tools()
    
    # Uncomment to test more advanced scenarios
    # print("\n" + "="*50)
    test_tool_calling_conversation()
    

    
    print("\n=== All tests completed ===")
