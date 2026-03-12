"""
SGLang Native Client for Letta.

This client uses SGLang's native /generate endpoint instead of the OpenAI-compatible
/v1/chat/completions endpoint. The native endpoint returns token IDs and per-token
logprobs, which are essential for multi-turn RL training.

The OpenAI-compatible endpoint only returns token strings, not IDs, making it
impossible to accurately reconstruct the token sequence for training.
"""

from typing import Any, Dict, Optional

import httpx

from letta.log import get_logger

logger = get_logger(__name__)


class SGLangNativeClient:
    """Client for SGLang's native /generate endpoint.

    Unlike the OpenAI-compatible endpoint, this returns:
    - output_ids: List of token IDs
    - output_token_logprobs: List of [logprob, token_id, top_logprob] tuples

    This is essential for RL training where we need exact token IDs, not re-tokenized text.
    """

    def __init__(self, base_url: str, api_key: Optional[str] = None):
        """
        Initialize the SGLang native client.

        Args:
            base_url: Base URL for SGLang server (e.g., http://localhost:30000)
            api_key: Optional API key for authentication
        """
        # Remove /v1 suffix if present - native endpoint is at root
        self.base_url = base_url.rstrip("/")
        if self.base_url.endswith("/v1"):
            self.base_url = self.base_url[:-3]
        self.api_key = api_key

    async def generate(
        self,
        text: str,
        sampling_params: Optional[Dict[str, Any]] = None,
        return_logprob: bool = True,
    ) -> Dict[str, Any]:
        """
        Call SGLang's native /generate endpoint.

        Args:
            text: The formatted prompt text (with chat template applied)
            sampling_params: Sampling parameters (temperature, max_new_tokens, etc.)
            return_logprob: Whether to return logprobs (default True for RL training)

        Returns:
            Response dict with:
            - text: Generated text
            - output_ids: List of token IDs
            - output_token_logprobs: List of [logprob, token_id, top_logprob] tuples
            - meta_info: Metadata including finish_reason, prompt_tokens, etc.

        Example response:
            {
                "text": "Hello! How can I help?",
                "output_ids": [9707, 0, 2585, 646, 358, 1492, 30],
                "output_token_logprobs": [
                    [-0.005, 9707, null],
                    [0.0, 0, null],
                    ...
                ],
                "meta_info": {
                    "finish_reason": {"type": "stop", "matched": 151645},
                    "prompt_tokens": 42,
                    ...
                }
            }
        """
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        payload = {
            "text": text,
            "sampling_params": sampling_params or {},
            "return_logprob": return_logprob,
        }

        async with httpx.AsyncClient(timeout=300.0) as client:
            response = await client.post(
                f"{self.base_url}/generate",
                json=payload,
                headers=headers,
            )
            response.raise_for_status()
            return response.json()

    async def health_check(self) -> bool:
        """Check if the SGLang server is healthy."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.base_url}/health")
                return response.status_code == 200
        except Exception:
            return False
