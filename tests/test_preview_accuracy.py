"""
Test that build_request() (preview) produces the exact same LLM request
payload as step() (actual message sending).

Verifies the invariant: the preview endpoint returns what the LLM would
actually receive during a real conversation message.
"""

import copy
import uuid

import pytest

from letta.agents.agent_loop import AgentLoop
from letta.agents.helpers import _prepare_in_context_messages_no_persist_async
from letta.config import LettaConfig
from letta.schemas.agent import CreateAgent
from letta.schemas.block import CreateBlock
from letta.schemas.conversation import CreateConversation
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import LLMCallType, MessageRole
from letta.schemas.letta_request import ClientSkillSchema, ClientToolSchema
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import MessageCreate
from letta.server.server import SyncServer
from letta.services.conversation_manager import ConversationManager


@pytest.fixture(scope="module")
def server():
    config = LettaConfig.load()
    config.save()
    return SyncServer(init_with_default_org_and_user=False)


@pytest.fixture
async def default_organization(server):
    org = await server.organization_manager.create_default_organization_async()
    yield org


@pytest.fixture
async def default_user(server, default_organization):
    user = await server.user_manager.create_default_actor_async(org_id=default_organization.id)
    await server.tool_manager.upsert_base_tools_async(actor=user)
    yield user


@pytest.fixture
async def agent_with_conversation(server, default_user):
    """Create a letta_v1_agent (V3) with memory blocks, tools, and a conversation."""
    agent_state = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name=f"preview_test_{uuid.uuid4().hex[:8]}",
            agent_type="letta_v1_agent",
            memory_blocks=[
                CreateBlock(label="human", value="Test user named Alice"),
                CreateBlock(label="persona", value="I am a helpful test assistant."),
            ],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            include_base_tools=True,
        ),
        actor=default_user,
    )

    conversation_manager = ConversationManager()
    conversation = await conversation_manager.create_conversation(
        agent_id=agent_state.id,
        conversation_create=CreateConversation(),
        actor=default_user,
    )

    yield agent_state, conversation

    await server.agent_manager.delete_agent_async(agent_id=agent_state.id, actor=default_user)


