import asyncio
import copy
import difflib
import hashlib
import inspect
import io
import os
import pickle
import platform
import random
import re
import subprocess
import sys
import uuid
from collections.abc import Coroutine
from contextlib import contextmanager
from datetime import datetime, timezone
from functools import wraps
from logging import Logger
from typing import Any, Callable, Coroutine, Optional, Union, _GenericAlias, get_args, get_origin, get_type_hints
from urllib.parse import urljoin, urlparse

import demjson3 as demjson
import tiktoken
from pathvalidate import sanitize_filename as pathvalidate_sanitize_filename
from sqlalchemy import text

import letta
from letta.constants import (
    CORE_MEMORY_HUMAN_CHAR_LIMIT,
    CORE_MEMORY_PERSONA_CHAR_LIMIT,
    DEFAULT_CORE_MEMORY_SOURCE_CHAR_LIMIT,
    DEFAULT_MAX_FILES_OPEN,
    ERROR_MESSAGE_PREFIX,
    FILE_IS_TRUNCATED_WARNING,
    LETTA_DIR,
    MAX_FILENAME_LENGTH,
    TOOL_CALL_ID_MAX_LEN,
)
from letta.helpers.json_helpers import json_dumps, json_loads
from letta.log import get_logger
from letta.otel.tracing import log_attributes, trace_method
from letta.schemas.openai.chat_completion_response import ChatCompletionResponse
from letta.server.rest_api.dependencies import HeaderParams

logger = get_logger(__name__)


DEBUG = False
if "LOG_LEVEL" in os.environ:
    if os.environ["LOG_LEVEL"] == "DEBUG":
        DEBUG = True


ADJECTIVE_BANK = [
    "beautiful",
    "gentle",
    "angry",
    "vivacious",
    "grumpy",
    "luxurious",
    "fierce",
    "delicate",
    "fluffy",
    "radiant",
    "elated",
    "magnificent",
    "sassy",
    "ecstatic",
    "lustrous",
    "gleaming",
    "sorrowful",
    "majestic",
    "proud",
    "dynamic",
    "energetic",
    "mysterious",
    "loyal",
    "brave",
    "decisive",
    "frosty",
    "cheerful",
    "adorable",
    "melancholy",
    "vibrant",
    "elegant",
    "gracious",
    "inquisitive",
    "opulent",
    "peaceful",
    "rebellious",
    "scintillating",
    "dazzling",
    "whimsical",
    "impeccable",
    "meticulous",
    "resilient",
    "charming",
    "vivacious",
    "creative",
    "intuitive",
    "compassionate",
    "innovative",
    "enthusiastic",
    "tremendous",
    "effervescent",
    "tenacious",
    "fearless",
    "sophisticated",
    "witty",
    "optimistic",
    "exquisite",
    "sincere",
    "generous",
    "kindhearted",
    "serene",
    "amiable",
    "adventurous",
    "bountiful",
    "courageous",
    "diligent",
    "exotic",
    "grateful",
    "harmonious",
    "imaginative",
    "jubilant",
    "keen",
    "luminous",
    "nurturing",
    "outgoing",
    "passionate",
    "quaint",
    "resourceful",
    "sturdy",
    "tactful",
    "unassuming",
    "versatile",
    "wondrous",
    "youthful",
    "zealous",
    "ardent",
    "benevolent",
    "capricious",
    "dedicated",
    "empathetic",
    "fabulous",
    "gregarious",
    "humble",
    "intriguing",
    "jovial",
    "kind",
    "lovable",
    "mindful",
    "noble",
    "original",
    "pleasant",
    "quixotic",
    "reliable",
    "spirited",
    "tranquil",
    "unique",
    "venerable",
    "warmhearted",
    "xenodochial",
    "yearning",
    "zesty",
    "amusing",
    "blissful",
    "calm",
    "daring",
    "enthusiastic",
    "faithful",
    "graceful",
    "honest",
    "incredible",
    "joyful",
    "kind",
    "lovely",
    "merry",
    "noble",
    "optimistic",
    "peaceful",
    "quirky",
    "respectful",
    "sweet",
    "trustworthy",
    "understanding",
    "vibrant",
    "witty",
    "xenial",
    "youthful",
    "zealous",
    "ambitious",
    "brilliant",
    "careful",
    "devoted",
    "energetic",
    "friendly",
    "glorious",
    "humorous",
    "intelligent",
    "jovial",
    "knowledgeable",
    "loyal",
    "modest",
    "nice",
    "obedient",
    "patient",
    "quiet",
    "resilient",
    "selfless",
    "tolerant",
    "unique",
    "versatile",
    "warm",
    "xerothermic",
    "yielding",
    "zestful",
    "amazing",
    "bold",
    "charming",
    "determined",
    "exciting",
    "funny",
    "happy",
    "imaginative",
    "jolly",
    "keen",
    "loving",
    "magnificent",
    "nifty",
    "outstanding",
    "polite",
    "quick",
    "reliable",
    "sincere",
    "thoughtful",
    "unusual",
    "valuable",
    "wonderful",
    "xenodochial",
    "zealful",
    "admirable",
    "bright",
    "clever",
    "dedicated",
    "extraordinary",
    "generous",
    "hardworking",
    "inspiring",
    "jubilant",
    "kindhearted",
    "lively",
    "miraculous",
    "neat",
    "openminded",
    "passionate",
    "remarkable",
    "stunning",
    "truthful",
    "upbeat",
    "vivacious",
    "welcoming",
    "yare",
    "zealous",
]

