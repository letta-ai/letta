import asyncio
import os

from temporalio.worker import Worker
from temporalio.client import Client

from letta.agents.temporal.temporal_agent_workflow import TemporalAgentWorkflow
from letta.agents.temporal.activities import (
    example_activity,
    llm_request,
    create_messages_activity,
    persist_messages_activity,
    prepare_messages,
    refresh_context_and_system_message,
    summarize_conversation_history,
    execute_tool_activity,
)

TEMPORAL_ENDPOINT = os.environ.get("LETTA_TEMPORAL_ENDPOINT", "localhost:7233")
TEMPORAL_NAMESPACE = os.environ.get("LETTA_TEMPORAL_NAMESPACE", "default")
TEMPORAL_TASK_QUEUE = os.environ.get(
    "LETTA_TEMPORAL_TASK_QUEUE", "agent_loop_async_task_queue"
)
TEMPORAL_API_KEY = os.environ.get("LETTA_TEMPORAL_API_KEY", "your-api-key")


async def main():
    client = await Client.connect(
        TEMPORAL_ENDPOINT,
        namespace=TEMPORAL_NAMESPACE,
        rpc_metadata={"temporal-namespace": TEMPORAL_NAMESPACE},
        api_key=TEMPORAL_API_KEY,
        tls=True,  # This should be false for local runs
    )

    print("Initializing worker...")

    # Run the worker
    worker = Worker(
        client,
        task_queue=TEMPORAL_TASK_QUEUE,
        workflows=[TemporalAgentWorkflow],
        activities=[
            prepare_messages,
            refresh_context_and_system_message,
            llm_request,
            summarize_conversation_history,
            example_activity,
            execute_tool_activity,
            create_messages_activity,
            persist_messages_activity,
        ],
    )

    print("Starting worker... Waiting for tasks.")
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
