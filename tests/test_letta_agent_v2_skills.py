import re
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from letta.agents.letta_agent_v2 import LettaAgentV2
from letta.schemas.agent import AgentState, AgentType
from letta.schemas.block import Block
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import MessageRole
from letta.schemas.letta_message_content import TextContent
from letta.schemas.letta_request import ClientSkillSchema
from letta.schemas.llm_config import LLMConfig
from letta.schemas.memory import Memory
from letta.schemas.message import Message
from letta.schemas.user import User


def _make_agent(memory: Memory) -> LettaAgentV2:
    actor = User(
        id=f"user-{uuid.uuid4()}",
        organization_id=f"org-{uuid.uuid4()}",
        name="test-user",
    )

    agent_state = AgentState(
        id=f"agent-{uuid.uuid4()}",
        name="skills-test-agent",
        agent_type=AgentType.letta_v1_agent,
        llm_config=LLMConfig.default_config("gpt-4o-mini"),
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
        tags=[],
        memory=memory,
        system="You are a helpful assistant.",
        tools=[],
        sources=[],
        blocks=[],
    )

    with patch("letta.agents.letta_agent_v2.LLMClient.create", return_value=MagicMock()):
        return LettaAgentV2(agent_state=agent_state, actor=actor)


def _build_memory_with_literal_tag_refs() -> Memory:
    return Memory(
        agent_type=AgentType.letta_v1_agent,
        git_enabled=True,
        blocks=[
            Block(label="system/human", value="human data", limit=500),
            Block(
                label="system/project/notes",
                value="Notes mention `<available_skills>` as literal documentation text.",
                limit=500,
            ),
            Block(label="system/persona", value="persona data", limit=500),
        ],
    )


def _assert_one_structural_skills_block_at_tail(text: str) -> None:
    system_block_ends = [m.end() for m in re.finditer(r"</memory>", text)]
    assert system_block_ends, "Expected system blocks in test prompt"
    tail = text[max(system_block_ends) :]
    assert tail.count("<available_skills>") == 1
    assert tail.count("</available_skills>") == 1


def test_generate_request_system_prompt_appends_skills_and_preserves_literals():
    memory = _build_memory_with_literal_tag_refs()
    agent = _make_agent(memory=memory)
    old_text = memory.compile()

    new_skills = memory.compile_available_skills(
        client_skills=[ClientSkillSchema(name="fresh-skill", description="fresh", location="/tmp/fresh/SKILL.md")]
    )
    new_text = agent.generate_request_system_prompt(
        client_skills=[ClientSkillSchema(name="fresh-skill", description="fresh", location="/tmp/fresh/SKILL.md")],
        current_system_message=Message(role=MessageRole.system, content=[TextContent(text=old_text)], agent_id=agent.agent_state.id),
    )

    _assert_one_structural_skills_block_at_tail(new_text)
    assert "`<available_skills>`" in new_text
    assert "/tmp/fresh" in new_text
    assert "SKILL.md (fresh)" in new_text
    assert new_text.rstrip().endswith(new_skills.rstrip())


@pytest.mark.asyncio
async def test_refresh_messages_does_not_repair_or_persist_system_prompt():
    memory = Memory(
        agent_type=AgentType.letta_v1_agent,
        git_enabled=True,
        blocks=[
            Block(label="system/human", value="human data", limit=500),
            Block(label="skills/agent-skill", value="agent skill data", description="agent skill", limit=500),
        ],
    )
    agent = _make_agent(memory=memory)

    stale_skills = [ClientSkillSchema(name="stale-client-skill", description="client", location="/tmp/client/SKILL.md")]
    bloated_text = memory.compile(client_skills=stale_skills)
    # Simulate historical accumulation of request-scoped skills in persisted message.
    bloated_text = bloated_text.rstrip("\n") + "\n\n" + memory.compile_available_skills(client_skills=stale_skills).lstrip("\n")
    bloated_text = bloated_text.rstrip("\n") + "\n\n" + memory.compile_available_skills(client_skills=stale_skills).lstrip("\n")

    system_message = Message(
        id=f"message-{uuid.uuid4()}",
        role=MessageRole.system,
        content=[TextContent(text=bloated_text)],
        agent_id=agent.agent_state.id,
    )
    user_message = Message(role=MessageRole.user, content=[TextContent(text="hello")], agent_id=agent.agent_state.id)

    agent.client_skills = stale_skills

    agent.message_manager.update_message_by_id_async = AsyncMock()

    refreshed_messages = await agent._refresh_messages([system_message, user_message])

    agent.message_manager.update_message_by_id_async.assert_not_called()

    final_system_text = refreshed_messages[0].content[0].text
    assert final_system_text == bloated_text


