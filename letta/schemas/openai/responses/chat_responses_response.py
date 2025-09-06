from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field, field_validator



'''
    {
      "type": "message",
      "id": "msg_67ccd3acc8d48190a77525dc6de64b4104becb25c45c1d41",
      "status": "completed",
      "role": "assistant",
      "content": [
        {
          "type": "output_text",
          "text": "The image depicts a scenic landscape with a wooden boardwalk or pathway leading through lush, green grass under a blue sky with some clouds. The setting suggests a peaceful natural area, possibly a park or nature reserve. There are trees and shrubs in the background.",
          "annotations": []
        }
      ]
    }
'''


class ResponsesTextContent(BaseModel):
    type: Literal["output_text"] = "output_text"
    text: str
    annotations: List[Any] = []

class ResponseTextMessage(BaseModel):
    type: Literal["message"] = "message"
    id: str
    status: Literal["completed", "in_progress","incomplete"]
    role: Literal["assistant"] = "assistant"
    content: List[ResponsesTextContent]

class ResponseFunctionCallMessage(BaseModel):
    type: Literal["function_call"] = "function_call"
    name: str
    arguments: str
    status: Literal["completed", "in_progress","incomplete"]
    call_id: str


class ResponseReasoningSummaryTextContent(BaseModel):
    type: Literal["summary_text"] = "summary_text"
    text: str

class ResponseReasoningTextContent(BaseModel):
    type: Literal["summary_text"] = "summary_text"
    text: str



class ResponseReasoningMessage(BaseModel):  
    type: Literal["reasoning"] = "reasoning"
    id: str
    content: List[ResponseReasoningTextContent]
    summary: List[ResponseReasoningSummaryTextContent]
    encrypted_content: Optional[str]
    status: Literal["completed", "in_progress","incomplete"]


class ResponseMCPToolDefinition(BaseModel):
    input_schema: Any #JSON Schema
    name: str
    annotations: Dict[str, Any]
    description: str


class ResponseMCPToolCallMessage(BaseModel):
    id: str
    name: str
    arguments: str # JSON String
    type: Literal["mcp_call"] = "mcp_call"
    server_label: str
    error: Optional[str]
    output: Optional[str]

class ResponseMCPListToolsMessage(BaseModel):
    id: str
    server_label: str
    tools: List[ResponseMCPToolDefinition]
    type: Literal["mcp_list_tools"] = "mcp_list_tools"
    error: Optional[str]



class ResponseCustomToolCallMessage(BaseModel):
    id: str
    call_id: str
    input: str
    arguments: str # JSON String
    type: Literal["custom_tool_call"] = "custom_tool_call"
    name: str



class ResponsesUsageInputTokenDetails(BaseModel):
    """Detailed breakdown of input tokens for Responses API"""
    cached_tokens: int = 0

    def __add__(self, other: "ResponsesUsageInputTokenDetails") -> "ResponsesUsageInputTokenDetails":
        return ResponsesUsageInputTokenDetails(
            cached_tokens=self.cached_tokens + other.cached_tokens,
        )


class ResponsesUsageOutputTokenDetails(BaseModel):
    """Detailed breakdown of output tokens for Responses API"""
    reasoning_tokens: int = 0

    def __add__(self, other: "ResponsesUsageOutputTokenDetails") -> "ResponsesUsageOutputTokenDetails":
        return ResponsesUsageOutputTokenDetails(
            reasoning_tokens=self.reasoning_tokens + other.reasoning_tokens,
        )

