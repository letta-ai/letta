import copy
import json
import warnings
from collections import OrderedDict
from typing import Any, List, Union

import requests

from letta.constants import OPENAI_CONTEXT_WINDOW_ERROR_SUBSTRING
from letta.helpers.json_helpers import json_dumps
from letta.schemas.message import Message
from letta.schemas.openai.chat_completion_response import ChatCompletionResponse, Choice
from letta.settings import summarizer_settings
from letta.utils import count_tokens, printd


def _convert_to_structured_output_helper(property: dict) -> dict:
    """Convert a single JSON schema property to structured output format (recursive)"""

    if "type" not in property:
        raise ValueError(f"Property {property} is missing a type")
    param_type = property["type"]

    if "description" not in property:
        # raise ValueError(f"Property {property} is missing a description")
        param_description = None
    else:
        param_description = property["description"]

    if param_type == "object":
        if "properties" not in property:
            raise ValueError(f"Property {property} of type object is missing properties")
        properties = property["properties"]
        property_dict = {
            "type": "object",
            "properties": {k: _convert_to_structured_output_helper(v) for k, v in properties.items()},
            "additionalProperties": False,
            "required": list(properties.keys()),
        }
        if param_description is not None:
            property_dict["description"] = param_description
        return property_dict

    elif param_type == "array":
        if "items" not in property:
            raise ValueError(f"Property {property} of type array is missing items")
        items = property["items"]
        property_dict = {
            "type": "array",
            "items": _convert_to_structured_output_helper(items),
        }
        if param_description is not None:
            property_dict["description"] = param_description
        return property_dict

    else:
        property_dict = {
            "type": param_type,  # simple type
        }
        if param_description is not None:
            property_dict["description"] = param_description
        return property_dict


def convert_to_structured_output(openai_function: dict, allow_optional: bool = False) -> dict:
    """Convert function call objects to structured output objects.

    See: https://platform.openai.com/docs/guides/structured-outputs/supported-schemas
    """
    description = openai_function.get("description", "")

    structured_output = {
        "name": openai_function["name"],
        "description": description,
        "strict": True,
        "parameters": {
            "type": "object",
            "properties": {},
            "additionalProperties": False,
            "required": [],
        },
    }

    for param, details in openai_function["parameters"]["properties"].items():
        param_type = details["type"]
        param_description = details.get("description", "")

        if param_type == "object":
            if "properties" not in details:
                raise ValueError(f"Property {param} of type object is missing 'properties'")
            structured_output["parameters"]["properties"][param] = {
                "type": "object",
                "description": param_description,
                "properties": {k: _convert_to_structured_output_helper(v) for k, v in details["properties"].items()},
                "additionalProperties": False,
                "required": list(details["properties"].keys()),
            }

        elif param_type == "array":
            items_schema = details.get("items")
            prefix_items_schema = details.get("prefixItems")

            if prefix_items_schema:
                # assume fixed-length tuple — safe fallback to use first type for items
                fallback_item = prefix_items_schema[0] if isinstance(prefix_items_schema, list) else prefix_items_schema
                structured_output["parameters"]["properties"][param] = {
                    "type": "array",
                    "description": param_description,
                    "prefixItems": [_convert_to_structured_output_helper(item) for item in prefix_items_schema],
                    "items": _convert_to_structured_output_helper(fallback_item),
                    "minItems": details.get("minItems", len(prefix_items_schema)),
                    "maxItems": details.get("maxItems", len(prefix_items_schema)),
                }
            elif items_schema:
                structured_output["parameters"]["properties"][param] = {
                    "type": "array",
                    "description": param_description,
                    "items": _convert_to_structured_output_helper(items_schema),
                }
            else:
                raise ValueError(f"Array param '{param}' is missing both 'items' and 'prefixItems'")

        else:
            prop = {
                "type": param_type,
                "description": param_description,
            }
            if "enum" in details:
                prop["enum"] = details["enum"]
            structured_output["parameters"]["properties"][param] = prop

    if not allow_optional:
        structured_output["parameters"]["required"] = list(structured_output["parameters"]["properties"].keys())
    else:
        raise NotImplementedError("Optional parameter handling is not implemented.")

    return structured_output


