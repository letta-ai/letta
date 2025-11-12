import asyncio
import random
import time
from functools import wraps
from typing import Any, Dict, List

from letta.otel.tracing import trace_method

try:
    from pinecone import IndexEmbed, PineconeAsyncio
    from pinecone.exceptions.exceptions import (
        ForbiddenException,
        NotFoundException,
        PineconeApiException,
        ServiceException,
        UnauthorizedException,
    )

    PINECONE_AVAILABLE = True
except ImportError:
    PINECONE_AVAILABLE = False

from letta.constants import (
    PINECONE_CLOUD,
    PINECONE_EMBEDDING_MODEL,
    PINECONE_MAX_BATCH_SIZE,
    PINECONE_MAX_RETRY_ATTEMPTS,
    PINECONE_METRIC,
    PINECONE_REGION,
    PINECONE_RETRY_BACKOFF_FACTOR,
    PINECONE_RETRY_BASE_DELAY,
    PINECONE_RETRY_MAX_DELAY,
    PINECONE_TEXT_FIELD_NAME,
    PINECONE_THROTTLE_DELAY,
)
from letta.log import get_logger
from letta.schemas.user import User
from letta.settings import settings

logger = get_logger(__name__)


def pinecone_retry(
    max_attempts: int = PINECONE_MAX_RETRY_ATTEMPTS,
    base_delay: float = PINECONE_RETRY_BASE_DELAY,
    max_delay: float = PINECONE_RETRY_MAX_DELAY,
    backoff_factor: float = PINECONE_RETRY_BACKOFF_FACTOR,
):
    """
    Decorator to retry Pinecone operations with exponential backoff.

    Args:
        max_attempts: Maximum number of retry attempts
        base_delay: Base delay in seconds for the first retry
        max_delay: Maximum delay in seconds between retries
        backoff_factor: Factor to increase delay after each failed attempt
    """

    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            operation_name = func.__name__
            start_time = time.time()

            for attempt in range(max_attempts):
                try:
                    logger.debug(f"[Pinecone] Starting {operation_name} (attempt {attempt + 1}/{max_attempts})")
                    result = await func(*args, **kwargs)

                    execution_time = time.time() - start_time
                    logger.info(f"[Pinecone] {operation_name} completed successfully in {execution_time:.2f}s")
                    return result

                except (ServiceException, PineconeApiException) as e:
                    # retryable server errors
                    if attempt == max_attempts - 1:
                        execution_time = time.time() - start_time
                        logger.error(f"[Pinecone] {operation_name} failed after {max_attempts} attempts in {execution_time:.2f}s: {str(e)}")
                        raise

                    # calculate delay with exponential backoff and jitter
                    delay = min(base_delay * (backoff_factor**attempt), max_delay)
                    jitter = random.uniform(0, delay * 0.1)  # add up to 10% jitter
                    total_delay = delay + jitter

                    logger.warning(
                        f"[Pinecone] {operation_name} failed (attempt {attempt + 1}/{max_attempts}): {str(e)}. Retrying in {total_delay:.2f}s"
                    )
                    await asyncio.sleep(total_delay)

                except (UnauthorizedException, ForbiddenException) as e:
                    # non-retryable auth errors
                    execution_time = time.time() - start_time
                    logger.error(f"[Pinecone] {operation_name} failed with auth error in {execution_time:.2f}s: {str(e)}")
                    raise

                except NotFoundException as e:
                    # non-retryable not found errors
                    execution_time = time.time() - start_time
                    logger.warning(f"[Pinecone] {operation_name} failed with not found error in {execution_time:.2f}s: {str(e)}")
                    raise

                except Exception as e:
                    # other unexpected errors - retry once then fail
                    if attempt == max_attempts - 1:
                        execution_time = time.time() - start_time
                        logger.error(f"[Pinecone] {operation_name} failed after {max_attempts} attempts in {execution_time:.2f}s: {str(e)}")
                        raise

                    delay = min(base_delay * (backoff_factor**attempt), max_delay)
                    jitter = random.uniform(0, delay * 0.1)
                    total_delay = delay + jitter

                    logger.warning(
                        f"[Pinecone] {operation_name} failed with unexpected error (attempt {attempt + 1}/{max_attempts}): {str(e)}. Retrying in {total_delay:.2f}s"
                    )
                    await asyncio.sleep(total_delay)

        return wrapper

    return decorator


