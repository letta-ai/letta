import importlib
from typing import Protocol, runtime_checkable

from letta.settings import settings


@runtime_checkable
class SummarizerProtocol(Protocol):
    """What a summarizer must implement"""

    async def summarize(self, text: str) -> str: ...
    def get_name(self) -> str: ...


# Currently this supports one of each plugin type. This can be expanded in the future.
DEFAULT_PLUGINS = {
    "experimental_check": {
        "protocol": None,
        "target": "letta.plugins.defaults:is_experimental_enabled",
    },
    "summarizer": {
        "protocol": SummarizerProtocol,
        "target": "letta.services.summarizer.summarizer:Summarizer",
    },
}


def get_plugin(plugin_type: str):
    """Get a plugin instance"""
    plugin_register = dict(DEFAULT_PLUGINS, **settings.plugin_register_dict)
    if plugin_type in plugin_register:
        impl_path = plugin_register[plugin_type]["target"]
        module_path, name = impl_path.split(":")
        module = importlib.import_module(module_path)
        plugin = getattr(module, name)
        if type(plugin).__name__ == "function":
            return plugin
        elif type(plugin).__name__ == "class":
            if plugin_register["protocol"] and not isinstance(plugin, type(plugin_register["protocol"])):
                raise TypeError(f'{plugin} does not implement {type(plugin_register["protocol"]).__name__}')
            return plugin()
    raise TypeError("Unknown plugin type")


_experimental_checker = None
_summarizer = None


# TODO handle coroutines
# Convenience functions
def get_experimental_checker():
    global _experimental_checker
    if _experimental_checker is None:
        _experimental_checker = get_plugin("experimental_check")
    return _experimental_checker


def get_summarizer():
    global _summarizer
    if _summarizer is None:
        _summarizer = get_plugin("summarizer")
    return _summarizer


def reset_experimental_checker():
    global _experimental_checker
    _experimental_checker = None


def reset_summarizer():
    global _summarizer
    _summarizer = None
