"""Venice API helpers.

Used when the OpenAI provider base_url points at Venice (OpenAI-compatible proxy).
No separate ProviderType.venice: configure an OpenAI provider with
base URL https://api.venice.ai/api/v1 and your Venice API key.
"""
from typing import Optional

import httpx

from letta.log import get_logger
from letta.utils import smart_urljoin

logger = get_logger(__name__)


async def venice_get_model_list_async(
    url: str,
    api_key: Optional[str] = None,
    client: Optional["httpx.AsyncClient"] = None,
) -> dict:
    """List Venice models (GET {base_url}/models). Returns raw Venice payload with 'data' list."""
    url = smart_urljoin(url, "models")

    headers = {"Content-Type": "application/json"}
    if api_key is not None:
        headers["Authorization"] = f"Bearer {api_key}"

    close_client = False
    if client is None:
        client = httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0))
        close_client = True

    try:
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        result = response.json()
        logger.debug("Venice model list response received")
        return result
    except httpx.HTTPStatusError as http_err:
        try:
            error_response = http_err.response.json()
        except Exception:
            error_response = {"status_code": http_err.response.status_code, "text": http_err.response.text}
        logger.debug("Venice model list HTTP error: %s response=%s", http_err, error_response)
        raise
    except httpx.RequestError as req_err:
        logger.debug("Venice model list request error: %s", req_err)
        raise
    finally:
        if close_client:
            await client.aclose()
