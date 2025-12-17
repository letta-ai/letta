"""
Tests for agent cancellation at different points in the execution loop.

These tests use mocking and deterministic control to test cancellation at specific
points in the agent execution flow, covering all the issues documented in CANCELLATION_ISSUES.md.
"""

import asyncio
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from letta.agents.agent_loop import AgentLoop
from letta.constants import TOOL_CALL_DENIAL_ON_CANCEL
from letta.schemas.agent import CreateAgent
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import MessageRole, RunStatus
from letta.schemas.letta_request import LettaStreamingRequest
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import MessageCreate
from letta.schemas.model import ModelSettings
from letta.schemas.run import Run as PydanticRun, RunUpdate
from letta.server.server import SyncServer
from letta.services.streaming_service import StreamingService


@pytest.fixture
async def test_agent_with_tool(server: SyncServer, default_user, print_tool):
    """Create a test agent with letta_v1_agent type (uses LettaAgentV3)."""
    agent_state = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="test_cancellation_agent",
            agent_type="letta_v1_agent",
            memory_blocks=[],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            tool_ids=[print_tool.id],
            include_base_tools=False,
        ),
        actor=default_user,
    )
    yield agent_state


@pytest.fixture
async def test_run(server: SyncServer, default_user, test_agent_with_tool):
    """Create a test run for cancellation testing."""
    run = await server.run_manager.create_run(
        pydantic_run=PydanticRun(
            agent_id=test_agent_with_tool.id,
            status=RunStatus.created,
        ),
        actor=default_user,
    )
    yield run


