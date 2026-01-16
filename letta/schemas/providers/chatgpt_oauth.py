"""ChatGPT OAuth Provider - uses chatgpt.com/backend-api/codex with OAuth authentication."""

import json
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Literal, Optional

import httpx
from pydantic import BaseModel, Field

from letta.errors import ErrorCode, LLMAuthenticationError, LLMError
from letta.log import get_logger
from letta.schemas.enums import ProviderCategory, ProviderType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.providers.base import Provider
from letta.schemas.secret import Secret

if TYPE_CHECKING:
    from letta.orm import User

logger = get_logger(__name__)

# ChatGPT Backend API Configuration
CHATGPT_CODEX_ENDPOINT = "https://chatgpt.com/backend-api/codex/responses"
CHATGPT_TOKEN_REFRESH_URL = "https://auth.openai.com/oauth/token"

# OAuth client_id for Codex CLI (required for token refresh)
# Must match the client_id used in the initial OAuth authorization flow
# This is the public client_id used by Codex CLI / Letta Code
CHATGPT_OAUTH_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann"

# Token refresh buffer (refresh 5 minutes before expiry)
TOKEN_REFRESH_BUFFER_SECONDS = 300

# Hardcoded models available via ChatGPT backend
# These are models that can be accessed through ChatGPT Plus/Pro subscriptions
# Model list based on opencode-openai-codex-auth plugin presets
# Reasoning effort levels are configured via llm_config.reasoning_effort
CHATGPT_MODELS = [
    # GPT-5.2 models (supports none/low/medium/high/xhigh reasoning)
    {"name": "gpt-5.2", "context_window": 272000},
    {"name": "gpt-5.2-codex", "context_window": 272000},
    # GPT-5.1 models
    {"name": "gpt-5.1", "context_window": 272000},
    {"name": "gpt-5.1-codex", "context_window": 272000},
    {"name": "gpt-5.1-codex-mini", "context_window": 272000},
    {"name": "gpt-5.1-codex-max", "context_window": 272000},
    # GPT-5 Codex models (original)
    {"name": "gpt-5-codex-mini", "context_window": 272000},
    # GPT-4 models (for ChatGPT Plus users)
    {"name": "gpt-4o", "context_window": 128000},
    {"name": "gpt-4o-mini", "context_window": 128000},
    {"name": "o1", "context_window": 200000},
    {"name": "o1-pro", "context_window": 200000},
    {"name": "o3", "context_window": 200000},
    {"name": "o3-mini", "context_window": 200000},
    {"name": "o4-mini", "context_window": 200000},
]


class ChatGPTOAuthCredentials(BaseModel):
    """OAuth credentials for ChatGPT backend API access.

    These credentials are stored as JSON in the provider's api_key_enc field.
    """

    access_token: str = Field(..., description="OAuth access token for ChatGPT API")
    refresh_token: str = Field(..., description="OAuth refresh token for obtaining new access tokens")
    account_id: str = Field(..., description="ChatGPT account ID for the ChatGPT-Account-Id header")
    expires_at: int = Field(..., description="Unix timestamp when the access_token expires")

    def is_expired(self, buffer_seconds: int = TOKEN_REFRESH_BUFFER_SECONDS) -> bool:
        """Check if token is expired or will expire within buffer_seconds.

        Handles both seconds and milliseconds timestamps (auto-detects based on magnitude).
        """
        expires_at = self.expires_at
        # Auto-detect milliseconds (13+ digits) vs seconds (10 digits)
        # Timestamps > 10^12 are definitely milliseconds (year 33658 in seconds)
        if expires_at > 10**12:
            expires_at = expires_at // 1000  # Convert ms to seconds

        current_time = datetime.now(timezone.utc).timestamp()
        is_expired = current_time >= (expires_at - buffer_seconds)
        logger.debug(f"Token expiry check: current={current_time}, expires_at={expires_at}, buffer={buffer_seconds}, expired={is_expired}")
        return is_expired

    def to_json(self) -> str:
        """Serialize to JSON string for storage in api_key_enc."""
        return self.model_dump_json()

    @classmethod
    def from_json(cls, json_str: str) -> "ChatGPTOAuthCredentials":
        """Deserialize from JSON string stored in api_key_enc."""
        data = json.loads(json_str)
        return cls(**data)


