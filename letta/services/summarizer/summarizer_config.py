from typing import Literal

from pydantic import BaseModel, Field

from letta.prompts.summarizer_prompt import ALL_PROMPT, SELF_ALL_PROMPT, SELF_SLIDING_PROMPT, SLIDING_PROMPT
from letta.schemas.enums import ProviderType
from letta.schemas.model import ModelSettingsUnion
from letta.settings import summarizer_settings


def get_default_summarizer_model(provider_type: ProviderType | str | None) -> str | None:
    """Get default model for summarization for a provider.

    Accepts either ProviderType enum values or raw provider strings.
    Returns None for unknown/unsupported providers.
    """
    if provider_type is None:
        return None

    if isinstance(provider_type, str):
        try:
            provider_type = ProviderType(provider_type)
        except (ValueError, TypeError):
            return None

    summarizer_defaults = {
        ProviderType.anthropic: "anthropic/claude-haiku-4-5",
        ProviderType.openai: "openai/gpt-5-mini",
        ProviderType.google_ai: "google_ai/gemini-2.5-flash",
        ProviderType.letta: "letta/auto",
    }
    return summarizer_defaults.get(provider_type)


def get_default_prompt_for_mode(mode: Literal["all", "sliding_window", "self_compact_all", "self_compact_sliding_window"]) -> str:
    """Get the default prompt for a given compaction mode.
    Also used in /summarize endpoint if mode is changed and prompt is not explicitly set."""
    if mode == "self_compact_sliding_window":
        return SELF_SLIDING_PROMPT
    elif mode == "self_compact_all":
        return SELF_ALL_PROMPT
    elif mode == "sliding_window":
        return SLIDING_PROMPT
    else:  # all
        return ALL_PROMPT


class CompactionSettings(BaseModel):
    """Configuration for conversation compaction / summarization.

    Per-model settings (temperature,
    max tokens, etc.) are derived from the default configuration for that handle.
    """

    # Summarizer model handle (provider/model-name).
    # If None, uses lightweight provider-specific defaults (e.g., haiku for Anthropic, gpt-5-mini for OpenAI).
    model: str | None = Field(
        default=None,
        description="Model handle to use for sliding_window/all summarization (format: provider/model-name). If None, uses lightweight provider-specific defaults.",
    )

    # Optional provider-specific model settings for the summarizer model
    model_settings: ModelSettingsUnion | None = Field(
        default=None,
        description="Optional model settings used to override defaults for the summarizer model.",
    )

    prompt: str | None = Field(default=None, description="The prompt to use for summarization. If None, uses mode-specific default.")
    prompt_acknowledgement: bool = Field(
        default=False, description="Whether to include an acknowledgement post-prompt (helps prevent non-summary outputs)."
    )
    clip_chars: int | None = Field(
        default=50000, description="The maximum length of the summary in characters. If none, no clipping is performed."
    )

    mode: Literal["all", "sliding_window", "self_compact_all", "self_compact_sliding_window"] = Field(
        default="sliding_window", description="The type of summarization technique use."
    )
    sliding_window_percentage: float = Field(
        default_factory=lambda: summarizer_settings.partial_evict_summarizer_percentage,
        description="The percentage of the context window to keep post-summarization (only used in sliding window modes).",
    )

    # Called upon agent creation and if mode is changed in summarize endpoint request
    def set_mode_specific_prompt(self):
        """Set mode-specific default prompt if none provided."""
        if self.prompt is None:
            self.prompt = get_default_prompt_for_mode(self.mode)
        return self
