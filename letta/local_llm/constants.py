# Import constants from settings to avoid circular import
# (settings.py imports from this module indirectly through log.py)
# Import this here to avoid circular dependency at module level
from letta.local_llm.llm_chat_completion_wrappers.chatml import ChatMLInnerMonologueWrapper
from letta.settings import DEFAULT_WRAPPER_NAME, INNER_THOUGHTS_KWARG

DEFAULT_WRAPPER = ChatMLInnerMonologueWrapper
INNER_THOUGHTS_KWARG_VERTEX = "thinking"
VALID_INNER_THOUGHTS_KWARGS = ("thinking", "inner_thoughts")
INNER_THOUGHTS_KWARG_DESCRIPTION = "Deep inner monologue private to you only."
INNER_THOUGHTS_KWARG_DESCRIPTION_GO_FIRST = f"Deep inner monologue private to you only. Think before you act, so always generate arg '{INNER_THOUGHTS_KWARG}' first before any other arg."
INNER_THOUGHTS_CLI_SYMBOL = "💭"

ASSISTANT_MESSAGE_CLI_SYMBOL = "🤖"
