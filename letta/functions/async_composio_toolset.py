import json
from typing import Any

import aiohttp
from composio import ComposioToolSet as BaseComposioToolSet
from composio.exceptions import (
    ApiKeyNotProvidedError,
    ComposioSDKError,
    ConnectedAccountNotFoundError,
    EnumMetadataNotFound,
    EnumStringNotFound,
)


class AsyncComposioToolSet(BaseComposioToolSet, runtime="letta", description_char_limit=1024):
    """
    Async version of ComposioToolSet client for interacting with Composio API
    Used to asynchronously hit the execute action endpoint

    https://docs.composio.dev/api-reference/api-reference/v3/tools/post-api-v-3-tools-execute-action
    """

    def __init__(self, api_key: str, entity_id: str, lock: bool = True):
        """
        Initialize the AsyncComposioToolSet client

        Args:
            api_key (str): Your Composio API key
            entity_id (str): Your Composio entity ID
            lock (bool): Whether to use locking (default: True)
        """
        super().__init__(api_key=api_key, entity_id=entity_id, lock=lock)

        self.headers = {
            "Content-Type": "application/json",
            "X-API-Key": self._api_key,
        }

    async def execute_action(
        self,
        action: str,
        params: dict[str, Any] = {},
    ) -> dict[str, Any]:
        """
        Execute an action asynchronously using the Composio API

        Args:
            action (str): The name of the action to execute
            params (dict[str, Any], optional): Parameters for the action

        Returns:
            dict[str, Any]: The API response

        Raises:
            ApiKeyNotProvidedError: if the API key is not provided
            ComposioSDKError: if a general Composio SDK error occurs
            ConnectedAccountNotFoundError: if the connected account is not found
            EnumMetadataNotFound: if enum metadata is not found
            EnumStringNotFound: if enum string is not found
            aiohttp.ClientError: if a network-related error occurs
            ValueError: if an error with the parameters or response occurs
        """
        API_VERSION = "v3"
        endpoint = f"{self._base_url}/{API_VERSION}/tools/execute/{action}"

        json_payload = {
            "entity_id": self.entity_id,
            "arguments": params or {},
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(endpoint, headers=self.headers, json=json_payload) as response:
                    print(response, response.status, response.reason, response.content)
                    if response.status == 200:
                        return await response.json()
                    else:
                        error_text = await response.text()
                        try:
                            error_json = json.loads(error_text)
                            error_message = error_json.get("message", error_text)
                            error_code = error_json.get("code")

                            # Handle specific error codes from Composio API
                            if error_code == 10401 or "API_KEY_NOT_FOUND" in error_message:
                                raise ApiKeyNotProvidedError()
                            if (
                                "connected account not found" in error_message.lower()
                                or "no connected account found" in error_message.lower()
                            ):
                                raise ConnectedAccountNotFoundError(f"Connected account not found: {error_message}")
                            if "enum metadata not found" in error_message.lower():
                                raise EnumMetadataNotFound(f"Enum metadata not found: {error_message}")
                            if "enum string not found" in error_message.lower():
                                raise EnumStringNotFound(f"Enum string not found: {error_message}")
                        except json.JSONDecodeError:
                            error_message = error_text

                        # If no specific error was identified, raise a general error
                        raise ValueError(f"API request failed with status {response.status}: {error_message}")
        except aiohttp.ClientError as e:
            # Wrap network errors in ComposioSDKError
            raise ComposioSDKError(f"Network error when calling Composio API: {str(e)}")
        except ValueError:
            # Re-raise ValueError (which could be our custom error message or a JSON parsing error)
            raise
        except Exception as e:
            # Catch any other exceptions and wrap them in ComposioSDKError
            raise ComposioSDKError(f"Unexpected error when calling Composio API: {str(e)}")
