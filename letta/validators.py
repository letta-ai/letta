import re

from fastapi import Path

# TODO: extract this list from routers/v1/__init__.py and ROUTERS
primitives = [
    "agent",
    "message",
    "run",
    "job",
    "group",
    "block",
    "file",
    "folder",
    "source",
    "tool",
    "archive",
    "provider",
    "sandbox",
    "step",
    "identity",
]

PRIMITIVE_ID_PATTERNS = {
    # f-string interpolation gets confused because of the regex's required curly braces {}
    primitive: re.compile("^" + primitive + "-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
    for primitive in primitives
}

PATH_VALIDATORS = {}
for primitive in primitives:
    PATH_VALIDATORS[primitive] = Path(
        description=f"The ID of the {primitive} in the format '{primitive}-<uuid4>'",
        pattern=PRIMITIVE_ID_PATTERNS[primitive].pattern,
        examples=[f"{primitive}-123e4567-e89b-42d3-8456-426614174000"],
        # len(agent) + len("-") + len(uuid4)
        min_length=len(primitive) + 1 + 36,
        max_length=len(primitive) + 1 + 36,
    )


def is_valid_id(primitive: str, id: str) -> bool:
    return PRIMITIVE_ID_PATTERNS[primitive].match(id) is not None