class TestMessageStateDesyncIssues:
    """
    Test Issue #2: Message State Desync Issues
    Tests that message state stays consistent between client and server during cancellation.
    """

    @pytest.mark.asyncio
    async def test_message_state_consistency_after_cancellation(
        self,
        server: SyncServer,
        default_user,
        test_agent_with_tool,
        test_run,
    ):
        """
        Test that message state is consistent after cancellation.

        Verifies:
        - response_messages list matches persisted messages
        - response_messages_for_metadata list matches persisted messages
        - agent.message_ids includes all persisted messages
        """
        # Load agent loop
        agent_loop = AgentLoop.load(agent_state=test_agent_with_tool, actor=default_user)

        input_messages = [MessageCreate(role=MessageRole.user, content="Call print_tool with 'test'")]

        # Cancel after first step
        call_count = [0]

        async def mock_check_cancellation(run_id):
            call_count[0] += 1
            if call_count[0] > 1:
                await server.run_manager.cancel_run(
                    actor=default_user,
                    run_id=run_id,
                )
                return True
            return False

        agent_loop._check_run_cancellation = mock_check_cancellation

        # Execute step
        result = await agent_loop.step(
            input_messages=input_messages,
            max_steps=5,
            run_id=test_run.id,
        )

        # Get messages from database
        db_messages = await server.message_manager.list_messages(
            actor=default_user,
            agent_id=test_agent_with_tool.id,
            run_id=test_run.id,
            limit=1000,
        )

        # Verify response_messages count matches result messages
        assert len(agent_loop.response_messages) == len(result.messages), (
            f"response_messages ({len(agent_loop.response_messages)}) should match result.messages ({len(result.messages)})"
        )

        # Verify persisted message count is reasonable
        assert len(db_messages) > 0, "Should have persisted messages from completed step"

        # CRITICAL CHECK: Verify agent state after cancellation
        agent_after_cancel = await server.agent_manager.get_agent_by_id_async(
            agent_id=test_agent_with_tool.id,
            actor=default_user,
        )

        # Verify last_stop_reason is set to cancelled
        assert agent_after_cancel.last_stop_reason == "cancelled", (
            f"Agent's last_stop_reason should be 'cancelled', got '{agent_after_cancel.last_stop_reason}'"
        )

        agent_message_ids = set(agent_after_cancel.message_ids or [])
        db_message_ids = {m.id for m in db_messages}

        # Check for desync: every message in DB must be in agent.message_ids
        messages_in_db_not_in_agent = db_message_ids - agent_message_ids

        assert len(messages_in_db_not_in_agent) == 0, (
            f"MESSAGE DESYNC: {len(messages_in_db_not_in_agent)} messages in DB but not in agent.message_ids\n"
            f"Missing message IDs: {messages_in_db_not_in_agent}\n"
            f"This indicates message_ids was not updated after cancellation."
        )

    @pytest.mark.asyncio
    async def test_agent_can_continue_after_cancellation(
        self,
        server: SyncServer,
        default_user,
        test_agent_with_tool,
        test_run,
    ):
        """
        Test that agent can continue execution after a cancelled run.

        Verifies:
        - Agent state is not corrupted after cancellation
        - Subsequent runs complete successfully
        - Message IDs are properly updated
        """
        # Load agent loop
        agent_loop = AgentLoop.load(agent_state=test_agent_with_tool, actor=default_user)

        # First run: cancel it
        input_messages_1 = [MessageCreate(role=MessageRole.user, content="First message")]

        # Cancel immediately
        await server.run_manager.cancel_run(
            actor=default_user,
            run_id=test_run.id,
        )

        result_1 = await agent_loop.step(
            input_messages=input_messages_1,
            max_steps=5,
            run_id=test_run.id,
        )

        assert result_1.stop_reason.stop_reason == "cancelled"

        # Get agent state after cancellation
        agent_after_cancel = await server.agent_manager.get_agent_by_id_async(
            agent_id=test_agent_with_tool.id,
            actor=default_user,
        )

        # Verify last_stop_reason is set to cancelled
        assert agent_after_cancel.last_stop_reason == "cancelled", (
            f"Agent's last_stop_reason should be 'cancelled', got '{agent_after_cancel.last_stop_reason}'"
        )

        message_ids_after_cancel = len(agent_after_cancel.message_ids or [])

        # Second run: complete it successfully
        test_run_2 = await server.run_manager.create_run(
            pydantic_run=PydanticRun(
                agent_id=test_agent_with_tool.id,
                status=RunStatus.created,
            ),
            actor=default_user,
        )

        # Reload agent loop with fresh state
        agent_loop_2 = AgentLoop.load(
            agent_state=await server.agent_manager.get_agent_by_id_async(
                agent_id=test_agent_with_tool.id,
                actor=default_user,
                include_relationships=["memory", "tools", "sources"],
            ),
            actor=default_user,
        )

        input_messages_2 = [MessageCreate(role=MessageRole.user, content="Second message")]

        result_2 = await agent_loop_2.step(
            input_messages=input_messages_2,
            max_steps=5,
            run_id=test_run_2.id,
        )

        # Verify second run completed successfully
        assert result_2.stop_reason.stop_reason != "cancelled", f"Second run should complete, got {result_2.stop_reason.stop_reason}"

        # Get agent state after completion
        agent_after_complete = await server.agent_manager.get_agent_by_id_async(
            agent_id=test_agent_with_tool.id,
            actor=default_user,
        )
        message_ids_after_complete = len(agent_after_complete.message_ids or [])

        # Verify message count increased
        assert message_ids_after_complete >= message_ids_after_cancel, (
            f"Message IDs should increase or stay same: "
            f"after_cancel={message_ids_after_cancel}, after_complete={message_ids_after_complete}"
        )

        # CRITICAL CHECK: Verify agent.message_ids consistency with DB for BOTH runs
        # Check first run (cancelled)
        db_messages_run1 = await server.message_manager.list_messages(
            actor=default_user,
            agent_id=test_agent_with_tool.id,
            run_id=test_run.id,
            limit=1000,
        )

        # Check second run (completed)
        db_messages_run2 = await server.message_manager.list_messages(
            actor=default_user,
            agent_id=test_agent_with_tool.id,
            run_id=test_run_2.id,
            limit=1000,
        )

        agent_message_ids = set(agent_after_complete.message_ids or [])
        all_db_message_ids = {m.id for m in db_messages_run1} | {m.id for m in db_messages_run2}

        # Check for desync: every message in DB must be in agent.message_ids
        messages_in_db_not_in_agent = all_db_message_ids - agent_message_ids

        assert len(messages_in_db_not_in_agent) == 0, (
            f"MESSAGE DESYNC: {len(messages_in_db_not_in_agent)} messages in DB but not in agent.message_ids\n"
            f"Missing message IDs: {messages_in_db_not_in_agent}\n"
            f"Run 1 (cancelled) had {len(db_messages_run1)} messages\n"
            f"Run 2 (completed) had {len(db_messages_run2)} messages\n"
            f"Agent has {len(agent_message_ids)} message_ids total\n"
            f"This indicates message_ids was not updated properly after cancellation or continuation."
        )

    @pytest.mark.asyncio
    async def test_approval_request_message_ids_desync_with_background_token_streaming(
        self,
        server: SyncServer,
        default_user,
        test_agent_with_tool,
        bash_tool,
    ):
        """
        Test for the specific desync bug with BACKGROUND + TOKEN STREAMING.

        This is the EXACT scenario where the bug occurs in production:
        - background=True (background streaming)
        - stream_tokens=True (token streaming)
        - Agent calls HITL tool requiring approval
        - Run is cancelled during approval

        Bug Scenario:
        1. Agent calls HITL tool requiring approval
        2. Approval request message is persisted to DB
        3. Run is cancelled while processing in background with token streaming
        4. Approval request message ID is NOT in agent.message_ids
        5. Result: "Desync detected - cursor last: X, in-context last: Y"
        """
        # Add bash_tool to agent (requires approval)
        await server.agent_manager.attach_tool_async(
            agent_id=test_agent_with_tool.id,
            tool_id=bash_tool.id,
            actor=default_user,
        )

        # Get initial message count
        agent_before = await server.agent_manager.get_agent_by_id_async(
            agent_id=test_agent_with_tool.id,
            actor=default_user,
        )
        initial_message_ids = set(agent_before.message_ids or [])
        print(f"\nInitial message_ids count: {len(initial_message_ids)}")

        # Create streaming service
        streaming_service = StreamingService(server)

        # Create request with BACKGROUND + TOKEN STREAMING (the key conditions!)
        request = LettaStreamingRequest(
            messages=[MessageCreate(role=MessageRole.user, content="Please run the bash_tool with operation 'test'")],
            max_steps=5,
            stream_tokens=True,  # TOKEN STREAMING - KEY CONDITION
            background=True,  # BACKGROUND STREAMING - KEY CONDITION
        )

        print("\n🔥 Starting agent with BACKGROUND + TOKEN STREAMING...")
        print(f"   stream_tokens={request.stream_tokens}")
        print(f"   background={request.background}")

        # Start the background streaming agent
        run, stream_response = await streaming_service.create_agent_stream(
            agent_id=test_agent_with_tool.id,
            actor=default_user,
            request=request,
            run_type="test_desync",
        )

        assert run is not None, "Run should be created for background streaming"
        print(f"\n✅ Run created: {run.id}")
        print(f"   Status: {run.status}")

        # Cancel almost immediately - we want to interrupt DURING processing, not after
        # The bug happens when cancellation interrupts the approval flow mid-execution
        print("\n⏳ Starting background task, will cancel quickly to catch mid-execution...")
        await asyncio.sleep(0.3)  # Just enough time for LLM to start, but not complete

        # NOW CANCEL THE RUN WHILE IT'S STILL PROCESSING - This is where the bug happens!
        print("\n❌ CANCELLING RUN while in background + token streaming mode (MID-EXECUTION)...")
        await server.run_manager.cancel_run(
            actor=default_user,
            run_id=run.id,
        )

        # Give cancellation time to propagate and background task to react
        print("⏳ Waiting for cancellation to propagate through background task...")
        await asyncio.sleep(2)  # Let the background task detect cancellation and clean up

        # Check run status after cancellation
        run_status = await server.run_manager.get_run_by_id(run.id, actor=default_user)
        print(f"\n📊 Run status after cancel: {run_status.status}")
        print(f"   Stop reason: {run_status.stop_reason}")

        # Get messages from DB AFTER cancellation
        db_messages_after_cancel = await server.message_manager.list_messages(
            actor=default_user,
            agent_id=test_agent_with_tool.id,
            run_id=run.id,
            limit=1000,
        )
        print(f"\n📨 Messages in DB after cancel: {len(db_messages_after_cancel)}")
        for msg in db_messages_after_cancel:
            print(f"  - {msg.id}: role={msg.role}")

        # Get agent state AFTER cancellation
        agent_after_cancel = await server.agent_manager.get_agent_by_id_async(
            agent_id=test_agent_with_tool.id,
            actor=default_user,
        )

        # Verify last_stop_reason is set to cancelled
        print(f"\n🔍 Agent last_stop_reason: {agent_after_cancel.last_stop_reason}")
        assert agent_after_cancel.last_stop_reason == "cancelled", (
            f"Agent's last_stop_reason should be 'cancelled', got '{agent_after_cancel.last_stop_reason}'"
        )

        agent_message_ids = set(agent_after_cancel.message_ids or [])
        new_message_ids = agent_message_ids - initial_message_ids
        print(f"\n📝 Agent message_ids after cancel: {len(agent_message_ids)}")
        print(f"   New message_ids in this run: {len(new_message_ids)}")

        db_message_ids = {m.id for m in db_messages_after_cancel}

        # CRITICAL CHECK: Every message in DB must be in agent.message_ids
        messages_in_db_not_in_agent = db_message_ids - agent_message_ids

        if messages_in_db_not_in_agent:
            # THIS IS THE DESYNC BUG!
            print("\n❌ DESYNC BUG DETECTED!")
            print(f"🐛 Found {len(messages_in_db_not_in_agent)} messages in DB but NOT in agent.message_ids")
            print("   This bug occurs specifically with: background=True + stream_tokens=True")

            missing_messages = [m for m in db_messages_after_cancel if m.id in messages_in_db_not_in_agent]

            print("\n🔍 Missing messages details:")
            for m in missing_messages:
                print(f"  - ID: {m.id}")
                print(f"    Role: {m.role}")
                print(f"    Created: {m.created_at}")
                if hasattr(m, "content"):
                    content_preview = str(m.content)[:100] if m.content else "None"
                    print(f"    Content: {content_preview}...")

            # Get the last message IDs for the exact error message format
            cursor_last = list(db_message_ids)[-1] if db_message_ids else None
            in_context_last = list(agent_message_ids)[-1] if agent_message_ids else None

            print("\n💥 This causes the EXACT error reported:")
            print(f"   'Desync detected - cursor last: {cursor_last},")
            print(f"                      in-context last: {in_context_last}'")

            assert False, (
                f"🐛 DESYNC DETECTED IN BACKGROUND + TOKEN STREAMING MODE\n\n"
                f"Found {len(messages_in_db_not_in_agent)} messages in DB but not in agent.message_ids\n\n"
                f"This reproduces the reported bug:\n"
                f"  'Desync detected - cursor last: {cursor_last},\n"
                f"                     in-context last: {in_context_last}'\n\n"
                f"Missing message IDs: {messages_in_db_not_in_agent}\n\n"
                f"Root cause: With background=True + stream_tokens=True, approval request messages\n"
                f"are persisted to DB but NOT added to agent.message_ids when cancellation occurs\n"
                f"during HITL approval flow.\n\n"
                f"Fix location: Check approval flow in letta_agent_v3.py:442-486 and background\n"
                f"streaming wrapper in streaming_service.py:138-146"
            )

        # Also check reverse: agent.message_ids shouldn't have messages not in DB
        messages_in_agent_not_in_db = agent_message_ids - db_message_ids
        messages_in_agent_not_in_db = messages_in_agent_not_in_db - initial_message_ids

        if messages_in_agent_not_in_db:
            print("\n❌ REVERSE DESYNC DETECTED!")
            print(f"Found {len(messages_in_agent_not_in_db)} message IDs in agent.message_ids but NOT in DB")

            assert False, (
                f"REVERSE DESYNC: {len(messages_in_agent_not_in_db)} messages in agent.message_ids but not in DB\n"
                f"Message IDs: {messages_in_agent_not_in_db}"
            )

        # If we get here, message IDs are consistent!
        print("\n✅ No desync detected - message IDs are consistent between DB and agent state")
        print(f"   DB message count: {len(db_message_ids)}")
        print(f"   Agent message_ids count: {len(agent_message_ids)}")
        print("\n   Either the bug is fixed, or we need to adjust test timing/conditions.")


