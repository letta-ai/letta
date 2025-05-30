import asyncio
from datetime import datetime, timezone
from functools import lru_cache
from typing import List, Optional

from async_lru import alru_cache
from openai import AsyncOpenAI, OpenAI
from sqlalchemy import select

from letta.constants import MAX_EMBEDDING_DIM
from letta.embeddings import embedding_model, parse_and_chunk_text
from letta.orm.errors import NoResultFound
from letta.orm.passage import AgentPassage, SourcePassage
from letta.schemas.agent import AgentState
from letta.schemas.passage import Passage as PydanticPassage
from letta.schemas.user import User as PydanticUser
from letta.server.db import db_registry
from letta.tracing import trace_method
from letta.utils import enforce_types


# TODO: Add redis-backed caching for backend
@lru_cache(maxsize=8192)
def get_openai_embedding(text: str, model: str, endpoint: str) -> List[float]:
    from letta.settings import model_settings

    client = OpenAI(api_key=model_settings.openai_api_key, base_url=endpoint, max_retries=0)
    response = client.embeddings.create(input=text, model=model)
    return response.data[0].embedding


# TODO: Add redis-backed caching for backend
@alru_cache(maxsize=8192)
async def get_openai_embedding_async(text: str, model: str, endpoint: str) -> List[float]:
    from letta.settings import model_settings

    client = AsyncOpenAI(api_key=model_settings.openai_api_key, base_url=endpoint, max_retries=0)
    response = await client.embeddings.create(input=text, model=model)
    return response.data[0].embedding


