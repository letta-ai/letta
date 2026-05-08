"""
SGLang Native Client for Letta.

Uses SGLang's native /generate endpoint with input_ids for exact token-level control.
Returns token IDs and per-token logprobs essential for multi-turn RL training.
"""

from typing import Any, Dict, List, Optional

import httpx

from letta.log import get_logger

logger = get_logger(__name__)


class SGLangNativeClient:
    """Client for SGLang's native /generate endpoint.

    Uses input_ids instead of text to avoid double tokenization and ensure
    the correct chat template is applied (via HF tokenizer on the caller side).

    Returns:
    - output_ids: List of token IDs
    - output_token_logprobs: List of [logprob, token_id, top_logprob] tuples
    """

    def __init__(self, base_url: str, api_key: Optional[str] = None):
        self.base_url = base_url.rstrip("/")
        if self.base_url.endswith("/v1"):
            self.base_url = self.base_url[:-3]
        self.api_key = api_key

    @property
    def _headers(self) -> dict:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    async def generate(
        self,
        input_ids: List[int],
        sampling_params: Optional[Dict[str, Any]] = None,
        return_logprob: bool = True,
    ) -> Dict[str, Any]:
        """Call SGLang's native /generate endpoint with pre-tokenized input.

        Args:
            input_ids: Token IDs from apply_chat_template(tokenize=True)
            sampling_params: temperature, max_new_tokens, top_p, etc.
            return_logprob: Whether to return per-token logprobs (default True for RL)

        Returns:
            {
                "text": "...",
                "output_ids": [token_id, ...],
                "output_token_logprobs": [[logprob, token_id, top_logprob], ...],
                "meta_info": {"finish_reason": ..., "prompt_tokens": ..., ...}
            }
        """
        payload = {
            "input_ids": input_ids,
            "sampling_params": sampling_params or {},
            "return_logprob": return_logprob,
        }

        async with httpx.AsyncClient(timeout=300.0) as client:
            response = await client.post(
                f"{self.base_url}/generate",
                json=payload,
                headers=self._headers,
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