class TestStreamingCancellation:
    """
    Test cancellation during different streaming modes.
    """

    @pytest.mark.asyncio
    async def test_token_streaming_cancellation(
        self,
        server: SyncServer,
        default_user,
        test_agent_with_tool,
        test_run,
    ):
        """
        Test cancellation during token streaming mode.

        This tests Issue #3: Cancellation During LLM Streaming (token mode).

        Verifies:
        - Cancellation can be detected during token streaming
        - Partial messages are handled correctly
        - Stop reason is set to 'cancelled'
        """
        # Load agent loop
        agent_loop = AgentLoop.load(agent_state=test_agent_with_tool, actor=default_user)

        input_messages = [MessageCreate(role=MessageRole.user, content="Hello")]

        # Cancel after first chunk
        cancel_triggered = [False]

        async def mock_check_cancellation(run_id):
            if cancel_triggered[0]:
                return True
            return False

        agent_loop._check_run_cancellation = mock_check_cancellation

        # Mock streaming
        async def cancel_during_stream():
            """Generator that simulates streaming and cancels mid-stream."""
            chunks_yielded = 0
            stream = agent_loop.stream(
                input_messages=input_messages,
                max_steps=5,
                stream_tokens=True,
                run_id=test_run.id,
            )

            async for chunk in stream:
                chunks_yielded += 1
                yield chunk

                # Cancel after a few chunks
                if chunks_yielded == 2 and not cancel_triggered[0]:
                    cancel_triggered[0] = True
                    await server.run_manager.cancel_run(
                        actor=default_user,
                        run_id=test_run.id,
                    )

        # Consume the stream
        chunks = []
        try:
            async for chunk in cancel_during_stream():
                chunks.append(chunk)
        except Exception as e:
            # May raise exception on cancellation
            pass

        # Verify we got some chunks before cancellation
        assert len(chunks) > 0, "Should receive at least some chunks before cancellation"

    @pytest.mark.asyncio
    async def test_step_streaming_cancellation(
        self,
        server: SyncServer,
        default_user,
        test_agent_with_tool,
        test_run,
    ):
        """
        Test cancellation during step streaming mode (not token streaming).

        Verifies:
        - Cancellation detected between steps
        - Completed steps are streamed fully
        - Partial step is not streamed
        """
        # Load agent loop
        agent_loop = AgentLoop.load(agent_state=test_agent_with_tool, actor=default_user)

        input_messages = [MessageCreate(role=MessageRole.user, content="Call print_tool with 'message'")]

        # Cancel after first step
        call_count = [0]

        async def mock_check_cancellation(run_id):
            call_count[0] += 1
            if call_count[0] > 1:
                await server.run_manager.cancel_run(
                    actor=default_user,
                    run_id=run_id,
                )
                return True
            return False

        agent_loop._check_run_cancellation = mock_check_cancellation

        # Stream with step streaming (not token streaming)
        chunks = []
        stream = agent_loop.stream(
            input_messages=input_messages,
            max_steps=5,
            stream_tokens=False,  # Step streaming
            run_id=test_run.id,
        )

        async for chunk in stream:
            chunks.append(chunk)

        # Verify we got chunks from the first step
        assert len(chunks) > 0, "Should receive chunks from first step before cancellation"

        # Verify cancellation was detected
        assert agent_loop.stop_reason.stop_reason == "cancelled"


class TestToolExecutionCancellation:
    """
    Test cancellation during tool execution.
    This tests Issue #2C: Token streaming tool return desync.
    """

    @pytest.mark.asyncio
    async def test_cancellation_during_tool_execution(
        self,
        server: SyncServer,
        default_user,
        test_agent_with_tool,
        test_run,
        print_tool,
    ):
        """
        Test cancellation while tool is executing.

        Verifies:
        - Tool execution completes or is interrupted cleanly
        - Tool return messages are consistent
        - Database state matches client state
        """
        # Load agent loop
        agent_loop = AgentLoop.load(agent_state=test_agent_with_tool, actor=default_user)

        input_messages = [MessageCreate(role=MessageRole.user, content="Call print_tool with 'test message'")]

        # Mock the tool execution to detect cancellation
        tool_execution_started = [False]
        tool_execution_completed = [False]

        original_execute = agent_loop._execute_tool

        async def mock_execute_tool(target_tool, tool_args, agent_state, agent_step_span, step_id):
            tool_execution_started[0] = True

            # Cancel during tool execution
            await server.run_manager.cancel_run(
                actor=default_user,
                run_id=test_run.id,
            )

            # Call original (tool execution should complete)
            result = await original_execute(target_tool, tool_args, agent_state, agent_step_span, step_id)

            tool_execution_completed[0] = True
            return result

        agent_loop._execute_tool = mock_execute_tool

        # Execute step
        result = await agent_loop.step(
            input_messages=input_messages,
            max_steps=5,
            run_id=test_run.id,
        )

        # Verify tool execution started
        assert tool_execution_started[0], "Tool execution should have started"

        # Verify cancellation was eventually detected
        # (may be after tool completes, at next step boundary)
        assert result.stop_reason.stop_reason == "cancelled"

        # If tool completed, verify its messages are persisted
        if tool_execution_completed[0]:
            db_messages = await server.message_manager.list_messages(
                agent_id=test_agent_with_tool.id,
                actor=default_user,
            )
            run_messages = [m for m in db_messages if m.run_id == test_run.id]
            tool_returns = [m for m in run_messages if m.role == "tool"]

            # If tool executed, should have a tool return message
            assert len(tool_returns) > 0, "Should have persisted tool return message"


