import os
import sys
from pathlib import Path

# Add the root directory to the Python path
sys.path.append(str(Path(__file__).parent.parent))

from fastapi.testclient import TestClient
import pytest
from pydantic import ValidationError

from models.chat_completion_request import ChatCompletionRequest
from models.chat_completion_response import ChatCompletionResponse
from main import app  # Import the FastAPI app from your main.py
from utils import print_response_details


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_openai_chat_completion(client):
    assert os.getenv("OPENAI_API_KEY") is not None, "Set OPENAI_API_KEY for tests"

    request_payload = {
        "model": "memgpt-openai",
        "messages": [
            # ...populate this with the test data
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "What is the meaning of life? Give me an answer in 2 digits."},
        ],
    }

    try:
        # Validate the request payload
        validated_request = ChatCompletionRequest(**request_payload)
    except ValidationError as e:
        print("Validation error:", e)
        raise

    response = client.post("/chat/completions", json=request_payload)
    # print_response_details(response)

    response_json = response.json()
    print(response_json)
    try:
        # Validate the request payload
        validated_response = ChatCompletionResponse(**response_json)
    except ValidationError as e:
        print("Validation error:", e)
        raise

    assert response.status_code == 200

    response_message = validated_response.choices[0].message.content
    assert "42" in response_message, response_message

    # assert "id" in response.json()
    # assert response.json()["id"] == "mock_id_123"  # Example assertion
    # Add more assertions as needed to validate the response structure

    # Create a mock response
    # mock_message = ChatMessage(content="This is a mock response from the assistant.", role="assistant")
    # mock_choice = Choice(finish_reason="length", index=0, message=mock_message, logprobs=None)
    # mock_response = ChatCompletionResponse(
    #     id="mock_id_123",
    #     choices=[mock_choice],
    #     created=datetime.fromtimestamp(time.time()),
    #     model="gpt-3.5-mock",
    #     system_fingerprint="mock_fingerprint_123",
    #     object="chat.completion",
    #     usage=UsageStatistics(completion_tokens=10, prompt_tokens=5, total_tokens=15),
    # )


def test_free_endpoint_chat_completion(client):
    request_payload = {
        "model": "memgpt-vllm",
        "messages": [
            # ...populate this with the test data
            {"role": "system", "content": "You are a helpful assistant."},
            # {"role": "user", "content": "What is the meaning of life? Give me an answer in 2 digits."},
            {
                "role": "user",
                "content": "Use JSON schema to call the function send_message with params 'message' as 42, and use inner thoughts to think to yourself. Basically, do {'function': 'send_message', 'params': {'inner_thoughts': 'whatever you want', 'message': '42'}}}",
            },
        ],
        "functions": [],  # the local_llm chatcompletion proxy needs functions to be not None
    }

    try:
        # Validate the request payload
        validated_request = ChatCompletionRequest(**request_payload)
    except ValidationError as e:
        print("Validation error:", e)
        raise

    response = client.post("/chat/completions", json=request_payload)
    # print_response_details(response)

    response_json = response.json()
    print(response_json)
    try:
        # Validate the request payload
        validated_response = ChatCompletionResponse(**response_json)
    except ValidationError as e:
        print("Validation error:", e)
        raise

    assert response.status_code == 200

    response_message = validated_response.choices[0].message.content
    assert response_message is not None, "Inner thoughts missing"
    response_func = validated_response.choices[0].message.function_call
    assert response_func is not None, "Function call missing"
    assert "42" in response_message or "42" in response_func.arguments, response_message
