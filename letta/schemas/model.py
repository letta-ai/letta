from typing import Annotated, Literal, Optional, Union

from pydantic import BaseModel, Field

from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import ProviderCategory, ProviderType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.response_format import ResponseFormatUnion


class ModelBase(BaseModel):
    handle: str = Field(..., description="Unique handle for API reference (format: provider_display_name/model_display_name)")
    name: str = Field(..., description="The actual model name used by the provider")
    display_name: str = Field(..., description="Display name for the model shown in UI")
    provider_type: ProviderType = Field(..., description="The type of the provider")
    provider_name: str = Field(..., description="The name of the provider")
    model_type: Literal["llm", "embedding"] = Field(..., description="Type of model (llm or embedding)")


class Model(LLMConfig, ModelBase):
    model_type: Literal["llm"] = Field("llm", description="Type of model (llm or embedding)")
    max_context_window: int = Field(..., description="The maximum context window for the model")
    # supports_token_streaming: Optional[bool] = Field(None, description="Whether token streaming is supported")
    # supports_tool_calling: Optional[bool] = Field(None, description="Whether tool calling is supported")

    # Deprecated fields from LLMConfig - use new field names instead
    model: str = Field(..., description="Deprecated: Use 'name' field instead. LLM model name.", deprecated=True)
    model_endpoint_type: Literal[
        "openai",
        "anthropic",
        "google_ai",
        "google_vertex",
        "azure",
        "groq",
        "ollama",
        "webui",
        "webui-legacy",
        "lmstudio",
        "lmstudio-legacy",
        "lmstudio-chatcompletions",
        "llamacpp",
        "koboldcpp",
        "vllm",
        "hugging-face",
        "mistral",
        "together",
        "bedrock",
        "deepseek",
        "xai",
    ] = Field(..., description="Deprecated: Use 'provider_type' field instead. The endpoint type for the model.", deprecated=True)
    context_window: int = Field(
        ..., description="Deprecated: Use 'max_context_window' field instead. The context window size for the model.", deprecated=True
    )

    # Additional deprecated LLMConfig fields - kept for backward compatibility
    model_endpoint: Optional[str] = Field(None, description="Deprecated: The endpoint for the model.", deprecated=True)
    model_wrapper: Optional[str] = Field(None, description="Deprecated: The wrapper for the model.", deprecated=True)
    put_inner_thoughts_in_kwargs: Optional[bool] = Field(
        True, description="Deprecated: Puts 'inner_thoughts' as a kwarg in the function call.", deprecated=True
    )
    temperature: float = Field(0.7, description="Deprecated: The temperature to use when generating text with the model.", deprecated=True)
    max_tokens: Optional[int] = Field(None, description="Deprecated: The maximum number of tokens to generate.", deprecated=True)
    enable_reasoner: bool = Field(
        True,
        description="Deprecated: Whether or not the model should use extended thinking if it is a 'reasoning' style model.",
        deprecated=True,
    )
    reasoning_effort: Optional[Literal["minimal", "low", "medium", "high"]] = Field(
        None, description="Deprecated: The reasoning effort to use when generating text reasoning models.", deprecated=True
    )
    max_reasoning_tokens: int = Field(0, description="Deprecated: Configurable thinking budget for extended thinking.", deprecated=True)
    frequency_penalty: Optional[float] = Field(
        None,
        description="Deprecated: Positive values penalize new tokens based on their existing frequency in the text so far.",
        deprecated=True,
    )
    compatibility_type: Optional[Literal["gguf", "mlx"]] = Field(
        None, description="Deprecated: The framework compatibility type for the model.", deprecated=True
    )
    verbosity: Optional[Literal["low", "medium", "high"]] = Field(
        None, description="Deprecated: Soft control for how verbose model output should be.", deprecated=True
    )
    tier: Optional[str] = Field(None, description="Deprecated: The cost tier for the model (cloud only).", deprecated=True)
    parallel_tool_calls: Optional[bool] = Field(
        False, description="Deprecated: If set to True, enables parallel tool calling.", deprecated=True
    )
    provider_category: Optional[ProviderCategory] = Field(
        None, description="Deprecated: The provider category for the model.", deprecated=True
    )

    @classmethod
    def from_llm_config(cls, llm_config: "LLMConfig") -> "Model":
        """Create a Model instance from an LLMConfig"""
        return cls(
            # New fields
            handle=llm_config.handle or f"{llm_config.provider_name}/{llm_config.model}",
            name=llm_config.model,
            display_name=llm_config.display_name or llm_config.model,
            provider_type=llm_config.model_endpoint_type,
            provider_name=llm_config.provider_name or llm_config.model_endpoint_type,
            model_type="llm",
            max_context_window=llm_config.context_window,
            # Deprecated fields (copy from LLMConfig for backward compatibility)
            model=llm_config.model,
            model_endpoint_type=llm_config.model_endpoint_type,
            model_endpoint=llm_config.model_endpoint,
            model_wrapper=llm_config.model_wrapper,
            context_window=llm_config.context_window,
            put_inner_thoughts_in_kwargs=llm_config.put_inner_thoughts_in_kwargs,
            temperature=llm_config.temperature,
            max_tokens=llm_config.max_tokens,
            enable_reasoner=llm_config.enable_reasoner,
            reasoning_effort=llm_config.reasoning_effort,
            max_reasoning_tokens=llm_config.max_reasoning_tokens,
            frequency_penalty=llm_config.frequency_penalty,
            compatibility_type=llm_config.compatibility_type,
            verbosity=llm_config.verbosity,
            tier=llm_config.tier,
            parallel_tool_calls=llm_config.parallel_tool_calls,
            provider_category=llm_config.provider_category,
        )

    @property
    def model_settings_schema(self) -> Optional[dict]:
        """Returns the JSON schema for the ModelSettings class corresponding to this model's provider."""
        PROVIDER_SETTINGS_MAP = {
            ProviderType.openai: OpenAIModelSettings,
            ProviderType.anthropic: AnthropicModelSettings,
            ProviderType.google_ai: GoogleAIModelSettings,
            ProviderType.google_vertex: GoogleVertexModelSettings,
            ProviderType.azure: AzureModelSettings,
            ProviderType.xai: XAIModelSettings,
            ProviderType.groq: GroqModelSettings,
            ProviderType.deepseek: DeepseekModelSettings,
            ProviderType.together: TogetherModelSettings,
            ProviderType.bedrock: BedrockModelSettings,
        }

        settings_class = PROVIDER_SETTINGS_MAP.get(self.provider_type)
        return settings_class.model_json_schema() if settings_class else None


