import json
import os
from typing import Optional

import requests

from letta.log import get_logger
from letta.utils import smart_urljoin

logger = get_logger(__name__)


def litellm_get_models_prices_and_context_window() -> dict[str, dict]:
    """Reads model prices and context window data from a local JSON file."""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(current_dir, "model_prices_and_context_window.json")
    try:
        with open(file_path, "r") as f:
            data = json.load(f)
        return data
    except FileNotFoundError:
        logger.error(f"Error: The file {file_path} was not found.")
        return {}
    except json.JSONDecodeError:
        logger.error(f"Error: Could not decode JSON from the file {file_path}.")
        return {}
    except Exception as e:
        logger.error(f"An unexpected error occurred: {e}")
        return {}


def litellm_pull_models_prices_and_context_window(
    url: str = "https://raw.githubusercontent.com/BerriAI/litellm/refs/heads/main/model_prices_and_context_window.json",
) -> dict[str, dict]:
    """
    Gets all the model prices and context windows for LiteLLM.  Use this if litellm_get_models_prices_and_context_window is out of date.

    "sample_spec": {
        "max_tokens": "LEGACY parameter. set to max_output_tokens if provider specifies it. IF not set to max_input_tokens, if provider specifies it.",
        "max_input_tokens": "max input tokens, if the provider specifies it. if not default to max_tokens",
        "max_output_tokens": "max output tokens, if the provider specifies it. if not default to max_tokens",
        "input_cost_per_token": 0.0000,
        "output_cost_per_token": 0.000,
        "litellm_provider": "one of https://docs.litellm.ai/docs/providers",
        "mode": "one of: chat, embedding, completion, image_generation, audio_transcription, audio_speech, image_generation, moderation, rerank",
        "supports_function_calling": true,
        "supports_parallel_function_calling": true,
        "supports_vision": true,
        "supports_audio_input": true,
        "supports_audio_output": true,
        "supports_prompt_caching": true,
        "supports_response_schema": true,
        "supports_system_messages": true,
        "supports_web_search": true,
        "search_context_cost_per_query": {
            "search_context_size_low": 0.0000,
            "search_context_size_medium": 0.0000,
            "search_context_size_high": 0.0000
        },
        "deprecation_date": "date when the model becomes deprecated in the format YYYY-MM-DD"
    },
    """

    from letta.utils import printd

    printd(f"Sending request to {url}")
    response = None
    try:
        response = requests.get(url)
        response.raise_for_status()  # Raises HTTPError for 4XX/5XX status
        response_data = response.json()  # convert to dict from string
        # logger.debug(f"response = {response_data}")
        return response_data
    except requests.exceptions.HTTPError as http_err:
        logger.warning(f"Got HTTPError, exception={http_err}, response={response}")
        return {}
    except requests.exceptions.RequestException as req_err:
        # Handle other requests-related errors (e.g., connection error)
        logger.warning(f"Got RequestException, exception={req_err}, response={response}")
        return {}
    except Exception as e:
        # Handle other potential errors
        logger.warning(f"Got unknown Exception, exception={e}, response={response}")
        return {}


def litellm_get_model_info(url: str, model_id: Optional[str] = None, api_key: Optional[str] = None) -> Optional[list]:
    """
    Lists extra information for the model.

    [
        {
            "model_name": "gpt-4",
            "litellm_params": {
                "model": "gpt-4"
            },
            "model_info": {
                "id": "e889baacd17f591cce4c63639275ba5e8dc60765d6c553e6ee5a504b19e50ddc",
                "db_model": false,
                "my_custom_key": "my_custom_value", # 👈 CUSTOM INFO
                "key": "gpt-4", # 👈 KEY in LiteLLM MODEL INFO/COST MAP - https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json
                "max_tokens": 4096,
                "max_input_tokens": 8192,
                "max_output_tokens": 4096,
                "input_cost_per_token": 3e-05,
                "input_cost_per_character": null,
                "input_cost_per_token_above_128k_tokens": null,
                "output_cost_per_token": 6e-05,
                "output_cost_per_character": null,
                "output_cost_per_token_above_128k_tokens": null,
                "output_cost_per_character_above_128k_tokens": null,
                "output_vector_size": null,
                "litellm_provider": "openai",
                "mode": "chat"
            }
        },
    ]

    https://docs.litellm.ai/docs/proxy/model_management
    """
    from letta.utils import printd

    url = smart_urljoin(url, "/model/info")

    headers = {"Content-Type": "application/json"}
    if api_key is not None:
        headers["Authorization"] = f"Bearer {api_key}"

    printd(f"Sending request to {url}")
    response = None
    try:
        # Provides more info about each model in /models, including config.yaml descriptions (except api key and api base)
        #
        # Parameters: litellm_model_id: Optional[str] = None (this is the value of x-litellm-model-id returned in response headers)
        #
        # - When litellm_model_id is passed, it will return the info for that specific model
        # - When litellm_model_id is not passed, it will return the info for all models
        if model_id is not None:
            response = requests.get(url, headers=headers, params={"litellm_model_id": model_id})
        else:
            response = requests.get(url, headers=headers)
        response.raise_for_status()  # Raises HTTPError for 4XX/5XX status
        response = response.json()  # convert to dict from string
        printd(f"response = {response}")
        data = response["data"]
        return data
    except requests.exceptions.HTTPError as http_err:
        # Handle HTTP errors (e.g., response 4XX, 5XX)
        # "detail": {
        #   "error": "Model id = gemini-2.0-flash-lite not found on litellm proxy"
        # }
        response_data = None
        try:
            if response:
                response_data = response.json()
                if response_data and "detail" in response_data and response_data["detail"] is not None:
                    # Check if 'error' key exists within 'detail' before accessing
                    if (
                        isinstance(response_data["detail"], dict)
                        and "error" in response_data["detail"]
                        and response_data["detail"]["error"] is not None
                    ):
                        error = response_data["detail"]["error"]
                        logger.debug(f"Server returned {error}")
                    # Handle cases where 'detail' might be a string or other non-dict type
                    elif isinstance(response_data["detail"], str):
                        logger.debug(f"Server returned detail: {response_data['detail']}")
        except Exception:  # Catch potential JSONDecodeError or other issues
            pass

        printd(f"Got HTTPError, exception={http_err}, response={response_data}")
        raise http_err
    except requests.exceptions.RequestException as req_err:
        # Handle other requests-related errors (e.g., connection error)
        response_data = None
        try:
            if response:
                response_data = response.json()
        except Exception:  # Catch potential JSONDecodeError or other issues
            pass
        printd(f"Got RequestException, exception={req_err}, response={response_data}")
        raise req_err
    except Exception as e:
        # Handle other potential errors
        response_data = None
        try:
            if response:
                response_data = response.json()
        except Exception:  # Catch potential JSONDecodeError or other issues
            pass
        printd(f"Got unknown Exception, exception={e}, response={response_data}")
        raise e
