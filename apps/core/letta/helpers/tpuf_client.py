"""Turbopuffer utilities for archival memory storage."""

import logging
from datetime import datetime, timezone
from typing import Any, Callable, List, Optional, Tuple

from letta.otel.tracing import trace_method
from letta.schemas.enums import MessageRole, TagMatchMode
from letta.schemas.passage import Passage as PydanticPassage
from letta.settings import settings

logger = logging.getLogger(__name__)


def should_use_tpuf() -> bool:
    return bool(settings.use_tpuf) and bool(settings.tpuf_api_key)


def should_use_tpuf_for_messages() -> bool:
    """Check if Turbopuffer should be used for messages."""
    return should_use_tpuf() and bool(settings.embed_all_messages)


class TurbopufferClient:
    """Client for managing archival memory with Turbopuffer vector database."""

    def __init__(self, api_key: str = None, region: str = None):
        """Initialize Turbopuffer client."""
        self.api_key = api_key or settings.tpuf_api_key
        self.region = region or settings.tpuf_region

        from letta.services.agent_manager import AgentManager
        from letta.services.archive_manager import ArchiveManager

        self.archive_manager = ArchiveManager()
        self.agent_manager = AgentManager()

        if not self.api_key:
            raise ValueError("Turbopuffer API key not provided")

    @trace_method
    async def _get_archive_namespace_name(self, archive_id: str) -> str:
        """Get namespace name for a specific archive."""
        return await self.archive_manager.get_or_set_vector_db_namespace_async(archive_id)

    @trace_method
    async def _get_message_namespace_name(self, agent_id: str, organization_id: str) -> str:
        """Get namespace name for messages (org-scoped).

        Args:
            agent_id: Agent ID (stored for future sharding)
            organization_id: Organization ID for namespace generation

        Returns:
            The org-scoped namespace name for messages
        """
        return await self.agent_manager.get_or_set_vector_db_namespace_async(agent_id, organization_id)

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

        namespace_name = await self._get_archive_namespace_name(archive_id)

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
    async def insert_messages(
        self,
        agent_id: str,
        message_texts: List[str],
        embeddings: List[List[float]],
        message_ids: List[str],
        organization_id: str,
        roles: List[MessageRole],
        created_ats: List[datetime],
    ) -> bool:
        """Insert messages into Turbopuffer.

        Args:
            agent_id: ID of the agent
            message_texts: List of message text content to store
            embeddings: List of embedding vectors corresponding to message texts
            message_ids: List of message IDs (must match 1:1 with message_texts)
            organization_id: Organization ID for the messages
            roles: List of message roles corresponding to each message
            created_ats: List of creation timestamps for each message

        Returns:
            True if successful
        """
        from turbopuffer import AsyncTurbopuffer

        namespace_name = await self._get_message_namespace_name(agent_id, organization_id)

        # validation checks
        if not message_ids:
            raise ValueError("message_ids must be provided for Turbopuffer insertion")
        if len(message_ids) != len(message_texts):
            raise ValueError(f"message_ids length ({len(message_ids)}) must match message_texts length ({len(message_texts)})")
        if len(message_ids) != len(embeddings):
            raise ValueError(f"message_ids length ({len(message_ids)}) must match embeddings length ({len(embeddings)})")
        if len(message_ids) != len(roles):
            raise ValueError(f"message_ids length ({len(message_ids)}) must match roles length ({len(roles)})")
        if len(message_ids) != len(created_ats):
            raise ValueError(f"message_ids length ({len(message_ids)}) must match created_ats length ({len(created_ats)})")

        # prepare column-based data for turbopuffer - optimized for batch insert
        ids = []
        vectors = []
        texts = []
        organization_ids = []
        agent_ids = []
        message_roles = []
        created_at_timestamps = []

        for idx, (text, embedding, role, created_at) in enumerate(zip(message_texts, embeddings, roles, created_ats)):
            message_id = message_ids[idx]

            # ensure the provided timestamp is timezone-aware and in UTC
            if created_at.tzinfo is None:
                # assume UTC if no timezone provided
                timestamp = created_at.replace(tzinfo=timezone.utc)
            else:
                # convert to UTC if in different timezone
                timestamp = created_at.astimezone(timezone.utc)

            # append to columns
            ids.append(message_id)
            vectors.append(embedding)
            texts.append(text)
            organization_ids.append(organization_id)
            agent_ids.append(agent_id)
            message_roles.append(role.value)
            created_at_timestamps.append(timestamp)

        # build column-based upsert data
        upsert_columns = {
            "id": ids,
            "vector": vectors,
            "text": texts,
            "organization_id": organization_ids,
            "agent_id": agent_ids,
            "role": message_roles,
            "created_at": created_at_timestamps,
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
                logger.info(f"Successfully inserted {len(ids)} messages to Turbopuffer for agent {agent_id}")
                return True

        except Exception as e:
            logger.error(f"Failed to insert messages to Turbopuffer: {e}")
            # check if it's a duplicate ID error
            if "duplicate" in str(e).lower():
                logger.error("Duplicate message IDs detected in batch")
            raise

    @trace_method
    async def _execute_query(
        self,
        namespace_name: str,
        search_mode: str,
        query_embedding: Optional[List[float]],
        query_text: Optional[str],
        top_k: int,
        include_attributes: List[str],
        filters: Optional[Any] = None,
        vector_weight: float = 0.5,
        fts_weight: float = 0.5,
    ) -> Any:
        """Generic query execution for Turbopuffer.

        Args:
            namespace_name: Turbopuffer namespace to query
            search_mode: "vector", "fts", "hybrid", or "timestamp"
            query_embedding: Embedding for vector search
            query_text: Text for full-text search
            top_k: Number of results to return
            include_attributes: Attributes to include in results
            filters: Turbopuffer filter expression
            vector_weight: Weight for vector search in hybrid mode
            fts_weight: Weight for FTS in hybrid mode

        Returns:
            Raw Turbopuffer query results or multi-query response
        """
        from turbopuffer import AsyncTurbopuffer
        from turbopuffer.types import QueryParam

        # validate inputs based on search mode
        if search_mode == "vector" and query_embedding is None:
            raise ValueError("query_embedding is required for vector search mode")
        if search_mode == "fts" and query_text is None:
            raise ValueError("query_text is required for FTS search mode")
        if search_mode == "hybrid":
            if query_embedding is None or query_text is None:
                raise ValueError("Both query_embedding and query_text are required for hybrid search mode")
        if search_mode not in ["vector", "fts", "hybrid", "timestamp"]:
            raise ValueError(f"Invalid search_mode: {search_mode}. Must be 'vector', 'fts', 'hybrid', or 'timestamp'")

        async with AsyncTurbopuffer(api_key=self.api_key, region=self.region) as client:
            namespace = client.namespace(namespace_name)

            if search_mode == "timestamp":
                # retrieve most recent items by timestamp
                query_params = {
                    "rank_by": ("created_at", "desc"),
                    "top_k": top_k,
                    "include_attributes": include_attributes,
                }
                if filters:
                    query_params["filters"] = filters
                return await namespace.query(**query_params)

            elif search_mode == "vector":
                # vector search query
                query_params = {
                    "rank_by": ("vector", "ANN", query_embedding),
                    "top_k": top_k,
                    "include_attributes": include_attributes,
                }
                if filters:
                    query_params["filters"] = filters
                return await namespace.query(**query_params)

            elif search_mode == "fts":
                # full-text search query
                query_params = {
                    "rank_by": ("text", "BM25", query_text),
                    "top_k": top_k,
                    "include_attributes": include_attributes,
                }
                if filters:
                    query_params["filters"] = filters
                return await namespace.query(**query_params)

            else:  # hybrid mode
                queries = []

                # vector search query
                vector_query = {
                    "rank_by": ("vector", "ANN", query_embedding),
                    "top_k": top_k,
                    "include_attributes": include_attributes,
                }
                if filters:
                    vector_query["filters"] = filters
                queries.append(vector_query)

                # full-text search query
                fts_query = {
                    "rank_by": ("text", "BM25", query_text),
                    "top_k": top_k,
                    "include_attributes": include_attributes,
                }
                if filters:
                    fts_query["filters"] = filters
                queries.append(fts_query)

                # execute multi-query
                return await namespace.multi_query(queries=[QueryParam(**q) for q in queries])

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
    ) -> List[Tuple[PydanticPassage, float, dict]]:
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
            List of (passage, score, metadata) tuples with relevance rankings
        """
        # Check if we should fallback to timestamp-based retrieval
        if query_embedding is None and query_text is None and search_mode not in ["timestamp"]:
            # Fallback to retrieving most recent passages when no search query is provided
            search_mode = "timestamp"

        namespace_name = await self._get_archive_namespace_name(archive_id)

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
            date_filters.append(("created_at", "Gte", start_date))
        if end_date:
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

        try:
            # use generic query executor
            result = await self._execute_query(
                namespace_name=namespace_name,
                search_mode=search_mode,
                query_embedding=query_embedding,
                query_text=query_text,
                top_k=top_k,
                include_attributes=["text", "organization_id", "archive_id", "created_at", "tags"],
                filters=final_filter,
                vector_weight=vector_weight,
                fts_weight=fts_weight,
            )

            # process results based on search mode
            if search_mode == "hybrid":
                # for hybrid mode, we get a multi-query response
                vector_results = self._process_single_query_results(result.results[0], archive_id, tags)
                fts_results = self._process_single_query_results(result.results[1], archive_id, tags, is_fts=True)
                # use RRF and include metadata with ranks
                results_with_metadata = self._reciprocal_rank_fusion(
                    vector_results=[passage for passage, _ in vector_results],
                    fts_results=[passage for passage, _ in fts_results],
                    get_id_func=lambda p: p.id,
                    vector_weight=vector_weight,
                    fts_weight=fts_weight,
                    top_k=top_k,
                )
                # Return (passage, score, metadata) with ranks
                return results_with_metadata
            else:
                # for single queries (vector, fts, timestamp) - add basic metadata
                is_fts = search_mode == "fts"
                results = self._process_single_query_results(result, archive_id, tags, is_fts=is_fts)
                # Add simple metadata for single search modes
                results_with_metadata = []
                for idx, (passage, score) in enumerate(results):
                    metadata = {
                        "combined_score": score,
                        f"{search_mode}_rank": idx + 1,  # Add the rank for this search mode
                    }
                    results_with_metadata.append((passage, score, metadata))
                return results_with_metadata

        except Exception as e:
            logger.error(f"Failed to query passages from Turbopuffer: {e}")
            raise

    @trace_method
    async def query_messages(
        self,
        agent_id: str,
        organization_id: str,
        query_embedding: Optional[List[float]] = None,
        query_text: Optional[str] = None,
        search_mode: str = "vector",  # "vector", "fts", "hybrid", "timestamp"
        top_k: int = 10,
        roles: Optional[List[MessageRole]] = None,
        vector_weight: float = 0.5,
        fts_weight: float = 0.5,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[Tuple[dict, float, dict]]:
        """Query messages from Turbopuffer using vector search, full-text search, or hybrid search.

        Args:
            agent_id: ID of the agent (used for filtering results)
            organization_id: Organization ID for namespace lookup
            query_embedding: Embedding vector for vector search (required for "vector" and "hybrid" modes)
            query_text: Text query for full-text search (required for "fts" and "hybrid" modes)
            search_mode: Search mode - "vector", "fts", "hybrid", or "timestamp" (default: "vector")
            top_k: Number of results to return
            roles: Optional list of message roles to filter by
            vector_weight: Weight for vector search results in hybrid mode (default: 0.5)
            fts_weight: Weight for FTS results in hybrid mode (default: 0.5)
            start_date: Optional datetime to filter messages created after this date
            end_date: Optional datetime to filter messages created before this date

        Returns:
            List of (message_dict, score, metadata) tuples where:
            - message_dict contains id, text, role, created_at
            - score is the final relevance score
            - metadata contains individual scores and ranking information
        """
        # Check if we should fallback to timestamp-based retrieval
        if query_embedding is None and query_text is None and search_mode not in ["timestamp"]:
            # Fallback to retrieving most recent messages when no search query is provided
            search_mode = "timestamp"

        namespace_name = await self._get_message_namespace_name(agent_id, organization_id)

        # build agent_id filter
        agent_filter = ("agent_id", "Eq", agent_id)

        # build role filter conditions
        role_filter = None
        if roles:
            role_values = [r.value for r in roles]
            if len(role_values) == 1:
                role_filter = ("role", "Eq", role_values[0])
            else:
                role_filter = ("role", "In", role_values)

        # build date filter conditions
        date_filters = []
        if start_date:
            date_filters.append(("created_at", "Gte", start_date))
        if end_date:
            date_filters.append(("created_at", "Lte", end_date))

        # combine all filters
        all_filters = [agent_filter]  # always include agent_id filter
        if role_filter:
            all_filters.append(role_filter)
        if date_filters:
            all_filters.extend(date_filters)

        # create final filter expression
        final_filter = None
        if len(all_filters) == 1:
            final_filter = all_filters[0]
        elif len(all_filters) > 1:
            final_filter = ("And", all_filters)

        try:
            # use generic query executor
            result = await self._execute_query(
                namespace_name=namespace_name,
                search_mode=search_mode,
                query_embedding=query_embedding,
                query_text=query_text,
                top_k=top_k,
                include_attributes=["text", "organization_id", "agent_id", "role", "created_at"],
                filters=final_filter,
                vector_weight=vector_weight,
                fts_weight=fts_weight,
            )

            # process results based on search mode
            if search_mode == "hybrid":
                # for hybrid mode, we get a multi-query response
                vector_results = self._process_message_query_results(result.results[0])
                fts_results = self._process_message_query_results(result.results[1])
                # use RRF with lambda to extract ID from dict - returns metadata
                results_with_metadata = self._reciprocal_rank_fusion(
                    vector_results=vector_results,
                    fts_results=fts_results,
                    get_id_func=lambda msg_dict: msg_dict["id"],
                    vector_weight=vector_weight,
                    fts_weight=fts_weight,
                    top_k=top_k,
                )
                # return results with metadata
                return results_with_metadata
            else:
                # for single queries (vector, fts, timestamp)
                results = self._process_message_query_results(result)
                # add simple metadata for single search modes
                results_with_metadata = []
                for idx, msg_dict in enumerate(results):
                    metadata = {
                        "combined_score": 1.0 / (idx + 1),  # Use rank-based score for single mode
                        "search_mode": search_mode,
                        f"{search_mode}_rank": idx + 1,  # Add the rank for this search mode
                    }
                    results_with_metadata.append((msg_dict, metadata["combined_score"], metadata))
                return results_with_metadata

        except Exception as e:
            logger.error(f"Failed to query messages from Turbopuffer: {e}")
            raise

    def _process_message_query_results(self, result) -> List[dict]:
        """Process results from a message query into message dicts.

        For RRF, we only need the rank order - scores are not used.
        """
        messages = []

        for row in result.rows:
            # Build message dict with key fields
            message_dict = {
                "id": row.id,
                "text": getattr(row, "text", ""),
                "organization_id": getattr(row, "organization_id", None),
                "agent_id": getattr(row, "agent_id", None),
                "role": getattr(row, "role", None),
                "created_at": getattr(row, "created_at", None),
            }
            messages.append(message_dict)

        return messages

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
        vector_results: List[Any],
        fts_results: List[Any],
        get_id_func: Callable[[Any], str],
        vector_weight: float,
        fts_weight: float,
        top_k: int,
    ) -> List[Tuple[Any, float, dict]]:
        """RRF implementation that works with any object type.

        RRF score = vector_weight * (1/(k + rank)) + fts_weight * (1/(k + rank))
        where k is a constant (typically 60) to avoid division by zero

        This is a pure rank-based fusion following the standard RRF algorithm.

        Args:
            vector_results: List of items from vector search (ordered by relevance)
            fts_results: List of items from FTS (ordered by relevance)
            get_id_func: Function to extract ID from an item
            vector_weight: Weight for vector search results
            fts_weight: Weight for FTS results
            top_k: Number of results to return

        Returns:
            List of (item, score, metadata) tuples sorted by RRF score
            metadata contains ranks from each result list
        """
        k = 60  # standard RRF constant from Cormack et al. (2009)

        # create rank mappings based on position in result lists
        # rank starts at 1, not 0
        vector_ranks = {get_id_func(item): rank + 1 for rank, item in enumerate(vector_results)}
        fts_ranks = {get_id_func(item): rank + 1 for rank, item in enumerate(fts_results)}

        # combine all unique items from both result sets
        all_items = {}
        for item in vector_results:
            all_items[get_id_func(item)] = item
        for item in fts_results:
            all_items[get_id_func(item)] = item

        # calculate RRF scores based purely on ranks
        rrf_scores = {}
        score_metadata = {}
        for item_id in all_items:
            # RRF formula: sum of 1/(k + rank) across result lists
            # If item not in a list, we don't add anything (equivalent to rank = infinity)
            vector_rrf_score = 0.0
            fts_rrf_score = 0.0

            if item_id in vector_ranks:
                vector_rrf_score = vector_weight / (k + vector_ranks[item_id])
            if item_id in fts_ranks:
                fts_rrf_score = fts_weight / (k + fts_ranks[item_id])

            combined_score = vector_rrf_score + fts_rrf_score

            rrf_scores[item_id] = combined_score
            score_metadata[item_id] = {
                "combined_score": combined_score,  # Final RRF score
                "vector_rank": vector_ranks.get(item_id),
                "fts_rank": fts_ranks.get(item_id),
            }

        # sort by RRF score and return with metadata
        sorted_results = sorted(
            [(all_items[iid], score, score_metadata[iid]) for iid, score in rrf_scores.items()], key=lambda x: x[1], reverse=True
        )

        return sorted_results[:top_k]

    @trace_method
    async def delete_passage(self, archive_id: str, passage_id: str) -> bool:
        """Delete a passage from Turbopuffer."""
        from turbopuffer import AsyncTurbopuffer

        namespace_name = await self._get_archive_namespace_name(archive_id)

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

        namespace_name = await self._get_archive_namespace_name(archive_id)

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

        namespace_name = await self._get_archive_namespace_name(archive_id)

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

    @trace_method
    async def delete_messages(self, agent_id: str, organization_id: str, message_ids: List[str]) -> bool:
        """Delete multiple messages from Turbopuffer."""
        from turbopuffer import AsyncTurbopuffer

        if not message_ids:
            return True

        namespace_name = await self._get_message_namespace_name(agent_id, organization_id)

        try:
            async with AsyncTurbopuffer(api_key=self.api_key, region=self.region) as client:
                namespace = client.namespace(namespace_name)
                # Use write API with deletes parameter as per Turbopuffer docs
                await namespace.write(deletes=message_ids)
                logger.info(f"Successfully deleted {len(message_ids)} messages from Turbopuffer for agent {agent_id}")
                return True
        except Exception as e:
            logger.error(f"Failed to delete messages from Turbopuffer: {e}")
            raise

    @trace_method
    async def delete_all_messages(self, agent_id: str, organization_id: str) -> bool:
        """Delete all messages for an agent from Turbopuffer."""
        from turbopuffer import AsyncTurbopuffer

        namespace_name = await self._get_message_namespace_name(agent_id, organization_id)

        try:
            async with AsyncTurbopuffer(api_key=self.api_key, region=self.region) as client:
                namespace = client.namespace(namespace_name)
                # Use delete_by_filter to only delete messages for this agent
                # since namespace is now org-scoped
                result = await namespace.write(delete_by_filter=("agent_id", "Eq", agent_id))
                logger.info(f"Successfully deleted all messages for agent {agent_id} (deleted {result.rows_affected} rows)")
                return True
        except Exception as e:
            logger.error(f"Failed to delete all messages from Turbopuffer: {e}")
            raise
