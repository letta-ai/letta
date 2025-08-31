"""Turbopuffer utilities for archival memory storage."""

import logging
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from letta.otel.tracing import trace_method
from letta.schemas.enums import TagMatchMode
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
        tags_arrays = []  # Store tags as arrays
        passages = []

        for idx, (text, embedding) in enumerate(zip(text_chunks, embeddings)):
            passage_id = passage_ids[idx]

            # append to columns
            ids.append(passage_id)
            vectors.append(embedding)
            texts.append(text)
            organization_ids.append(organization_id)
            archive_ids.append(archive_id)
            created_ats.append(timestamp)
            tags_arrays.append(tags or [])  # Store tags as array

            # Create PydanticPassage object
            passage = PydanticPassage(
                id=passage_id,
                text=text,
                organization_id=organization_id,
                archive_id=archive_id,
                created_at=timestamp,
                metadata_={},
                tags=tags or [],  # Include tags in the passage
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
            "tags": tags_arrays,  # Add tags as array column
        }

        try:
            # Use AsyncTurbopuffer as a context manager for proper resource cleanup
            async with AsyncTurbopuffer(api_key=self.api_key, region=self.region) as client:
                namespace = client.namespace(namespace_name)
                # turbopuffer recommends column-based writes for performance
                await namespace.write(
                    upsert_columns=upsert_columns,
                    distance_metric="cosine_distance",
                    schema={"text": {"type": "string", "full_text_search": True}},
                )
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
        self,
        archive_id: str,
        query_embedding: Optional[List[float]] = None,
        query_text: Optional[str] = None,
        search_mode: str = "vector",  # "vector", "fts", "hybrid"
        top_k: int = 10,
        tags: Optional[List[str]] = None,
        tag_match_mode: TagMatchMode = TagMatchMode.ANY,
        vector_weight: float = 0.5,
        fts_weight: float = 0.5,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[Tuple[PydanticPassage, float]]:
        """Query passages from Turbopuffer using vector search, full-text search, or hybrid search.

        Args:
            archive_id: ID of the archive
            query_embedding: Embedding vector for vector search (required for "vector" and "hybrid" modes)
            query_text: Text query for full-text search (required for "fts" and "hybrid" modes)
            search_mode: Search mode - "vector", "fts", or "hybrid" (default: "vector")
            top_k: Number of results to return
            tags: Optional list of tags to filter by
            tag_match_mode: TagMatchMode.ANY (match any tag) or TagMatchMode.ALL (match all tags) - default: TagMatchMode.ANY
            vector_weight: Weight for vector search results in hybrid mode (default: 0.5)
            fts_weight: Weight for FTS results in hybrid mode (default: 0.5)
            start_date: Optional datetime to filter passages created after this date
            end_date: Optional datetime to filter passages created before this date

        Returns:
            List of (passage, score) tuples
        """
        from turbopuffer import AsyncTurbopuffer
        from turbopuffer.types import QueryParam

        # validate inputs based on search mode first
        if search_mode == "vector" and query_embedding is None:
            raise ValueError("query_embedding is required for vector search mode")
        if search_mode == "fts" and query_text is None:
            raise ValueError("query_text is required for FTS search mode")
        if search_mode == "hybrid":
            if query_embedding is None or query_text is None:
                raise ValueError("Both query_embedding and query_text are required for hybrid search mode")
        if search_mode not in ["vector", "fts", "hybrid", "timestamp"]:
            raise ValueError(f"Invalid search_mode: {search_mode}. Must be 'vector', 'fts', 'hybrid', or 'timestamp'")

        # Check if we should fallback to timestamp-based retrieval
        if query_embedding is None and query_text is None and search_mode not in ["timestamp"]:
            # Fallback to retrieving most recent passages when no search query is provided
            search_mode = "timestamp"

        namespace_name = self._get_namespace_name(archive_id)

        try:
            async with AsyncTurbopuffer(api_key=self.api_key, region=self.region) as client:
                namespace = client.namespace(namespace_name)

                # build tag filter conditions
                tag_filter = None
                if tags:
                    if tag_match_mode == TagMatchMode.ALL:
                        # For ALL mode, need to check each tag individually with Contains
                        tag_conditions = []
                        for tag in tags:
                            tag_conditions.append(("tags", "Contains", tag))
                        if len(tag_conditions) == 1:
                            tag_filter = tag_conditions[0]
                        else:
                            tag_filter = ("And", tag_conditions)
                    else:  # tag_match_mode == TagMatchMode.ANY
                        # For ANY mode, use ContainsAny to match any of the tags
                        tag_filter = ("tags", "ContainsAny", tags)

                # build date filter conditions
                date_filters = []
                if start_date:
                    # Turbopuffer expects datetime objects directly for comparison
                    date_filters.append(("created_at", "Gte", start_date))
                if end_date:
                    # Turbopuffer expects datetime objects directly for comparison
                    date_filters.append(("created_at", "Lte", end_date))

                # combine all filters
                all_filters = []
                if tag_filter:
                    all_filters.append(tag_filter)
                if date_filters:
                    all_filters.extend(date_filters)

                # create final filter expression
                final_filter = None
                if len(all_filters) == 1:
                    final_filter = all_filters[0]
                elif len(all_filters) > 1:
                    final_filter = ("And", all_filters)

                if search_mode == "timestamp":
                    # Fallback: retrieve most recent passages by timestamp
                    query_params = {
                        "rank_by": ("created_at", "desc"),  # Order by created_at in descending order
                        "top_k": top_k,
                        "include_attributes": ["text", "organization_id", "archive_id", "created_at", "tags"],
                    }
                    if final_filter:
                        query_params["filters"] = final_filter

                    result = await namespace.query(**query_params)
                    return self._process_single_query_results(result, archive_id, tags)

                elif search_mode == "vector":
                    # single vector search query
                    query_params = {
                        "rank_by": ("vector", "ANN", query_embedding),
                        "top_k": top_k,
                        "include_attributes": ["text", "organization_id", "archive_id", "created_at", "tags"],
                    }
                    if final_filter:
                        query_params["filters"] = final_filter

                    result = await namespace.query(**query_params)
                    return self._process_single_query_results(result, archive_id, tags)

                elif search_mode == "fts":
                    # single full-text search query
                    query_params = {
                        "rank_by": ("text", "BM25", query_text),
                        "top_k": top_k,
                        "include_attributes": ["text", "organization_id", "archive_id", "created_at", "tags"],
                    }
                    if final_filter:
                        query_params["filters"] = final_filter

                    result = await namespace.query(**query_params)
                    return self._process_single_query_results(result, archive_id, tags, is_fts=True)

                else:  # hybrid mode
                    # multi-query for both vector and FTS
                    queries = []

                    # vector search query
                    vector_query = {
                        "rank_by": ("vector", "ANN", query_embedding),
                        "top_k": top_k,
                        "include_attributes": ["text", "organization_id", "archive_id", "created_at", "tags"],
                    }
                    if final_filter:
                        vector_query["filters"] = final_filter
                    queries.append(vector_query)

                    # full-text search query
                    fts_query = {
                        "rank_by": ("text", "BM25", query_text),
                        "top_k": top_k,
                        "include_attributes": ["text", "organization_id", "archive_id", "created_at", "tags"],
                    }
                    if final_filter:
                        fts_query["filters"] = final_filter
                    queries.append(fts_query)

                    # execute multi-query
                    response = await namespace.multi_query(queries=[QueryParam(**q) for q in queries])

                    # process and combine results using reciprocal rank fusion
                    vector_results = self._process_single_query_results(response.results[0], archive_id, tags)
                    fts_results = self._process_single_query_results(response.results[1], archive_id, tags, is_fts=True)

                    # combine results using reciprocal rank fusion
                    return self._reciprocal_rank_fusion(vector_results, fts_results, vector_weight, fts_weight, top_k)

        except Exception as e:
            logger.error(f"Failed to query passages from Turbopuffer: {e}")
            raise

    def _process_single_query_results(
        self, result, archive_id: str, tags: Optional[List[str]], is_fts: bool = False
    ) -> List[Tuple[PydanticPassage, float]]:
        """Process results from a single query into passage objects with scores."""
        passages_with_scores = []

        for row in result.rows:
            # Extract tags from the result row
            passage_tags = getattr(row, "tags", []) or []

            # Build metadata
            metadata = {}

            # Create a passage with minimal fields - embeddings are not returned from Turbopuffer
            passage = PydanticPassage(
                id=row.id,
                text=getattr(row, "text", ""),
                organization_id=getattr(row, "organization_id", None),
                archive_id=archive_id,  # use the archive_id from the query
                created_at=getattr(row, "created_at", None),
                metadata_=metadata,
                tags=passage_tags,  # Set the actual tags from the passage
                # Set required fields to empty/default values since we don't store embeddings
                embedding=[],  # Empty embedding since we don't return it from Turbopuffer
                embedding_config=None,  # No embedding config needed for retrieved passages
            )

            # handle score based on search type
            if is_fts:
                # for FTS, use the BM25 score directly (higher is better)
                score = getattr(row, "$score", 0.0)
            else:
                # for vector search, convert distance to similarity score
                distance = getattr(row, "$dist", 0.0)
                score = 1.0 - distance

            passages_with_scores.append((passage, score))

        return passages_with_scores

    def _reciprocal_rank_fusion(
        self,
        vector_results: List[Tuple[PydanticPassage, float]],
        fts_results: List[Tuple[PydanticPassage, float]],
        vector_weight: float,
        fts_weight: float,
        top_k: int,
    ) -> List[Tuple[PydanticPassage, float]]:
        """Combine vector and FTS results using Reciprocal Rank Fusion (RRF).

        RRF score = vector_weight * (1/(k + vector_rank)) + fts_weight * (1/(k + fts_rank))
        where k is a constant (typically 60) to avoid division by zero
        """
        k = 60  # standard RRF constant

        # create rank mappings
        vector_ranks = {passage.id: rank + 1 for rank, (passage, _) in enumerate(vector_results)}
        fts_ranks = {passage.id: rank + 1 for rank, (passage, _) in enumerate(fts_results)}

        # combine all unique passage IDs
        all_passages = {}
        for passage, _ in vector_results:
            all_passages[passage.id] = passage
        for passage, _ in fts_results:
            all_passages[passage.id] = passage

        # calculate RRF scores
        rrf_scores = {}
        for passage_id in all_passages:
            vector_score = vector_weight / (k + vector_ranks.get(passage_id, k + top_k))
            fts_score = fts_weight / (k + fts_ranks.get(passage_id, k + top_k))
            rrf_scores[passage_id] = vector_score + fts_score

        # sort by RRF score and return top_k
        sorted_results = sorted([(all_passages[pid], score) for pid, score in rrf_scores.items()], key=lambda x: x[1], reverse=True)

        return sorted_results[:top_k]

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
