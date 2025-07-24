from typing import Literal

import aiohttp
import requests
from pydantic import Field

from letta.constants import DEFAULT_EMBEDDING_CHUNK_SIZE
from letta.log import get_logger
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import ProviderCategory, ProviderType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.providers.openai import OpenAIProvider

logger = get_logger(__name__)


class OllamaProvider(OpenAIProvider):
    """Ollama provider that uses the native /api/generate endpoint

    See: https://github.com/ollama/ollama/blob/main/docs/api.md#generate-a-completion
    """

    provider_type: Literal[ProviderType.ollama] = Field(ProviderType.ollama, description="The type of the provider.")
    provider_category: ProviderCategory = Field(ProviderCategory.base, description="The category of the provider (base or byok)")
    base_url: str = Field(..., description="Base URL for the Ollama API.")
    api_key: str | None = Field(None, description="API key for the Ollama API (default: `None`).")
    default_prompt_formatter: str = Field(
        ..., description="Default prompt formatter (aka model wrapper) to use on a /completions style API."
    )

    async def list_llm_models_async(self) -> list[LLMConfig]:
        """List available LLM Models from Ollama

        https://github.com/ollama/ollama/blob/main/docs/api.md#list-local-models"""
        endpoint = f"{self.base_url}/api/tags"
        async with aiohttp.ClientSession() as session:
            async with session.get(endpoint) as response:
                if response.status != 200:
                    raise Exception(f"Failed to list Ollama models: {response.text}")
                response_json = await response.json()

        configs = []
        for model in response_json["models"]:
            context_window = self.get_model_context_window(model["name"])
            if context_window is None:
                print(f"Ollama model {model['name']} has no context window")
                continue
            configs.append(
                LLMConfig(
                    model=model["name"],
                    model_endpoint_type="ollama",
                    model_endpoint=self.base_url,
                    model_wrapper=self.default_prompt_formatter,
                    context_window=context_window,
                    handle=self.get_handle(model["name"]),
                    provider_name=self.name,
                    provider_category=self.provider_category,
                )
            )
        return configs

    async def list_embedding_models_async(self) -> list[EmbeddingConfig]:
        """List available embedding models from Ollama

        https://github.com/ollama/ollama/blob/main/docs/api.md#list-local-models
        """
        endpoint = f"{self.base_url}/api/tags"
        async with aiohttp.ClientSession() as session:
            async with session.get(endpoint) as response:
                if response.status != 200:
                    raise Exception(f"Failed to list Ollama models: {response.text}")
                response_json = await response.json()

        configs = []
        for model in response_json["models"]:
            embedding_dim = await self._get_model_embedding_dim_async(model["name"])
            if not embedding_dim:
                print(f"Ollama model {model['name']} has no embedding dimension")
                continue
            configs.append(
                EmbeddingConfig(
                    embedding_model=model["name"],
                    embedding_endpoint_type="ollama",
                    embedding_endpoint=self.base_url,
                    embedding_dim=embedding_dim,
                    embedding_chunk_size=DEFAULT_EMBEDDING_CHUNK_SIZE,
                    handle=self.get_handle(model["name"], is_embedding=True),
                )
            )
        return configs

    def get_model_context_window(self, model_name: str) -> int | None:
        """Gets model context window for Ollama. As this can look different based on models,
        we use the following for guidance:

        "llama.context_length": 8192,
        "llama.embedding_length": 4096,
        source: https://github.com/ollama/ollama/blob/main/docs/api.md#show-model-information

        FROM 2024-10-08
        Notes from vLLM around keys
        source: https://github.com/vllm-project/vllm/blob/72ad2735823e23b4e1cc79b7c73c3a5f3c093ab0/vllm/config.py#L3488

        possible_keys = [
            # OPT
            "max_position_embeddings",
            # GPT-2
            "n_positions",
            # MPT
            "max_seq_len",
            # ChatGLM2
            "seq_length",
            # Command-R
            "model_max_length",
            # Whisper
            "max_target_positions",
            # Others
            "max_sequence_length",
            "max_seq_length",
            "seq_len",
        ]
        max_position_embeddings
        parse model cards: nous, dolphon, llama
        """
        endpoint = f"{self.base_url}/api/show"
        payload = {"name": model_name, "verbose": True}
        response = requests.post(endpoint, json=payload)
        if response.status_code != 200:
            return None

        try:
            model_info = response.json()
            # Try to extract context window from model parameters
            if "model_info" in model_info and "llama.context_length" in model_info["model_info"]:
                return int(model_info["model_info"]["llama.context_length"])
        except Exception:
            pass
        logger.warning(f"Failed to get model context window for {model_name}")
        return None

    async def _get_model_embedding_dim_async(self, model_name: str):
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{self.base_url}/api/show", json={"name": model_name, "verbose": True}) as response:
                response_json = await response.json()

        if "model_info" not in response_json:
            if "error" in response_json:
                logger.warning("Ollama fetch model info error for %s: %s", model_name, response_json["error"])
            return None

        return response_json["model_info"].get("embedding_length")
