import copy
import json
import logging
from collections import OrderedDict
from typing import Any, List, Optional, Union

import requests

from letta.constants import OPENAI_CONTEXT_WINDOW_ERROR_SUBSTRING
from letta.helpers.json_helpers import json_dumps
from letta.log import get_logger
from letta.schemas.message import Message
from letta.schemas.openai.chat_completion_response import ChatCompletionResponse, Choice
from letta.schemas.response_format import (
    JsonObjectResponseFormat,
    JsonSchemaResponseFormat,
    ResponseFormatType,
    ResponseFormatUnion,
    TextResponseFormat,
)
from letta.settings import summarizer_settings
from letta.utils import printd

logger = get_logger(__name__)


def _convert_to_structured_output_helper(property: dict) -> dict:
    """Convert a single JSON schema property to structured output format (recursive)"""

    # Handle anyOf structures
    if "anyOf" in property and "type" not in property:
        # Check if this is a simple anyOf that can be flattened to type array
        types = []
        has_complex = False
        for option in property["anyOf"]:
            if "type" in option:
                opt_type = option["type"]
                if opt_type in ["object", "array"]:
                    has_complex = True
                    break
                types.append(opt_type)
            elif "$ref" in option:
                # Has unresolved $ref, treat as complex
                has_complex = True
                break

        # If it's simple primitives only (string, null, integer, boolean, etc), flatten to type array
        if not has_complex and types:
            param_description = property.get("description")
            property_dict = {"type": types}
            if param_description is not None:
                property_dict["description"] = param_description
            if "default" in property:
                property_dict["default"] = property["default"]
            # Preserve other fields like enum, format, etc
            for key in ["enum", "format", "pattern", "minLength", "maxLength", "minimum", "maximum"]:
                if key in property:
                    property_dict[key] = property[key]
            return property_dict

        # Otherwise, preserve anyOf and recursively process each option
        property_dict = {"anyOf": [_convert_to_structured_output_helper(opt) for opt in property["anyOf"]]}
        if "description" in property:
            property_dict["description"] = property["description"]
        if "default" in property:
            property_dict["default"] = property["default"]
        if "title" in property:
            property_dict["title"] = property["title"]
        return property_dict

    if "type" not in property:
        raise ValueError(f"Property {property} is missing a type and doesn't have anyOf")

    param_type = property["type"]
    param_description = property.get("description")

    # Handle type arrays (e.g., ["string", "null"])
    if isinstance(param_type, list):
        property_dict = {"type": param_type}
        if param_description is not None:
            property_dict["description"] = param_description
        if "default" in property:
            property_dict["default"] = property["default"]
        # Preserve other fields
        for key in ["enum", "format", "pattern", "minLength", "maxLength", "minimum", "maximum", "title"]:
            if key in property:
                property_dict[key] = property[key]
        return property_dict

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
        if "title" in property:
            property_dict["title"] = property["title"]
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
        if "title" in property:
            property_dict["title"] = property["title"]
        return property_dict

    else:
        property_dict = {
            "type": param_type,  # simple type
        }
        if param_description is not None:
            property_dict["description"] = param_description
        # Preserve other fields
        for key in ["enum", "format", "pattern", "minLength", "maxLength", "minimum", "maximum", "default", "title"]:
            if key in property:
                property_dict[key] = property[key]
        return property_dict


def convert_to_structured_output(openai_function: dict, allow_optional: bool = False) -> dict:
    """Convert function call objects to structured output objects.

    See: https://platform.openai.com/docs/guides/structured-outputs/supported-schemas

    Supports:
    - Simple type arrays: type: ["string", "null"]
    - anyOf with primitives (flattened to type array)
    - anyOf with complex objects (preserved as anyOf)
    - Nested structures with recursion

    For OpenAI strict mode, optional fields (not in required) must have explicit default values.
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
        # Use the helper for all parameter types - it now handles anyOf, type arrays, objects, arrays, etc.
        structured_output["parameters"]["properties"][param] = _convert_to_structured_output_helper(details)

    # Determine which fields are required
    # For OpenAI strict mode, ALL fields must be in the required array
    # This is a requirement for strict: true schemas
    if not allow_optional:
        # All fields are required for strict mode
        structured_output["parameters"]["required"] = list(structured_output["parameters"]["properties"].keys())
    else:
        # Use the input's required list if provided, otherwise empty
        structured_output["parameters"]["required"] = openai_function["parameters"].get("required", [])

    return structured_output


def convert_response_format_to_responses_api(
    response_format: Optional["ResponseFormatUnion"],
) -> Optional[dict]:
    """
    Convert Letta's ResponseFormatUnion to OpenAI Responses API text.format structure.

    The Responses API uses a different structure than Chat Completions:
    text={
        "format": {
            "type": "json_schema",
            "name": "...",
            "strict": True,
            "schema": {...}
        }
    }

    Args:
        response_format: Letta ResponseFormatUnion object

    Returns:
        Dict with format structure for Responses API, or None
    """
    if response_format is None:
        return None

    # Text format - return None since it's the default
    if isinstance(response_format, TextResponseFormat):
        return None

    # JSON object format - not directly supported in Responses API
    # Users should use json_schema instead
    elif isinstance(response_format, JsonObjectResponseFormat):
        logger.warning(
            "json_object response format is not supported in Responses API. "
            "Use json_schema with a proper schema instead. Skipping response_format."
        )
        return None

    # JSON schema format - this is what Responses API supports
    elif isinstance(response_format, JsonSchemaResponseFormat):
        json_schema_dict = response_format.json_schema

        # Ensure required fields are present
        if "schema" not in json_schema_dict:
            logger.warning("json_schema missing 'schema' field, skipping response_format")
            return None

        return {
            "type": "json_schema",
            "name": json_schema_dict.get("name", "response_schema"),
            "schema": json_schema_dict["schema"],
            "strict": json_schema_dict.get("strict", True),  # Default to strict mode
        }


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
        raise ValueError("Unpacking inner thoughts from empty response not supported")

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
            logger.warning(f"Unpacking inner thoughts from more than one tool call ({len(message.tool_calls)}) is not supported")
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
                    logger.warning(f"Overwriting existing inner monologue ({new_choice.message.content}) with kwarg ({inner_thoughts})")
                new_choice.message.content = inner_thoughts

                # update the choice object
                rewritten_choice = new_choice
            else:
                logger.warning(f"Did not find inner thoughts in tool call: {str(tool_call)}")

        except json.JSONDecodeError as e:
            logger.warning(f"Failed to strip inner thoughts from kwargs: {e}")
            logger.error(f"Failed to strip inner thoughts from kwargs: {e}, Tool call arguments: {tool_call.function.arguments}")
            raise e
    else:
        logger.warning(f"Did not find tool call in message: {str(message)}")

    return rewritten_choice