def make_post_request(url: str, headers: dict[str, str], data: dict[str, Any]) -> dict[str, Any]:
    printd(f"Sending request to {url}")
    try:
        # Make the POST request
        response = requests.post(url, headers=headers, json=data)
        printd(f"Response status code: {response.status_code}")

        # Raise for 4XX/5XX HTTP errors
        response.raise_for_status()

        # Check if the response content type indicates JSON and attempt to parse it
        content_type = response.headers.get("Content-Type", "")
        if "application/json" in content_type.lower():
            try:
                response_data = response.json()  # Attempt to parse the response as JSON
                printd(f"Response JSON: {response_data}")
            except ValueError as json_err:
                # Handle the case where the content type says JSON but the body is invalid
                error_message = f"Failed to parse JSON despite Content-Type being {content_type}: {json_err}"
                printd(error_message)
                raise ValueError(error_message) from json_err
        else:
            error_message = f"Unexpected content type returned: {response.headers.get('Content-Type')}"
            printd(error_message)
            raise ValueError(error_message)

        # Process the response using the callback function
        return response_data

    except requests.exceptions.HTTPError as http_err:
        # HTTP errors (4XX, 5XX)
        error_message = f"HTTP error occurred: {http_err}"
        if http_err.response is not None:
            error_message += f" | Status code: {http_err.response.status_code}, Message: {http_err.response.text}"
        printd(error_message)
        raise requests.exceptions.HTTPError(error_message) from http_err

    except requests.exceptions.Timeout as timeout_err:
        # Handle timeout errors
        error_message = f"Request timed out: {timeout_err}"
        printd(error_message)
        raise requests.exceptions.Timeout(error_message) from timeout_err

    except requests.exceptions.RequestException as req_err:
        # Non-HTTP errors (e.g., connection, SSL errors)
        error_message = f"Request failed: {req_err}"
        printd(error_message)
        raise requests.exceptions.RequestException(error_message) from req_err

    except ValueError as val_err:
        # Handle content-type or non-JSON response issues
        error_message = f"ValueError: {val_err}"
        printd(error_message)
        raise ValueError(error_message) from val_err

    except Exception as e:
        # Catch any other unknown exceptions
        error_message = f"An unexpected error occurred: {e}"
        printd(error_message)
        raise Exception(error_message) from e


# TODO update to use better types
def add_inner_thoughts_to_functions(
    functions: List[dict],
    inner_thoughts_key: str,
    inner_thoughts_description: str,
    inner_thoughts_required: bool = True,
    put_inner_thoughts_first: bool = True,
) -> List[dict]:
    """Add an inner_thoughts kwarg to every function in the provided list, ensuring it's the first parameter"""
    new_functions = []
    for function_object in functions:
        new_function_object = copy.deepcopy(function_object)
        new_properties = OrderedDict()

        # For chat completions, we want inner thoughts to come later
        if put_inner_thoughts_first:
            # Create with inner_thoughts as the first item
            new_properties[inner_thoughts_key] = {
                "type": "string",
                "description": inner_thoughts_description,
            }
            # Add the rest of the properties
            new_properties.update(function_object["parameters"]["properties"])
        else:
            new_properties.update(function_object["parameters"]["properties"])
            new_properties[inner_thoughts_key] = {
                "type": "string",
                "description": inner_thoughts_description,
            }

        # Cast OrderedDict back to a regular dict
        new_function_object["parameters"]["properties"] = dict(new_properties)

        # Update required parameters if necessary
        if inner_thoughts_required:
            required_params = new_function_object["parameters"].get("required", [])
            if inner_thoughts_key not in required_params:
                if put_inner_thoughts_first:
                    required_params.insert(0, inner_thoughts_key)
                else:
                    required_params.append(inner_thoughts_key)
                new_function_object["parameters"]["required"] = required_params
        new_functions.append(new_function_object)

    return new_functions


def unpack_all_inner_thoughts_from_kwargs(
    response: ChatCompletionResponse,
    inner_thoughts_key: str,
) -> ChatCompletionResponse:
    """Strip the inner thoughts out of the tool call and put it in the message content"""
    if len(response.choices) == 0:
        raise ValueError(f"Unpacking inner thoughts from empty response not supported")

    new_choices = []
    for choice in response.choices:
        new_choices.append(unpack_inner_thoughts_from_kwargs(choice, inner_thoughts_key))

    # return an updated copy
    new_response = response.model_copy(deep=True)
    new_response.choices = new_choices
    return new_response


def unpack_inner_thoughts_from_kwargs(choice: Choice, inner_thoughts_key: str) -> Choice:
    message = choice.message
    rewritten_choice = choice  # inner thoughts unpacked out of the function

    if message.role == "assistant" and message.tool_calls and len(message.tool_calls) >= 1:
        if len(message.tool_calls) > 1:
            warnings.warn(f"Unpacking inner thoughts from more than one tool call ({len(message.tool_calls)}) is not supported")
        # TODO support multiple tool calls
        tool_call = message.tool_calls[0]

        try:
            # Sadly we need to parse the JSON since args are in string format
            func_args = dict(json.loads(tool_call.function.arguments))
            if inner_thoughts_key in func_args:
                # extract the inner thoughts
                inner_thoughts = func_args.pop(inner_thoughts_key)

                # replace the kwargs
                new_choice = choice.model_copy(deep=True)
                new_choice.message.tool_calls[0].function.arguments = json_dumps(func_args)
                # also replace the message content
                if new_choice.message.content is not None:
                    warnings.warn(f"Overwriting existing inner monologue ({new_choice.message.content}) with kwarg ({inner_thoughts})")
                new_choice.message.content = inner_thoughts

                # update the choice object
                rewritten_choice = new_choice
            else:
                warnings.warn(f"Did not find inner thoughts in tool call: {str(tool_call)}")

        except json.JSONDecodeError as e:
            warnings.warn(f"Failed to strip inner thoughts from kwargs: {e}")
            print(f"\nFailed to strip inner thoughts from kwargs: {e}")
            print(f"\nTool call arguments: {tool_call.function.arguments}")
            raise e
    else:
        warnings.warn(f"Did not find tool call in message: {str(message)}")

    return rewritten_choice