class EmbeddingModel(EmbeddingConfig, ModelBase):
    model_type: Literal["embedding"] = Field("embedding", description="Type of model (llm or embedding)")
    embedding_dim: int = Field(..., description="The dimension of the embedding")

    # Deprecated fields from EmbeddingConfig - use new field names instead
    embedding_model: str = Field(..., description="Deprecated: Use 'name' field instead. Embedding model name.", deprecated=True)
    embedding_endpoint_type: Literal[
        "openai",
        "anthropic",
        "bedrock",
        "google_ai",
        "google_vertex",
        "azure",
        "groq",
        "ollama",
        "webui",
        "webui-legacy",
        "lmstudio",
        "lmstudio-legacy",
        "llamacpp",
        "koboldcpp",
        "vllm",
        "hugging-face",
        "mistral",
        "together",
        "pinecone",
    ] = Field(..., description="Deprecated: Use 'provider_type' field instead. The endpoint type for the embedding model.", deprecated=True)

    # Additional deprecated EmbeddingConfig fields - kept for backward compatibility
    embedding_endpoint: Optional[str] = Field(None, description="Deprecated: The endpoint for the model.", deprecated=True)
    embedding_chunk_size: Optional[int] = Field(300, description="Deprecated: The chunk size of the embedding.", deprecated=True)
    batch_size: int = Field(32, description="Deprecated: The maximum batch size for processing embeddings.", deprecated=True)
    azure_endpoint: Optional[str] = Field(None, description="Deprecated: The Azure endpoint for the model.", deprecated=True)
    azure_version: Optional[str] = Field(None, description="Deprecated: The Azure version for the model.", deprecated=True)
    azure_deployment: Optional[str] = Field(None, description="Deprecated: The Azure deployment for the model.", deprecated=True)

    @classmethod
    def from_embedding_config(cls, embedding_config: "EmbeddingConfig") -> "EmbeddingModel":
        """Create an EmbeddingModel instance from an EmbeddingConfig"""
        return cls(
            # New fields
            handle=embedding_config.handle or f"{embedding_config.embedding_endpoint_type}/{embedding_config.embedding_model}",
            name=embedding_config.embedding_model,
            display_name=embedding_config.embedding_model,
            provider_type=embedding_config.embedding_endpoint_type,
            provider_name=embedding_config.embedding_endpoint_type,
            model_type="embedding",
            embedding_dim=embedding_config.embedding_dim,
            # Deprecated fields (copy from EmbeddingConfig for backward compatibility)
            embedding_model=embedding_config.embedding_model,
            embedding_endpoint_type=embedding_config.embedding_endpoint_type,
            embedding_endpoint=embedding_config.embedding_endpoint,
            embedding_chunk_size=embedding_config.embedding_chunk_size,
            batch_size=embedding_config.batch_size,
            azure_endpoint=embedding_config.azure_endpoint,
            azure_version=embedding_config.azure_version,
            azure_deployment=embedding_config.azure_deployment,
        )


class ModelSettings(BaseModel):
    """Schema for defining settings for a model"""

    # model: str = Field(..., description="The name of the model.")
    max_output_tokens: int = Field(4096, description="The maximum number of tokens the model can generate.")
    parallel_tool_calls: bool = Field(False, description="Whether to enable parallel tool calling.")