class TestPreviewAccuracy:
    """Verify that build_request() produces the same LLM payload as step()."""

    @pytest.mark.asyncio
    async def test_preview_matches_step_request_data(self, server, default_user, agent_with_conversation):
        """
        Call build_request() (the preview path) and then replicate the exact
        setup that step() performs before calling _step(dry_run=True).
        Both should produce identical request payloads.

        This validates that build_request() faithfully mirrors step()'s
        agent state setup: conversation isolation, client_tools, client_skills,
        conversation-scoped messages, and _initialize_state().
        """
        agent_state, conversation = agent_with_conversation

        # Load agent with the same relationships the router loads
        agent = await server.agent_manager.get_agent_by_id_async(
            agent_state.id,
            default_user,
            include_relationships=["memory", "multi_agent_group", "sources", "tool_exec_environment_variables", "tools", "tags"],
        )

        input_messages = [MessageCreate(role=MessageRole.user, content="Hello, what can you do?")]
        client_skills = [
            ClientSkillSchema(name="test-skill", description="A test skill for debugging", location="/tmp/test-skill/SKILL.md"),
        ]
        client_tools = [
            ClientToolSchema(
                name="client_search",
                description="Search the web",
                parameters={"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]},
            ),
        ]

        # ── 1. Preview path: build_request() ──
        from letta.adapters.letta_llm_request_adapter import LettaLLMRequestAdapter

        preview_loop = AgentLoop.load(agent_state=copy.deepcopy(agent), actor=default_user)
        preview_payload = await preview_loop.build_request(
            input_messages=input_messages,
            client_skills=client_skills,
            client_tools=client_tools,
            conversation_id=conversation.id,
        )

        # ── 2. Step path: replicate step()'s setup, then dry_run ──
        # This mirrors what LettaAgentV3.step() does before entering _step().
        step_loop = AgentLoop.load(agent_state=copy.deepcopy(agent), actor=default_user)
        step_loop._initialize_state()
        step_loop.client_tools = client_tools or []
        step_loop.client_skills = client_skills or []
        step_loop.conversation_id = conversation.id

        # Apply conversation-specific block overrides (same as step())
        step_loop.agent_state = await ConversationManager().apply_isolated_blocks_to_agent_state(
            agent_state=step_loop.agent_state,
            conversation_id=conversation.id,
            actor=default_user,
        )

        # Load conversation-scoped messages (same as step())
        in_context_messages, input_messages_to_persist = await _prepare_in_context_messages_no_persist_async(
            input_messages,
            step_loop.agent_state,
            step_loop.message_manager,
            default_user,
            None,
            conversation_id=conversation.id,
        )

        # Call _step with dry_run=True — identical to what step() would do
        # right before the LLM call
        step_response = step_loop._step(
            run_id=None,
            messages=in_context_messages + input_messages_to_persist,
            llm_adapter=LettaLLMRequestAdapter(
                llm_client=step_loop.llm_client,
                llm_config=step_loop.agent_state.llm_config,
                call_type=LLMCallType.agent_step,
                agent_id=step_loop.agent_state.id,
                agent_tags=step_loop.agent_state.tags,
                org_id=default_user.organization_id,
                user_id=default_user.id,
            ),
            dry_run=True,
            enforce_run_id_set=False,
        )
        step_payload = {}
        async for chunk in step_response:
            step_payload = chunk
            break

        # ── 3. Compare ──
        assert preview_payload == step_payload, (
            "Preview payload diverged from step payload. build_request() must mirror step()'s agent state setup exactly."
        )

    @pytest.mark.asyncio
    async def test_preview_contains_client_skills_and_tools(self, server, default_user, agent_with_conversation):
        """
        Verify the preview payload actually includes client_skills in the system
        prompt and client_tools in the tool list.
        """
        agent_state, conversation = agent_with_conversation

        agent = await server.agent_manager.get_agent_by_id_async(
            agent_state.id,
            default_user,
            include_relationships=["memory", "multi_agent_group", "sources", "tool_exec_environment_variables", "tools", "tags"],
        )

        input_messages = [MessageCreate(role=MessageRole.user, content="Hello")]
        client_skills = [
            ClientSkillSchema(name="my-special-skill", description="Does special things", location="/skills/my-special-skill/SKILL.md"),
        ]
        client_tools = [
            ClientToolSchema(
                name="my_client_tool",
                description="A tool the client provides",
                parameters={"type": "object", "properties": {"arg": {"type": "string"}}},
            ),
        ]

        agent_loop = AgentLoop.load(agent_state=copy.deepcopy(agent), actor=default_user)
        payload = await agent_loop.build_request(
            input_messages=input_messages,
            client_skills=client_skills,
            client_tools=client_tools,
            conversation_id=conversation.id,
        )

        # Verify client_skills appear in the system message
        messages = payload.get("messages", [])
        assert len(messages) > 0, "Payload should contain messages"

        system_message = messages[0]
        system_content = ""
        if isinstance(system_message.get("content"), str):
            system_content = system_message["content"]
        elif isinstance(system_message.get("content"), list):
            system_content = " ".join(
                block.get("text", "") for block in system_message["content"] if isinstance(block, dict) and block.get("type") == "text"
            )

        assert "my-special-skill" in system_content, "Client skill should appear in system prompt"
        assert "<available_skills>" in system_content, "Skills section should be present in system prompt"

        # Verify client_tools appear in the tool list
        tools = payload.get("tools", [])
        tool_names = [t.get("function", {}).get("name") or t.get("name", "") for t in tools]
        assert "my_client_tool" in tool_names, f"Client tool should appear in tool list, got: {tool_names}"

    @pytest.mark.asyncio
    async def test_preview_without_conversation_uses_agent_messages(self, server, default_user, agent_with_conversation):
        """
        When no conversation_id is passed, build_request() should load messages
        from the agent's message_ids (not conversation-scoped).
        """
        agent_state, _ = agent_with_conversation

        agent = await server.agent_manager.get_agent_by_id_async(
            agent_state.id,
            default_user,
            include_relationships=["memory", "multi_agent_group", "sources", "tool_exec_environment_variables", "tools", "tags"],
        )

        input_messages = [MessageCreate(role=MessageRole.user, content="Hello")]

        # Preview without conversation_id
        agent_loop = AgentLoop.load(agent_state=copy.deepcopy(agent), actor=default_user)
        payload = await agent_loop.build_request(
            input_messages=input_messages,
            conversation_id=None,  # No conversation — uses agent-scoped messages
        )

        messages = payload.get("messages", [])
        assert len(messages) >= 2, "Should have at least system message + user message"

        # Preview with conversation_id
        _, conversation = agent_with_conversation
        agent_loop2 = AgentLoop.load(agent_state=copy.deepcopy(agent), actor=default_user)
        payload_with_conv = await agent_loop2.build_request(
            input_messages=input_messages,
            conversation_id=conversation.id,
        )

        messages_with_conv = payload_with_conv.get("messages", [])
        assert len(messages_with_conv) >= 2, "Should have at least system message + user message"

        # The system messages should differ because conversation-scoped system
        # messages include CONVERSATION_ID in metadata
        system_no_conv = str(messages[0])
        system_with_conv = str(messages_with_conv[0])
        assert system_no_conv != system_with_conv, "Conversation-scoped system message should differ from agent-scoped"