NOUN_BANK = [
    "lizard",
    "firefighter",
    "banana",
    "castle",
    "dolphin",
    "elephant",
    "forest",
    "giraffe",
    "harbor",
    "iceberg",
    "jewelry",
    "kangaroo",
    "library",
    "mountain",
    "notebook",
    "orchard",
    "penguin",
    "quilt",
    "rainbow",
    "squirrel",
    "teapot",
    "umbrella",
    "volcano",
    "waterfall",
    "xylophone",
    "yacht",
    "zebra",
    "apple",
    "butterfly",
    "caterpillar",
    "dragonfly",
    "elephant",
    "flamingo",
    "gorilla",
    "hippopotamus",
    "iguana",
    "jellyfish",
    "koala",
    "lemur",
    "mongoose",
    "nighthawk",
    "octopus",
    "panda",
    "quokka",
    "rhinoceros",
    "salamander",
    "tortoise",
    "unicorn",
    "vulture",
    "walrus",
    "xenopus",
    "yak",
    "zebu",
    "asteroid",
    "balloon",
    "compass",
    "dinosaur",
    "eagle",
    "firefly",
    "galaxy",
    "hedgehog",
    "island",
    "jaguar",
    "kettle",
    "lion",
    "mammoth",
    "nucleus",
    "owl",
    "pumpkin",
    "quasar",
    "reindeer",
    "snail",
    "tiger",
    "universe",
    "vampire",
    "wombat",
    "xerus",
    "yellowhammer",
    "zeppelin",
    "alligator",
    "buffalo",
    "cactus",
    "donkey",
    "emerald",
    "falcon",
    "gazelle",
    "hamster",
    "icicle",
    "jackal",
    "kitten",
    "leopard",
    "mushroom",
    "narwhal",
    "opossum",
    "peacock",
    "quail",
    "rabbit",
    "scorpion",
    "toucan",
    "urchin",
    "viper",
    "wolf",
    "xray",
    "yucca",
    "zebu",
    "acorn",
    "biscuit",
    "cupcake",
    "daisy",
    "eyeglasses",
    "frisbee",
    "goblin",
    "hamburger",
    "icicle",
    "jackfruit",
    "kaleidoscope",
    "lighthouse",
    "marshmallow",
    "nectarine",
    "obelisk",
    "pancake",
    "quicksand",
    "raspberry",
    "spinach",
    "truffle",
    "umbrella",
    "volleyball",
    "walnut",
    "xylophonist",
    "yogurt",
    "zucchini",
    "asterisk",
    "blackberry",
    "chimpanzee",
    "dumpling",
    "espresso",
    "fireplace",
    "gnome",
    "hedgehog",
    "illustration",
    "jackhammer",
    "kumquat",
    "lemongrass",
    "mandolin",
    "nugget",
    "ostrich",
    "parakeet",
    "quiche",
    "racquet",
    "seashell",
    "tadpole",
    "unicorn",
    "vaccination",
    "wolverine",
    "yam",
    "zeppelin",
    "accordion",
    "broccoli",
    "carousel",
    "daffodil",
    "eggplant",
    "flamingo",
    "grapefruit",
    "harpsichord",
    "impression",
    "jackrabbit",
    "kitten",
    "llama",
    "mandarin",
    "nachos",
    "obelisk",
    "papaya",
    "quokka",
    "rooster",
    "sunflower",
    "turnip",
    "ukulele",
    "viper",
    "waffle",
    "xylograph",
    "yeti",
    "zephyr",
    "abacus",
    "blueberry",
    "crocodile",
    "dandelion",
    "echidna",
    "fig",
    "giraffe",
    "hamster",
    "iguana",
    "jackal",
    "kiwi",
    "lobster",
    "marmot",
    "noodle",
    "octopus",
    "platypus",
    "quail",
    "raccoon",
    "starfish",
    "tulip",
    "urchin",
    "vampire",
    "walrus",
    "xylophone",
    "yak",
    "zebra",
]


def smart_urljoin(base_url: str, relative_url: str) -> str:
    """urljoin is stupid and wants a trailing / at the end of the endpoint address, or it will chop the suffix off"""
    if not base_url.endswith("/"):
        base_url += "/"
    return urljoin(base_url, relative_url)


def get_tool_call_id() -> str:
    # TODO(sarah) make this a slug-style string?
    # e.g. OpenAI: "call_xlIfzR1HqAW7xJPa3ExJSg3C"
    # or similar to agents: "call-xlIfzR1HqAW7xJPa3ExJSg3C"
    return str(uuid.uuid4())[:TOOL_CALL_ID_MAX_LEN]


def assistant_function_to_tool(assistant_message: dict) -> dict:
    assert "function_call" in assistant_message
    new_msg = copy.deepcopy(assistant_message)
    function_call = new_msg.pop("function_call")
    new_msg["tool_calls"] = [
        {
            "id": get_tool_call_id(),
            "type": "function",
            "function": function_call,
        }
    ]
    return new_msg


def is_optional_type(hint):
    """Check if the type hint is an Optional type."""
    if isinstance(hint, _GenericAlias):
        return hint.__origin__ is Union and type(None) in hint.__args__
    return False


