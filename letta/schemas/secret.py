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

    TODO: Once we deprecate plaintext columns in the database:
    - Remove the dual-write logic in to_dict()
    - Remove the from_db() method's plaintext_value parameter
    - Remove the was_encrypted flag (no longer needed for migration)
    - Simplify get_plaintext() to only handle encrypted values
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

        Args:
            value: The plaintext value to encrypt

        Returns:
            A Secret instance with the encrypted value, or plaintext if encryption unavailable
        """
        if value is None:
            return cls.model_construct(encrypted_value=None, was_encrypted=False)

        # Guard against double encryption - check if value is already encrypted
        if CryptoUtils.is_encrypted(value):
            logger.warning("Creating Secret from already-encrypted value. This can be dangerous.")

        # Try to encrypt, but fall back to plaintext if no encryption key
        try:
            encrypted = CryptoUtils.encrypt(value)
            return cls.model_construct(encrypted_value=encrypted, was_encrypted=False)
        except ValueError as e:
            # No encryption key available, store as plaintext
            if "No encryption key configured" in str(e):
                logger.warning(
                    "No encryption key configured. Storing Secret value as plaintext. "
                    "Set LETTA_ENCRYPTION_KEY environment variable to enable encryption."
                )
                instance = cls.model_construct(encrypted_value=value, was_encrypted=False)
                instance._plaintext_cache = value  # Cache it
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
    def from_db(cls, encrypted_value: Optional[str], plaintext_value: Optional[str]) -> "Secret":
        """
        Create a Secret from database values during migration phase.

        Prefers encrypted value if available, falls back to plaintext.

        Args:
            encrypted_value: The encrypted value from the database
            plaintext_value: The plaintext value from the database

        Returns:
            A Secret instance
        """
        if encrypted_value is not None:
            return cls.from_encrypted(encrypted_value)
        elif plaintext_value is not None:
            return cls.from_plaintext(plaintext_value)
        else:
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

        Returns:
            The decrypted plaintext value
        """
        if self.encrypted_value is None:
            return None

        # Use cached value if available, but only if it looks like plaintext
        # or we're confident we can decrypt it
        if self._plaintext_cache is not None:
            # If we have a cache but the stored value looks encrypted and we have no key,
            # we should not use the cache
            if CryptoUtils.is_encrypted(self.encrypted_value) and not CryptoUtils.is_encryption_available():
                self._plaintext_cache = None  # Clear invalid cache
            else:
                return self._plaintext_cache

        # Decrypt and cache
        try:
            plaintext = CryptoUtils.decrypt(self.encrypted_value)
            # Cache the decrypted value (PrivateAttr fields can be mutated even with frozen=True)
            self._plaintext_cache = plaintext
            return plaintext
        except ValueError as e:
            error_msg = str(e)

            # Handle missing encryption key
            if "No encryption key configured" in error_msg:
                # Check if the value looks encrypted
                if CryptoUtils.is_encrypted(self.encrypted_value):
                    # Value was encrypted, but now we have no key - can't decrypt
                    logger.warning(
                        "Cannot decrypt Secret value - no encryption key configured. "
                        "The value was encrypted and requires the original key to decrypt."
                    )
                    # Return None to indicate we can't get the plaintext
                    return None
                else:
                    # Value is plaintext (stored when no key was available)
                    logger.debug("Secret value is plaintext (stored without encryption)")
                    self._plaintext_cache = self.encrypted_value
                    return self.encrypted_value

            # Handle decryption failure (might be plaintext stored as such)
            elif "Failed to decrypt data" in error_msg:
                # Check if it might be plaintext
                if not CryptoUtils.is_encrypted(self.encrypted_value):
                    # It's plaintext that was stored when no key was available
                    logger.debug("Secret value appears to be plaintext (stored without encryption)")
                    self._plaintext_cache = self.encrypted_value
                    return self.encrypted_value
                # Otherwise, it's corrupted or wrong key
                logger.error("Failed to decrypt Secret value - data may be corrupted or wrong key")
                raise

            # Migration case: handle legacy plaintext
            elif not self.was_encrypted:
                if self.encrypted_value and not CryptoUtils.is_encrypted(self.encrypted_value):
                    self._plaintext_cache = self.encrypted_value
                    return self.encrypted_value
                return None

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