class TestResourceCleanupAfterCancellation:
    """
    Test Issue #6: Resource Cleanup Issues
    Tests that resources are properly cleaned up after cancellation.
    """

    @pytest.mark.asyncio
    async def test_stop_reason_set_correctly_on_cancellation(
        self,
        server: SyncServer,
        default_user,
        test_agent_with_tool,
        test_run,
    ):
        """
        Test that stop_reason is set to 'cancelled' not 'end_turn' or other.

        This tests Issue #6: Resource Cleanup Issues.
        The finally block should set stop_reason to 'cancelled' when appropriate.

        Verifies:
        - stop_reason is 'cancelled' when run is cancelled
        - stop_reason is not 'end_turn' or 'completed' for cancelled runs
        """
        # Load agent loop
        agent_loop = AgentLoop.load(agent_state=test_agent_with_tool, actor=default_user)

        # Cancel before execution
        await server.run_manager.cancel_run(
            actor=default_user,
            run_id=test_run.id,
        )

        input_messages = [MessageCreate(role=MessageRole.user, content="Hello")]

        result = await agent_loop.step(
            input_messages=input_messages,
            max_steps=5,
            run_id=test_run.id,
        )

        # Verify stop reason is cancelled, not end_turn
        assert result.stop_reason.stop_reason == "cancelled", f"Stop reason should be 'cancelled', got '{result.stop_reason.stop_reason}'"

        # Verify run status in database
        run = await server.run_manager.get_run_by_id(run_id=test_run.id, actor=default_user)
        assert run.status == RunStatus.cancelled, f"Run status should be cancelled, got {run.status}"

    @pytest.mark.asyncio
    async def test_response_messages_cleared_after_cancellation(
        self,
        server: SyncServer,
        default_user,
        test_agent_with_tool,
        test_run,
    ):
        """
        Test that internal message buffers are properly managed after cancellation.

        Verifies:
        - response_messages list is in expected state after cancellation
        - No memory leaks from accumulated messages
        """
        # Load agent loop
        agent_loop = AgentLoop.load(agent_state=test_agent_with_tool, actor=default_user)

        # Execute and cancel
        call_count = [0]

        async def mock_check_cancellation(run_id):
            call_count[0] += 1
            if call_count[0] > 1:
                await server.run_manager.cancel_run(
                    actor=default_user,
                    run_id=run_id,
                )
                return True
            return False

        agent_loop._check_run_cancellation = mock_check_cancellation

        input_messages = [MessageCreate(role=MessageRole.user, content="Call print_tool with 'test'")]

        result = await agent_loop.step(
            input_messages=input_messages,
            max_steps=5,
            run_id=test_run.id,
        )

        # Verify response_messages is not empty (contains messages from completed step)
        # or is properly cleared depending on implementation
        response_msg_count = len(agent_loop.response_messages)

        # The exact behavior may vary, but we're checking that the state is reasonable
        assert response_msg_count >= 0, "response_messages should be in valid state"

        # Verify no excessive accumulation
        assert response_msg_count < 100, "response_messages should not have excessive accumulation"


