import os
import threading
import time
import uuid
from typing import List

import pytest
import requests
from dotenv import load_dotenv
from letta_client import AsyncLetta
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker
from temporalio.worker.workflow_sandbox import (
    SandboxedWorkflowRunner,
    SandboxRestrictions,
)

from letta.agents.temporal.activities import (
    create_messages,
    create_step,
    example_activity,
    execute_tool,
    llm_request,
    prepare_messages,
    refresh_context_and_system_message,
    summarize_conversation_history,
    update_message_ids,
    update_run,
)
from letta.agents.temporal.temporal_agent_workflow import TemporalAgentWorkflow
from letta.agents.temporal.types import WorkflowInputParams
from letta.schemas.enums import JobStatus
from letta.schemas.message import MessageCreate
from letta.schemas.organization import Organization
from letta.schemas.run import Run
from letta.services.job_manager import JobManager
from letta.services.organization_manager import OrganizationManager
from letta.services.user_manager import UserManager


def roll_dice(num_sides: int) -> int:
    """
    Returns a random number between 1 and num_sides.
    Args:
        num_sides (int): The number of sides on the die.
    Returns:
        int: A random integer between 1 and num_sides, representing the die roll.
    """
    import random

    return random.randint(1, num_sides)


USER_MESSAGE_OTID = str(uuid.uuid4())
USER_MESSAGE_GREETING: List[MessageCreate] = [
    MessageCreate(
        role="user",
        content="Hi!",
        otid=USER_MESSAGE_OTID,
    )
]
USER_MESSAGE_ROLL_DICE: List[MessageCreate] = [
    MessageCreate(
        role="user",
        content="This is an automated test message. Call the roll_dice tool with 16 sides and send me a message with the outcome.",
        otid=USER_MESSAGE_OTID,
    )
]


@pytest.fixture(scope="module")
def server_url() -> str:
    """
    Provides the URL for the Letta server.
    If LETTA_SERVER_URL is not set, starts the server in a background thread
    and polls until it's accepting connections.
    """

    def _run_server() -> None:
        load_dotenv()
        from letta.server.rest_api.app import start_server

        start_server(debug=True)

    url: str = os.getenv("LETTA_SERVER_URL", "http://localhost:8283")

    if not os.getenv("LETTA_SERVER_URL"):
        thread = threading.Thread(target=_run_server, daemon=True)
        thread.start()

        # Poll until the server is up (or timeout)
        timeout_seconds = 30
        deadline = time.time() + timeout_seconds
        while time.time() < deadline:
            try:
                resp = requests.get(url + "/v1/health")
                if resp.status_code < 500:
                    break
            except requests.exceptions.RequestException:
                pass
            time.sleep(0.1)
        else:
            raise RuntimeError(f"Could not reach {url} within {timeout_seconds}s")

    return url


@pytest.fixture(scope="function")
async def client(server_url: str) -> AsyncLetta:
    """
    Creates and returns a synchronous Letta REST client for testing.
    """
    client_instance = AsyncLetta(base_url=server_url)
    yield client_instance


@pytest.fixture
async def default_organization():
    """Fixture to create and return the default organization."""
    manager = OrganizationManager()
    org = await manager.create_default_organization_async()
    yield org


