from letta.prompts.system_prompts import (
    letta_v1,
    memgpt_chat,
    memgpt_generate_tool,
    memgpt_v2_chat,
    react,
    sleeptime_doc_ingest,
    sleeptime_v2,
    summary_system_prompt,
    voice_chat,
    voice_sleeptime,
    workflow,
)

SYSTEM_PROMPTS = {
    "voice_chat": voice_chat.PROMPT,
    "voice_sleeptime": voice_sleeptime.PROMPT,
    "memgpt_v2_chat": memgpt_v2_chat.PROMPT,
    "sleeptime_v2": sleeptime_v2.PROMPT,
    "react": react.PROMPT,
    "letta_v1": letta_v1.PROMPT,
    "workflow": workflow.PROMPT,
    "memgpt_chat": memgpt_chat.PROMPT,
    "sleeptime_doc_ingest": sleeptime_doc_ingest.PROMPT,
    "summary_system_prompt": summary_system_prompt.PROMPT,
    "memgpt_generate_tool": memgpt_generate_tool.PROMPT,
}

__all__ = ["SYSTEM_PROMPTS"]
