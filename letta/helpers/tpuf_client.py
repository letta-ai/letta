"""Turbopuffer utilities for archival memory storage."""

import logging
from datetime import datetime, timezone
from typing import Any, Callable, List, Optional, Tuple

from letta.constants import DEFAULT_EMBEDDING_CHUNK_SIZE
from letta.otel.tracing import trace_method
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import MessageRole, TagMatchMode
from letta.schemas.passage import Passage as PydanticPassage
from letta.settings import model_settings, settings

logger = logging.getLogger(__name__)


def should_use_tpuf() -> bool:
    # We need OpenAI since we default to their embedding model
    return bool(settings.use_tpuf) and bool(settings.tpuf_api_key) and bool(model_settings.openai_api_key)


def should_use_tpuf_for_messages() -> bool:
    """Check if Turbopuffer should be used for messages."""
    return should_use_tpuf() and bool(settings.embed_all_messages)


class TurbopufferClient:
    """Client for managing archival memory with Turbopuffer vector database."""

    default_embedding_config = EmbeddingConfig(
        embedding_model="text-embedding-3-small",
        embedding_endpoint_type="openai",
        embedding_endpoint="https://api.openai.com/v1",
        embedding_dim=1536,
        embedding_chunk_size=DEFAULT_EMBEDDING_CHUNK_SIZE,
    )

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
    async def _generate_embeddings(self, texts: List[str], actor: "PydanticUser") -> List[List[float]]:
        """Generate embeddings using the default embedding configuration.

        Args:
            texts: List of texts to embed
            actor: User actor for embedding generation

        Returns:
            List of embedding vectors
        """
        from letta.llm_api.llm_client import LLMClient

        # filter out empty strings after stripping
        filtered_texts = [text for text in texts if text.strip()]

        # skip embedding if no valid texts
        if not filtered_texts:
            return []

        embedding_client = LLMClient.create(
            provider_type=self.default_embedding_config.embedding_endpoint_type,
            actor=actor,
        )
        embeddings = await embedding_client.request_embeddings(filtered_texts, self.default_embedding_config)
        return embeddings

    @trace_method
    async def _get_archive_namespace_name(self, archive_id: str) -> str:
        """Get namespace name for a specific archive."""
        return await self.archive_manager.get_or_set_vector_db_namespace_async(archive_id)

    @trace_method
    async def _get_message_namespace_name(self, organization_id: str) -> str:
        """Get namespace name for messages (org-scoped).

        Args:
            organization_id: Organization ID for namespace generation

        Returns:
            The org-scoped namespace name for messages
        """
        environment = settings.environment
        if environment:
            namespace_name = f"messages_{organization_id}_{environment.lower()}"
        else:
            namespace_name = f"messages_{organization_id}"

        return namespace_name

    @trace_method
    async def insert_archival_memories(
        self,
        archive_id: str,
        text_chunks: List[str],
        passage_ids: List[str],
        organization_id: str,
        actor: "PydanticUser",
        tags: Optional[List[str]] = None,
        created_at: Optional[datetime] = None,
    ) -> List[PydanticPassage]:
        """Insert passages into Turbopuffer.

        Args:
            archive_id: ID of the archive
            text_chunks: List of text chunks to store
            passage_ids: List of passage IDs (must match 1:1 with text_chunks)
            organization_id: Organization ID for the passages
            actor: User actor for embedding generation
            tags: Optional list of tags to attach to all passages
            created_at: Optional timestamp for retroactive entries (defaults to current UTC time)

        Returns:
            List of PydanticPassage objects that were inserted
        """
        from turbopuffer import AsyncTurbopuffer

        # filter out empty text chunks
        filtered_chunks = [(i, text) for i, text in enumerate(text_chunks) if text.strip()]

        if not filtered_chunks:
            logger.warning("All text chunks were empty, skipping insertion")
            return []

        # generate embeddings using the default config
        filtered_texts = [text for _, text in filtered_chunks]
        embeddings = await self._generate_embeddings(filtered_texts, actor)

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

        # prepare column-based data for turbopuffer - optimized for batch insert
        ids = []
        vectors = []
        texts = []
        organization_ids = []
        archive_ids = []
        created_ats = []
        tags_arrays = []  # Store tags as arrays
        passages = []

        for (original_idx, text), embedding in zip(filtered_chunks, embeddings):
            passage_id = passage_ids[original_idx]

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
                embedding_config=self.default_embedding_config,  # Will be set by caller if needed
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
        message_ids: List[str],
        organization_id: str,
        actor: "PydanticUser",
        roles: List[MessageRole],
        created_ats: List[datetime],
        project_id: Optional[str] = None,
        template_id: Optional[str] = None,
    ) -> bool:
        """Insert messages into Turbopuffer.

        Args:
            agent_id: ID of the agent
            message_texts: List of message text content to store
            message_ids: List of message IDs (must match 1:1 with message_texts)
            organization_id: Organization ID for the messages
            actor: User actor for embedding generation
            roles: List of message roles corresponding to each message
            created_ats: List of creation timestamps for each message
            project_id: Optional project ID for all messages
            template_id: Optional template ID for all messages

        Returns:
            True if successful
        """
        from turbopuffer import AsyncTurbopuffer

        # filter out empty message texts
        filtered_messages = [(i, text) for i, text in enumerate(message_texts) if text.strip()]

        if not filtered_messages:
            logger.warning("All message texts were empty, skipping insertion")
            return True

        # generate embeddings using the default config
        filtered_texts = [text for _, text in filtered_messages]
        embeddings = await self._generate_embeddings(filtered_texts, actor)

        namespace_name = await self._get_message_namespace_name(organization_id)

        # validation checks
        if not message_ids:
            raise ValueError("message_ids must be provided for Turbopuffer insertion")
        if len(message_ids) != len(message_texts):
            raise ValueError(f"message_ids length ({len(message_ids)}) must match message_texts length ({len(message_texts)})")
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
        project_ids = []
        template_ids = []

        for (original_idx, text), embedding in zip(filtered_messages, embeddings):
            message_id = message_ids[original_idx]
            role = roles[original_idx]
            created_at = created_ats[original_idx]

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
            project_ids.append(project_id)
            template_ids.append(template_id)

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

        # only include project_id if it's provided
        if project_id is not None:
            upsert_columns["project_id"] = project_ids

        # only include template_id if it's provided
        if template_id is not None:
            upsert_columns["template_id"] = template_ids

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
        actor: "PydanticUser",
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
            actor: User actor for embedding generation
            query_text: Text query for search (used for embedding in vector/hybrid modes, and FTS in fts/hybrid modes)
            search_mode: Search mode - "vector", "fts", or "hybrid" (default: "vector")
            top_k: Number of results to return
            tags: Optional list of tags to filter by
            tag_match_mode: TagMatchMode.ANY (match any tag) or TagMatchMode.ALL (match all tags) - default: TagMatchMode.ANY
            vector_weight: Weight for vector search results in hybrid mode (default: 0.5)
            fts_weight: Weight for FTS results in hybrid mode (default: 0.5)
            start_date: Optional datetime to filter passages created after this date
            end_date: Optional datetime to filter passages created on or before this date (inclusive)

        Returns:
            List of (passage, score, metadata) tuples with relevance rankings
        """
        # generate embedding for vector/hybrid search if query_text is provided
        query_embedding = None
        if query_text and search_mode in ["vector", "hybrid"]:
            embeddings = await self._generate_embeddings([query_text], actor)
            query_embedding = embeddings[0]

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
            # if end_date has no time component (is at midnight), adjust to end of day
            # to make the filter inclusive of the entire day
            if end_date.hour == 0 and end_date.minute == 0 and end_date.second == 0 and end_date.microsecond == 0:
                from datetime import timedelta

                # add 1 day and subtract 1 microsecond to get 23:59:59.999999
                end_date = end_date + timedelta(days=1) - timedelta(microseconds=1)
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
    async def query_messages_by_agent_id(
        self,
        agent_id: str,
        organization_id: str,
        actor: "PydanticUser",
        query_text: Optional[str] = None,
        search_mode: str = "vector",  # "vector", "fts", "hybrid", "timestamp"
        top_k: int = 10,
        roles: Optional[List[MessageRole]] = None,
        project_id: Optional[str] = None,
        template_id: Optional[str] = None,
        vector_weight: float = 0.5,
        fts_weight: float = 0.5,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[Tuple[dict, float, dict]]:
        """Query messages from Turbopuffer using vector search, full-text search, or hybrid search.

        Args:
            agent_id: ID of the agent (used for filtering results)
            organization_id: Organization ID for namespace lookup
            actor: User actor for embedding generation
            query_text: Text query for search (used for embedding in vector/hybrid modes, and FTS in fts/hybrid modes)
            search_mode: Search mode - "vector", "fts", "hybrid", or "timestamp" (default: "vector")
            top_k: Number of results to return
            roles: Optional list of message roles to filter by
            project_id: Optional project ID to filter messages by
            template_id: Optional template ID to filter messages by
            vector_weight: Weight for vector search results in hybrid mode (default: 0.5)
            fts_weight: Weight for FTS results in hybrid mode (default: 0.5)
            start_date: Optional datetime to filter messages created after this date
            end_date: Optional datetime to filter messages created on or before this date (inclusive)

        Returns:
            List of (message_dict, score, metadata) tuples where:
            - message_dict contains id, text, role, created_at
            - score is the final relevance score
            - metadata contains individual scores and ranking information
        """
        # generate embedding for vector/hybrid search if query_text is provided
        query_embedding = None
        if query_text and search_mode in ["vector", "hybrid"]:
            embeddings = await self._generate_embeddings([query_text], actor)
            query_embedding = embeddings[0]

        # Check if we should fallback to timestamp-based retrieval
        if query_embedding is None and query_text is None and search_mode not in ["timestamp"]:
            # Fallback to retrieving most recent messages when no search query is provided
            search_mode = "timestamp"

        namespace_name = await self._get_message_namespace_name(organization_id)

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
            # if end_date has no time component (is at midnight), adjust to end of day
            # to make the filter inclusive of the entire day
            if end_date.hour == 0 and end_date.minute == 0 and end_date.second == 0 and end_date.microsecond == 0:
                from datetime import timedelta

                # add 1 day and subtract 1 microsecond to get 23:59:59.999999
                end_date = end_date + timedelta(days=1) - timedelta(microseconds=1)
            date_filters.append(("created_at", "Lte", end_date))

        # build project_id filter if provided
        project_filter = None
        if project_id:
            project_filter = ("project_id", "Eq", project_id)

        # build template_id filter if provided
        template_filter = None
        if template_id:
            template_filter = ("template_id", "Eq", template_id)

        # combine all filters
        all_filters = [agent_filter]  # always include agent_id filter
        if role_filter:
            all_filters.append(role_filter)
        if project_filter:
            all_filters.append(project_filter)
        if template_filter:
            all_filters.append(template_filter)
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

    async def query_messages_by_org_id(
        self,
        organization_id: str,
        actor: "PydanticUser",
        query_text: Optional[str] = None,
        search_mode: str = "hybrid",  # "vector", "fts", "hybrid"
        top_k: int = 10,
        roles: Optional[List[MessageRole]] = None,
        project_id: Optional[str] = None,
        template_id: Optional[str] = None,
        vector_weight: float = 0.5,
        fts_weight: float = 0.5,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[Tuple[dict, float, dict]]:
        """Query messages from Turbopuffer across an entire organization.

        Args:
            organization_id: Organization ID for namespace lookup (required)
            actor: User actor for embedding generation
            query_text: Text query for search (used for embedding in vector/hybrid modes, and FTS in fts/hybrid modes)
            search_mode: Search mode - "vector", "fts", or "hybrid" (default: "hybrid")
            top_k: Number of results to return
            roles: Optional list of message roles to filter by
            project_id: Optional project ID to filter messages by
            template_id: Optional template ID to filter messages by
            vector_weight: Weight for vector search results in hybrid mode (default: 0.5)
            fts_weight: Weight for FTS results in hybrid mode (default: 0.5)
            start_date: Optional datetime to filter messages created after this date
            end_date: Optional datetime to filter messages created on or before this date (inclusive)

        Returns:
            List of (message_dict, score, metadata) tuples where:
            - message_dict contains id, text, role, created_at, agent_id
            - score is the final relevance score (RRF score for hybrid, rank-based for single mode)
            - metadata contains individual scores and ranking information
        """
        # generate embedding for vector/hybrid search if query_text is provided
        query_embedding = None
        if query_text and search_mode in ["vector", "hybrid"]:
            embeddings = await self._generate_embeddings([query_text], actor)
            query_embedding = embeddings[0]
        # namespace is org-scoped
        namespace_name = await self._get_message_namespace_name(organization_id)

        # build filters
        all_filters = []

        # role filter
        if roles:
            role_values = [r.value for r in roles]
            if len(role_values) == 1:
                all_filters.append(("role", "Eq", role_values[0]))
            else:
                all_filters.append(("role", "In", role_values))

        # project filter
        if project_id:
            all_filters.append(("project_id", "Eq", project_id))

        # template filter
        if template_id:
            all_filters.append(("template_id", "Eq", template_id))

        # date filters
        if start_date:
            all_filters.append(("created_at", "Gte", start_date))
        if end_date:
            # make end_date inclusive of the entire day
            if end_date.hour == 0 and end_date.minute == 0 and end_date.second == 0 and end_date.microsecond == 0:
                from datetime import timedelta

                end_date = end_date + timedelta(days=1) - timedelta(microseconds=1)
            all_filters.append(("created_at", "Lte", end_date))

        # combine filters
        final_filter = None
        if len(all_filters) == 1:
            final_filter = all_filters[0]
        elif len(all_filters) > 1:
            final_filter = ("And", all_filters)

        try:
            # execute query
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

                # use existing RRF method - it already returns metadata with ranks
                results_with_metadata = self._reciprocal_rank_fusion(
                    vector_results=vector_results,
                    fts_results=fts_results,
                    get_id_func=lambda msg_dict: msg_dict["id"],
                    vector_weight=vector_weight,
                    fts_weight=fts_weight,
                    top_k=top_k,
                )

                # add raw scores to metadata if available
                vector_scores = {}
                for row in result.results[0].rows:
                    if hasattr(row, "dist"):
                        vector_scores[row.id] = row.dist

                fts_scores = {}
                for row in result.results[1].rows:
                    if hasattr(row, "score"):
                        fts_scores[row.id] = row.score

                # enhance metadata with raw scores
                enhanced_results = []
                for msg_dict, rrf_score, metadata in results_with_metadata:
                    msg_id = msg_dict["id"]
                    if msg_id in vector_scores:
                        metadata["vector_score"] = vector_scores[msg_id]
                    if msg_id in fts_scores:
                        metadata["fts_score"] = fts_scores[msg_id]
                    enhanced_results.append((msg_dict, rrf_score, metadata))

                return enhanced_results
            else:
                # for single queries (vector or fts)
                results = self._process_message_query_results(result)
                results_with_metadata = []
                for idx, msg_dict in enumerate(results):
                    metadata = {
                        "combined_score": 1.0 / (idx + 1),
                        "search_mode": search_mode,
                        f"{search_mode}_rank": idx + 1,
                    }

                    # add raw score if available
                    if hasattr(result.rows[idx], "dist"):
                        metadata["vector_score"] = result.rows[idx].dist
                    elif hasattr(result.rows[idx], "score"):
                        metadata["fts_score"] = result.rows[idx].score

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
                embedding_config=self.default_embedding_config,  # No embedding config needed for retrieved passages
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

        namespace_name = await self._get_message_namespace_name(organization_id)

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

        namespace_name = await self._get_message_namespace_name(organization_id)

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

    # file/source passage methods

    @trace_method
    async def _get_file_passages_namespace_name(self, organization_id: str) -> str:
        """Get namespace name for file passages (org-scoped).

        Args:
            organization_id: Organization ID for namespace generation

        Returns:
            The org-scoped namespace name for file passages
        """
        environment = settings.environment
        if environment:
            namespace_name = f"file_passages_{organization_id}_{environment.lower()}"
        else:
            namespace_name = f"file_passages_{organization_id}"

        return namespace_name

    @trace_method
    async def insert_file_passages(
        self,
        source_id: str,
        file_id: str,
        text_chunks: List[str],
        organization_id: str,
        actor: "PydanticUser",
        created_at: Optional[datetime] = None,
    ) -> List[PydanticPassage]:
        """Insert file passages into Turbopuffer using org-scoped namespace.

        Args:
            source_id: ID of the source containing the file
            file_id: ID of the file
            text_chunks: List of text chunks to store
            organization_id: Organization ID for the passages
            actor: User actor for embedding generation
            created_at: Optional timestamp for retroactive entries (defaults to current UTC time)

        Returns:
            List of PydanticPassage objects that were inserted
        """
        from turbopuffer import AsyncTurbopuffer

        if not text_chunks:
            return []

        # filter out empty text chunks
        filtered_chunks = [text for text in text_chunks if text.strip()]

        if not filtered_chunks:
            logger.warning("All text chunks were empty, skipping file passage insertion")
            return []

        # generate embeddings using the default config
        embeddings = await self._generate_embeddings(filtered_chunks, actor)

        namespace_name = await self._get_file_passages_namespace_name(organization_id)

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

        # prepare column-based data for turbopuffer - optimized for batch insert
        ids = []
        vectors = []
        texts = []
        organization_ids = []
        source_ids = []
        file_ids = []
        created_ats = []
        passages = []

        for text, embedding in zip(filtered_chunks, embeddings):
            passage = PydanticPassage(
                text=text,
                file_id=file_id,
                source_id=source_id,
                embedding=embedding,
                embedding_config=self.default_embedding_config,
                organization_id=actor.organization_id,
            )
            passages.append(passage)

            # append to columns
            ids.append(passage.id)
            vectors.append(embedding)
            texts.append(text)
            organization_ids.append(organization_id)
            source_ids.append(source_id)
            file_ids.append(file_id)
            created_ats.append(timestamp)

        # build column-based upsert data
        upsert_columns = {
            "id": ids,
            "vector": vectors,
            "text": texts,
            "organization_id": organization_ids,
            "source_id": source_ids,
            "file_id": file_ids,
            "created_at": created_ats,
        }

        try:
            # use AsyncTurbopuffer as a context manager for proper resource cleanup
            async with AsyncTurbopuffer(api_key=self.api_key, region=self.region) as client:
                namespace = client.namespace(namespace_name)
                # turbopuffer recommends column-based writes for performance
                await namespace.write(
                    upsert_columns=upsert_columns,
                    distance_metric="cosine_distance",
                    schema={"text": {"type": "string", "full_text_search": True}},
                )
                logger.info(f"Successfully inserted {len(ids)} file passages to Turbopuffer for source {source_id}, file {file_id}")
                return passages

        except Exception as e:
            logger.error(f"Failed to insert file passages to Turbopuffer: {e}")
            # check if it's a duplicate ID error
            if "duplicate" in str(e).lower():
                logger.error("Duplicate passage IDs detected in batch")
            raise

    @trace_method
    async def query_file_passages(
        self,
        source_ids: List[str],
        organization_id: str,
        actor: "PydanticUser",
        query_text: Optional[str] = None,
        search_mode: str = "vector",  # "vector", "fts", "hybrid"
        top_k: int = 10,
        file_id: Optional[str] = None,  # optional filter by specific file
        vector_weight: float = 0.5,
        fts_weight: float = 0.5,
    ) -> List[Tuple[PydanticPassage, float, dict]]:
        """Query file passages from Turbopuffer using org-scoped namespace.

        Args:
            source_ids: List of source IDs to query
            organization_id: Organization ID for namespace lookup
            actor: User actor for embedding generation
            query_text: Text query for search
            search_mode: Search mode - "vector", "fts", or "hybrid" (default: "vector")
            top_k: Number of results to return
            file_id: Optional file ID to filter results to a specific file
            vector_weight: Weight for vector search results in hybrid mode (default: 0.5)
            fts_weight: Weight for FTS results in hybrid mode (default: 0.5)

        Returns:
            List of (passage, score, metadata) tuples with relevance rankings
        """
        # generate embedding for vector/hybrid search if query_text is provided
        query_embedding = None
        if query_text and search_mode in ["vector", "hybrid"]:
            embeddings = await self._generate_embeddings([query_text], actor)
            query_embedding = embeddings[0]

        # check if we should fallback to timestamp-based retrieval
        if query_embedding is None and query_text is None and search_mode not in ["timestamp"]:
            # fallback to retrieving most recent passages when no search query is provided
            search_mode = "timestamp"

        namespace_name = await self._get_file_passages_namespace_name(organization_id)

        # build filters - always filter by source_ids
        if len(source_ids) == 1:
            # single source_id, use Eq for efficiency
            filters = [("source_id", "Eq", source_ids[0])]
        else:
            # multiple source_ids, use In operator
            filters = [("source_id", "In", source_ids)]

        # add file filter if specified
        if file_id:
            filters.append(("file_id", "Eq", file_id))

        # combine filters
        final_filter = filters[0] if len(filters) == 1 else ("And", filters)

        try:
            # use generic query executor
            result = await self._execute_query(
                namespace_name=namespace_name,
                search_mode=search_mode,
                query_embedding=query_embedding,
                query_text=query_text,
                top_k=top_k,
                include_attributes=["text", "organization_id", "source_id", "file_id", "created_at"],
                filters=final_filter,
                vector_weight=vector_weight,
                fts_weight=fts_weight,
            )

            # process results based on search mode
            if search_mode == "hybrid":
                # for hybrid mode, we get a multi-query response
                vector_results = self._process_file_query_results(result.results[0])
                fts_results = self._process_file_query_results(result.results[1], is_fts=True)
                # use RRF and include metadata with ranks
                results_with_metadata = self._reciprocal_rank_fusion(
                    vector_results=[passage for passage, _ in vector_results],
                    fts_results=[passage for passage, _ in fts_results],
                    get_id_func=lambda p: p.id,
                    vector_weight=vector_weight,
                    fts_weight=fts_weight,
                    top_k=top_k,
                )
                return results_with_metadata
            else:
                # for single queries (vector, fts, timestamp) - add basic metadata
                is_fts = search_mode == "fts"
                results = self._process_file_query_results(result, is_fts=is_fts)
                # add simple metadata for single search modes
                results_with_metadata = []
                for idx, (passage, score) in enumerate(results):
                    metadata = {
                        "combined_score": score,
                        f"{search_mode}_rank": idx + 1,  # add the rank for this search mode
                    }
                    results_with_metadata.append((passage, score, metadata))
                return results_with_metadata

        except Exception as e:
            logger.error(f"Failed to query file passages from Turbopuffer: {e}")
            raise

    def _process_file_query_results(self, result, is_fts: bool = False) -> List[Tuple[PydanticPassage, float]]:
        """Process results from a file query into passage objects with scores."""
        passages_with_scores = []

        for row in result.rows:
            # build metadata
            metadata = {}

            # create a passage with minimal fields - embeddings are not returned from Turbopuffer
            passage = PydanticPassage(
                id=row.id,
                text=getattr(row, "text", ""),
                organization_id=getattr(row, "organization_id", None),
                source_id=getattr(row, "source_id", None),  # get source_id from the row
                file_id=getattr(row, "file_id", None),
                created_at=getattr(row, "created_at", None),
                metadata_=metadata,
                tags=[],
                # set required fields to empty/default values since we don't store embeddings
                embedding=[],  # empty embedding since we don't return it from Turbopuffer
                embedding_config=self.default_embedding_config,
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

    @trace_method
    async def delete_file_passages(self, source_id: str, file_id: str, organization_id: str) -> bool:
        """Delete all passages for a specific file from Turbopuffer."""
        from turbopuffer import AsyncTurbopuffer

        namespace_name = await self._get_file_passages_namespace_name(organization_id)

        try:
            async with AsyncTurbopuffer(api_key=self.api_key, region=self.region) as client:
                namespace = client.namespace(namespace_name)
                # use delete_by_filter to only delete passages for this file
                # need to filter by both source_id and file_id
                filter_expr = ("And", [("source_id", "Eq", source_id), ("file_id", "Eq", file_id)])
                result = await namespace.write(delete_by_filter=filter_expr)
                logger.info(
                    f"Successfully deleted passages for file {file_id} from source {source_id} (deleted {result.rows_affected} rows)"
                )
                return True
        except Exception as e:
            logger.error(f"Failed to delete file passages from Turbopuffer: {e}")
            raise

    @trace_method
    async def delete_source_passages(self, source_id: str, organization_id: str) -> bool:
        """Delete all passages for a source from Turbopuffer."""
        from turbopuffer import AsyncTurbopuffer

        namespace_name = await self._get_file_passages_namespace_name(organization_id)

        try:
            async with AsyncTurbopuffer(api_key=self.api_key, region=self.region) as client:
                namespace = client.namespace(namespace_name)
                # delete all passages for this source
                result = await namespace.write(delete_by_filter=("source_id", "Eq", source_id))
                logger.info(f"Successfully deleted all passages for source {source_id} (deleted {result.rows_affected} rows)")
                return True
        except Exception as e:
            logger.error(f"Failed to delete source passages from Turbopuffer: {e}")
            raise
