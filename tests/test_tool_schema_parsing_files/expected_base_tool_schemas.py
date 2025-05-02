def get_rethink_user_memory_schema():
    return {
        "name": "rethink_user_memory",
        "description": (
            "Rewrite memory block for the main agent, new_memory should contain all current "
            "information from the block that is not outdated or inconsistent, integrating any "
            "new information, resulting in a new memory block that is organized, readable, and "
            "comprehensive."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "new_memory": {
                    "type": "string",
                    "description": (
                        "The new memory with information integrated from the memory block. "
                        "If there is no new information, then this should be the same as the "
                        "content in the source block."
                    ),
                },
            },
            "required": ["new_memory"],
        },
    }


def get_finish_rethinking_memory_schema():
    return {
        "name": "finish_rethinking_memory",
        "description": "This function is called when the agent is done rethinking the memory.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    }


def get_store_memories_schema():
    return {
        "name": "store_memories",
        "description": "Persist dialogue that is about to fall out of the agent’s context window.",
        "parameters": {
            "type": "object",
            "properties": {
                "chunks": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "start_index": {"type": "integer", "description": "Zero-based index of the first evicted line in this chunk."},
                            "end_index": {"type": "integer", "description": "Zero-based index of the last evicted line (inclusive)."},
                            "context": {
                                "type": "string",
                                "description": "1-3 sentence paraphrase capturing key facts/details, user preferences, or goals that this chunk reveals—written for future retrieval.",
                            },
                        },
                        "required": ["start_index", "end_index", "context"],
                    },
                    "description": "Each chunk pinpoints a contiguous block of **evicted** lines and provides a short, forward-looking synopsis (`context`) that will be embedded for future semantic lookup.",
                }
            },
            "required": ["chunks"],
        },
    }


def get_search_memory_schema():
    return {
        "name": "search_memory",
        "description": "Look in long-term or earlier-conversation memory only when the user asks about something missing from the visible context. The user’s latest utterance is sent automatically as the main query.",
        "parameters": {
            "type": "object",
            "properties": {
                "convo_keyword_queries": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": (
                        "Extra keywords (e.g., order ID, place name). Use *null* if not appropriate for the latest user message."
                    ),
                },
                "start_minutes_ago": {
                    "type": "integer",
                    "description": (
                        "Newer bound of the time window for results, specified in minutes ago. Use *null* if no lower time bound is needed."
                    ),
                },
                "end_minutes_ago": {
                    "type": "integer",
                    "description": ("Older bound of the time window, in minutes ago. Use *null* if no upper bound is needed."),
                },
            },
            "required": [],
        },
    }