def enforce_types(func):
    """Enforces that values passed in match the expected types.
        Technically will handle coroutines as well.

    TODO (cliandy): use stricter pydantic fields
    """

    @wraps(func)
    def wrapper(*args, **kwargs):
        # Get type hints, excluding the return type hint
        hints = {k: v for k, v in get_type_hints(func).items() if k != "return"}

        # Get the function's argument names
        arg_names = inspect.getfullargspec(func).args

        # Pair each argument with its corresponding type hint
        args_with_hints = dict(zip(arg_names[1:], args[1:], strict=False))  # Skipping 'self'

        # Function to check if a value matches a given type hint
        def matches_type(value, hint):
            origin = get_origin(hint)
            args = get_args(hint)

            if origin is Union:  # Handle Union types (including Optional)
                return any(matches_type(value, arg) for arg in args)
            elif hasattr(hint, "__class__") and hint.__class__.__name__ == "UnionType":  # Handle Python 3.10+ X | Y syntax
                return any(matches_type(value, arg) for arg in args)
            elif origin is list and isinstance(value, list):  # Handle List[T]
                element_type = args[0] if args else None
                return all(isinstance(v, element_type) for v in value) if element_type else True
            elif origin is not None and (
                str(origin).endswith("Literal") or getattr(origin, "_name", None) == "Literal"
            ):  # Handle Literal types
                return value in args
            elif origin:  # Handle other generics like Dict, Tuple, etc.
                return isinstance(value, origin)
            else:  # Handle non-generic types
                return isinstance(value, hint)

        # Check types of arguments
        for arg_name, arg_value in args_with_hints.items():
            hint = hints.get(arg_name)
            if hint and not matches_type(arg_value, hint):
                raise ValueError(f"Argument {arg_name} does not match type {hint}; is {arg_value}")

        # Check types of keyword arguments
        for arg_name, arg_value in kwargs.items():
            hint = hints.get(arg_name)
            if hint and not matches_type(arg_value, hint):
                raise ValueError(f"Argument {arg_name} does not match type {hint}; is {arg_value} of type {type(arg_value)}")

        return func(*args, **kwargs)

    return wrapper


def annotate_message_json_list_with_tool_calls(messages: list[dict], allow_tool_roles: bool = False):
    """Add in missing tool_call_id fields to a list of messages using function call style

    Walk through the list forwards:
    - If we encounter an assistant message that calls a function ("function_call") but doesn't have a "tool_call_id" field
      - Generate the tool_call_id
    - Then check if the subsequent message is a role == "function" message
      - If so, then att
    """
    tool_call_index = None
    tool_call_id = None
    updated_messages = []

    for i, message in enumerate(messages):
        if "role" not in message:
            raise ValueError(f"message missing 'role' field:\n{message}")

        # If we find a function call w/o a tool call ID annotation, annotate it
        if message["role"] == "assistant" and "function_call" in message:
            if "tool_call_id" in message and message["tool_call_id"] is not None:
                printd("Message already has tool_call_id")
                tool_call_id = message["tool_call_id"]
            else:
                tool_call_id = str(uuid.uuid4())
                message["tool_call_id"] = tool_call_id
            tool_call_index = i

        # After annotating the call, we expect to find a follow-up response (also unannotated)
        elif message["role"] == "function":
            # We should have a new tool call id in the buffer
            if tool_call_id is None:
                # raise ValueError(
                print(
                    f"Got a function call role, but did not have a saved tool_call_id ready to use (i={i}, total={len(messages)}):\n{messages[:i]}\n{message}"
                )
                # allow a soft fail in this case
                message["tool_call_id"] = str(uuid.uuid4())
            elif "tool_call_id" in message:
                raise ValueError(
                    f"Got a function call role, but it already had a saved tool_call_id (i={i}, total={len(messages)}):\n{messages[:i]}\n{message}"
                )
            elif i != tool_call_index + 1:
                raise ValueError(
                    f"Got a function call role, saved tool_call_id came earlier than i-1 (i={i}, total={len(messages)}):\n{messages[:i]}\n{message}"
                )
            else:
                message["tool_call_id"] = tool_call_id
                tool_call_id = None  # wipe the buffer

        elif message["role"] == "assistant" and "tool_calls" in message and message["tool_calls"] is not None:
            if not allow_tool_roles:
                raise NotImplementedError(
                    f"tool_call_id annotation is meant for deprecated functions style, but got role 'assistant' with 'tool_calls' in message (i={i}, total={len(messages)}):\n{messages[:i]}\n{message}"
                )

            if len(message["tool_calls"]) != 1:
                raise NotImplementedError(
                    f"Got unexpected format for tool_calls inside assistant message (i={i}, total={len(messages)}):\n{messages[:i]}\n{message}"
                )

            assistant_tool_call = message["tool_calls"][0]
            if "id" in assistant_tool_call and assistant_tool_call["id"] is not None:
                printd("Message already has id (tool_call_id)")
                tool_call_id = assistant_tool_call["id"]
            else:
                tool_call_id = str(uuid.uuid4())
                message["tool_calls"][0]["id"] = tool_call_id
                # also just put it at the top level for ease-of-access
                # message["tool_call_id"] = tool_call_id
            tool_call_index = i

        elif message["role"] == "tool":
            if not allow_tool_roles:
                raise NotImplementedError(
                    f"tool_call_id annotation is meant for deprecated functions style, but got role 'tool' in message (i={i}, total={len(messages)}):\n{messages[:i]}\n{message}"
                )

            # if "tool_call_id" not in message or message["tool_call_id"] is None:
            # raise ValueError(f"Got a tool call role, but there's no tool_call_id:\n{messages[:i]}\n{message}")

            # We should have a new tool call id in the buffer
            if tool_call_id is None:
                # raise ValueError(
                print(
                    f"Got a tool call role, but did not have a saved tool_call_id ready to use (i={i}, total={len(messages)}):\n{messages[:i]}\n{message}"
                )
                # allow a soft fail in this case
                message["tool_call_id"] = str(uuid.uuid4())
            elif "tool_call_id" in message and message["tool_call_id"] is not None:
                if tool_call_id is not None and tool_call_id != message["tool_call_id"]:
                    # just wipe it
                    # raise ValueError(
                    #     f"Got a tool call role, but it already had a saved tool_call_id (i={i}, total={len(messages)}):\n{messages[:i]}\n{message}"
                    # )
                    message["tool_call_id"] = tool_call_id
                    tool_call_id = None  # wipe the buffer
                else:
                    tool_call_id = None
            elif i != tool_call_index + 1:
                raise ValueError(
                    f"Got a tool call role, saved tool_call_id came earlier than i-1 (i={i}, total={len(messages)}):\n{messages[:i]}\n{message}"
                )
            else:
                message["tool_call_id"] = tool_call_id
                tool_call_id = None  # wipe the buffer

        else:
            # eg role == 'user', nothing to do here
            pass

        updated_messages.append(copy.deepcopy(message))

    return updated_messages


