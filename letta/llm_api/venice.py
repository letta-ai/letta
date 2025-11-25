"""
Venice AI API helper functions for model listing and API interactions.
"""

import httpx
from typing import Optional

from letta.log import get_logger
from letta.settings import model_settings

logger = get_logger(__name__)


async def venice_get_model_list_async(
    url: str,
    api_key: Optional[str] = None,
    client: Optional[httpx.AsyncClient] = None,
) -> dict:
    """
    Get list of available models from Venice API.
    
    Args:
        url: Base URL for Venice API (e.g., "https://api.venice.ai/api/v1")
        api_key: API key for authentication
        client: Optional httpx.AsyncClient to reuse
        
    Returns:
        Dictionary with "data" key containing list of model objects
        
    Raises:
        httpx.HTTPStatusError: If the request fails
    """
    # Ensure URL ends with /api/v1
    if not url.endswith("/api/v1"):
        if url.endswith("/"):
            url = url.rstrip("/")
        url = f"{url}/api/v1" if not url.endswith("/api/v1") else url
    
    # Construct models endpoint
    models_url = f"{url}/models"
    
    headers = {"Content-Type": "application/json"}
    if api_key is not None:
        headers["Authorization"] = f"Bearer {api_key}"
    
    logger.debug(f"Sending request to {models_url}")
    
    # Use provided client or create a new one
    close_client = False
    if client is None:
        client = httpx.AsyncClient()
        close_client = True
    
    try:
        response = await client.get(models_url, headers=headers)
        response.raise_for_status()
        result = response.json()
        logger.debug(f"Venice models response: {len(result.get('data', []))} models")
        return result
    except httpx.HTTPStatusError as http_err:
        # Handle HTTP errors (e.g., response 4XX, 5XX)
        try:
            error_response = http_err.response.json()
        except:
            error_response = {"status_code": http_err.response.status_code, "text": http_err.response.text}
        logger.debug(f"Got HTTPError, exception={http_err}, response={error_response}")
        raise http_err
    except httpx.RequestError as req_err:
        # Handle other httpx-related errors (e.g., connection error)
        logger.debug(f"Got RequestException, exception={req_err}")
        raise req_err
    except Exception as e:
        # Handle other potential errors
        logger.debug(f"Got unknown Exception, exception={e}")
        raise e
    finally:
        if close_client:
            await client.aclose()

