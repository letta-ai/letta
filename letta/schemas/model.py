from typing import Annotated, Literal, Optional, Union

from pydantic import BaseModel, Field

from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import ProviderType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.response_format import ResponseFormatUnion


class ModelBase(BaseModel):
    handle: str = Field(..., description="Unique handle for API reference (format: provider_display_name/model_display_name)")
    name: str = Field(..., description="The actual model name used by the provider")
    display_name: str = Field(..., description="Display name for the model shown in UI")
    provider_type: ProviderType = Field(..., description="The type of the provider")
    provider_name: str = Field(..., description="The name of the provider")
    model_type: Literal["llm", "embedding"] = Field(..., description="Type of model (llm or embedding)")


class Model(ModelBase):
    model_type: Literal["llm"] = Field("llm", description="Type of model (llm or embedding)")
    max_context_window: int = Field(..., description="The maximum context window for the model")
    # supports_token_streaming: Optional[bool] = Field(None, description="Whether token streaming is supported")
    # supports_tool_calling: Optional[bool] = Field(None, description="Whether tool calling is supported")

    def _from_llm_config(self, llm_config: LLMConfig) -> "Model":
        return self(
            handle=llm_config.handle,
            name=llm_config.model,
            display_name=llm_config.display_name,
            provider_type=llm_config.model_endpoint_type,
            provider_name=llm_config.provider_name,
        )


class EmbeddingModel(ModelBase):
    model_type: Literal["embedding"] = Field("embedding", description="Type of model (llm or embedding)")
    embedding_dim: int = Field(..., description="The dimension of the embedding")

    def _from_embedding_config(self, embedding_config: EmbeddingConfig) -> "Model":
        return self(
            handle=embedding_config.handle,
            name=embedding_config.embedding_model,
            display_name=embedding_config.embedding_model,
            provider_type=embedding_config.embedding_endpoint_type,
            provider_name=embedding_config.embedding_endpoint_type,
        )


class ModelSettings(BaseModel):
    """Schema for defining settings for a model"""

    model: str = Field(..., description="The name of the model.")
    max_output_tokens: int = Field(4096, description="The maximum number of tokens the model can generate.")


class OpenAIReasoning(BaseModel):
    reasoning_effort: Literal["minimal", "low", "medium", "high"] = Field(
        "minimal", description="The reasoning effort to use when generating text reasoning models"
    )

    # TODO: implement support for this
    # summary: Optional[Literal["auto", "detailed"]] = Field(
    #    None, description="The reasoning summary level to use when generating text reasoning models"
    # )


class OpenAIModelSettings(ModelSettings):
    provider: Literal["openai"] = Field("openai", description="The provider of the model.")
    temperature: float = Field(0.7, description="The temperature of the model.")
    reasoning: OpenAIReasoning = Field(OpenAIReasoning(reasoning_effort="high"), description="The reasoning configuration for the model.")
    response_format: Optional[ResponseFormatUnion] = Field(None, description="The response format for the model.")

    # TODO: implement support for these
    # reasoning_summary: Optional[Literal["none", "short", "detailed"]] = Field(
    #    None, description="The reasoning summary level to use when generating text reasoning models"
    # )
    # max_tool_calls: int = Field(10, description="The maximum number of tool calls the model can make.")
    # parallel_tool_calls: bool = Field(False, description="Whether the model supports parallel tool calls.")
    # top_logprobs: int = Field(10, description="The number of top logprobs to return.")
    # top_p: float = Field(1.0, description="The top-p value to use when generating text.")

    def _to_legacy_config_params(self) -> dict:
        return {
            "temperature": self.temperature,
            "max_tokens": self.max_output_tokens,
            "reasoning_effort": self.reasoning.reasoning_effort,
            "response_format": self.response_format,
        }


#    "thinking": {
#        "type": "enabled",
#        "budget_tokens": 10000
#    }


class AnthropicThinking(BaseModel):
    type: Literal["enabled", "disabled"] = Field("enabled", description="The type of thinking to use.")
    budget_tokens: int = Field(1024, description="The maximum number of tokens the model can use for extended thinking.")


class AnthropicModelSettings(ModelSettings):
    provider: Literal["anthropic"] = Field("anthropic", description="The provider of the model.")
    temperature: float = Field(1.0, description="The temperature of the model.")
    thinking: AnthropicThinking = Field(
        AnthropicThinking(type="enabled", budget_tokens=1024), description="The thinking configuration for the model."
    )

    # gpt-5 models only
    verbosity: Optional[Literal["low", "medium", "high"]] = Field(
        None,
        description="Soft control for how verbose model output should be, used for GPT-5 models.",
    )

    # TODO: implement support for these
    # top_k: Optional[int] = Field(None, description="The number of top tokens to return.")
    # top_p: Optional[float] = Field(None, description="The top-p value to use when generating text.")

    def _to_legacy_config_params(self) -> dict:
        return {
            "temperature": self.temperature,
            "max_tokens": self.max_output_tokens,
            "extended_thinking": self.thinking.type == "enabled",
            "thinking_budget_tokens": self.thinking.budget_tokens,
            "verbosity": self.verbosity,
        }