def version_less_than(version_a: str, version_b: str) -> bool:
    """Compare versions to check if version_a is less than version_b."""
    # Regular expression to match version strings of the format int.int.int
    version_pattern = re.compile(r"^\d+\.\d+\.\d+$")

    # Assert that version strings match the required format
    if not version_pattern.match(version_a) or not version_pattern.match(version_b):
        raise ValueError("Version strings must be in the format 'int.int.int'")

    # Split the version strings into parts
    parts_a = [int(part) for part in version_a.split(".")]
    parts_b = [int(part) for part in version_b.split(".")]

    # Compare version parts
    return parts_a < parts_b


def create_random_username() -> str:
    """Generate a random username by combining an adjective and a noun."""
    adjective = random.choice(ADJECTIVE_BANK).capitalize()
    noun = random.choice(NOUN_BANK).capitalize()
    return adjective + noun


def verify_first_message_correctness(
    response: ChatCompletionResponse, require_send_message: bool = True, require_monologue: bool = False
) -> bool:
    """Can be used to enforce that the first message always uses send_message"""
    response_message = response.choices[0].message

    # First message should be a call to send_message with a non-empty content
    if (hasattr(response_message, "function_call") and response_message.function_call is not None) and (
        hasattr(response_message, "tool_calls") and response_message.tool_calls is not None
    ):
        printd(f"First message includes both function call AND tool call: {response_message}")
        return False
    elif hasattr(response_message, "function_call") and response_message.function_call is not None:
        function_call = response_message.function_call
    elif hasattr(response_message, "tool_calls") and response_message.tool_calls is not None:
        function_call = response_message.tool_calls[0].function
    else:
        printd(f"First message didn't include function call: {response_message}")
        return False

    function_name = function_call.name if function_call is not None else ""
    if require_send_message and function_name != "send_message" and function_name != "archival_memory_search":
        printd(f"First message function call wasn't send_message or archival_memory_search: {response_message}")
        return False

    if require_monologue and (not response_message.content or response_message.content is None or response_message.content == ""):
        printd(f"First message missing internal monologue: {response_message}")
        return False

    if response_message.content:
        ### Extras
        monologue = response_message.content

        def contains_special_characters(s):
            special_characters = '(){}[]"'
            return any(char in s for char in special_characters)

        if contains_special_characters(monologue):
            printd(f"First message internal monologue contained special characters: {response_message}")
            return False
        # if 'functions' in monologue or 'send_message' in monologue or 'inner thought' in monologue.lower():
        if "functions" in monologue or "send_message" in monologue:
            # Sometimes the syntax won't be correct and internal syntax will leak into message.context
            printd(f"First message internal monologue contained reserved words: {response_message}")
            return False

    return True


def is_valid_url(url):
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except ValueError:
        return False


@contextmanager
def suppress_stdout():
    """Used to temporarily stop stdout (eg for the 'MockLLM' message)"""
    new_stdout = io.StringIO()
    old_stdout = sys.stdout
    sys.stdout = new_stdout
    try:
        yield
    finally:
        sys.stdout = old_stdout


def open_folder_in_explorer(folder_path):
    """
    Opens the specified folder in the system's native file explorer.

    :param folder_path: Absolute path to the folder to be opened.
    """
    if not os.path.exists(folder_path):
        raise ValueError(f"The specified folder {folder_path} does not exist.")

    # Determine the operating system
    os_name = platform.system()

    # Open the folder based on the operating system
    if os_name == "Windows":
        # Windows: use 'explorer' command
        subprocess.run(["explorer", folder_path], check=True)
    elif os_name == "Darwin":
        # macOS: use 'open' command
        subprocess.run(["open", folder_path], check=True)
    elif os_name == "Linux":
        # Linux: use 'xdg-open' command (works for most Linux distributions)
        subprocess.run(["xdg-open", folder_path], check=True)
    else:
        raise OSError(f"Unsupported operating system {os_name}.")


