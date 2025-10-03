import asyncio
import os

from temporalio.client import Client, TLSConfig
from temporalio.common import VersioningBehavior, WorkerDeploymentVersion
from temporalio.worker import Worker, WorkerDeploymentConfig
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

TEMPORAL_ENDPOINT = os.environ.get("LETTA_TEMPORAL_ENDPOINT", "localhost:7233")
TEMPORAL_NAMESPACE = os.environ.get("LETTA_TEMPORAL_NAMESPACE", "default")
TEMPORAL_TASK_QUEUE = os.environ.get(
    "LETTA_TEMPORAL_TASK_QUEUE", "agent_loop_async_task_queue"
)
TEMPORAL_API_KEY = os.environ.get("LETTA_TEMPORAL_API_KEY", "your-api-key")
TEMPORAL_CLIENT_PRIVATE_KEY = os.environ.get("LETTA_TEMPORAL_PRIVATE_KEY")
TEMPORAL_CLIENT_CERTIFICATE = os.environ.get("LETTA_TEMPORAL_CLIENT_CERTIFICATE")


async def main():
    # Create TLS config if certificates are provided
    tls_config = None
    if TEMPORAL_CLIENT_PRIVATE_KEY and TEMPORAL_CLIENT_CERTIFICATE:
        tls_config = TLSConfig(
            client_private_key=TEMPORAL_CLIENT_PRIVATE_KEY.encode("utf-8"),
            client_cert=TEMPORAL_CLIENT_CERTIFICATE.encode("utf-8"),
        )

    client = await Client.connect(
        TEMPORAL_ENDPOINT,
        namespace=TEMPORAL_NAMESPACE,
        rpc_metadata={"temporal-namespace": TEMPORAL_NAMESPACE},
        # api_key=TEMPORAL_API_KEY,
        tls=tls_config,
    )

    print("Initializing worker...")

    deployment_name = os.environ.get("TEMPORAL_DEPLOYMENT_NAME")
    build_id = os.environ.get("TEMPORAL_WORKER_BUILD_ID")

    if not deployment_name.strip() or not build_id.strip():
        raise ValueError("Deployment name and build id are required")

    print(f"Deployment name: {deployment_name}")
    print(f"Build id: {build_id}")

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
        deployment_config=WorkerDeploymentConfig(
            version=WorkerDeploymentVersion(
                deployment_name=deployment_name,
                build_id=build_id,
            ),
            use_worker_versioning=True,
            default_versioning_behavior=VersioningBehavior.PINNED,
        ),
    )

    print("Starting worker... Waiting for tasks.")
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
