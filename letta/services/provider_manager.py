from typing import List, Optional, Tuple, Union

from letta.orm.provider import Provider as ProviderModel
from letta.otel.tracing import trace_method
from letta.schemas.enums import ProviderCategory, ProviderType
from letta.schemas.providers import Provider as PydanticProvider
from letta.schemas.providers import ProviderCheck, ProviderCreate, ProviderUpdate
from letta.schemas.user import User as PydanticUser
from letta.server.db import db_registry
from letta.utils import enforce_types


class ProviderManager:

    @enforce_types
    @trace_method
    def create_provider(self, request: ProviderCreate, actor: PydanticUser) -> PydanticProvider:
        """Create a new provider if it doesn't already exist."""
        with db_registry.session() as session:
            provider_create_args = {**request.model_dump(), "provider_category": ProviderCategory.byok}
            provider = PydanticProvider(**provider_create_args)

            if provider.name == provider.provider_type.value:
                raise ValueError("Provider name must be unique and different from provider type")

            # Assign the organization id based on the actor
            provider.organization_id = actor.organization_id

            # Lazily create the provider id prior to persistence
            provider.resolve_identifier()

            new_provider = ProviderModel(**provider.model_dump(to_orm=True, exclude_unset=True))
            new_provider.create(session, actor=actor)
            return new_provider.to_pydantic()

    @enforce_types
    @trace_method
    async def create_provider_async(self, request: ProviderCreate, actor: PydanticUser) -> PydanticProvider:
        """Create a new provider if it doesn't already exist."""
        async with db_registry.async_session() as session:
            provider_create_args = {**request.model_dump(), "provider_category": ProviderCategory.byok}
            provider = PydanticProvider(**provider_create_args)

            if provider.name == provider.provider_type.value:
                raise ValueError("Provider name must be unique and different from provider type")

            # Assign the organization id based on the actor
            provider.organization_id = actor.organization_id

            # Lazily create the provider id prior to persistence
            provider.resolve_identifier()

            new_provider = ProviderModel(**provider.model_dump(to_orm=True, exclude_unset=True))
            await new_provider.create_async(session, actor=actor)
            return new_provider.to_pydantic()

    @enforce_types
    @trace_method
    def update_provider(self, provider_id: str, provider_update: ProviderUpdate, actor: PydanticUser) -> PydanticProvider:
        """Update provider details."""
        with db_registry.session() as session:
            # Retrieve the existing provider by ID
            existing_provider = ProviderModel.read(db_session=session, identifier=provider_id, actor=actor, check_is_deleted=True)

            # Update only the fields that are provided in ProviderUpdate
            update_data = provider_update.model_dump(to_orm=True, exclude_unset=True, exclude_none=True)
            for key, value in update_data.items():
                setattr(existing_provider, key, value)

            # Commit the updated provider
            existing_provider.update(session, actor=actor)
            return existing_provider.to_pydantic()

    @enforce_types
    @trace_method
    async def update_provider_async(self, provider_id: str, provider_update: ProviderUpdate, actor: PydanticUser) -> PydanticProvider:
        """Update provider details."""
        async with db_registry.async_session() as session:
            # Retrieve the existing provider by ID
            existing_provider = await ProviderModel.read_async(
                db_session=session, identifier=provider_id, actor=actor, check_is_deleted=True
            )

            # Update only the fields that are provided in ProviderUpdate
            update_data = provider_update.model_dump(to_orm=True, exclude_unset=True, exclude_none=True)
            for key, value in update_data.items():
                setattr(existing_provider, key, value)

            # Commit the updated provider
            await existing_provider.update_async(session, actor=actor)
            return existing_provider.to_pydantic()

    @enforce_types
    @trace_method
    def delete_provider_by_id(self, provider_id: str, actor: PydanticUser):
        """Delete a provider."""
        with db_registry.session() as session:
            # Clear api key field
            existing_provider = ProviderModel.read(db_session=session, identifier=provider_id, actor=actor, check_is_deleted=True)
            existing_provider.api_key = None
            existing_provider.update(session, actor=actor)

            # Soft delete in provider table
            existing_provider.delete(session, actor=actor)

            session.commit()

    @enforce_types
    @trace_method
    async def delete_provider_by_id_async(self, provider_id: str, actor: PydanticUser):
        """Delete a provider."""
        async with db_registry.async_session() as session:
            # Clear api key field
            existing_provider = await ProviderModel.read_async(
                db_session=session, identifier=provider_id, actor=actor, check_is_deleted=True
            )
            existing_provider.api_key = None
            await existing_provider.update_async(session, actor=actor)

            # Soft delete in provider table
            await existing_provider.delete_async(session, actor=actor)

            await session.commit()

    @enforce_types
    @trace_method
    def list_providers(
        self,
        actor: PydanticUser,
        name: Optional[str] = None,
        provider_type: Optional[ProviderType] = None,
        after: Optional[str] = None,
        limit: Optional[int] = 50,
    ) -> List[PydanticProvider]:
        """List all providers with optional pagination."""
        filter_kwargs = {}
        if name:
            filter_kwargs["name"] = name
        if provider_type:
            filter_kwargs["provider_type"] = provider_type
        with db_registry.session() as session:
            providers = ProviderModel.list(
                db_session=session,
                after=after,
                limit=limit,
                actor=actor,
                check_is_deleted=True,
                **filter_kwargs,
            )
            return [provider.to_pydantic() for provider in providers]

    @enforce_types
    @trace_method
    async def list_providers_async(
        self,
        actor: PydanticUser,
        name: Optional[str] = None,
        provider_type: Optional[ProviderType] = None,
        after: Optional[str] = None,
        limit: Optional[int] = 50,
    ) -> List[PydanticProvider]:
        """List all providers with optional pagination."""
        filter_kwargs = {}
        if name:
            filter_kwargs["name"] = name
        if provider_type:
            filter_kwargs["provider_type"] = provider_type
        async with db_registry.async_session() as session:
            providers = await ProviderModel.list_async(
                db_session=session,
                after=after,
                limit=limit,
                actor=actor,
                check_is_deleted=True,
                **filter_kwargs,
            )
            return [provider.to_pydantic() for provider in providers]

    @enforce_types
    @trace_method
    def get_provider_id_from_name(self, provider_name: Union[str, None], actor: PydanticUser) -> Optional[str]:
        providers = self.list_providers(name=provider_name, actor=actor)
        return providers[0].id if providers else None

    @enforce_types
    @trace_method
    def get_override_key(self, provider_name: Union[str, None], actor: PydanticUser) -> Optional[str]:
        providers = self.list_providers(name=provider_name, actor=actor)
        return providers[0].api_key if providers else None

    @enforce_types
    @trace_method
    async def get_override_key_async(self, provider_name: Union[str, None], actor: PydanticUser) -> Optional[str]:
        providers = await self.list_providers_async(name=provider_name, actor=actor)
        return providers[0].api_key if providers else None

    @enforce_types
    @trace_method
    async def get_bedrock_credentials_async(
        self, provider_name: Union[str, None], actor: PydanticUser
    ) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        providers = await self.list_providers_async(name=provider_name, actor=actor)
        access_key = providers[0].access_key if providers else None
        secret_key = providers[0].api_key if providers else None
        region = providers[0].region if providers else None
        return access_key, secret_key, region

    @enforce_types
    @trace_method
    def get_azure_credentials(
        self, provider_name: Union[str, None], actor: PydanticUser
    ) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        providers = self.list_providers(name=provider_name, actor=actor)
        api_key = providers[0].api_key if providers else None
        base_url = providers[0].base_url if providers else None
        api_version = providers[0].api_version if providers else None
        return api_key, base_url, api_version

    @enforce_types
    @trace_method
    async def get_azure_credentials_async(
        self, provider_name: Union[str, None], actor: PydanticUser
    ) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        providers = await self.list_providers_async(name=provider_name, actor=actor)
        api_key = providers[0].api_key if providers else None
        base_url = providers[0].base_url if providers else None
        api_version = providers[0].api_version if providers else None
        return api_key, base_url, api_version

    @enforce_types
    @trace_method
    async def check_provider_api_key(self, provider_check: ProviderCheck) -> None:
        provider = PydanticProvider(
            name=provider_check.provider_type.value,
            provider_type=provider_check.provider_type,
            api_key=provider_check.api_key,
            provider_category=ProviderCategory.byok,
            access_key=provider_check.access_key,  # This contains the access key ID for Bedrock
            region=provider_check.region,
            base_url=provider_check.base_url,
            api_version=provider_check.api_version,
        ).cast_to_subtype()

        # TODO: add more string sanity checks here before we hit actual endpoints
        if not provider.api_key:
            raise ValueError("API key is required!")

        await provider.check_api_key()
