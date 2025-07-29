import json
import warnings
from typing import Optional

from .constants import (
    INITIAL_BOOT_MESSAGE,
    INITIAL_BOOT_MESSAGE_SEND_MESSAGE_FIRST_MSG,
    INITIAL_BOOT_MESSAGE_SEND_MESSAGE_THOUGHT,
    MESSAGE_SUMMARY_WARNING_STR,
)
from .helpers.datetime_helpers import get_local_time
from .helpers.json_helpers import json_dumps


def get_initial_boot_messages(version, timezone, tool_call_id):
    if version == "startup":
        initial_boot_message = INITIAL_BOOT_MESSAGE
        messages = [
            {"role": "assistant", "content": initial_boot_message},
        ]

    elif version == "startup_with_send_message":
        messages = [
            # first message includes both inner monologue and function call to send_message
            {
                "role": "assistant",
                "content": INITIAL_BOOT_MESSAGE_SEND_MESSAGE_THOUGHT,
                # "function_call": {
                #     "name": "send_message",
                #     "arguments": '{\n  "message": "' + f"{INITIAL_BOOT_MESSAGE_SEND_MESSAGE_FIRST_MSG}" + '"\n}',
                # },
                "tool_calls": [
                    {
                        "id": tool_call_id,
                        "type": "function",
                        "function": {
                            "name": "send_message",
                            "arguments": '{\n  "message": "' + f"{INITIAL_BOOT_MESSAGE_SEND_MESSAGE_FIRST_MSG}" + '"\n}',
                        },
                    }
                ],
            },
            # obligatory function return message
            {
                # "role": "function",
                "role": "tool",
                "name": "send_message",  # NOTE: technically not up to spec, this is old functions style
                "content": package_function_response(True, None, timezone),
                "tool_call_id": tool_call_id,
            },
        ]

    elif version == "startup_with_send_message_gpt35":
        messages = [
            # first message includes both inner monologue and function call to send_message
            {
                "role": "assistant",
                "content": "*inner thoughts* Still waiting on the user. Sending a message with function.",
                # "function_call": {"name": "send_message", "arguments": '{\n  "message": "' + f"Hi, is anyone there?" + '"\n}'},
                "tool_calls": [
                    {
                        "id": tool_call_id,
                        "type": "function",
                        "function": {
                            "name": "send_message",
                            "arguments": '{\n  "message": "' + "Hi, is anyone there?" + '"\n}',
                        },
                    }
                ],
            },
            # obligatory function return message
            {
                # "role": "function",
                "role": "tool",
                "name": "send_message",
                "content": package_function_response(True, None, timezone),
                "tool_call_id": tool_call_id,
            },
        ]

    else:
        raise ValueError(version)

    return messages


def get_heartbeat(timezone, reason: str = "Automated timer", include_location: bool = False, location_name: str = "San Francisco, CA, USA"):
    # Package the message with time and location
    formatted_time = get_local_time(timezone=timezone)
    packaged_message = {
        "type": "heartbeat",
        "reason": reason,
        "time": formatted_time,
    }

    if include_location:
        packaged_message["location"] = location_name

    return json_dumps(packaged_message)


def get_login_event(timezone, last_login="Never (first login)", include_location=False, location_name="San Francisco, CA, USA"):
    # Package the message with time and location
    formatted_time = get_local_time(timezone=timezone)
    packaged_message = {
        "type": "login",
        "last_login": last_login,
        "time": formatted_time,
    }

    if include_location:
        packaged_message["location"] = location_name

    return json_dumps(packaged_message)


def package_user_message(
    user_message: str,
    timezone: str,
    include_location: bool = False,
    location_name: Optional[str] = "San Francisco, CA, USA",
    name: Optional[str] = None,
):
    # Package the message with time and location
    formatted_time = get_local_time(timezone=timezone)
    packaged_message = {
        "type": "user_message",
        "message": user_message,
        "time": formatted_time,
    }

    if include_location:
        packaged_message["location"] = location_name

    if name:
        packaged_message["name"] = name

    return json_dumps(packaged_message)


def package_function_response(was_success: bool, response_string: str, timezone: str | None) -> str:
    formatted_time = get_local_time(timezone=timezone)
    packaged_message = {
        "status": "OK" if was_success else "Failed",
        "message": response_string,
        "time": formatted_time,
    }

    return json_dumps(packaged_message)


def package_system_message(system_message, timezone, message_type="system_alert"):
    # error handling for recursive packaging
    try:
        message_json = json.loads(system_message)
        if "type" in message_json and message_json["type"] == message_type:
            warnings.warn(f"Attempted to pack a system message that is already packed. Not packing: '{system_message}'")
            return system_message
    except:
        pass  # do nothing, expected behavior that the message is not JSON

    formatted_time = get_local_time(timezone=timezone)
    packaged_message = {
        "type": message_type,
        "message": system_message,
        "time": formatted_time,
    }

    return json.dumps(packaged_message)


def package_summarize_message(summary, summary_message_count, hidden_message_count, total_message_count, timezone):
    context_message = (
        f"Note: prior messages ({hidden_message_count} of {total_message_count} total messages) have been hidden from view due to conversation memory constraints.\n"
        + f"The following is a summary of the previous {summary_message_count} messages:\n {summary}"
    )

    formatted_time = get_local_time(timezone=timezone)
    packaged_message = {
        "type": "system_alert",
        "message": context_message,
        "time": formatted_time,
    }

    return json_dumps(packaged_message)


def package_summarize_message_no_counts(summary, timezone):
    context_message = (
        f"Note: prior messages have been hidden from view due to conversation memory constraints.\n"
        + f"The following is a summary of the previous messages:\n {summary}"
    )

    formatted_time = get_local_time(timezone=timezone)
    packaged_message = {
        "type": "system_alert",
        "message": context_message,
        "time": formatted_time,
    }

    return json_dumps(packaged_message)


def package_summarize_message_no_summary(hidden_message_count, message=None, timezone=None):
    """Add useful metadata to the summary message"""

    # Package the message with time and location
    formatted_time = get_local_time(timezone=timezone)
    context_message = (
        message
        if message
        else f"Note: {hidden_message_count} prior messages with the user have been hidden from view due to conversation memory constraints. Older messages are stored in Recall Memory and can be viewed using functions."
    )
    packaged_message = {
        "type": "system_alert",
        "message": context_message,
        "time": formatted_time,
    }

    return json_dumps(packaged_message)


def get_token_limit_warning():
    formatted_time = get_local_time()
    packaged_message = {
        "type": "system_alert",
        "message": MESSAGE_SUMMARY_WARNING_STR,
        "time": formatted_time,
    }

    return json_dumps(packaged_message)


def unpack_message(packed_message: str) -> str:
    """Take a packed message string and attempt to extract the inner message content"""

    try:
        message_json = json.loads(packed_message)
        if type(message_json) is not dict:
            return packed_message
    except:
        return packed_message

    if "message" not in message_json:
        if "type" in message_json and message_json["type"] in ["login", "heartbeat"]:
            # This is a valid user message that the ADE expects, so don't print warning
            return packed_message
        warnings.warn(f"Was unable to find 'message' field in packed message object: '{packed_message}'")
        return packed_message
    else:
        message_type = message_json["type"]
        if message_type != "user_message":
            warnings.warn(f"Expected type to be 'user_message', but was '{message_type}', so not unpacking: '{packed_message}'")
            return packed_message
        return message_json.get("message")