def should_use_pinecone(verbose: bool = False):
    if verbose:
        logger.info(
            "Pinecone check: enable_pinecone=%s, api_key=%s, agent_index=%s, source_index=%s",
            settings.enable_pinecone,
            bool(settings.pinecone_api_key),
            bool(settings.pinecone_agent_index),
            bool(settings.pinecone_source_index),
        )

    return all(
        (
            PINECONE_AVAILABLE,
            settings.enable_pinecone,
            settings.pinecone_api_key,
            settings.pinecone_agent_index,
            settings.pinecone_source_index,
        )
    )


@pinecone_retry()
@trace_method
async def upsert_pinecone_indices():
    if not PINECONE_AVAILABLE:
        raise ImportError("Pinecone is not available. Please install pinecone to use this feature.")

    indices = get_pinecone_indices()
    logger.info(f"[Pinecone] Upserting {len(indices)} indices: {indices}")

    # Reuse single client for all indices to avoid creating multiple SSL contexts
    async with PineconeAsyncio(api_key=settings.pinecone_api_key) as pc:
        for index_name in indices:
            if not await pc.has_index(index_name):
                logger.info(f"[Pinecone] Creating index {index_name} with model {PINECONE_EMBEDDING_MODEL}")
                await pc.create_index_for_model(
                    name=index_name,
                    cloud=PINECONE_CLOUD,
                    region=PINECONE_REGION,
                    embed=IndexEmbed(model=PINECONE_EMBEDDING_MODEL, field_map={"text": PINECONE_TEXT_FIELD_NAME}, metric=PINECONE_METRIC),
                )
                logger.info(f"[Pinecone] Successfully created index {index_name}")
            else:
                logger.debug(f"[Pinecone] Index {index_name} already exists")


def get_pinecone_indices() -> List[str]:
    return [settings.pinecone_agent_index, settings.pinecone_source_index]


@pinecone_retry()
@trace_method
async def upsert_file_records_to_pinecone_index(file_id: str, source_id: str, chunks: List[str], actor: User):
    if not PINECONE_AVAILABLE:
        raise ImportError("Pinecone is not available. Please install pinecone to use this feature.")

    logger.info(f"[Pinecone] Preparing to upsert {len(chunks)} chunks for file {file_id} source {source_id}")

    records = []
    for i, chunk in enumerate(chunks):
        record = {
            "_id": f"{file_id}_{i}",
            PINECONE_TEXT_FIELD_NAME: chunk,
            "file_id": file_id,
            "source_id": source_id,
        }
        records.append(record)

    logger.debug(f"[Pinecone] Created {len(records)} records for file {file_id}")
    return await upsert_records_to_pinecone_index(records, actor)


@pinecone_retry()
@trace_method
async def delete_file_records_from_pinecone_index(file_id: str, actor: User):
    if not PINECONE_AVAILABLE:
        raise ImportError("Pinecone is not available. Please install pinecone to use this feature.")

    namespace = actor.organization_id
    logger.info(f"[Pinecone] Deleting records for file {file_id} from index {settings.pinecone_source_index} namespace {namespace}")

    try:
        async with PineconeAsyncio(api_key=settings.pinecone_api_key) as pc:
            description = await pc.describe_index(name=settings.pinecone_source_index)
            async with pc.IndexAsyncio(host=description.index.host) as dense_index:
                await dense_index.delete(
                    filter={
                        "file_id": {"$eq": file_id},
                    },
                    namespace=namespace,
                )
                logger.info(f"[Pinecone] Successfully deleted records for file {file_id}")
    except NotFoundException:
        logger.warning(f"[Pinecone] Namespace {namespace} not found for file {file_id} and org {actor.organization_id}")


@pinecone_retry()
@trace_method
async def delete_source_records_from_pinecone_index(source_id: str, actor: User):
    if not PINECONE_AVAILABLE:
        raise ImportError("Pinecone is not available. Please install pinecone to use this feature.")

    namespace = actor.organization_id
    logger.info(f"[Pinecone] Deleting records for source {source_id} from index {settings.pinecone_source_index} namespace {namespace}")

    try:
        async with PineconeAsyncio(api_key=settings.pinecone_api_key) as pc:
            description = await pc.describe_index(name=settings.pinecone_source_index)
            async with pc.IndexAsyncio(host=description.index.host) as dense_index:
                await dense_index.delete(filter={"source_id": {"$eq": source_id}}, namespace=namespace)
                logger.info(f"[Pinecone] Successfully deleted records for source {source_id}")
    except NotFoundException:
        logger.warning(f"[Pinecone] Namespace {namespace} not found for source {source_id} and org {actor.organization_id}")


