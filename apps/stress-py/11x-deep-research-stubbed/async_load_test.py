import asyncio
import json
import time
from letta_client import AsyncLetta, MessageCreate
from constants import (
    BASE_URL,
    TOKEN,
    TIMEOUT,
    AGENT_FILE_PATH,
    PROJECT_NAME,
    N,
    MAX_CONCURRENCY,
    CALLBACK_URL,
    MOCK_USER_CONTENT,
)


start_time = None


async def upload_and_run_agent(
    client: AsyncLetta, template_name: str, task_id: int, max_retries: int = 3
):
    for attempt in range(max_retries):
        try:
            resp = await client.templates.agents.create(
                project=PROJECT_NAME,
                template_version=f"{template_name}:latest",
            )
            agent_id = resp.agents[0].id
            run = await client.agents.messages.create_async(
                agent_id=agent_id,
                messages=[MessageCreate(role="user", content=MOCK_USER_CONTENT)],
                callback_url=CALLBACK_URL,  # TODO: Have local server spun up
            )
            print(f"Task {task_id} completed - Run ID: {run.id}, Agent ID: {agent_id}")
            return  # success, exit the function
        except Exception as e:
            error_str = str(e)
            if "429" in error_str or "Rate limited" in error_str:
                if attempt < max_retries - 1:
                    # exponential backoff: 2^attempt seconds (1s, 2s, 4s)
                    backoff_time = 2**attempt
                    print(
                        f"Task {task_id} rate limited, retrying in {backoff_time}s (attempt {attempt + 1}/{max_retries})"
                    )
                    await asyncio.sleep(backoff_time)
                else:
                    print(f"Task {task_id} failed after {max_retries} attempts: {e}")
            else:
                # non-rate-limit error, don't retry
                print(f"Task {task_id} failed: {e}")
                return


async def main():
    global start_time
    start_time = time.time()

    # Only pass token if it's set
    client_kwargs = {"base_url": BASE_URL, "timeout": TIMEOUT}
    if TOKEN:
        client_kwargs["token"] = TOKEN

    client = AsyncLetta(**client_kwargs)
    print(f"Starting {N} jobs with concurrency limit of {MAX_CONCURRENCY}...")

    # Upload the agent file as a template
    resp = await client.projects.list()
    with open(AGENT_FILE_PATH, "r") as f:
        agent_file_data = json.load(f)
    resp = await client.templates.createtemplate(
        project=PROJECT_NAME,
        request={
            "type": "agent_file",
            "agent_file": agent_file_data,
        },
    )
    client.agents.import_file()
    semaphore = asyncio.Semaphore(MAX_CONCURRENCY)

    async def controlled_task(task_id):
        async with semaphore:
            await upload_and_run_agent(client, resp.name, task_id)

    all_tasks = [controlled_task(i) for i in range(N)]
    print(
        f"All {N} tasks created, processing with {MAX_CONCURRENCY} concurrent limit..."
    )
    results = await asyncio.gather(*all_tasks, return_exceptions=True)

    completed = sum(1 for r in results if not isinstance(r, Exception))
    failed = sum(1 for r in results if isinstance(r, Exception))

    total_time = time.time() - start_time
    print(f"\nCompleted {completed} tasks, {failed} failed in {total_time:.2f} seconds")
    print(f"Average rate: {N / total_time:.2f} tasks/second")


if __name__ == "__main__":
    asyncio.run(main())
