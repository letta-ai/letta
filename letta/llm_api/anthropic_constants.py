# Anthropic-specific constants for the Letta LLM API

# Allowlist of simple tools that work with Anthropic's structured outputs (strict mode).
# These tools have few parameters and no complex nesting, making them safe for strict mode.
# Tools with many optional params or deeply nested structures should use non-strict mode.
#
# Anthropic limitations for strict mode:
# - Max 15 tools can use strict mode per request
# - Max 24 optional parameters per tool (counted recursively in undocumented ways)
# - Schema complexity limits
#
# Rather than trying to count parameters correctly, we allowlist simple tools that we know work.
ANTHROPIC_STRICT_MODE_ALLOWLIST = {
    "Write",  # 2 required params, no optional
    "Read",  # 1 required, 2 simple optional
    "Edit",  # 3 required, 1 simple optional
    "Glob",  # 1 required, 1 simple optional
    "KillBash",  # 1 required, no optional
    "fetch_webpage",  # 1 required, no optional
    "EnterPlanMode",  # no params
    "ExitPlanMode",  # no params
    "Skill",  # 1 required, 1 optional array
    "conversation_search",  # 1 required, 4 simple optional
}

# Maximum number of tools that can use strict mode in a single request
ANTHROPIC_MAX_STRICT_TOOLS = 15
