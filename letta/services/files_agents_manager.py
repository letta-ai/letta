from datetime import datetime, timezone
from typing import Dict, List, Optional, Union

from sqlalchemy import and_, delete, func, or_, select, update

from letta.log import get_logger
from letta.orm.errors import NoResultFound
from letta.orm.files_agents import FileAgent as FileAgentModel
from letta.otel.tracing import trace_method
from letta.schemas.block import Block as PydanticBlock, FileBlock as PydanticFileBlock
from letta.schemas.file import FileAgent as PydanticFileAgent, FileMetadata
from letta.schemas.user import User as PydanticUser
from letta.server.db import db_registry
from letta.utils import enforce_types

logger = get_logger(__name__)


class FileAgentManager:
    """High-level helpers for CRUD / listing on the `files_agents` join table."""

    @enforce_types
    @trace_method
    async def attach_file(
        self,
        *,
        agent_id: str,
        file_id: str,
        file_name: str,
        source_id: str,
        actor: PydanticUser,
        max_files_open: int,
        is_open: bool = True,
        visible_content: Optional[str] = None,
        start_line: Optional[int] = None,
        end_line: Optional[int] = None,
    ) -> tuple[PydanticFileAgent, List[str]]:
        """
        Idempotently attach *file_id* to *agent_id* with LRU enforcement.

        • If the row already exists → update `is_open`, `visible_content`
          and always refresh `last_accessed_at`.
        • Otherwise create a brand-new association.
        • If is_open=True, enforces max_files_open using LRU eviction.

        Returns:
            Tuple of (file_agent, closed_file_names)
        """
        if is_open:
            # Use the efficient LRU + open method
            closed_files, was_already_open, _ = await self.enforce_max_open_files_and_open(
                agent_id=agent_id,
                file_id=file_id,
                file_name=file_name,
                source_id=source_id,
                actor=actor,
                visible_content=visible_content or "",
                max_files_open=max_files_open,
                start_line=start_line,
                end_line=end_line,
            )

            # Get the updated file agent to return
            file_agent = await self.get_file_agent_by_id(agent_id=agent_id, file_id=file_id, actor=actor)
            return file_agent, closed_files
        else:
            # Original logic for is_open=False
            async with db_registry.async_session() as session:
                query = select(FileAgentModel).where(
                    and_(
                        FileAgentModel.agent_id == agent_id,
                        FileAgentModel.file_id == file_id,
                        FileAgentModel.file_name == file_name,
                        FileAgentModel.organization_id == actor.organization_id,
                    )
                )
                existing = await session.scalar(query)

                now_ts = datetime.now(timezone.utc)

                if existing:
                    # update only the fields that actually changed
                    if existing.is_open != is_open:
                        existing.is_open = is_open

                    if visible_content is not None and existing.visible_content != visible_content:
                        existing.visible_content = visible_content

                    existing.last_accessed_at = now_ts
                    existing.start_line = start_line
                    existing.end_line = end_line

                    await existing.update_async(session, actor=actor)
                    return existing.to_pydantic(), []

                assoc = FileAgentModel(
                    agent_id=agent_id,
                    file_id=file_id,
                    file_name=file_name,
                    source_id=source_id,
                    organization_id=actor.organization_id,
                    is_open=is_open,
                    visible_content=visible_content,
                    last_accessed_at=now_ts,
                    start_line=start_line,
                    end_line=end_line,
                )
                await assoc.create_async(session, actor=actor)
                return assoc.to_pydantic(), []

    @enforce_types
    @trace_method
    async def update_file_agent_by_id(
        self,
        *,
        agent_id: str,
        file_id: str,
        actor: PydanticUser,
        is_open: Optional[bool] = None,
        visible_content: Optional[str] = None,
        start_line: Optional[int] = None,
        end_line: Optional[int] = None,
    ) -> PydanticFileAgent:
        """Patch an existing association row."""
        async with db_registry.async_session() as session:
            assoc = await self._get_association_by_file_id(session, agent_id, file_id, actor)

            if is_open is not None:
                assoc.is_open = is_open
            if visible_content is not None:
                assoc.visible_content = visible_content
            if start_line is not None:
                assoc.start_line = start_line
            if end_line is not None:
                assoc.end_line = end_line

            # touch timestamp
            assoc.last_accessed_at = datetime.now(timezone.utc)

            await assoc.update_async(session, actor=actor)
            return assoc.to_pydantic()

    @enforce_types
    @trace_method
    async def update_file_agent_by_name(
        self,
        *,
        agent_id: str,
        file_name: str,
        actor: PydanticUser,
        is_open: Optional[bool] = None,
        visible_content: Optional[str] = None,
    ) -> PydanticFileAgent:
        """Patch an existing association row."""
        async with db_registry.async_session() as session:
            assoc = await self._get_association_by_file_name(session, agent_id, file_name, actor)

            if is_open is not None:
                assoc.is_open = is_open
            if visible_content is not None:
                assoc.visible_content = visible_content

            # touch timestamp
            assoc.last_accessed_at = datetime.now(timezone.utc)

            await assoc.update_async(session, actor=actor)
            return assoc.to_pydantic()

    @enforce_types
    @trace_method
    async def detach_file(self, *, agent_id: str, file_id: str, actor: PydanticUser) -> None:
        """Hard-delete the association."""
        async with db_registry.async_session() as session:
            assoc = await self._get_association_by_file_id(session, agent_id, file_id, actor)
            await assoc.hard_delete_async(session, actor=actor)

    @enforce_types
    @trace_method
    async def detach_file_bulk(self, *, agent_file_pairs: List, actor: PydanticUser) -> int:  # List of (agent_id, file_id) tuples
        """
        Bulk delete multiple agent-file associations in a single query.

        Args:
            agent_file_pairs: List of (agent_id, file_id) tuples to delete
            actor: User performing the action

        Returns:
            Number of rows deleted
        """
        if not agent_file_pairs:
            return 0

        async with db_registry.async_session() as session:
            # Build compound OR conditions for each agent-file pair
            conditions = []
            for agent_id, file_id in agent_file_pairs:
                conditions.append(and_(FileAgentModel.agent_id == agent_id, FileAgentModel.file_id == file_id))

            # Create delete statement with all conditions
            stmt = delete(FileAgentModel).where(and_(or_(*conditions), FileAgentModel.organization_id == actor.organization_id))

            result = await session.execute(stmt)
            await session.commit()

            return result.rowcount

    @enforce_types
    @trace_method
    async def get_file_agent_by_id(self, *, agent_id: str, file_id: str, actor: PydanticUser) -> Optional[PydanticFileAgent]:
        async with db_registry.async_session() as session:
            try:
                assoc = await self._get_association_by_file_id(session, agent_id, file_id, actor)
                return assoc.to_pydantic()
            except NoResultFound:
                return None

    @enforce_types
    @trace_method
    async def get_all_file_blocks_by_name(
        self,
        *,
        file_names: List[str],
        agent_id: str,
        per_file_view_window_char_limit: int,
        actor: PydanticUser,
    ) -> List[PydanticBlock]:
        """
        Retrieve multiple FileAgent associations by their file names for a specific agent.

        Args:
            file_names: List of file names to retrieve
            agent_id: ID of the agent to retrieve file blocks for
            per_file_view_window_char_limit: The per-file view window char limit
            actor: The user making the request

        Returns:
            List of PydanticBlock objects found (may be fewer than requested if some file names don't exist)
        """
        if not file_names:
            return []

        async with db_registry.async_session() as session:
            # Use IN clause for efficient bulk retrieval
            query = select(FileAgentModel).where(
                and_(
                    FileAgentModel.file_name.in_(file_names),
                    FileAgentModel.agent_id == agent_id,
                    FileAgentModel.organization_id == actor.organization_id,
                )
            )

            # Execute query and get all results
            rows = (await session.execute(query)).scalars().all()

            # Convert to Pydantic models
            return [row.to_pydantic_block(per_file_view_window_char_limit=per_file_view_window_char_limit) for row in rows]

    @enforce_types
    @trace_method
    async def get_file_agent_by_file_name(self, *, agent_id: str, file_name: str, actor: PydanticUser) -> Optional[PydanticFileAgent]:
        async with db_registry.async_session() as session:
            try:
                assoc = await self._get_association_by_file_name(session, agent_id, file_name, actor)
                return assoc.to_pydantic()
            except NoResultFound:
                return None

    @enforce_types
    @trace_method
    async def list_files_for_agent(
        self,
        agent_id: str,
        per_file_view_window_char_limit: int,
        actor: PydanticUser,
        is_open_only: bool = False,
        return_as_blocks: bool = False,
    ) -> Union[List[PydanticFileAgent], List[PydanticFileBlock]]:
        """Return associations for *agent_id* (filtering by `is_open` if asked)."""
        async with db_registry.async_session() as session:
            conditions = [
                FileAgentModel.agent_id == agent_id,
                FileAgentModel.organization_id == actor.organization_id,
            ]
            if is_open_only:
                conditions.append(FileAgentModel.is_open.is_(True))

            rows = (await session.execute(select(FileAgentModel).where(and_(*conditions)))).scalars().all()

            if return_as_blocks:
                return [r.to_pydantic_block(per_file_view_window_char_limit=per_file_view_window_char_limit) for r in rows]
            else:
                return [r.to_pydantic() for r in rows]

    @enforce_types
    @trace_method
    async def list_files_for_agent_paginated(
        self,
        agent_id: str,
        actor: PydanticUser,
        cursor: Optional[str] = None,
        limit: int = 20,
        is_open: Optional[bool] = None,
        before: Optional[str] = None,
        after: Optional[str] = None,
        ascending: bool = False,
    ) -> tuple[List[PydanticFileAgent], Optional[str], bool]:
        """
        Return paginated file associations for an agent.

        Args:
            agent_id: The agent ID to get files for
            actor: User performing the action
            cursor: Pagination cursor (file-agent ID to start after) - deprecated, use before/after
            limit: Maximum number of results to return
            is_open: Optional filter for open/closed status (None = all, True = open only, False = closed only)
            before: File-agent ID cursor for pagination. Returns files that come before this ID in the specified sort order
            after: File-agent ID cursor for pagination. Returns files that come after this ID in the specified sort order
            ascending: Sort order (True = ascending by created_at/id, False = descending)

        Returns:
            Tuple of (file_agents, next_cursor, has_more)
        """
        async with db_registry.async_session() as session:
            conditions = [
                FileAgentModel.agent_id == agent_id,
                FileAgentModel.organization_id == actor.organization_id,
                FileAgentModel.is_deleted == False,
            ]

            # apply is_open filter if specified
            if is_open is not None:
                conditions.append(FileAgentModel.is_open == is_open)

            # handle pagination cursors (support both old and new style)
            if before:
                conditions.append(FileAgentModel.id < before)
            elif after:
                conditions.append(FileAgentModel.id > after)
            elif cursor:
                # fallback to old cursor behavior for backwards compatibility
                conditions.append(FileAgentModel.id > cursor)

            query = select(FileAgentModel).where(and_(*conditions))

            # apply sorting based on pagination method
            if before or after:
                # For new cursor-based pagination, use created_at + id ordering
                if ascending:
                    query = query.order_by(FileAgentModel.created_at.asc(), FileAgentModel.id.asc())
                else:
                    query = query.order_by(FileAgentModel.created_at.desc(), FileAgentModel.id.desc())
            else:
                # For old cursor compatibility, maintain original behavior (ascending by ID)
                query = query.order_by(FileAgentModel.id)

            # fetch limit + 1 to check if there are more results
            query = query.limit(limit + 1)

            result = await session.execute(query)
            rows = result.scalars().all()

            # check if we got more records than requested (meaning there are more pages)
            has_more = len(rows) > limit
            if has_more:
                # trim back to the requested limit
                rows = rows[:limit]

            # get cursor for next page (ID of last item in current page)
            next_cursor = rows[-1].id if rows else None

            return [r.to_pydantic() for r in rows], next_cursor, has_more

    @enforce_types
    @trace_method
    async def list_agents_for_file(
        self,
        file_id: str,
        actor: PydanticUser,
        is_open_only: bool = False,
    ) -> List[PydanticFileAgent]:
        """Return associations for *file_id* (filtering by `is_open` if asked)."""
        async with db_registry.async_session() as session:
            conditions = [
                FileAgentModel.file_id == file_id,
                FileAgentModel.organization_id == actor.organization_id,
            ]
            if is_open_only:
                conditions.append(FileAgentModel.is_open.is_(True))

            rows = (await session.execute(select(FileAgentModel).where(and_(*conditions)))).scalars().all()
            return [r.to_pydantic() for r in rows]

    @enforce_types
    @trace_method
    async def mark_access(self, *, agent_id: str, file_id: str, actor: PydanticUser) -> None:
        """Update only `last_accessed_at = now()` without loading the row."""
        async with db_registry.async_session() as session:
            stmt = (
                update(FileAgentModel)
                .where(
                    FileAgentModel.agent_id == agent_id,
                    FileAgentModel.file_id == file_id,
                    FileAgentModel.organization_id == actor.organization_id,
                )
                .values(last_accessed_at=func.now())
            )
            await session.execute(stmt)
            await session.commit()

    @enforce_types
    @trace_method
    async def mark_access_bulk(self, *, agent_id: str, file_names: List[str], actor: PydanticUser) -> None:
        """Update `last_accessed_at = now()` for multiple files by name without loading rows."""
        if not file_names:
            return

        async with db_registry.async_session() as session:
            stmt = (
                update(FileAgentModel)
                .where(
                    FileAgentModel.agent_id == agent_id,
                    FileAgentModel.file_name.in_(file_names),
                    FileAgentModel.organization_id == actor.organization_id,
                )
                .values(last_accessed_at=func.now())
            )
            await session.execute(stmt)
            await session.commit()

    @enforce_types
    @trace_method
    async def close_all_other_files(self, *, agent_id: str, keep_file_names: List[str], actor: PydanticUser) -> List[str]:
        """Close every open file for this agent except those in keep_file_names.

        Args:
            agent_id: ID of the agent
            keep_file_names: List of file names to keep open
            actor: User performing the action

        Returns:
            List of file names that were closed
        """
        async with db_registry.async_session() as session:
            stmt = (
                update(FileAgentModel)
                .where(
                    and_(
                        FileAgentModel.agent_id == agent_id,
                        FileAgentModel.organization_id == actor.organization_id,
                        FileAgentModel.is_open.is_(True),
                        # Only add the NOT IN filter when there are names to keep
                        ~FileAgentModel.file_name.in_(keep_file_names) if keep_file_names else True,
                    )
                )
                .values(is_open=False, visible_content=None)
                .returning(FileAgentModel.file_name)  # Gets the names we closed
                .execution_options(synchronize_session=False)  # No need to sync ORM state
            )

            closed_file_names = [row.file_name for row in (await session.execute(stmt))]
            await session.commit()
            return closed_file_names

    @enforce_types
    @trace_method
    async def enforce_max_open_files_and_open(
        self,
        *,
        agent_id: str,
        file_id: str,
        file_name: str,
        source_id: str,
        actor: PydanticUser,
        visible_content: str,
        max_files_open: int,
        start_line: Optional[int] = None,
        end_line: Optional[int] = None,
    ) -> tuple[List[str], bool, Dict[str, tuple[Optional[int], Optional[int]]]]:
        """
        Efficiently handle LRU eviction and file opening in a single transaction.

        Args:
            agent_id: ID of the agent
            file_id: ID of the file to open
            file_name: Name of the file to open
            source_id: ID of the source
            actor: User performing the action
            visible_content: Content to set for the opened file

        Returns:
            Tuple of (closed_file_names, file_was_already_open, previous_ranges)
            where previous_ranges maps file names to their old (start_line, end_line) ranges
        """
        async with db_registry.async_session() as session:
            # Single query to get ALL open files for this agent, ordered by last_accessed_at (oldest first)
            open_files_query = (
                select(FileAgentModel)
                .where(
                    and_(
                        FileAgentModel.agent_id == agent_id,
                        FileAgentModel.organization_id == actor.organization_id,
                        FileAgentModel.is_open.is_(True),
                    )
                )
                .order_by(FileAgentModel.last_accessed_at.asc())  # Oldest first for LRU
            )

            all_open_files = (await session.execute(open_files_query)).scalars().all()

            # Check if the target file exists (open or closed)
            target_file_query = select(FileAgentModel).where(
                and_(
                    FileAgentModel.agent_id == agent_id,
                    FileAgentModel.organization_id == actor.organization_id,
                    FileAgentModel.file_name == file_name,
                )
            )
            file_to_open = await session.scalar(target_file_query)

            # Separate the file we're opening from others (only if it's currently open)
            other_open_files = []
            for file_agent in all_open_files:
                if file_agent.file_name != file_name:
                    other_open_files.append(file_agent)

            file_was_already_open = file_to_open is not None and file_to_open.is_open

            # Capture previous line range if file was already open and we're changing the range
            previous_ranges = {}
            if file_was_already_open and file_to_open:
                old_start = file_to_open.start_line
                old_end = file_to_open.end_line
                # Only record if there was a previous range or if we're setting a new range
                if old_start is not None or old_end is not None or start_line is not None or end_line is not None:
                    # Only record if the range is actually changing
                    if old_start != start_line or old_end != end_line:
                        previous_ranges[file_name] = (old_start, old_end)

            # Calculate how many files need to be closed
            current_other_count = len(other_open_files)
            target_other_count = max_files_open - 1  # Reserve 1 slot for file we're opening

            closed_file_names = []
            if current_other_count > target_other_count:
                files_to_close_count = current_other_count - target_other_count
                files_to_close = other_open_files[:files_to_close_count]  # Take oldest

                # Bulk close files using a single UPDATE query
                file_ids_to_close = [f.file_id for f in files_to_close]
                closed_file_names = [f.file_name for f in files_to_close]

                if file_ids_to_close:
                    close_stmt = (
                        update(FileAgentModel)
                        .where(
                            and_(
                                FileAgentModel.agent_id == agent_id,
                                FileAgentModel.file_id.in_(file_ids_to_close),
                                FileAgentModel.organization_id == actor.organization_id,
                            )
                        )
                        .values(is_open=False, visible_content=None)
                    )
                    await session.execute(close_stmt)

            # Open the target file (update or create)
            now_ts = datetime.now(timezone.utc)

            if file_to_open:
                # Update existing file
                file_to_open.is_open = True
                file_to_open.visible_content = visible_content
                file_to_open.last_accessed_at = now_ts
                file_to_open.start_line = start_line
                file_to_open.end_line = end_line
                await file_to_open.update_async(session, actor=actor)
            else:
                # Create new file association
                new_file_agent = FileAgentModel(
                    agent_id=agent_id,
                    file_id=file_id,
                    file_name=file_name,
                    source_id=source_id,
                    organization_id=actor.organization_id,
                    is_open=True,
                    visible_content=visible_content,
                    last_accessed_at=now_ts,
                    start_line=start_line,
                    end_line=end_line,
                )
                await new_file_agent.create_async(session, actor=actor)

            return closed_file_names, file_was_already_open, previous_ranges

    @enforce_types
    @trace_method
    async def attach_files_bulk(
        self,
        *,
        agent_id: str,
        files_metadata: list[FileMetadata],
        max_files_open: int,
        visible_content_map: Optional[dict[str, str]] = None,
        actor: PydanticUser,
    ) -> list[str]:
        """Atomically attach many files, applying an LRU cap with one commit."""
        if not files_metadata:
            return []

        # TODO: This is not strictly necessary, as the file_metadata should never be duped
        # TODO: But we have this as a protection, check logs for details
        # dedupe while preserving caller order
        seen: set[str] = set()
        ordered_unique: list[FileMetadata] = []
        for m in files_metadata:
            if m.file_name not in seen:
                ordered_unique.append(m)
                seen.add(m.file_name)
        if (dup_cnt := len(files_metadata) - len(ordered_unique)) > 0:
            logger.warning(
                "attach_files_bulk: removed %d duplicate file(s) for agent %s",
                dup_cnt,
                agent_id,
            )

        now = datetime.now(timezone.utc)
        vc_for = visible_content_map or {}

        async with db_registry.async_session() as session:
            # fetch existing assoc rows for requested names
            existing_q = select(FileAgentModel).where(
                FileAgentModel.agent_id == agent_id,
                FileAgentModel.organization_id == actor.organization_id,
                FileAgentModel.file_name.in_(seen),
            )
            existing_rows = (await session.execute(existing_q)).scalars().all()
            existing_by_name = {r.file_name: r for r in existing_rows}

            # snapshot current OPEN rows (oldest first)
            open_q = (
                select(FileAgentModel)
                .where(
                    FileAgentModel.agent_id == agent_id,
                    FileAgentModel.organization_id == actor.organization_id,
                    FileAgentModel.is_open.is_(True),
                )
                .order_by(FileAgentModel.last_accessed_at.asc())
            )
            currently_open = (await session.execute(open_q)).scalars().all()

            new_names = [m.file_name for m in ordered_unique]
            new_names_set = set(new_names)
            still_open_names = [r.file_name for r in currently_open if r.file_name not in new_names_set]

            # decide final open set
            if len(new_names) >= max_files_open:
                final_open = new_names[:max_files_open]
            else:
                room_for_old = max_files_open - len(new_names)
                final_open = new_names + still_open_names[-room_for_old:]
            final_open_set = set(final_open)

            closed_file_names = [r.file_name for r in currently_open if r.file_name not in final_open_set]
            # Add new files that won't be opened due to max_files_open limit
            if len(new_names) >= max_files_open:
                closed_file_names.extend(new_names[max_files_open:])
            evicted_ids = [r.file_id for r in currently_open if r.file_name in closed_file_names]

            # upsert requested files
            for meta in ordered_unique:
                is_now_open = meta.file_name in final_open_set
                vc = vc_for.get(meta.file_name, "") if is_now_open else None

                if row := existing_by_name.get(meta.file_name):
                    row.is_open = is_now_open
                    row.visible_content = vc
                    row.last_accessed_at = now
                    session.add(row)  # already present, but safe
                else:
                    session.add(
                        FileAgentModel(
                            agent_id=agent_id,
                            file_id=meta.id,
                            file_name=meta.file_name,
                            source_id=meta.source_id,
                            organization_id=actor.organization_id,
                            is_open=is_now_open,
                            visible_content=vc,
                            last_accessed_at=now,
                        )
                    )

            # bulk-close evicted rows
            if evicted_ids:
                await session.execute(
                    update(FileAgentModel)
                    .where(
                        FileAgentModel.agent_id == agent_id,
                        FileAgentModel.organization_id == actor.organization_id,
                        FileAgentModel.file_id.in_(evicted_ids),
                    )
                    .values(is_open=False, visible_content=None)
                )

            await session.commit()
            return closed_file_names

    async def _get_association_by_file_id(self, session, agent_id: str, file_id: str, actor: PydanticUser) -> FileAgentModel:
        q = select(FileAgentModel).where(
            and_(
                FileAgentModel.agent_id == agent_id,
                FileAgentModel.file_id == file_id,
                FileAgentModel.organization_id == actor.organization_id,
            )
        )
        assoc = await session.scalar(q)
        if not assoc:
            raise NoResultFound(f"FileAgent(agent_id={agent_id}, file_id={file_id}) not found in org {actor.organization_id}")
        return assoc

    async def _get_association_by_file_name(self, session, agent_id: str, file_name: str, actor: PydanticUser) -> FileAgentModel:
        q = select(FileAgentModel).where(
            and_(
                FileAgentModel.agent_id == agent_id,
                FileAgentModel.file_name == file_name,
                FileAgentModel.organization_id == actor.organization_id,
            )
        )
        assoc = await session.scalar(q)
        if not assoc:
            raise NoResultFound(f"FileAgent(agent_id={agent_id}, file_name={file_name}) not found in org {actor.organization_id}")
        return assoc