# Custom unpickler
class OpenAIBackcompatUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        if module == "openai.openai_object":
            from letta.openai_backcompat.openai_object import OpenAIObject

            return OpenAIObject
        return super().find_class(module, name)


def count_tokens(s: str, model: str = "gpt-4") -> int:
    try:
        encoding = tiktoken.encoding_for_model(model)
    except KeyError:
        print("Falling back to cl100k base for token counting.")
        encoding = tiktoken.get_encoding("cl100k_base")
    return len(encoding.encode(s))


def printd(*args, **kwargs):
    if DEBUG:
        print(*args, **kwargs)


def united_diff(str1: str, str2: str) -> str:
    lines1 = str1.splitlines(True)
    lines2 = str2.splitlines(True)
    diff = difflib.unified_diff(lines1, lines2)
    return "".join(diff)


def parse_json(string) -> dict:
    """Parse JSON string into JSON with both json and demjson"""
    result = None
    try:
        result = json_loads(string)
        if not isinstance(result, dict):
            raise ValueError(f"JSON from string input ({string}) is not a dictionary (type {type(result)}): {result}")
        return result
    except Exception as e:
        print(f"Error parsing json with json package, falling back to demjson: {e}")

    try:
        result = demjson.decode(string)
        if not isinstance(result, dict):
            raise ValueError(f"JSON from string input ({string}) is not a dictionary (type {type(result)}): {result}")
        return result
    except demjson.JSONDecodeError as e:
        print(f"Error parsing json with demjson package (fatal): {e}")
        raise e


def validate_function_response(function_response: Any, return_char_limit: int, strict: bool = False, truncate: bool = True) -> str:
    """Check to make sure that a function used by Letta returned a valid response. Truncates to return_char_limit if necessary.

    This makes sure that we can coerce the function_response into a string that meets our criteria. We handle some soft coercion.
    If strict is True, we raise a ValueError if function_response is not a string or None.
    """
    if isinstance(function_response, str):
        function_response_string = function_response

    elif function_response is None:
        function_response_string = "None"

    elif strict:
        raise ValueError(f"Strict mode violation. Function returned type: {type(function_response).__name__}")

    elif isinstance(function_response, dict):
        # As functions can return arbitrary data, if there's already nesting somewhere in the response, it's difficult
        # for us to not result in double escapes.
        function_response_string = json_dumps(function_response)
    else:
        logger.debug(f"Function returned type {type(function_response).__name__}. Coercing to string.")
        function_response_string = str(function_response)

    # TODO we should change this to a max token limit that's variable based on tokens remaining (or context-window)
    if truncate and return_char_limit and len(function_response_string) > return_char_limit:
        logger.warning(f"function return was over limit ({len(function_response_string)} > {return_char_limit}) and was truncated")
        function_response_string = f"{function_response_string[:return_char_limit]}... [NOTE: function output was truncated since it exceeded the character limit ({len(function_response_string)} > {return_char_limit})]"

    return function_response_string


def list_agent_config_files(sort="last_modified"):
    """List all agent config files, ignoring dotfiles."""
    agent_dir = os.path.join(LETTA_DIR, "agents")
    files = os.listdir(agent_dir)

    # Remove dotfiles like .DS_Store
    files = [file for file in files if not file.startswith(".")]

    # Remove anything that's not a directory
    files = [file for file in files if os.path.isdir(os.path.join(agent_dir, file))]

    if sort is not None:
        if sort == "last_modified":
            # Sort the directories by last modified (most recent first)
            files.sort(key=lambda x: os.path.getmtime(os.path.join(agent_dir, x)), reverse=True)
        else:
            raise ValueError(f"Unrecognized sorting option {sort}")

    return files


def list_human_files():
    """List all humans files"""
    defaults_dir = os.path.join(letta.__path__[0], "humans", "examples")
    user_dir = os.path.join(LETTA_DIR, "humans")

    letta_defaults = os.listdir(defaults_dir)
    letta_defaults = [os.path.join(defaults_dir, f) for f in letta_defaults if f.endswith(".txt")]

    if os.path.exists(user_dir):
        user_added = os.listdir(user_dir)
        user_added = [os.path.join(user_dir, f) for f in user_added]
    else:
        user_added = []
    return letta_defaults + user_added


def list_persona_files():
    """List all personas files"""
    defaults_dir = os.path.join(letta.__path__[0], "personas", "examples")
    user_dir = os.path.join(LETTA_DIR, "personas")

    letta_defaults = os.listdir(defaults_dir)
    letta_defaults = [os.path.join(defaults_dir, f) for f in letta_defaults if f.endswith(".txt")]

    if os.path.exists(user_dir):
        user_added = os.listdir(user_dir)
        user_added = [os.path.join(user_dir, f) for f in user_added]
    else:
        user_added = []
    return letta_defaults + user_added


def get_human_text(name: str, enforce_limit=True):
    for file_path in list_human_files():
        file = os.path.basename(file_path)
        if f"{name}.txt" == file or name == file:
            with open(file_path, encoding="utf-8") as f:
                human_text = f.read().strip()
            if enforce_limit and len(human_text) > CORE_MEMORY_HUMAN_CHAR_LIMIT:
                raise ValueError(f"Contents of {name}.txt is over the character limit ({len(human_text)} > {CORE_MEMORY_HUMAN_CHAR_LIMIT})")
            return human_text

    raise ValueError(f"Human {name}.txt not found")


