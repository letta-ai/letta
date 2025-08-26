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
    access_key: str = Field(..., description="AWS secret access key for Bedrock.")
    region: str = Field(..., description="AWS region for Bedrock")

    async def bedrock_get_model_list_async(self) -> list[dict]:
        from aioboto3.session import Session

        try:
            session = Session()
            async with session.client(
                "bedrock",
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.api_key,
                region_name=self.region,
            ) as bedrock:
                response = await bedrock.list_inference_profiles()
                return response["inferenceProfileSummaries"]
        except Exception as e:
            logger.error(f"Error getting model list for bedrock: %s", e)
            raise e

    async def check_api_key(self):
        """Check if the Bedrock credentials are valid"""
        from letta.errors import LLMAuthenticationError

        try:
            # For BYOK providers, use the custom credentials
            if self.provider_category == ProviderCategory.byok:
                # If we can list models, the credentials are valid
                await self.bedrock_get_model_list_async()
            else:
                # For base providers, use default credentials
                bedrock_get_model_list(region_name=self.region)
        except Exception as e:
            raise LLMAuthenticationError(message=f"Failed to authenticate with Bedrock: {e}")

    async def list_llm_models_async(self) -> list[LLMConfig]:
        models = await self.bedrock_get_model_list_async()

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
        """
        Get context window size for a specific model.

        Bedrock doesn't provide this via API, so we maintain a mapping
        200k for anthropic: https://aws.amazon.com/bedrock/anthropic/
        """
        if model_name.startswith("anthropic"):
            return 200_000
        else:
            return 100_000  # default to 100k if unknown

    def get_handle(self, model_name: str, is_embedding: bool = False, base_name: str | None = None) -> str:
        logger.debug("Getting handle for model_name: %s", model_name)
        model = model_name.split(".")[-1]
        return f"{self.name}/{model}"
