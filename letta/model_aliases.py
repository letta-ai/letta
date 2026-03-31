"""Helpers for redirecting deprecated model names and handles."""

from typing import Final

DEPRECATED_GOOGLE_MODEL_REDIRECTS: Final[dict[tuple[str, str], str]] = {
    ("google_ai", "gemini-3-pro-preview"): "gemini-3.1-pro-preview",
    ("google_vertex", "gemini-3-pro-preview"): "gemini-3.1-pro-preview",
}


def get_deprecated_google_model_replacement(model_endpoint_type: str | None, model: str | None) -> str | None:
    if not model_endpoint_type or not model:
        return model

    return DEPRECATED_GOOGLE_MODEL_REDIRECTS.get((model_endpoint_type, model), model)


def get_deprecated_google_handle_replacement(handle: str | None) -> str | None:
    if not handle:
        return handle

    for (_, deprecated_model), replacement_model in DEPRECATED_GOOGLE_MODEL_REDIRECTS.items():
        if handle.endswith(f"/{deprecated_model}"):
            return f"{handle[: -len(deprecated_model)]}{replacement_model}"

    return handle
