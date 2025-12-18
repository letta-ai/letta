import json
from unittest.mock import MagicMock, patch

import pytest

from letta.helpers.crypto_utils import CryptoUtils
from letta.schemas.secret import Secret


class TestSecret:
    """Test suite for Secret wrapper class."""

    MOCK_KEY = "test-secret-key-1234567890"

    def test_from_plaintext_with_key(self):
        """Test creating a Secret from plaintext value with encryption key."""
        from letta.settings import settings

        # Set encryption key
        original_key = settings.encryption_key
        settings.encryption_key = self.MOCK_KEY

        try:
            plaintext = "my-secret-value"

            secret = Secret.from_plaintext(plaintext)

            # Should store encrypted value
            assert secret.encrypted_value is not None
            assert secret.encrypted_value != plaintext

            # Should decrypt to original value
            assert secret.get_plaintext() == plaintext
        finally:
            settings.encryption_key = original_key

    def test_from_plaintext_without_key_stores_plaintext(self):
        """Test creating a Secret from plaintext without encryption key stores as plaintext."""
        from letta.settings import settings

        # Clear encryption key
        original_key = settings.encryption_key
        settings.encryption_key = None

        try:
            plaintext = "my-plaintext-value"

            # Should store as plaintext in _enc column when no encryption key
            secret = Secret.from_plaintext(plaintext)

            # Should store the plaintext value directly in encrypted_value
            assert secret.encrypted_value == plaintext
            assert secret.get_plaintext() == plaintext
        finally:
            settings.encryption_key = original_key

    def test_from_plaintext_with_none(self):
        """Test creating a Secret from None value."""
        secret = Secret.from_plaintext(None)

        assert secret.encrypted_value is None
        assert secret.get_plaintext() is None
        assert secret.is_empty() is True

    def test_from_encrypted(self):
        """Test creating a Secret from already encrypted value."""
        from letta.settings import settings

        original_key = settings.encryption_key
        settings.encryption_key = self.MOCK_KEY

        try:
            plaintext = "database-secret"
            encrypted = CryptoUtils.encrypt(plaintext, self.MOCK_KEY)

            secret = Secret.from_encrypted(encrypted)

            assert secret.encrypted_value == encrypted
            assert secret.get_plaintext() == plaintext
        finally:
            settings.encryption_key = original_key

    def test_get_encrypted(self):
        """Test getting the encrypted value for database storage."""
        from letta.settings import settings

        original_key = settings.encryption_key
        settings.encryption_key = self.MOCK_KEY

        try:
            plaintext = "test-encryption"

            secret = Secret.from_plaintext(plaintext)
            encrypted_value = secret.get_encrypted()

            assert encrypted_value is not None

            # Should decrypt back to original
            decrypted = CryptoUtils.decrypt(encrypted_value, self.MOCK_KEY)
            assert decrypted == plaintext
        finally:
            settings.encryption_key = original_key

    def test_is_empty(self):
        """Test checking if secret is empty."""
        # Empty secret
        empty_secret = Secret.from_plaintext(None)
        assert empty_secret.is_empty() is True

        # Non-empty secret
        from letta.settings import settings

        original_key = settings.encryption_key
        settings.encryption_key = self.MOCK_KEY

        try:
            non_empty_secret = Secret.from_plaintext("value")
            assert non_empty_secret.is_empty() is False
        finally:
            settings.encryption_key = original_key

    def test_string_representation(self):
        """Test that string representation doesn't expose secret."""
        from letta.settings import settings

        original_key = settings.encryption_key
        settings.encryption_key = self.MOCK_KEY

        try:
            secret = Secret.from_plaintext("sensitive-data")

            # String representation should not contain the actual value
            str_repr = str(secret)
            assert "sensitive-data" not in str_repr
            assert "****" in str_repr

            # Empty secret
            empty_secret = Secret.from_plaintext(None)
            assert "empty" in str(empty_secret)
        finally:
            settings.encryption_key = original_key

    def test_equality(self):
        """Test comparing two secrets."""
        from letta.settings import settings

        original_key = settings.encryption_key
        settings.encryption_key = self.MOCK_KEY

        try:
            plaintext = "same-value"

            secret1 = Secret.from_plaintext(plaintext)
            secret2 = Secret.from_plaintext(plaintext)

            # Should be equal based on plaintext value
            assert secret1 == secret2

            # Different values should not be equal
            secret3 = Secret.from_plaintext("different-value")
            assert secret1 != secret3
        finally:
            settings.encryption_key = original_key

    def test_plaintext_caching(self):
        """Test that plaintext values are cached after first decryption."""
        from letta.settings import settings

        original_key = settings.encryption_key
        settings.encryption_key = self.MOCK_KEY

        try:
            plaintext = "cached-value"
            secret = Secret.from_plaintext(plaintext)

            # First call should decrypt and cache
            result1 = secret.get_plaintext()
            assert result1 == plaintext
            assert secret._plaintext_cache == plaintext

            # Second call should use cache
            result2 = secret.get_plaintext()
            assert result2 == plaintext
            assert result1 is result2  # Should be the same object reference
        finally:
            settings.encryption_key = original_key

    def test_caching_only_decrypts_once(self):
        """Test that decryption only happens once when caching is enabled."""
        from letta.settings import settings

        original_key = settings.encryption_key
        settings.encryption_key = self.MOCK_KEY

        try:
            plaintext = "test-single-decrypt"
            encrypted = CryptoUtils.encrypt(plaintext, self.MOCK_KEY)

            # Create a Secret from encrypted value
            secret = Secret.from_encrypted(encrypted)

            # Mock the decrypt method to track calls
            with patch.object(CryptoUtils, "decrypt", wraps=CryptoUtils.decrypt) as mock_decrypt:
                # First call should decrypt
                result1 = secret.get_plaintext()
                assert result1 == plaintext
                assert mock_decrypt.call_count == 1

                # Second and third calls should use cache
                result2 = secret.get_plaintext()
                result3 = secret.get_plaintext()
                assert result2 == plaintext
                assert result3 == plaintext

                # Decrypt should still have been called only once
                assert mock_decrypt.call_count == 1
        finally:
            settings.encryption_key = original_key
