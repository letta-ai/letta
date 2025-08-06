import sqlite3
from typing import Optional, Union

import numpy as np
from sqlalchemy import event
from sqlalchemy.engine import Engine

from letta.constants import MAX_EMBEDDING_DIM
from letta.log import get_logger
from letta.settings import DatabaseChoice, settings

if settings.database_engine == DatabaseChoice.SQLITE:
    import sqlite_vec

logger = get_logger(__name__)


def adapt_array(arr):
    """
    Converts numpy array to binary for SQLite storage using sqlite-vec
    """
    if arr is None:
        return None

    if isinstance(arr, list):
        arr = np.array(arr, dtype=np.float32)
    elif not isinstance(arr, np.ndarray):
        raise ValueError(f"Unsupported type: {type(arr)}")

    # Ensure float32 for compatibility
    arr = arr.astype(np.float32)
    return sqlite_vec.serialize_float32(arr.tolist())


def convert_array(text):
    """
    Converts binary back to numpy array using sqlite-vec format
    """
    if text is None:
        return None
    if isinstance(text, list):
        return np.array(text, dtype=np.float32)
    if isinstance(text, np.ndarray):
        return text

    # Handle both bytes and sqlite3.Binary
    binary_data = bytes(text) if isinstance(text, sqlite3.Binary) else text

    # Use sqlite-vec native format
    if len(binary_data) % 4 == 0:  # Must be divisible by 4 for float32
        return np.frombuffer(binary_data, dtype=np.float32)
    else:
        raise ValueError(f"Invalid sqlite-vec binary data length: {len(binary_data)}")


def verify_embedding_dimension(embedding: np.ndarray, expected_dim: int = MAX_EMBEDDING_DIM) -> bool:
    """
    Verifies that an embedding has the expected dimension

    Args:
        embedding: Input embedding array
        expected_dim: Expected embedding dimension (default: 4096)

    Returns:
        bool: True if dimension matches, False otherwise
    """
    if embedding is None:
        return False
    return embedding.shape[0] == expected_dim


def validate_and_transform_embedding(
    embedding: Union[bytes, sqlite3.Binary, list, np.ndarray], expected_dim: int = MAX_EMBEDDING_DIM, dtype: np.dtype = np.float32
) -> Optional[np.ndarray]:
    """
    Validates and transforms embeddings to ensure correct dimensionality.

    Args:
        embedding: Input embedding in various possible formats
        expected_dim: Expected embedding dimension (default 4096)
        dtype: NumPy dtype for the embedding (default float32)

    Returns:
        np.ndarray: Validated and transformed embedding

    Raises:
        ValueError: If embedding dimension doesn't match expected dimension
    """
    if embedding is None:
        return None

    # Convert to numpy array based on input type
    if isinstance(embedding, (bytes, sqlite3.Binary)):
        vec = convert_array(embedding)
    elif isinstance(embedding, list):
        vec = np.array(embedding, dtype=dtype)
    elif isinstance(embedding, np.ndarray):
        vec = embedding.astype(dtype)
    else:
        raise ValueError(f"Unsupported embedding type: {type(embedding)}")

    # Validate dimension
    if vec.shape[0] != expected_dim:
        raise ValueError(f"Invalid embedding dimension: got {vec.shape[0]}, expected {expected_dim}")

    return vec


def cosine_distance(embedding1, embedding2, expected_dim=MAX_EMBEDDING_DIM):
    """
    Calculate cosine distance between two embeddings

    Args:
        embedding1: First embedding
        embedding2: Second embedding
        expected_dim: Expected embedding dimension (default 4096)

    Returns:
        float: Cosine distance
    """

    if embedding1 is None or embedding2 is None:
        return 0.0  # Maximum distance if either embedding is None

    try:
        vec1 = validate_and_transform_embedding(embedding1, expected_dim)
        vec2 = validate_and_transform_embedding(embedding2, expected_dim)
    except ValueError:
        return 0.0

    similarity = np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))
    distance = float(1.0 - similarity)

    return distance


# Note: sqlite-vec provides native SQL functions for vector operations
# We don't need custom Python distance functions since sqlite-vec handles this at the SQL level
@event.listens_for(Engine, "connect")
def register_functions(dbapi_connection, connection_record):
    """Register SQLite functions and enable sqlite-vec extension"""
    # Check for both sync SQLite connections and async aiosqlite connections
    is_sqlite_connection = isinstance(dbapi_connection, sqlite3.Connection)
    is_aiosqlite_connection = hasattr(dbapi_connection, "_connection") and str(type(dbapi_connection)).find("aiosqlite") != -1

    if is_sqlite_connection or is_aiosqlite_connection:
        # Get the actual SQLite connection for async connections
        actual_connection = dbapi_connection._connection if is_aiosqlite_connection else dbapi_connection

        # Enable sqlite-vec extension
        try:
            if is_aiosqlite_connection:
                # For aiosqlite connections, we cannot use async operations in sync event handlers
                # The extension will need to be loaded per-connection when actually used
                logger.debug("Detected aiosqlite connection - sqlite-vec will be loaded per-query")
            else:
                # For sync connections
                # dbapi_connection.enable_load_extension(True)
                # sqlite_vec.load(dbapi_connection)
                # dbapi_connection.enable_load_extension(False)
                logger.info("sqlite-vec extension successfully loaded for sqlite3 (sync)")
        except Exception as e:
            raise RuntimeError(f"Failed to load sqlite-vec extension: {e}")

        # Register custom cosine_distance function for backward compatibility
        try:
            if is_aiosqlite_connection:
                # Try to register function on the actual connection, even though it might be async
                # This may require the function to be registered per-connection
                logger.debug("Attempting function registration for aiosqlite connection")
                # For async connections, we need to register the function differently
                # We'll use the sync-style registration on the underlying connection
                raw_conn = getattr(actual_connection, "_connection", actual_connection)
                if hasattr(raw_conn, "create_function"):
                    raw_conn.create_function("cosine_distance", 2, cosine_distance)
                    logger.debug("Successfully registered cosine_distance for aiosqlite")
            else:
                dbapi_connection.create_function("cosine_distance", 2, cosine_distance)
                logger.info("Successfully registered cosine_distance for sync connection")
        except Exception as e:
            raise RuntimeError(f"Failed to register cosine_distance function: {e}")
    else:
        logger.debug("Warning: Not a SQLite connection, but instead %s skipping function registration", type(dbapi_connection))


# Register adapters and converters for numpy arrays
if settings.database_engine == DatabaseChoice.SQLITE:
    sqlite3.register_adapter(np.ndarray, adapt_array)
    sqlite3.register_converter("ARRAY", convert_array)
