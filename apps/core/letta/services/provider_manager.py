from typing import List, Optional

from letta.orm.provider import Provider as ProviderModel
from letta.schemas.providers import Provider as PydanticProvider
from letta.schemas.providers import ProviderUpdate
from letta.schemas.user import User as PydanticUser
from letta.utils import enforce_types


class ProviderManager:

    def __init__(self):
        from letta.server.server import db_context

        self.session_maker = db_context

    @enforce_types
    def create_provider(self, provider: PydanticProvider, actor: PydanticUser) -> PydanticProvider:
        """Create a new provider if it doesn't already exist."""
        with self.session_maker() as session:
            # Assign the organization id based on the actor
            provider.organization_id = actor.organization_id

            # Lazily create the provider id prior to persistence
            provider.resolve_identifier()

            new_provider = ProviderModel(**provider.model_dump(exclude_unset=True))
            new_provider.create(session)
            return new_provider.to_pydantic()

    @enforce_types
    def update_provider(self, provider_update: ProviderUpdate) -> PydanticProvider:
        """Update provider details."""
        with self.session_maker() as session:
            # Retrieve the existing provider by ID
            existing_provider = ProviderModel.read(db_session=session, identifier=provider_update.id)

            # Update only the fields that are provided in ProviderUpdate
            update_data = provider_update.model_dump(exclude_unset=True, exclude_none=True)
            for key, value in update_data.items():
                setattr(existing_provider, key, value)

            # Commit the updated provider
            existing_provider.update(session)
            return existing_provider.to_pydantic()

    @enforce_types
    def delete_provider_by_id(self, provider_id: str):
        """Delete a provider."""
        with self.session_maker() as session:
            # Clear api key field
            existing_provider = ProviderModel.read(db_session=session, identifier=provider_id)
            existing_provider.api_key = None
            existing_provider.update(session)

            # Soft delete in provider table
            existing_provider.delete(session)

            session.commit()

    @enforce_types
    def list_providers(self, cursor: Optional[str] = None, limit: Optional[int] = 50) -> List[PydanticProvider]:
        """List providers with pagination using cursor (id) and limit."""
        with self.session_maker() as session:
            results = ProviderModel.list(db_session=session, cursor=cursor, limit=limit)
            return [provider.to_pydantic() for provider in results]

    @enforce_types
    def get_anthropic_override_provider_id(self) -> Optional[str]:
        """Helper function to fetch custom anthropic provider id for v0 BYOK feature"""
        anthropic_provider = [provider for provider in self.list_providers() if provider.name == "anthropic"]
        if len(anthropic_provider) != 0:
            return anthropic_provider[0].id
        return None

    @enforce_types
    def get_anthropic_override_key(self) -> Optional[str]:
        """Helper function to fetch custom anthropic key for v0 BYOK feature"""
        anthropic_provider = [provider for provider in self.list_providers() if provider.name == "anthropic"]
        if len(anthropic_provider) != 0:
            return anthropic_provider[0].api_key
        return None
