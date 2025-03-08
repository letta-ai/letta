from typing import Optional

from letta.llm_api.llm_client_base import LLMClientBase
from letta.schemas.llm_config import LLMConfig


class LLMClient:
    """Factory class for creating LLM clients based on the model endpoint type."""

    @staticmethod
    def create(
        agent_id: str,
        llm_config: LLMConfig,
        put_inner_thoughts_first: bool = True,
        actor_id: Optional[str] = None,
    ) -> Optional[LLMClientBase]:
        """
        Create an LLM client based on the model endpoint type.

        Args:
            agent_id: Unique identifier for the agent
            llm_config: Configuration for the LLM model
            put_inner_thoughts_first: Whether to put inner thoughts first in the response
            use_structured_output: Whether to use structured output
            use_tool_naming: Whether to use tool naming
            actor_id: Optional actor identifier

        Returns:
            An instance of LLMClientBase subclass

        Raises:
            ValueError: If the model endpoint type is not supported
        """
        match llm_config.model_endpoint_type:
            case "google_ai":
                from letta.llm_api.google_ai_client import GoogleAIClient

                return GoogleAIClient(
                    agent_id=agent_id, llm_config=llm_config, put_inner_thoughts_first=put_inner_thoughts_first, actor_id=actor_id
                )
            case "google_vertex":
                from letta.llm_api.google_vertex_client import GoogleVertexClient

                return GoogleVertexClient(
                    agent_id=agent_id, llm_config=llm_config, put_inner_thoughts_first=put_inner_thoughts_first, actor_id=actor_id
                )
            case _:
                return None
