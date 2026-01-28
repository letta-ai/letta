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
    access_key: str | None = Field(None, description="AWS access key ID for Bedrock")
    api_key: str | None = Field(None, description="AWS secret access key for Bedrock")
    region: str = Field(..., description="AWS region for Bedrock")

    @staticmethod
    def extract_anthropic_model_name(inference_profile_id: str) -> str:
        """
        Extract the Anthropic-style model name from a Bedrock inference profile ID.

        Input format: us.anthropic.claude-opus-4-5-20250918-v1:0
        Output: claude-opus-4-5-20250918

        This allows Bedrock models to use the same model name format as regular Anthropic models,
        so all the existing model name checks (startswith("claude-"), etc.) work correctly.
        """
        # Remove region prefix (e.g., "us.anthropic." -> "claude-...")
        if ".anthropic." in inference_profile_id:
            model_part = inference_profile_id.split(".anthropic.")[1]
        else:
            model_part = inference_profile_id

        # Remove version suffix (e.g., "-v1:0" at the end)
        # Pattern: -v followed by digits, optionally followed by :digits
        import re

        model_name = re.sub(r"-v\d+(?::\d+)?$", "", model_part)
        return model_name

    async def bedrock_get_model_list_async(self) -> list[dict]:
        """
        List Bedrock inference profiles using boto3.
        """
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
            logger.error("Error getting model list for bedrock: %s", e)
            raise e

    async def check_api_key(self):
        """Check if the Bedrock credentials are valid by listing models"""
        from letta.errors import LLMAuthenticationError

        try:
            # If we can list models, the credentials are valid
            await self.bedrock_get_model_list_async()
        except Exception as e:
            raise LLMAuthenticationError(message=f"Failed to authenticate with Bedrock: {e}")

    async def list_llm_models_async(self) -> list[LLMConfig]:
        models = await self.bedrock_get_model_list_async()

        # Deduplicate models by normalized name - prefer regional (us., eu.) over global
        seen_models: dict[str, tuple[str, dict]] = {}  # model_name -> (inference_profile_id, model_summary)
        for model_summary in models:
            inference_profile_id = model_summary["inferenceProfileId"]
            model_name = self.extract_anthropic_model_name(inference_profile_id)

            if model_name not in seen_models:
                seen_models[model_name] = (inference_profile_id, model_summary)
            else:
                # Prefer regional profiles over global ones
                existing_id = seen_models[model_name][0]
                if existing_id.startswith("global.") and not inference_profile_id.startswith("global."):
                    seen_models[model_name] = (inference_profile_id, model_summary)

        configs = []
        for model_name, (inference_profile_id, model_summary) in seen_models.items():
            configs.append(
                LLMConfig(
                    model=model_name,
                    model_endpoint_type=self.provider_type.value,
                    model_endpoint=None,
                    context_window=self.get_model_context_window(inference_profile_id),
                    # Store the full inference profile ID in the handle for API calls
                    handle=self.get_handle(inference_profile_id),
                    max_tokens=self.get_default_max_output_tokens(inference_profile_id),
                    provider_name=self.name,
                    provider_category=self.provider_category,
                )
            )

        return configs

    def get_model_context_window(self, model_name: str) -> int | None:
        """
        Get context window size for a specific model.

        Bedrock doesn't provide this via API, so we maintain a mapping.
        """
        model_lower = model_name.lower()
        if "anthropic" in model_lower or "claude" in model_lower:
            return 200_000
        else:
            return 100_000  # default if unknown

    def get_handle(self, model_name: str, is_embedding: bool = False, base_name: str | None = None) -> str:
        """
        Create handle from inference profile ID.

        Input format: us.anthropic.claude-sonnet-4-20250514-v1:0
        Output: bedrock/us.anthropic.claude-sonnet-4-20250514-v1:0
        """
        return f"{self.name}/{model_name}"
