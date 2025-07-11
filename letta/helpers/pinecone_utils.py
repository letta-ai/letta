from typing import Any, Dict, List

try:
    from pinecone import IndexEmbed, PineconeAsyncio
    from pinecone.exceptions.exceptions import NotFoundException

    PINECONE_AVAILABLE = True
except ImportError:
    PINECONE_AVAILABLE = False

from letta.constants import (
    PINECONE_CLOUD,
    PINECONE_EMBEDDING_MODEL,
    PINECONE_MAX_BATCH_SIZE,
    PINECONE_METRIC,
    PINECONE_REGION,
    PINECONE_TEXT_FIELD_NAME,
)
from letta.log import get_logger
from letta.schemas.user import User
from letta.settings import settings

logger = get_logger(__name__)


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


async def upsert_pinecone_indices():
    if not PINECONE_AVAILABLE:
        raise ImportError("Pinecone is not available. Please install pinecone to use this feature.")

    for index_name in get_pinecone_indices():
        async with PineconeAsyncio(api_key=settings.pinecone_api_key) as pc:
            if not await pc.has_index(index_name):
                await pc.create_index_for_model(
                    name=index_name,
                    cloud=PINECONE_CLOUD,
                    region=PINECONE_REGION,
                    embed=IndexEmbed(model=PINECONE_EMBEDDING_MODEL, field_map={"text": PINECONE_TEXT_FIELD_NAME}, metric=PINECONE_METRIC),
                )


def get_pinecone_indices() -> List[str]:
    return [settings.pinecone_agent_index, settings.pinecone_source_index]


async def upsert_file_records_to_pinecone_index(file_id: str, source_id: str, chunks: List[str], actor: User):
    if not PINECONE_AVAILABLE:
        raise ImportError("Pinecone is not available. Please install pinecone to use this feature.")

    records = []
    for i, chunk in enumerate(chunks):
        record = {
            "_id": f"{file_id}_{i}",
            PINECONE_TEXT_FIELD_NAME: chunk,
            "file_id": file_id,
            "source_id": source_id,
        }
        records.append(record)

    return await upsert_records_to_pinecone_index(records, actor)


async def delete_file_records_from_pinecone_index(file_id: str, actor: User):
    if not PINECONE_AVAILABLE:
        raise ImportError("Pinecone is not available. Please install pinecone to use this feature.")

    namespace = actor.organization_id
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
    except NotFoundException:
        logger.warning(f"Pinecone namespace {namespace} not found for {file_id} and {actor.organization_id}")


async def delete_source_records_from_pinecone_index(source_id: str, actor: User):
    if not PINECONE_AVAILABLE:
        raise ImportError("Pinecone is not available. Please install pinecone to use this feature.")

    namespace = actor.organization_id
    try:
        async with PineconeAsyncio(api_key=settings.pinecone_api_key) as pc:
            description = await pc.describe_index(name=settings.pinecone_source_index)
            async with pc.IndexAsyncio(host=description.index.host) as dense_index:
                await dense_index.delete(filter={"source_id": {"$eq": source_id}}, namespace=namespace)
    except NotFoundException:
        logger.warning(f"Pinecone namespace {namespace} not found for {source_id} and {actor.organization_id}")


async def upsert_records_to_pinecone_index(records: List[dict], actor: User):
    if not PINECONE_AVAILABLE:
        raise ImportError("Pinecone is not available. Please install pinecone to use this feature.")

    async with PineconeAsyncio(api_key=settings.pinecone_api_key) as pc:
        description = await pc.describe_index(name=settings.pinecone_source_index)
        async with pc.IndexAsyncio(host=description.index.host) as dense_index:
            # Process records in batches to avoid exceeding Pinecone limits
            for i in range(0, len(records), PINECONE_MAX_BATCH_SIZE):
                batch = records[i : i + PINECONE_MAX_BATCH_SIZE]
                await dense_index.upsert_records(actor.organization_id, batch)


async def search_pinecone_index(query: str, limit: int, filter: Dict[str, Any], actor: User) -> Dict[str, Any]:
    if not PINECONE_AVAILABLE:
        raise ImportError("Pinecone is not available. Please install pinecone to use this feature.")

    async with PineconeAsyncio(api_key=settings.pinecone_api_key) as pc:
        description = await pc.describe_index(name=settings.pinecone_source_index)
        async with pc.IndexAsyncio(host=description.index.host) as dense_index:
            namespace = actor.organization_id

            try:
                # Search the dense index with reranking
                search_results = await dense_index.search(
                    namespace=namespace,
                    query={
                        "top_k": limit,
                        "inputs": {"text": query},
                        "filter": filter,
                    },
                    rerank={"model": "bge-reranker-v2-m3", "top_n": limit, "rank_fields": [PINECONE_TEXT_FIELD_NAME]},
                )
                return search_results
            except Exception as e:
                logger.warning(f"Failed to search Pinecone namespace {actor.organization_id}: {str(e)}")
                raise e


async def list_pinecone_index_for_files(file_id: str, actor: User, limit: int = None, pagination_token: str = None) -> List[str]:
    if not PINECONE_AVAILABLE:
        raise ImportError("Pinecone is not available. Please install pinecone to use this feature.")

    namespace = actor.organization_id
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
                    return result
                except Exception as e:
                    logger.warning(f"Failed to list Pinecone namespace {actor.organization_id}: {str(e)}")
                    raise e
    except NotFoundException:
        logger.warning(f"Pinecone namespace {namespace} not found for {file_id} and {actor.organization_id}")
