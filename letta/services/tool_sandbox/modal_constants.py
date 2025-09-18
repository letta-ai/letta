"""Shared constants for Modal sandbox implementations."""

# Deployment and versioning
DEFAULT_CONFIG_KEY = "default"
MODAL_DEPLOYMENTS_KEY = "modal_deployments"
VERSION_HASH_LENGTH = 12

# Cache settings
CACHE_TTL_SECONDS = 60

# Modal execution settings
DEFAULT_MODAL_TIMEOUT = 60
DEFAULT_MAX_CONCURRENT_INPUTS = 1
DEFAULT_PYTHON_VERSION = "3.12"

# Security settings
SAFE_IMPORT_MODULES = {"typing", "pydantic", "datetime", "enum", "uuid", "decimal"}
