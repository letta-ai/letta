from typing import List

from temporalio import activity

from letta.agents.temporal.types import RefreshContextParams, RefreshContextResult
from letta.helpers import ToolRulesSolver
from letta.helpers.datetime_helpers import get_utc_time
from letta.helpers.reasoning_helper import scrub_inner_thoughts_from_messages
from letta.prompts.prompt_generator import PromptGenerator
from letta.schemas.agent import AgentState
from letta.schemas.message import Message, MessageUpdate
from letta.schemas.user import User
from letta.services.agent_manager import AgentManager
from letta.services.archive_manager import ArchiveManager
from letta.services.message_manager import MessageManager
from letta.services.passage_manager import PassageManager
from letta.utils import united_diff


def _extract_dynamic_section(text: str) -> str:
    start_marker = "</base_instructions>"
    end_marker = "<memory_metadata>"
    start_idx = text.find(start_marker)
    end_idx = text.find(end_marker)
    if start_idx != -1 and end_idx != -1:
        return text[start_marker.__len__() + start_idx : end_idx]
    return text


async def _rebuild_memory(
    agent_state: AgentState,
    in_context_messages: list[Message],
    num_messages: int,
    num_archival_memories: int,
    actor: User,
    message_manager: MessageManager,
    passage_manager: PassageManager,
    agent_manager: AgentManager,
    archive_manager: ArchiveManager,
    tool_rules_solver: ToolRulesSolver,
) -> tuple[list[Message], AgentState]:
    agent_state = await agent_manager.refresh_memory_async(agent_state=agent_state, actor=actor)

    tool_constraint_block = None
    if tool_rules_solver is not None:
        tool_constraint_block = tool_rules_solver.compile_tool_rule_prompts()

    archive = await archive_manager.get_default_archive_for_agent_async(
        agent_id=agent_state.id,
        actor=actor,
    )

    if archive:
        archive_tags = await passage_manager.get_unique_tags_for_archive_async(
            archive_id=archive.id,
            actor=actor,
        )
    else:
        archive_tags = None

    # TODO: This is a pretty brittle pattern established all over our code, need to get rid of this
    curr_system_message = in_context_messages[0]
    curr_system_message_text = curr_system_message.content[0].text

    # extract the dynamic section that includes memory blocks, tool rules, and directories
    # this avoids timestamp comparison issues
    def extract_dynamic_section(text):
        start_marker = "</base_instructions>"
        end_marker = "<memory_metadata>"

        start_idx = text.find(start_marker)
        end_idx = text.find(end_marker)

        if start_idx != -1 and end_idx != -1:
            return text[start_idx:end_idx]
        return text  # fallback to full text if markers not found

    curr_dynamic_section = extract_dynamic_section(curr_system_message_text)

    # generate just the memory string with current state for comparison
    curr_memory_str = agent_state.memory.compile(
        tool_usage_rules=tool_constraint_block, sources=agent_state.sources, max_files_open=agent_state.max_files_open
    )
    new_dynamic_section = extract_dynamic_section(curr_memory_str)

    # compare just the dynamic sections (memory blocks, tool rules, directories)
    if curr_dynamic_section == new_dynamic_section:
        return in_context_messages, agent_state

    memory_edit_timestamp = get_utc_time()

    # size of messages and archival memories
    if num_messages is None:
        num_messages = await message_manager.size_async(actor=actor, agent_id=agent_state.id)
    if num_archival_memories is None:
        num_archival_memories = await passage_manager.agent_passage_size_async(actor=actor, agent_id=agent_state.id)

    new_system_message_str = PromptGenerator.get_system_message_from_compiled_memory(
        system_prompt=agent_state.system,
        memory_with_sources=curr_memory_str,
        in_context_memory_last_edit=memory_edit_timestamp,
        timezone=agent_state.timezone,
        previous_message_count=num_messages - len(in_context_messages),
        archival_memory_size=num_archival_memories,
        archive_tags=archive_tags,
    )

    diff = united_diff(curr_system_message_text, new_system_message_str)
    if len(diff) > 0:
        # [DB Call] Update Messages
        # NOTE: So this is the only write in the activity
        # I think this fine, since it's okay to rewrite the system message, it's idempotent afaik
        new_system_message = await message_manager.update_message_by_id_async(
            curr_system_message.id, message_update=MessageUpdate(content=new_system_message_str), actor=actor
        )
        return [new_system_message] + in_context_messages[1:], agent_state

    else:
        return in_context_messages, agent_state


@activity.defn(name="refresh_context_and_system_message")
async def refresh_context_and_system_message(params: RefreshContextParams) -> RefreshContextResult:
    agent_state = params.agent_state
    in_context_messages = list(params.in_context_messages)
    tool_rules_solver = params.tool_rules_solver
    actor = params.actor

    message_manager = MessageManager()
    passage_manager = PassageManager()
    agent_manager = AgentManager()
    archive_manager = ArchiveManager()

    """Mirror LettaAgentV2._refresh_messages + _rebuild_memory as an activity."""
    num_messages = await message_manager.size_async(
        agent_id=agent_state.id,
        actor=actor,
    )
    num_archival_memories = await passage_manager.agent_passage_size_async(
        agent_id=agent_state.id,
        actor=actor,
    )
    in_context_messages, agent_state = await _rebuild_memory(
        agent_state=agent_state,
        in_context_messages=in_context_messages,
        num_messages=num_messages,
        num_archival_memories=num_archival_memories,
        actor=actor,
        message_manager=message_manager,
        passage_manager=passage_manager,
        agent_manager=agent_manager,
        archive_manager=archive_manager,
        tool_rules_solver=tool_rules_solver,
    )

    in_context_messages = scrub_inner_thoughts_from_messages(in_context_messages, agent_state.llm_config)
    return RefreshContextResult(messages=in_context_messages, agent_state=agent_state)
