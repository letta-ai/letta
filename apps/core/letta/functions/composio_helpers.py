import os
from typing import Any, Optional

from composio.constants import DEFAULT_ENTITY_ID
from composio.exceptions import (
    ApiKeyNotProvidedError,
    ComposioSDKError,
    ConnectedAccountNotFoundError,
    EnumMetadataNotFound,
    EnumStringNotFound,
)

from letta.constants import COMPOSIO_ENTITY_ENV_VAR_KEY
from letta.functions.async_composio_toolset import AsyncComposioToolSet
from letta.utils import run_async_task


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
    entity_id = entity_id or os.getenv(COMPOSIO_ENTITY_ENV_VAR_KEY, DEFAULT_ENTITY_ID)
    composio_toolset = AsyncComposioToolSet(api_key=api_key, entity_id=entity_id, lock=False)
    try:
        response = await composio_toolset.execute_action(action=action_name, params=args)
    except ApiKeyNotProvidedError as e:
        raise RuntimeError(f"API key not provided or invalid for Composio action '{action_name}': {str(e)}")
    except ConnectedAccountNotFoundError as e:
        raise RuntimeError(f"Connected account not found for Composio action '{action_name}': {str(e)}")
    except EnumMetadataNotFound as e:
        raise RuntimeError(f"Enum metadata not found for Composio action '{action_name}': {str(e)}")
    except EnumStringNotFound as e:
        raise RuntimeError(f"Enum string not found for Composio action '{action_name}': {str(e)}")
    except ComposioSDKError as e:
        raise RuntimeError(f"Composio SDK error while executing action '{action_name}': {str(e)}")
    except Exception as e:
        print(type(e))
        raise RuntimeError(f"An unexpected error occurred in Composio SDK while executing action '{action_name}': {str(e)}")

    if "error" in response and response["error"]:
        raise RuntimeError(f"Error while executing action '{action_name}': {str(response['error'])}")

    return response.get("data")


def execute_composio_action(action_name: str, args: dict, api_key: Optional[str] = None, entity_id: Optional[str] = None) -> Any:
    return run_async_task(execute_composio_action_async(action_name, args, api_key, entity_id))


def _assert_code_gen_compilable(code_str):
    try:
        compile(code_str, "<string>", "exec")
    except SyntaxError as e:
        print(f"Syntax error in code: {e}")
