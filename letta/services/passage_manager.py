from datetime import datetime, timezone
from functools import lru_cache
from typing import List, Optional

from openai import AsyncOpenAI, OpenAI
from sqlalchemy import select

from letta.constants import MAX_EMBEDDING_DIM
from letta.embeddings import parse_and_chunk_text
from letta.helpers.decorators import async_redis_cache
from letta.llm_api.llm_client import LLMClient
from letta.orm import ArchivesAgents
from letta.orm.errors import NoResultFound
from letta.orm.passage import ArchivalPassage, SourcePassage
from letta.otel.tracing import trace_method
from letta.schemas.agent import AgentState
from letta.schemas.file import FileMetadata as PydanticFileMetadata
from letta.schemas.passage import Passage as PydanticPassage
from letta.schemas.user import User as PydanticUser
from letta.server.db import db_registry
from letta.services.archive_manager import ArchiveManager
from letta.utils import enforce_types


# TODO: Add redis-backed caching for backend
@lru_cache(maxsize=8192)
def get_openai_embedding(text: str, model: str, endpoint: str) -> List[float]:
    from letta.settings import model_settings

    client = OpenAI(api_key=model_settings.openai_api_key, base_url=endpoint, max_retries=0)
    response = client.embeddings.create(input=text, model=model)
    return response.data[0].embedding


@async_redis_cache(key_func=lambda text, model, endpoint: f"{model}:{endpoint}:{text}")
async def get_openai_embedding_async(text: str, model: str, endpoint: str) -> list[float]:
    from letta.settings import model_settings

    client = AsyncOpenAI(api_key=model_settings.openai_api_key, base_url=endpoint, max_retries=0)
    response = await client.embeddings.create(input=text, model=model)
    return response.data[0].embedding