def get_persona_text(name: str, enforce_limit=True):
    for file_path in list_persona_files():
        file = os.path.basename(file_path)
        if f"{name}.txt" == file or name == file:
            with open(file_path, encoding="utf-8") as f:
                persona_text = f.read().strip()
            if enforce_limit and len(persona_text) > CORE_MEMORY_PERSONA_CHAR_LIMIT:
                raise ValueError(
                    f"Contents of {name}.txt is over the character limit ({len(persona_text)} > {CORE_MEMORY_PERSONA_CHAR_LIMIT})"
                )
            return persona_text

    raise ValueError(f"Persona {name}.txt not found")


def get_schema_diff(schema_a, schema_b):
    # Assuming f_schema and linked_function['json_schema'] are your JSON schemas
    f_schema_json = json_dumps(schema_a)
    linked_function_json = json_dumps(schema_b)

    # Compute the difference using difflib
    difference = list(difflib.ndiff(f_schema_json.splitlines(keepends=True), linked_function_json.splitlines(keepends=True)))

    # Filter out lines that don't represent changes
    difference = [line for line in difference if line.startswith("+ ") or line.startswith("- ")]

    return "".join(difference)


def create_uuid_from_string(val: str):
    """
    Generate consistent UUID from a string
    from: https://samos-it.com/posts/python-create-uuid-from-random-string-of-words.html
    """
    hex_string = hashlib.md5(val.encode("UTF-8")).hexdigest()
    return uuid.UUID(hex=hex_string)


def sanitize_filename(filename: str, add_uuid_suffix: bool = False) -> str:
    """
    Sanitize the given filename to prevent directory traversal, invalid characters,
    and reserved names while ensuring it fits within the maximum length allowed by the filesystem.

    Parameters:
        filename (str): The user-provided filename.
        add_uuid_suffix (bool): If True, adds a UUID suffix for uniqueness (legacy behavior).

    Returns:
        str: A sanitized filename.
    """
    # Extract the base filename to avoid directory components
    filename = os.path.basename(filename)

    # Split the base and extension
    base, ext = os.path.splitext(filename)

    # External sanitization library
    base = pathvalidate_sanitize_filename(base)

    # Cannot start with a period
    if base.startswith("."):
        raise ValueError(f"Invalid filename - derived file name {base} cannot start with '.'")

    if add_uuid_suffix:
        # Legacy behavior: Truncate the base name to fit within the maximum allowed length
        max_base_length = MAX_FILENAME_LENGTH - len(ext) - 33  # 32 for UUID + 1 for `_`
        if len(base) > max_base_length:
            base = base[:max_base_length]

        # Append a unique UUID suffix for uniqueness
        unique_suffix = uuid.uuid4().hex[:4]
        sanitized_filename = f"{base}_{unique_suffix}{ext}"
    else:
        max_base_length = MAX_FILENAME_LENGTH - len(ext)
        if len(base) > max_base_length:
            base = base[:max_base_length]

        sanitized_filename = f"{base}{ext}"

    # Return the sanitized filename
    return sanitized_filename


def get_friendly_error_msg(function_name: str, exception_name: str, exception_message: str):
    from letta.constants import MAX_ERROR_MESSAGE_CHAR_LIMIT

    error_msg = f"{ERROR_MESSAGE_PREFIX} executing function {function_name}: {exception_name}: {exception_message}"
    if len(error_msg) > MAX_ERROR_MESSAGE_CHAR_LIMIT:
        error_msg = error_msg[:MAX_ERROR_MESSAGE_CHAR_LIMIT]
    return error_msg


def parse_stderr_error_msg(stderr_txt: str, last_n_lines: int = 3) -> tuple[str, str]:
    """
    Parses out from the last `last_n_line` of `stderr_txt` the Exception type and message.
    """
    index = -(last_n_lines + 1)
    pattern = r"(\w+(?:Error|Exception)): (.+?)$"
    for line in stderr_txt.split("\n")[:index:-1]:
        if "Error" in line or "Exception" in line:
            match = re.search(pattern, line)
            if match:
                return match.group(1), match.group(2)
    return "", ""


def run_async_task(coro: Coroutine[Any, Any, Any]) -> Any:
    """
    Safely runs an asynchronous coroutine in a synchronous context.

    If an event loop is already running, it uses `asyncio.ensure_future`.
    Otherwise, it creates a new event loop and runs the coroutine.

    Args:
        coro: The coroutine to execute.

    Returns:
        The result of the coroutine.
    """
    try:
        # If there's already a running event loop, schedule the coroutine
        loop = asyncio.get_running_loop()
        return asyncio.run_until_complete(coro) if loop.is_closed() else asyncio.ensure_future(coro)
    except RuntimeError:
        # If no event loop is running, create a new one
        return asyncio.run(coro)


def log_telemetry(logger: Logger, event: str, **kwargs):
    """
    Logs telemetry events with a timestamp.

    :param logger: A logger
    :param event: A string describing the event.
    :param kwargs: Additional key-value pairs for logging metadata.
    """
    from letta.settings import log_settings

    if log_settings.verbose_telemetry_logging:
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S,%f UTC")  # More readable timestamp
        extra_data = " | ".join(f"{key}={value}" for key, value in kwargs.items() if value is not None)
        logger.info(f"[{timestamp}] EVENT: {event} | {extra_data}")


def make_key(*args, **kwargs):
    return str((args, tuple(sorted(kwargs.items()))))


