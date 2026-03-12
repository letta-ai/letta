"""Local filesystem storage backend for memory repositories.

This backend stores git repository data on the local filesystem,
making git-backed memory available without external dependencies.
Ideal for self-hosted OSS deployments.
"""

import os
import shutil
from pathlib import Path
from typing import List, Optional

from letta.log import get_logger
from letta.services.memory_repo.storage.base import StorageBackend

logger = get_logger(__name__)


class LocalStorageBackend(StorageBackend):
    """Local filesystem storage backend for memory repositories.

    Stores repository data under a configurable base path, defaulting to
    ~/.letta/memfs/. This enables git-backed memory for self-hosted
    deployments without requiring cloud storage.

    Directory structure:
        {base_path}/{prefix}/{org_id}/{agent_id}/repo.git/
    """

    def __init__(
        self,
        base_path: Optional[str] = None,
        prefix: str = "repository",
    ):
        """Initialize local storage backend.

        Args:
            base_path: Base directory for storage (default: ~/.letta/memfs)
            prefix: Prefix for all paths in this backend (default: "repository")
        """
        if base_path is None:
            base_path = os.path.expanduser("~/.letta/memfs")

        self._base_path = Path(base_path)
        self._prefix = prefix.rstrip("/")
        self._bucket_name = "local"  # For interface compatibility

        # Ensure base directory exists
        self._base_path.mkdir(parents=True, exist_ok=True)
        logger.debug(f"LocalStorageBackend initialized at {self._base_path}")

    def _full_path(self, path: str) -> Path:
        """Get full filesystem path including prefix."""
        path = path.lstrip("/")
        if self._prefix:
            return self._base_path / self._prefix / path
        return self._base_path / path

    @property
    def bucket_name(self) -> str:
        """Return the bucket name (for interface compatibility)."""
        return self._bucket_name

    async def upload_bytes(self, path: str, content: bytes) -> None:
        """Write bytes to a local file."""
        full_path = self._full_path(path)
        full_path.parent.mkdir(parents=True, exist_ok=True)

        with open(full_path, "wb") as f:
            f.write(content)

        logger.debug(f"Wrote {len(content)} bytes to {full_path}")

    async def download_bytes(self, path: str) -> bytes:
        """Read bytes from a local file."""
        full_path = self._full_path(path)

        if not full_path.exists():
            raise FileNotFoundError(f"{full_path} not found")

        with open(full_path, "rb") as f:
            return f.read()

    async def exists(self, path: str) -> bool:
        """Check if a path exists."""
        full_path = self._full_path(path)
        return full_path.exists()

    async def delete(self, path: str) -> None:
        """Delete a file."""
        full_path = self._full_path(path)

        if not full_path.exists():
            raise FileNotFoundError(f"{full_path} not found")

        full_path.unlink()
        logger.debug(f"Deleted {full_path}")

    async def list_files(self, prefix: str) -> List[str]:
        """List all files with the given prefix."""
        full_prefix = self._full_path(prefix)

        if not full_prefix.exists():
            return []

        result = []
        if full_prefix.is_file():
            # Prefix is a file, return it
            rel_path = str(full_prefix.relative_to(self._base_path / self._prefix))
            result.append(rel_path)
        else:
            # Walk directory
            for file_path in full_prefix.rglob("*"):
                if file_path.is_file():
                    rel_path = str(file_path.relative_to(self._base_path / self._prefix))
                    result.append(rel_path)

        return result

    async def delete_prefix(self, prefix: str) -> int:
        """Delete all files with the given prefix."""
        full_prefix = self._full_path(prefix)

        if not full_prefix.exists():
            return 0

        # Count files before deletion
        count = sum(1 for _ in full_prefix.rglob("*") if _.is_file())

        if full_prefix.is_file():
            full_prefix.unlink()
            count = 1
        else:
            shutil.rmtree(full_prefix, ignore_errors=True)

        logger.debug(f"Deleted {count} files with prefix {prefix}")
        return count

    async def copy(self, source_path: str, dest_path: str) -> None:
        """Copy a file."""
        source_full = self._full_path(source_path)
        dest_full = self._full_path(dest_path)

        if not source_full.exists():
            raise FileNotFoundError(f"{source_full} not found")

        dest_full.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_full, dest_full)
        logger.debug(f"Copied {source_full} to {dest_full}")
