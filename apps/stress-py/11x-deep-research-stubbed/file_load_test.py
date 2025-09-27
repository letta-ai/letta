import asyncio
import os
import time
from pathlib import Path
from letta_client import AsyncLetta
from constants import (
    BASE_URL,
    TOKEN,
    TIMEOUT,
)

# Override N and MAX_CONCURRENCY with environment variables if set
N = int(os.environ.get("N", 100))
MAX_CONCURRENCY = int(os.environ.get("MAX_CONCURRENCY", 10))

# File-specific configuration
TEST_DATA_DIR = Path("../test_data")
EMBEDDING_MODEL = "openai/text-embedding-3-small"
FOLDERS_PER_BATCH = 5
FILE_PROCESSING_TIMEOUT = int(os.environ.get("FILE_TIMEOUT", 120))  # seconds

start_time = None
folders_created = []
total_bytes_uploaded = 0


async def upload_file_to_folder(
    client: AsyncLetta,
    folder_id: str,
    file_path: Path,
    task_id: int,
    max_retries: int = 3,
):
    """Upload a single file to a folder with retry logic"""
    global total_bytes_uploaded
    file_size = file_path.stat().st_size

    for attempt in range(max_retries):
        try:
            # Upload file
            with open(file_path, "rb") as f:
                file_metadata = await client.folders.files.upload(
                    folder_id=folder_id,
                    file=f,
                    name=file_path.name,
                )

            # Wait for processing to complete by polling the files list
            # Some files might already be completed, check valid statuses
            if file_metadata.processing_status not in ["completed", "error", "success"]:
                max_wait = FILE_PROCESSING_TIMEOUT
                start_wait = time.time()

                while file_metadata.processing_status not in [
                    "completed",
                    "error",
                    "success",
                ]:
                    if time.time() - start_wait > max_wait:
                        raise TimeoutError(f"File processing timeout after {max_wait}s")

                    await asyncio.sleep(0.5)

                    # Poll by listing files and finding our file
                    files = await client.folders.files.list(folder_id=folder_id)
                    for f in files:
                        if f.id == file_metadata.id:
                            file_metadata = f
                            break

            if file_metadata.processing_status == "error":
                raise Exception(f"Processing failed: {file_metadata.error_message}")

            total_bytes_uploaded += file_size
            print(
                f"Task {task_id} completed - File: {file_path.name} ({file_size / (1024 * 1024):.1f} MB)"
            )
            return  # success

        except Exception as e:
            error_str = str(e)
            if "429" in error_str or "rate" in error_str.lower():
                if attempt < max_retries - 1:
                    backoff_time = 2**attempt
                    print(f"Task {task_id} rate limited, retrying in {backoff_time}s")
                    await asyncio.sleep(backoff_time)
                else:
                    print(f"Task {task_id} failed after {max_retries} attempts: {e}")
                    raise
            else:
                print(f"Task {task_id} failed: {e}")
                raise


async def create_folders(client: AsyncLetta, count: int) -> list[str]:
    """Create folders for file uploads"""
    folder_ids = []
    for i in range(count):
        folder = await client.folders.create(
            name=f"stress_test_folder_{i}_{int(time.time())}",
            embedding=EMBEDDING_MODEL,
        )
        folder_ids.append(folder.id)
    print(f"Created {count} folders")
    return folder_ids


async def cleanup_folders(client: AsyncLetta, folder_ids: list[str]):
    """Clean up created folders"""
    for folder_id in folder_ids:
        try:
            await client.folders.delete(folder_id=folder_id)
        except Exception as e:
            print(f"Failed to delete folder {folder_id}: {e}")
    print(f"Cleaned up {len(folder_ids)} folders")


async def main():
    global start_time, folders_created
    start_time = time.time()

    # Only pass token if it's set
    client_kwargs = {"base_url": BASE_URL, "timeout": TIMEOUT}
    if TOKEN:
        client_kwargs["token"] = TOKEN

    client = AsyncLetta(**client_kwargs)
    print(
        f"Configuration: N={N}, MAX_CONCURRENCY={MAX_CONCURRENCY}, TIMEOUT={FILE_PROCESSING_TIMEOUT}s"
    )
    print(f"Starting {N} file uploads with concurrency limit of {MAX_CONCURRENCY}...")

    # Get test files
    test_files = []
    if TEST_DATA_DIR.exists():
        pdf_files = list(TEST_DATA_DIR.glob("*.pdf"))
        if pdf_files:
            print(f"Using {len(pdf_files)} PDFs from {TEST_DATA_DIR}")
            test_files = pdf_files

    if not test_files:
        print("No test files found in ../test_data/, please add PDF files")
        return

    # Create folders for uploads
    folders_created = await create_folders(client, min(FOLDERS_PER_BATCH, N))

    # Create semaphore for concurrency control
    semaphore = asyncio.Semaphore(MAX_CONCURRENCY)

    async def controlled_upload(task_id: int):
        async with semaphore:
            # Round-robin file and folder selection
            file_path = test_files[task_id % len(test_files)]
            folder_id = folders_created[task_id % len(folders_created)]
            await upload_file_to_folder(client, folder_id, file_path, task_id)

    # Create all tasks
    all_tasks = [controlled_upload(i) for i in range(N)]
    print(
        f"All {N} tasks created, processing with {MAX_CONCURRENCY} concurrent limit..."
    )

    # Run all tasks
    results = await asyncio.gather(*all_tasks, return_exceptions=True)

    # Calculate results
    completed = sum(1 for r in results if not isinstance(r, Exception))
    failed = sum(1 for r in results if isinstance(r, Exception))

    total_time = time.time() - start_time

    # Print results
    print(f"\n{'=' * 60}")
    print("FILE LOAD TEST RESULTS")
    print(f"{'=' * 60}")
    print(f"Completed: {completed}/{N} uploads")
    print(f"Failed: {failed} uploads")
    print(f"Total time: {total_time:.2f} seconds")
    print(f"Total data uploaded: {total_bytes_uploaded / (1024 * 1024):.1f} MB")
    print(f"Average rate: {N / total_time:.2f} uploads/second")
    print(
        f"Throughput: {total_bytes_uploaded / (1024 * 1024) / total_time:.2f} MB/second"
    )

    # Clean up
    print("\nCleaning up...")
    await cleanup_folders(client, folders_created)


if __name__ == "__main__":
    asyncio.run(main())
