from datetime import timedelta

from temporalio.common import RetryPolicy

# prepare_messages (reads context, builds input messages)
PREPARE_MESSAGES_ACTIVITY_START_TO_CLOSE_TIMEOUT = timedelta(seconds=30)
PREPARE_MESSAGES_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT = timedelta(minutes=2)

# refresh_context_and_system_message (rebuilds memory/system prompt, scrubs)
REFRESH_CONTEXT_ACTIVITY_START_TO_CLOSE_TIMEOUT = timedelta(seconds=60)
REFRESH_CONTEXT_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT = timedelta(minutes=5)

# llm_request (provider call; can be retried with summarization)
LLM_ACTIVITY_START_TO_CLOSE_TIMEOUT = timedelta(seconds=300)
LLM_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT = timedelta(minutes=30)

# Temporal-native retry policy for LLM activity calls.
# - Retries transient LLM* errors with exponential backoff
# - Avoids auto-retry on context window issues (handled in workflow via summarization)
# - Avoids auto-retry on invalid/unsuccessful response parsing
LLM_ACTIVITY_RETRY_POLICY = RetryPolicy(
    initial_interval=timedelta(seconds=1),
    backoff_coefficient=2.0,
    maximum_interval=timedelta(seconds=30),
    maximum_attempts=5,
    non_retryable_error_types=[
        # Handled explicitly in workflow to alter inputs then re-call
        "ContextWindowExceededError",
        # Treat parsing/invalid response as non-retryable at activity layer
        "ValueError",
        "LLMJSONParsingError",
        # Non-retryable LLM API errors
        "LLMBadRequestError",
        "LLMAuthenticationError",
        "LLMPermissionDeniedError",
        "LLMNotFoundError",
        "LLMUnprocessableEntityError",
    ],
)

# summarize_conversation_history (evicts history, updates message IDs)
SUMMARIZE_ACTIVITY_START_TO_CLOSE_TIMEOUT = timedelta(seconds=300)
SUMMARIZE_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT = timedelta(minutes=10)

# tool execution (used later during _handle_ai_response)
TOOL_EXECUTION_ACTIVITY_START_TO_CLOSE_TIMEOUT = timedelta(seconds=600)
TOOL_EXECUTION_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT = timedelta(minutes=30)

# create_step (saves step to agent state)
CREATE_STEP_ACTIVITY_START_TO_CLOSE_TIMEOUT = timedelta(seconds=60)
CREATE_STEP_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT = timedelta(minutes=30)

# create_messages (saves messages to agent state)
CREATE_MESSAGES_ACTIVITY_START_TO_CLOSE_TIMEOUT = timedelta(seconds=60)
CREATE_MESSAGES_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT = timedelta(minutes=30)

# update run metadata (saves status to run)
UPDATE_RUN_ACTIVITY_START_TO_CLOSE_TIMEOUT = timedelta(seconds=60)
UPDATE_RUN_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT = timedelta(minutes=30)
