"""
Modal Deployment Manager - Handles deployment orchestration with optional locking.

This module separates deployment logic from the main sandbox execution,
making it easier to understand and optionally disable locking/version tracking.
"""

import hashlib
from typing import Tuple

import modal

from letta.log import get_logger
from letta.schemas.sandbox_config import SandboxConfig
from letta.schemas.tool import Tool
from letta.services.tool_sandbox.modal_constants import VERSION_HASH_LENGTH
from letta.services.tool_sandbox.modal_version_manager import ModalVersionManager, get_version_manager

logger = get_logger(__name__)


class ModalDeploymentManager:
    """Manages Modal app deployments with optional locking and version tracking."""

    def __init__(
        self,
        tool: Tool,
        version_manager: ModalVersionManager | None = None,
        use_locking: bool = True,
        use_version_tracking: bool = True,
    ):
        """
        Initialize deployment manager.

        Args:
            tool: The tool to deploy
            version_manager: Version manager for tracking deployments (optional)
            use_locking: Whether to use locking for coordinated deployments
            use_version_tracking: Whether to track and reuse existing deployments
        """
        self.tool = tool
        self.version_manager = version_manager or get_version_manager() if (use_locking or use_version_tracking) else None
        self.use_locking = use_locking
        self.use_version_tracking = use_version_tracking
        self._app_name = self._generate_app_name()

    def _generate_app_name(self) -> str:
        """Generate app name based on tool ID."""
        return self.tool.id[:40]

    def calculate_version_hash(self, sbx_config: SandboxConfig) -> str:
        """Calculate version hash for the current configuration."""
        components = (
            self.tool.source_code,
            str(self.tool.pip_requirements) if self.tool.pip_requirements else "",
            str(self.tool.npm_requirements) if self.tool.npm_requirements else "",
            sbx_config.fingerprint(),
        )
        combined = "|".join(components)
        return hashlib.sha256(combined.encode()).hexdigest()[:VERSION_HASH_LENGTH]

    def get_full_app_name(self, version_hash: str) -> str:
        """Get the full app name including version."""
        app_full_name = f"{self._app_name}-{version_hash}"
        # Ensure total length is under 64 characters
        if len(app_full_name) > 63:
            max_id_len = 63 - len(version_hash) - 1
            app_full_name = f"{self._app_name[:max_id_len]}-{version_hash}"
        return app_full_name

    async def get_or_deploy_app(
        self,
        sbx_config: SandboxConfig,
        user,
        create_app_func,
    ) -> Tuple[modal.App, str]:
        """
        Get existing app or deploy new one.

        Args:
            sbx_config: Sandbox configuration
            user: User/actor for permissions
            create_app_func: Function to create and deploy the app

        Returns:
            Tuple of (Modal app, version hash)
        """
        version_hash = self.calculate_version_hash(sbx_config)

        # Simple path: no version tracking or locking
        if not self.use_version_tracking:
            logger.info(f"Deploying Modal app {self._app_name} (version tracking disabled)")
            app = await create_app_func(sbx_config, version_hash)
            return app, version_hash

        # Try to use existing deployment
        if self.use_version_tracking:
            existing_app = await self._try_get_existing_app(sbx_config, version_hash, user)
            if existing_app:
                return existing_app, version_hash

        # Need to deploy - with or without locking
        if self.use_locking:
            return await self._deploy_with_locking(sbx_config, version_hash, user, create_app_func)
        else:
            return await self._deploy_without_locking(sbx_config, version_hash, user, create_app_func)

    async def _try_get_existing_app(
        self,
        sbx_config: SandboxConfig,
        version_hash: str,
        user,
    ) -> modal.App | None:
        """Try to get an existing deployed app."""
        if not self.version_manager:
            return None

        deployment = await self.version_manager.get_deployment(
            tool_id=self.tool.id, sandbox_config_id=sbx_config.id if sbx_config else None, actor=user
        )

        if deployment and deployment.version_hash == version_hash:
            app_full_name = self.get_full_app_name(version_hash)
            logger.info(f"Checking for existing Modal app {app_full_name}")

            try:
                app = await modal.App.lookup.aio(app_full_name)
                logger.info(f"Found existing Modal app {app_full_name}")
                return app
            except Exception:
                logger.info(f"Modal app {app_full_name} not found in Modal, will redeploy")
                return None

        return None

    async def _deploy_without_locking(
        self,
        sbx_config: SandboxConfig,
        version_hash: str,
        user,
        create_app_func,
    ) -> Tuple[modal.App, str]:
        """Deploy without locking - simpler but may have race conditions."""
        app_full_name = self.get_full_app_name(version_hash)
        logger.info(f"Deploying Modal app {app_full_name} (no locking)")

        # Deploy the app
        app = await create_app_func(sbx_config, version_hash)

        # Register deployment if tracking is enabled
        if self.use_version_tracking and self.version_manager:
            await self._register_deployment(sbx_config, version_hash, app, user)

        return app, version_hash

    async def _deploy_with_locking(
        self,
        sbx_config: SandboxConfig,
        version_hash: str,
        user,
        create_app_func,
    ) -> Tuple[modal.App, str]:
        """Deploy with locking to prevent concurrent deployments."""
        cache_key = f"{self.tool.id}:{sbx_config.id if sbx_config else 'default'}"
        deployment_lock = self.version_manager.get_deployment_lock(cache_key)

        async with deployment_lock:
            # Double-check after acquiring lock
            existing_app = await self._try_get_existing_app(sbx_config, version_hash, user)
            if existing_app:
                return existing_app, version_hash

            # Check if another process is deploying
            if self.version_manager.is_deployment_in_progress(cache_key, version_hash):
                logger.info(f"Another process is deploying {self._app_name} v{version_hash}, waiting...")
                # Release lock and wait
                deployment_lock = None

        # Wait for other deployment if needed
        if deployment_lock is None:
            success = await self.version_manager.wait_for_deployment(cache_key, version_hash, timeout=120)
            if success:
                existing_app = await self._try_get_existing_app(sbx_config, version_hash, user)
                if existing_app:
                    return existing_app, version_hash
                raise RuntimeError(f"Deployment completed but app not found")
            else:
                raise RuntimeError(f"Timeout waiting for deployment")

        # We're deploying - mark as in progress
        deployment_key = None
        async with deployment_lock:
            deployment_key = self.version_manager.mark_deployment_in_progress(cache_key, version_hash)

        try:
            app_full_name = self.get_full_app_name(version_hash)
            logger.info(f"Deploying Modal app {app_full_name} with locking")

            # Deploy the app
            app = await create_app_func(sbx_config, version_hash)

            # Mark deployment complete
            if deployment_key:
                self.version_manager.complete_deployment(deployment_key)

            # Register deployment
            if self.use_version_tracking:
                await self._register_deployment(sbx_config, version_hash, app, user)

            return app, version_hash

        except Exception:
            if deployment_key:
                self.version_manager.complete_deployment(deployment_key)
            raise

    async def _register_deployment(
        self,
        sbx_config: SandboxConfig,
        version_hash: str,
        app: modal.App,
        user,
    ):
        if not self.version_manager:
            return

        dependencies = set()
        if self.tool.pip_requirements:
            dependencies.update(str(req) for req in self.tool.pip_requirements)
        modal_config = sbx_config.get_modal_config()
        if modal_config.pip_requirements:
            dependencies.update(str(req) for req in modal_config.pip_requirements)

        await self.version_manager.register_deployment(
            tool_id=self.tool.id,
            app_name=self._app_name,
            version_hash=version_hash,
            app=app,
            dependencies=dependencies,
            sandbox_config_id=sbx_config.id if sbx_config else None,
            actor=user,
        )