class ChatGPTOAuthProvider(Provider):
    """
    ChatGPT OAuth Provider for accessing ChatGPT's backend-api with OAuth tokens.

    This provider enables using ChatGPT Plus/Pro subscription credentials to access
    OpenAI models through the ChatGPT backend API at chatgpt.com/backend-api/codex.

    OAuth credentials are stored as JSON in the api_key_enc field:
    {
        "access_token": "...",
        "refresh_token": "...",
        "account_id": "...",
        "expires_at": 1234567890
    }

    The client (e.g., Letta Code) performs the OAuth flow and sends the credentials
    to the backend via the provider creation API.
    """

    provider_type: Literal[ProviderType.chatgpt_oauth] = Field(
        ProviderType.chatgpt_oauth,
        description="The type of the provider.",
    )
    provider_category: ProviderCategory = Field(
        ProviderCategory.byok,  # Always BYOK since it uses user's OAuth credentials
        description="The category of the provider (always byok for OAuth)",
    )
    base_url: str = Field(
        CHATGPT_CODEX_ENDPOINT,
        description="Base URL for the ChatGPT backend API.",
    )

    async def get_oauth_credentials(self) -> Optional[ChatGPTOAuthCredentials]:
        """Retrieve and parse OAuth credentials from api_key_enc.

        Returns:
            ChatGPTOAuthCredentials if valid credentials exist, None otherwise.
        """
        if not self.api_key_enc:
            return None

        json_str = await self.api_key_enc.get_plaintext_async()
        if not json_str:
            return None

        try:
            return ChatGPTOAuthCredentials.from_json(json_str)
        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f"Failed to parse ChatGPT OAuth credentials: {e}")
            return None

    async def refresh_token_if_needed(
        self, actor: Optional["User"] = None, force_refresh: bool = False
    ) -> Optional[ChatGPTOAuthCredentials]:
        """Check if token needs refresh and refresh if necessary.

        This method is called before each API request to ensure valid credentials.
        Tokens are refreshed 5 minutes before expiry to avoid edge cases.

        Args:
            actor: The user performing the action. Required for persisting refreshed credentials.
            force_refresh: If True, always refresh the token regardless of expiry. For testing only.

        Returns:
            Updated credentials if successful, None on failure.
        """
        creds = await self.get_oauth_credentials()
        if not creds:
            return None

        if not creds.is_expired() and not force_refresh:
            return creds

        # Token needs refresh
        logger.debug(f"ChatGPT OAuth token refresh triggered (expired={creds.is_expired()}, force={force_refresh})")

        try:
            new_creds = await self._perform_token_refresh(creds)
            # Update stored credentials in memory and persist to database
            await self._update_stored_credentials(new_creds, actor=actor)
            return new_creds
        except Exception as e:
            logger.error(f"Failed to refresh ChatGPT OAuth token: {e}")
            # If refresh fails but original access_token is still valid, use it
            if not creds.is_expired():
                logger.warning("Token refresh failed, but original access_token is still valid - using existing token")
                return creds
            # Both refresh failed AND token is expired - return None to trigger auth error
            return None

    async def _perform_token_refresh(self, creds: ChatGPTOAuthCredentials) -> ChatGPTOAuthCredentials:
        """Perform OAuth token refresh with OpenAI's token endpoint.

        Args:
            creds: Current credentials containing the refresh_token.

        Returns:
            New ChatGPTOAuthCredentials with refreshed access_token.

        Raises:
            LLMAuthenticationError: If refresh fails due to invalid credentials.
            LLMError: If refresh fails due to network or server error.
        """
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    CHATGPT_TOKEN_REFRESH_URL,
                    data={
                        "grant_type": "refresh_token",
                        "refresh_token": creds.refresh_token,
                        "client_id": CHATGPT_OAUTH_CLIENT_ID,
                    },
                    headers={
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    timeout=30.0,
                )
                response.raise_for_status()
                data = response.json()

                # Calculate new expiry time
                expires_in = data.get("expires_in", 3600)
                new_expires_at = int(datetime.now(timezone.utc).timestamp()) + expires_in

                new_access_token = data["access_token"]
                new_refresh_token = data.get("refresh_token", creds.refresh_token)

                logger.debug(f"ChatGPT OAuth token refreshed, expires_in={expires_in}s")

                return ChatGPTOAuthCredentials(
                    access_token=new_access_token,
                    refresh_token=new_refresh_token,
                    account_id=creds.account_id,  # Account ID doesn't change
                    expires_at=new_expires_at,
                )
            except httpx.HTTPStatusError as e:
                # Log full error details for debugging
                try:
                    error_body = e.response.json()
                    logger.error(f"Token refresh HTTP error: {e.response.status_code} - JSON: {error_body}")
                except Exception:
                    logger.error(f"Token refresh HTTP error: {e.response.status_code} - Text: {e.response.text}")
                if e.response.status_code == 401:
                    raise LLMAuthenticationError(
                        message="Failed to refresh ChatGPT OAuth token: refresh token is invalid or expired",
                        code=ErrorCode.UNAUTHENTICATED,
                    )
                raise LLMError(
                    message=f"Failed to refresh ChatGPT OAuth token: {e}",
                    code=ErrorCode.INTERNAL_SERVER_ERROR,
                )
            except Exception as e:
                logger.error(f"Token refresh error: {type(e).__name__}: {e}")
                raise LLMError(
                    message=f"Failed to refresh ChatGPT OAuth token: {e}",
                    code=ErrorCode.INTERNAL_SERVER_ERROR,
                )

    async def _update_stored_credentials(self, creds: ChatGPTOAuthCredentials, actor: Optional["User"] = None) -> None:
        """Update stored credentials in memory and persist to database.

        Args:
            creds: New credentials to store.
            actor: The user performing the action. Required for database persistence.
        """
        new_secret = await Secret.from_plaintext_async(creds.to_json())
        # Update in-memory value
        object.__setattr__(self, "api_key_enc", new_secret)

        # Persist to database if we have an actor and provider ID
        if actor and self.id:
            try:
                from letta.schemas.providers.base import ProviderUpdate
                from letta.services.provider_manager import ProviderManager

                provider_manager = ProviderManager()
                await provider_manager.update_provider_async(
                    provider_id=self.id,
                    provider_update=ProviderUpdate(api_key=creds.to_json()),
                    actor=actor,
                )
            except Exception as e:
                logger.error(f"Failed to persist refreshed credentials to database: {e}")
                # Don't fail the request - we have valid credentials in memory

    async def check_api_key(self):
        """Validate the OAuth credentials by checking token validity.

        Raises:
            ValueError: If no credentials are configured.
            LLMAuthenticationError: If credentials are invalid.
        """
        creds = await self.get_oauth_credentials()
        if not creds:
            raise ValueError("No ChatGPT OAuth credentials configured")

        # Try to refresh if needed
        creds = await self.refresh_token_if_needed()
        if not creds:
            raise LLMAuthenticationError(
                message="Failed to obtain valid ChatGPT OAuth credentials",
                code=ErrorCode.UNAUTHENTICATED,
            )

        # Optionally make a test request to validate
        # For now, we just verify we have valid-looking credentials
        if not creds.access_token or not creds.account_id:
            raise LLMAuthenticationError(
                message="ChatGPT OAuth credentials are incomplete",
                code=ErrorCode.UNAUTHENTICATED,
            )

    def get_default_max_output_tokens(self, model_name: str) -> int:
        """Get the default max output tokens for ChatGPT models."""
        # Reasoning models (o-series) have higher limits
        if model_name.startswith("o1") or model_name.startswith("o3") or model_name.startswith("o4"):
            return 100000
        # GPT-5.x models
        elif "gpt-5" in model_name:
            return 16384
        # GPT-4 models
        elif "gpt-4" in model_name:
            return 16384
        return 4096

    async def list_llm_models_async(self) -> list[LLMConfig]:
        """List available models from ChatGPT backend.

        Returns a hardcoded list of models available via ChatGPT Plus/Pro subscriptions.
        """
        creds = await self.get_oauth_credentials()
        if not creds:
            logger.warning("Cannot list models: no valid ChatGPT OAuth credentials")
            return []

        configs = []
        for model in CHATGPT_MODELS:
            model_name = model["name"]
            context_window = model["context_window"]

            configs.append(
                LLMConfig(
                    model=model_name,
                    model_endpoint_type="chatgpt_oauth",
                    model_endpoint=self.base_url,
                    context_window=context_window,
                    handle=self.get_handle(model_name),
                    max_tokens=self.get_default_max_output_tokens(model_name),
                    provider_name=self.name,
                    provider_category=self.provider_category,
                )
            )

        return configs

    async def list_embedding_models_async(self) -> list:
        """ChatGPT backend does not support embedding models."""
        return []

    def get_model_context_window(self, model_name: str) -> int | None:
        """Get the context window for a model."""
        for model in CHATGPT_MODELS:
            if model["name"] == model_name:
                return model["context_window"]
        return 128000  # Default

    async def get_model_context_window_async(self, model_name: str) -> int | None:
        """Get the context window for a model (async version)."""
        return self.get_model_context_window(model_name)