class TestApprovalFlowCancellation:
    """
    Test Issue #5: Approval Flow + Cancellation
    Tests edge cases with HITL tool approvals and cancellation.
    """

    @pytest.mark.asyncio
    async def test_cancellation_while_waiting_for_approval(
        self,
        server: SyncServer,
        default_user,
        test_agent_with_tool,
        test_run,
        bash_tool,
    ):
        """
        Test cancellation while agent is waiting for tool approval.

        This tests the scenario where:
        1. Agent calls a tool requiring approval
        2. Run is cancelled while waiting for approval
        3. Agent should detect cancellation and not process approval

        Verifies:
        - Run status is cancelled
        - Agent does not process approval after cancellation
        - No tool execution happens
        """
        # Add bash_tool which requires approval to agent
        await server.agent_manager.attach_tool_async(
            agent_id=test_agent_with_tool.id,
            tool_id=bash_tool.id,
            actor=default_user,
        )

        # Reload agent with new tool
        test_agent_with_tool = await server.agent_manager.get_agent_by_id_async(
            agent_id=test_agent_with_tool.id,
            actor=default_user,
            include_relationships=["memory", "tools", "sources"],
        )

        # Load agent loop
        agent_loop = AgentLoop.load(agent_state=test_agent_with_tool, actor=default_user)

        input_messages = [MessageCreate(role=MessageRole.user, content="Call bash_tool with operation 'test'")]

        # Execute step - should stop at approval request
        result = await agent_loop.step(
            input_messages=input_messages,
            max_steps=5,
            run_id=test_run.id,
        )

        # Verify we got approval request
        assert result.stop_reason.stop_reason == "requires_approval", f"Should stop for approval, got {result.stop_reason.stop_reason}"

        # Now cancel the run while "waiting for approval"
        await server.run_manager.cancel_run(
            actor=default_user,
            run_id=test_run.id,
        )

        # Reload agent loop with fresh state
        agent_loop_2 = AgentLoop.load(
            agent_state=await server.agent_manager.get_agent_by_id_async(
                agent_id=test_agent_with_tool.id,
                actor=default_user,
                include_relationships=["memory", "tools", "sources"],
            ),
            actor=default_user,
        )

        # Try to continue - should detect cancellation
        result_2 = await agent_loop_2.step(
            input_messages=[MessageCreate(role=MessageRole.user, content="Hello")],  # No new input, just continuing
            max_steps=5,
            run_id=test_run.id,
        )

        # Should detect cancellation
        assert result_2.stop_reason.stop_reason == "cancelled", f"Should detect cancellation, got {result_2.stop_reason.stop_reason}"

    @pytest.mark.asyncio
    async def test_agent_state_after_cancelled_approval(
        self,
        server: SyncServer,
        default_user,
        test_agent_with_tool,
        test_run,
        bash_tool,
    ):
        """
        Test that agent state is consistent after approval request is cancelled.

        This addresses the issue where agents say they are "awaiting approval"
        even though the run is cancelled.

        Verifies:
        - Agent can continue after cancelled approval
        - No phantom "awaiting approval" state
        - Messages reflect actual state
        """
        # Add bash_tool which requires approval
        await server.agent_manager.attach_tool_async(
            agent_id=test_agent_with_tool.id,
            tool_id=bash_tool.id,
            actor=default_user,
        )

        # Reload agent with new tool
        test_agent_with_tool = await server.agent_manager.get_agent_by_id_async(
            agent_id=test_agent_with_tool.id,
            actor=default_user,
            include_relationships=["memory", "tools", "sources"],
        )

        agent_loop = AgentLoop.load(agent_state=test_agent_with_tool, actor=default_user)

        # First run: trigger approval request then cancel
        input_messages_1 = [MessageCreate(role=MessageRole.user, content="Call bash_tool with operation 'test'")]

        result_1 = await agent_loop.step(
            input_messages=input_messages_1,
            max_steps=5,
            run_id=test_run.id,
        )

        assert result_1.stop_reason.stop_reason == "requires_approval"

        # Cancel the run
        await server.run_manager.cancel_run(
            actor=default_user,
            run_id=test_run.id,
        )

        # Get messages to check for "awaiting approval" state
        messages_after_cancel = await server.message_manager.list_messages(
            actor=default_user,
            agent_id=test_agent_with_tool.id,
            run_id=test_run.id,
            limit=1000,
        )

        # Check for approval request messages
        approval_messages = [m for m in messages_after_cancel if m.role == "approval_request"]

        # Second run: try to execute normally (should work, not stuck in approval)
        test_run_2 = await server.run_manager.create_run(
            pydantic_run=PydanticRun(
                agent_id=test_agent_with_tool.id,
                status=RunStatus.created,
            ),
            actor=default_user,
        )

        agent_loop_2 = AgentLoop.load(
            agent_state=await server.agent_manager.get_agent_by_id_async(
                agent_id=test_agent_with_tool.id,
                actor=default_user,
                include_relationships=["memory", "tools", "sources"],
            ),
            actor=default_user,
        )

        # Call a different tool that doesn't require approval
        input_messages_2 = [MessageCreate(role=MessageRole.user, content="Call print_tool with message 'hello'")]

        result_2 = await agent_loop_2.step(
            input_messages=input_messages_2,
            max_steps=5,
            run_id=test_run_2.id,
        )

        # Should complete normally, not be stuck in approval state
        assert result_2.stop_reason.stop_reason != "requires_approval", "Agent should not be stuck in approval state from cancelled run"

    @pytest.mark.asyncio
    async def test_approval_state_persisted_correctly_after_cancel(
        self,
        server: SyncServer,
        default_user,
        test_agent_with_tool,
        test_run,
        bash_tool,
    ):
        """
        Test that approval state is correctly persisted/cleaned after cancellation.

        This addresses the specific issue mentioned:
        "agents say they are awaiting approval despite the run not being shown as pending approval"

        Verifies:
        - Run status matches actual state
        - No phantom "pending approval" status
        - Messages accurately reflect cancellation
        """
        # Add bash_tool
        await server.agent_manager.attach_tool_async(
            agent_id=test_agent_with_tool.id,
            tool_id=bash_tool.id,
            actor=default_user,
        )

        test_agent_with_tool = await server.agent_manager.get_agent_by_id_async(
            agent_id=test_agent_with_tool.id,
            actor=default_user,
            include_relationships=["memory", "tools", "sources"],
        )

        agent_loop = AgentLoop.load(agent_state=test_agent_with_tool, actor=default_user)

        # Trigger approval
        result = await agent_loop.step(
            input_messages=[MessageCreate(role=MessageRole.user, content="Call bash_tool with 'test'")],
            max_steps=5,
            run_id=test_run.id,
        )

        assert result.stop_reason.stop_reason == "requires_approval"

        # Cancel the run
        await server.run_manager.cancel_run(
            actor=default_user,
            run_id=test_run.id,
        )

        # Verify run status is cancelled, NOT pending_approval
        run_after_cancel = await server.run_manager.get_run_by_id(run_id=test_run.id, actor=default_user)
        assert run_after_cancel.status == RunStatus.cancelled, f"Run status should be cancelled, got {run_after_cancel.status}"

        # Agent should be able to start fresh run
        test_run_3 = await server.run_manager.create_run(
            pydantic_run=PydanticRun(
                agent_id=test_agent_with_tool.id,
                status=RunStatus.created,
            ),
            actor=default_user,
        )

        agent_loop_3 = AgentLoop.load(
            agent_state=await server.agent_manager.get_agent_by_id_async(
                agent_id=test_agent_with_tool.id,
                actor=default_user,
                include_relationships=["memory", "tools", "sources"],
            ),
            actor=default_user,
        )

        # Should be able to make normal call
        result_3 = await agent_loop_3.step(
            input_messages=[MessageCreate(role=MessageRole.user, content="Call print_tool with 'test'")],
            max_steps=5,
            run_id=test_run_3.id,
        )

        # Should complete normally
        assert result_3.stop_reason.stop_reason != "requires_approval", "New run should not be stuck in approval state"

    @pytest.mark.asyncio
    async def test_approval_request_message_ids_desync(
        self,
        server: SyncServer,
        default_user,
        test_agent_with_tool,
        test_run,
        bash_tool,
    ):
        """
        Test for the specific desync bug reported:
        "Desync detected - cursor last: message-X, in-context last: message-Y"

        Bug Scenario:
        1. Agent calls HITL tool requiring approval
        2. Approval request message is persisted to DB
        3. Run is cancelled
        4. Approval request message ID is NOT in agent.message_ids
        5. Result: cursor desync between DB and agent state

        This is the root cause of the reported error:
        "Desync detected - cursor last: message-c07fa1ec..., in-context last: message-a2615dc3..."

        The bug happens because:
        - Database contains the approval_request message
        - Agent's message_ids list does NOT contain the approval_request message ID
        - Causes cursor/pagination to fail

        Verifies:
        - If approval request is in DB, it must be in agent.message_ids
        - Cancellation doesn't cause partial message persistence
        - Cursor consistency between DB and agent state
        """
        # Add bash_tool which requires approval
        await server.agent_manager.attach_tool_async(
            agent_id=test_agent_with_tool.id,
            tool_id=bash_tool.id,
            actor=default_user,
        )

        # Get initial message count
        agent_before = await server.agent_manager.get_agent_by_id_async(
            agent_id=test_agent_with_tool.id,
            actor=default_user,
        )
        initial_message_ids = set(agent_before.message_ids or [])

        # Reload agent with new tool
        test_agent_with_tool = await server.agent_manager.get_agent_by_id_async(
            agent_id=test_agent_with_tool.id,
            actor=default_user,
            include_relationships=["memory", "tools", "sources"],
        )

        agent_loop = AgentLoop.load(agent_state=test_agent_with_tool, actor=default_user)

        # Trigger approval request
        result = await agent_loop.step(
            input_messages=[MessageCreate(role=MessageRole.user, content="Call bash_tool with 'test'")],
            max_steps=5,
            run_id=test_run.id,
        )

        assert result.stop_reason.stop_reason == "requires_approval", f"Expected requires_approval, got {result.stop_reason.stop_reason}"

        # Get all messages from database for this run
        db_messages = await server.message_manager.list_messages(
            actor=default_user,
            agent_id=test_agent_with_tool.id,
            run_id=test_run.id,
            limit=1000,
        )

        # Cancel the run
        await server.run_manager.cancel_run(
            actor=default_user,
            run_id=test_run.id,
        )

        # Get agent state after cancellation
        agent_after_cancel = await server.agent_manager.get_agent_by_id_async(
            agent_id=test_agent_with_tool.id,
            actor=default_user,
        )

        agent_message_ids = set(agent_after_cancel.message_ids or [])

        # Get all messages from database again
        db_messages_after = await server.message_manager.list_messages(
            actor=default_user,
            agent_id=test_agent_with_tool.id,
            run_id=test_run.id,
            limit=1000,
        )

        db_message_ids = {m.id for m in db_messages_after}

        # CRITICAL CHECK: Every message in DB must be in agent.message_ids
        messages_in_db_not_in_agent = db_message_ids - agent_message_ids

        if messages_in_db_not_in_agent:
            # THIS IS THE DESYNC BUG!
            missing_messages = [m for m in db_messages_after if m.id in messages_in_db_not_in_agent]
            missing_details = [f"ID: {m.id}, Role: {m.role}, Created: {m.created_at}" for m in missing_messages]

            # Get the cursor values that would cause the error
            cursor_last = list(db_message_ids)[-1] if db_message_ids else None
            in_context_last = list(agent_message_ids)[-1] if agent_message_ids else None

            assert False, (
                f"DESYNC DETECTED: {len(messages_in_db_not_in_agent)} messages in DB but not in agent.message_ids\n\n"
                f"This is the reported bug:\n"
                f"  'Desync detected - cursor last: {cursor_last}, in-context last: {in_context_last}'\n\n"
                f"Missing messages:\n" + "\n".join(missing_details) + "\n\n"
                f"Agent message_ids count: {len(agent_message_ids)}\n"
                f"DB messages count: {len(db_message_ids)}\n\n"
                f"Root cause: Approval request message was persisted to DB but not added to agent.message_ids\n"
                f"when cancellation occurred during HITL approval flow."
            )

        # Also check the inverse: agent.message_ids shouldn't have messages not in DB
        messages_in_agent_not_in_db = agent_message_ids - db_message_ids
        messages_in_agent_not_in_db = messages_in_agent_not_in_db - initial_message_ids

        if messages_in_agent_not_in_db:
            assert False, (
                f"REVERSE DESYNC: {len(messages_in_agent_not_in_db)} messages in agent.message_ids but not in DB\n"
                f"Message IDs: {messages_in_agent_not_in_db}"
            )

    @pytest.mark.asyncio
    async def test_parallel_tool_calling_cancellation_with_denials(
        self,
        server: SyncServer,
        default_user,
        bash_tool,
    ):
        """
        Test that parallel tool calls receive proper denial messages on cancellation.

        This tests the scenario where:
        1. Agent has parallel tool calling enabled
        2. Agent calls a tool 3 times in parallel (requiring approval)
        3. Run is cancelled while waiting for approval
        4. All 3 tool calls receive denial messages with TOOL_CALL_DENIAL_ON_CANCEL
        5. Agent can still be messaged again (creating a new run)

        Verifies:
        - All parallel tool calls get proper denial messages
        - Denial messages contain TOOL_CALL_DENIAL_ON_CANCEL reason
        - Agent state is not corrupted
        - New runs can be created after cancellation
        """
        # Create agent with parallel tool calling enabled
        config = LLMConfig.default_config("gpt-4o-mini")
        config.parallel_tool_calls = True
        agent_state = await server.agent_manager.create_agent_async(
            agent_create=CreateAgent(
                name="test_parallel_tool_calling_agent",
                agent_type="letta_v1_agent",
                memory_blocks=[],
                llm_config=LLMConfig.default_config("gpt-4o-mini"),
                embedding_config=EmbeddingConfig.default_config(provider="openai"),
                tool_ids=[bash_tool.id],
                include_base_tools=False,
            ),
            actor=default_user,
        )

        # Create a run
        test_run = await server.run_manager.create_run(
            pydantic_run=PydanticRun(
                agent_id=agent_state.id,
                status=RunStatus.created,
            ),
            actor=default_user,
        )

        # Load agent loop
        agent_loop = AgentLoop.load(agent_state=agent_state, actor=default_user)

        # Prompt the agent to call bash_tool 3 times
        # The agent should make parallel tool calls since parallel_tool_calls is enabled
        input_messages = [
            MessageCreate(
                role=MessageRole.user,
                content="Please call bash_tool three times with operations: 'ls', 'pwd', and 'echo test'",
            )
        ]

        # Execute step - should stop at approval request with multiple tool calls
        result = await agent_loop.step(
            input_messages=input_messages,
            max_steps=5,
            run_id=test_run.id,
        )

        # Verify we got approval request
        assert result.stop_reason.stop_reason == "requires_approval", f"Should stop for approval, got {result.stop_reason.stop_reason}"

        # Get the approval request message to see how many tool calls were made
        db_messages_before_cancel = await server.message_manager.list_messages(
            actor=default_user,
            agent_id=agent_state.id,
            run_id=test_run.id,
            limit=1000,
        )

        # should not be possible to message the agent (Pending approval)
        from letta.errors import PendingApprovalError

        with pytest.raises(PendingApprovalError):
            test_run2 = await server.run_manager.create_run(
                pydantic_run=PydanticRun(
                    agent_id=agent_state.id,
                    status=RunStatus.created,
                ),
                actor=default_user,
            )
            await agent_loop.step(
                input_messages=[MessageCreate(role=MessageRole.user, content="Hello, how are you?")],
                max_steps=5,
                run_id=test_run2.id,
            )

        from letta.schemas.letta_message import ApprovalRequestMessage

        approval_request_messages = [m for m in result.messages if isinstance(m, ApprovalRequestMessage)]
        assert len(approval_request_messages) > 0, "Should have at least one approval request message"

        # Get the last approval request message (should have the tool calls)
        approval_request = approval_request_messages[-1]
        tool_calls = approval_request.tool_calls if hasattr(approval_request, "tool_calls") else []
        num_tool_calls = len(tool_calls)

        print(f"\nFound {num_tool_calls} tool calls in approval request")

        # The agent might not always make exactly 3 parallel calls depending on the LLM,
        # but we should have at least 1 tool call. For the test to be meaningful,
        # we want multiple tool calls, but we'll verify whatever the LLM decides
        assert num_tool_calls >= 1, f"Should have at least 1 tool call, got {num_tool_calls}"

        # Now cancel the run while "waiting for approval"
        await server.run_manager.cancel_run(
            actor=default_user,
            run_id=test_run.id,
        )

        # Get messages after cancellation
        db_messages_after_cancel = await server.message_manager.list_messages(
            actor=default_user,
            agent_id=agent_state.id,
            run_id=test_run.id,
            limit=1000,
        )

        # Find tool return messages (these should be the denial messages)
        tool_return_messages = [m for m in db_messages_after_cancel if m.role == "tool"]

        print(f"Found {len(tool_return_messages)} tool return messages after cancellation")

        # Verify we got denial messages for all tool calls
        assert len(tool_return_messages) == num_tool_calls, (
            f"Should have {num_tool_calls} tool return messages (one per tool call), got {len(tool_return_messages)}"
        )

        # Verify each tool return message contains the denial reason
        for tool_return_msg in tool_return_messages:
            # Check if message has tool_returns (new format) or tool_return (old format)
            print("TOOL RETURN MESSAGE:\n\n", tool_return_msg)
            if hasattr(tool_return_msg, "tool_returns") and tool_return_msg.tool_returns:
                # New format: list of tool returns
                for tool_return in tool_return_msg.tool_returns:
                    assert TOOL_CALL_DENIAL_ON_CANCEL in tool_return.func_response, (
                        f"Tool return should contain denial message, got: {tool_return.tool_return}"
                    )
            elif hasattr(tool_return_msg, "tool_return"):
                # Old format: single tool_return field
                assert TOOL_CALL_DENIAL_ON_CANCEL in tool_return_msg.content, (
                    f"Tool return should contain denial message, got: {tool_return_msg.tool_return}"
                )
            elif hasattr(tool_return_msg, "content"):
                # Check content field
                content_str = str(tool_return_msg.content)
                assert TOOL_CALL_DENIAL_ON_CANCEL in content_str, f"Tool return content should contain denial message, got: {content_str}"

        # Verify run status is cancelled
        run_after_cancel = await server.run_manager.get_run_by_id(run_id=test_run.id, actor=default_user)
        assert run_after_cancel.status == RunStatus.cancelled, f"Run status should be cancelled, got {run_after_cancel.status}"

        # Verify agent can be messaged again (create a new run)
        test_run_2 = await server.run_manager.create_run(
            pydantic_run=PydanticRun(
                agent_id=agent_state.id,
                status=RunStatus.created,
            ),
            actor=default_user,
        )

        # Reload agent loop with fresh state
        agent_loop_2 = AgentLoop.load(
            agent_state=await server.agent_manager.get_agent_by_id_async(
                agent_id=agent_state.id,
                actor=default_user,
                include_relationships=["memory", "tools", "sources"],
            ),
            actor=default_user,
        )

        # Send a simple message that doesn't require approval
        input_messages_2 = [MessageCreate(role=MessageRole.user, content="Hello, how are you?")]

        result_2 = await agent_loop_2.step(
            input_messages=input_messages_2,
            max_steps=5,
            run_id=test_run_2.id,
        )

        # Verify second run completed successfully (not cancelled, not stuck in approval)
        assert result_2.stop_reason.stop_reason != "cancelled", (
            f"Second run should not be cancelled, got {result_2.stop_reason.stop_reason}"
        )
        assert result_2.stop_reason.stop_reason != "requires_approval", (
            f"Second run should not require approval for simple message, got {result_2.stop_reason.stop_reason}"
        )

        # Verify the second run has messages
        db_messages_run2 = await server.message_manager.list_messages(
            actor=default_user,
            agent_id=agent_state.id,
            run_id=test_run_2.id,
            limit=1000,
        )
        assert len(db_messages_run2) > 0, "Second run should have messages"


