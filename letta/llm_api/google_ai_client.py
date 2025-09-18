from typing import List, Optional, Tuple

import httpx
from google import genai
from google.genai.types import HttpOptions

from letta.errors import ErrorCode, LLMAuthenticationError, LLMError
from letta.llm_api.google_constants import GOOGLE_MODEL_FOR_API_KEY_CHECK
from letta.llm_api.google_vertex_client import GoogleVertexClient
from letta.log import get_logger
from letta.settings import model_settings, settings

logger = get_logger(__name__)


class GoogleAIClient(GoogleVertexClient):
    def _get_client(self):
        timeout_ms = int(settings.llm_request_timeout_seconds * 1000)
        return genai.Client(
            api_key=model_settings.gemini_api_key,
            http_options=HttpOptions(timeout=timeout_ms),
        )


def get_gemini_endpoint_and_headers(
    base_url: str, model: Optional[str], api_key: str, key_in_header: bool = True, generate_content: bool = False
) -> Tuple[str, dict]:
    """
    Dynamically generate the model endpoint and headers.
    """
    url = f"{base_url}/v1beta/models"

    # Add the model
    if model is not None:
        url += f"/{model}"

    # Add extension for generating content if we're hitting the LM
    if generate_content:
        url += ":generateContent"

    # Decide if api key should be in header or not
    # Two ways to pass the key: https://ai.google.dev/tutorials/setup
    if key_in_header:
        headers = {"Content-Type": "application/json", "x-goog-api-key": api_key}
    else:
        url += f"?key={api_key}"
        headers = {"Content-Type": "application/json"}

    return url, headers


def google_ai_check_valid_api_key(api_key: str):
    client = genai.Client(api_key=api_key)
    # use the count token endpoint for a cheap model - as of 5/7/2025 this is slightly faster than fetching the list of models
    try:
        client.models.count_tokens(
            model=GOOGLE_MODEL_FOR_API_KEY_CHECK,
            contents="",
        )
    except genai.errors.ClientError as e:
        # google api returns 400 invalid argument for invalid api key
        if e.code == 400:
            raise LLMAuthenticationError(message=f"Failed to authenticate with Google AI: {e}", code=ErrorCode.UNAUTHENTICATED)
        raise e
    except Exception as e:
        raise LLMError(message=f"{e}", code=ErrorCode.INTERNAL_SERVER_ERROR)


async def google_ai_get_model_list_async(
    base_url: str, api_key: str, key_in_header: bool = True, client: Optional[httpx.AsyncClient] = None
) -> List[dict]:
    """Asynchronous version to get model list from Google AI API using httpx."""
    from letta.utils import printd

    url, headers = get_gemini_endpoint_and_headers(base_url, None, api_key, key_in_header)

    # Determine if we need to close the client at the end
    close_client = False
    if client is None:
        client = httpx.AsyncClient()
        close_client = True

    try:
        response = await client.get(url, headers=headers)
        response.raise_for_status()  # Raises HTTPStatusError for 4XX/5XX status
        response_data = response.json()  # convert to dict from string

        # Grab the models out
        model_list = response_data["models"]
        return model_list

    except httpx.HTTPStatusError as http_err:
        # Handle HTTP errors (e.g., response 4XX, 5XX)
        printd(f"Got HTTPError, exception={http_err}")
        # Print the HTTP status code
        print(f"HTTP Error: {http_err.response.status_code}")
        # Print the response content (error message from server)
        print(f"Message: {http_err.response.text}")
        raise http_err

    except httpx.RequestError as req_err:
        # Handle other httpx-related errors (e.g., connection error)
        printd(f"Got RequestException, exception={req_err}")
        raise req_err

    except Exception as e:
        # Handle other potential errors
        printd(f"Got unknown Exception, exception={e}")
        raise e

    finally:
        # Close the client if we created it
        if close_client:
            await client.aclose()


def google_ai_get_model_details(base_url: str, api_key: str, model: str, key_in_header: bool = True) -> dict:
    """Synchronous version to get model details from Google AI API using httpx."""
    import httpx

    from letta.utils import printd

    url, headers = get_gemini_endpoint_and_headers(base_url, model, api_key, key_in_header)

    try:
        with httpx.Client() as client:
            response = client.get(url, headers=headers)
            printd(f"response = {response}")
            response.raise_for_status()  # Raises HTTPStatusError for 4XX/5XX status
            response_data = response.json()  # convert to dict from string
            printd(f"response.json = {response_data}")

            # Return the model details
            return response_data

    except httpx.HTTPStatusError as http_err:
        # Handle HTTP errors (e.g., response 4XX, 5XX)
        printd(f"Got HTTPError, exception={http_err}")
        # Print the HTTP status code
        print(f"HTTP Error: {http_err.response.status_code}")
        # Print the response content (error message from server)
        print(f"Message: {http_err.response.text}")
        raise http_err

    except httpx.RequestError as req_err:
        # Handle other httpx-related errors (e.g., connection error)
        printd(f"Got RequestException, exception={req_err}")
        raise req_err

    except Exception as e:
        # Handle other potential errors
        printd(f"Got unknown Exception, exception={e}")
        raise e


async def google_ai_get_model_details_async(
    base_url: str, api_key: str, model: str, key_in_header: bool = True, client: Optional[httpx.AsyncClient] = None
) -> dict:
    """Asynchronous version to get model details from Google AI API using httpx."""
    import httpx

    from letta.utils import printd

    url, headers = get_gemini_endpoint_and_headers(base_url, model, api_key, key_in_header)

    # Determine if we need to close the client at the end
    close_client = False
    if client is None:
        client = httpx.AsyncClient()
        close_client = True

    try:
        response = await client.get(url, headers=headers)
        printd(f"response = {response}")
        response.raise_for_status()  # Raises HTTPStatusError for 4XX/5XX status
        response_data = response.json()  # convert to dict from string
        printd(f"response.json = {response_data}")

        # Return the model details
        return response_data

    except httpx.HTTPStatusError as http_err:
        # Handle HTTP errors (e.g., response 4XX, 5XX)
        printd(f"Got HTTPError, exception={http_err}")
        # Print the HTTP status code
        print(f"HTTP Error: {http_err.response.status_code}")
        # Print the response content (error message from server)
        print(f"Message: {http_err.response.text}")
        raise http_err

    except httpx.RequestError as req_err:
        # Handle other httpx-related errors (e.g., connection error)
        printd(f"Got RequestException, exception={req_err}")
        raise req_err

    except Exception as e:
        # Handle other potential errors
        printd(f"Got unknown Exception, exception={e}")
        raise e

    finally:
        # Close the client if we created it
        if close_client:
            await client.aclose()


def google_ai_get_model_context_window(base_url: str, api_key: str, model: str, key_in_header: bool = True) -> int:
    model_details = google_ai_get_model_details(base_url=base_url, api_key=api_key, model=model, key_in_header=key_in_header)
    # TODO should this be:
    # return model_details["inputTokenLimit"] + model_details["outputTokenLimit"]
    return int(model_details["inputTokenLimit"])


async def google_ai_get_model_context_window_async(base_url: str, api_key: str, model: str, key_in_header: bool = True) -> int:
    model_details = await google_ai_get_model_details_async(base_url=base_url, api_key=api_key, model=model, key_in_header=key_in_header)
    # TODO should this be:
    # return model_details["inputTokenLimit"] + model_details["outputTokenLimit"]
    return int(model_details["inputTokenLimit"])
