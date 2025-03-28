from typing import List, Optional, Tuple

import requests

from letta.utils import printd


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


def google_ai_get_model_details(base_url: str, api_key: str, model: str, key_in_header: bool = True) -> List[dict]:
    """
    Fetch details for a specific model from the Google AI API.
    """
    url, headers = get_gemini_endpoint_and_headers(base_url, model, api_key, key_in_header)

    try:
        response = requests.get(url, headers=headers)
        printd(f"response = {response}")
        response.raise_for_status()  # Raises HTTPError for 4XX/5XX status
        response = response.json()  # convert to dict from string
        printd(f"response.json = {response}")

        # Grab the models out
        return response

    except requests.exceptions.HTTPError as http_err:
        # Handle HTTP errors (e.g., response 4XX, 5XX)
        printd(f"Got HTTPError, exception={http_err}")
        # Print the HTTP status code
        print(f"HTTP Error: {http_err.response.status_code}")
        # Print the response content (error message from server)
        print(f"Message: {http_err.response.text}")
        raise http_err

    except requests.exceptions.RequestException as req_err:
        # Handle other requests-related errors (e.g., connection error)
        printd(f"Got RequestException, exception={req_err}")
        raise req_err

    except Exception as e:
        # Handle other potential errors
        printd(f"Got unknown Exception, exception={e}")
        raise e


def google_ai_get_model_context_window(base_url: str, api_key: str, model: str, key_in_header: bool = True) -> int:
    """
    Fetch the context window size for a specific model from the Google AI API.
    Assumes context window is the sum of input and output token limits.
    """
    model_details = google_ai_get_model_details(base_url, api_key, model, key_in_header)
    input_limit = model_details.get("inputTokenLimit", 0)
    output_limit = model_details.get("outputTokenLimit", 0)
    return int(input_limit + output_limit)  # Sum of input and output limits


def google_ai_get_model_list(base_url: str, api_key: str, key_in_header: bool = True) -> List[dict]:
    url, headers = get_gemini_endpoint_and_headers(base_url, None, api_key, key_in_header)

    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()  # Raises HTTPError for 4XX/5XX status
        response = response.json()  # convert to dict from string

        # Grab the models out
        model_list = response["models"]
        return model_list

    except requests.exceptions.HTTPError as http_err:
        # Handle HTTP errors (e.g., response 4XX, 5XX)
        printd(f"Got HTTPError, exception={http_err}")
        # Print the HTTP status code
        print(f"HTTP Error: {http_err.response.status_code}")
        # Print the response content (error message from server)
        print(f"Message: {http_err.response.text}")
        raise http_err

    except requests.exceptions.RequestException as req_err:
        # Handle other requests-related errors (e.g., connection error)
        printd(f"Got RequestException, exception={req_err}")
        raise req_err

    except Exception as e:
        # Handle other potential errors
        printd(f"Got unknown Exception, exception={e}")
        raise e