def test_generate_request_system_prompt_includes_request_scoped_client_skills_without_mutating_storage():
    memory = _build_memory_with_literal_tag_refs()
    agent = _make_agent(memory=memory)

    old_text = memory.compile()

    system_message = Message(
        id=f"message-{uuid.uuid4()}",
        role=MessageRole.system,
        content=[TextContent(text=old_text)],
        agent_id=agent.agent_state.id,
    )

    request_system_text = agent.generate_request_system_prompt(
        client_skills=[ClientSkillSchema(name="fresh-skill", description="fresh", location="/tmp/fresh/SKILL.md")],
        current_system_message=system_message,
    )

    _assert_one_structural_skills_block_at_tail(request_system_text)
    assert "`<available_skills>`" in request_system_text
    assert "/tmp/fresh" in request_system_text
    assert "SKILL.md (fresh)" in request_system_text
    # Ensure original persisted message object is unchanged (request-scoped only)
    assert system_message.content[0].text == old_text


def test_generate_request_system_prompt_is_stable_for_same_stored_system_prompt():
    memory = _build_memory_with_literal_tag_refs()
    agent = _make_agent(memory=memory)

    stored_text = memory.compile()

    system_message = Message(
        id=f"message-{uuid.uuid4()}",
        role=MessageRole.system,
        content=[TextContent(text=stored_text)],
        agent_id=agent.agent_state.id,
    )

    # Repeated calls against the same stored prompt should be identical.
    request_system_text = None
    for _ in range(3):
        next_text = agent.generate_request_system_prompt(
            client_skills=[ClientSkillSchema(name="fresh-skill", description="fresh", location="/tmp/fresh/SKILL.md")],
            current_system_message=system_message,
        )
        if request_system_text is None:
            request_system_text = next_text
        else:
            assert next_text == request_system_text

    assert request_system_text is not None
    _assert_one_structural_skills_block_at_tail(request_system_text)
    assert request_system_text.count("SKILL.md (fresh)") == 1


@pytest.mark.asyncio
async def test_rebuild_memory_does_not_persist_client_skill_block():
    memory = Memory(
        agent_type=AgentType.letta_v1_agent,
        git_enabled=True,
        blocks=[Block(label="system/human", value="human data", limit=500)],
    )
    agent = _make_agent(memory=memory)
    agent.client_skills = [ClientSkillSchema(name="client-only-skill", description="client", location="/tmp/client/SKILL.md")]

    system_message = Message(
        id=f"message-{uuid.uuid4()}",
        role=MessageRole.system,
        content=[TextContent(text="stale system prompt")],
        agent_id=agent.agent_state.id,
    )
    user_message = Message(role=MessageRole.user, content=[TextContent(text="hello")], agent_id=agent.agent_state.id)

    agent.agent_manager.refresh_memory_async = AsyncMock(return_value=agent.agent_state)
    agent.agent_manager.refresh_file_blocks = AsyncMock(return_value=agent.agent_state)
    agent.archive_manager.get_default_archive_for_agent_async = AsyncMock(return_value=None)

    async def _fake_update(message_id, message_update, actor):
        updated = system_message.model_copy(deep=True)
        updated.content = [TextContent(text=message_update.content)]
        return updated

    agent.message_manager.update_message_by_id_async = AsyncMock(side_effect=_fake_update)

    await agent._rebuild_memory(
        in_context_messages=[system_message, user_message],
        num_messages=2,
        num_archival_memories=0,
        force=True,
    )

    persisted_system_text = agent.message_manager.update_message_by_id_async.call_args.kwargs["message_update"].content
    assert "<available_skills>" not in persisted_system_text
    assert "client-only-skill" not in persisted_system_text
