import json
from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict, PrivateAttr

from letta.helpers.crypto_utils import CryptoUtils


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
        Create a Secret from a plaintext value, encrypting it immediately.

        Args:
            value: The plaintext value to encrypt

        Returns:
            A Secret instance with the encrypted value
        """
        if value is None:
            instance = cls()
            instance._encrypted_value = None
            instance._was_encrypted = False
            return instance

        encrypted = CryptoUtils.encrypt(value)
        instance = cls()
        instance._encrypted_value = encrypted
        instance._was_encrypted = False
        return instance

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

        # Use cached value if available
        if self._plaintext_cache is not None:
            return self._plaintext_cache

        # Decrypt and cache
        try:
            plaintext = CryptoUtils.decrypt(self._encrypted_value)
            # Cache the decrypted value (PrivateAttr fields can be mutated even with frozen=True)
            self._plaintext_cache = plaintext
            return plaintext
        except Exception:
            # If decryption fails and this wasn't originally encrypted,
            # it might be that the value is actually plaintext (during migration)
            if not self._was_encrypted:
                return None
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

        # Serialize to JSON then encrypt
        json_str = json.dumps(value)
        encrypted = CryptoUtils.encrypt(json_str)
        instance = cls()
        instance._encrypted_value = encrypted
        instance._was_encrypted = False
        return instance

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

        # Use cached value if available
        if self._plaintext_cache is not None:
            return self._plaintext_cache

        try:
            decrypted_json = CryptoUtils.decrypt(self._encrypted_value)
            plaintext_dict = json.loads(decrypted_json)
            # Cache the decrypted value (PrivateAttr fields can be mutated even with frozen=True)
            self._plaintext_cache = plaintext_dict
            return plaintext_dict
        except Exception:
            if not self._was_encrypted:
                return None
            raise

    def is_empty(self) -> bool:
        """Check if the secret dict is empty/None."""
        return self._encrypted_value is None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for database storage."""
        return {"encrypted": self.get_encrypted(), "plaintext": self.get_plaintext() if not self._was_encrypted else None}
