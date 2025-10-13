import base64
import os
from typing import Optional

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from letta.settings import settings


class CryptoUtils:
    """Utility class for AES-256-GCM encryption/decryption of sensitive data."""

    # AES-256 requires 32 bytes key
    KEY_SIZE = 32
    # GCM standard IV size is 12 bytes (96 bits)
    IV_SIZE = 12
    # GCM tag size is 16 bytes (128 bits)
    TAG_SIZE = 16
    # Salt size for key derivation
    SALT_SIZE = 16

    @classmethod
    def _derive_key(cls, master_key: str, salt: bytes) -> bytes:
        """Derive an AES key from the master key using PBKDF2."""
        kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=cls.KEY_SIZE, salt=salt, iterations=100000, backend=default_backend())
        return kdf.derive(master_key.encode())

    @classmethod
    def encrypt(cls, plaintext: str, master_key: Optional[str] = None) -> str:
        """
        Encrypt a string using AES-256-GCM.

        Args:
            plaintext: The string to encrypt
            master_key: Optional master key (defaults to settings.encryption_key)

        Returns:
            Base64 encoded string containing: salt + iv + ciphertext + tag

        Raises:
            ValueError: If no encryption key is configured
        """
        if master_key is None:
            master_key = settings.encryption_key

        if not master_key:
            raise ValueError(
                "No encryption key configured. Please set the LETTA_ENCRYPTION_KEY environment variable (not fully supported yet for Letta v0.12.1 and below)."
            )

        # Generate random salt and IV
        salt = os.urandom(cls.SALT_SIZE)
        iv = os.urandom(cls.IV_SIZE)

        # Derive key from master key
        key = cls._derive_key(master_key, salt)

        # Create cipher
        cipher = Cipher(algorithms.AES(key), modes.GCM(iv), backend=default_backend())
        encryptor = cipher.encryptor()

        # Encrypt the plaintext
        ciphertext = encryptor.update(plaintext.encode()) + encryptor.finalize()

        # Get the authentication tag
        tag = encryptor.tag

        # Combine salt + iv + ciphertext + tag
        encrypted_data = salt + iv + ciphertext + tag

        # Return as base64 encoded string
        return base64.b64encode(encrypted_data).decode("utf-8")

    @classmethod
    def decrypt(cls, encrypted: str, master_key: Optional[str] = None) -> str:
        """
        Decrypt a string that was encrypted using AES-256-GCM.

        Args:
            encrypted: Base64 encoded encrypted string
            master_key: Optional master key (defaults to settings.encryption_key)

        Returns:
            The decrypted plaintext string

        Raises:
            ValueError: If no encryption key is configured or decryption fails
        """
        if master_key is None:
            master_key = settings.encryption_key

        if not master_key:
            raise ValueError(
                "No encryption key configured. Please set the LETTA_ENCRYPTION_KEY environment variable (not fully supported yet for Letta v0.12.1 and below)."
            )

        try:
            # Decode from base64
            encrypted_data = base64.b64decode(encrypted)

            # Extract components
            salt = encrypted_data[: cls.SALT_SIZE]
            iv = encrypted_data[cls.SALT_SIZE : cls.SALT_SIZE + cls.IV_SIZE]
            ciphertext = encrypted_data[cls.SALT_SIZE + cls.IV_SIZE : -cls.TAG_SIZE]
            tag = encrypted_data[-cls.TAG_SIZE :]

            # Derive key from master key
            key = cls._derive_key(master_key, salt)

            # Create cipher
            cipher = Cipher(algorithms.AES(key), modes.GCM(iv, tag), backend=default_backend())
            decryptor = cipher.decryptor()

            # Decrypt the ciphertext
            plaintext = decryptor.update(ciphertext) + decryptor.finalize()

            return plaintext.decode("utf-8")

        except Exception as e:
            raise ValueError(f"Failed to decrypt data: {str(e)}")

    @classmethod
    def is_encrypted(cls, value: str) -> bool:
        """
        Check if a string appears to be encrypted (base64 encoded with correct size).

        This is a heuristic check and may have false positives.
        """
        try:
            decoded = base64.b64decode(value)
            # Check if length is consistent with our encryption format
            # Minimum size: salt(16) + iv(12) + tag(16) + at least 1 byte of ciphertext
            return len(decoded) >= cls.SALT_SIZE + cls.IV_SIZE + cls.TAG_SIZE + 1
        except Exception:
            return False

    @classmethod
    def is_encryption_available(cls) -> bool:
        """
        Check if encryption is available (encryption key is configured).

        Returns:
            True if encryption key is configured, False otherwise
        """
        return bool(settings.encryption_key)
