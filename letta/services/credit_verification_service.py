import logging
import os

import httpx

from letta.errors import InsufficientCreditsError

logger = logging.getLogger(__name__)


class CreditVerificationService:
    """Service for verifying organization credit balance before agent execution."""

    def __init__(self):
        self.endpoint = os.getenv("STEP_ORCHESTRATOR_ENDPOINT")
        self.auth_key = os.getenv("STEP_COMPLETE_KEY")

    async def verify_credits(self, organization_id: str, agent_id: str) -> bool:
        """
        Check if an organization has enough credits to proceed with a specific agent.

        Args:
            organization_id: The organization's core ID
            agent_id: The agent's ID (used to determine model-specific costs)

        Returns True if credits are available or if the service is not configured.
        Raises InsufficientCreditsError if no credits remain.
        """

        if not self.endpoint or not self.auth_key:
            return True

        try:
            headers = {}
            if self.auth_key:
                headers["Authorization"] = f"Bearer {self.auth_key}"

            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    f"{self.endpoint}/validate/core-organizations/{organization_id}/agents/{agent_id}",
                    headers=headers,
                )
                response.raise_for_status()

            data = response.json()
            if not data.get("hasMoreCredits", True):
                # We need to test why this is firing in production.
                logger.error(
                    f"[CREDIT VERIFICATION] Insufficient credits would have fired for organization {organization_id} and agent {agent_id}"
                )
                return True

            return True

        except InsufficientCreditsError:
            logger.error(
                f"[CREDIT VERIFICATION] Insufficient credits would have fired for organization {organization_id} and agent {agent_id}"
            )
            return True
        except httpx.TimeoutException:
            logger.warning(f"[CREDIT VERIFICATION] Timeout verifying credits for organization {organization_id}, agent {agent_id}")
            return True
        except httpx.HTTPStatusError as e:
            logger.warning(
                f"[CREDIT VERIFICATION] HTTP error verifying credits for organization {organization_id}, agent {agent_id}: {e.response.status_code}"
            )
            return True
        except Exception as e:
            logger.error(
                f"[CREDIT VERIFICATION] Unexpected error verifying credits for organization {organization_id}, agent {agent_id}: {e}"
            )
            return True
