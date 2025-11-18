import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


class WebhookService:
    """Service for sending webhook notifications when steps complete."""

    def __init__(self):
        self.webhook_url = os.getenv("STEP_COMPLETE_WEBHOOK")
        self.webhook_key = os.getenv("STEP_COMPLETE_KEY")

    async def notify_step_complete(self, step_id: str) -> bool:
        """
        Send a POST request to the configured webhook URL when a step completes.

        Args:
            step_id: The ID of the completed step

        Returns:
            bool: True if notification was sent successfully, False otherwise
        """
        if not self.webhook_url:
            logger.debug("STEP_COMPLETE_WEBHOOK not configured, skipping webhook notification")
            return False

        try:
            headers = {}
            if self.webhook_key:
                headers["Authorization"] = f"Bearer {self.webhook_key}"

            payload = {"step_id": step_id}

            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    self.webhook_url,
                    json=payload,
                    headers=headers,
                )
                response.raise_for_status()

            logger.info(f"Successfully sent step completion webhook for step {step_id}")
            return True

        except httpx.TimeoutException:
            logger.warning(f"Timeout sending step completion webhook for step {step_id}")
            return False
        except httpx.HTTPStatusError as e:
            logger.warning(f"HTTP error sending step completion webhook for step {step_id}: {e.response.status_code}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error sending step completion webhook for step {step_id}: {e}")
            return False
