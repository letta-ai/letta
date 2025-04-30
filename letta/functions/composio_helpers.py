import asyncio
import os
from typing import Any, Optional

from composio import ComposioToolSet
from composio.constants import DEFAULT_ENTITY_ID
from composio.exceptions import (
    ApiKeyNotProvidedError,
    ComposioSDKError,
    ConnectedAccountNotFoundError,
    EnumMetadataNotFound,
    EnumStringNotFound,
)

from letta.constants import COMPOSIO_ENTITY_ENV_VAR_KEY


# TODO: This is kind of hacky, as this is used to search up the action later on composio's side
# TODO: So be very careful changing/removing these pair of functions
def _generate_func_name_from_composio_action(action_name: str) -> str:
    """
    Generates the composio function name from the composio action.

    Args:
        action_name: The composio action name

    Returns:
        function name
    """
    return action_name.lower()


def generate_composio_action_from_func_name(func_name: str) -> str:
    """
    Generates the composio action from the composio function name.

    Args:
        func_name: The composio function name

    Returns:
        composio action name
    """
    return func_name.upper()


def generate_composio_tool_wrapper(action_name: str) -> tuple[str, str]:
    # Generate func name
    func_name = _generate_func_name_from_composio_action(action_name)

    wrapper_function_str = f"""\
def {func_name}(**kwargs):
    raise RuntimeError("Something went wrong - we should never be using the persisted source code for Composio. Please reach out to Letta team")
"""

    # Compile safety check
    _assert_code_gen_compilable(wrapper_function_str.strip())

    return func_name, wrapper_function_str.strip()


async def execute_composio_action_async(
    action_name: str, args: dict, api_key: Optional[str] = None, entity_id: Optional[str] = None
) -> tuple[str, str]:
    try:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, execute_composio_action, action_name, args, api_key, entity_id)
    except Exception as e:
        raise RuntimeError(f"Error in execute_composio_action_async: {e}") from e


def execute_composio_action(action_name: str, args: dict, api_key: Optional[str] = None, entity_id: Optional[str] = None) -> Any:
    entity_id = entity_id or os.getenv(COMPOSIO_ENTITY_ENV_VAR_KEY, DEFAULT_ENTITY_ID)
    try:
        composio_toolset = ComposioToolSet(api_key=api_key, entity_id=entity_id, lock=False)
        response = composio_toolset.execute_action(action=action_name, params=args)
    except ApiKeyNotProvidedError:
        raise RuntimeError(
            f"Composio API key is missing for action '{action_name}'. "
            "Please set the sandbox environment variables either through the ADE or the API."
        )
    except ConnectedAccountNotFoundError:
        raise RuntimeError(f"No connected account was found for action '{action_name}'. " "Please link an account and try again.")
    except EnumStringNotFound as e:
        raise RuntimeError(f"Invalid value provided for action '{action_name}': " + str(e) + ". Please check the action parameters.")
    except EnumMetadataNotFound as e:
        raise RuntimeError(f"Invalid value provided for action '{action_name}': " + str(e) + ". Please check the action parameters.")
    except ComposioSDKError as e:
        raise RuntimeError(f"An unexpected error occurred in Composio SDK while executing action '{action_name}': " + str(e))

    if "error" in response and response["error"]:
        raise RuntimeError(f"Error while executing action '{action_name}': " + str(response["error"]))

    return response.get("data")


def _assert_code_gen_compilable(code_str):
    try:
        compile(code_str, "<string>", "exec")
    except SyntaxError as e:
        print(f"Syntax error in code: {e}")
