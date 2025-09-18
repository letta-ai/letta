import json
from urllib.parse import urljoin

from letta.local_llm.settings.settings import get_completions_settings
from letta.local_llm.utils import post_json_auth_request
from letta.utils import count_tokens

LMSTUDIO_API_CHAT_SUFFIX = "/v1/chat/completions"
LMSTUDIO_API_COMPLETIONS_SUFFIX = "/v1/completions"
LMSTUDIO_API_CHAT_COMPLETIONS_SUFFIX = "/v1/chat/completions"


def get_lmstudio_completion_chatcompletions(endpoint, auth_type, auth_key, model, messages):
    """
    This is the request we need to send

    {
    "model": "deepseek-r1-distill-qwen-7b",
    "messages": [
      { "role": "system", "content": "Always answer in rhymes. Today is Thursday" },
      { "role": "user", "content": "What day is it today?" },
      { "role": "user", "content": "What day is it today?" }],
    "temperature": 0.7,
    "max_tokens": -1,
    "stream": false
    """
    from letta.utils import printd

    URI = endpoint + LMSTUDIO_API_CHAT_COMPLETIONS_SUFFIX
    request = {"model": model, "messages": messages}

    response = post_json_auth_request(uri=URI, json_payload=request, auth_type=auth_type, auth_key=auth_key)

    # Get the reasoning from the model
    if response.status_code == 200:
        result_full = response.json()
        result_reasoning = result_full["choices"][0]["message"].get("reasoning_content")
        result = result_full["choices"][0]["message"]["content"]
        usage = result_full["usage"]

    # See if result is json
    try:
        function_call = json.loads(result)
        if "function" in function_call and "params" in function_call:
            return result, usage, result_reasoning
        else:
            print("Did not get json on without json constraint, attempting with json decoding")
    except Exception as e:
        print(f"Did not get json on without json constraint, attempting with json decoding: {e}")

    request["messages"].append({"role": "assistant", "content": result_reasoning})
    request["messages"].append({"role": "user", "content": ""})  # last message must be user
    # Now run with json decoding to get the function
    request["response_format"] = {
        "type": "json_schema",
        "json_schema": {
            "name": "function_call",
            "strict": "true",
            "schema": {
                "type": "object",
                "properties": {"function": {"type": "string"}, "params": {"type": "object"}},
                "required": ["function", "params"],
            },
        },
    }

    response = post_json_auth_request(uri=URI, json_payload=request, auth_type=auth_type, auth_key=auth_key)
    if response.status_code == 200:
        result_full = response.json()
        printd(f"JSON API response:\n{result_full}")
        result = result_full["choices"][0]["message"]["content"]
        # add usage with previous call, merge with prev usage
        for key, value in result_full["usage"].items():
            usage[key] += value

    return result, usage, result_reasoning


def get_lmstudio_completion(endpoint, auth_type, auth_key, prompt, context_window, api="completions"):
    """Based on the example for using LM Studio as a backend from https://github.com/lmstudio-ai/examples/tree/main/Hello%2C%20world%20-%20OpenAI%20python%20client"""
    from letta.utils import printd

    prompt_tokens = count_tokens(prompt)
    if prompt_tokens > context_window:
        raise Exception(f"Request exceeds maximum context length ({prompt_tokens} > {context_window} tokens)")

    settings = get_completions_settings()
    settings.update(
        {
            "input_prefix": "",
            "input_suffix": "",
            # This controls how LM studio handles context overflow
            # In Letta we handle this ourselves, so this should be disabled
            # "context_overflow_policy": 0,
            # "lmstudio": {"context_overflow_policy": 0},  # 0 = stop at limit
            # "lmstudio": {"context_overflow_policy": "stopAtLimit"}, # https://github.com/letta-ai/letta/issues/1782
            "stream": False,
            "model": "local model",
        }
    )

    # Uses the ChatCompletions API style
    # Seems to work better, probably because it's applying some extra settings under-the-hood?
    if api == "chat":
        URI = urljoin(endpoint.strip("/") + "/", LMSTUDIO_API_CHAT_SUFFIX.strip("/"))

        # Settings for the generation, includes the prompt + stop tokens, max length, etc
        request = settings
        request["max_tokens"] = context_window

        # Put the entire completion string inside the first message
        message_structure = [{"role": "user", "content": prompt}]
        request["messages"] = message_structure

    # Uses basic string completions (string in, string out)
    # Does not work as well as ChatCompletions for some reason
    elif api == "completions":
        URI = urljoin(endpoint.strip("/") + "/", LMSTUDIO_API_COMPLETIONS_SUFFIX.strip("/"))

        # Settings for the generation, includes the prompt + stop tokens, max length, etc
        request = settings
        request["max_tokens"] = context_window

        # Standard completions format, formatted string goes in prompt
        request["prompt"] = prompt

    else:
        raise ValueError(api)

    if not endpoint.startswith(("http://", "https://")):
        raise ValueError(f"Provided OPENAI_API_BASE value ({endpoint}) must begin with http:// or https://")

    try:
        response = post_json_auth_request(uri=URI, json_payload=request, auth_type=auth_type, auth_key=auth_key)
        if response.status_code == 200:
            result_full = response.json()
            printd(f"JSON API response:\n{result_full}")
            if api == "chat":
                result = result_full["choices"][0]["message"]["content"]
                usage = result_full.get("usage", None)
            elif api == "completions":
                result = result_full["choices"][0]["text"]
                usage = result_full.get("usage", None)
            elif api == "chat/completions":
                result = result_full["choices"][0]["content"]
                result_full["choices"][0]["reasoning_content"]
                usage = result_full.get("usage", None)

        else:
            # Example error: msg={"error":"Context length exceeded. Tokens in context: 8000, Context length: 8000"}
            if "context length" in str(response.text).lower():
                # "exceeds context length" is what appears in the LM Studio error message
                # raise an alternate exception that matches OpenAI's message, which is "maximum context length"
                raise Exception(f"Request exceeds maximum context length (code={response.status_code}, msg={response.text}, URI={URI})")
            else:
                raise Exception(
                    f"API call got non-200 response code (code={response.status_code}, msg={response.text}) for address: {URI}."
                    + f" Make sure that the LM Studio local inference server is running and reachable at {URI}."
                )
    except:
        # TODO handle gracefully
        raise

    # Pass usage statistics back to main thread
    # These are used to compute memory warning messages
    completion_tokens = usage.get("completion_tokens", None) if usage is not None else None
    total_tokens = prompt_tokens + completion_tokens if completion_tokens is not None else None
    usage = {
        "prompt_tokens": prompt_tokens,  # can grab from usage dict, but it's usually wrong (set to 0)
        "completion_tokens": completion_tokens,
        "total_tokens": total_tokens,
    }

    return result, usage
