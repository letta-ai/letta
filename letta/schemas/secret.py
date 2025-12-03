import json
from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict, PrivateAttr
from pydantic_core import core_schema

from letta.helpers.crypto_utils import CryptoUtils
from letta.log import get_logger

logger = get_logger(__name__)


class Secret(BaseModel):
    """
    A wrapper class for encrypted credentials that keeps values encrypted in memory.

    This class ensures that sensitive data remains encrypted as much as possible
    while passing through the codebase, only decrypting when absolutely necessary.

    Migration status (Phase 1 - encrypted-first reads with plaintext fallback):
    - Reads: Prefer _enc columns, fallback to plaintext columns with ERROR logging
    - Writes: Still dual-write to both _enc and plaintext columns for backward compatibility
    - Encryption: Optional - if LETTA_ENCRYPTION_KEY is not set, stores plaintext in _enc column

    TODO (Phase 2): Remove plaintext fallback in from_db() after verifying no error logs
    TODO (Phase 3): Remove dual-write logic in to_dict() and set_*_secret() methods
    TODO (Phase 4): Remove from_db() plaintext_value parameter, was_encrypted flag, and plaintext columns
    """

    # Store the encrypted value as a regular field
    encrypted_value: Optional[str] = None
    # Cache the decrypted value to avoid repeated decryption (not serialized for security)
    _plaintext_cache: Optional[str] = PrivateAttr(default=None)
    # Flag to indicate if the value was originally encrypted
    was_encrypted: bool = False

    model_config = ConfigDict(frozen=True)

    @classmethod
    def from_plaintext(cls, value: Optional[str]) -> "Secret":
        """
        Create a Secret from a plaintext value, encrypting it if possible.

        If LETTA_ENCRYPTION_KEY is configured, the value is encrypted.
        If not, the plaintext value is stored directly in encrypted_value field.

        Args:
            value: The plaintext value to encrypt

        Returns:
            A Secret instance with the encrypted (or plaintext) value
        """
        if value is None:
            return cls.model_construct(encrypted_value=None, was_encrypted=False)

        # Guard against double encryption - check if value is already encrypted
        if CryptoUtils.is_encrypted(value):
            logger.warning("Creating Secret from already-encrypted value. This can be dangerous.")

        # Try to encrypt, but fall back to storing plaintext if no encryption key
        try:
            encrypted = CryptoUtils.encrypt(value)
            return cls.model_construct(encrypted_value=encrypted, was_encrypted=False)
        except ValueError as e:
            # No encryption key available, store as plaintext in the _enc column
            if "No encryption key configured" in str(e):
                logger.warning(
                    "No encryption key configured. Storing Secret value as plaintext in _enc column. "
                    "Set LETTA_ENCRYPTION_KEY environment variable to enable encryption."
                )
                instance = cls.model_construct(encrypted_value=value, was_encrypted=False)
                instance._plaintext_cache = value  # Cache it since we know the plaintext
                return instance
            raise  # Re-raise if it's a different error

    @classmethod
    def from_encrypted(cls, encrypted_value: Optional[str]) -> "Secret":
        """
        Create a Secret from an already encrypted value.

        Args:
            encrypted_value: The encrypted value

        Returns:
            A Secret instance
        """
        return cls.model_construct(encrypted_value=encrypted_value, was_encrypted=True)

    @classmethod
    def from_db(cls, encrypted_value: Optional[str], plaintext_value: Optional[str] = None) -> "Secret":
        """
        Create a Secret from database values. Prefers encrypted column, falls back to plaintext with error logging.

        During Phase 1 of migration, this method:
        1. Uses encrypted_value if available (preferred)
        2. Falls back to plaintext_value with ERROR logging if encrypted is unavailable
        3. Returns empty Secret if neither is available

        The error logging helps identify any records that haven't been migrated to encrypted columns.

        Args:
            encrypted_value: The encrypted value from the database (_enc column)
            plaintext_value: The plaintext value from the database (legacy column, fallback only)

        Returns:
            A Secret instance with the value from encrypted or plaintext column
        """
        if encrypted_value is not None:
            return cls.from_encrypted(encrypted_value)
        # Fallback to plaintext with error logging - this helps identify unmigrated data
        if plaintext_value is not None:
            logger.error(
                "MIGRATION_NEEDED: Reading from plaintext column instead of encrypted column. "
                "This indicates data that hasn't been migrated to the _enc column yet. "
                "Please run migrate data to _enc columns as plaintext columns will be deprecated.",
                stack_info=True,
            )
            return cls.from_plaintext(plaintext_value)
        return cls.from_plaintext(None)

    def get_encrypted(self) -> Optional[str]:
        """
        Get the encrypted value.

        Returns:
            The encrypted value, or None if the secret is empty
        """
        return self.encrypted_value

    def get_plaintext(self) -> Optional[str]:
        """
        Get the decrypted plaintext value.

        This should only be called when the plaintext is actually needed,
        such as when making an external API call.

        If the value is encrypted, it will be decrypted. If the value is stored
        as plaintext (no encryption key was configured), it will be returned as-is.

        Returns:
            The decrypted plaintext value, or None if the secret is empty
        """
        if self.encrypted_value is None:
            return None

        # Use cached value if available
        if self._plaintext_cache is not None:
            return self._plaintext_cache

        # Try to decrypt
        try:
            plaintext = CryptoUtils.decrypt(self.encrypted_value)
            # Cache the decrypted value (PrivateAttr fields can be mutated even with frozen=True)
            self._plaintext_cache = plaintext
            return plaintext
        except ValueError as e:
            error_msg = str(e)

            # Handle missing encryption key - check if value is actually plaintext
            if "No encryption key configured" in error_msg:
                if CryptoUtils.is_encrypted(self.encrypted_value):
                    # Value was encrypted but we have no key - can't decrypt
                    logger.warning(
                        "Cannot decrypt Secret value - no encryption key configured. "
                        "The value was encrypted and requires the original key to decrypt."
                    )
                    return None
                else:
                    # Value is plaintext (stored when no key was available)
                    logger.debug("Secret value is plaintext (stored without encryption)")
                    self._plaintext_cache = self.encrypted_value
                    return self.encrypted_value

            # Handle decryption failure - check if value might be plaintext
            elif "Failed to decrypt data" in error_msg:
                if not CryptoUtils.is_encrypted(self.encrypted_value):
                    # It's plaintext that was stored when no key was available
                    logger.debug("Secret value appears to be plaintext (stored without encryption)")
                    self._plaintext_cache = self.encrypted_value
                    return self.encrypted_value
                # Otherwise, it's corrupted or wrong key
                logger.error("Failed to decrypt Secret value - data may be corrupted or wrong key")
                raise

            # Re-raise for other errors
            raise

    def is_empty(self) -> bool:
        """Check if the secret is empty/None."""
        return self.encrypted_value is None

    def __str__(self) -> str:
        """String representation that doesn't expose the actual value."""
        if self.is_empty():
            return "<Secret: empty>"
        return "<Secret: ****>"

    def __repr__(self) -> str:
        """Representation that doesn't expose the actual value."""
        return self.__str__()

    def to_dict(self) -> Dict[str, Any]:
        """
        Convert to dictionary for database storage.

        Returns both encrypted and plaintext values for dual-write during migration.
        """
        return {"encrypted": self.get_encrypted(), "plaintext": self.get_plaintext() if not self.was_encrypted else None}

    def __eq__(self, other: Any) -> bool:
        """
        Compare two secrets by their plaintext values.

        Note: This decrypts both values, so use sparingly.
        """
        if not isinstance(other, Secret):
            return False
        return self.get_plaintext() == other.get_plaintext()

    @classmethod
    def __get_pydantic_core_schema__(cls, source_type: Any, handler) -> core_schema.CoreSchema:
        """
        Customize Pydantic's validation and serialization behavior for Secret fields.

        This allows Secret fields to automatically:
        - Deserialize: Convert encrypted strings from DB → Secret objects
        - Serialize: Convert Secret objects → encrypted strings for DB
        """

        def validate_secret(value: Any) -> "Secret":
            """Convert various input types to Secret objects."""
            if isinstance(value, Secret):
                return value
            elif isinstance(value, str):
                # String from DB is assumed to be encrypted
                return Secret.from_encrypted(value)
            elif isinstance(value, dict):
                # Dict might be from Pydantic serialization - check for encrypted_value key
                if "encrypted_value" in value:
                    # This is a serialized Secret being deserialized
                    return cls(**value)
                elif not value or value == {}:
                    # Empty dict means None
                    return Secret.from_plaintext(None)
                else:
                    raise ValueError(f"Cannot convert dict to Secret: {value}")
            elif value is None:
                return Secret.from_plaintext(None)
            else:
                raise ValueError(f"Cannot convert {type(value)} to Secret")

        def serialize_secret(secret: "Secret") -> Optional[str]:
            """Serialize Secret to encrypted string."""
            if secret is None:
                return None
            return secret.get_encrypted()

        python_schema = core_schema.chain_schema(
            [
                core_schema.no_info_plain_validator_function(validate_secret),
                core_schema.is_instance_schema(cls),
            ]
        )

        return core_schema.json_or_python_schema(
            json_schema=python_schema,
            python_schema=python_schema,
            serialization=core_schema.plain_serializer_function_ser_schema(
                serialize_secret,
                when_used="always",
            ),
        )

    @classmethod
    def __get_pydantic_json_schema__(cls, core_schema: core_schema.CoreSchema, handler) -> Dict[str, Any]:
        """
        Define JSON schema representation for Secret fields.

        In JSON schema (OpenAPI docs), Secret fields appear as nullable strings.
        The actual encryption/decryption happens at runtime via __get_pydantic_core_schema__.

        Args:
            core_schema: The core schema for this type
            handler: Handler for generating JSON schema

        Returns:
            A JSON schema dict representing this type as a nullable string
        """
        # Return a simple string schema for JSON schema generation
        return {
            "type": "string",
            "nullable": True,
            "description": "Encrypted secret value (stored as encrypted string)",
        }
