from typing import Literal

import aiohttp
from pydantic import Field

from letta.constants import DEFAULT_EMBEDDING_CHUNK_SIZE
from letta.log import get_logger
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import ProviderCategory, ProviderType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.providers.openai import OpenAIProvider

logger = get_logger(__name__)

ollama_prefix = "/v1"


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
            context_window = await self._get_model_context_window(model["name"])
            if context_window is None:
                print(f"Ollama model {model['name']} has no context window, using default 32000")
                context_window = 32000
            configs.append(
                LLMConfig(
                    model=model["name"],
                    model_endpoint_type=ProviderType.ollama,
                    model_endpoint=f"{self.base_url}{ollama_prefix}",
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
            embedding_dim = await self._get_model_embedding_dim(model["name"])
            if not embedding_dim:
                print(f"Ollama model {model['name']} has no embedding dimension, using default 1024")
                # continue
                embedding_dim = 1024
            configs.append(
                EmbeddingConfig(
                    embedding_model=model["name"],
                    embedding_endpoint_type=ProviderType.ollama,
                    embedding_endpoint=f"{self.base_url}{ollama_prefix}",
                    embedding_dim=embedding_dim,
                    embedding_chunk_size=DEFAULT_EMBEDDING_CHUNK_SIZE,
                    handle=self.get_handle(model["name"], is_embedding=True),
                )
            )
        return configs

    async def _get_model_context_window(self, model_name: str) -> int | None:
        endpoint = f"{self.base_url}/api/show"
        payload = {"name": model_name}

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(endpoint, json=payload) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        logger.warning(f"Failed to get model info for {model_name}: {response.status} - {error_text}")
                        return None

                    response_json = await response.json()
                    model_info = response_json.get("model_info", {})

                    if architecture := model_info.get("general.architecture"):
                        if context_length := model_info.get(f"{architecture}.context_length"):
                            return int(context_length)

        except Exception as e:
            logger.warning(f"Failed to get model context window for {model_name} with error: {e}")

        return None

    async def _get_model_embedding_dim(self, model_name: str) -> int | None:
        endpoint = f"{self.base_url}/api/show"
        payload = {"name": model_name}

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(endpoint, json=payload) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        logger.warning(f"Failed to get model info for {model_name}: {response.status} - {error_text}")
                        return None

                    response_json = await response.json()
                    model_info = response_json.get("model_info", {})

                    if architecture := model_info.get("general.architecture"):
                        if embedding_length := model_info.get(f"{architecture}.embedding_length"):
                            return int(embedding_length)

        except Exception as e:
            logger.warning(f"Failed to get model embedding dimension for {model_name} with error: {e}")

        return None
