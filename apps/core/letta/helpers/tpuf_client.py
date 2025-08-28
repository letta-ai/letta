"""Turbopuffer utilities for archival memory storage."""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from letta.otel.tracing import trace_method
from letta.schemas.passage import Passage as PydanticPassage
from letta.settings import settings

logger = logging.getLogger(__name__)


def should_use_tpuf() -> bool:
    return bool(settings.use_tpuf) and bool(settings.tpuf_api_key)


class TurbopufferClient:
    """Client for managing archival memory with Turbopuffer vector database."""

    def __init__(self, api_key: str = None, region: str = None):
        """Initialize Turbopuffer client."""
        self.api_key = api_key or settings.tpuf_api_key
        self.region = region or settings.tpuf_region

        if not self.api_key:
            raise ValueError("Turbopuffer API key not provided")

    @trace_method
    def _get_namespace_name(self, archive_id: str) -> str:
        """Get namespace name for a specific archive."""
        # use archive_id as namespace to isolate different archives' memories
        # append environment suffix to namespace for isolation if environment is set
        environment = settings.environment
        if environment:
            namespace_name = f"{archive_id}_{environment.lower()}"
        else:
            namespace_name = archive_id
        return namespace_name

    @trace_method
    async def insert_archival_memories(
        self,
        archive_id: str,
        text_chunks: List[str],
        embeddings: List[List[float]],
        passage_ids: List[str],
        organization_id: str,
        tags: Optional[List[str]] = None,
        created_at: Optional[datetime] = None,
    ) -> List[PydanticPassage]:
        """Insert passages into Turbopuffer.

        Args:
            archive_id: ID of the archive
            text_chunks: List of text chunks to store
            embeddings: List of embedding vectors corresponding to text chunks
            passage_ids: List of passage IDs (must match 1:1 with text_chunks)
            organization_id: Organization ID for the passages
            tags: Optional list of tags to attach to all passages
            created_at: Optional timestamp for retroactive entries (defaults to current UTC time)

        Returns:
            List of PydanticPassage objects that were inserted
        """
        from turbopuffer import AsyncTurbopuffer

        namespace_name = self._get_namespace_name(archive_id)

        # handle timestamp - ensure UTC
        if created_at is None:
            timestamp = datetime.now(timezone.utc)
        else:
            # ensure the provided timestamp is timezone-aware and in UTC
            if created_at.tzinfo is None:
                # assume UTC if no timezone provided
                timestamp = created_at.replace(tzinfo=timezone.utc)
            else:
                # convert to UTC if in different timezone
                timestamp = created_at.astimezone(timezone.utc)

        # passage_ids must be provided for dual-write consistency
        if not passage_ids:
            raise ValueError("passage_ids must be provided for Turbopuffer insertion")
        if len(passage_ids) != len(text_chunks):
            raise ValueError(f"passage_ids length ({len(passage_ids)}) must match text_chunks length ({len(text_chunks)})")
        if len(passage_ids) != len(embeddings):
            raise ValueError(f"passage_ids length ({len(passage_ids)}) must match embeddings length ({len(embeddings)})")

        # prepare column-based data for turbopuffer - optimized for batch insert
        ids = []
        vectors = []
        texts = []
        organization_ids = []
        archive_ids = []
        created_ats = []
        passages = []

        # prepare tag columns
        tag_columns = {tag: [] for tag in (tags or [])}

        for idx, (text, embedding) in enumerate(zip(text_chunks, embeddings)):
            passage_id = passage_ids[idx]

            # append to columns
            ids.append(passage_id)
            vectors.append(embedding)
            texts.append(text)
            organization_ids.append(organization_id)
            archive_ids.append(archive_id)
            created_ats.append(timestamp)

            # append tag values
            for tag in tag_columns:
                tag_columns[tag].append(True)

            # Create PydanticPassage object
            passage = PydanticPassage(
                id=passage_id,
                text=text,
                organization_id=organization_id,
                archive_id=archive_id,
                created_at=timestamp,
                metadata_={},
                embedding=embedding,
                embedding_config=None,  # Will be set by caller if needed
            )
            passages.append(passage)

        # build column-based upsert data
        upsert_columns = {
            "id": ids,
            "vector": vectors,
            "text": texts,
            "organization_id": organization_ids,
            "archive_id": archive_ids,
            "created_at": created_ats,
        }

        # add tag columns if any
        upsert_columns.update(tag_columns)

        try:
            # Use AsyncTurbopuffer as a context manager for proper resource cleanup
            async with AsyncTurbopuffer(api_key=self.api_key, region=self.region) as client:
                namespace = client.namespace(namespace_name)
                # turbopuffer recommends column-based writes for performance
                await namespace.write(upsert_columns=upsert_columns, distance_metric="cosine_distance")
                logger.info(f"Successfully inserted {len(ids)} passages to Turbopuffer for archive {archive_id}")
                return passages

        except Exception as e:
            logger.error(f"Failed to insert passages to Turbopuffer: {e}")
            # check if it's a duplicate ID error
            if "duplicate" in str(e).lower():
                logger.error("Duplicate passage IDs detected in batch")
            raise

    @trace_method
    async def query_passages(
        self, archive_id: str, query_embedding: List[float], top_k: int = 10, filters: Optional[Dict[str, Any]] = None
    ) -> List[Tuple[PydanticPassage, float]]:
        """Query passages from Turbopuffer."""
        from turbopuffer import AsyncTurbopuffer

        namespace_name = self._get_namespace_name(archive_id)

        try:
            async with AsyncTurbopuffer(api_key=self.api_key, region=self.region) as client:
                namespace = client.namespace(namespace_name)

                # build filter conditions
                filter_conditions = []
                if filters:
                    for key, value in filters.items():
                        filter_conditions.append((key, "Eq", value))

                query_params = {
                    "rank_by": ("vector", "ANN", query_embedding),
                    "top_k": top_k,
                    "include_attributes": ["text", "organization_id", "archive_id", "created_at"],
                }

                if filter_conditions:
                    query_params["filters"] = ("And", filter_conditions) if len(filter_conditions) > 1 else filter_conditions[0]

                result = await namespace.query(**query_params)

                # convert results back to passages
                passages_with_scores = []
                # Turbopuffer returns a NamespaceQueryResponse with a rows attribute
                for row in result.rows:
                    # Build metadata including any filter conditions that were applied
                    metadata = {}
                    if filters:
                        metadata["applied_filters"] = filters

                    # Create a passage with minimal fields - embeddings are not returned from Turbopuffer
                    passage = PydanticPassage(
                        id=row.id,
                        text=getattr(row, "text", ""),
                        organization_id=getattr(row, "organization_id", None),
                        archive_id=archive_id,  # use the archive_id from the query
                        created_at=getattr(row, "created_at", None),
                        metadata_=metadata,  # Include filter conditions in metadata
                        # Set required fields to empty/default values since we don't store embeddings
                        embedding=[],  # Empty embedding since we don't return it from Turbopuffer
                        embedding_config=None,  # No embedding config needed for retrieved passages
                    )
                    # turbopuffer returns distance in $dist attribute, convert to similarity score
                    distance = getattr(row, "$dist", 0.0)
                    score = 1.0 - distance
                    passages_with_scores.append((passage, score))

                return passages_with_scores

        except Exception as e:
            logger.error(f"Failed to query passages from Turbopuffer: {e}")
            raise

    @trace_method
    async def delete_passage(self, archive_id: str, passage_id: str) -> bool:
        """Delete a passage from Turbopuffer."""
        from turbopuffer import AsyncTurbopuffer

        namespace_name = self._get_namespace_name(archive_id)

        try:
            async with AsyncTurbopuffer(api_key=self.api_key, region=self.region) as client:
                namespace = client.namespace(namespace_name)
                # Use write API with deletes parameter as per Turbopuffer docs
                await namespace.write(deletes=[passage_id])
                logger.info(f"Successfully deleted passage {passage_id} from Turbopuffer archive {archive_id}")
                return True
        except Exception as e:
            logger.error(f"Failed to delete passage from Turbopuffer: {e}")
            raise

    @trace_method
    async def delete_passages(self, archive_id: str, passage_ids: List[str]) -> bool:
        """Delete multiple passages from Turbopuffer."""
        from turbopuffer import AsyncTurbopuffer

        if not passage_ids:
            return True

        namespace_name = self._get_namespace_name(archive_id)

        try:
            async with AsyncTurbopuffer(api_key=self.api_key, region=self.region) as client:
                namespace = client.namespace(namespace_name)
                # Use write API with deletes parameter as per Turbopuffer docs
                await namespace.write(deletes=passage_ids)
                logger.info(f"Successfully deleted {len(passage_ids)} passages from Turbopuffer archive {archive_id}")
                return True
        except Exception as e:
            logger.error(f"Failed to delete passages from Turbopuffer: {e}")
            raise

    @trace_method
    async def delete_all_passages(self, archive_id: str) -> bool:
        """Delete all passages for an archive from Turbopuffer."""
        from turbopuffer import AsyncTurbopuffer

        namespace_name = self._get_namespace_name(archive_id)

        try:
            async with AsyncTurbopuffer(api_key=self.api_key, region=self.region) as client:
                namespace = client.namespace(namespace_name)
                # Turbopuffer has a delete_all() method on namespace
                await namespace.delete_all()
                logger.info(f"Successfully deleted all passages for archive {archive_id}")
                return True
        except Exception as e:
            logger.error(f"Failed to delete all passages from Turbopuffer: {e}")
            raise
