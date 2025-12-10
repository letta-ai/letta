from typing import List, Optional, Tuple, Union

from letta.orm.provider import Provider as ProviderModel
from letta.orm.provider_model import ProviderModel as ProviderModelORM
from letta.otel.tracing import trace_method
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import PrimitiveType, ProviderCategory, ProviderType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.provider_model import ProviderModel as PydanticProviderModel
from letta.schemas.providers import Provider as PydanticProvider, ProviderCheck, ProviderCreate, ProviderUpdate
from letta.schemas.secret import Secret
from letta.schemas.user import User as PydanticUser
from letta.server.db import db_registry
from letta.utils import enforce_types
from letta.validators import raise_on_invalid_id


class ProviderManager:
    @enforce_types
    @trace_method
    async def create_provider_async(self, request: ProviderCreate, actor: PydanticUser, is_byok: bool = True) -> PydanticProvider:
        """Create a new provider if it doesn't already exist.

        Args:
            request: ProviderCreate object with provider details
            actor: User creating the provider
            is_byok: If True, creates a BYOK provider (default). If False, creates a base provider.
        """
        async with db_registry.async_session() as session:
            from letta.schemas.enums import ProviderCategory

            # Check for name conflicts
            if is_byok:
                # BYOK providers cannot use the same name as base providers
                existing_base_providers = await ProviderModel.list_async(
                    db_session=session,
                    name=request.name,
                    organization_id=None,  # Base providers have NULL organization_id
                    limit=1,
                )
                if existing_base_providers:
                    raise ValueError(
                        f"Provider name '{request.name}' conflicts with an existing base provider. Please choose a different name."
                    )
            else:
                # Base providers must have unique names among themselves
                # (the DB constraint won't catch this because NULL != NULL)
                existing_base_providers = await ProviderModel.list_async(
                    db_session=session,
                    name=request.name,
                    organization_id=None,  # Base providers have NULL organization_id
                    limit=1,
                )
                if existing_base_providers:
                    raise ValueError(f"Base provider name '{request.name}' already exists. Please choose a different name.")

            # Create provider with the appropriate category
            provider_data = request.model_dump()
            provider_data["provider_category"] = ProviderCategory.byok if is_byok else ProviderCategory.base
            provider = PydanticProvider(**provider_data)

            # if provider.name == provider.provider_type.value:
            #     raise ValueError("Provider name must be unique and different from provider type")

            # Only assign organization id for non-base providers
            # Base providers should be globally accessible (org_id = None)
            if is_byok:
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
            provider_pydantic = new_provider.to_pydantic()

            # For BYOK providers, automatically sync available models
            if is_byok:
                await self._sync_default_models_for_provider(provider_pydantic, actor)

            return provider_pydantic

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
        Returns both global providers (organization_id=NULL) and organization-specific providers.
        """
        filter_kwargs = {}
        if name:
            filter_kwargs["name"] = name
        if provider_type:
            filter_kwargs["provider_type"] = provider_type
        async with db_registry.async_session() as session:
            # Get organization-specific providers
            org_providers = await ProviderModel.list_async(
                db_session=session,
                before=before,
                after=after,
                limit=limit,
                actor=actor,
                ascending=ascending,
                check_is_deleted=True,
                **filter_kwargs,
            )

            # Get global providers (base providers with organization_id=NULL)
            global_filter_kwargs = {**filter_kwargs, "organization_id": None}
            global_providers = await ProviderModel.list_async(
                db_session=session,
                before=before,
                after=after,
                limit=limit,
                ascending=ascending,
                check_is_deleted=True,
                **global_filter_kwargs,
            )

            # Combine both lists
            all_providers = org_providers + global_providers

            return [provider.to_pydantic() for provider in all_providers]

    @enforce_types
    @trace_method
    def list_providers(
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
        List all providers with pagination support (synchronous version).
        Returns both global providers (organization_id=NULL) and organization-specific providers.
        """
        filter_kwargs = {}
        if name:
            filter_kwargs["name"] = name
        if provider_type:
            filter_kwargs["provider_type"] = provider_type
        with db_registry.get_session() as session:
            # Get organization-specific providers
            org_providers = ProviderModel.list(
                db_session=session,
                before=before,
                after=after,
                limit=limit,
                actor=actor,
                ascending=ascending,
                check_is_deleted=True,
                **filter_kwargs,
            )

            # Get global providers (base providers with organization_id=NULL)
            global_filter_kwargs = {**filter_kwargs, "organization_id": None}
            global_providers = ProviderModel.list(
                db_session=session,
                before=before,
                after=after,
                limit=limit,
                ascending=ascending,
                check_is_deleted=True,
                **global_filter_kwargs,
            )

            # Combine both lists
            all_providers = org_providers + global_providers

            return [provider.to_pydantic() for provider in all_providers]

    @enforce_types
    @trace_method
    @raise_on_invalid_id(param_name="provider_id", expected_prefix=PrimitiveType.PROVIDER)
    async def get_provider_async(self, provider_id: str, actor: PydanticUser) -> PydanticProvider:
        async with db_registry.async_session() as session:
            # First try to get as organization-specific provider
            try:
                provider_model = await ProviderModel.read_async(db_session=session, identifier=provider_id, actor=actor)
                return provider_model.to_pydantic()
            except:
                # If not found, try to get as global provider (organization_id=NULL)
                from sqlalchemy import select

                stmt = select(ProviderModel).where(
                    ProviderModel.id == provider_id,
                    ProviderModel.organization_id.is_(None),
                    ProviderModel.is_deleted == False,
                )
                result = await session.execute(stmt)
                provider_model = result.scalar_one_or_none()
                if provider_model:
                    return provider_model.to_pydantic()
                else:
                    from letta.orm.errors import NoResultFound

                    raise NoResultFound(f"Provider not found with id='{provider_id}'")

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

    async def _sync_default_models_for_provider(self, provider: PydanticProvider, actor: PydanticUser) -> None:
        """Sync models for a newly created BYOK provider by querying the provider's API."""
        from letta.log import get_logger

        logger = get_logger(__name__)

        try:
            # Get the provider class and create an instance
            from letta.schemas.providers.anthropic import AnthropicProvider
            from letta.schemas.providers.azure import AzureProvider
            from letta.schemas.providers.bedrock import BedrockProvider
            from letta.schemas.providers.google_gemini import GoogleAIProvider
            from letta.schemas.providers.groq import GroqProvider
            from letta.schemas.providers.ollama import OllamaProvider
            from letta.schemas.providers.openai import OpenAIProvider

            provider_type_to_class = {
                "openai": OpenAIProvider,
                "anthropic": AnthropicProvider,
                "groq": GroqProvider,
                "google": GoogleAIProvider,
                "ollama": OllamaProvider,
                "bedrock": BedrockProvider,
                "azure": AzureProvider,
            }

            provider_type = provider.provider_type.value if hasattr(provider.provider_type, "value") else str(provider.provider_type)
            provider_class = provider_type_to_class.get(provider_type)

            if not provider_class:
                logger.warning(f"No provider class found for type '{provider_type}'")
                return

            # Create provider instance with necessary parameters
            kwargs = {
                "name": provider.name,
                "api_key": provider.api_key,
                "provider_category": provider.provider_category,
            }
            if provider.base_url:
                kwargs["base_url"] = provider.base_url
            if provider.access_key:
                kwargs["access_key"] = provider.access_key
            if provider.region:
                kwargs["region"] = provider.region
            if provider.api_version:
                kwargs["api_version"] = provider.api_version

            provider_instance = provider_class(**kwargs)

            # Query the provider's API for available models
            llm_models = await provider_instance.list_llm_models_async()
            embedding_models = await provider_instance.list_embedding_models_async()

            # Update handles and provider_name for BYOK providers
            for model in llm_models:
                model.provider_name = provider.name
                model.handle = f"{provider.name}/{model.model}"
                model.provider_category = provider.provider_category

            for model in embedding_models:
                model.handle = f"{provider.name}/{model.embedding_model}"

            # Use existing sync_provider_models_async to save to database
            await self.sync_provider_models_async(
                provider=provider, llm_models=llm_models, embedding_models=embedding_models, organization_id=actor.organization_id
            )

        except Exception as e:
            logger.error(f"Failed to sync models for provider '{provider.name}': {e}")
            # Don't fail provider creation if model sync fails

    @enforce_types
    @trace_method
    async def sync_base_providers(self, base_providers: list[PydanticProvider], actor: PydanticUser) -> None:
        """
        Sync base providers (from environment) to database (idempotent).

        This method is safe to call from multiple pods simultaneously as it:
        1. Checks if provider exists before creating
        2. Handles race conditions with UniqueConstraintViolationError
        3. Only creates providers that don't exist (no updates to avoid conflicts)

        Args:
            base_providers: List of base provider instances from environment variables
            actor: User actor for database operations
        """
        from letta.log import get_logger
        from letta.orm.errors import UniqueConstraintViolationError

        logger = get_logger(__name__)
        logger.info(f"Syncing {len(base_providers)} base providers to database")

        async with db_registry.async_session() as session:
            for provider in base_providers:
                try:
                    # Check if base provider already exists (base providers have organization_id=None)
                    existing_providers = await ProviderModel.list_async(
                        db_session=session,
                        name=provider.name,
                        organization_id=None,  # Base providers are global
                        limit=1,
                    )

                    if existing_providers:
                        logger.debug(f"Base provider '{provider.name}' already exists in database, skipping")
                        continue

                    # Convert Provider to ProviderCreate
                    provider_create = ProviderCreate(
                        name=provider.name,
                        provider_type=provider.provider_type,
                        api_key=provider.api_key or "",  # ProviderCreate requires api_key, use empty string if None
                        access_key=provider.access_key,
                        region=provider.region,
                        base_url=provider.base_url,
                        api_version=provider.api_version,
                    )

                    # Create the provider in the database as a base provider
                    await self.create_provider_async(request=provider_create, actor=actor, is_byok=False)
                    logger.info(f"Successfully initialized base provider '{provider.name}' to database")

                except UniqueConstraintViolationError:
                    # Race condition: another pod created this provider between our check and create
                    # This is expected and safe - just log and continue
                    logger.debug(f"Provider '{provider.name}' was created by another pod, skipping")
                except Exception as e:
                    # Log error but don't fail startup - provider initialization is not critical
                    logger.error(f"Failed to sync provider '{provider.name}' to database: {e}", exc_info=True)

    @enforce_types
    @trace_method
    async def sync_provider_models_async(
        self,
        provider: PydanticProvider,
        llm_models: List[LLMConfig],
        embedding_models: List[EmbeddingConfig],
        organization_id: Optional[str] = None,
    ) -> None:
        """Sync models from a provider to the database - adds new models and removes old ones."""
        from letta.log import get_logger

        logger = get_logger(__name__)
        logger.info(f"=== Starting sync for provider '{provider.name}' (ID: {provider.id}) ===")
        logger.info(f"  Organization ID: {organization_id}")
        logger.info(f"  LLM models to sync: {[m.handle for m in llm_models]}")
        logger.info(f"  Embedding models to sync: {[m.handle for m in embedding_models]}")

        async with db_registry.async_session() as session:
            # Get all existing models for this provider and organization
            # We need to handle None organization_id specially for SQL NULL comparisons
            from sqlalchemy import and_, select

            # Build the query conditions
            if organization_id is None:
                # For global models (organization_id IS NULL), excluding soft-deleted
                stmt = select(ProviderModelORM).where(
                    and_(
                        ProviderModelORM.provider_id == provider.id,
                        ProviderModelORM.organization_id.is_(None),
                        ProviderModelORM.is_deleted == False,  # Filter out soft-deleted models
                    )
                )
                result = await session.execute(stmt)
                existing_models = list(result.scalars().all())
            else:
                # For org-specific models
                existing_models = await ProviderModelORM.list_async(
                    db_session=session,
                    check_is_deleted=True,  # Filter out soft-deleted models
                    **{
                        "provider_id": provider.id,
                        "organization_id": organization_id,
                    },
                )

            # Build sets of handles for incoming models
            incoming_llm_handles = {llm.handle for llm in llm_models}
            incoming_embedding_handles = {emb.handle for emb in embedding_models}
            all_incoming_handles = incoming_llm_handles | incoming_embedding_handles

            # Determine which models to remove (existing models not in the incoming list)
            models_to_remove = []
            for existing_model in existing_models:
                if existing_model.handle not in all_incoming_handles:
                    models_to_remove.append(existing_model)

            # Remove models that are no longer in the sync list
            for model_to_remove in models_to_remove:
                await model_to_remove.delete_async(session)
                logger.debug(f"Removed model {model_to_remove.handle} from provider {provider.name}")

            # Commit the deletions
            await session.commit()

            # Process LLM models - add new ones
            logger.info(f"Processing {len(llm_models)} LLM models for provider {provider.name}")
            for llm_config in llm_models:
                logger.info(f"  Checking LLM model: {llm_config.handle} (name: {llm_config.model})")

                # Check if model already exists (excluding soft-deleted ones)
                existing = await ProviderModelORM.list_async(
                    db_session=session,
                    limit=1,
                    check_is_deleted=True,  # Filter out soft-deleted models
                    **{
                        "handle": llm_config.handle,
                        "organization_id": organization_id,
                        "model_type": "llm",  # Must check model_type since handle can be same for LLM and embedding
                    },
                )

                if not existing:
                    logger.info(f"    Creating new LLM model {llm_config.handle}")
                    # Create new model entry
                    pydantic_model = PydanticProviderModel(
                        handle=llm_config.handle,
                        display_name=llm_config.model,
                        name=llm_config.model,
                        provider_id=provider.id,
                        organization_id=organization_id,
                        model_type="llm",
                        enabled=True,
                        model_endpoint_type=llm_config.model_endpoint_type,
                        max_context_window=llm_config.context_window,
                        supports_token_streaming=llm_config.model_endpoint_type in ["openai", "anthropic", "deepseek"],
                        supports_tool_calling=True,  # Assume true for LLMs for now
                    )

                    logger.info(
                        f"    Model data: handle={pydantic_model.handle}, name={pydantic_model.name}, "
                        f"model_type={pydantic_model.model_type}, provider_id={pydantic_model.provider_id}, "
                        f"org_id={pydantic_model.organization_id}"
                    )

                    # Convert to ORM
                    model = ProviderModelORM(**pydantic_model.model_dump(to_orm=True))
                    try:
                        await model.create_async(session)
                        logger.info(f"    ✓ Successfully created LLM model {llm_config.handle} with ID {model.id}")
                    except Exception as e:
                        logger.error(f"    ✗ Failed to create LLM model {llm_config.handle}: {e}")
                        # Log the full error details
                        import traceback

                        logger.error(f"    Full traceback: {traceback.format_exc()}")
                        # Roll back the session to clear the failed transaction
                        await session.rollback()
                else:
                    logger.info(f"    LLM model {llm_config.handle} already exists (ID: {existing[0].id}), skipping")

            # Process embedding models - add new ones
            logger.info(f"Processing {len(embedding_models)} embedding models for provider {provider.name}")
            for embedding_config in embedding_models:
                logger.info(f"  Checking embedding model: {embedding_config.handle} (name: {embedding_config.embedding_model})")

                # Check if model already exists (excluding soft-deleted ones)
                existing = await ProviderModelORM.list_async(
                    db_session=session,
                    limit=1,
                    check_is_deleted=True,  # Filter out soft-deleted models
                    **{
                        "handle": embedding_config.handle,
                        "organization_id": organization_id,
                        "model_type": "embedding",  # Must check model_type since handle can be same for LLM and embedding
                    },
                )

                if not existing:
                    logger.info(f"    Creating new embedding model {embedding_config.handle}")
                    # Create new model entry
                    pydantic_model = PydanticProviderModel(
                        handle=embedding_config.handle,
                        display_name=embedding_config.embedding_model,
                        name=embedding_config.embedding_model,
                        provider_id=provider.id,
                        organization_id=organization_id,
                        model_type="embedding",
                        enabled=True,
                        model_endpoint_type=embedding_config.embedding_endpoint_type,
                        embedding_dim=embedding_config.embedding_dim if hasattr(embedding_config, "embedding_dim") else None,
                    )

                    logger.info(
                        f"    Model data: handle={pydantic_model.handle}, name={pydantic_model.name}, "
                        f"model_type={pydantic_model.model_type}, provider_id={pydantic_model.provider_id}, "
                        f"org_id={pydantic_model.organization_id}"
                    )

                    # Convert to ORM
                    model = ProviderModelORM(**pydantic_model.model_dump(to_orm=True))
                    try:
                        await model.create_async(session)
                        logger.info(f"    ✓ Successfully created embedding model {embedding_config.handle} with ID {model.id}")
                    except Exception as e:
                        logger.error(f"    ✗ Failed to create embedding model {embedding_config.handle}: {e}")
                        # Log the full error details
                        import traceback

                        logger.error(f"    Full traceback: {traceback.format_exc()}")
                        # Roll back the session to clear the failed transaction
                        await session.rollback()
                else:
                    logger.info(f"    Embedding model {embedding_config.handle} already exists (ID: {existing[0].id}), skipping")

    @enforce_types
    @trace_method
    async def get_model_by_handle_async(
        self,
        handle: str,
        actor: PydanticUser,
        model_type: Optional[str] = None,
    ) -> Optional[PydanticProviderModel]:
        """Get a model by its handle. Handles are unique per organization."""
        async with db_registry.async_session() as session:
            from sqlalchemy import and_, or_, select

            # Build conditions for the query
            conditions = [
                ProviderModelORM.handle == handle,
                ProviderModelORM.is_deleted == False,  # Filter out soft-deleted models
            ]

            if model_type:
                conditions.append(ProviderModelORM.model_type == model_type)

            # Search for models that are either:
            # 1. Organization-specific (matching actor's org)
            # 2. Global (organization_id is NULL)
            conditions.append(or_(ProviderModelORM.organization_id == actor.organization_id, ProviderModelORM.organization_id.is_(None)))

            stmt = select(ProviderModelORM).where(and_(*conditions))
            result = await session.execute(stmt)
            models = list(result.scalars().all())

            # Find the model the user has access to
            # Prioritize org-specific models over global models
            org_model = None
            global_model = None

            for model in models:
                if model.organization_id == actor.organization_id:
                    org_model = model
                elif model.organization_id is None:
                    global_model = model

            # Return org-specific model if it exists, otherwise return global model
            if org_model:
                return org_model.to_pydantic()
            elif global_model:
                return global_model.to_pydantic()

            return None

    @enforce_types
    @trace_method
    async def list_models_async(
        self,
        actor: PydanticUser,
        model_type: Optional[str] = None,
        provider_id: Optional[str] = None,
        enabled: Optional[bool] = True,
        limit: Optional[int] = None,
    ) -> List[PydanticProviderModel]:
        """List models available to an actor (both global and org-scoped)."""
        async with db_registry.async_session() as session:
            # Build filters
            filters = {}
            if model_type:
                filters["model_type"] = model_type
            if provider_id:
                filters["provider_id"] = provider_id
            if enabled is not None:
                filters["enabled"] = enabled

            # Get org-scoped models (excluding soft-deleted ones)
            org_filters = {**filters, "organization_id": actor.organization_id}
            org_models = await ProviderModelORM.list_async(
                db_session=session,
                limit=limit,
                check_is_deleted=True,  # Filter out soft-deleted models
                **org_filters,
            )

            # Get global models - need to handle NULL organization_id specially
            from sqlalchemy import and_, select

            # Build conditions for global models query
            conditions = [
                ProviderModelORM.organization_id.is_(None),
                ProviderModelORM.is_deleted == False,  # Filter out soft-deleted models
            ]
            if model_type:
                conditions.append(ProviderModelORM.model_type == model_type)
            if provider_id:
                conditions.append(ProviderModelORM.provider_id == provider_id)
            if enabled is not None:
                conditions.append(ProviderModelORM.enabled == enabled)

            stmt = select(ProviderModelORM).where(and_(*conditions))
            if limit:
                stmt = stmt.limit(limit)
            result = await session.execute(stmt)
            global_models = list(result.scalars().all())

            # Combine and deduplicate by handle AND model_type (org-scoped takes precedence)
            # Use (handle, model_type) tuple as key since same handle can exist for LLM and embedding
            all_models = {(m.handle, m.model_type): m for m in global_models}
            all_models.update({(m.handle, m.model_type): m for m in org_models})

            return [m.to_pydantic() for m in all_models.values()]

    @enforce_types
    @trace_method
    async def get_llm_config_from_handle(
        self,
        handle: str,
        actor: PydanticUser,
    ) -> LLMConfig:
        """Get an LLMConfig from a model handle.

        Args:
            handle: The model handle to look up
            actor: The user actor for permission checking

        Returns:
            LLMConfig constructed from the provider and model data

        Raises:
            NoResultFound: If the handle doesn't exist in the database
        """
        from letta.orm.errors import NoResultFound

        # Look up the model by handle
        model = await self.get_model_by_handle_async(handle=handle, actor=actor, model_type="llm")

        if not model:
            raise NoResultFound(f"LLM model not found with handle='{handle}'")

        # Get the provider for this model
        provider = await self.get_provider_async(provider_id=model.provider_id, actor=actor)

        # Construct the LLMConfig from the model and provider data
        llm_config = LLMConfig(
            model=model.name,
            model_endpoint_type=model.model_endpoint_type,
            model_endpoint=provider.base_url or f"https://api.{provider.provider_type.value}.com/v1",
            context_window=model.max_context_window or 16384,  # Default if not set
            handle=model.handle,
            provider_name=provider.name,
            provider_category=provider.provider_category,
        )

        return llm_config

    @enforce_types
    @trace_method
    async def get_embedding_config_from_handle(
        self,
        handle: str,
        actor: PydanticUser,
    ) -> EmbeddingConfig:
        """Get an EmbeddingConfig from a model handle.

        Args:
            handle: The model handle to look up
            actor: The user actor for permission checking

        Returns:
            EmbeddingConfig constructed from the provider and model data

        Raises:
            NoResultFound: If the handle doesn't exist in the database
        """
        from letta.orm.errors import NoResultFound

        # Look up the model by handle
        model = await self.get_model_by_handle_async(handle=handle, actor=actor, model_type="embedding")

        if not model:
            raise NoResultFound(f"Embedding model not found with handle='{handle}'")

        # Get the provider for this model
        provider = await self.get_provider_async(provider_id=model.provider_id, actor=actor)

        # Construct the EmbeddingConfig from the model and provider data
        embedding_config = EmbeddingConfig(
            embedding_model=model.name,
            embedding_endpoint_type=model.model_endpoint_type,
            embedding_endpoint=provider.base_url or f"https://api.{provider.provider_type.value}.com/v1",
            embedding_dim=model.embedding_dim or 1536,  # Use model's dimension or default
            embedding_chunk_size=300,  # Default chunk size
            handle=model.handle,
        )

        return embedding_config
