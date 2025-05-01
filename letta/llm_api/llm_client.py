from typing import Optional

from letta.llm_api.llm_client_base import LLMClientBase
from letta.schemas.enums import ProviderType


class LLMClient:
    """Factory class for creating LLM clients based on the model endpoint type."""

    @staticmethod
    def create(
        provider_type: ProviderType,
        provider_name: Optional[str] = None,
        put_inner_thoughts_first: bool = True,
        actor_id: Optional[str] = None,
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
                    provider_name=provider_name,
                    put_inner_thoughts_first=put_inner_thoughts_first,
                    actor_id=actor_id,
                )
            case ProviderType.google_vertex:
                from letta.llm_api.google_vertex_client import GoogleVertexClient

                return GoogleVertexClient(
                    provider_name=provider_name,
                    put_inner_thoughts_first=put_inner_thoughts_first,
                    actor_id=actor_id,
                )
            case ProviderType.anthropic:
                from letta.llm_api.anthropic_client import AnthropicClient

                return AnthropicClient(
                    provider_name=provider_name,
                    put_inner_thoughts_first=put_inner_thoughts_first,
                    actor_id=actor_id,
                )
            case ProviderType.openai:
                from letta.llm_api.openai_client import OpenAIClient

                return OpenAIClient(
                    provider_name=provider_name,
                    put_inner_thoughts_first=put_inner_thoughts_first,
                    actor_id=actor_id,
                )
            case _:
                return None
