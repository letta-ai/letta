"""
Utility functions for working with litellm model specifications.

This module provides access to model specifications from the litellm model_prices_and_context_window.json file.
The data is synced from: https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json
"""

import json
import os
from typing import Optional

import aiofiles
from async_lru import alru_cache

from letta.log import get_logger

logger = get_logger(__name__)

# Path to the litellm model specs JSON file
MODEL_SPECS_PATH = os.path.join(os.path.dirname(__file__), "model_prices_and_context_window.json")


@alru_cache(maxsize=1)
async def load_model_specs() -> dict:
    """Load the litellm model specifications from the JSON file.

    Returns:
        dict: The model specifications data

    Raises:
        FileNotFoundError: If the model specs file is not found
        json.JSONDecodeError: If the file is not valid JSON
    """
    if not os.path.exists(MODEL_SPECS_PATH):
        logger.warning(f"Model specs file not found at {MODEL_SPECS_PATH}")
        return {}

    try:
        async with aiofiles.open(MODEL_SPECS_PATH, "r") as f:
            content = await f.read()
            return json.loads(content)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse model specs JSON: {e}")
        return {}


async def get_model_spec(model_name: str) -> Optional[dict]:
    """Get the specification for a specific model.

    Args:
        model_name: The name of the model (e.g., "gpt-4o", "gpt-4o-mini")

    Returns:
        Optional[dict]: The model specification if found, None otherwise
    """
    specs = await load_model_specs()
    return specs.get(model_name)


async def get_max_input_tokens(model_name: str) -> Optional[int]:
    """Get the max input tokens for a model.

    Args:
        model_name: The name of the model

    Returns:
        Optional[int]: The max input tokens if found, None otherwise
    """
    spec = await get_model_spec(model_name)
    if not spec:
        return None

    return spec.get("max_input_tokens")


async def get_max_output_tokens(model_name: str) -> Optional[int]:
    """Get the max output tokens for a model.

    Args:
        model_name: The name of the model

    Returns:
        Optional[int]: The max output tokens if found, None otherwise
    """
    spec = await get_model_spec(model_name)
    if not spec:
        return None

    # Try max_output_tokens first, fall back to max_tokens
    return spec.get("max_output_tokens") or spec.get("max_tokens")


async def get_context_window(model_name: str) -> Optional[int]:
    """Get the context window size for a model.

    For most models, this is the max_input_tokens.

    Args:
        model_name: The name of the model

    Returns:
        Optional[int]: The context window size if found, None otherwise
    """
    return await get_max_input_tokens(model_name)


async def get_litellm_provider(model_name: str) -> Optional[str]:
    """Get the litellm provider for a model.

    Args:
        model_name: The name of the model

    Returns:
        Optional[str]: The provider name if found, None otherwise
    """
    spec = await get_model_spec(model_name)
    if not spec:
        return None

    return spec.get("litellm_provider")
