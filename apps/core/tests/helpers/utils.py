import functools
import time
from typing import Optional, Union

from letta.functions.functions import parse_source_code
from letta.functions.schema_generator import generate_schema
from letta.schemas.agent import AgentState, CreateAgent, UpdateAgent
from letta.schemas.enums import MessageRole
from letta.schemas.file import FileAgent
from letta.schemas.memory import ContextWindowOverview
from letta.schemas.tool import Tool
from letta.schemas.user import User
from letta.schemas.user import User as PydanticUser
from letta.server.server import SyncServer


def retry_until_threshold(threshold=0.5, max_attempts=10, sleep_time_seconds=4):
    """
    Decorator to retry a test until a failure threshold is crossed.

    :param threshold: Expected passing rate (e.g., 0.5 means 50% success rate expected).
    :param max_attempts: Maximum number of attempts to retry the test.
    """

    def decorator_retry(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            success_count = 0
            failure_count = 0

            for attempt in range(max_attempts):
                try:
                    func(*args, **kwargs)
                    success_count += 1
                except Exception as e:
                    failure_count += 1
                    print(f"\033[93mAn attempt failed with error:\n{e}\033[0m")

                time.sleep(sleep_time_seconds)

            rate = success_count / max_attempts
            if rate >= threshold:
                print(f"Test met expected passing rate of {threshold:.2f}. Actual rate: {success_count}/{max_attempts}")
            else:
                raise AssertionError(
                    f"Test did not meet expected passing rate of {threshold:.2f}. Actual rate: {success_count}/{max_attempts}"
                )

        return wrapper

    return decorator_retry


def retry_until_success(max_attempts=10, sleep_time_seconds=4):
    """
    Decorator to retry a function until it succeeds or the maximum number of attempts is reached.

    :param max_attempts: Maximum number of attempts to retry the function.
    :param sleep_time_seconds: Time to wait between attempts, in seconds.
    """

    def decorator_retry(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):

            for attempt in range(1, max_attempts + 1):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    print(f"\033[93mAttempt {attempt} failed with error:\n{e}\033[0m")

                    if attempt == max_attempts:
                        raise

                    time.sleep(sleep_time_seconds)

        return wrapper

    return decorator_retry


def cleanup(server: SyncServer, agent_uuid: str, actor: User):
    # Clear all agents
    agent_states = server.agent_manager.list_agents(name=agent_uuid, actor=actor)

    for agent_state in agent_states:
        server.agent_manager.delete_agent(agent_id=agent_state.id, actor=actor)


# Utility functions
def create_tool_from_func(func: callable):
    return Tool(
        name=func.__name__,
        description="",
        source_type="python",
        tags=[],
        source_code=parse_source_code(func),
        json_schema=generate_schema(func, None),
    )


def comprehensive_agent_checks(agent: AgentState, request: Union[CreateAgent, UpdateAgent], actor: PydanticUser):
    # Assert scalar fields
    assert agent.system == request.system, f"System prompt mismatch: {agent.system} != {request.system}"
    assert agent.description == request.description, f"Description mismatch: {agent.description} != {request.description}"
    assert agent.metadata == request.metadata, f"Metadata mismatch: {agent.metadata} != {request.metadata}"

    # Assert agent env vars
    if hasattr(request, "tool_exec_environment_variables"):
        for agent_env_var in agent.tool_exec_environment_variables:
            assert agent_env_var.key in request.tool_exec_environment_variables
            assert request.tool_exec_environment_variables[agent_env_var.key] == agent_env_var.value
            assert agent_env_var.organization_id == actor.organization_id

    # Assert agent type
    if hasattr(request, "agent_type"):
        assert agent.agent_type == request.agent_type, f"Agent type mismatch: {agent.agent_type} != {request.agent_type}"

    # Assert LLM configuration
    assert agent.llm_config == request.llm_config, f"LLM config mismatch: {agent.llm_config} != {request.llm_config}"

    # Assert embedding configuration
    assert (
        agent.embedding_config == request.embedding_config
    ), f"Embedding config mismatch: {agent.embedding_config} != {request.embedding_config}"

    # Assert memory blocks
    if hasattr(request, "memory_blocks"):
        assert len(agent.memory.blocks) == len(request.memory_blocks) + len(
            request.block_ids
        ), f"Memory blocks count mismatch: {len(agent.memory.blocks)} != {len(request.memory_blocks) + len(request.block_ids)}"
        memory_block_values = {block.value for block in agent.memory.blocks}
        expected_block_values = {block.value for block in request.memory_blocks}
        assert expected_block_values.issubset(
            memory_block_values
        ), f"Memory blocks mismatch: {expected_block_values} not in {memory_block_values}"

    # Assert tools
    assert len(agent.tools) == len(request.tool_ids), f"Tools count mismatch: {len(agent.tools)} != {len(request.tool_ids)}"
    assert {tool.id for tool in agent.tools} == set(
        request.tool_ids
    ), f"Tools mismatch: {set(tool.id for tool in agent.tools)} != {set(request.tool_ids)}"

    # Assert sources
    assert len(agent.sources) == len(request.source_ids), f"Sources count mismatch: {len(agent.sources)} != {len(request.source_ids)}"
    assert {source.id for source in agent.sources} == set(
        request.source_ids
    ), f"Sources mismatch: {set(source.id for source in agent.sources)} != {set(request.source_ids)}"

    # Assert tags
    assert set(agent.tags) == set(request.tags), f"Tags mismatch: {set(agent.tags)} != {set(request.tags)}"

    # Assert tool rules
    if request.tool_rules:
        assert len(agent.tool_rules) == len(
            request.tool_rules
        ), f"Tool rules count mismatch: {len(agent.tool_rules)} != {len(request.tool_rules)}"
        assert all(
            any(rule.tool_name == req_rule.tool_name for rule in agent.tool_rules) for req_rule in request.tool_rules
        ), f"Tool rules mismatch: {agent.tool_rules} != {request.tool_rules}"

    # Assert message_buffer_autoclear
    if not request.message_buffer_autoclear is None:
        assert agent.message_buffer_autoclear == request.message_buffer_autoclear


def validate_context_window_overview(
    agent_state: AgentState, overview: ContextWindowOverview, attached_file: Optional[FileAgent] = None
) -> None:
    """Validate common sense assertions for ContextWindowOverview"""

    # 1. Current context size should not exceed maximum
    assert (
        overview.context_window_size_current <= overview.context_window_size_max
    ), f"Current context size ({overview.context_window_size_current}) exceeds maximum ({overview.context_window_size_max})"

    # 2. All token counts should be non-negative
    assert overview.num_tokens_system >= 0, "System token count cannot be negative"
    assert overview.num_tokens_core_memory >= 0, "Core memory token count cannot be negative"
    assert overview.num_tokens_external_memory_summary >= 0, "External memory summary token count cannot be negative"
    assert overview.num_tokens_summary_memory >= 0, "Summary memory token count cannot be negative"
    assert overview.num_tokens_messages >= 0, "Messages token count cannot be negative"
    assert overview.num_tokens_functions_definitions >= 0, "Functions definitions token count cannot be negative"

    # 3. Token components should sum to total
    expected_total = (
        overview.num_tokens_system
        + overview.num_tokens_core_memory
        + overview.num_tokens_external_memory_summary
        + overview.num_tokens_summary_memory
        + overview.num_tokens_messages
        + overview.num_tokens_functions_definitions
    )
    assert (
        overview.context_window_size_current == expected_total
    ), f"Token sum ({expected_total}) doesn't match current size ({overview.context_window_size_current})"

    # 4. Message count should match messages list length
    assert (
        len(overview.messages) == overview.num_messages
    ), f"Messages list length ({len(overview.messages)}) doesn't match num_messages ({overview.num_messages})"

    # 5. If summary_memory is None, its token count should be 0
    if overview.summary_memory is None:
        assert overview.num_tokens_summary_memory == 0, "Summary memory is None but has non-zero token count"

    # 7. External memory summary consistency
    assert overview.num_tokens_external_memory_summary > 0, "External memory summary exists but has zero token count"

    # 8. System prompt consistency
    assert overview.num_tokens_system > 0, "System prompt exists but has zero token count"

    # 9. Core memory consistency
    assert overview.num_tokens_core_memory > 0, "Core memory exists but has zero token count"

    # 10. Functions definitions consistency
    assert overview.num_tokens_functions_definitions > 0, "Functions definitions exist but have zero token count"
    assert len(overview.functions_definitions) > 0, "Functions definitions list should not be empty"

    # 11. Memory counts should be non-negative
    assert overview.num_archival_memory >= 0, "Archival memory count cannot be negative"
    assert overview.num_recall_memory >= 0, "Recall memory count cannot be negative"

    # 12. Context window max should be positive
    assert overview.context_window_size_max > 0, "Maximum context window size must be positive"

    # 13. If there are messages, check basic structure
    # At least one message should be system message (typical pattern)
    has_system_message = any(msg.role == MessageRole.system for msg in overview.messages)
    # This is a soft assertion - log warning instead of failing
    if not has_system_message:
        print("Warning: No system message found in messages list")

    # Average tokens per message should be reasonable (typically > 0)
    avg_tokens_per_message = overview.num_tokens_messages / overview.num_messages
    assert avg_tokens_per_message >= 0, "Average tokens per message should be non-negative"

    # 16. Check attached file is visible
    if attached_file:
        assert attached_file.visible_content in overview.core_memory
        assert '<file status="open"' in overview.core_memory
        assert "</file>" in overview.core_memory

    # Check for tools
    assert overview.num_tokens_functions_definitions > 0
    assert len(overview.functions_definitions) > 0
