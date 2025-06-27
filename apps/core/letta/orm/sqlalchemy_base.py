import inspect
from datetime import datetime
from enum import Enum
from functools import wraps
from pprint import pformat
from typing import TYPE_CHECKING, List, Literal, Optional, Tuple, Union

from sqlalchemy import Sequence, String, and_, delete, func, or_, select, text
from sqlalchemy.exc import DBAPIError, IntegrityError, TimeoutError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, Session, mapped_column
from sqlalchemy.orm.interfaces import ORMOption

from letta.log import get_logger
from letta.orm.base import Base, CommonSqlalchemyMetaMixins
from letta.orm.errors import DatabaseTimeoutError, ForeignKeyConstraintViolationError, NoResultFound, UniqueConstraintViolationError
from letta.orm.sqlite_functions import adapt_array

if TYPE_CHECKING:
    from pydantic import BaseModel


logger = get_logger(__name__)


def handle_db_timeout(func):
    """Decorator to handle SQLAlchemy TimeoutError and wrap it in a custom exception."""
    if not inspect.iscoroutinefunction(func):

        @wraps(func)
        def wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except TimeoutError as e:
                logger.error(f"Timeout while executing {func.__name__} with args {args} and kwargs {kwargs}: {e}")
                raise DatabaseTimeoutError(message=f"Timeout occurred in {func.__name__}.", original_exception=e)

        return wrapper
    else:

        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except TimeoutError as e:
                logger.error(f"Timeout while executing {func.__name__} with args {args} and kwargs {kwargs}: {e}")
                raise DatabaseTimeoutError(message=f"Timeout occurred in {func.__name__}.", original_exception=e)

        return async_wrapper


def is_postgresql_session(session: Session) -> bool:
    """Check if the database session is PostgreSQL instead of SQLite for setting query options."""
    return session.bind.dialect.name == "postgresql"


class AccessType(str, Enum):
    ORGANIZATION = "organization"
    USER = "user"


