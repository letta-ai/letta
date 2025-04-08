from typing import Optional

from letta.llm_api.llm_client_base import LLMClientBase
from letta.schemas.llm_config import LLMConfig


class LLMClient:
    """Factory class for creating LLM clients based on the model endpoint type."""

    @staticmethod
    def create(
        llm_config: LLMConfig,
        put_inner_thoughts_first: bool = True,
    ) -> Optional[LLMClientBase]:
        """
        Create an LLM client based on the model endpoint type.

        Args:
            llm_config: Configuration for the LLM model
            put_inner_thoughts_first: Whether to put inner thoughts first in the response
            use_structured_output: Whether to use structured output
            use_tool_naming: Whether to use tool naming

        Returns:
            An instance of LLMClientBase subclass

        Raises:
            ValueError: If the model endpoint type is not supported
        """
        match llm_config.model_endpoint_type:
            case "google_ai":
                from letta.llm_api.google_ai_client import GoogleAIClient

                return GoogleAIClient(
                    llm_config=llm_config,
                    put_inner_thoughts_first=put_inner_thoughts_first,
                )
            case "google_vertex":
                from letta.llm_api.google_vertex_client import GoogleVertexClient

                return GoogleVertexClient(
                    llm_config=llm_config,
                    put_inner_thoughts_first=put_inner_thoughts_first,
                )
            case "anthropic":
                from letta.llm_api.anthropic_client import AnthropicClient

                return AnthropicClient(
                    llm_config=llm_config,
                    put_inner_thoughts_first=put_inner_thoughts_first,
                )
            case "openai":
                from letta.llm_api.openai_client import OpenAIClient

                return OpenAIClient(
                    llm_config=llm_config,
                    put_inner_thoughts_first=put_inner_thoughts_first,
                )
            case _:
                return None
