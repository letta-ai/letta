from typing import List, Optional

from letta.orm.errors import NoResultFound
from letta.orm.organization import Organization as OrganizationModel
from letta.orm.user import User as UserModel
from letta.schemas.user import User as PydanticUser
from letta.schemas.user import UserUpdate
from letta.server.db import db_registry
from letta.services.organization_manager import OrganizationManager
from letta.tracing import trace_method
from letta.utils import enforce_types


class UserManager:
    """Manager class to handle business logic related to Users."""

    DEFAULT_USER_NAME = "default_user"
    DEFAULT_USER_ID = "user-00000000-0000-4000-8000-000000000000"

    @enforce_types
    @trace_method
    def create_default_user(self, org_id: str = OrganizationManager.DEFAULT_ORG_ID) -> PydanticUser:
        """Create the default user."""
        with db_registry.session() as session:
            # Make sure the org id exists
            try:
                OrganizationModel.read(db_session=session, identifier=org_id)
            except NoResultFound:
                raise ValueError(f"No organization with {org_id} exists in the organization table.")

            # Try to retrieve the user
            try:
                user = UserModel.read(db_session=session, identifier=self.DEFAULT_USER_ID)
            except NoResultFound:
                # If it doesn't exist, make it
                user = UserModel(id=self.DEFAULT_USER_ID, name=self.DEFAULT_USER_NAME, organization_id=org_id)
                user.create(session)

            return user.to_pydantic()

    @enforce_types
    @trace_method
    def create_user(self, pydantic_user: PydanticUser) -> PydanticUser:
        """Create a new user if it doesn't already exist."""
        with db_registry.session() as session:
            new_user = UserModel(**pydantic_user.model_dump(to_orm=True))
            new_user.create(session)
            return new_user.to_pydantic()

    @enforce_types
    @trace_method
    async def create_actor_async(self, pydantic_user: PydanticUser) -> PydanticUser:
        """Create a new user if it doesn't already exist (async version)."""
        async with db_registry.async_session() as session:
            new_user = UserModel(**pydantic_user.model_dump(to_orm=True))
            await new_user.create_async(session)
            return new_user.to_pydantic()

    @enforce_types
    @trace_method
    def update_user(self, user_update: UserUpdate) -> PydanticUser:
        """Update user details."""
        with db_registry.session() as session:
            # Retrieve the existing user by ID
            existing_user = UserModel.read(db_session=session, identifier=user_update.id)

            # Update only the fields that are provided in UserUpdate
            update_data = user_update.model_dump(to_orm=True, exclude_unset=True, exclude_none=True)
            for key, value in update_data.items():
                setattr(existing_user, key, value)

            # Commit the updated user
            existing_user.update(session)
            return existing_user.to_pydantic()

    @enforce_types
    @trace_method
    async def update_actor_async(self, user_update: UserUpdate) -> PydanticUser:
        """Update user details (async version)."""
        async with db_registry.async_session() as session:
            # Retrieve the existing user by ID
            existing_user = await UserModel.read_async(db_session=session, identifier=user_update.id)

            # Update only the fields that are provided in UserUpdate
            update_data = user_update.model_dump(to_orm=True, exclude_unset=True, exclude_none=True)
            for key, value in update_data.items():
                setattr(existing_user, key, value)

            # Commit the updated user
            await existing_user.update_async(session)
            return existing_user.to_pydantic()

    @enforce_types
    @trace_method
    def delete_user_by_id(self, user_id: str):
        """Delete a user and their associated records (agents, sources, mappings)."""
        with db_registry.session() as session:
            # Delete from user table
            user = UserModel.read(db_session=session, identifier=user_id)
            user.hard_delete(session)

            session.commit()

    @enforce_types
    @trace_method
    async def delete_actor_by_id_async(self, user_id: str):
        """Delete a user and their associated records (agents, sources, mappings) asynchronously."""
        async with db_registry.async_session() as session:
            # Delete from user table
            user = await UserModel.read_async(db_session=session, identifier=user_id)
            await user.hard_delete_async(session)

    @enforce_types
    @trace_method
    def get_user_by_id(self, user_id: str) -> PydanticUser:
        """Fetch a user by ID."""
        with db_registry.session() as session:
            user = UserModel.read(db_session=session, identifier=user_id)
            return user.to_pydantic()

    @enforce_types
    @trace_method
    async def get_actor_by_id_async(self, actor_id: str) -> PydanticUser:
        """Fetch a user by ID asynchronously."""
        async with db_registry.async_session() as session:
            user = await UserModel.read_async(db_session=session, identifier=actor_id)
            return user.to_pydantic()

    @enforce_types
    @trace_method
    def get_default_user(self) -> PydanticUser:
        """Fetch the default user. If it doesn't exist, create it."""
        try:
            return self.get_user_by_id(self.DEFAULT_USER_ID)
        except NoResultFound:
            return self.create_default_user()

    @enforce_types
    @trace_method
    def get_user_or_default(self, user_id: Optional[str] = None):
        """Fetch the user or default user."""
        if not user_id:
            return self.get_default_user()

        try:
            return self.get_user_by_id(user_id=user_id)
        except NoResultFound:
            return self.get_default_user()

    @enforce_types
    @trace_method
    async def get_default_actor_async(self) -> PydanticUser:
        """Fetch the default user asynchronously. If it doesn't exist, create it."""
        try:
            return await self.get_actor_by_id_async(self.DEFAULT_USER_ID)
        except NoResultFound:
            # Fall back to synchronous version since create_default_user isn't async yet
            return self.create_default_user(org_id=self.DEFAULT_ORG_ID)

    @enforce_types
    @trace_method
    async def get_actor_or_default_async(self, actor_id: Optional[str] = None):
        """Fetch the user or default user asynchronously."""
        if not actor_id:
            return await self.get_default_actor_async()

        try:
            return await self.get_actor_by_id_async(actor_id=actor_id)
        except NoResultFound:
            return await self.get_default_actor_async()

    @enforce_types
    @trace_method
    def list_users(self, after: Optional[str] = None, limit: Optional[int] = 50) -> List[PydanticUser]:
        """List all users with optional pagination."""
        with db_registry.session() as session:
            users = UserModel.list(
                db_session=session,
                after=after,
                limit=limit,
            )
            return [user.to_pydantic() for user in users]

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