# Global set to keep strong references to background tasks
_background_tasks: set = set()


def get_background_task_count() -> int:
    """Get the current number of background tasks for debugging/monitoring."""
    return len(_background_tasks)


@trace_method
def safe_create_task(coro, label: str = "background task"):
    async def wrapper():
        try:
            await coro
        except Exception as e:
            # Don't log RunCancelledException as an error - it's expected when streams are cancelled
            if e.__class__.__name__ == "RunCancelledException":
                logger.info(f"{label} was cancelled (RunCancelledException)")
                return
            logger.exception(f"{label} failed with {type(e).__name__}: {e}")

    task = asyncio.create_task(wrapper())

    # Add task to the set to maintain strong reference
    _background_tasks.add(task)

    # Log task count to trace
    log_attributes({"total_background_task_count": get_background_task_count()})

    # Remove task from set when done to prevent memory leaks
    task.add_done_callback(_background_tasks.discard)

    return task


@trace_method
def safe_create_task_with_return(coro, label: str = "background task"):
    async def wrapper():
        try:
            return await coro
        except Exception as e:
            logger.exception(f"{label} failed with {type(e).__name__}: {e}")
            raise

    task = asyncio.create_task(wrapper())

    # Add task to the set to maintain strong reference
    _background_tasks.add(task)

    # Log task count to trace
    log_attributes({"total_background_task_count": get_background_task_count()})

    # Remove task from set when done to prevent memory leaks
    task.add_done_callback(_background_tasks.discard)

    return task


def safe_create_shielded_task(coro, label: str = "shielded background task"):
    """
    Create a shielded background task that cannot be cancelled externally.

    This is useful for critical operations that must complete even if the
    parent operation is cancelled. The task is internally shielded but the
    returned task can still have callbacks added to it.
    """

    async def shielded_wrapper():
        try:
            # Shield the original coroutine to prevent cancellation
            result = await asyncio.shield(coro)
            return result
        except Exception as e:
            logger.exception(f"{label} failed with {type(e).__name__}: {e}")
            raise

    # Create the task with the shielded wrapper
    task = asyncio.create_task(shielded_wrapper())

    # Add task to the set to maintain strong reference
    _background_tasks.add(task)

    # Log task count to trace
    log_attributes({"total_background_task_count": get_background_task_count()})

    # Remove task from set when done to prevent memory leaks
    task.add_done_callback(_background_tasks.discard)

    return task


def safe_create_file_processing_task(coro, file_metadata, server, actor, logger: Logger, label: str = "file processing task"):
    """
    Create a task for file processing that updates file status on failure.

    This is a specialized version of safe_create_task that ensures file
    status is properly updated to ERROR with a meaningful message if the
    task fails.

    Args:
        coro: The coroutine to execute
        file_metadata: FileMetadata object being processed
        server: Server instance with file_manager
        actor: User performing the operation
        logger: Logger instance for error logging
        label: Description of the task for logging
    """
    from letta.schemas.enums import FileProcessingStatus

    async def wrapper():
        try:
            await coro
        except Exception as e:
            logger.exception(f"{label} failed for file {file_metadata.file_name} with {type(e).__name__}: {e}")
            # update file status to ERROR with a meaningful message
            try:
                await server.file_manager.update_file_status(
                    file_id=file_metadata.id,
                    actor=actor,
                    processing_status=FileProcessingStatus.ERROR,
                    error_message=f"Processing failed: {str(e)}" if str(e) else f"Processing failed: {type(e).__name__}",
                )
            except Exception as update_error:
                logger.error(f"Failed to update file status to ERROR for {file_metadata.id}: {update_error}")

    task = asyncio.create_task(wrapper())

    # Add task to the set to maintain strong reference
    _background_tasks.add(task)

    # Remove task from set when done to prevent memory leaks
    task.add_done_callback(_background_tasks.discard)

    return task


class CancellationSignal:
    """
    A signal that can be checked for cancellation during streaming operations.

    This provides a lightweight way to check if an operation should be cancelled
    without having to pass job managers and other dependencies through every method.
    """

    def __init__(self, job_manager=None, job_id=None, actor=None):
        from letta.log import get_logger
        from letta.schemas.user import User
        from letta.services.job_manager import JobManager

        self.job_manager: JobManager | None = job_manager
        self.job_id: str | None = job_id
        self.actor: User | None = actor
        self._is_cancelled = False
        self.logger = get_logger(__name__)

    async def is_cancelled(self) -> bool:
        """
        Check if the operation has been cancelled.

        Returns:
            True if cancelled, False otherwise
        """
        from letta.schemas.enums import JobStatus

        if self._is_cancelled:
            return True

        if not self.job_manager or not self.job_id or not self.actor:
            return False

        try:
            job = await self.job_manager.get_job_by_id_async(job_id=self.job_id, actor=self.actor)
            self._is_cancelled = job.status == JobStatus.cancelled
            return self._is_cancelled
        except Exception as e:
            self.logger.warning(f"Failed to check cancellation status for job {self.job_id}: {e}")
            return False

    def cancel(self):
        """Mark this signal as cancelled locally (for testing or direct cancellation)."""
        self._is_cancelled = True

    async def check_and_raise_if_cancelled(self):
        """
        Check for cancellation and raise CancelledError if cancelled.

        Raises:
            asyncio.CancelledError: If the operation has been cancelled
        """
        if await self.is_cancelled():
            self.logger.info(f"Operation cancelled for job {self.job_id}")
            raise asyncio.CancelledError(f"Job {self.job_id} was cancelled")


