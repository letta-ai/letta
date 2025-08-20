"""
This module tracks and manages deployed app versions. We currently use the tools.metadata field
to store the information detailing modal deployments and when we need to redeploy due to changes.
Modal Version Manager - Tracks and manages deployed Modal app versions.
"""

import asyncio
import time
from datetime import datetime
from typing import Any

import modal
from pydantic import BaseModel, ConfigDict, Field

from letta.log import get_logger
from letta.schemas.tool import ToolUpdate
from letta.services.tool_manager import ToolManager
from letta.services.tool_sandbox.modal_constants import CACHE_TTL_SECONDS, DEFAULT_CONFIG_KEY, MODAL_DEPLOYMENTS_KEY

logger = get_logger(__name__)


class DeploymentInfo(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    """Information about a deployed Modal app."""

    app_name: str = Field(..., description="The name of the modal app.")
    version_hash: str = Field(..., description="The version hash of the modal app.")
    deployed_at: datetime = Field(..., description="The time the modal app was deployed.")
    dependencies: set[str] = Field(default_factory=set, description="A set of dependencies.")
    # app_reference: modal.App | None = Field(None, description="The reference to the modal app.", exclude=True)
    app_reference: Any = Field(None, description="The reference to the modal app.", exclude=True)


class ModalVersionManager:
    """Manages versions and deployments of Modal apps using tools.metadata."""

    def __init__(self):
        self.tool_manager = ToolManager()
        self._deployment_locks: dict[str, asyncio.Lock] = {}
        self._cache: dict[str, tuple[DeploymentInfo, float]] = {}
        self._deployments_in_progress: dict[str, asyncio.Event] = {}
        self._deployments: dict[str, DeploymentInfo] = {}  # Track all deployments for stats

    @staticmethod
    def _make_cache_key(tool_id: str, sandbox_config_id: str | None = None) -> str:
        """Generate cache key for tool and config combination."""
        return f"{tool_id}:{sandbox_config_id or DEFAULT_CONFIG_KEY}"

    @staticmethod
    def _get_config_key(sandbox_config_id: str | None = None) -> str:
        """Get standardized config key."""
        return sandbox_config_id or DEFAULT_CONFIG_KEY

    def _is_cache_valid(self, timestamp: float) -> bool:
        """Check if cache entry is still valid."""
        return time.time() - timestamp < CACHE_TTL_SECONDS

    def _get_deployment_metadata(self, tool) -> dict:
        """Get or initialize modal deployments metadata."""
        if not tool.metadata_:
            tool.metadata_ = {}
        if MODAL_DEPLOYMENTS_KEY not in tool.metadata_:
            tool.metadata_[MODAL_DEPLOYMENTS_KEY] = {}
        return tool.metadata_[MODAL_DEPLOYMENTS_KEY]

    def _create_deployment_data(self, app_name: str, version_hash: str, dependencies: set[str]) -> dict:
        """Create deployment data dictionary for metadata storage."""
        return {
            "app_name": app_name,
            "version_hash": version_hash,
            "deployed_at": datetime.now().isoformat(),
            "dependencies": list(dependencies),
        }

    async def get_deployment(self, tool_id: str, sandbox_config_id: str | None = None, actor=None) -> DeploymentInfo | None:
        """Get deployment info from tool metadata."""
        cache_key = self._make_cache_key(tool_id, sandbox_config_id)

        if cache_key in self._cache:
            info, timestamp = self._cache[cache_key]
            if self._is_cache_valid(timestamp):
                return info

        tool = self.tool_manager.get_tool_by_id(tool_id, actor=actor)
        if not tool or not tool.metadata_:
            return None

        modal_deployments = tool.metadata_.get(MODAL_DEPLOYMENTS_KEY, {})
        config_key = self._get_config_key(sandbox_config_id)

        if config_key not in modal_deployments:
            return None

        deployment_data = modal_deployments[config_key]

        info = DeploymentInfo(
            app_name=deployment_data["app_name"],
            version_hash=deployment_data["version_hash"],
            deployed_at=datetime.fromisoformat(deployment_data["deployed_at"]),
            dependencies=set(deployment_data.get("dependencies", [])),
            app_reference=None,
        )

        self._cache[cache_key] = (info, time.time())
        return info

    async def register_deployment(
        self,
        tool_id: str,
        app_name: str,
        version_hash: str,
        app: modal.App,
        dependencies: set[str] | None = None,
        sandbox_config_id: str | None = None,
        actor=None,
    ) -> DeploymentInfo:
        """Register a new deployment in tool metadata."""
        cache_key = self._make_cache_key(tool_id, sandbox_config_id)
        config_key = self._get_config_key(sandbox_config_id)

        async with self.get_deployment_lock(cache_key):
            tool = self.tool_manager.get_tool_by_id(tool_id, actor=actor)
            if not tool:
                raise ValueError(f"Tool {tool_id} not found")

            modal_deployments = self._get_deployment_metadata(tool)

            info = DeploymentInfo(
                app_name=app_name,
                version_hash=version_hash,
                deployed_at=datetime.now(),
                dependencies=dependencies or set(),
                app_reference=app,
            )

            modal_deployments[config_key] = self._create_deployment_data(app_name, version_hash, info.dependencies)

            # Use ToolUpdate to update metadata
            tool_update = ToolUpdate(metadata_=tool.metadata_)
            await self.tool_manager.update_tool_by_id_async(
                tool_id=tool_id,
                tool_update=tool_update,
                actor=actor,
            )

            self._cache[cache_key] = (info, time.time())
            self._deployments[cache_key] = info  # Track for stats
            return info

    async def needs_redeployment(self, tool_id: str, current_version: str, sandbox_config_id: str | None = None, actor=None) -> bool:
        """Check if an app needs to be redeployed."""
        deployment = await self.get_deployment(tool_id, sandbox_config_id, actor=actor)
        if not deployment:
            return True
        return deployment.version_hash != current_version

    def get_deployment_lock(self, cache_key: str) -> asyncio.Lock:
        """Get or create a deployment lock for a tool+config combination."""
        if cache_key not in self._deployment_locks:
            self._deployment_locks[cache_key] = asyncio.Lock()
        return self._deployment_locks[cache_key]

    def mark_deployment_in_progress(self, cache_key: str, version_hash: str) -> str:
        """Mark that a deployment is in progress for a specific version.

        Returns a unique deployment ID that should be used to complete/fail the deployment.
        """
        deployment_key = f"{cache_key}:{version_hash}"
        if deployment_key not in self._deployments_in_progress:
            self._deployments_in_progress[deployment_key] = asyncio.Event()
        return deployment_key

    def is_deployment_in_progress(self, cache_key: str, version_hash: str) -> bool:
        """Check if a deployment is currently in progress."""
        deployment_key = f"{cache_key}:{version_hash}"
        return deployment_key in self._deployments_in_progress

    async def wait_for_deployment(self, cache_key: str, version_hash: str, timeout: float = 120) -> bool:
        """Wait for an in-progress deployment to complete.

        Returns True if deployment completed within timeout, False otherwise.
        """
        deployment_key = f"{cache_key}:{version_hash}"
        if deployment_key not in self._deployments_in_progress:
            return True  # No deployment in progress

        event = self._deployments_in_progress[deployment_key]
        try:
            await asyncio.wait_for(event.wait(), timeout=timeout)
            return True
        except asyncio.TimeoutError:
            return False

    def complete_deployment(self, deployment_key: str):
        """Mark a deployment as complete and wake up any waiters."""
        if deployment_key in self._deployments_in_progress:
            self._deployments_in_progress[deployment_key].set()
            # Clean up after a short delay to allow waiters to wake up
            asyncio.create_task(self._cleanup_deployment_marker(deployment_key))

    async def _cleanup_deployment_marker(self, deployment_key: str):
        """Clean up deployment marker after a delay."""
        await asyncio.sleep(5)  # Give waiters time to wake up
        if deployment_key in self._deployments_in_progress:
            del self._deployments_in_progress[deployment_key]

    async def force_redeploy(self, tool_id: str, sandbox_config_id: str | None = None, actor=None):
        """Force a redeployment by removing deployment info from tool metadata."""
        cache_key = self._make_cache_key(tool_id, sandbox_config_id)
        config_key = self._get_config_key(sandbox_config_id)

        async with self.get_deployment_lock(cache_key):
            tool = self.tool_manager.get_tool_by_id(tool_id, actor=actor)
            if not tool or not tool.metadata_:
                return

            modal_deployments = tool.metadata_.get(MODAL_DEPLOYMENTS_KEY, {})
            if config_key in modal_deployments:
                del modal_deployments[config_key]

                # Use ToolUpdate to update metadata
                tool_update = ToolUpdate(metadata_=tool.metadata_)
                await self.tool_manager.update_tool_by_id_async(
                    tool_id=tool_id,
                    tool_update=tool_update,
                    actor=actor,
                )

                if cache_key in self._cache:
                    del self._cache[cache_key]

    def clear_deployments(self):
        """Clear all deployment tracking (for testing purposes)."""
        self._deployments.clear()
        self._cache.clear()
        self._deployments_in_progress.clear()

    async def get_deployment_stats(self) -> dict:
        """Get statistics about current deployments."""
        total_deployments = len(self._deployments)
        active_deployments = len([d for d in self._deployments.values() if d])
        stale_deployments = total_deployments - active_deployments

        deployments_list = []
        for cache_key, deployment in self._deployments.items():
            if deployment:
                deployments_list.append(
                    {
                        "app_name": deployment.app_name,
                        "version": deployment.version_hash,
                        "usage_count": 1,  # Track usage in future
                        "deployed_at": deployment.deployed_at.isoformat(),
                    }
                )

        return {
            "total_deployments": total_deployments,
            "active_deployments": active_deployments,
            "stale_deployments": stale_deployments,
            "deployments": deployments_list,
        }


_version_manager = None


def get_version_manager() -> ModalVersionManager:
    """Get the global Modal version manager instance."""
    global _version_manager
    if _version_manager is None:
        _version_manager = ModalVersionManager()
    return _version_manager