@pinecone_retry()
@trace_method
async def upsert_records_to_pinecone_index(records: List[dict], actor: User):
    if not PINECONE_AVAILABLE:
        raise ImportError("Pinecone is not available. Please install pinecone to use this feature.")

    logger.info(f"[Pinecone] Upserting {len(records)} records to index {settings.pinecone_source_index} for org {actor.organization_id}")

    async with PineconeAsyncio(api_key=settings.pinecone_api_key) as pc:
        description = await pc.describe_index(name=settings.pinecone_source_index)
        async with pc.IndexAsyncio(host=description.index.host) as dense_index:
            # process records in batches to avoid exceeding pinecone limits
            total_batches = (len(records) + PINECONE_MAX_BATCH_SIZE - 1) // PINECONE_MAX_BATCH_SIZE
            logger.debug(f"[Pinecone] Processing {total_batches} batches of max {PINECONE_MAX_BATCH_SIZE} records each")

            for i in range(0, len(records), PINECONE_MAX_BATCH_SIZE):
                batch = records[i : i + PINECONE_MAX_BATCH_SIZE]
                batch_num = (i // PINECONE_MAX_BATCH_SIZE) + 1

                logger.debug(f"[Pinecone] Upserting batch {batch_num}/{total_batches} with {len(batch)} records")
                await dense_index.upsert_records(actor.organization_id, batch)

                # throttle between batches (except the last one)
                if batch_num < total_batches:
                    jitter = random.uniform(0, PINECONE_THROTTLE_DELAY * 0.2)  # ±20% jitter
                    throttle_delay = PINECONE_THROTTLE_DELAY + jitter
                    logger.debug(f"[Pinecone] Throttling for {throttle_delay:.3f}s before next batch")
                    await asyncio.sleep(throttle_delay)

            logger.info(f"[Pinecone] Successfully upserted all {len(records)} records in {total_batches} batches")


@pinecone_retry()
@trace_method
async def search_pinecone_index(query: str, limit: int, filter: Dict[str, Any], actor: User) -> Dict[str, Any]:
    if not PINECONE_AVAILABLE:
        raise ImportError("Pinecone is not available. Please install pinecone to use this feature.")

    namespace = actor.organization_id
    logger.info(
        f"[Pinecone] Searching index {settings.pinecone_source_index} namespace {namespace} with query length {len(query)} chars, limit {limit}"
    )
    logger.debug(f"[Pinecone] Search filter: {filter}")

    async with PineconeAsyncio(api_key=settings.pinecone_api_key) as pc:
        description = await pc.describe_index(name=settings.pinecone_source_index)
        async with pc.IndexAsyncio(host=description.index.host) as dense_index:
            try:
                # search the dense index with reranking
                search_results = await dense_index.search(
                    namespace=namespace,
                    query={
                        "top_k": limit,
                        "inputs": {"text": query},
                        "filter": filter,
                    },
                    rerank={"model": "bge-reranker-v2-m3", "top_n": limit, "rank_fields": [PINECONE_TEXT_FIELD_NAME]},
                )

                result_count = len(search_results.get("matches", []))
                logger.info(f"[Pinecone] Search completed, found {result_count} matches")
                return search_results

            except Exception as e:
                logger.warning(f"[Pinecone] Failed to search namespace {namespace}: {str(e)}")
                raise e


@pinecone_retry()
@trace_method
async def list_pinecone_index_for_files(file_id: str, actor: User, limit: int = None, pagination_token: str = None) -> List[str]:
    if not PINECONE_AVAILABLE:
        raise ImportError("Pinecone is not available. Please install pinecone to use this feature.")

    namespace = actor.organization_id
    logger.info(f"[Pinecone] Listing records for file {file_id} from index {settings.pinecone_source_index} namespace {namespace}")
    logger.debug(f"[Pinecone] List params - limit: {limit}, pagination_token: {pagination_token}")

    try:
        async with PineconeAsyncio(api_key=settings.pinecone_api_key) as pc:
            description = await pc.describe_index(name=settings.pinecone_source_index)
            async with pc.IndexAsyncio(host=description.index.host) as dense_index:
                kwargs = {"namespace": namespace, "prefix": file_id}
                if limit is not None:
                    kwargs["limit"] = limit
                if pagination_token is not None:
                    kwargs["pagination_token"] = pagination_token

                try:
                    result = []
                    async for ids in dense_index.list(**kwargs):
                        result.extend(ids)

                    logger.info(f"[Pinecone] Successfully listed {len(result)} records for file {file_id}")
                    return result

                except Exception as e:
                    logger.warning(f"[Pinecone] Failed to list records for file {file_id} in namespace {namespace}: {str(e)}")
                    raise e

    except NotFoundException:
        logger.warning(f"[Pinecone] Namespace {namespace} not found for file {file_id} and org {actor.organization_id}")
        return []
