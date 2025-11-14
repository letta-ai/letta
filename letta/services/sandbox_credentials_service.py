import logging
import os
from typing import Any, Dict, Optional

import httpx

from letta.schemas.user import User

logger = logging.getLogger(__name__)


class SandboxCredentialsService:
    """Service for fetching sandbox credentials from a webhook."""

    def __init__(self):
        self.credentials_webhook_url = os.getenv("STEP_ORCHESTRATOR_ENDPOINT")
        self.credentials_webhook_key = os.getenv("STEP_COMPLETE_KEY")

    async def fetch_credentials(
        self,
        actor: User,
        tool_name: Optional[str] = None,
        agent_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Fetch sandbox credentials from the configured webhook.

        Args:
            actor: The user executing the tool
            tool_name: Optional name of the tool being executed
            agent_id: Optional ID of the agent executing the tool

        Returns:
            Dict[str, Any]: Dictionary of environment variables to add to sandbox
        """
        if not self.credentials_webhook_url:
            logger.debug("SANDBOX_CREDENTIALS_WEBHOOK not configured, skipping credentials fetch")
            return {}

        try:
            headers = {}
            if self.credentials_webhook_key:
                headers["Authorization"] = f"Bearer {self.credentials_webhook_key}"

            payload = {
                "user_id": actor.id,
                "organization_id": actor.organization_id,
            }

            if tool_name:
                payload["tool_name"] = tool_name
            if agent_id:
                payload["agent_id"] = agent_id

            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    self.credentials_webhook_url + "/webhook/sandbox-credentials",
                    json=payload,
                    headers=headers,
                )
                response.raise_for_status()

            response_data = response.json()

            if not isinstance(response_data, dict):
                logger.warning(f"Invalid response format from credentials webhook: expected dict, got {type(response_data)}")
                return {}

            logger.info(f"Successfully fetched sandbox credentials for user {actor.id}")
            return response_data

        except httpx.TimeoutException:
            logger.warning(f"Timeout fetching sandbox credentials for user {actor.id}")
            return {}
        except httpx.HTTPStatusError as e:
            logger.warning(f"HTTP error fetching sandbox credentials for user {actor.id}: {e.response.status_code}")
            return {}
        except Exception as e:
            logger.error(f"Unexpected error fetching sandbox credentials for user {actor.id}: {e}")
            return {}