class OpenAIReasoning(BaseModel):
    reasoning_effort: Literal["minimal", "low", "medium", "high"] = Field(
        "minimal", description="The reasoning effort to use when generating text reasoning models"
    )

    # TODO: implement support for this
    # summary: Optional[Literal["auto", "detailed"]] = Field(
    #    None, description="The reasoning summary level to use when generating text reasoning models"
    # )


class OpenAIModelSettings(ModelSettings):
    provider_type: Literal[ProviderType.openai] = Field(ProviderType.openai, description="The type of the provider.")
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
            "parallel_tool_calls": self.parallel_tool_calls,
        }


#    "thinking": {
#        "type": "enabled",
#        "budget_tokens": 10000
#    }


class AnthropicThinking(BaseModel):
    type: Literal["enabled", "disabled"] = Field("enabled", description="The type of thinking to use.")
    budget_tokens: int = Field(1024, description="The maximum number of tokens the model can use for extended thinking.")


class AnthropicModelSettings(ModelSettings):
    provider_type: Literal[ProviderType.anthropic] = Field(ProviderType.anthropic, description="The type of the provider.")
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
            "parallel_tool_calls": self.parallel_tool_calls,
        }


class GeminiThinkingConfig(BaseModel):
    include_thoughts: bool = Field(True, description="Whether to include thoughts in the model's response.")
    thinking_budget: int = Field(1024, description="The thinking budget for the model.")


class GoogleAIModelSettings(ModelSettings):
    provider_type: Literal[ProviderType.google_ai] = Field(ProviderType.google_ai, description="The type of the provider.")
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
            "parallel_tool_calls": self.parallel_tool_calls,
        }


class GoogleVertexModelSettings(GoogleAIModelSettings):
    provider_type: Literal[ProviderType.google_vertex] = Field(ProviderType.google_vertex, description="The type of the provider.")


class AzureModelSettings(ModelSettings):
    """Azure OpenAI model configuration (OpenAI-compatible)."""

    provider_type: Literal[ProviderType.azure] = Field(ProviderType.azure, description="The type of the provider.")
    temperature: float = Field(0.7, description="The temperature of the model.")
    response_format: Optional[ResponseFormatUnion] = Field(None, description="The response format for the model.")

    def _to_legacy_config_params(self) -> dict:
        return {
            "temperature": self.temperature,
            "max_tokens": self.max_output_tokens,
            "response_format": self.response_format,
            "parallel_tool_calls": self.parallel_tool_calls,
        }


class XAIModelSettings(ModelSettings):
    """xAI model configuration (OpenAI-compatible)."""

    provider_type: Literal[ProviderType.xai] = Field(ProviderType.xai, description="The type of the provider.")
    temperature: float = Field(0.7, description="The temperature of the model.")
    response_format: Optional[ResponseFormatUnion] = Field(None, description="The response format for the model.")

    def _to_legacy_config_params(self) -> dict:
        return {
            "temperature": self.temperature,
            "max_tokens": self.max_output_tokens,
            "response_format": self.response_format,
            "parallel_tool_calls": self.parallel_tool_calls,
        }


class GroqModelSettings(ModelSettings):
    """Groq model configuration (OpenAI-compatible)."""

    provider_type: Literal[ProviderType.groq] = Field(ProviderType.groq, description="The type of the provider.")
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

    provider_type: Literal[ProviderType.deepseek] = Field(ProviderType.deepseek, description="The type of the provider.")
    temperature: float = Field(0.7, description="The temperature of the model.")
    response_format: Optional[ResponseFormatUnion] = Field(None, description="The response format for the model.")

    def _to_legacy_config_params(self) -> dict:
        return {
            "temperature": self.temperature,
            "max_tokens": self.max_output_tokens,
            "response_format": self.response_format,
            "parallel_tool_calls": self.parallel_tool_calls,
        }


class TogetherModelSettings(ModelSettings):
    """Together AI model configuration (OpenAI-compatible)."""

    provider_type: Literal[ProviderType.together] = Field(ProviderType.together, description="The type of the provider.")
    temperature: float = Field(0.7, description="The temperature of the model.")
    response_format: Optional[ResponseFormatUnion] = Field(None, description="The response format for the model.")

    def _to_legacy_config_params(self) -> dict:
        return {
            "temperature": self.temperature,
            "max_tokens": self.max_output_tokens,
            "response_format": self.response_format,
            "parallel_tool_calls": self.parallel_tool_calls,
        }


class BedrockModelSettings(ModelSettings):
    """AWS Bedrock model configuration."""

    provider_type: Literal[ProviderType.bedrock] = Field(ProviderType.bedrock, description="The type of the provider.")
    temperature: float = Field(0.7, description="The temperature of the model.")
    response_format: Optional[ResponseFormatUnion] = Field(None, description="The response format for the model.")

    def _to_legacy_config_params(self) -> dict:
        return {
            "temperature": self.temperature,
            "max_tokens": self.max_output_tokens,
            "response_format": self.response_format,
            "parallel_tool_calls": self.parallel_tool_calls,
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
    Field(discriminator="provider_type"),
]
