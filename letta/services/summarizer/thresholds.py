"""Helpers for model-specific compaction/summarization trigger thresholds."""

import re

from letta.constants import SUMMARIZATION_TRIGGER_MULTIPLIER
from letta.schemas.llm_config import LLMConfig

# Matches GPT-5 model names in raw or provider-prefixed format, e.g.:
# - gpt-5
# - gpt-5.1
# - gpt-5-mini
# - openai/gpt-5
# - openai/gpt-5.2
_GPT5_MODEL_FAMILY_RE = re.compile(r"(^|/)gpt-5($|[.-])", re.IGNORECASE)


# TODO: Centralize model name checking/classifying logic into a shared utility module.
# Model string matching (startswith, regex, substring checks) is scattered across
# LLM client code, provider schemas, LLMConfig, and legacy helpers for every provider.
def is_gpt5_model_family(model_name: str | None) -> bool:
    """Return True if model_name belongs to the GPT-5 family."""
    if not model_name:
        return False
    return bool(_GPT5_MODEL_FAMILY_RE.search(model_name.strip()))


def get_compaction_trigger_threshold(llm_config: LLMConfig, *, force_proactive: bool = False) -> int:
    """Return effective compaction trigger threshold for a model config.

    If ``force_proactive`` is True, always use the proactive 90% threshold. This
    is used by Temporal paths that intentionally preserve legacy proactive behavior
    for all models.

    GPT-5 family models trigger compaction proactively at 90% of context window.
    We observed GPT-5 runs hitting max_output_tokens exceeded when prompt input got
    close to the 272k input context window; this aligns GPT-5 behavior with the
    codex harness' proactive 90% compaction policy.

    All other models trigger at 100% of context window.
    """
    return int(llm_config.context_window * SUMMARIZATION_TRIGGER_MULTIPLIER)
