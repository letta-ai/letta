"""
Note that this formally only supports Anthropic Bedrock.
TODO (cliandy): determine what other providers are supported and what is needed to add support.
"""

from typing import Literal

from pydantic import Field

from letta.log import get_logger
from letta.schemas.enums import ProviderCategory, ProviderType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.providers.base import Provider

logger = get_logger(__name__)


class BedrockProvider(Provider):
    provider_type: Literal[ProviderType.bedrock] = Field(ProviderType.bedrock, description="The type of the provider.")
    provider_category: ProviderCategory = Field(ProviderCategory.base, description="The category of the provider (base or byok)")
    region: str = Field(..., description="AWS region for Bedrock")

    async def check_api_key(self):
        """Check if the Bedrock credentials are valid"""
        from letta.errors import LLMAuthenticationError
        from letta.llm_api.aws_bedrock import bedrock_get_model_list_async

        try:
            # For BYOK providers, use the custom credentials
            if self.provider_category == ProviderCategory.byok:
                # If we can list models, the credentials are valid
                await bedrock_get_model_list_async(
                    access_key_id=self.access_key,
                    secret_access_key=self.api_key,  # api_key stores the secret access key
                    region_name=self.region,
                )
            else:
                # For base providers, use default credentials
                bedrock_get_model_list(region_name=self.region)
        except Exception as e:
            raise LLMAuthenticationError(message=f"Failed to authenticate with Bedrock: {e}")

    async def list_llm_models_async(self) -> list[LLMConfig]:
        from letta.llm_api.aws_bedrock import bedrock_get_model_list_async

        models = await bedrock_get_model_list_async(
            self.access_key,
            self.api_key,
            self.region,
        )

        configs = []
        for model_summary in models:
            model_arn = model_summary["inferenceProfileArn"]
            configs.append(
                LLMConfig(
                    model=model_arn,
                    model_endpoint_type=self.provider_type.value,
                    model_endpoint=None,
                    context_window=self.get_model_context_window(model_arn),
                    handle=self.get_handle(model_arn),
                    provider_name=self.name,
                    provider_category=self.provider_category,
                )
            )

        return configs

    def get_model_context_window(self, model_name: str) -> int | None:
        # Context windows for Claude models
        from letta.llm_api.aws_bedrock import bedrock_get_model_context_window

        return bedrock_get_model_context_window(model_name)

    def get_handle(self, model_name: str, is_embedding: bool = False, base_name: str | None = None) -> str:
        logger.debug("Getting handle for model_name: %s", model_name)
        model = model_name.split(".")[-1]
        return f"{self.name}/{model}"
