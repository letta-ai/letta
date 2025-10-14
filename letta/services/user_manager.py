from typing import List, Optional

from sqlalchemy import select

from letta.constants import DEFAULT_ORG_ID
from letta.data_sources.redis_client import get_redis_client
from letta.helpers.decorators import async_redis_cache
from letta.log import get_logger
from letta.orm.errors import NoResultFound
from letta.orm.organization import Organization as OrganizationModel
from letta.orm.user import User as UserModel
from letta.otel.tracing import trace_method
from letta.schemas.user import User as PydanticUser, UserUpdate
from letta.server.db import db_registry
from letta.utils import enforce_types

logger = get_logger(__name__)


class UserManager:
    """Manager class to handle business logic related to Users."""

    DEFAULT_USER_NAME = "default_user"
    DEFAULT_USER_ID = "user-00000000-0000-4000-8000-000000000000"

    @enforce_types
    @trace_method
    async def create_default_actor_async(self, org_id: str = DEFAULT_ORG_ID) -> PydanticUser:
        """Create the default user."""
        async with db_registry.async_session() as session:
            # Make sure the org id exists
            try:
                await OrganizationModel.read_async(db_session=session, identifier=org_id)
            except NoResultFound:
                raise ValueError(f"No organization with {org_id} exists in the organization table.")

            # Try to retrieve the user
            try:
                actor = await UserModel.read_async(db_session=session, identifier=self.DEFAULT_USER_ID)
            except NoResultFound:
                # If it doesn't exist, make it
                actor = UserModel(id=self.DEFAULT_USER_ID, name=self.DEFAULT_USER_NAME, organization_id=org_id)
                await actor.create_async(session)
                await self._invalidate_actor_cache(self.DEFAULT_USER_ID)

            return actor.to_pydantic()

    @enforce_types
    @trace_method
    async def create_actor_async(self, pydantic_user: PydanticUser) -> PydanticUser:
        """Create a new user if it doesn't already exist (async version)."""
        async with db_registry.async_session() as session:
            new_user = UserModel(**pydantic_user.model_dump(to_orm=True))
            await new_user.create_async(session)
            await self._invalidate_actor_cache(new_user.id)
            return new_user.to_pydantic()

    @enforce_types
    @trace_method
    async def update_actor_async(self, user_update: UserUpdate) -> PydanticUser:
        """Update user details (async version). Raises NoResultFound if not found."""
        async with db_registry.async_session() as session:
            # Retrieve the existing user by ID
            existing_user = await UserModel.read_async(db_session=session, identifier=user_update.id)

            # Update only the fields that are provided in UserUpdate
            update_data = user_update.model_dump(to_orm=True, exclude_unset=True, exclude_none=True)
            for key, value in update_data.items():
                setattr(existing_user, key, value)

            # Commit the updated user
            await existing_user.update_async(session)
            await self._invalidate_actor_cache(user_update.id)
            return existing_user.to_pydantic()

    @enforce_types
    @trace_method
    async def delete_actor_by_id_async(self, user_id: str):
        """Delete a user and their associated records (agents, sources, mappings) asynchronously. Raises NoResultFound if not found."""
        async with db_registry.async_session() as session:
            # Delete from user table
            user = await UserModel.read_async(db_session=session, identifier=user_id)
            await user.hard_delete_async(session)
            await self._invalidate_actor_cache(user_id)

    @enforce_types
    @trace_method
    @async_redis_cache(key_func=lambda self, actor_id: f"actor_id:{actor_id}", model_class=PydanticUser)
    async def get_actor_by_id_async(self, actor_id: str) -> PydanticUser:
        """Fetch a user by ID asynchronously."""
        async with db_registry.async_session() as session:
            stmt = select(UserModel).where(UserModel.id == actor_id)
            result = await session.execute(stmt)
            user = result.scalar_one_or_none()

            if not user:
                raise NoResultFound(f"User not found with id={actor_id}")

            return user.to_pydantic()

    @enforce_types
    @trace_method
    async def get_default_actor_async(self) -> PydanticUser:
        """Fetch the default user asynchronously. If it doesn't exist, create it."""
        try:
            return await self.get_actor_by_id_async(self.DEFAULT_USER_ID)
        except NoResultFound:
            return await self.create_default_actor_async(org_id=DEFAULT_ORG_ID)

    @enforce_types
    @trace_method
    async def get_actor_or_default_async(self, actor_id: Optional[str] = None):
        """Fetch the user or default user asynchronously."""
        target_id = actor_id or self.DEFAULT_USER_ID

        try:
            return await self.get_actor_by_id_async(target_id)
        except NoResultFound:
            user = await self.create_default_actor_async(org_id=DEFAULT_ORG_ID)
            return user

    @enforce_types
    @trace_method
    async def list_actors_async(self, after: Optional[str] = None, limit: Optional[int] = 50) -> List[PydanticUser]:
        """List all users with optional pagination (async version)."""
        async with db_registry.async_session() as session:
            users = await UserModel.list_async(
                db_session=session,
                after=after,
                limit=limit,
            )
            return [user.to_pydantic() for user in users]

    async def _invalidate_actor_cache(self, actor_id: str) -> bool:
        """Invalidates the actor cache on CRUD operations.
        TODO (cliandy): see notes on redis cache decorator
        """
        try:
            redis_client = await get_redis_client()
            cache_key = self.get_actor_by_id_async.cache_key_func(self, actor_id)
            return (await redis_client.delete(cache_key)) > 0
        except Exception as e:
            logger.error(f"Failed to invalidate cache: {e}")
            return False
