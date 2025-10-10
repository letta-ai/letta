"""
Database URI utilities for consistent database connection handling across the application.

This module provides utilities for parsing and converting database URIs to ensure
consistent behavior between the main application, alembic migrations, and other
database-related components.
"""

from typing import Optional
from urllib.parse import urlparse, urlunparse


def parse_database_uri(uri: str) -> dict[str, Optional[str]]:
    """
    Parse a database URI into its components.

    Args:
        uri: Database URI (e.g., postgresql://user:pass@host:port/db)

    Returns:
        Dictionary with parsed components: scheme, driver, user, password, host, port, database
    """
    parsed = urlparse(uri)

    # Extract driver from scheme (e.g., postgresql+asyncpg -> asyncpg)
    scheme_parts = parsed.scheme.split("+")
    base_scheme = scheme_parts[0] if scheme_parts else ""
    driver = scheme_parts[1] if len(scheme_parts) > 1 else None

    return {
        "scheme": base_scheme,
        "driver": driver,
        "user": parsed.username,
        "password": parsed.password,
        "host": parsed.hostname,
        "port": str(parsed.port) if parsed.port else None,
        "database": parsed.path.lstrip("/") if parsed.path else None,
        "query": parsed.query,
        "fragment": parsed.fragment,
    }


def build_database_uri(
    scheme: str = "postgresql",
    driver: Optional[str] = None,
    user: Optional[str] = None,
    password: Optional[str] = None,
    host: Optional[str] = None,
    port: Optional[str] = None,
    database: Optional[str] = None,
    query: Optional[str] = None,
    fragment: Optional[str] = None,
) -> str:
    """
    Build a database URI from components.

    Args:
        scheme: Base scheme (e.g., "postgresql")
        driver: Driver name (e.g., "asyncpg", "pg8000")
        user: Username
        password: Password
        host: Hostname
        port: Port number
        database: Database name
        query: Query string
        fragment: Fragment

    Returns:
        Complete database URI
    """
    # Combine scheme and driver
    full_scheme = f"{scheme}+{driver}" if driver else scheme

    # Build netloc (user:password@host:port)
    netloc_parts = []
    if user:
        if password:
            netloc_parts.append(f"{user}:{password}")
        else:
            netloc_parts.append(user)

    if host:
        if port:
            netloc_parts.append(f"{host}:{port}")
        else:
            netloc_parts.append(host)

    netloc = "@".join(netloc_parts) if netloc_parts else ""

    # Build path
    path = f"/{database}" if database else ""

    # Build the URI
    return urlunparse((full_scheme, netloc, path, "", query or "", fragment or ""))


def convert_to_async_uri(uri: str) -> str:
    """
    Convert a database URI to use the asyncpg driver for async operations.

    Args:
        uri: Original database URI

    Returns:
        URI with asyncpg driver and ssl parameter adjustments
    """
    components = parse_database_uri(uri)

    # Convert to asyncpg driver
    components["driver"] = "asyncpg"

    # Build the new URI
    new_uri = build_database_uri(**components)

    # Replace sslmode= with ssl= for asyncpg compatibility
    new_uri = new_uri.replace("sslmode=", "ssl=")

    return new_uri


def convert_to_sync_uri(uri: str) -> str:
    """
    Convert a database URI to use the pg8000 driver for sync operations (alembic).

    Args:
        uri: Original database URI

    Returns:
        URI with pg8000 driver and sslmode parameter adjustments
    """
    components = parse_database_uri(uri)

    # Convert to pg8000 driver
    components["driver"] = "pg8000"

    # Build the new URI
    new_uri = build_database_uri(**components)

    # Replace ssl= with sslmode= for pg8000 compatibility
    new_uri = new_uri.replace("ssl=", "sslmode=")

    return new_uri


def get_database_uri_for_context(uri: str, context: str = "async") -> str:
    """
    Get the appropriate database URI for a specific context.

    Args:
        uri: Original database URI
        context: Context type ("async" for asyncpg, "sync" for pg8000, "alembic" for pg8000)

    Returns:
        URI formatted for the specified context
    """
    if context in ["async"]:
        return convert_to_async_uri(uri)
    elif context in ["sync", "alembic"]:
        return convert_to_sync_uri(uri)
    else:
        raise ValueError(f"Unknown context: {context}. Must be 'async', 'sync', or 'alembic'")