class ResponsesUsage(BaseModel):
    """Token usage details for OpenAI Responses API
    
    Represents token usage including input tokens, output tokens, 
    a breakdown of output tokens, and the total tokens used.
    Based on: https://platform.openai.com/docs/api-reference/responses/object#responses-object-usage
    """
    input_tokens: int = 0
    output_tokens: int = 0  
    total_tokens: int = 0

    input_tokens_details: Optional[ResponsesUsageInputTokenDetails] = None
    output_tokens_details: Optional[ResponsesUsageOutputTokenDetails] = None

    def __add__(self, other: "ResponsesUsage") -> "ResponsesUsage":
        if self.input_tokens_details is None and other.input_tokens_details is None:
            total_input_tokens_details = None
        elif self.input_tokens_details is None:
            total_input_tokens_details = other.input_tokens_details
        elif other.input_tokens_details is None:
            total_input_tokens_details = self.input_tokens_details
        else:
            total_input_tokens_details = self.input_tokens_details + other.input_tokens_details

        if self.output_tokens_details is None and other.output_tokens_details is None:
            total_output_tokens_details = None
        elif self.output_tokens_details is None:
            total_output_tokens_details = other.output_tokens_details
        elif other.output_tokens_details is None:
            total_output_tokens_details = self.output_tokens_details
        else:
            total_output_tokens_details = self.output_tokens_details + other.output_tokens_details

        return ResponsesUsage(
            input_tokens=self.input_tokens + other.input_tokens,
            output_tokens=self.output_tokens + other.output_tokens,
            total_tokens=self.total_tokens + other.total_tokens,
            input_tokens_details=total_input_tokens_details,
            output_tokens_details=total_output_tokens_details,
        )

ResponsesOutputMessage = Union[ResponseTextMessage, ResponseFunctionCallMessage, ResponseReasoningMessage, ResponseMCPToolCallMessage, ResponseMCPListToolsMessage, ResponseCustomToolCallMessage]

class ResponsesResponse(BaseModel):
    """OpenAI Responses API Response Schema
    Based on: https://platform.openai.com/docs/api-reference/responses/object
    """
    created_at: int
    error: Optional[Union[Any, None]]
    id: str
    incomplete_details: Optional[Union[Any, None]]
    instructions: Optional[Union[str, None]]
    max_output_tokens: Optional[Union[int, None]]
    max_tool_calls: Optional[Union[int, None]]
    metadata: Dict[Any, Any] = {} # not marked as optional
    model: str
    object: Literal["response"] = "response"

    #TODO add all text + tool calling + reasoning type definitions
    output: List[ResponsesOutputMessage] # listof all possible output typs
    parallel_tool_calls: bool = False
    reasoning: Optional[Dict[str, str | None]]
    status: Literal["completed", "failed", "in_progress", "cancelled", "queued", "incomplete"]
    
    # Add usage field to match OpenAI Responses API
    usage: Optional[ResponsesUsage] = None


if __name__ == "__main__":
    import json
    import os
    from openai import OpenAI
    
    # Test our ResponsesResponse class with a real OpenAI Responses API call
    print("Testing ResponsesResponse class with OpenAI Responses API...")
    

    client = OpenAI(api_key= os.getenv("OPENAI_API_KEY"))
    
    try:
        # Make a simple responses API call
        print("Making OpenAI Responses API call...")
        response = client.responses.create(
            model="gpt-4o",
            input="What is the capital of France?",
            instructions="Respond briefly and clearly."
        )
        
        # Convert response to dict
        response_dict = response.model_dump() if hasattr(response, 'model_dump') else dict(response)
        print("Raw API Response:")
        print(json.dumps(response_dict, indent=2))
        print()
        
        # Test our ResponsesResponse class
        print("Parsing with our ResponsesResponse class...")
        parsed_response = ResponsesResponse(**response_dict)
        
        print("Successfully parsed! Our ResponsesResponse object:")
        print(json.dumps(parsed_response.model_dump(), indent=2))
        print()
        
        # Print key details
        print("Key Response Details:")
        print(f"ID: {parsed_response.id}")
        print(f"Model: {parsed_response.model}")
        print(f"Status: {parsed_response.status}")
        
        if parsed_response.usage:
            print(f"Usage - Input Tokens: {parsed_response.usage.input_tokens}")
            print(f"Usage - Output Tokens: {parsed_response.usage.output_tokens}")
            print(f"Usage - Total Tokens: {parsed_response.usage.total_tokens}")
            
            if parsed_response.usage.input_tokens_details:
                print(f"Usage - Cached Tokens: {parsed_response.usage.input_tokens_details.cached_tokens}")
            
            if parsed_response.usage.output_tokens_details:
                print(f"Usage - Reasoning Tokens: {parsed_response.usage.output_tokens_details.reasoning_tokens}")
        
        print("\n✅ SUCCESS: ResponsesResponse class works correctly!")
        
    except Exception as e:
        print(f"❌ ERROR: {e}")
        print("This could be due to:")
        print("1. Invalid API key")
        print("2. Network issues")
        print("3. Schema mismatch between our class and OpenAI's response")
        print("4. OpenAI API changes") 



