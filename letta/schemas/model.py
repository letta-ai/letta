from typing import Annotated, Literal, Optional, Union

from pydantic import BaseModel, Field

from letta.schemas.llm_config import LLMConfig
from letta.schemas.response_format import ResponseFormatUnion


class Model(BaseModel):
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


class OpenAIModel(Model):
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


class AnthropicModel(Model):
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


class GoogleAIModel(Model):
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


class GoogleVertexModel(GoogleAIModel):
    provider: Literal["google_vertex"] = Field("google_vertex", description="The provider of the model.")


class AzureModel(Model):
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


class XAIModel(Model):
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


class GroqModel(Model):
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


class DeepseekModel(Model):
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


class TogetherModel(Model):
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


class BedrockModel(Model):
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


ModelSettings = Annotated[
    Union[
        OpenAIModel,
        AnthropicModel,
        GoogleAIModel,
        GoogleVertexModel,
        AzureModel,
        XAIModel,
        GroqModel,
        DeepseekModel,
        TogetherModel,
        BedrockModel,
    ],
    Field(discriminator="provider"),
]

class EmbeddingModelSettings(BaseModel):
    model: str = Field(..., description="The name of the model.")
    provider: Literal["openai", "ollama"] = Field(..., description="The provider of the model.")

