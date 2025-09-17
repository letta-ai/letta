import asyncio
import os

from temporalio.worker import Worker
from temporalio.client import Client

from workflows import your_workflow
from activities import your_first_activity, your_second_activity, your_third_activity

TEMPORAL_ADDRESS = os.environ.get("TEMPORAL_ADDRESS", "localhost:7233")
TEMPORAL_NAMESPACE = os.environ.get("TEMPORAL_NAMESPACE", "default")
TEMPORAL_TASK_QUEUE = os.environ.get("TEMPORAL_TASK_QUEUE", "test-task-queue")
TEMPORAL_API_KEY = os.environ.get("TEMPORAL_API_KEY", "your-api-key")


async def main():
    client = await Client.connect(
        TEMPORAL_ADDRESS,
        namespace=TEMPORAL_NAMESPACE,
        rpc_metadata={"temporal-namespace": TEMPORAL_NAMESPACE},
        api_key=TEMPORAL_API_KEY,
        tls=True,
    )

    print("Initializing worker...")

    # Run the worker
    worker = Worker(
        client,
        task_queue=TEMPORAL_TASK_QUEUE,
        workflows=[your_workflow],
        activities=[your_first_activity, your_second_activity, your_third_activity],
    )

    print("Starting worker... Waiting for tasks.")
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