class NullCancellationSignal(CancellationSignal):
    """A null cancellation signal that is never cancelled."""

    def __init__(self):
        super().__init__()

    async def is_cancelled(self) -> bool:
        return False

    async def check_and_raise_if_cancelled(self):
        pass


async def get_latest_alembic_revision() -> str:
    """Get the current alembic revision ID from the alembic_version table."""
    from letta.server.db import db_registry

    try:
        async with db_registry.async_session() as session:
            result = await session.execute(text("SELECT version_num FROM alembic_version"))
            row = result.fetchone()

            if row:
                return row[0]
            else:
                return "unknown"

    except Exception as e:
        logger.error("Error getting latest alembic revision: %s", e)
        return "unknown"


def calculate_file_defaults_based_on_context_window(context_window: Optional[int]) -> tuple[int, int]:
    """Calculate reasonable defaults for max_files_open and per_file_view_window_char_limit
    based on the model's context window size.

    Args:
        context_window: The context window size of the model. If None, returns conservative defaults.

    Returns:
        A tuple of (max_files_open, per_file_view_window_char_limit)
    """
    if not context_window:
        # If no context window info, use conservative defaults
        return DEFAULT_MAX_FILES_OPEN, DEFAULT_CORE_MEMORY_SOURCE_CHAR_LIMIT

    # Define defaults based on context window ranges
    # Assuming ~4 chars per token
    # Available chars = available_tokens * 4

    # TODO: Check my math here
    if context_window <= 8_000:  # Small models (4K-8K)
        return 3, 5_000  # ~3.75K tokens
    elif context_window <= 32_000:  # Medium models (16K-32K)
        return 5, 15_000  # ~18.75K tokens
    elif context_window <= 128_000:  # Large models (100K-128K)
        return 10, 25_000  # ~62.5K tokens
    elif context_window <= 200_000:  # Very large models (128K-200K)
        return 10, 40_000  # ~100k tokens
    else:  # Extremely large models (200K+)
        return 15, 40_000  # ~1505k tokens


def truncate_file_visible_content(visible_content: str, is_open: bool, per_file_view_window_char_limit: int):
    visible_content = visible_content if visible_content and is_open else ""

    # Truncate content and add warnings here when converting from FileAgent to Block
    if len(visible_content) > per_file_view_window_char_limit:
        truncated_warning = f"...[TRUNCATED]\n{FILE_IS_TRUNCATED_WARNING}"
        visible_content = visible_content[: per_file_view_window_char_limit - len(truncated_warning)]
        visible_content += truncated_warning

    return visible_content


def fire_and_forget(coro, task_name: Optional[str] = None, error_callback: Optional[Callable[[Exception], None]] = None) -> asyncio.Task:
    """
    Execute an async coroutine in the background without waiting for completion.

    Args:
        coro: The coroutine to execute
        task_name: Optional name for logging purposes
        error_callback: Optional callback to execute if the task fails

    Returns:
        The created asyncio Task object
    """
    import traceback

    task = asyncio.create_task(coro)

    # Add task to the set to maintain strong reference
    _background_tasks.add(task)

    # Remove task from set when done to prevent memory leaks
    task.add_done_callback(_background_tasks.discard)

    def callback(t):
        try:
            t.result()  # this re-raises exceptions from the task
        except Exception as e:
            task_desc = f"Background task {task_name}" if task_name else "Background task"
            logger.exception(f"{task_desc} failed: {str(e)}")

            if error_callback:
                try:
                    error_callback(e)
                except Exception as callback_error:
                    logger.error(f"Error callback failed: {callback_error}")

    task.add_done_callback(callback)
    return task


def is_1_0_sdk_version(headers: HeaderParams):
    """
    Check if the SDK version is 1.0.0 or above.
    1. If sdk_version is provided from stainless (all stainless versions are 1.0.0+)
    2. If user_agent is provided and in the format
        @letta-ai/letta-client/version (node) or
        letta-client/version (python)
    """
    from letta.log import get_logger

    logger = get_logger(__name__)

    sdk_version = headers.sdk_version
    if sdk_version:
        return True

    client = headers.user_agent
    # None User-Agent might be like curl, which has no expectation of pinned behaviour etc.
    if not client:
        logger.debug("User-Agent header is None, assuming v1.0.0+")
        return True

    if "/" not in client:
        logger.debug(f"User-Agent '{client}' does not contain '/', assuming legacy SDK version")
        return False

    # Split into parts to validate format
    parts = client.split("/")

    # Should have at least 2 parts (client-name/version)
    if len(parts) < 2:
        return False

    if len(parts) == 3:
        # Format: @letta-ai/letta-client/version
        if parts[0] != "@letta-ai" or parts[1] != "letta-client":
            return False
    elif len(parts) == 2:
        # Format: letta-client/version
        if parts[0] != "letta-client":
            return False
    else:
        return False

    # Extract and validate version
    maybe_version = parts[-1]
    if "." not in maybe_version:
        return False

    # Extract major version (handle alpha/beta suffixes like 1.0.0-alpha.2 or 1.0.0a5)
    version_base = maybe_version.split("-")[0].split("a")[0].split("b")[0]
    if "." not in version_base:
        return False

    major_version = version_base.split(".")[0]
    return major_version == "1"