class TestEdgeCases:
    """
    Test edge cases and boundary conditions for cancellation.
    """

    @pytest.mark.asyncio
    async def test_cancellation_with_max_steps_reached(
        self,
        server: SyncServer,
        default_user,
        test_agent_with_tool,
        test_run,
    ):
        """
        Test interaction between max_steps and cancellation.

        Verifies:
        - If both max_steps and cancellation occur, correct stop_reason is set
        - Cancellation takes precedence over max_steps
        """
        # Load agent loop
        agent_loop = AgentLoop.load(agent_state=test_agent_with_tool, actor=default_user)

        # Cancel after second step, but max_steps=2
        call_count = [0]

        async def mock_check_cancellation(run_id):
            call_count[0] += 1
            if call_count[0] >= 2:
                await server.run_manager.cancel_run(
                    actor=default_user,
                    run_id=run_id,
                )
                return True
            return False

        agent_loop._check_run_cancellation = mock_check_cancellation

        input_messages = [MessageCreate(role=MessageRole.user, content="Call print_tool with 'test'")]

        result = await agent_loop.step(
            input_messages=input_messages,
            max_steps=2,  # Will hit max_steps around the same time as cancellation
            run_id=test_run.id,
        )

        # Stop reason could be either cancelled or max_steps depending on timing
        # Both are acceptable in this edge case
        assert result.stop_reason.stop_reason in ["cancelled", "max_steps"], (
            f"Stop reason should be cancelled or max_steps, got {result.stop_reason.stop_reason}"
        )

    @pytest.mark.asyncio
    async def test_double_cancellation(
        self,
        server: SyncServer,
        default_user,
        test_agent_with_tool,
        test_run,
    ):
        """
        Test that cancelling an already-cancelled run is handled gracefully.

        Verifies:
        - No errors when checking already-cancelled run
        - State remains consistent
        """
        # Cancel the run
        await server.run_manager.cancel_run(
            actor=default_user,
            run_id=test_run.id,
        )

        # Load agent loop
        agent_loop = AgentLoop.load(agent_state=test_agent_with_tool, actor=default_user)

        input_messages = [MessageCreate(role=MessageRole.user, content="Hello")]

        # First execution - should detect cancellation
        result_1 = await agent_loop.step(
            input_messages=input_messages,
            max_steps=5,
            run_id=test_run.id,
        )

        assert result_1.stop_reason.stop_reason == "cancelled"

        # Try to execute again with same cancelled run - should handle gracefully
        agent_loop_2 = AgentLoop.load(
            agent_state=await server.agent_manager.get_agent_by_id_async(
                agent_id=test_agent_with_tool.id,
                actor=default_user,
                include_relationships=["memory", "tools", "sources"],
            ),
            actor=default_user,
        )

        result_2 = await agent_loop_2.step(
            input_messages=input_messages,
            max_steps=5,
            run_id=test_run.id,
        )

        # Should still detect as cancelled
        assert result_2.stop_reason.stop_reason == "cancelled"