def calculate_summarizer_cutoff(in_context_messages: List[Message], token_counts: List[int], logger: "logging.Logger") -> int:
    if len(in_context_messages) != len(token_counts):
        raise ValueError(
            f"Given in_context_messages has different length from given token_counts: {len(in_context_messages)} != {len(token_counts)}"
        )

    in_context_messages_openai = [m.to_openai_dict() for m in in_context_messages]

    if summarizer_settings.evict_all_messages:
        logger.info("Evicting all messages...")
        return len(in_context_messages)
    else:
        # Start at index 1 (past the system message),
        # and collect messages for summarization until we reach the desired truncation token fraction (eg 50%)
        # We do the inverse of `desired_memory_token_pressure` to get what we need to remove
        desired_token_count_to_summarize = int(sum(token_counts) * (1 - summarizer_settings.desired_memory_token_pressure))
        logger.info(f"desired_token_count_to_summarize={desired_token_count_to_summarize}")

        tokens_so_far = 0
        cutoff = 0
        for i, msg in enumerate(in_context_messages_openai):
            # Skip system
            if i == 0:
                continue
            cutoff = i
            tokens_so_far += token_counts[i]

            if msg["role"] not in ["user", "tool", "function"] and tokens_so_far >= desired_token_count_to_summarize:
                # Break if the role is NOT a user or tool/function and tokens_so_far is enough
                break
            elif len(in_context_messages) - cutoff - 1 <= summarizer_settings.keep_last_n_messages:
                # Also break if we reached the `keep_last_n_messages` threshold
                # NOTE: This may be on a user, tool, or function in theory
                logger.warning(
                    f"Breaking summary cutoff early on role={msg['role']} because we hit the `keep_last_n_messages`={summarizer_settings.keep_last_n_messages}"
                )
                break

        # includes the tool response to be summarized after a tool call so we don't have any hanging tool calls after trimming.
        if i + 1 < len(in_context_messages_openai) and in_context_messages_openai[i + 1]["role"] == "tool":
            cutoff += 1

        logger.info(f"Evicting {cutoff}/{len(in_context_messages)} messages...")
        return cutoff + 1


def get_token_counts_for_messages(in_context_messages: List[Message]) -> List[int]:
    in_context_messages_openai = [m.to_openai_dict() for m in in_context_messages]
    token_counts = [count_tokens(str(msg)) for msg in in_context_messages_openai]
    return token_counts


def is_context_overflow_error(exception: Union[requests.exceptions.RequestException, Exception]) -> bool:
    """Checks if an exception is due to context overflow (based on common OpenAI response messages)"""
    from letta.utils import printd

    match_string = OPENAI_CONTEXT_WINDOW_ERROR_SUBSTRING

    # Backwards compatibility with openai python package/client v0.28 (pre-v1 client migration)
    if match_string in str(exception):
        printd(f"Found '{match_string}' in str(exception)={(str(exception))}")
        return True

    # Based on python requests + OpenAI REST API (/v1)
    elif isinstance(exception, requests.exceptions.HTTPError):
        if exception.response is not None and "application/json" in exception.response.headers.get("Content-Type", ""):
            try:
                error_details = exception.response.json()
                if "error" not in error_details:
                    printd(f"HTTPError occurred, but couldn't find error field: {error_details}")
                    return False
                else:
                    error_details = error_details["error"]

                # Check for the specific error code
                if error_details.get("code") == "context_length_exceeded":
                    printd(f"HTTPError occurred, caught error code {error_details.get('code')}")
                    return True
                # Soft-check for "maximum context length" inside of the message
                elif error_details.get("message") and "maximum context length" in error_details.get("message"):
                    printd(f"HTTPError occurred, found '{match_string}' in error message contents ({error_details})")
                    return True
                else:
                    printd(f"HTTPError occurred, but unknown error message: {error_details}")
                    return False
            except ValueError:
                # JSON decoding failed
                printd(f"HTTPError occurred ({exception}), but no JSON error message.")

    # Generic fail
    else:
        return False
