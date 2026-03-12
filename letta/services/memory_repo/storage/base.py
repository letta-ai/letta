"""Abstract base class for storage backends."""

from abc import ABC, abstractmethod
from typing import List


class StorageBackend(ABC):
    """Abstract storage backend for memory repositories.

    Provides a unified interface for storing git repository objects
    in various object storage systems (GCS, S3, local filesystem).
    """

    @property
    @abstractmethod
    def bucket_name(self) -> str:
        """Return the bucket/container name."""
        pass

    @abstractmethod
    async def upload_bytes(self, path: str, content: bytes) -> None:
        """Upload bytes to the given path.

        Args:
            path: Path within the bucket (e.g., "org-123/agent-456/objects/pack/pack-abc.pack")
            content: Raw bytes to upload
        """
        pass

    @abstractmethod
    async def download_bytes(self, path: str) -> bytes:
        """Download bytes from the given path.

        Args:
            path: Path within the bucket

        Returns:
            Raw bytes content

        Raises:
            FileNotFoundError: If the path doesn't exist
        """
        pass

    @abstractmethod
    async def exists(self, path: str) -> bool:
        """Check if a path exists.

        Args:
            path: Path within the bucket

        Returns:
            True if the path exists
        """
        pass

    @abstractmethod
    async def delete(self, path: str) -> None:
        """Delete a file at the given path.

        Args:
            path: Path within the bucket

        Raises:
            FileNotFoundError: If the path doesn't exist
        """
        pass

    @abstractmethod
    async def list_files(self, prefix: str) -> List[str]:
        """List all files with the given prefix.

        Args:
            prefix: Path prefix to filter by

        Returns:
            List of full paths matching the prefix
        """
        pass

    @abstractmethod
    async def delete_prefix(self, prefix: str) -> int:
        """Delete all files with the given prefix.

        Args:
            prefix: Path prefix to delete

        Returns:
            Number of files deleted
        """
        pass

    async def upload_text(self, path: str, content: str, encoding: str = "utf-8") -> None:
        """Upload text content to the given path.

        Args:
            path: Path within the bucket
            content: Text content to upload
            encoding: Text encoding (default: utf-8)
        """
        await self.upload_bytes(path, content.encode(encoding))

    async def download_text(self, path: str, encoding: str = "utf-8") -> str:
        """Download text content from the given path.

        Args:
            path: Path within the bucket
            encoding: Text encoding (default: utf-8)

        Returns:
            Text content
        """
        content = await self.download_bytes(path)
        return content.decode(encoding)

    async def copy(self, source_path: str, dest_path: str) -> None:
        """Copy a file from source to destination.

        Default implementation downloads and re-uploads.
        Subclasses may override with more efficient implementations.

        Args:
            source_path: Source path
            dest_path: Destination path
        """
        content = await self.download_bytes(source_path)
        await self.upload_bytes(dest_path, content)
