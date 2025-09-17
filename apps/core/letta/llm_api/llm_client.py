from typing import TYPE_CHECKING, Optional

from letta.llm_api.llm_client_base import LLMClientBase
from letta.schemas.enums import ProviderType

if TYPE_CHECKING:
    from letta.orm import User


class LLMClient:
    """Factory class for creating LLM clients based on the model endpoint type."""

    @staticmethod
    def create(
        provider_type: ProviderType,
        put_inner_thoughts_first: bool = True,
        actor: Optional["User"] = None,
    ) -> Optional[LLMClientBase]:
        """
        Create an LLM client based on the model endpoint type.

        Args:
            provider: The model endpoint type
            put_inner_thoughts_first: Whether to put inner thoughts first in the response

        Returns:
            An instance of LLMClientBase subclass

        Raises:
            ValueError: If the model endpoint type is not supported
        """
        match provider_type:
            case ProviderType.google_ai:
                from letta.llm_api.google_ai_client import GoogleAIClient

                return GoogleAIClient(
                    put_inner_thoughts_first=put_inner_thoughts_first,
                    actor=actor,
                )
            case ProviderType.google_vertex:
                from letta.llm_api.google_vertex_client import GoogleVertexClient

                return GoogleVertexClient(
                    put_inner_thoughts_first=put_inner_thoughts_first,
                    actor=actor,
                )
            case ProviderType.anthropic:
                from letta.llm_api.anthropic_client import AnthropicClient

                return AnthropicClient(
                    put_inner_thoughts_first=put_inner_thoughts_first,
                    actor=actor,
                )
            case ProviderType.bedrock:
                from letta.llm_api.bedrock_client import BedrockClient

                return BedrockClient(
                    put_inner_thoughts_first=put_inner_thoughts_first,
                    actor=actor,
                )
            case ProviderType.together:
                from letta.llm_api.together_client import TogetherClient

                return TogetherClient(
                    put_inner_thoughts_first=put_inner_thoughts_first,
                    actor=actor,
                )
            case ProviderType.azure:
                from letta.llm_api.azure_client import AzureClient

                return AzureClient(
                    put_inner_thoughts_first=put_inner_thoughts_first,
                    actor=actor,
                )
            case ProviderType.xai:
                from letta.llm_api.xai_client import XAIClient

                return XAIClient(
                    put_inner_thoughts_first=put_inner_thoughts_first,
                    actor=actor,
                )
            case ProviderType.groq:
                from letta.llm_api.groq_client import GroqClient

                return GroqClient(
                    put_inner_thoughts_first=put_inner_thoughts_first,
                    actor=actor,
                )
            case ProviderType.deepseek:
                from letta.llm_api.deepseek_client import DeepseekClient

                return DeepseekClient(
                    put_inner_thoughts_first=put_inner_thoughts_first,
                    actor=actor,
                )
            case _:
                from letta.llm_api.openai_client import OpenAIClient

                return OpenAIClient(
                    put_inner_thoughts_first=put_inner_thoughts_first,
                    actor=actor,
                )
