from typing import Literal

from pydantic import BaseModel, Field

from letta.schemas.llm_config import LLMConfig
from letta.schemas.model import ModelSettings


class SummarizerConfig(BaseModel):
    # summarizer_model: LLMConfig = Field(default=..., description="The model to use for summarization.")
    model_settings: ModelSettings = Field(default=..., description="The model settings to use for summarization.")
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


def get_default_summarizer_config(model_settings: ModelSettings) -> SummarizerConfig:
    """Build a default SummarizerConfig from global settings for backward compatibility.

    Args:
        llm_config: The LLMConfig to use for the summarizer model (typically the agent's llm_config).

    Returns:
        A SummarizerConfig with default values from global settings.
    """
    from letta.constants import MESSAGE_SUMMARY_REQUEST_ACK
    from letta.prompts import gpt_summarize
    from letta.settings import summarizer_settings

    return SummarizerConfig(
        mode="sliding_window",
        model_settings=model_settings,
        prompt=gpt_summarize.SYSTEM,
        prompt_acknowledgement=MESSAGE_SUMMARY_REQUEST_ACK,
        clip_chars=2000,
        sliding_window_percentage=summarizer_settings.partial_evict_summarizer_percentage,
    )
