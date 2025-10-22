from typing import List, Optional, Tuple, Union

from letta.orm.provider import Provider as ProviderModel
from letta.otel.tracing import trace_method
from letta.schemas.enums import PrimitiveType, ProviderCategory, ProviderType
from letta.schemas.providers import Provider as PydanticProvider, ProviderCheck, ProviderCreate, ProviderUpdate
from letta.schemas.secret import Secret
from letta.schemas.user import User as PydanticUser
from letta.server.db import db_registry
from letta.utils import enforce_types
from letta.validators import raise_on_invalid_id


class ProviderManager:
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

            # Explicitly populate encrypted fields from plaintext
            if provider.api_key is not None:
                provider.api_key_enc = Secret.from_plaintext(provider.api_key)
            if provider.access_key is not None:
                provider.access_key_enc = Secret.from_plaintext(provider.access_key)

            new_provider = ProviderModel(**provider.model_dump(to_orm=True, exclude_unset=True))
            await new_provider.create_async(session, actor=actor)
            return new_provider.to_pydantic()

    @enforce_types
    @trace_method
    @raise_on_invalid_id(param_name="provider_id", expected_prefix=PrimitiveType.PROVIDER)
    async def update_provider_async(self, provider_id: str, provider_update: ProviderUpdate, actor: PydanticUser) -> PydanticProvider:
        """Update provider details."""
        async with db_registry.async_session() as session:
            # Retrieve the existing provider by ID
            existing_provider = await ProviderModel.read_async(
                db_session=session, identifier=provider_id, actor=actor, check_is_deleted=True
            )

            # Update only the fields that are provided in ProviderUpdate
            update_data = provider_update.model_dump(to_orm=True, exclude_unset=True, exclude_none=True)

            # Handle encryption for api_key if provided
            # Only re-encrypt if the value has actually changed
            if "api_key" in update_data and update_data["api_key"] is not None:
                # Check if value changed
                existing_api_key = None
                if existing_provider.api_key_enc:
                    existing_secret = Secret.from_encrypted(existing_provider.api_key_enc)
                    existing_api_key = existing_secret.get_plaintext()
                elif existing_provider.api_key:
                    existing_api_key = existing_provider.api_key

                # Only re-encrypt if different
                if existing_api_key != update_data["api_key"]:
                    existing_provider.api_key_enc = Secret.from_plaintext(update_data["api_key"]).get_encrypted()
                    # Keep plaintext for dual-write during migration
                    existing_provider.api_key = update_data["api_key"]

                # Remove from update_data since we set directly on existing_provider
                update_data.pop("api_key", None)
                update_data.pop("api_key_enc", None)

            # Handle encryption for access_key if provided
            # Only re-encrypt if the value has actually changed
            if "access_key" in update_data and update_data["access_key"] is not None:
                # Check if value changed
                existing_access_key = None
                if existing_provider.access_key_enc:
                    existing_secret = Secret.from_encrypted(existing_provider.access_key_enc)
                    existing_access_key = existing_secret.get_plaintext()
                elif existing_provider.access_key:
                    existing_access_key = existing_provider.access_key

                # Only re-encrypt if different
                if existing_access_key != update_data["access_key"]:
                    existing_provider.access_key_enc = Secret.from_plaintext(update_data["access_key"]).get_encrypted()
                    # Keep plaintext for dual-write during migration
                    existing_provider.access_key = update_data["access_key"]

                # Remove from update_data since we set directly on existing_provider
                update_data.pop("access_key", None)
                update_data.pop("access_key_enc", None)

            # Apply remaining updates
            for key, value in update_data.items():
                setattr(existing_provider, key, value)

            # Commit the updated provider
            await existing_provider.update_async(session, actor=actor)
            return existing_provider.to_pydantic()

    @enforce_types
    @trace_method
    @raise_on_invalid_id(param_name="provider_id", expected_prefix=PrimitiveType.PROVIDER)
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
    async def list_providers_async(
        self,
        actor: PydanticUser,
        name: Optional[str] = None,
        provider_type: Optional[ProviderType] = None,
        before: Optional[str] = None,
        after: Optional[str] = None,
        limit: Optional[int] = 50,
        ascending: bool = False,
    ) -> List[PydanticProvider]:
        """
        List all providers with pagination support.
        """
        filter_kwargs = {}
        if name:
            filter_kwargs["name"] = name
        if provider_type:
            filter_kwargs["provider_type"] = provider_type
        async with db_registry.async_session() as session:
            providers = await ProviderModel.list_async(
                db_session=session,
                before=before,
                after=after,
                limit=limit,
                actor=actor,
                ascending=ascending,
                check_is_deleted=True,
                **filter_kwargs,
            )
            return [provider.to_pydantic() for provider in providers]

    @enforce_types
    @trace_method
    @raise_on_invalid_id(param_name="provider_id", expected_prefix=PrimitiveType.PROVIDER)
    async def get_provider_async(self, provider_id: str, actor: PydanticUser) -> PydanticProvider:
        async with db_registry.async_session() as session:
            provider_model = await ProviderModel.read_async(db_session=session, identifier=provider_id, actor=actor)
            return provider_model.to_pydantic()

    @enforce_types
    @trace_method
    def get_provider_id_from_name(self, provider_name: Union[str, None], actor: PydanticUser) -> Optional[str]:
        providers = self.list_providers(name=provider_name, actor=actor)
        return providers[0].id if providers else None

    @enforce_types
    @trace_method
    def get_override_key(self, provider_name: Union[str, None], actor: PydanticUser) -> Optional[str]:
        providers = self.list_providers(name=provider_name, actor=actor)
        if providers:
            # Decrypt the API key before returning
            api_key_secret = providers[0].get_api_key_secret()
            return api_key_secret.get_plaintext()
        return None

    @enforce_types
    @trace_method
    async def get_override_key_async(self, provider_name: Union[str, None], actor: PydanticUser) -> Optional[str]:
        providers = await self.list_providers_async(name=provider_name, actor=actor)
        if providers:
            # Decrypt the API key before returning
            api_key_secret = providers[0].get_api_key_secret()
            return api_key_secret.get_plaintext()
        return None

    @enforce_types
    @trace_method
    async def get_bedrock_credentials_async(
        self, provider_name: Union[str, None], actor: PydanticUser
    ) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        providers = await self.list_providers_async(name=provider_name, actor=actor)
        if providers:
            # Decrypt the credentials before returning
            access_key_secret = providers[0].get_access_key_secret()
            api_key_secret = providers[0].get_api_key_secret()
            access_key = access_key_secret.get_plaintext()
            secret_key = api_key_secret.get_plaintext()
            region = providers[0].region
            return access_key, secret_key, region
        return None, None, None

    @enforce_types
    @trace_method
    def get_azure_credentials(
        self, provider_name: Union[str, None], actor: PydanticUser
    ) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        providers = self.list_providers(name=provider_name, actor=actor)
        if providers:
            # Decrypt the API key before returning
            api_key_secret = providers[0].get_api_key_secret()
            api_key = api_key_secret.get_plaintext()
            base_url = providers[0].base_url
            api_version = providers[0].api_version
            return api_key, base_url, api_version
        return None, None, None

    @enforce_types
    @trace_method
    async def get_azure_credentials_async(
        self, provider_name: Union[str, None], actor: PydanticUser
    ) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        providers = await self.list_providers_async(name=provider_name, actor=actor)
        if providers:
            # Decrypt the API key before returning
            api_key_secret = providers[0].get_api_key_secret()
            api_key = api_key_secret.get_plaintext()
            base_url = providers[0].base_url
            api_version = providers[0].api_version
            return api_key, base_url, api_version
        return None, None, None

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