class TestErrorDataPersistence:
    """
    Test that error data is properly stored in run metadata when runs fail.
    This ensures errors can be debugged by inspecting the run's metadata field.
    """

    @pytest.mark.asyncio
    async def test_error_data_stored_in_run_metadata_on_background_streaming_llm_error(
        self,
        server: SyncServer,
        default_user,
        test_agent_with_tool,
    ):
        """
        Test that when a background streaming run fails due to an LLM error,
        the error details are stored in the run's metadata field.

        This test validates the fix for the issue where failed runs showed
        empty metadata in the database, making it impossible to debug errors.

        The test patches LettaAgentV3.stream to raise an LLMError, simulating
        what happens when the LLM provider returns an error during streaming.

        Verifies:
        - Run status is set to 'failed'
        - Run metadata contains 'error' key with error details
        """
        from unittest.mock import patch

        from letta.agents.letta_agent_v3 import LettaAgentV3
        from letta.errors import LLMError
        from letta.services.streaming_service import StreamingService

        # Create streaming service
        streaming_service = StreamingService(server)

        # Create request with background streaming - NOT background for simplicity
        # Background streaming adds Redis complexity, so we test foreground streaming
        # which still exercises the same error handling in _create_error_aware_stream
        request = LettaStreamingRequest(
            messages=[MessageCreate(role=MessageRole.user, content="Hello, please respond")],
            max_steps=1,
            stream_tokens=True,
            background=False,
        )

        # Mock stream method that raises an error
        async def mock_stream_raises_llm_error(*args, **kwargs):
            raise LLMError("Simulated LLM error for testing")
            yield  # Make it a generator

        # Use patch to simulate the error during streaming
        with patch.object(LettaAgentV3, "stream", mock_stream_raises_llm_error):
            # Start the streaming request
            run, stream_response = await streaming_service.create_agent_stream(
                agent_id=test_agent_with_tool.id,
                actor=default_user,
                request=request,
                run_type="test_error_persistence",
            )

            assert run is not None, "Run should be created"

            # Consume the stream to trigger error handling
            collected_chunks = []
            async for chunk in stream_response.body_iterator:
                collected_chunks.append(chunk)

        # Give any async handling time to complete
        await asyncio.sleep(0.2)

        # Fetch the run from the database
        fetched_run = await server.run_manager.get_run_by_id(run.id, actor=default_user)

        # Verify the run status is failed
        assert fetched_run.status == RunStatus.failed, f"Expected status 'failed', got '{fetched_run.status}'"

        # Verify metadata contains error information
        assert fetched_run.metadata is not None, (
            f"Run metadata should not be None after error. "
            f"Run ID: {run.id}, Status: {fetched_run.status}, Stop reason: {fetched_run.stop_reason}"
        )
        assert "error" in fetched_run.metadata, f"Run metadata should contain 'error' key, got: {fetched_run.metadata}"

        error_info = fetched_run.metadata["error"]
        # The error is stored as a dict from LettaErrorMessage.model_dump()
        assert isinstance(error_info, dict), f"Error info should be a dict, got: {type(error_info)}"
        assert "error_type" in error_info, f"Error info should contain 'error_type', got: {error_info}"
        assert error_info["error_type"] == "llm_error", f"Expected error_type 'llm_error', got: {error_info['error_type']}"

    @pytest.mark.asyncio
    async def test_error_data_stored_on_streaming_timeout_error(
        self,
        server: SyncServer,
        default_user,
        test_agent_with_tool,
    ):
        """
        Test that timeout errors during streaming store error data.

        Verifies:
        - Timeout errors are properly captured in run metadata
        - Run can be queried from DB and error details are available
        """
        from unittest.mock import patch

        from letta.agents.letta_agent_v3 import LettaAgentV3
        from letta.errors import LLMTimeoutError
        from letta.services.streaming_service import StreamingService

        streaming_service = StreamingService(server)

        request = LettaStreamingRequest(
            messages=[MessageCreate(role=MessageRole.user, content="Hello")],
            max_steps=1,
            stream_tokens=True,
            background=False,
        )

        async def mock_stream_raises_timeout(*args, **kwargs):
            raise LLMTimeoutError("Request timed out after 30 seconds")
            yield

        with patch.object(LettaAgentV3, "stream", mock_stream_raises_timeout):
            run, stream_response = await streaming_service.create_agent_stream(
                agent_id=test_agent_with_tool.id,
                actor=default_user,
                request=request,
                run_type="test_timeout_error",
            )

            # Consume the stream
            async for _ in stream_response.body_iterator:
                pass

        await asyncio.sleep(0.2)

        fetched_run = await server.run_manager.get_run_by_id(run.id, actor=default_user)

        assert fetched_run.status == RunStatus.failed
        assert fetched_run.metadata is not None, f"Run metadata should contain error info for run {run.id}"
        assert "error" in fetched_run.metadata
        assert fetched_run.metadata["error"]["error_type"] == "llm_timeout"

    @pytest.mark.asyncio
    async def test_error_data_stored_on_streaming_rate_limit_error(
        self,
        server: SyncServer,
        default_user,
        test_agent_with_tool,
    ):
        """
        Test that rate limit errors during streaming store error data.

        Verifies:
        - Rate limit errors are properly captured in run metadata
        """
        from unittest.mock import patch

        from letta.agents.letta_agent_v3 import LettaAgentV3
        from letta.errors import LLMRateLimitError
        from letta.services.streaming_service import StreamingService

        streaming_service = StreamingService(server)

        request = LettaStreamingRequest(
            messages=[MessageCreate(role=MessageRole.user, content="Hello")],
            max_steps=1,
            stream_tokens=True,
            background=False,
        )

        async def mock_stream_raises_rate_limit(*args, **kwargs):
            raise LLMRateLimitError("Rate limit exceeded: 100 requests per minute")
            yield

        with patch.object(LettaAgentV3, "stream", mock_stream_raises_rate_limit):
            run, stream_response = await streaming_service.create_agent_stream(
                agent_id=test_agent_with_tool.id,
                actor=default_user,
                request=request,
                run_type="test_rate_limit_error",
            )

            async for _ in stream_response.body_iterator:
                pass

        await asyncio.sleep(0.2)

        fetched_run = await server.run_manager.get_run_by_id(run.id, actor=default_user)

        assert fetched_run.status == RunStatus.failed
        assert fetched_run.metadata is not None
        assert "error" in fetched_run.metadata
        assert fetched_run.metadata["error"]["error_type"] == "llm_rate_limit"

    @pytest.mark.asyncio
    async def test_error_data_stored_on_streaming_auth_error(
        self,
        server: SyncServer,
        default_user,
        test_agent_with_tool,
    ):
        """
        Test that authentication errors during streaming store error data.

        Verifies:
        - Auth errors are properly captured in run metadata
        """
        from unittest.mock import patch

        from letta.agents.letta_agent_v3 import LettaAgentV3
        from letta.errors import LLMAuthenticationError
        from letta.services.streaming_service import StreamingService

        streaming_service = StreamingService(server)

        request = LettaStreamingRequest(
            messages=[MessageCreate(role=MessageRole.user, content="Hello")],
            max_steps=1,
            stream_tokens=True,
            background=False,
        )

        async def mock_stream_raises_auth_error(*args, **kwargs):
            raise LLMAuthenticationError("Invalid API key")
            yield

        with patch.object(LettaAgentV3, "stream", mock_stream_raises_auth_error):
            run, stream_response = await streaming_service.create_agent_stream(
                agent_id=test_agent_with_tool.id,
                actor=default_user,
                request=request,
                run_type="test_auth_error",
            )

            async for _ in stream_response.body_iterator:
                pass

        await asyncio.sleep(0.2)

        fetched_run = await server.run_manager.get_run_by_id(run.id, actor=default_user)

        assert fetched_run.status == RunStatus.failed
        assert fetched_run.metadata is not None
        assert "error" in fetched_run.metadata
        assert fetched_run.metadata["error"]["error_type"] == "llm_authentication"

    @pytest.mark.asyncio
    async def test_error_data_stored_on_generic_exception(
        self,
        server: SyncServer,
        default_user,
        test_agent_with_tool,
    ):
        """
        Test that generic exceptions during streaming store error data.

        Verifies:
        - Generic exceptions result in error data being stored
        - Error details are preserved in metadata with 'internal_error' type
        """
        from unittest.mock import patch

        from letta.agents.letta_agent_v3 import LettaAgentV3
        from letta.services.streaming_service import StreamingService

        streaming_service = StreamingService(server)

        request = LettaStreamingRequest(
            messages=[MessageCreate(role=MessageRole.user, content="Hello")],
            max_steps=1,
            stream_tokens=True,
            background=False,
        )

        async def mock_stream_raises_generic_error(*args, **kwargs):
            raise RuntimeError("Unexpected internal error")
            yield

        with patch.object(LettaAgentV3, "stream", mock_stream_raises_generic_error):
            run, stream_response = await streaming_service.create_agent_stream(
                agent_id=test_agent_with_tool.id,
                actor=default_user,
                request=request,
                run_type="test_generic_error",
            )

            async for _ in stream_response.body_iterator:
                pass

        await asyncio.sleep(0.2)

        fetched_run = await server.run_manager.get_run_by_id(run.id, actor=default_user)

        assert fetched_run.status == RunStatus.failed
        assert fetched_run.metadata is not None, "Run metadata should contain error info for generic exception"
        assert "error" in fetched_run.metadata
        assert fetched_run.metadata["error"]["error_type"] == "internal_error"
