from collections import defaultdict
from typing import ClassVar, Literal

import requests
from openai import AzureOpenAI
from pydantic import Field, field_validator

from letta.constants import DEFAULT_EMBEDDING_CHUNK_SIZE, LLM_MAX_TOKENS
from letta.errors import ErrorCode, LLMAuthenticationError
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import ProviderCategory, ProviderType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.providers.base import Provider

AZURE_MODEL_TO_CONTEXT_LENGTH = {
    "babbage-002": 16384,
    "davinci-002": 16384,
    "gpt-35-turbo-0613": 4096,
    "gpt-35-turbo-1106": 16385,
    "gpt-35-turbo-0125": 16385,
    "gpt-4-0613": 8192,
    "gpt-4o-mini-2024-07-18": 128000,
    "gpt-4o-mini": 128000,
    "gpt-4o": 128000,
}


class AzureProvider(Provider):
    LATEST_API_VERSION: ClassVar[str] = "2024-09-01-preview"

    provider_type: Literal[ProviderType.azure] = Field(ProviderType.azure, description="The type of the provider.")
    provider_category: ProviderCategory = Field(ProviderCategory.base, description="The category of the provider (base or byok)")
    # Note: 2024-09-01-preview was set here until 2025-07-16.
    # set manually, see: https://learn.microsoft.com/en-us/azure/ai-services/openai/api-version-deprecation
    latest_api_version: str = "2025-04-01-preview"
    base_url: str = Field(
        ..., description="Base URL for the Azure API endpoint. This should be specific to your org, e.g. `https://letta.openai.azure.com`."
    )
    api_key: str = Field(..., description="API key for the Azure API.")
    api_version: str = Field(default=LATEST_API_VERSION, description="API version for the Azure API")

    @field_validator("api_version", mode="before")
    def replace_none_with_default(cls, v):
        return v if v is not None else cls.LATEST_API_VERSION

    def get_azure_chat_completions_endpoint(self, model: str):
        return f"{self.base_url}/openai/deployments/{model}/chat/completions?api-version={self.api_version}"

    def get_azure_embeddings_endpoint(self, model: str):
        return f"{self.base_url}/openai/deployments/{model}/embeddings?api-version={self.api_version}"

    def get_azure_model_list_endpoint(self):
        return f"{self.base_url}/openai/models?api-version={self.api_version}"

    def get_azure_deployment_list_endpoint(self):
        # Please note that it has to be 2023-03-15-preview
        # That's the only api version that works with this deployments endpoint
        return f"{self.base_url}/openai/deployments?api-version=2023-03-15-preview"

    def azure_openai_get_deployed_model_list(self) -> list:
        """https://learn.microsoft.com/en-us/rest/api/azureopenai/models/list?view=rest-azureopenai-2023-05-15&tabs=HTTP"""

        api_key = self.get_api_key_secret().get_plaintext()
        client = AzureOpenAI(api_key=api_key, api_version=self.api_version, azure_endpoint=self.base_url)

        try:
            models_list = client.models.list()
        except Exception:
            return []

        all_available_models = [model.to_dict() for model in models_list.data]

        # https://xxx.openai.azure.com/openai/models?api-version=xxx
        headers = {"Content-Type": "application/json"}
        if api_key is not None:
            headers["api-key"] = f"{api_key}"

        # 2. Get all the deployed models
        url = self.get_azure_deployment_list_endpoint()
        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
        except requests.RequestException as e:
            raise RuntimeError(f"Failed to retrieve model list: {e}")

        deployed_models = response.json().get("data", [])
        deployed_model_names = set([m["id"] for m in deployed_models])

        # 3. Only return the models in available models if they have been deployed
        deployed_models = [m for m in all_available_models if m["id"] in deployed_model_names]

        # 4. Remove redundant deployments, only include the ones with the latest deployment
        # Create a dictionary to store the latest model for each ID
        latest_models = defaultdict()

        # Iterate through the models and update the dictionary with the most recent model
        for model in deployed_models:
            model_id = model["id"]
            updated_at = model["created_at"]

            # If the model ID is new or the current model has a more recent created_at, update the dictionary
            if model_id not in latest_models or updated_at > latest_models[model_id]["created_at"]:
                latest_models[model_id] = model

        # Extract the unique models
        return list(latest_models.values())

    async def list_llm_models_async(self) -> list[LLMConfig]:
        # TODO (cliandy): asyncify
        model_list = self.azure_openai_get_deployed_model_list()
        # Extract models that support text generation
        model_options = [m for m in model_list if m.get("capabilities").get("chat_completion") == True]

        configs = []
        for model_option in model_options:
            model_name = model_option["id"]
            context_window_size = self.get_model_context_window(model_name)
            model_endpoint = self.get_azure_chat_completions_endpoint(model_name)
            configs.append(
                LLMConfig(
                    model=model_name,
                    model_endpoint_type="azure",
                    model_endpoint=model_endpoint,
                    context_window=context_window_size,
                    handle=self.get_handle(model_name),
                    provider_name=self.name,
                    provider_category=self.provider_category,
                )
            )
        return configs

    async def list_embedding_models_async(self) -> list[EmbeddingConfig]:
        # TODO (cliandy): asyncify dependent function calls
        def valid_embedding_model(m: dict, require_embedding_in_name: bool = True):
            valid_name = True
            if require_embedding_in_name:
                valid_name = "embedding" in m["id"]

            return m.get("capabilities").get("embeddings") == True and valid_name

        model_list = self.azure_openai_get_deployed_model_list()
        # Extract models that support embeddings

        model_options = [m for m in model_list if valid_embedding_model(m)]

        configs = []
        for model_option in model_options:
            model_name = model_option["id"]
            model_endpoint = self.get_azure_embeddings_endpoint(model_name)
            configs.append(
                EmbeddingConfig(
                    embedding_model=model_name,
                    embedding_endpoint_type="azure",
                    embedding_endpoint=model_endpoint,
                    embedding_dim=768,  # TODO generated 1536?
                    embedding_chunk_size=DEFAULT_EMBEDDING_CHUNK_SIZE,  # old note: max is 2048
                    handle=self.get_handle(model_name, is_embedding=True),
                    batch_size=1024,
                )
            )
        return configs

    def get_model_context_window(self, model_name: str) -> int | None:
        # Hard coded as there are no API endpoints for this
        llm_default = LLM_MAX_TOKENS.get(model_name, 4096)
        return AZURE_MODEL_TO_CONTEXT_LENGTH.get(model_name, llm_default)

    async def check_api_key(self):
        api_key = self.get_api_key_secret().get_plaintext()
        if not api_key:
            raise ValueError("No API key provided")

        try:
            await self.list_llm_models_async()
        except Exception as e:
            raise LLMAuthenticationError(message=f"Failed to authenticate with Azure: {e}", code=ErrorCode.UNAUTHENTICATED)
