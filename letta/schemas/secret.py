import json
from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict, PrivateAttr

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
    - Remove the _was_encrypted flag (no longer needed for migration)
    - Simplify get_plaintext() to only handle encrypted values
    """

    # Store the encrypted value
    _encrypted_value: Optional[str] = PrivateAttr(default=None)
    # Cache the decrypted value to avoid repeated decryption
    _plaintext_cache: Optional[str] = PrivateAttr(default=None)
    # Flag to indicate if the value was originally encrypted
    _was_encrypted: bool = PrivateAttr(default=False)

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
            instance = cls()
            instance._encrypted_value = None
            instance._was_encrypted = False
            return instance

        # Try to encrypt, but fall back to plaintext if no encryption key
        try:
            encrypted = CryptoUtils.encrypt(value)
            instance = cls()
            instance._encrypted_value = encrypted
            instance._was_encrypted = False
            return instance
        except ValueError as e:
            # No encryption key available, store as plaintext
            if "No encryption key configured" in str(e):
                logger.warning(
                    "No encryption key configured. Storing Secret value as plaintext. "
                    "Set LETTA_ENCRYPTION_KEY environment variable to enable encryption."
                )
                instance = cls()
                instance._encrypted_value = value  # Store plaintext
                instance._plaintext_cache = value  # Cache it
                instance._was_encrypted = False
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
        instance = cls()
        instance._encrypted_value = encrypted_value
        instance._was_encrypted = True
        return instance

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
        return self._encrypted_value

    def get_plaintext(self) -> Optional[str]:
        """
        Get the decrypted plaintext value.

        This should only be called when the plaintext is actually needed,
        such as when making an external API call.

        Returns:
            The decrypted plaintext value
        """
        if self._encrypted_value is None:
            return None

        # Use cached value if available, but only if it looks like plaintext
        # or we're confident we can decrypt it
        if self._plaintext_cache is not None:
            # If we have a cache but the stored value looks encrypted and we have no key,
            # we should not use the cache
            if CryptoUtils.is_encrypted(self._encrypted_value) and not CryptoUtils.is_encryption_available():
                self._plaintext_cache = None  # Clear invalid cache
            else:
                return self._plaintext_cache

        # Decrypt and cache
        try:
            plaintext = CryptoUtils.decrypt(self._encrypted_value)
            # Cache the decrypted value (PrivateAttr fields can be mutated even with frozen=True)
            self._plaintext_cache = plaintext
            return plaintext
        except ValueError as e:
            error_msg = str(e)

            # Handle missing encryption key
            if "No encryption key configured" in error_msg:
                # Check if the value looks encrypted
                if CryptoUtils.is_encrypted(self._encrypted_value):
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
                    self._plaintext_cache = self._encrypted_value
                    return self._encrypted_value

            # Handle decryption failure (might be plaintext stored as such)
            elif "Failed to decrypt data" in error_msg:
                # Check if it might be plaintext
                if not CryptoUtils.is_encrypted(self._encrypted_value):
                    # It's plaintext that was stored when no key was available
                    logger.debug("Secret value appears to be plaintext (stored without encryption)")
                    self._plaintext_cache = self._encrypted_value
                    return self._encrypted_value
                # Otherwise, it's corrupted or wrong key
                logger.error("Failed to decrypt Secret value - data may be corrupted or wrong key")
                raise

            # Migration case: handle legacy plaintext
            elif not self._was_encrypted:
                if self._encrypted_value and not CryptoUtils.is_encrypted(self._encrypted_value):
                    self._plaintext_cache = self._encrypted_value
                    return self._encrypted_value
                return None

            # Re-raise for other errors
            raise

    def is_empty(self) -> bool:
        """Check if the secret is empty/None."""
        return self._encrypted_value is None

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
        return {"encrypted": self.get_encrypted(), "plaintext": self.get_plaintext() if not self._was_encrypted else None}

    def __eq__(self, other: Any) -> bool:
        """
        Compare two secrets by their plaintext values.

        Note: This decrypts both values, so use sparingly.
        """
        if not isinstance(other, Secret):
            return False
        return self.get_plaintext() == other.get_plaintext()


class SecretDict(BaseModel):
    """
    A wrapper for dictionaries containing sensitive key-value pairs.

    Used for custom headers and other key-value configurations.

    TODO: Once we deprecate plaintext columns in the database:
    - Remove the dual-write logic in to_dict()
    - Remove the from_db() method's plaintext_value parameter
    - Remove the _was_encrypted flag (no longer needed for migration)
    - Simplify get_plaintext() to only handle encrypted JSON values
    """

    _encrypted_value: Optional[str] = PrivateAttr(default=None)
    _plaintext_cache: Optional[Dict[str, str]] = PrivateAttr(default=None)
    _was_encrypted: bool = PrivateAttr(default=False)

    model_config = ConfigDict(frozen=True)

    @classmethod
    def from_plaintext(cls, value: Optional[Dict[str, str]]) -> "SecretDict":
        """Create a SecretDict from a plaintext dictionary."""
        if value is None:
            instance = cls()
            instance._encrypted_value = None
            instance._was_encrypted = False
            return instance

        # Serialize to JSON then try to encrypt
        json_str = json.dumps(value)
        try:
            encrypted = CryptoUtils.encrypt(json_str)
            instance = cls()
            instance._encrypted_value = encrypted
            instance._was_encrypted = False
            return instance
        except ValueError as e:
            # No encryption key available, store as plaintext JSON
            if "No encryption key configured" in str(e):
                logger.warning(
                    "No encryption key configured. Storing SecretDict value as plaintext JSON. "
                    "Set LETTA_ENCRYPTION_KEY environment variable to enable encryption."
                )
                instance = cls()
                instance._encrypted_value = json_str  # Store JSON string
                instance._plaintext_cache = value  # Cache the dict
                instance._was_encrypted = False
                return instance
            raise  # Re-raise if it's a different error

    @classmethod
    def from_encrypted(cls, encrypted_value: Optional[str]) -> "SecretDict":
        """Create a SecretDict from an encrypted value."""
        instance = cls()
        instance._encrypted_value = encrypted_value
        instance._was_encrypted = True
        return instance

    @classmethod
    def from_db(cls, encrypted_value: Optional[str], plaintext_value: Optional[Dict[str, str]]) -> "SecretDict":
        """Create a SecretDict from database values during migration phase."""
        if encrypted_value is not None:
            return cls.from_encrypted(encrypted_value)
        elif plaintext_value is not None:
            return cls.from_plaintext(plaintext_value)
        else:
            return cls.from_plaintext(None)

    def get_encrypted(self) -> Optional[str]:
        """Get the encrypted value."""
        return self._encrypted_value

    def get_plaintext(self) -> Optional[Dict[str, str]]:
        """Get the decrypted dictionary."""
        if self._encrypted_value is None:
            return None

        # Use cached value if available, but only if it looks like plaintext
        # or we're confident we can decrypt it
        if self._plaintext_cache is not None:
            # If we have a cache but the stored value looks encrypted and we have no key,
            # we should not use the cache
            if CryptoUtils.is_encrypted(self._encrypted_value) and not CryptoUtils.is_encryption_available():
                self._plaintext_cache = None  # Clear invalid cache
            else:
                return self._plaintext_cache

        try:
            decrypted_json = CryptoUtils.decrypt(self._encrypted_value)
            plaintext_dict = json.loads(decrypted_json)
            # Cache the decrypted value (PrivateAttr fields can be mutated even with frozen=True)
            self._plaintext_cache = plaintext_dict
            return plaintext_dict
        except ValueError as e:
            error_msg = str(e)

            # Handle missing encryption key
            if "No encryption key configured" in error_msg:
                # Check if the value looks encrypted
                if CryptoUtils.is_encrypted(self._encrypted_value):
                    # Value was encrypted, but now we have no key - can't decrypt
                    logger.warning(
                        "Cannot decrypt SecretDict value - no encryption key configured. "
                        "The value was encrypted and requires the original key to decrypt."
                    )
                    # Return None to indicate we can't get the plaintext
                    return None
                else:
                    # Value is plaintext JSON (stored when no key was available)
                    logger.debug("SecretDict value is plaintext JSON (stored without encryption)")
                    try:
                        plaintext_dict = json.loads(self._encrypted_value)
                        self._plaintext_cache = plaintext_dict
                        return plaintext_dict
                    except json.JSONDecodeError:
                        logger.error("Failed to parse SecretDict plaintext as JSON")
                        return None

            # Handle decryption failure (might be plaintext JSON)
            elif "Failed to decrypt data" in error_msg:
                # Check if it might be plaintext JSON
                if not CryptoUtils.is_encrypted(self._encrypted_value):
                    # It's plaintext JSON that was stored when no key was available
                    logger.debug("SecretDict value appears to be plaintext JSON (stored without encryption)")
                    try:
                        plaintext_dict = json.loads(self._encrypted_value)
                        self._plaintext_cache = plaintext_dict
                        return plaintext_dict
                    except json.JSONDecodeError:
                        logger.error("Failed to parse SecretDict plaintext as JSON")
                        return None
                # Otherwise, it's corrupted or wrong key
                logger.error("Failed to decrypt SecretDict value - data may be corrupted or wrong key")
                raise

            # Migration case: handle legacy plaintext
            elif not self._was_encrypted:
                if self._encrypted_value:
                    try:
                        plaintext_dict = json.loads(self._encrypted_value)
                        self._plaintext_cache = plaintext_dict
                        return plaintext_dict
                    except json.JSONDecodeError:
                        pass
                return None

            # Re-raise for other errors
            raise

    def is_empty(self) -> bool:
        """Check if the secret dict is empty/None."""
        return self._encrypted_value is None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for database storage."""
        return {"encrypted": self.get_encrypted(), "plaintext": self.get_plaintext() if not self._was_encrypted else None}
