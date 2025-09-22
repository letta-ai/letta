import asyncio
import os

from temporalio.worker import Worker
from temporalio.client import Client
from temporalio.worker.workflow_sandbox import (
    SandboxedWorkflowRunner,
    SandboxRestrictions,
)

from letta.agents.temporal.temporal_agent_workflow import TemporalAgentWorkflow
from letta.agents.temporal.activities import (
    example_activity,
    llm_request,
    create_messages,
    create_step,
    prepare_messages,
    refresh_context_and_system_message,
    summarize_conversation_history,
    execute_tool,
    update_message_ids,
    update_run,
)

TEMPORAL_ENDPOINT = os.environ.get("LETTA_TEMPORAL_ENDPOINT", "localhost:7233")
TEMPORAL_NAMESPACE = os.environ.get("LETTA_TEMPORAL_NAMESPACE", "default")
TEMPORAL_TASK_QUEUE = os.environ.get(
    "LETTA_TEMPORAL_TASK_QUEUE", "agent_loop_async_task_queue"
)
TEMPORAL_API_KEY = os.environ.get("LETTA_TEMPORAL_API_KEY", "your-api-key")
TEMPORAL_TLS = os.environ.get("LETTA_TEMPORAL_TLS", "true").lower() == "true"


async def main():
    client = await Client.connect(
        TEMPORAL_ENDPOINT,
        namespace=TEMPORAL_NAMESPACE,
        rpc_metadata={"temporal-namespace": TEMPORAL_NAMESPACE},
        api_key=TEMPORAL_API_KEY,
        tls=TEMPORAL_TLS,  # This should be false for local runs
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
            execute_tool,
            create_messages,
            create_step,
            update_message_ids,
            update_run,
        ],
        workflow_runner=SandboxedWorkflowRunner(
            restrictions=SandboxRestrictions.default.with_passthrough_modules(
                # TODO: actively looking into solutions for pass through, leaving these here just for reference - not an exhaustive list of modules
                # "letta.schemas.block",
                # "letta.schemas.agent",
                # "letta.schemas.file",
                # "letta.settings",
                # "letta.log",
                # "letta.orm",
                # "letta.agents.helpers",
                # "letta.otel.tracing",
                # "tiktoken",
                # "letta.schemas.organization",
                # "letta.schemas.tool",
                # "letta.server.rest_api.utils",
                # "letta.schemas.user",
                # "letta.llm_api.openai_client",
                # "letta.functions.interface",
                # "sniffio",
                # "anyio",
                # "urllib3",
                # "sentry_sdk",
                # "composio",
                # "starlette",
                "letta",  # bypass everything to enable local dev
            )
        ),
    )

    print("Starting worker... Waiting for tasks.")
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
