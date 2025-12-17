from typing import TYPE_CHECKING, List, Literal, Optional

from fastapi import APIRouter, Body, Depends, Query, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from letta.schemas.enums import ProviderType
from letta.schemas.providers import (
    Provider,
    ProviderBase,
    ProviderCheck,
    ProviderCreate,
    ProviderOAuthCallback,
    ProviderOAuthInitiate,
    ProviderUpdate,
)
from letta.server.rest_api.dependencies import HeaderParams, get_headers, get_letta_server
from letta.validators import ProviderId

if TYPE_CHECKING:
    from letta.server.server import SyncServer

router = APIRouter(prefix="/providers", tags=["providers"])


@router.get("/", response_model=List[Provider], operation_id="list_providers")
async def list_providers(
    before: Optional[str] = Query(
        None,
        description="Provider ID cursor for pagination. Returns providers that come before this provider ID in the specified sort order",
    ),
    after: Optional[str] = Query(
        None,
        description="Provider ID cursor for pagination. Returns providers that come after this provider ID in the specified sort order",
    ),
    limit: Optional[int] = Query(50, description="Maximum number of providers to return"),
    order: Literal["asc", "desc"] = Query(
        "desc", description="Sort order for providers by creation time. 'asc' for oldest first, 'desc' for newest first"
    ),
    order_by: Literal["created_at"] = Query("created_at", description="Field to sort by"),
    name: Optional[str] = Query(None, description="Filter providers by name"),
    provider_type: Optional[ProviderType] = Query(None, description="Filter providers by type"),
    headers: HeaderParams = Depends(get_headers),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Get a list of all custom providers.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    providers = await server.provider_manager.list_providers_async(
        before=before, after=after, limit=limit, actor=actor, name=name, provider_type=provider_type, ascending=(order == "asc")
    )
    return providers


@router.get("/{provider_id}", response_model=Provider, operation_id="retrieve_provider")
async def retrieve_provider(
    provider_id: ProviderId,
    headers: HeaderParams = Depends(get_headers),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Get a provider by ID.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await server.provider_manager.get_provider_async(provider_id=provider_id, actor=actor)


@router.post("/", response_model=Provider, operation_id="create_provider")
async def create_provider(
    request: ProviderCreate = Body(...),
    headers: HeaderParams = Depends(get_headers),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Create a new custom provider.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    for field_name in request.model_fields:
        value = getattr(request, field_name, None)
        if isinstance(value, str) and value == "":
            setattr(request, field_name, None)

    # ProviderCreate no longer has provider_category field
    # API-created providers are always BYOK (bring your own key)
    provider = await server.provider_manager.create_provider_async(request, actor=actor, is_byok=True)
    return provider


@router.patch("/{provider_id}", response_model=Provider, operation_id="modify_provider")
async def modify_provider(
    provider_id: ProviderId,
    request: ProviderUpdate = Body(...),
    headers: HeaderParams = Depends(get_headers),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Update an existing custom provider.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await server.provider_manager.update_provider_async(provider_id=provider_id, provider_update=request, actor=actor)


@router.post("/check", response_model=None, operation_id="check_provider")
async def check_provider(
    request: ProviderCheck = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Verify the API key and additional parameters for a provider.
    """
    if request.base_url and len(request.base_url) == 0:
        # set to null if empty string
        request.base_url = None
    await server.provider_manager.check_provider_api_key(provider_check=request)
    return JSONResponse(
        status_code=status.HTTP_200_OK, content={"message": f"Valid api key for provider_type={request.provider_type.value}"}
    )


@router.post("/{provider_id}/check", response_model=None, operation_id="check_existing_provider")
async def check_existing_provider(
    provider_id: ProviderId,
    headers: HeaderParams = Depends(get_headers),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Verify the API key and additional parameters for an existing provider.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    provider = await server.provider_manager.get_provider_async(provider_id=provider_id, actor=actor)

    # Create a ProviderCheck from the existing provider
    api_key = provider.api_key_enc.get_plaintext() if provider.api_key_enc else None
    access_key = provider.access_key_enc.get_plaintext() if provider.access_key_enc else None
    provider_check = ProviderCheck(
        provider_type=provider.provider_type,
        api_key=api_key,
        access_key=access_key,
        base_url=provider.base_url,
    )

    await server.provider_manager.check_provider_api_key(provider_check=provider_check)
    return JSONResponse(
        status_code=status.HTTP_200_OK, content={"message": f"Valid api key for provider_type={provider.provider_type.value}"}
    )


@router.delete("/{provider_id}", response_model=None, operation_id="delete_provider")
async def delete_provider(
    provider_id: ProviderId,
    headers: HeaderParams = Depends(get_headers),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Delete an existing custom provider.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    await server.provider_manager.delete_provider_by_id_async(provider_id=provider_id, actor=actor)
    return JSONResponse(status_code=status.HTTP_200_OK, content={"message": f"Provider id={provider_id} successfully deleted"})


# =============================================================================
# OAuth Endpoints
# =============================================================================


class OAuthInitiateResponse(BaseModel):
    """Response from OAuth initiation containing the authorization URL."""

    authorization_url: str = Field(..., description="URL to redirect user to for authorization")
    state: str = Field(..., description="State parameter for CSRF protection")
    provider_type: ProviderType = Field(..., description="Type of provider being authenticated")


class OAuthCallbackRequest(BaseModel):
    """Request body for OAuth callback."""

    code: str = Field(..., description="Authorization code from OAuth callback")
    state: str = Field(..., description="State parameter for CSRF protection")
    name: str = Field(..., description="Name for the new provider")
    provider_type: ProviderType = Field(..., description="Type of provider")


@router.post("/oauth/initiate", response_model=OAuthInitiateResponse, operation_id="initiate_oauth")
async def initiate_oauth(
    request: ProviderOAuthInitiate = Body(...),
    headers: HeaderParams = Depends(get_headers),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Initiate OAuth flow for a provider.

    Returns an authorization URL that the user should visit to authorize the application.
    The response includes a state parameter that must be passed back in the callback.

    Currently supported provider types for OAuth:
    - anthropic: Claude Pro/Max subscription authentication
    """
    import hashlib
    import secrets
    from urllib.parse import urlencode

    # Validate provider type supports OAuth
    if request.provider_type != ProviderType.anthropic:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": f"OAuth not supported for provider type: {request.provider_type}"},
        )

    # Generate PKCE code verifier and challenge
    code_verifier = secrets.token_urlsafe(32)
    code_challenge = hashlib.sha256(code_verifier.encode()).digest()
    code_challenge_b64 = code_challenge.hex()  # Use hex for simplicity in demo

    # Generate state for CSRF protection
    state = secrets.token_urlsafe(32)

    # Build authorization URL for Anthropic
    auth_params = {
        "code": "true",
        "client_id": request.oauth_client_id,
        "response_type": "code",
        "redirect_uri": request.oauth_redirect_uri or "https://console.anthropic.com/oauth/code/callback",
        "scope": request.oauth_scope or "org:create_api_key user:profile user:inference",
        "code_challenge": code_challenge_b64,
        "code_challenge_method": "S256",
        "state": state,
    }

    authorization_url = f"https://claude.ai/oauth/authorize?{urlencode(auth_params)}"

    # Store state and code_verifier temporarily (in production, use Redis or similar)
    # For MVP, we'll include the code_verifier in the state (encoded)
    # This is a simplification - production should use server-side storage
    combined_state = f"{state}:{code_verifier}"

    return OAuthInitiateResponse(
        authorization_url=authorization_url,
        state=combined_state,
        provider_type=request.provider_type,
    )


@router.post("/oauth/callback", response_model=Provider, operation_id="complete_oauth")
async def complete_oauth(
    request: OAuthCallbackRequest = Body(...),
    headers: HeaderParams = Depends(get_headers),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Complete OAuth flow and create a new OAuth-authenticated provider.

    This endpoint exchanges the authorization code for access and refresh tokens,
    then creates a new provider with OAuth credentials.
    """
    import aiohttp
    from datetime import datetime, timedelta, timezone

    from letta.schemas.enums import ProviderCategory
    from letta.schemas.providers import Provider as PydanticProvider
    from letta.schemas.secret import Secret

    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    # Validate provider type
    if request.provider_type != ProviderType.anthropic:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": f"OAuth not supported for provider type: {request.provider_type}"},
        )

    # Parse state to extract code_verifier (MVP simplification)
    state_parts = request.state.split(":")
    if len(state_parts) != 2:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": "Invalid state parameter"},
        )

    original_state, code_verifier = state_parts

    # Exchange authorization code for tokens
    from letta.settings import ANTHROPIC_OAUTH_CLIENT_ID

    token_url = "https://console.anthropic.com/v1/oauth/token"
    token_request_data = {
        "code": request.code,
        "state": original_state,
        "grant_type": "authorization_code",
        "client_id": ANTHROPIC_OAUTH_CLIENT_ID,
        "redirect_uri": "https://console.anthropic.com/oauth/code/callback",
        "code_verifier": code_verifier,
    }

    async with aiohttp.ClientSession() as session:
        async with session.post(
            token_url,
            json=token_request_data,
            headers={
                "Content-Type": "application/json",
                "anthropic-beta": "oauth-2025-04-20",
            },
        ) as response:
            if response.status != 200:
                error_text = await response.text()
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={"error": f"Token exchange failed: {error_text}"},
                )

            token_data = await response.json()

    # Create provider with OAuth credentials
    from letta.orm.provider import Provider as ProviderModel

    expires_at = datetime.now(timezone.utc) + timedelta(seconds=token_data.get("expires_in", 3600))

    provider = PydanticProvider(
        name=request.name,
        provider_type=request.provider_type,
        provider_category=ProviderCategory.byok,
        organization_id=actor.organization_id,
        auth_type="oauth",
        oauth_access_token_enc=Secret.from_plaintext(token_data["access_token"]).get_encrypted(),
        oauth_refresh_token_enc=Secret.from_plaintext(token_data.get("refresh_token")).get_encrypted()
        if token_data.get("refresh_token")
        else None,
        oauth_token_type=token_data.get("token_type", "Bearer"),
        oauth_expires_at=expires_at,
        oauth_scope=token_data.get("scope"),
        oauth_client_id=ANTHROPIC_OAUTH_CLIENT_ID,
    )

    provider.resolve_identifier()

    # Persist the provider using the db_registry
    from letta.server.db import db_registry

    async with db_registry.async_session() as db_session:
        new_provider = ProviderModel(**provider.model_dump(to_orm=True, exclude_unset=True))
        await new_provider.create_async(db_session, actor=actor)
        return new_provider.to_pydantic()


@router.post("/{provider_id}/oauth/refresh", response_model=Provider, operation_id="refresh_oauth_token")
async def refresh_oauth_token(
    provider_id: ProviderId,
    headers: HeaderParams = Depends(get_headers),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Manually refresh OAuth tokens for a provider.

    This endpoint forces a token refresh even if the current token hasn't expired.
    Useful for testing or when you need to ensure tokens are fresh.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    # Get the provider
    provider = await server.provider_manager.get_provider_async(provider_id=provider_id, actor=actor)

    # Verify it's an OAuth provider
    if not provider.is_oauth_provider():
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": "Provider does not use OAuth authentication"},
        )

    # Force token refresh
    refreshed_provider = await server.provider_manager._refresh_oauth_token_async(provider, actor)

    return refreshed_provider
