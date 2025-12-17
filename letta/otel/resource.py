import socket
import sys
import uuid

from opentelemetry.sdk.resources import Resource

from letta import __version__ as letta_version
from letta.settings import settings

_resources = {}


def _normalize_environment_tag(env: str) -> str:
    """
    Normalize environment value for OTEL deployment.environment tag.
    Maps internal environment values to abbreviated lowercase tags for Datadog.

    Examples:
        DEV -> dev
        DEVELOPMENT -> dev
        STAGING -> dev
        prod -> prod (already normalized)
        canary -> canary
        local-test -> local-test
    """
    if not env:
        return "unknown"

    env_upper = env.upper()

    # Map known values to abbreviated forms
    if env_upper == "DEV" or env_upper == "DEVELOPMENT":
        return "dev"
    elif env_upper == "STAGING":
        return "dev"  # Staging maps to dev
    else:
        # For other values (prod, canary, local-test, etc.), use lowercase as-is
        return env.lower()


def get_resource(service_name: str) -> Resource:
    _env = settings.environment
    if (service_name, _env) not in _resources:
        resource_dict = {
            "service.name": service_name,
            "letta.version": letta_version,
            "host.name": socket.gethostname(),
        }
        # Add deployment environment for Datadog APM filtering (normalized to abbreviated lowercase)
        if _env:
            resource_dict["deployment.environment"] = _normalize_environment_tag(_env)
        # Only add device.id in non-production environments (for debugging)
        if _env != "prod":
            resource_dict["device.id"] = uuid.getnode()  # MAC address as unique device identifier,
        _resources[(service_name, _env)] = Resource.create(resource_dict)
    return _resources[(service_name, _env)]


def is_pytest_environment():
    return "pytest" in sys.modules
