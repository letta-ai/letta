import os
import sys
import uuid

from opentelemetry.sdk.resources import Resource

from letta import __version__ as letta_version

_resources = {}


def get_resource(service_name: str) -> Resource:
    _env = os.getenv("LETTA_ENVIRONMENT")
    if service_name not in _resources:
        resource_dict = {
            "service.name": service_name,
            "letta.version": letta_version,
        }
        if _env != "PRODUCTION":
            resource_dict["device.id"] = uuid.getnode()  # MAC address as unique device identifier,
        _resources[(service_name, _env)] = Resource.create(resource_dict)
    return _resources[(service_name, _env)]


def is_pytest_environment():
    return "pytest" in sys.modules