class SqlalchemyBase(CommonSqlalchemyMetaMixins, Base):
    __abstract__ = True

    __order_by_default__ = "created_at"

    id: Mapped[str] = mapped_column(String, primary_key=True)

    @classmethod
    @handle_db_timeout
    def list(
        cls,
        *,
        db_session: "Session",
        before: Optional[str] = None,
        after: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: Optional[int] = 50,
        query_text: Optional[str] = None,
        query_embedding: Optional[List[float]] = None,
        ascending: bool = True,
        actor: Optional["User"] = None,
        access: Optional[List[Literal["read", "write", "admin"]]] = ["read"],
        access_type: AccessType = AccessType.ORGANIZATION,
        join_model: Optional[Base] = None,
        join_conditions: Optional[Union[Tuple, List]] = None,
        identifier_keys: Optional[List[str]] = None,
        identity_id: Optional[str] = None,
        **kwargs,
    ) -> List["SqlalchemyBase"]:
        """
        List records with before/after pagination, ordering by created_at.
        Can use both before and after to fetch a window of records.

        Args:
            db_session: SQLAlchemy session
            before: ID of item to paginate before (upper bound)
            after: ID of item to paginate after (lower bound)
            start_date: Filter items after this date
            end_date: Filter items before this date
            limit: Maximum number of items to return
            query_text: Text to search for
            query_embedding: Vector to search for similar embeddings
            ascending: Sort direction
            **kwargs: Additional filters to apply
        """
        if start_date and end_date and start_date > end_date:
            raise ValueError("start_date must be earlier than or equal to end_date")

        logger.debug(f"Listing {cls.__name__} with kwarg filters {kwargs}")

        with db_session as session:
            # Get the reference objects for pagination
            before_obj = None
            after_obj = None

            if before:
                before_obj = session.get(cls, before)
                if not before_obj:
                    raise NoResultFound(f"No {cls.__name__} found with id {before}")

            if after:
                after_obj = session.get(cls, after)
                if not after_obj:
                    raise NoResultFound(f"No {cls.__name__} found with id {after}")

            # Validate that before comes after the after object if both are provided
            if before_obj and after_obj and before_obj.created_at < after_obj.created_at:
                raise ValueError("'before' reference must be later than 'after' reference")

            query = cls._list_preprocess(
                before_obj=before_obj,
                after_obj=after_obj,
                start_date=start_date,
                end_date=end_date,
                limit=limit,
                query_text=query_text,
                query_embedding=query_embedding,
                ascending=ascending,
                actor=actor,
                access=access,
                access_type=access_type,
                join_model=join_model,
                join_conditions=join_conditions,
                identifier_keys=identifier_keys,
                identity_id=identity_id,
                **kwargs,
            )

            # Execute the query
            results = session.execute(query)

            results = list(results.scalars())
            results = cls._list_postprocess(
                before=before,
                after=after,
                limit=limit,
                results=results,
            )

            return results

    @classmethod
    @handle_db_timeout
    async def list_async(
        cls,
        *,
        db_session: "AsyncSession",
        before: Optional[str] = None,
        after: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: Optional[int] = 50,
        query_text: Optional[str] = None,
        query_embedding: Optional[List[float]] = None,
        ascending: bool = True,
        actor: Optional["User"] = None,
        access: Optional[List[Literal["read", "write", "admin"]]] = ["read"],
        access_type: AccessType = AccessType.ORGANIZATION,
        join_model: Optional[Base] = None,
        join_conditions: Optional[Union[Tuple, List]] = None,
        identifier_keys: Optional[List[str]] = None,
        identity_id: Optional[str] = None,
        query_options: Sequence[ORMOption] | None = None,  # ← new
        has_feedback: Optional[bool] = None,
        **kwargs,
    ) -> List["SqlalchemyBase"]:
        """
        Async version of list method above.
        NOTE: Keep in sync.
        List records with before/after pagination, ordering by created_at.
        Can use both before and after to fetch a window of records.

        Args:
            db_session: SQLAlchemy session
            before: ID of item to paginate before (upper bound)
            after: ID of item to paginate after (lower bound)
            start_date: Filter items after this date
            end_date: Filter items before this date
            limit: Maximum number of items to return
            query_text: Text to search for
            query_embedding: Vector to search for similar embeddings
            ascending: Sort direction
            **kwargs: Additional filters to apply
        """
        if start_date and end_date and start_date > end_date:
            raise ValueError("start_date must be earlier than or equal to end_date")

        logger.debug(f"Listing {cls.__name__} with kwarg filters {kwargs}")

        # Get the reference objects for pagination
        before_obj = None
        after_obj = None

        if before:
            before_obj = await db_session.get(cls, before)
            if not before_obj:
                raise NoResultFound(f"No {cls.__name__} found with id {before}")

        if after:
            after_obj = await db_session.get(cls, after)
            if not after_obj:
                raise NoResultFound(f"No {cls.__name__} found with id {after}")

        # Validate that before comes after the after object if both are provided
        if before_obj and after_obj and before_obj.created_at < after_obj.created_at:
            raise ValueError("'before' reference must be later than 'after' reference")

        query = cls._list_preprocess(
            before_obj=before_obj,
            after_obj=after_obj,
            start_date=start_date,
            end_date=end_date,
            limit=limit,
            query_text=query_text,
            query_embedding=query_embedding,
            ascending=ascending,
            actor=actor,
            access=access,
            access_type=access_type,
            join_model=join_model,
            join_conditions=join_conditions,
            identifier_keys=identifier_keys,
            identity_id=identity_id,
            has_feedback=has_feedback,
            **kwargs,
        )
        if query_options:
            for opt in query_options:
                query = query.options(opt)

        # Execute the query
        results = await db_session.execute(query)

        results = list(results.scalars())
        results = cls._list_postprocess(
            before=before,
            after=after,
            limit=limit,
            results=results,
        )

        return results

    @classmethod
    def _list_preprocess(
        cls,
        *,
        before_obj,
        after_obj,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: Optional[int] = 50,
        query_text: Optional[str] = None,
        query_embedding: Optional[List[float]] = None,
        ascending: bool = True,
        actor: Optional["User"] = None,
        access: Optional[List[Literal["read", "write", "admin"]]] = ["read"],
        access_type: AccessType = AccessType.ORGANIZATION,
        join_model: Optional[Base] = None,
        join_conditions: Optional[Union[Tuple, List]] = None,
        identifier_keys: Optional[List[str]] = None,
        identity_id: Optional[str] = None,
        check_is_deleted: bool = False,
        has_feedback: Optional[bool] = None,
        **kwargs,
    ):
        """
        Constructs the query for listing records.
        """
        query = select(cls)

        if join_model and join_conditions:
            query = query.join(join_model, and_(*join_conditions))

        # Apply access predicate if actor is provided
        if actor:
            query = cls.apply_access_predicate(query, actor, access, access_type)

        if identifier_keys and hasattr(cls, "identities"):
            query = query.join(cls.identities).filter(cls.identities.property.mapper.class_.identifier_key.in_(identifier_keys))

        # given the identity_id, we can find within the agents table any agents that have the identity_id in their identity_ids
        if identity_id and hasattr(cls, "identities"):
            query = query.join(cls.identities).filter(cls.identities.property.mapper.class_.id == identity_id)

        # Apply filtering logic from kwargs
        # 1 part: <column> // 2 parts: <table>.<column> OR <column>.<json_key> // 3 parts: <table>.<column>.<json_key>
        # TODO (cliandy): can make this more robust down the line
        for key, value in kwargs.items():
            parts = key.split(".")
            if len(parts) == 1:
                column = getattr(cls, key)
            elif len(parts) == 2:
                if locals().get(parts[0]) or globals().get(parts[0]):
                    # It's a joined table column
                    joined_table = locals().get(parts[0]) or globals().get(parts[0])
                    column = getattr(joined_table, parts[1])
                else:
                    # It's a JSON field on the main table
                    column = getattr(cls, parts[0])
                    column = column.op("->>")(parts[1])
            elif len(parts) == 3:
                table_name, column_name, json_key = parts
                joined_table = locals().get(table_name) or globals().get(table_name)
                column = getattr(joined_table, column_name)
                column = column.op("->>")(json_key)
            else:
                raise ValueError(f"Unhandled column name {key}")

            if isinstance(value, (list, tuple, set)):
                query = query.where(column.in_(value))
            else:
                query = query.where(column == value)

        # Date range filtering
        if start_date:
            query = query.filter(cls.created_at > start_date)
        if end_date:
            query = query.filter(cls.created_at < end_date)

        # Feedback filtering
        if has_feedback is not None and hasattr(cls, "feedback"):
            if has_feedback:
                query = query.filter(cls.feedback.isnot(None))
            else:
                query = query.filter(cls.feedback.is_(None))

        # Handle pagination based on before/after
        if before_obj or after_obj:
            conditions = []

            if before_obj and after_obj:
                # Window-based query - get records between before and after
                conditions = [
                    or_(cls.created_at < before_obj.created_at, and_(cls.created_at == before_obj.created_at, cls.id < before_obj.id)),
                    or_(cls.created_at > after_obj.created_at, and_(cls.created_at == after_obj.created_at, cls.id > after_obj.id)),
                ]
            else:
                # Pure pagination query
                if before_obj:
                    conditions.append(
                        or_(
                            cls.created_at < before_obj.created_at,
                            and_(cls.created_at == before_obj.created_at, cls.id < before_obj.id),
                        )
                    )
                if after_obj:
                    conditions.append(
                        or_(
                            cls.created_at > after_obj.created_at,
                            and_(cls.created_at == after_obj.created_at, cls.id > after_obj.id),
                        )
                    )

            if conditions:
                query = query.where(and_(*conditions))

        # Text search
        if query_text:
            if hasattr(cls, "text"):
                query = query.filter(func.lower(cls.text).contains(func.lower(query_text)))
            elif hasattr(cls, "name"):
                # Special case for Agent model - search across name
                query = query.filter(func.lower(cls.name).contains(func.lower(query_text)))

        # Embedding search (for Passages)
        is_ordered = False
        if query_embedding:
            if not hasattr(cls, "embedding"):
                raise ValueError(f"Class {cls.__name__} does not have an embedding column")

            from letta.settings import settings

            if settings.letta_pg_uri_no_default:
                # PostgreSQL with pgvector
                query = query.order_by(cls.embedding.cosine_distance(query_embedding).asc())
            else:
                # SQLite with custom vector type
                query_embedding_binary = adapt_array(query_embedding)
                query = query.order_by(
                    func.cosine_distance(cls.embedding, query_embedding_binary).asc(),
                    cls.created_at.asc() if ascending else cls.created_at.desc(),
                    cls.id.asc(),
                )
                is_ordered = True

        # Handle soft deletes
        if check_is_deleted and hasattr(cls, "is_deleted"):
            query = query.where(cls.is_deleted == False)

        # Apply ordering
        if not is_ordered:
            if ascending:
                query = query.order_by(cls.created_at.asc(), cls.id.asc())
            else:
                query = query.order_by(cls.created_at.desc(), cls.id.desc())

        # Apply limit, adjusting for both bounds if necessary
        if before_obj and after_obj:
            # When both bounds are provided, we need to fetch enough records to satisfy
            # the limit while respecting both bounds. We'll fetch more and then trim.
            query = query.limit(limit * 2)
        else:
            query = query.limit(limit)
        return query

    @classmethod
    def _list_postprocess(
        cls,
        before: str | None,
        after: str | None,
        limit: int | None,
        results: list,
    ):
        # If we have both bounds, take the middle portion
        if before and after and len(results) > limit:
            middle = len(results) // 2
            start = max(0, middle - limit // 2)
            end = min(len(results), start + limit)
            results = results[start:end]
        return results

    @classmethod
    @handle_db_timeout
    def read(
        cls,
        db_session: "Session",
        identifier: Optional[str] = None,
        actor: Optional["User"] = None,
        access: Optional[List[Literal["read", "write", "admin"]]] = ["read"],
        access_type: AccessType = AccessType.ORGANIZATION,
        check_is_deleted: bool = False,
        **kwargs,
    ) -> "SqlalchemyBase":
        """The primary accessor for an ORM record.
        Args:
            db_session: the database session to use when retrieving the record
            identifier: the identifier of the record to read, can be the id string or the UUID object for backwards compatibility
            actor: if specified, results will be scoped only to records the user is able to access
            access: if actor is specified, records will be filtered to the minimum permission level for the actor
            kwargs: additional arguments to pass to the read, used for more complex objects
        Returns:
            The matching object
        Raises:
            NoResultFound: if the object is not found
        """
        # this is ok because read_multiple will check if the
        identifiers = [] if identifier is None else [identifier]
        found = cls.read_multiple(db_session, identifiers, actor, access, access_type, check_is_deleted, **kwargs)
        if len(found) == 0:
            # for backwards compatibility.
            conditions = []
            if identifier:
                conditions.append(f"id={identifier}")
            if actor:
                conditions.append(f"access level in {access} for {actor}")
            if check_is_deleted and hasattr(cls, "is_deleted"):
                conditions.append("is_deleted=False")
            raise NoResultFound(f"{cls.__name__} not found with {', '.join(conditions if conditions else ['no conditions'])}")
        return found[0]

    @classmethod
    @handle_db_timeout
    async def read_async(
        cls,
        db_session: "AsyncSession",
        identifier: Optional[str] = None,
        actor: Optional["User"] = None,
        access: Optional[List[Literal["read", "write", "admin"]]] = ["read"],
        access_type: AccessType = AccessType.ORGANIZATION,
        check_is_deleted: bool = False,
        **kwargs,
    ) -> "SqlalchemyBase":
        """The primary accessor for an ORM record. Async version of read method.
        Args:
            db_session: the database session to use when retrieving the record
            identifier: the identifier of the record to read, can be the id string or the UUID object for backwards compatibility
            actor: if specified, results will be scoped only to records the user is able to access
            access: if actor is specified, records will be filtered to the minimum permission level for the actor
            kwargs: additional arguments to pass to the read, used for more complex objects
        Returns:
            The matching object
        Raises:
            NoResultFound: if the object is not found
        """
        identifiers = [] if identifier is None else [identifier]
        query, query_conditions = cls._read_multiple_preprocess(identifiers, actor, access, access_type, check_is_deleted, **kwargs)
        if query is None:
            raise NoResultFound(f"{cls.__name__} not found with identifier {identifier}")
        if is_postgresql_session(db_session):
            await db_session.execute(text("SET LOCAL enable_seqscan = OFF"))
        try:
            result = await db_session.execute(query)
            item = result.scalar_one_or_none()
        finally:
            if is_postgresql_session(db_session):
                await db_session.execute(text("SET LOCAL enable_seqscan = ON"))

        if item is None:
            raise NoResultFound(f"{cls.__name__} not found with {', '.join(query_conditions if query_conditions else ['no conditions'])}")
        return item

    @classmethod
    @handle_db_timeout
    def read_multiple(
        cls,
        db_session: "Session",
        identifiers: List[str] = [],
        actor: Optional["User"] = None,
        access: Optional[List[Literal["read", "write", "admin"]]] = ["read"],
        access_type: AccessType = AccessType.ORGANIZATION,
        check_is_deleted: bool = False,
        **kwargs,
    ) -> List["SqlalchemyBase"]:
        """The primary accessor for ORM record(s)
        Args:
            db_session: the database session to use when retrieving the record
            identifiers: a list of identifiers of the records to read, can be the id string or the UUID object for backwards compatibility
            actor: if specified, results will be scoped only to records the user is able to access
            access: if actor is specified, records will be filtered to the minimum permission level for the actor
            kwargs: additional arguments to pass to the read, used for more complex objects
        Returns:
            The matching object
        Raises:
            NoResultFound: if the object is not found
        """
        query, query_conditions = cls._read_multiple_preprocess(identifiers, actor, access, access_type, check_is_deleted, **kwargs)
        if query is None:
            return []
        results = db_session.execute(query).scalars().all()
        return cls._read_multiple_postprocess(results, identifiers, query_conditions)

    @classmethod
    @handle_db_timeout
    async def read_multiple_async(
        cls,
        db_session: "AsyncSession",
        identifiers: List[str] = [],
        actor: Optional["User"] = None,
        access: Optional[List[Literal["read", "write", "admin"]]] = ["read"],
        access_type: AccessType = AccessType.ORGANIZATION,
        check_is_deleted: bool = False,
        **kwargs,
    ) -> List["SqlalchemyBase"]:
        """
        Async version of read_multiple(...)
        The primary accessor for ORM record(s)
        """
        query, query_conditions = cls._read_multiple_preprocess(identifiers, actor, access, access_type, check_is_deleted, **kwargs)
        if query is None:
            return []
        results = await db_session.execute(query)
        return cls._read_multiple_postprocess(results.scalars().all(), identifiers, query_conditions)

    @classmethod
    def _read_multiple_preprocess(
        cls,
        identifiers: List[str],
        actor: Optional["User"],
        access: Optional[List[Literal["read", "write", "admin"]]],
        access_type: AccessType,
        check_is_deleted: bool,
        **kwargs,
    ):
        logger.debug(f"Reading {cls.__name__} with ID(s): {identifiers} with actor={actor}")

        # Start the query
        query = select(cls)
        # Collect query conditions for better error reporting
        query_conditions = []

        # If an identifier is provided, add it to the query conditions
        if identifiers:
            if len(identifiers) == 1:
                query = query.where(cls.id == identifiers[0])
            else:
                query = query.where(cls.id.in_(identifiers))
            query_conditions.append(f"id='{identifiers}'")
        elif not kwargs:
            logger.debug(f"No identifiers provided for {cls.__name__}, returning empty list")
            return None, query_conditions

        if kwargs:
            query = query.filter_by(**kwargs)
            query_conditions.append(", ".join(f"{key}='{value}'" for key, value in kwargs.items()))

        if actor:
            query = cls.apply_access_predicate(query, actor, access, access_type)
            query_conditions.append(f"access level in {access} for actor='{actor}'")

        if check_is_deleted and hasattr(cls, "is_deleted"):
            query = query.where(cls.is_deleted == False)
            query_conditions.append("is_deleted=False")

        return query, query_conditions

    @classmethod
    def _read_multiple_postprocess(cls, results, identifiers: List[str], query_conditions) -> List["SqlalchemyBase"]:
        if results:  # if empty list a.k.a. no results
            if len(identifiers) > 0:
                # find which identifiers were not found
                # only when identifier length is greater than 0 (so it was used in the actual query)
                identifier_set = set(identifiers)
                results_set = set(map(lambda obj: obj.id, results))

                # we log a warning message if any of the queried IDs were not found.
                # TODO: should we error out instead?
                if identifier_set != results_set:
                    # Construct a detailed error message based on query conditions
                    conditions_str = ", ".join(query_conditions) if query_conditions else "no specific conditions"
                    logger.debug(f"{cls.__name__} not found with {conditions_str}. Queried ids: {identifier_set}, Found ids: {results_set}")
            return results

        # Construct a detailed error message based on query conditions
        conditions_str = ", ".join(query_conditions) if query_conditions else "no specific conditions"
        logger.debug(f"{cls.__name__} not found with {conditions_str}")
        return []

    @handle_db_timeout
    def create(self, db_session: "Session", actor: Optional["User"] = None, no_commit: bool = False) -> "SqlalchemyBase":
        logger.debug(f"Creating {self.__class__.__name__} with ID: {self.id} with actor={actor}")

        if actor:
            self._set_created_and_updated_by_fields(actor.id)
        try:
            db_session.add(self)
            if no_commit:
                db_session.flush()  # no commit, just flush to get PK
            else:
                db_session.commit()
            db_session.refresh(self)
            return self
        except (DBAPIError, IntegrityError) as e:
            self._handle_dbapi_error(e)

    @handle_db_timeout
    async def create_async(self, db_session: "AsyncSession", actor: Optional["User"] = None, no_commit: bool = False) -> "SqlalchemyBase":
        """Async version of create function"""
        logger.debug(f"Creating {self.__class__.__name__} with ID: {self.id} with actor={actor}")

        if actor:
            self._set_created_and_updated_by_fields(actor.id)
        try:
            db_session.add(self)
            if no_commit:
                await db_session.flush()  # no commit, just flush to get PK
            else:
                await db_session.commit()
            await db_session.refresh(self)
            return self
        except (DBAPIError, IntegrityError) as e:
            self._handle_dbapi_error(e)

    @classmethod
    @handle_db_timeout
    def batch_create(cls, items: List["SqlalchemyBase"], db_session: "Session", actor: Optional["User"] = None) -> List["SqlalchemyBase"]:
        """
        Create multiple records in a single transaction for better performance.
        Args:
            items: List of model instances to create
            db_session: SQLAlchemy session
            actor: Optional user performing the action
        Returns:
            List of created model instances
        """
        logger.debug(f"Batch creating {len(items)} {cls.__name__} items with actor={actor}")
        if not items:
            return []

        # Set created/updated by fields if actor is provided
        if actor:
            for item in items:
                item._set_created_and_updated_by_fields(actor.id)

        try:
            with db_session as session:
                session.add_all(items)
                session.flush()  # Flush to generate IDs but don't commit yet

                # Collect IDs to fetch the complete objects after commit
                item_ids = [item.id for item in items]

                session.commit()

                # Re-query the objects to get them with relationships loaded
                query = select(cls).where(cls.id.in_(item_ids))
                if hasattr(cls, "created_at"):
                    query = query.order_by(cls.created_at)

                return list(session.execute(query).scalars())

        except (DBAPIError, IntegrityError) as e:
            cls._handle_dbapi_error(e)

    @classmethod
    @handle_db_timeout
    async def batch_create_async(
        cls, items: List["SqlalchemyBase"], db_session: "AsyncSession", actor: Optional["User"] = None
    ) -> List["SqlalchemyBase"]:
        """
        Async version of batch_create method.
        Create multiple records in a single transaction for better performance.
        Args:
            items: List of model instances to create
            db_session: AsyncSession session
            actor: Optional user performing the action
        Returns:
            List of created model instances
        """
        logger.debug(f"Async batch creating {len(items)} {cls.__name__} items with actor={actor}")
        if not items:
            return []

        # Set created/updated by fields if actor is provided
        if actor:
            for item in items:
                item._set_created_and_updated_by_fields(actor.id)

        try:
            db_session.add_all(items)
            await db_session.flush()  # Flush to generate IDs but don't commit yet

            # Collect IDs to fetch the complete objects after commit
            item_ids = [item.id for item in items]

            await db_session.commit()

            # Re-query the objects to get them with relationships loaded
            query = select(cls).where(cls.id.in_(item_ids))
            if hasattr(cls, "created_at"):
                query = query.order_by(cls.created_at)

            result = await db_session.execute(query)
            return list(result.scalars())

        except (DBAPIError, IntegrityError) as e:
            cls._handle_dbapi_error(e)

    @handle_db_timeout
    def delete(self, db_session: "Session", actor: Optional["User"] = None) -> "SqlalchemyBase":
        logger.debug(f"Soft deleting {self.__class__.__name__} with ID: {self.id} with actor={actor}")

        if actor:
            self._set_created_and_updated_by_fields(actor.id)

        self.is_deleted = True
        return self.update(db_session)

    @handle_db_timeout
    async def delete_async(self, db_session: "AsyncSession", actor: Optional["User"] = None) -> "SqlalchemyBase":
        """Soft delete a record asynchronously (mark as deleted)."""
        logger.debug(f"Soft deleting {self.__class__.__name__} with ID: {self.id} with actor={actor} (async)")

        if actor:
            self._set_created_and_updated_by_fields(actor.id)

        self.is_deleted = True
        return await self.update_async(db_session)

    @handle_db_timeout
    def hard_delete(self, db_session: "Session", actor: Optional["User"] = None) -> None:
        """Permanently removes the record from the database."""
        logger.debug(f"Hard deleting {self.__class__.__name__} with ID: {self.id} with actor={actor}")

        with db_session as session:
            try:
                session.delete(self)
                session.commit()
            except Exception as e:
                session.rollback()
                logger.exception(f"Failed to hard delete {self.__class__.__name__} with ID {self.id}")
                raise ValueError(f"Failed to hard delete {self.__class__.__name__} with ID {self.id}: {e}")
            else:
                logger.debug(f"{self.__class__.__name__} with ID {self.id} successfully hard deleted")

    @handle_db_timeout
    async def hard_delete_async(self, db_session: "AsyncSession", actor: Optional["User"] = None) -> None:
        """Permanently removes the record from the database asynchronously."""
        logger.debug(f"Hard deleting {self.__class__.__name__} with ID: {self.id} with actor={actor} (async)")

        try:
            await db_session.delete(self)
            await db_session.commit()
        except Exception as e:
            await db_session.rollback()
            logger.exception(f"Failed to hard delete {self.__class__.__name__} with ID {self.id}")
            raise ValueError(f"Failed to hard delete {self.__class__.__name__} with ID {self.id}: {e}")

    @classmethod
    @handle_db_timeout
    async def bulk_hard_delete_async(
        cls,
        db_session: "AsyncSession",
        identifiers: List[str],
        actor: Optional["User"],
        access: Optional[List[Literal["read", "write", "admin"]]] = ["write"],
        access_type: AccessType = AccessType.ORGANIZATION,
    ) -> None:
        """Permanently removes the record from the database asynchronously."""
        logger.debug(f"Hard deleting {cls.__name__} with IDs: {identifiers} with actor={actor} (async)")

        if len(identifiers) == 0:
            logger.debug(f"No identifiers provided for {cls.__name__}, nothing to delete")
            return

        query = delete(cls)
        query = query.where(cls.id.in_(identifiers))
        query = cls.apply_access_predicate(query, actor, access, access_type)
        try:
            result = await db_session.execute(query)
            await db_session.commit()
            logger.debug(f"Successfully deleted {result.rowcount} {cls.__name__} records")
        except Exception as e:
            await db_session.rollback()
            logger.exception(f"Failed to hard delete {cls.__name__} with identifiers {identifiers}")
            raise ValueError(f"Failed to hard delete {cls.__name__} with identifiers {identifiers}: {e}")

    @handle_db_timeout
    def update(self, db_session: Session, actor: Optional["User"] = None, no_commit: bool = False) -> "SqlalchemyBase":
        logger.debug(...)
        if actor:
            self._set_created_and_updated_by_fields(actor.id)
        self.set_updated_at()

        # remove the context manager:
        db_session.add(self)
        if no_commit:
            db_session.flush()  # no commit, just flush to get PK
        else:
            db_session.commit()
        db_session.refresh(self)
        return self

    @handle_db_timeout
    async def update_async(self, db_session: AsyncSession, actor: "User | None" = None, no_commit: bool = False) -> "SqlalchemyBase":
        """Async version of update function"""
        logger.debug(...)
        if actor:
            self._set_created_and_updated_by_fields(actor.id)
        self.set_updated_at()

        db_session.add(self)
        if no_commit:
            await db_session.flush()
        else:
            await db_session.commit()
        await db_session.refresh(self)
        return self

    @classmethod
    def _size_preprocess(
        cls,
        *,
        db_session: "Session",
        actor: Optional["User"] = None,
        access: Optional[List[Literal["read", "write", "admin"]]] = ["read"],
        access_type: AccessType = AccessType.ORGANIZATION,
        check_is_deleted: bool = False,
        **kwargs,
    ):
        logger.debug(f"Calculating size for {cls.__name__} with filters {kwargs}")
        query = select(func.count(1)).select_from(cls)

        if actor:
            query = cls.apply_access_predicate(query, actor, access, access_type)

        # Apply filtering logic based on kwargs
        for key, value in kwargs.items():
            if value:
                column = getattr(cls, key, None)
                if not column:
                    raise AttributeError(f"{cls.__name__} has no attribute '{key}'")
                if isinstance(value, (list, tuple, set)):  # Check for iterables
                    query = query.where(column.in_(value))
                else:  # Single value for equality filtering
                    query = query.where(column == value)

        if check_is_deleted and hasattr(cls, "is_deleted"):
            query = query.where(cls.is_deleted == False)

        return query

    @classmethod
    @handle_db_timeout
    def size(
        cls,
        *,
        db_session: "Session",
        actor: Optional["User"] = None,
        access: Optional[List[Literal["read", "write", "admin"]]] = ["read"],
        access_type: AccessType = AccessType.ORGANIZATION,
        check_is_deleted: bool = False,
        **kwargs,
    ) -> int:
        """
        Get the count of rows that match the provided filters.

        Args:
            db_session: SQLAlchemy session
            **kwargs: Filters to apply to the query (e.g., column_name=value)

        Returns:
            int: The count of rows that match the filters

        Raises:
            DBAPIError: If a database error occurs
        """
        with db_session as session:
            query = cls._size_preprocess(
                db_session=session,
                actor=actor,
                access=access,
                access_type=access_type,
                check_is_deleted=check_is_deleted,
                **kwargs,
            )

            try:
                count = session.execute(query).scalar()
                return count if count else 0
            except DBAPIError as e:
                logger.exception(f"Failed to calculate size for {cls.__name__}")
                raise e

    @classmethod
    @handle_db_timeout
    async def size_async(
        cls,
        *,
        db_session: "AsyncSession",
        actor: Optional["User"] = None,
        access: Optional[List[Literal["read", "write", "admin"]]] = ["read"],
        access_type: AccessType = AccessType.ORGANIZATION,
        check_is_deleted: bool = False,
        **kwargs,
    ) -> int:
        """
        Get the count of rows that match the provided filters.
        Args:
            db_session: SQLAlchemy session
            **kwargs: Filters to apply to the query (e.g., column_name=value)
        Returns:
            int: The count of rows that match the filters
        Raises:
            DBAPIError: If a database error occurs
        """
        query = cls._size_preprocess(
            db_session=db_session,
            actor=actor,
            access=access,
            access_type=access_type,
            check_is_deleted=check_is_deleted,
            **kwargs,
        )

        try:
            result = await db_session.execute(query)
            count = result.scalar()
            return count if count else 0
        except DBAPIError as e:
            logger.exception(f"Failed to calculate size for {cls.__name__}")
            raise e

    @classmethod
    def apply_access_predicate(
        cls,
        query: "Select",
        actor: "User",
        access: List[Literal["read", "write", "admin"]],
        access_type: AccessType = AccessType.ORGANIZATION,
    ) -> "Select":
        """applies a WHERE clause restricting results to the given actor and access level
        Args:
            query: The initial sqlalchemy select statement
            actor: The user acting on the query. **Note**: this is called 'actor' to identify the
                   person or system acting. Users can act on users, making naming very sticky otherwise.
            access:
                what mode of access should the query restrict to? This will be used with granular permissions,
                but because of how it will impact every query we want to be explicitly calling access ahead of time.
        Returns:
            the sqlalchemy select statement restricted to the given access.
        """
        del access  # entrypoint for row-level permissions. Defaults to "same org as the actor, all permissions" at the moment
        if access_type == AccessType.ORGANIZATION:
            org_id = getattr(actor, "organization_id", None)
            if not org_id:
                raise ValueError(f"object {actor} has no organization accessor")
            return query.where(cls.organization_id == org_id)
        elif access_type == AccessType.USER:
            user_id = getattr(actor, "id", None)
            if not user_id:
                raise ValueError(f"object {actor} has no user accessor")
            return query.where(cls.user_id == user_id)
        else:
            raise ValueError(f"unknown access_type: {access_type}")

    @classmethod
    def _handle_dbapi_error(cls, e: DBAPIError):
        """Handle database errors and raise appropriate custom exceptions."""
        orig = e.orig  # Extract the original error from the DBAPIError
        error_code = None
        error_message = str(orig) if orig else str(e)
        logger.info(f"Handling DBAPIError: {error_message}")

        # Handle SQLite-specific errors
        if "UNIQUE constraint failed" in error_message:
            raise UniqueConstraintViolationError(
                f"A unique constraint was violated for {cls.__name__}. Check your input for duplicates: {e}"
            ) from e

        if "FOREIGN KEY constraint failed" in error_message:
            raise ForeignKeyConstraintViolationError(
                f"A foreign key constraint was violated for {cls.__name__}. Check your input for missing or invalid references: {e}"
            ) from e

        # For psycopg2
        if hasattr(orig, "pgcode"):
            error_code = orig.pgcode
        # For pg8000
        elif hasattr(orig, "args") and len(orig.args) > 0:
            # The first argument contains the error details as a dictionary
            err_dict = orig.args[0]
            if isinstance(err_dict, dict):
                error_code = err_dict.get("C")  # 'C' is the error code field
        logger.info(f"Extracted error_code: {error_code}")

        # Handle unique constraint violations
        if error_code == "23505":
            raise UniqueConstraintViolationError(
                f"A unique constraint was violated for {cls.__name__}. Check your input for duplicates: {e}"
            ) from e

        # Handle foreign key violations
        if error_code == "23503":
            raise ForeignKeyConstraintViolationError(
                f"A foreign key constraint was violated for {cls.__name__}. Check your input for missing or invalid references: {e}"
            ) from e

        # Re-raise for other unhandled DBAPI errors
        raise

    @property
    def __pydantic_model__(self) -> "BaseModel":
        raise NotImplementedError("Sqlalchemy models must declare a __pydantic_model__ property to be convertable.")

    def to_pydantic(self) -> "BaseModel":
        """Converts the SQLAlchemy model to its corresponding Pydantic model."""
        model = self.__pydantic_model__.model_validate(self, from_attributes=True)

        # Explicitly map metadata_ to metadata in Pydantic model
        if hasattr(self, "metadata_") and hasattr(model, "metadata_"):
            setattr(model, "metadata_", self.metadata_)  # Ensures correct assignment

        return model

    def pretty_print_columns(self) -> str:
        """
        Pretty prints all columns of the current SQLAlchemy object along with their values.
        """
        if not hasattr(self, "__table__") or not hasattr(self.__table__, "columns"):
            raise NotImplementedError("This object does not have a '__table__.columns' attribute.")

        # Iterate over the columns correctly
        column_data = {column.name: getattr(self, column.name, None) for column in self.__table__.columns}

        return pformat(column_data, indent=4, sort_dicts=True)
