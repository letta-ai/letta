from typing import Literal

from pydantic import BaseModel, Field

from letta.schemas.model import ModelSettingsUnion


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

    prompt: str = Field(default=..., description="The prompt to use for summarization.")
    prompt_acknowledgement: str = Field(
        default=..., description="Whether to include an acknowledgement post-prompt (helps prevent non-summary outputs)."
    )
    clip_chars: int | None = Field(
        default=2000, description="The maximum length of the summary in characters. If none, no clipping is performed."
    )

    mode: Literal["all", "sliding_window"] = Field(default="sliding_window", description="The type of summarization technique use.")
    sliding_window_percentage: float = Field(
        default=0.3, description="The percentage of the context window to keep post-summarization (only used in sliding window mode)."
    )


def get_default_compaction_settings(model_handle: str) -> CompactionSettings:
    """Build a default :class:`CompactionSettings` from a model handle.

    Args:
        model_handle: The model handle to use for summarization
            (format: provider/model-name).

    Returns:
        A :class:`CompactionSettings` populated with sane defaults.
    """

    from letta.constants import MESSAGE_SUMMARY_REQUEST_ACK
    from letta.prompts import gpt_summarize
    from letta.settings import summarizer_settings

    return CompactionSettings(
        mode="sliding_window",
        model=model_handle,
        model_settings=None,
        prompt=gpt_summarize.SYSTEM,
        prompt_acknowledgement=MESSAGE_SUMMARY_REQUEST_ACK,
        clip_chars=2000,
        sliding_window_percentage=summarizer_settings.partial_evict_summarizer_percentage,
    )
