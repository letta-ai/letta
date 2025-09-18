from datetime import timedelta

# prepare_messages (reads context, builds input messages)
PREPARE_MESSAGES_ACTIVITY_START_TO_CLOSE_TIMEOUT = timedelta(seconds=15)
PREPARE_MESSAGES_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT = timedelta(minutes=2)

# refresh_context_and_system_message (rebuilds memory/system prompt, scrubs)
REFRESH_CONTEXT_ACTIVITY_START_TO_CLOSE_TIMEOUT = timedelta(seconds=30)
REFRESH_CONTEXT_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT = timedelta(minutes=5)

# llm_request (provider call; can be retried with summarization)
LLM_ACTIVITY_START_TO_CLOSE_TIMEOUT = timedelta(seconds=30)
LLM_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT = timedelta(minutes=30)

# summarize_conversation_history (evicts history, updates message IDs)
SUMMARIZE_ACTIVITY_START_TO_CLOSE_TIMEOUT = timedelta(seconds=60)
SUMMARIZE_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT = timedelta(minutes=10)

# tool execution (used later during _handle_ai_response)
TOOL_EXECUTION_ACTIVITY_START_TO_CLOSE_TIMEOUT = timedelta(seconds=30)
TOOL_EXECUTION_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT = timedelta(minutes=30)

# create_messages (formats tool responses into Letta messages)
CREATE_MESSAGES_ACTIVITY_START_TO_CLOSE_TIMEOUT = timedelta(seconds=5)
CREATE_MESSAGES_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT = timedelta(minutes=1)

# persist_messages (saves messages to database)
PERSIST_MESSAGES_ACTIVITY_START_TO_CLOSE_TIMEOUT = timedelta(seconds=10)
PERSIST_MESSAGES_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT = timedelta(minutes=2)
