import datetime
import uuid
import time

# from models.chat_completion_response import ChatCompletionResponse, Choice, UsageStatistics
from memgpt.models.chat_completion_response import ChatCompletionResponse


def unpack_memgpt_llm_response(response: ChatCompletionResponse) -> ChatCompletionResponse:
    """Prepare a proxied request to get returned to the client"""

    # Overwrite anything we want here
    return response

    # TODO: may want to use response['id'] (from OpenAI) instead of UUID
    response_id = str(uuid.uuid4())
    response_object = "chat.completion"
    response_created = int(datetime.datetime.now().timestamp())
    response_model = response.model  # TODO do we want to include the true model used? or hide it via proxy?
    response_usage = response.usage
    response_system_fingerprint = "memgpt_hosted"  # TODO do we want to include real info?

    # Add the choice index if it's missing
    for idx, dict_item in enumerate(response.choices):
        # Add 'index' key only if it's not present
        if "index" not in dict_item:
            dict_item["index"] = idx
    print("RESPONSE.CHOICES", response.choices)
    response_choices = [Choice(**c) for c in response.choices]
    print("response_choices", response_choices)

    response = ChatCompletionResponse(
        id=response_id,
        choices=response_choices,
        created_at=response_created,
        model=response_model,
        system_fingerprint=response_system_fingerprint,
        object=response_object,
        usage=UsageStatistics(**response_usage),
    )
    return response


def print_response_details(response):
    print("URL:", response.url)
    print("Status Code:", response.status_code)
    # print("Reason:", response.reason)
    print("Headers:\n", response.headers)

    try:
        print("JSON Response:\n", response.json())
    except ValueError:
        print("Text Content:\n", response.text)

    print("Elapsed Time:", response.elapsed)
    print("Request Headers:\n", response.request.headers)
