from typing import Literal

from pydantic import BaseModel, Field

from letta.prompts.summarizer_prompt import ANTHROPIC_SUMMARY_PROMPT, SHORTER_SUMMARY_PROMPT
from letta.schemas.model import ModelSettingsUnion
from letta.settings import summarizer_settings


class CompactionSettings(BaseModel):
    """Configuration for conversation compaction / summarization.

    ``model`` is the only required user-facing field – it specifies the summarizer
    model handle (e.g. ``"openai/gpt-4o-mini"``). Per-model settings (temperature,
    max tokens, etc.) are derived from the default configuration for that handle.
    """

    # Summarizer model handle (provider/model-name).
    # This is required whenever compaction_settings is provided.
    model: str = Field(
        ...,
        description="Model handle to use for summarization (format: provider/model-name).",
    )

    # Optional provider-specific model settings for the summarizer model
    model_settings: ModelSettingsUnion | None = Field(
        default=None,
        description="Optional model settings used to override defaults for the summarizer model.",
    )

    prompt: str = Field(default=SHORTER_SUMMARY_PROMPT, description="The prompt to use for summarization.")
    prompt_acknowledgement: bool = Field(
        default=False, description="Whether to include an acknowledgement post-prompt (helps prevent non-summary outputs)."
    )
    clip_chars: int | None = Field(
        default=2000, description="The maximum length of the summary in characters. If none, no clipping is performed."
    )

    mode: Literal["all", "sliding_window"] = Field(default="sliding_window", description="The type of summarization technique use.")
    sliding_window_percentage: float = Field(
        default_factory=lambda: summarizer_settings.partial_evict_summarizer_percentage,
        description="The percentage of the context window to keep post-summarization (only used in sliding window mode).",
    )
