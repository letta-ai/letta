"""Base class for provider trace backends."""

from abc import ABC, abstractmethod
from enum import Enum
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from letta.schemas.provider_trace import ProviderTrace
    from letta.schemas.user import User


class ProviderTraceBackend(str, Enum):
    """Supported provider trace storage backends."""

    POSTGRES = "postgres"
    CLICKHOUSE = "clickhouse"
    SOCKET = "socket"


class ProviderTraceBackendClient(ABC):
    """Abstract base class for provider trace storage backends."""

    @abstractmethod
    async def create_async(
        self,
        actor: "User",
        provider_trace: "ProviderTrace",
    ) -> "ProviderTrace | None":
        """
        Store a provider trace record.

        Args:
            actor: The user/actor creating the trace
            provider_trace: The trace data to store

        Returns:
            The created ProviderTrace, or None if the backend doesn't return it
        """
        raise NotImplementedError

    @abstractmethod
    async def get_by_step_id_async(
        self,
        step_id: str,
        actor: "User",
    ) -> "ProviderTrace | None":
        """
        Retrieve a provider trace by step ID.

        Args:
            step_id: The step ID to look up
            actor: The user/actor requesting the trace

        Returns:
            The ProviderTrace if found, None otherwise
        """
        raise NotImplementedError

    def create_sync(
        self,
        actor: "User",
        provider_trace: "ProviderTrace",
    ) -> "ProviderTrace | None":
        """
        Synchronous version of create_async.

        Default implementation does nothing. Override if sync support is needed.
        """
        return None
