"""Git-based memory repository services."""

from letta.services.memory_repo.storage.base import StorageBackend
from letta.services.memory_repo.storage.local import LocalStorageBackend

# MemfsClient: try cloud implementation first, fall back to local filesystem
try:
    from letta.services.memory_repo.memfs_client import MemfsClient
except ImportError:
    from letta.services.memory_repo.memfs_client_base import MemfsClient

__all__ = [
    "LocalStorageBackend",
    "MemfsClient",
    "StorageBackend",
]
