from typing import Literal

from pydantic import Field

from letta.schemas.enums import ProviderCategory, ProviderType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.providers.openai import OpenAIProvider


# TODO (cliandy): this needs to be implemented
class CohereProvider(OpenAIProvider):
    provider_type: Literal[ProviderType.cohere] = Field(ProviderType.cohere, description="The type of the provider.")
    provider_category: ProviderCategory = Field(ProviderCategory.base, description="The category of the provider (base or byok)")
    base_url: str = ""
    api_key: str = Field(..., description="API key for the Cohere API.")

    async def list_llm_models_async(self) -> list[LLMConfig]:
        raise NotImplementedError