class PassageManager:
    """Manager class to handle business logic related to Passages."""

    def __init__(self):
        self.archive_manager = ArchiveManager()

    # AGENT PASSAGE METHODS
    @enforce_types
    @trace_method
    def get_agent_passage_by_id(self, passage_id: str, actor: PydanticUser) -> Optional[PydanticPassage]:
        """Fetch an agent passage by ID."""
        with db_registry.session() as session:
            try:
                passage = ArchivalPassage.read(db_session=session, identifier=passage_id, actor=actor)
                return passage.to_pydantic()
            except NoResultFound:
                raise NoResultFound(f"Agent passage with id {passage_id} not found in database.")

    @enforce_types
    @trace_method
    async def get_agent_passage_by_id_async(self, passage_id: str, actor: PydanticUser) -> Optional[PydanticPassage]:
        """Fetch an agent passage by ID."""
        async with db_registry.async_session() as session:
            try:
                passage = await ArchivalPassage.read_async(db_session=session, identifier=passage_id, actor=actor)
                return passage.to_pydantic()
            except NoResultFound:
                raise NoResultFound(f"Agent passage with id {passage_id} not found in database.")

    # SOURCE PASSAGE METHODS
    @enforce_types
    @trace_method
    def get_source_passage_by_id(self, passage_id: str, actor: PydanticUser) -> Optional[PydanticPassage]:
        """Fetch a source passage by ID."""
        with db_registry.session() as session:
            try:
                passage = SourcePassage.read(db_session=session, identifier=passage_id, actor=actor)
                return passage.to_pydantic()
            except NoResultFound:
                raise NoResultFound(f"Source passage with id {passage_id} not found in database.")

    @enforce_types
    @trace_method
    async def get_source_passage_by_id_async(self, passage_id: str, actor: PydanticUser) -> Optional[PydanticPassage]:
        """Fetch a source passage by ID."""
        async with db_registry.async_session() as session:
            try:
                passage = await SourcePassage.read_async(db_session=session, identifier=passage_id, actor=actor)
                return passage.to_pydantic()
            except NoResultFound:
                raise NoResultFound(f"Source passage with id {passage_id} not found in database.")

    # DEPRECATED - Use specific methods above
    @enforce_types
    @trace_method
    def get_passage_by_id(self, passage_id: str, actor: PydanticUser) -> Optional[PydanticPassage]:
        """DEPRECATED: Use get_agent_passage_by_id() or get_source_passage_by_id() instead."""
        import warnings

        warnings.warn(
            "get_passage_by_id is deprecated. Use get_agent_passage_by_id() or get_source_passage_by_id() instead.",
            DeprecationWarning,
            stacklevel=2,
        )

        with db_registry.session() as session:
            # Try source passages first
            try:
                passage = SourcePassage.read(db_session=session, identifier=passage_id, actor=actor)
                return passage.to_pydantic()
            except NoResultFound:
                # Try archival passages
                try:
                    passage = ArchivalPassage.read(db_session=session, identifier=passage_id, actor=actor)
                    return passage.to_pydantic()
                except NoResultFound:
                    raise NoResultFound(f"Passage with id {passage_id} not found in database.")

    @enforce_types
    @trace_method
    async def get_passage_by_id_async(self, passage_id: str, actor: PydanticUser) -> Optional[PydanticPassage]:
        """DEPRECATED: Use get_agent_passage_by_id_async() or get_source_passage_by_id_async() instead."""
        import warnings

        warnings.warn(
            "get_passage_by_id_async is deprecated. Use get_agent_passage_by_id_async() or get_source_passage_by_id_async() instead.",
            DeprecationWarning,
            stacklevel=2,
        )

        async with db_registry.async_session() as session:
            # Try source passages first
            try:
                passage = await SourcePassage.read_async(db_session=session, identifier=passage_id, actor=actor)
                return passage.to_pydantic()
            except NoResultFound:
                # Try archival passages
                try:
                    passage = await ArchivalPassage.read_async(db_session=session, identifier=passage_id, actor=actor)
                    return passage.to_pydantic()
                except NoResultFound:
                    raise NoResultFound(f"Passage with id {passage_id} not found in database.")

    @enforce_types
    @trace_method
    def create_agent_passage(self, pydantic_passage: PydanticPassage, actor: PydanticUser) -> PydanticPassage:
        """Create a new agent passage."""
        if not pydantic_passage.archive_id:
            raise ValueError("Agent passage must have archive_id")
        if pydantic_passage.source_id:
            raise ValueError("Agent passage cannot have source_id")

        data = pydantic_passage.model_dump(to_orm=True)
        common_fields = {
            "id": data.get("id"),
            "text": data["text"],
            "embedding": data["embedding"],
            "embedding_config": data["embedding_config"],
            "organization_id": data["organization_id"],
            "metadata_": data.get("metadata", {}),
            "is_deleted": data.get("is_deleted", False),
            "created_at": data.get("created_at", datetime.now(timezone.utc)),
        }
        agent_fields = {"archive_id": data["archive_id"]}
        passage = ArchivalPassage(**common_fields, **agent_fields)

        with db_registry.session() as session:
            passage.create(session, actor=actor)
            return passage.to_pydantic()

    @enforce_types
    @trace_method
    async def create_agent_passage_async(self, pydantic_passage: PydanticPassage, actor: PydanticUser) -> PydanticPassage:
        """Create a new agent passage."""
        if not pydantic_passage.archive_id:
            raise ValueError("Agent passage must have archive_id")
        if pydantic_passage.source_id:
            raise ValueError("Agent passage cannot have source_id")

        data = pydantic_passage.model_dump(to_orm=True)
        common_fields = {
            "id": data.get("id"),
            "text": data["text"],
            "embedding": data["embedding"],
            "embedding_config": data["embedding_config"],
            "organization_id": data["organization_id"],
            "metadata_": data.get("metadata", {}),
            "is_deleted": data.get("is_deleted", False),
            "created_at": data.get("created_at", datetime.now(timezone.utc)),
        }
        agent_fields = {"archive_id": data["archive_id"]}
        passage = ArchivalPassage(**common_fields, **agent_fields)

        async with db_registry.async_session() as session:
            passage = await passage.create_async(session, actor=actor)
            return passage.to_pydantic()

    @enforce_types
    @trace_method
    def create_source_passage(
        self, pydantic_passage: PydanticPassage, file_metadata: PydanticFileMetadata, actor: PydanticUser
    ) -> PydanticPassage:
        """Create a new source passage."""
        if not pydantic_passage.source_id:
            raise ValueError("Source passage must have source_id")
        if pydantic_passage.archive_id:
            raise ValueError("Source passage cannot have archive_id")

        data = pydantic_passage.model_dump(to_orm=True)
        common_fields = {
            "id": data.get("id"),
            "text": data["text"],
            "embedding": data["embedding"],
            "embedding_config": data["embedding_config"],
            "organization_id": data["organization_id"],
            "metadata_": data.get("metadata", {}),
            "is_deleted": data.get("is_deleted", False),
            "created_at": data.get("created_at", datetime.now(timezone.utc)),
        }
        source_fields = {
            "source_id": data["source_id"],
            "file_id": data.get("file_id"),
            "file_name": file_metadata.file_name,
        }
        passage = SourcePassage(**common_fields, **source_fields)

        with db_registry.session() as session:
            passage.create(session, actor=actor)
            return passage.to_pydantic()

    @enforce_types
    @trace_method
    async def create_source_passage_async(
        self, pydantic_passage: PydanticPassage, file_metadata: PydanticFileMetadata, actor: PydanticUser
    ) -> PydanticPassage:
        """Create a new source passage."""
        if not pydantic_passage.source_id:
            raise ValueError("Source passage must have source_id")
        if pydantic_passage.archive_id:
            raise ValueError("Source passage cannot have archive_id")

        data = pydantic_passage.model_dump(to_orm=True)
        common_fields = {
            "id": data.get("id"),
            "text": data["text"],
            "embedding": data["embedding"],
            "embedding_config": data["embedding_config"],
            "organization_id": data["organization_id"],
            "metadata_": data.get("metadata", {}),
            "is_deleted": data.get("is_deleted", False),
            "created_at": data.get("created_at", datetime.now(timezone.utc)),
        }
        source_fields = {
            "source_id": data["source_id"],
            "file_id": data.get("file_id"),
            "file_name": file_metadata.file_name,
        }
        passage = SourcePassage(**common_fields, **source_fields)

        async with db_registry.async_session() as session:
            passage = await passage.create_async(session, actor=actor)
            return passage.to_pydantic()

    # DEPRECATED - Use specific methods above
    @enforce_types
    @trace_method
    def create_passage(self, pydantic_passage: PydanticPassage, actor: PydanticUser) -> PydanticPassage:
        """DEPRECATED: Use create_agent_passage() or create_source_passage() instead."""
        import warnings

        warnings.warn(
            "create_passage is deprecated. Use create_agent_passage() or create_source_passage() instead.", DeprecationWarning, stacklevel=2
        )

        passage = self._preprocess_passage_for_creation(pydantic_passage=pydantic_passage)

        with db_registry.session() as session:
            passage.create(session, actor=actor)
            return passage.to_pydantic()

    @enforce_types
    @trace_method
    async def create_passage_async(self, pydantic_passage: PydanticPassage, actor: PydanticUser) -> PydanticPassage:
        """DEPRECATED: Use create_agent_passage_async() or create_source_passage_async() instead."""
        import warnings

        warnings.warn(
            "create_passage_async is deprecated. Use create_agent_passage_async() or create_source_passage_async() instead.",
            DeprecationWarning,
            stacklevel=2,
        )

        # Common fields for both passage types
        passage = self._preprocess_passage_for_creation(pydantic_passage=pydantic_passage)
        async with db_registry.async_session() as session:
            passage = await passage.create_async(session, actor=actor)
            return passage.to_pydantic()

    @trace_method
    def _preprocess_passage_for_creation(self, pydantic_passage: PydanticPassage) -> "SqlAlchemyBase":
        data = pydantic_passage.model_dump(to_orm=True)
        common_fields = {
            "id": data.get("id"),
            "text": data["text"],
            "embedding": data["embedding"],
            "embedding_config": data["embedding_config"],
            "organization_id": data["organization_id"],
            "metadata_": data.get("metadata", {}),
            "is_deleted": data.get("is_deleted", False),
            "created_at": data.get("created_at", datetime.now(timezone.utc)),
        }

        if "archive_id" in data and data["archive_id"]:
            assert not data.get("source_id"), "Passage cannot have both archive_id and source_id"
            agent_fields = {
                "archive_id": data["archive_id"],
            }
            passage = ArchivalPassage(**common_fields, **agent_fields)
        elif "source_id" in data and data["source_id"]:
            assert not data.get("archive_id"), "Passage cannot have both archive_id and source_id"
            source_fields = {
                "source_id": data["source_id"],
                "file_id": data.get("file_id"),
            }
            passage = SourcePassage(**common_fields, **source_fields)
        else:
            raise ValueError("Passage must have either archive_id or source_id")

        return passage

    @enforce_types
    @trace_method
    def create_many_agent_passages(self, passages: List[PydanticPassage], actor: PydanticUser) -> List[PydanticPassage]:
        """Create multiple agent passages."""
        return [self.create_agent_passage(p, actor) for p in passages]

    @enforce_types
    @trace_method
    async def create_many_archival_passages_async(self, passages: List[PydanticPassage], actor: PydanticUser) -> List[PydanticPassage]:
        """Create multiple archival passages."""
        archival_passages = []
        for p in passages:
            if not p.archive_id:
                raise ValueError("Archival passage must have archive_id")
            if p.source_id:
                raise ValueError("Archival passage cannot have source_id")

            data = p.model_dump(to_orm=True)
            common_fields = {
                "id": data.get("id"),
                "text": data["text"],
                "embedding": data["embedding"],
                "embedding_config": data["embedding_config"],
                "organization_id": data["organization_id"],
                "metadata_": data.get("metadata", {}),
                "is_deleted": data.get("is_deleted", False),
                "created_at": data.get("created_at", datetime.now(timezone.utc)),
            }
            archival_fields = {"archive_id": data["archive_id"]}
            archival_passages.append(ArchivalPassage(**common_fields, **archival_fields))

        async with db_registry.async_session() as session:
            archival_created = await ArchivalPassage.batch_create_async(items=archival_passages, db_session=session, actor=actor)
            return [p.to_pydantic() for p in archival_created]

    @enforce_types
    @trace_method
    def create_many_source_passages(
        self, passages: List[PydanticPassage], file_metadata: PydanticFileMetadata, actor: PydanticUser
    ) -> List[PydanticPassage]:
        """Create multiple source passages."""
        return [self.create_source_passage(p, file_metadata, actor) for p in passages]

    @enforce_types
    @trace_method
    async def create_many_source_passages_async(
        self, passages: List[PydanticPassage], file_metadata: PydanticFileMetadata, actor: PydanticUser
    ) -> List[PydanticPassage]:
        """Create multiple source passages."""
        source_passages = []
        for p in passages:
            if not p.source_id:
                raise ValueError("Source passage must have source_id")
            if p.archive_id:
                raise ValueError("Source passage cannot have archive_id")

            data = p.model_dump(to_orm=True)
            common_fields = {
                "id": data.get("id"),
                "text": data["text"],
                "embedding": data["embedding"],
                "embedding_config": data["embedding_config"],
                "organization_id": data["organization_id"],
                "metadata_": data.get("metadata", {}),
                "is_deleted": data.get("is_deleted", False),
                "created_at": data.get("created_at", datetime.now(timezone.utc)),
            }
            source_fields = {
                "source_id": data["source_id"],
                "file_id": data.get("file_id"),
                "file_name": file_metadata.file_name,
            }
            source_passages.append(SourcePassage(**common_fields, **source_fields))

        async with db_registry.async_session() as session:
            source_created = await SourcePassage.batch_create_async(items=source_passages, db_session=session, actor=actor)
            return [p.to_pydantic() for p in source_created]

    # DEPRECATED - Use specific methods above
    @enforce_types
    @trace_method
    def create_many_passages(self, passages: List[PydanticPassage], actor: PydanticUser) -> List[PydanticPassage]:
        """DEPRECATED: Use create_many_agent_passages() or create_many_source_passages() instead."""
        import warnings

        warnings.warn(
            "create_many_passages is deprecated. Use create_many_agent_passages() or create_many_source_passages() instead.",
            DeprecationWarning,
            stacklevel=2,
        )
        return [self.create_passage(p, actor) for p in passages]

    @enforce_types
    @trace_method
    async def create_many_passages_async(self, passages: List[PydanticPassage], actor: PydanticUser) -> List[PydanticPassage]:
        """DEPRECATED: Use create_many_agent_passages_async() or create_many_source_passages_async() instead."""
        import warnings

        warnings.warn(
            "create_many_passages_async is deprecated. Use create_many_agent_passages_async() or create_many_source_passages_async() instead.",
            DeprecationWarning,
            stacklevel=2,
        )

        async with db_registry.async_session() as session:
            agent_passages = []
            source_passages = []

            for p in passages:
                model = self._preprocess_passage_for_creation(p)
                if isinstance(model, ArchivalPassage):
                    agent_passages.append(model)
                elif isinstance(model, SourcePassage):
                    source_passages.append(model)
                else:
                    raise TypeError(f"Unexpected passage type: {type(model)}")

            results = []
            if agent_passages:
                agent_created = await ArchivalPassage.batch_create_async(items=agent_passages, db_session=session, actor=actor)
                results.extend(agent_created)
            if source_passages:
                source_created = await SourcePassage.batch_create_async(items=source_passages, db_session=session, actor=actor)
                results.extend(source_created)

            return [p.to_pydantic() for p in results]

    @enforce_types
    @trace_method
    async def insert_passage(
        self,
        agent_state: AgentState,
        text: str,
        actor: PydanticUser,
    ) -> List[PydanticPassage]:
        """Insert passage(s) into archival memory"""

        embedding_chunk_size = agent_state.embedding_config.embedding_chunk_size
        embedding_client = LLMClient.create(
            provider_type=agent_state.embedding_config.embedding_endpoint_type,
            actor=actor,
        )

        # Get or create the default archive for the agent
        archive = await self.archive_manager.get_or_create_default_archive_for_agent_async(
            agent_id=agent_state.id, agent_name=agent_state.name, actor=actor
        )

        text_chunks = list(parse_and_chunk_text(text, embedding_chunk_size))

        if not text_chunks:
            return []

        try:
            # Generate embeddings for all chunks using the new async API
            embeddings = await embedding_client.request_embeddings(text_chunks, agent_state.embedding_config)

            passages = []
            for chunk_text, embedding in zip(text_chunks, embeddings):
                passage = await self.create_agent_passage_async(
                    PydanticPassage(
                        organization_id=actor.organization_id,
                        archive_id=archive.id,
                        text=chunk_text,
                        embedding=embedding,
                        embedding_config=agent_state.embedding_config,
                    ),
                    actor=actor,
                )
                passages.append(passage)

            return passages

        except Exception as e:
            raise e

    async def _generate_embeddings_concurrent(self, text_chunks: List[str], embedding_config, actor: PydanticUser) -> List[List[float]]:
        """Generate embeddings for all text chunks concurrently using LLMClient"""

        embedding_client = LLMClient.create(
            provider_type=embedding_config.embedding_endpoint_type,
            actor=actor,
        )

        embeddings = await embedding_client.request_embeddings(text_chunks, embedding_config)
        return embeddings

    @enforce_types
    @trace_method
    def update_agent_passage_by_id(
        self, passage_id: str, passage: PydanticPassage, actor: PydanticUser, **kwargs
    ) -> Optional[PydanticPassage]:
        """Update an agent passage."""
        if not passage_id:
            raise ValueError("Passage ID must be provided.")

        with db_registry.session() as session:
            try:
                curr_passage = ArchivalPassage.read(
                    db_session=session,
                    identifier=passage_id,
                    actor=actor,
                )
            except NoResultFound:
                raise ValueError(f"Agent passage with id {passage_id} does not exist.")

            # Update the database record with values from the provided record
            update_data = passage.model_dump(to_orm=True, exclude_unset=True, exclude_none=True)
            for key, value in update_data.items():
                setattr(curr_passage, key, value)

            # Commit changes
            curr_passage.update(session, actor=actor)
            return curr_passage.to_pydantic()

    @enforce_types
    @trace_method
    async def update_agent_passage_by_id_async(
        self, passage_id: str, passage: PydanticPassage, actor: PydanticUser, **kwargs
    ) -> Optional[PydanticPassage]:
        """Update an agent passage."""
        if not passage_id:
            raise ValueError("Passage ID must be provided.")

        async with db_registry.async_session() as session:
            try:
                curr_passage = await ArchivalPassage.read_async(
                    db_session=session,
                    identifier=passage_id,
                    actor=actor,
                )
            except NoResultFound:
                raise ValueError(f"Agent passage with id {passage_id} does not exist.")

            # Update the database record with values from the provided record
            update_data = passage.model_dump(to_orm=True, exclude_unset=True, exclude_none=True)
            for key, value in update_data.items():
                setattr(curr_passage, key, value)

            # Commit changes
            await curr_passage.update_async(session, actor=actor)
            return curr_passage.to_pydantic()

    @enforce_types
    @trace_method
    def update_source_passage_by_id(
        self, passage_id: str, passage: PydanticPassage, actor: PydanticUser, **kwargs
    ) -> Optional[PydanticPassage]:
        """Update a source passage."""
        if not passage_id:
            raise ValueError("Passage ID must be provided.")

        with db_registry.session() as session:
            try:
                curr_passage = SourcePassage.read(
                    db_session=session,
                    identifier=passage_id,
                    actor=actor,
                )
            except NoResultFound:
                raise ValueError(f"Source passage with id {passage_id} does not exist.")

            # Update the database record with values from the provided record
            update_data = passage.model_dump(to_orm=True, exclude_unset=True, exclude_none=True)
            for key, value in update_data.items():
                setattr(curr_passage, key, value)

            # Commit changes
            curr_passage.update(session, actor=actor)
            return curr_passage.to_pydantic()

    @enforce_types
    @trace_method
    async def update_source_passage_by_id_async(
        self, passage_id: str, passage: PydanticPassage, actor: PydanticUser, **kwargs
    ) -> Optional[PydanticPassage]:
        """Update a source passage."""
        if not passage_id:
            raise ValueError("Passage ID must be provided.")

        async with db_registry.async_session() as session:
            try:
                curr_passage = await SourcePassage.read_async(
                    db_session=session,
                    identifier=passage_id,
                    actor=actor,
                )
            except NoResultFound:
                raise ValueError(f"Source passage with id {passage_id} does not exist.")

            # Update the database record with values from the provided record
            update_data = passage.model_dump(to_orm=True, exclude_unset=True, exclude_none=True)
            for key, value in update_data.items():
                setattr(curr_passage, key, value)

            # Commit changes
            await curr_passage.update_async(session, actor=actor)
            return curr_passage.to_pydantic()

    @enforce_types
    @trace_method
    def delete_agent_passage_by_id(self, passage_id: str, actor: PydanticUser) -> bool:
        """Delete an agent passage."""
        if not passage_id:
            raise ValueError("Passage ID must be provided.")

        with db_registry.session() as session:
            try:
                passage = ArchivalPassage.read(db_session=session, identifier=passage_id, actor=actor)
                passage.hard_delete(session, actor=actor)
                return True
            except NoResultFound:
                raise NoResultFound(f"Agent passage with id {passage_id} not found.")

    @enforce_types
    @trace_method
    async def delete_agent_passage_by_id_async(self, passage_id: str, actor: PydanticUser) -> bool:
        """Delete an agent passage."""
        if not passage_id:
            raise ValueError("Passage ID must be provided.")

        async with db_registry.async_session() as session:
            try:
                passage = await ArchivalPassage.read_async(db_session=session, identifier=passage_id, actor=actor)
                await passage.hard_delete_async(session, actor=actor)
                return True
            except NoResultFound:
                raise NoResultFound(f"Agent passage with id {passage_id} not found.")

    @enforce_types
    @trace_method
    def delete_source_passage_by_id(self, passage_id: str, actor: PydanticUser) -> bool:
        """Delete a source passage."""
        if not passage_id:
            raise ValueError("Passage ID must be provided.")

        with db_registry.session() as session:
            try:
                passage = SourcePassage.read(db_session=session, identifier=passage_id, actor=actor)
                passage.hard_delete(session, actor=actor)
                return True
            except NoResultFound:
                raise NoResultFound(f"Source passage with id {passage_id} not found.")

    @enforce_types
    @trace_method
    async def delete_source_passage_by_id_async(self, passage_id: str, actor: PydanticUser) -> bool:
        """Delete a source passage."""
        if not passage_id:
            raise ValueError("Passage ID must be provided.")

        async with db_registry.async_session() as session:
            try:
                passage = await SourcePassage.read_async(db_session=session, identifier=passage_id, actor=actor)
                await passage.hard_delete_async(session, actor=actor)
                return True
            except NoResultFound:
                raise NoResultFound(f"Source passage with id {passage_id} not found.")

    # DEPRECATED - Use specific methods above
    @enforce_types
    @trace_method
    def update_passage_by_id(self, passage_id: str, passage: PydanticPassage, actor: PydanticUser, **kwargs) -> Optional[PydanticPassage]:
        """DEPRECATED: Use update_agent_passage_by_id() or update_source_passage_by_id() instead."""
        import warnings

        warnings.warn(
            "update_passage_by_id is deprecated. Use update_agent_passage_by_id() or update_source_passage_by_id() instead.",
            DeprecationWarning,
            stacklevel=2,
        )

        if not passage_id:
            raise ValueError("Passage ID must be provided.")

        with db_registry.session() as session:
            # Try source passages first
            try:
                curr_passage = SourcePassage.read(
                    db_session=session,
                    identifier=passage_id,
                    actor=actor,
                )
            except NoResultFound:
                # Try agent passages
                try:
                    curr_passage = ArchivalPassage.read(
                        db_session=session,
                        identifier=passage_id,
                        actor=actor,
                    )
                except NoResultFound:
                    raise ValueError(f"Passage with id {passage_id} does not exist.")

            # Update the database record with values from the provided record
            update_data = passage.model_dump(to_orm=True, exclude_unset=True, exclude_none=True)
            for key, value in update_data.items():
                setattr(curr_passage, key, value)

            # Commit changes
            curr_passage.update(session, actor=actor)
            return curr_passage.to_pydantic()

    @enforce_types
    @trace_method
    def delete_passage_by_id(self, passage_id: str, actor: PydanticUser) -> bool:
        """DEPRECATED: Use delete_agent_passage_by_id() or delete_source_passage_by_id() instead."""
        import warnings

        warnings.warn(
            "delete_passage_by_id is deprecated. Use delete_agent_passage_by_id() or delete_source_passage_by_id() instead.",
            DeprecationWarning,
            stacklevel=2,
        )

        if not passage_id:
            raise ValueError("Passage ID must be provided.")

        with db_registry.session() as session:
            # Try source passages first
            try:
                passage = SourcePassage.read(db_session=session, identifier=passage_id, actor=actor)
                passage.hard_delete(session, actor=actor)
                return True
            except NoResultFound:
                # Try archival passages
                try:
                    passage = ArchivalPassage.read(db_session=session, identifier=passage_id, actor=actor)
                    passage.hard_delete(session, actor=actor)
                    return True
                except NoResultFound:
                    raise NoResultFound(f"Passage with id {passage_id} not found.")

    @enforce_types
    @trace_method
    async def delete_passage_by_id_async(self, passage_id: str, actor: PydanticUser) -> bool:
        """DEPRECATED: Use delete_agent_passage_by_id_async() or delete_source_passage_by_id_async() instead."""
        import warnings

        warnings.warn(
            "delete_passage_by_id_async is deprecated. Use delete_agent_passage_by_id_async() or delete_source_passage_by_id_async() instead.",
            DeprecationWarning,
            stacklevel=2,
        )

        if not passage_id:
            raise ValueError("Passage ID must be provided.")

        async with db_registry.async_session() as session:
            # Try source passages first
            try:
                passage = await SourcePassage.read_async(db_session=session, identifier=passage_id, actor=actor)
                await passage.hard_delete_async(session, actor=actor)
                return True
            except NoResultFound:
                # Try archival passages
                try:
                    passage = await ArchivalPassage.read_async(db_session=session, identifier=passage_id, actor=actor)
                    await passage.hard_delete_async(session, actor=actor)
                    return True
                except NoResultFound:
                    raise NoResultFound(f"Passage with id {passage_id} not found.")

    @enforce_types
    @trace_method
    def delete_agent_passages(
        self,
        actor: PydanticUser,
        passages: List[PydanticPassage],
    ) -> bool:
        """Delete multiple agent passages."""
        # TODO: This is very inefficient
        # TODO: We should have a base `delete_all_matching_filters`-esque function
        for passage in passages:
            self.delete_agent_passage_by_id(passage_id=passage.id, actor=actor)
        return True

    @enforce_types
    @trace_method
    async def delete_agent_passages_async(
        self,
        actor: PydanticUser,
        passages: List[PydanticPassage],
    ) -> bool:
        """Delete multiple agent passages."""
        async with db_registry.async_session() as session:
            await ArchivalPassage.bulk_hard_delete_async(db_session=session, identifiers=[p.id for p in passages], actor=actor)
            return True

    @enforce_types
    @trace_method
    def delete_source_passages(
        self,
        actor: PydanticUser,
        passages: List[PydanticPassage],
    ) -> bool:
        """Delete multiple source passages."""
        # TODO: This is very inefficient
        # TODO: We should have a base `delete_all_matching_filters`-esque function
        for passage in passages:
            self.delete_source_passage_by_id(passage_id=passage.id, actor=actor)
        return True

    @enforce_types
    @trace_method
    async def delete_source_passages_async(
        self,
        actor: PydanticUser,
        passages: List[PydanticPassage],
    ) -> bool:
        async with db_registry.async_session() as session:
            await SourcePassage.bulk_hard_delete_async(db_session=session, identifiers=[p.id for p in passages], actor=actor)
            return True

    # DEPRECATED - Use specific methods above
    @enforce_types
    @trace_method
    def delete_passages(
        self,
        actor: PydanticUser,
        passages: List[PydanticPassage],
    ) -> bool:
        """DEPRECATED: Use delete_agent_passages() or delete_source_passages() instead."""
        import warnings

        warnings.warn(
            "delete_passages is deprecated. Use delete_agent_passages() or delete_source_passages() instead.",
            DeprecationWarning,
            stacklevel=2,
        )
        # TODO: This is very inefficient
        # TODO: We should have a base `delete_all_matching_filters`-esque function
        for passage in passages:
            self.delete_passage_by_id(passage_id=passage.id, actor=actor)
        return True

    @enforce_types
    @trace_method
    def agent_passage_size(
        self,
        actor: PydanticUser,
        agent_id: Optional[str] = None,
    ) -> int:
        """Get the total count of agent passages with optional filters.

        Args:
            actor: The user requesting the count
            agent_id: The agent ID of the messages
        """
        with db_registry.session() as session:
            if agent_id:
                # Count passages through the archives relationship
                return (
                    session.query(ArchivalPassage)
                    .join(ArchivesAgents, ArchivalPassage.archive_id == ArchivesAgents.archive_id)
                    .filter(
                        ArchivesAgents.agent_id == agent_id,
                        ArchivalPassage.organization_id == actor.organization_id,
                        ArchivalPassage.is_deleted == False,
                    )
                    .count()
                )
            else:
                # Count all archival passages in the organization
                return ArchivalPassage.size(db_session=session, actor=actor)

    # DEPRECATED - Use agent_passage_size() instead since this only counted agent passages anyway
    @enforce_types
    @trace_method
    def size(
        self,
        actor: PydanticUser,
        agent_id: Optional[str] = None,
    ) -> int:
        """DEPRECATED: Use agent_passage_size() instead (this only counted agent passages anyway)."""
        import warnings

        warnings.warn("size is deprecated. Use agent_passage_size() instead.", DeprecationWarning, stacklevel=2)
        return self.agent_passage_size(actor=actor, agent_id=agent_id)

    @enforce_types
    @trace_method
    async def agent_passage_size_async(
        self,
        actor: PydanticUser,
        agent_id: Optional[str] = None,
    ) -> int:
        """Get the total count of agent passages with optional filters.
        Args:
            actor: The user requesting the count
            agent_id: The agent ID of the messages
        """
        async with db_registry.async_session() as session:
            if agent_id:
                # Count passages through the archives relationship
                from sqlalchemy import func, select

                result = await session.execute(
                    select(func.count(ArchivalPassage.id))
                    .join(ArchivesAgents, ArchivalPassage.archive_id == ArchivesAgents.archive_id)
                    .where(
                        ArchivesAgents.agent_id == agent_id,
                        ArchivalPassage.organization_id == actor.organization_id,
                        ArchivalPassage.is_deleted == False,
                    )
                )
                return result.scalar() or 0
            else:
                # Count all archival passages in the organization
                return await ArchivalPassage.size_async(db_session=session, actor=actor)

    @enforce_types
    @trace_method
    def source_passage_size(
        self,
        actor: PydanticUser,
        source_id: Optional[str] = None,
    ) -> int:
        """Get the total count of source passages with optional filters.

        Args:
            actor: The user requesting the count
            source_id: The source ID of the passages
        """
        with db_registry.session() as session:
            return SourcePassage.size(db_session=session, actor=actor, source_id=source_id)

    @enforce_types
    @trace_method
    async def source_passage_size_async(
        self,
        actor: PydanticUser,
        source_id: Optional[str] = None,
    ) -> int:
        """Get the total count of source passages with optional filters.
        Args:
            actor: The user requesting the count
            source_id: The source ID of the passages
        """
        async with db_registry.async_session() as session:
            return await SourcePassage.size_async(db_session=session, actor=actor, source_id=source_id)

    @enforce_types
    @trace_method
    async def estimate_embeddings_size_async(
        self,
        actor: PydanticUser,
        agent_id: Optional[str] = None,
        storage_unit: str = "GB",
    ) -> float:
        """
        Estimate the size of the embeddings. Defaults to GB.
        """
        BYTES_PER_STORAGE_UNIT = {
            "B": 1,
            "KB": 1024,
            "MB": 1024**2,
            "GB": 1024**3,
            "TB": 1024**4,
        }
        if storage_unit not in BYTES_PER_STORAGE_UNIT:
            raise ValueError(f"Invalid storage unit: {storage_unit}. Must be one of {list(BYTES_PER_STORAGE_UNIT.keys())}.")
        BYTES_PER_EMBEDDING_DIM = 4
        GB_PER_EMBEDDING = BYTES_PER_EMBEDDING_DIM / BYTES_PER_STORAGE_UNIT[storage_unit] * MAX_EMBEDDING_DIM
        return await self.agent_passage_size_async(actor=actor, agent_id=agent_id) * GB_PER_EMBEDDING

    @enforce_types
    @trace_method
    async def list_passages_by_file_id_async(self, file_id: str, actor: PydanticUser) -> List[PydanticPassage]:
        """
        List all source passages associated with a given file_id.
        """
        async with db_registry.async_session() as session:
            result = await session.execute(
                select(SourcePassage).where(SourcePassage.file_id == file_id).where(SourcePassage.organization_id == actor.organization_id)
            )
            passages = result.scalars().all()
            return [p.to_pydantic() for p in passages]
