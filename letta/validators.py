import inspect
import re
from functools import wraps
from typing import Annotated, Optional

from fastapi import Path, Query

from letta.errors import LettaInvalidArgumentError
from letta.schemas.enums import PrimitiveType  # PrimitiveType is now in schemas.enums

# Map from PrimitiveType to the actual prefix string (which is just the enum value)
PRIMITIVE_ID_PREFIXES = {primitive_type: primitive_type.value for primitive_type in PrimitiveType}


PRIMITIVE_ID_PATTERNS = {
    # f-string interpolation gets confused because of the regex's required curly braces {}
    prefix: re.compile("^" + prefix + "-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
    for prefix in PRIMITIVE_ID_PREFIXES.values()
}


def _create_path_validator_factory(primitive: str):
    """
    Creates a factory function that returns a fresh Path validator.

    This avoids shared state issues when the same validator is used
    across multiple endpoints with different parameter names.
    """

    def factory():
        return Path(
            description=f"The ID of the {primitive} in the format '{primitive}-<uuid4>'",
            pattern=PRIMITIVE_ID_PATTERNS[primitive].pattern,
            examples=[f"{primitive}-123e4567-e89b-42d3-8456-426614174000"],
            min_length=len(primitive) + 1 + 36,
            max_length=len(primitive) + 1 + 36,
        )

    return factory


# PATH_VALIDATORS now contains factory functions, not Path objects
# Usage: folder_id: str = PATH_VALIDATORS[PrimitiveType.FOLDER.value]()
PATH_VALIDATORS = {primitive_type.value: _create_path_validator_factory(primitive_type.value) for primitive_type in PrimitiveType}


# Type aliases for common ID types
# These can be used directly in route handler signatures for cleaner code
AgentId = Annotated[str, PATH_VALIDATORS[PrimitiveType.AGENT.value]()]
ToolId = Annotated[str, PATH_VALIDATORS[PrimitiveType.TOOL.value]()]
SourceId = Annotated[str, PATH_VALIDATORS[PrimitiveType.SOURCE.value]()]
BlockId = Annotated[str, PATH_VALIDATORS[PrimitiveType.BLOCK.value]()]
MessageId = Annotated[str, PATH_VALIDATORS[PrimitiveType.MESSAGE.value]()]
RunId = Annotated[str, PATH_VALIDATORS[PrimitiveType.RUN.value]()]
JobId = Annotated[str, PATH_VALIDATORS[PrimitiveType.JOB.value]()]
GroupId = Annotated[str, PATH_VALIDATORS[PrimitiveType.GROUP.value]()]
FileId = Annotated[str, PATH_VALIDATORS[PrimitiveType.FILE.value]()]
FolderId = Annotated[str, PATH_VALIDATORS[PrimitiveType.FOLDER.value]()]
ArchiveId = Annotated[str, PATH_VALIDATORS[PrimitiveType.ARCHIVE.value]()]
PassageId = Annotated[str, PATH_VALIDATORS[PrimitiveType.PASSAGE.value]()]
ProviderId = Annotated[str, PATH_VALIDATORS[PrimitiveType.PROVIDER.value]()]
SandboxConfigId = Annotated[str, PATH_VALIDATORS[PrimitiveType.SANDBOX_CONFIG.value]()]
StepId = Annotated[str, PATH_VALIDATORS[PrimitiveType.STEP.value]()]
IdentityId = Annotated[str, PATH_VALIDATORS[PrimitiveType.IDENTITY.value]()]

# Infrastructure types
McpServerId = Annotated[str, PATH_VALIDATORS[PrimitiveType.MCP_SERVER.value]()]
McpOAuthId = Annotated[str, PATH_VALIDATORS[PrimitiveType.MCP_OAUTH.value]()]
FileAgentId = Annotated[str, PATH_VALIDATORS[PrimitiveType.FILE_AGENT.value]()]

# Configuration types
SandboxEnvId = Annotated[str, PATH_VALIDATORS[PrimitiveType.SANDBOX_ENV.value]()]
AgentEnvId = Annotated[str, PATH_VALIDATORS[PrimitiveType.AGENT_ENV.value]()]

# Core entity types
UserId = Annotated[str, PATH_VALIDATORS[PrimitiveType.USER.value]()]
OrganizationId = Annotated[str, PATH_VALIDATORS[PrimitiveType.ORGANIZATION.value]()]
ToolRuleId = Annotated[str, PATH_VALIDATORS[PrimitiveType.TOOL_RULE.value]()]

# Batch processing types
BatchItemId = Annotated[str, PATH_VALIDATORS[PrimitiveType.BATCH_ITEM.value]()]
BatchRequestId = Annotated[str, PATH_VALIDATORS[PrimitiveType.BATCH_REQUEST.value]()]

# Telemetry types
ProviderTraceId = Annotated[str, PATH_VALIDATORS[PrimitiveType.PROVIDER_TRACE.value]()]


def raise_on_invalid_id(param_name: str, expected_prefix: PrimitiveType):
    """
    Decorator that validates an ID parameter has the expected prefix format.
    Can be stacked multiple times on the same function to validate different IDs.

    Args:
        param_name: The name of the function parameter to validate (e.g., "agent_id")
        expected_prefix: The expected primitive type (e.g., PrimitiveType.AGENT)

    Example:
        @raise_on_invalid_id(param_name="agent_id", expected_prefix=PrimitiveType.AGENT)
        @raise_on_invalid_id(param_name="folder_id", expected_prefix=PrimitiveType.FOLDER)
        def my_function(agent_id: str, folder_id: str):
            pass
    """

    def decorator(function):
        @wraps(function)
        def wrapper(*args, **kwargs):
            sig = inspect.signature(function)
            bound_args = sig.bind(*args, **kwargs)
            bound_args.apply_defaults()

            if param_name in bound_args.arguments:
                arg_value = bound_args.arguments[param_name]

                if arg_value is not None:
                    prefix = PRIMITIVE_ID_PREFIXES[expected_prefix]
                    if PRIMITIVE_ID_PATTERNS[prefix].match(arg_value) is None:
                        raise LettaInvalidArgumentError(
                            message=f"Invalid {expected_prefix.value} ID format: {arg_value}. Expected format: '{prefix}-<uuid4>'",
                            argument_name=param_name,
                        )

            return function(*args, **kwargs)

        return wrapper

    return decorator


# =============================================================================
# Query Parameter Validators
# =============================================================================
# Format validators for common query parameters to match frontend constraints


def _create_id_query_validator(primitive: str):
    """
    Creates a Query validator for ID parameters with format validation.

    Args:
        primitive: The primitive type prefix (e.g., "agent", "tool")

    Returns:
        A Query validator with pattern matching
    """
    return Query(
        description=f"The ID of the {primitive} in the format '{primitive}-<uuid4>'",
        pattern=PRIMITIVE_ID_PATTERNS[primitive].pattern,
        examples=[f"{primitive}-123e4567-e89b-42d3-8456-426614174000"],
        min_length=len(primitive) + 1 + 36,
        max_length=len(primitive) + 1 + 36,
    )


# Query parameter ID validators with format checking
AgentIdQuery = Annotated[Optional[str], _create_id_query_validator(PrimitiveType.AGENT.value)]
ToolIdQuery = Annotated[Optional[str], _create_id_query_validator(PrimitiveType.TOOL.value)]
SourceIdQuery = Annotated[Optional[str], _create_id_query_validator(PrimitiveType.SOURCE.value)]
BlockIdQuery = Annotated[Optional[str], _create_id_query_validator(PrimitiveType.BLOCK.value)]
MessageIdQuery = Annotated[Optional[str], _create_id_query_validator(PrimitiveType.MESSAGE.value)]
RunIdQuery = Annotated[Optional[str], _create_id_query_validator(PrimitiveType.RUN.value)]
JobIdQuery = Annotated[Optional[str], _create_id_query_validator(PrimitiveType.JOB.value)]
GroupIdQuery = Annotated[Optional[str], _create_id_query_validator(PrimitiveType.GROUP.value)]
IdentityIdQuery = Annotated[Optional[str], _create_id_query_validator(PrimitiveType.IDENTITY.value)]


# =============================================================================
# String Field Validators
# =============================================================================
# Format validators for common string fields

# Label validator: alphanumeric, hyphens, underscores, max 50 chars
BlockLabelQuery = Annotated[
    Optional[str],
    Query(
        description="Label to include (alphanumeric, hyphens, underscores only)",
        pattern=r"^[a-zA-Z0-9_-]+$",
        min_length=1,
        max_length=50,
        examples=["human", "persona", "the_label_of-a-block"],
    ),
]


# Name validator: similar to label but allows spaces, max 100 chars
BlockNameQuery = Annotated[
    Optional[str],
    Query(
        description="Name filter (alphanumeric, spaces, hyphens, underscores)",
        pattern=r"^[a-zA-Z0-9 _-]+$",
        min_length=1,
        max_length=100,
        examples=["My Agent", "test_tool", "default-config"],
    ),
]

# Search query validator: general text search, max 200 chars
BlockLabelSearchQuery = Annotated[
    Optional[str],
    Query(
        description="Search blocks by label. If provided, returns blocks whose label matches the search query. This is a full-text search on block labels.",
        pattern=r"^[a-zA-Z0-9_-]+$",
        min_length=1,
        max_length=50,
        examples=["human", "persona", "the_label_of-a-block"],
    ),
]

BlockValueSearchQuery = Annotated[
    Optional[str],
    Query(
        description="Search blocks by value. If provided, returns blocks whose value matches the search query. This is a full-text search on block values.",
        min_length=1,
        max_length=200,
    ),
]

BlockDescriptionSearchQuery = Annotated[
    Optional[str],
    Query(
        description="Search blocks by description. If provided, returns blocks whose description matches the search query. This is a full-text search on block descriptions.",
        min_length=1,
        max_length=200,
    ),
]