class PassageManager:
    """Manager class to handle business logic related to Passages."""

    @enforce_types
    @trace_method
    def get_passage_by_id(self, passage_id: str, actor: PydanticUser) -> Optional[PydanticPassage]:
        """Fetch a passage by ID."""
        with db_registry.session() as session:
            # Try source passages first
            try:
                passage = SourcePassage.read(db_session=session, identifier=passage_id, actor=actor)
                return passage.to_pydantic()
            except NoResultFound:
                # Try archival passages
                try:
                    passage = AgentPassage.read(db_session=session, identifier=passage_id, actor=actor)
                    return passage.to_pydantic()
                except NoResultFound:
                    raise NoResultFound(f"Passage with id {passage_id} not found in database.")

    @enforce_types
    @trace_method
    async def get_passage_by_id_async(self, passage_id: str, actor: PydanticUser) -> Optional[PydanticPassage]:
        """Fetch a passage by ID."""
        async with db_registry.async_session() as session:
            # Try source passages first
            try:
                passage = await SourcePassage.read_async(db_session=session, identifier=passage_id, actor=actor)
                return passage.to_pydantic()
            except NoResultFound:
                # Try archival passages
                try:
                    passage = await AgentPassage.read_async(db_session=session, identifier=passage_id, actor=actor)
                    return passage.to_pydantic()
                except NoResultFound:
                    raise NoResultFound(f"Passage with id {passage_id} not found in database.")

    @enforce_types
    @trace_method
    def create_passage(self, pydantic_passage: PydanticPassage, actor: PydanticUser) -> PydanticPassage:
        """Create a new passage in the appropriate table based on whether it has agent_id or source_id."""
        passage = self._preprocess_passage_for_creation(pydantic_passage=pydantic_passage)

        with db_registry.session() as session:
            passage.create(session, actor=actor)
            return passage.to_pydantic()

    @enforce_types
    @trace_method
    async def create_passage_async(self, pydantic_passage: PydanticPassage, actor: PydanticUser) -> PydanticPassage:
        """Create a new passage in the appropriate table based on whether it has agent_id or source_id."""
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

        if "agent_id" in data and data["agent_id"]:
            assert not data.get("source_id"), "Passage cannot have both agent_id and source_id"
            agent_fields = {
                "agent_id": data["agent_id"],
            }
            passage = AgentPassage(**common_fields, **agent_fields)
        elif "source_id" in data and data["source_id"]:
            assert not data.get("agent_id"), "Passage cannot have both agent_id and source_id"
            source_fields = {
                "source_id": data["source_id"],
                "file_id": data.get("file_id"),
            }
            passage = SourcePassage(**common_fields, **source_fields)
        else:
            raise ValueError("Passage must have either agent_id or source_id")

        return passage

    @enforce_types
    @trace_method
    def create_many_passages(self, passages: List[PydanticPassage], actor: PydanticUser) -> List[PydanticPassage]:
        """Create multiple passages."""
        return [self.create_passage(p, actor) for p in passages]

    @enforce_types
    @trace_method
    async def create_many_passages_async(self, passages: List[PydanticPassage], actor: PydanticUser) -> List[PydanticPassage]:
        """Create multiple passages."""
        async with db_registry.async_session() as session:
            agent_passages = []
            source_passages = []

            for p in passages:
                model = self._preprocess_passage_for_creation(p)
                if isinstance(model, AgentPassage):
                    agent_passages.append(model)
                elif isinstance(model, SourcePassage):
                    source_passages.append(model)
                else:
                    raise TypeError(f"Unexpected passage type: {type(model)}")

            results = []
            if agent_passages:
                agent_created = await AgentPassage.batch_create_async(items=agent_passages, db_session=session, actor=actor)
                results.extend(agent_created)
            if source_passages:
                source_created = await SourcePassage.batch_create_async(items=source_passages, db_session=session, actor=actor)
                results.extend(source_created)

            return [p.to_pydantic() for p in results]

    @enforce_types
    @trace_method
    def insert_passage(
        self,
        agent_state: AgentState,
        agent_id: str,
        text: str,
        actor: PydanticUser,
    ) -> List[PydanticPassage]:
        """Insert passage(s) into archival memory"""

        embedding_chunk_size = agent_state.embedding_config.embedding_chunk_size

        # TODO eventually migrate off of llama-index for embeddings?
        # Already causing pain for OpenAI proxy endpoints like LM Studio...
        if agent_state.embedding_config.embedding_endpoint_type != "openai":
            embed_model = embedding_model(agent_state.embedding_config)

        passages = []

        try:
            # breakup string into passages
            for text in parse_and_chunk_text(text, embedding_chunk_size):

                if agent_state.embedding_config.embedding_endpoint_type != "openai":
                    embedding = embed_model.get_text_embedding(text)
                else:
                    # TODO should have the settings passed in via the server call
                    embedding = get_openai_embedding(
                        text,
                        agent_state.embedding_config.embedding_model,
                        agent_state.embedding_config.embedding_endpoint,
                    )

                if isinstance(embedding, dict):
                    try:
                        embedding = embedding["data"][0]["embedding"]
                    except (KeyError, IndexError):
                        # TODO as a fallback, see if we can find any lists in the payload
                        raise TypeError(
                            f"Got back an unexpected payload from text embedding function, type={type(embedding)}, value={embedding}"
                        )
                passage = self.create_passage(
                    PydanticPassage(
                        organization_id=actor.organization_id,
                        agent_id=agent_id,
                        text=text,
                        embedding=embedding,
                        embedding_config=agent_state.embedding_config,
                    ),
                    actor=actor,
                )
                passages.append(passage)

            return passages

        except Exception as e:
            raise e

    @enforce_types
    @trace_method
    async def insert_passage_async(
        self,
        agent_state: AgentState,
        agent_id: str,
        text: str,
        actor: PydanticUser,
    ) -> List[PydanticPassage]:
        """Insert passage(s) into archival memory"""

        embedding_chunk_size = agent_state.embedding_config.embedding_chunk_size
        text_chunks = list(parse_and_chunk_text(text, embedding_chunk_size))

        if not text_chunks:
            return []

        try:
            embeddings = await self._generate_embeddings_concurrent(text_chunks, agent_state.embedding_config)

            passages = [
                PydanticPassage(
                    organization_id=actor.organization_id,
                    agent_id=agent_id,
                    text=chunk_text,
                    embedding=embedding,
                    embedding_config=agent_state.embedding_config,
                )
                for chunk_text, embedding in zip(text_chunks, embeddings)
            ]

            passages = await self.create_many_passages_async(passages=passages, actor=actor)

            return passages

        except Exception as e:
            raise e

    async def _generate_embeddings_concurrent(self, text_chunks: List[str], embedding_config) -> List[List[float]]:
        """Generate embeddings for all text chunks concurrently"""

        if embedding_config.embedding_endpoint_type != "openai":
            embed_model = embedding_model(embedding_config)
            loop = asyncio.get_event_loop()

            tasks = [loop.run_in_executor(None, embed_model.get_text_embedding, text) for text in text_chunks]
            embeddings = await asyncio.gather(*tasks)
        else:
            tasks = [
                get_openai_embedding_async(
                    text,
                    embedding_config.embedding_model,
                    embedding_config.embedding_endpoint,
                )
                for text in text_chunks
            ]
            embeddings = await asyncio.gather(*tasks)

        processed_embeddings = []
        for embedding in embeddings:
            if isinstance(embedding, dict):
                try:
                    processed_embeddings.append(embedding["data"][0]["embedding"])
                except (KeyError, IndexError):
                    raise TypeError(
                        f"Got back an unexpected payload from text embedding function, type={type(embedding)}, value={embedding}"
                    )
            else:
                processed_embeddings.append(embedding)

        return processed_embeddings

    @enforce_types
    @trace_method
    def update_passage_by_id(self, passage_id: str, passage: PydanticPassage, actor: PydanticUser, **kwargs) -> Optional[PydanticPassage]:
        """Update a passage."""
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
                    curr_passage = AgentPassage.read(
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
        """Delete a passage from either source or archival passages."""
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
                    passage = AgentPassage.read(db_session=session, identifier=passage_id, actor=actor)
                    passage.hard_delete(session, actor=actor)
                    return True
                except NoResultFound:
                    raise NoResultFound(f"Passage with id {passage_id} not found.")

    @enforce_types
    @trace_method
    async def delete_passage_by_id_async(self, passage_id: str, actor: PydanticUser) -> bool:
        """Delete a passage from either source or archival passages."""
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
                    passage = await AgentPassage.read_async(db_session=session, identifier=passage_id, actor=actor)
                    await passage.hard_delete_async(session, actor=actor)
                    return True
                except NoResultFound:
                    raise NoResultFound(f"Passage with id {passage_id} not found.")

    @enforce_types
    @trace_method
    def delete_passages(
        self,
        actor: PydanticUser,
        passages: List[PydanticPassage],
    ) -> bool:
        # TODO: This is very inefficient
        # TODO: We should have a base `delete_all_matching_filters`-esque function
        for passage in passages:
            self.delete_passage_by_id(passage_id=passage.id, actor=actor)
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

    @enforce_types
    @trace_method
    def size(
        self,
        actor: PydanticUser,
        agent_id: Optional[str] = None,
    ) -> int:
        """Get the total count of messages with optional filters.

        Args:
            actor: The user requesting the count
            agent_id: The agent ID of the messages
        """
        with db_registry.session() as session:
            return AgentPassage.size(db_session=session, actor=actor, agent_id=agent_id)

    @enforce_types
    @trace_method
    async def size_async(
        self,
        actor: PydanticUser,
        agent_id: Optional[str] = None,
    ) -> int:
        """Get the total count of messages with optional filters.
        Args:
            actor: The user requesting the count
            agent_id: The agent ID of the messages
        """
        async with db_registry.async_session() as session:
            return await AgentPassage.size_async(db_session=session, actor=actor, agent_id=agent_id)

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
        return await self.size_async(actor=actor, agent_id=agent_id) * GB_PER_EMBEDDING

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