class GeminiThinkingConfig(BaseModel):
    include_thoughts: bool = Field(True, description="Whether to include thoughts in the model's response.")
    thinking_budget: int = Field(1024, description="The thinking budget for the model.")


class GoogleAIModelSettings(ModelSettings):
    provider: Literal["google_ai"] = Field("google_ai", description="The provider of the model.")
    temperature: float = Field(0.7, description="The temperature of the model.")
    thinking_config: GeminiThinkingConfig = Field(
        GeminiThinkingConfig(include_thoughts=True, thinking_budget=1024), description="The thinking configuration for the model."
    )
    response_schema: Optional[ResponseFormatUnion] = Field(None, description="The response schema for the model.")
    max_output_tokens: int = Field(65536, description="The maximum number of tokens the model can generate.")

    def _to_legacy_config_params(self) -> dict:
        return {
            "temperature": self.temperature,
            "max_tokens": self.max_output_tokens,
            "max_reasoning_tokens": self.thinking_config.thinking_budget if self.thinking_config.include_thoughts else 0,
        }


class GoogleVertexModelSettings(GoogleAIModelSettings):
    provider: Literal["google_vertex"] = Field("google_vertex", description="The provider of the model.")


class AzureModelSettings(ModelSettings):
    """Azure OpenAI model configuration (OpenAI-compatible)."""

    provider: Literal["azure"] = Field("azure", description="The provider of the model.")
    temperature: float = Field(0.7, description="The temperature of the model.")
    response_format: Optional[ResponseFormatUnion] = Field(None, description="The response format for the model.")

    def _to_legacy_config_params(self) -> dict:
        return {
            "temperature": self.temperature,
            "max_tokens": self.max_output_tokens,
            "response_format": self.response_format,
        }


class XAIModelSettings(ModelSettings):
    """xAI model configuration (OpenAI-compatible)."""

    provider: Literal["xai"] = Field("xai", description="The provider of the model.")
    temperature: float = Field(0.7, description="The temperature of the model.")
    response_format: Optional[ResponseFormatUnion] = Field(None, description="The response format for the model.")

    def _to_legacy_config_params(self) -> dict:
        return {
            "temperature": self.temperature,
            "max_tokens": self.max_output_tokens,
            "response_format": self.response_format,
        }


class GroqModelSettings(ModelSettings):
    """Groq model configuration (OpenAI-compatible)."""

    provider: Literal["groq"] = Field("groq", description="The provider of the model.")
    temperature: float = Field(0.7, description="The temperature of the model.")
    response_format: Optional[ResponseFormatUnion] = Field(None, description="The response format for the model.")

    def _to_legacy_config_params(self) -> dict:
        return {
            "temperature": self.temperature,
            "max_tokens": self.max_output_tokens,
            "response_format": self.response_format,
        }


class DeepseekModelSettings(ModelSettings):
    """Deepseek model configuration (OpenAI-compatible)."""

    provider: Literal["deepseek"] = Field("deepseek", description="The provider of the model.")
    temperature: float = Field(0.7, description="The temperature of the model.")
    response_format: Optional[ResponseFormatUnion] = Field(None, description="The response format for the model.")

    def _to_legacy_config_params(self) -> dict:
        return {
            "temperature": self.temperature,
            "max_tokens": self.max_output_tokens,
            "response_format": self.response_format,
        }


class TogetherModelSettings(ModelSettings):
    """Together AI model configuration (OpenAI-compatible)."""

    provider: Literal["together"] = Field("together", description="The provider of the model.")
    temperature: float = Field(0.7, description="The temperature of the model.")
    response_format: Optional[ResponseFormatUnion] = Field(None, description="The response format for the model.")

    def _to_legacy_config_params(self) -> dict:
        return {
            "temperature": self.temperature,
            "max_tokens": self.max_output_tokens,
            "response_format": self.response_format,
        }


class BedrockModelSettings(ModelSettings):
    """AWS Bedrock model configuration."""

    provider: Literal["bedrock"] = Field("bedrock", description="The provider of the model.")
    temperature: float = Field(0.7, description="The temperature of the model.")
    response_format: Optional[ResponseFormatUnion] = Field(None, description="The response format for the model.")

    def _to_legacy_config_params(self) -> dict:
        return {
            "temperature": self.temperature,
            "max_tokens": self.max_output_tokens,
            "response_format": self.response_format,
        }


ModelSettingsUnion = Annotated[
    Union[
        OpenAIModelSettings,
        AnthropicModelSettings,
        GoogleAIModelSettings,
        GoogleVertexModelSettings,
        AzureModelSettings,
        XAIModelSettings,
        GroqModelSettings,
        DeepseekModelSettings,
        TogetherModelSettings,
        BedrockModelSettings,
    ],
    Field(discriminator="provider"),
]


class EmbeddingModelSettings(BaseModel):
    model: str = Field(..., description="The name of the model.")
    provider: Literal["openai", "ollama"] = Field(..., description="The provider of the model.")
