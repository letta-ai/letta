from letta.schemas.llm_config import LLMConfig
from letta.services.summarizer.thresholds import get_compaction_trigger_threshold, is_gpt5_model_family


def test_is_gpt5_model_family_matches_raw_gpt5_names():
    assert is_gpt5_model_family("gpt-5")
    assert is_gpt5_model_family("gpt-5-mini")
    assert is_gpt5_model_family("gpt-5.2")


def test_is_gpt5_model_family_matches_provider_prefixed_names():
    assert is_gpt5_model_family("openai/gpt-5")
    assert is_gpt5_model_family("openai/gpt-5.1-codex")
    assert is_gpt5_model_family("azure/gpt-5-chat-latest")


def test_is_gpt5_model_family_rejects_non_gpt5_names():
    assert not is_gpt5_model_family("gpt-4.1")
    assert not is_gpt5_model_family("claude-sonnet-4")
    assert not is_gpt5_model_family("gpt-50")


def test_get_compaction_trigger_threshold_uses_90_percent_for_gpt5():
    llm_config = LLMConfig(
        model="gpt-5.2",
        model_endpoint_type="openai",
        model_endpoint="https://api.openai.com/v1",
        context_window=272000,
    )

    assert get_compaction_trigger_threshold(llm_config) == int(272000 * 0.9)


def test_get_compaction_trigger_threshold_uses_100_percent_for_non_gpt5():
    llm_config = LLMConfig(
        model="gpt-4.1",
        model_endpoint_type="openai",
        model_endpoint="https://api.openai.com/v1",
        context_window=128000,
    )

    assert get_compaction_trigger_threshold(llm_config) == 128000


def test_get_compaction_trigger_threshold_force_proactive_uses_90_percent_for_non_gpt5():
    llm_config = LLMConfig(
        model="gpt-4.1",
        model_endpoint_type="openai",
        model_endpoint="https://api.openai.com/v1",
        context_window=128000,
    )

    assert get_compaction_trigger_threshold(llm_config, force_proactive=True) == int(128000 * 0.9)