@pytest.mark.asyncio(loop_scope="function")
async def test_execute_workflow(client: AsyncLetta, default_organization: Organization):
    """Test the temporal agent workflow execution."""
    # import os
    # import asyncio
    # import logging
    # from letta.server.db import db_registry

    # # Suppress scary database connection logs during test
    # logging.getLogger("sqlalchemy.pool").setLevel(logging.CRITICAL)
    # logging.getLogger("asyncio").setLevel(logging.CRITICAL)
    # logging.getLogger("temporalio.activity").setLevel(logging.CRITICAL)

    # # Force database pooling to be disabled for cleaner event loop handling
    # os.environ["LETTA_DISABLE_SQLALCHEMY_POOLING"] = "true"

    # # Get the current event loop to ensure consistency
    # loop = asyncio.get_running_loop()

    # # Clear any existing database connections completely
    # if hasattr(db_registry, "_async_engines"):
    #     for name, engine in list(db_registry._async_engines.items()):
    #         if engine:
    #             try:
    #                 await engine.dispose()
    #             except Exception:
    #                 pass
    #     db_registry._async_engines.clear()

    # if hasattr(db_registry, "_async_session_factories"):
    #     db_registry._async_session_factories.clear()

    # if hasattr(db_registry, "_initialized"):
    #     db_registry._initialized["async"] = False

    task_queue_name = str(uuid.uuid4())

    manager = UserManager()
    user = await manager.create_default_actor_async(org_id=default_organization.id)

    await client.tools.upsert_base_tools()
    dice_tool = await client.tools.upsert_from_function(func=roll_dice)

    send_message_tool = await client.tools.list(name="send_message")
    agent = await client.agents.create(
        name="test-agent",
        include_base_tools=False,
        tool_ids=[send_message_tool[0].id, dice_tool.id],
        model="openai/gpt-4o",
        embedding="letta/letta-free",
        tags=["test"],
    )
    job_manager = JobManager()
    run = Run(
        user_id=user.id,
        status=JobStatus.created,
        agent_id=agent.id,
        background=True,  # Async endpoints are always background
        metadata={
            "job_type": "send_message_async",
            "agent_id": agent.id,
            "lettuce": True,
        },
    )
    run = await job_manager.create_job_async(pydantic_job=run, actor=user)
    async with await WorkflowEnvironment.start_time_skipping() as env:
        # Create worker with shared event loop
        worker = Worker(
            env.client,
            task_queue=task_queue_name,
            workflows=[TemporalAgentWorkflow],
            activities=[
                prepare_messages,
                refresh_context_and_system_message,
                llm_request,
                summarize_conversation_history,
                example_activity,
                execute_tool,
                create_messages,
                create_step,
                update_message_ids,
                update_run,
            ],
            workflow_runner=SandboxedWorkflowRunner(restrictions=SandboxRestrictions.default.with_passthrough_modules("letta")),
        )

        async with worker:
            workflow_input = WorkflowInputParams(
                agent_state=agent,
                messages=USER_MESSAGE_ROLL_DICE,
                actor=user,
                max_steps=10,
                run_id=run.id,
            )
            result = await env.client.execute_workflow(
                TemporalAgentWorkflow.run,
                workflow_input,
                id=workflow_input.run_id,
                task_queue=task_queue_name,
            )

            # Verify the workflow executed successfully
            assert result is not None
            assert hasattr(result, "messages")
            assert hasattr(result, "usage")
            assert len(result.messages) > 0

            # Print result for debugging
            print("✓ Workflow completed successfully!")
            print(f"✓ Messages count: {len(result.messages)}")
            for index, message in enumerate(result.messages):
                print(
                    f"    Message {index}: {message.model_dump(exclude={'id', 'date', 'name', 'otid', 'sender_id', 'step_id', 'run_id', 'seq_id', 'is_err', 'signature', 'source'})}"
                )
            print(f"✓ Usage: {result.usage}")
            print(f"✓ Stop reason: {result.stop_reason}")

    # Skip agent deletion to avoid cleanup issues
    # client.agents.delete(agent.id)

    # Final cleanup - suppress all cleanup errors to avoid scary logs
    # try:
    #     if hasattr(db_registry, "_async_engines"):
    #         for engine in list(db_registry._async_engines.values()):
    #             if engine:
    #                 try:
    #                     # Force immediate dispose without waiting for connections to close gracefully
    #                     await engine.dispose()
    #                 except Exception:
    #                     # Suppress all cleanup exceptions
    #                     pass
    #         db_registry._async_engines.clear()

    #     if hasattr(db_registry, "_async_session_factories"):
    #         db_registry._async_session_factories.clear()

    #     if hasattr(db_registry, "_initialized"):
    #         db_registry._initialized["async"] = False

    #     # Clean up environment variable
    #     if "LETTA_DISABLE_SQLALCHEMY_POOLING" in os.environ:
    #         del os.environ["LETTA_DISABLE_SQLALCHEMY_POOLING"]

    #     # Restore logging levels
    #     logging.getLogger("sqlalchemy.pool").setLevel(logging.INFO)
    #     logging.getLogger("asyncio").setLevel(logging.INFO)
    #     logging.getLogger("temporalio.activity").setLevel(logging.INFO)
    # except Exception:
    #     # Suppress any cleanup errors completely
    #     pass
