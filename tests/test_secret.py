import json
from unittest.mock import MagicMock, patch

import pytest

from letta.helpers.crypto_utils import CryptoUtils
from letta.schemas.secret import Secret, SecretDict


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
            assert secret._encrypted_value is not None
            assert secret._encrypted_value != plaintext
            assert secret._was_encrypted is False

            # Should decrypt to original value
            assert secret.get_plaintext() == plaintext
        finally:
            settings.encryption_key = original_key

    def test_from_plaintext_without_key(self):
        """Test creating a Secret from plaintext without encryption key (fallback behavior)."""
        from letta.settings import settings

        # Clear encryption key
        original_key = settings.encryption_key
        settings.encryption_key = None

        try:
            plaintext = "my-plaintext-value"

            # Should now handle gracefully and store as plaintext
            secret = Secret.from_plaintext(plaintext)

            # Should store the plaintext value
            assert secret._encrypted_value == plaintext
            assert secret.get_plaintext() == plaintext
            assert not secret._was_encrypted
        finally:
            settings.encryption_key = original_key

    def test_from_plaintext_with_none(self):
        """Test creating a Secret from None value."""
        secret = Secret.from_plaintext(None)

        assert secret._encrypted_value is None
        assert secret._was_encrypted is False
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

            assert secret._encrypted_value == encrypted
            assert secret._was_encrypted is True
            assert secret.get_plaintext() == plaintext
        finally:
            settings.encryption_key = original_key

    def test_from_db_with_encrypted_value(self):
        """Test creating a Secret from database with encrypted value."""
        from letta.settings import settings

        original_key = settings.encryption_key
        settings.encryption_key = self.MOCK_KEY

        try:
            plaintext = "database-secret"
            encrypted = CryptoUtils.encrypt(plaintext, self.MOCK_KEY)

            secret = Secret.from_db(encrypted_value=encrypted, plaintext_value=None)

            assert secret._encrypted_value == encrypted
            assert secret._was_encrypted is True
            assert secret.get_plaintext() == plaintext
        finally:
            settings.encryption_key = original_key

    def test_from_db_with_plaintext_value(self):
        """Test creating a Secret from database with plaintext value (backward compatibility)."""
        from letta.settings import settings

        original_key = settings.encryption_key
        settings.encryption_key = self.MOCK_KEY

        try:
            plaintext = "legacy-plaintext"

            # When only plaintext is provided, should encrypt it
            secret = Secret.from_db(encrypted_value=None, plaintext_value=plaintext)

            # Should encrypt the plaintext
            assert secret._encrypted_value is not None
            assert secret._was_encrypted is False
            assert secret.get_plaintext() == plaintext
        finally:
            settings.encryption_key = original_key

    def test_from_db_dual_read(self):
        """Test dual read functionality - prefer encrypted over plaintext."""
        from letta.settings import settings

        original_key = settings.encryption_key
        settings.encryption_key = self.MOCK_KEY

        try:
            plaintext = "correct-value"
            old_plaintext = "old-legacy-value"
            encrypted = CryptoUtils.encrypt(plaintext, self.MOCK_KEY)

            # When both values exist, should prefer encrypted
            secret = Secret.from_db(encrypted_value=encrypted, plaintext_value=old_plaintext)

            assert secret.get_plaintext() == plaintext  # Should use encrypted value, not plaintext
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


class TestSecretDict:
    """Test suite for SecretDict wrapper class."""

    MOCK_KEY = "test-secretdict-key-1234567890"

    def test_from_plaintext_dict(self):
        """Test creating a SecretDict from plaintext dictionary."""
        from letta.settings import settings

        original_key = settings.encryption_key
        settings.encryption_key = self.MOCK_KEY

        try:
            plaintext_dict = {"api_key": "sk-1234567890", "api_secret": "secret-value", "nested": {"token": "bearer-token"}}

            secret_dict = SecretDict.from_plaintext(plaintext_dict)

            # Should store encrypted JSON
            assert secret_dict._encrypted_value is not None

            # Should decrypt to original dict
            assert secret_dict.get_plaintext() == plaintext_dict
        finally:
            settings.encryption_key = original_key

    def test_from_plaintext_none(self):
        """Test creating a SecretDict from None value."""
        secret_dict = SecretDict.from_plaintext(None)

        assert secret_dict._encrypted_value is None
        assert secret_dict.get_plaintext() is None

    def test_from_encrypted_with_json(self):
        """Test creating a SecretDict from encrypted JSON."""
        from letta.settings import settings

        original_key = settings.encryption_key
        settings.encryption_key = self.MOCK_KEY

        try:
            plaintext_dict = {"header1": "value1", "Authorization": "Bearer token123"}

            json_str = json.dumps(plaintext_dict)
            encrypted = CryptoUtils.encrypt(json_str, self.MOCK_KEY)

            secret_dict = SecretDict.from_encrypted(encrypted)

            assert secret_dict._encrypted_value == encrypted
            assert secret_dict.get_plaintext() == plaintext_dict
        finally:
            settings.encryption_key = original_key

    def test_from_db_with_encrypted(self):
        """Test creating SecretDict from database with encrypted value."""
        from letta.settings import settings

        original_key = settings.encryption_key
        settings.encryption_key = self.MOCK_KEY

        try:
            plaintext_dict = {"key": "value"}
            json_str = json.dumps(plaintext_dict)
            encrypted = CryptoUtils.encrypt(json_str, self.MOCK_KEY)

            secret_dict = SecretDict.from_db(encrypted_value=encrypted, plaintext_value=None)

            assert secret_dict.get_plaintext() == plaintext_dict
        finally:
            settings.encryption_key = original_key

    def test_from_db_with_plaintext_json(self):
        """Test creating SecretDict from database with plaintext JSON (backward compatibility)."""
        from letta.settings import settings

        original_key = settings.encryption_key
        settings.encryption_key = self.MOCK_KEY

        try:
            plaintext_dict = {"legacy": "headers"}

            # from_db expects a Dict, not a JSON string
            secret_dict = SecretDict.from_db(encrypted_value=None, plaintext_value=plaintext_dict)

            assert secret_dict.get_plaintext() == plaintext_dict
            # Should have encrypted it
            assert secret_dict._encrypted_value is not None
        finally:
            settings.encryption_key = original_key

    def test_complex_nested_structure(self):
        """Test SecretDict with complex nested structures."""
        from letta.settings import settings

        original_key = settings.encryption_key
        settings.encryption_key = self.MOCK_KEY

        try:
            complex_dict = {
                "level1": {"level2": {"level3": ["item1", "item2"], "secret": "nested-secret"}, "array": [1, 2, {"nested": "value"}]},
                "simple": "value",
                "number": 42,
                "boolean": True,
                "null": None,
            }

            secret_dict = SecretDict.from_plaintext(complex_dict)
            decrypted = secret_dict.get_plaintext()

            assert decrypted == complex_dict
        finally:
            settings.encryption_key = original_key

    def test_empty_dict(self):
        """Test SecretDict with empty dictionary."""
        from letta.settings import settings

        original_key = settings.encryption_key
        settings.encryption_key = self.MOCK_KEY

        try:
            empty_dict = {}

            secret_dict = SecretDict.from_plaintext(empty_dict)
            assert secret_dict.get_plaintext() == empty_dict

            # Encrypted value should still be created
            encrypted = secret_dict.get_encrypted()
            assert encrypted is not None
        finally:
            settings.encryption_key = original_key

    def test_dual_read_prefer_encrypted(self):
        """Test that SecretDict prefers encrypted value over plaintext when both exist."""
        from letta.settings import settings

        original_key = settings.encryption_key
        settings.encryption_key = self.MOCK_KEY

        try:
            new_dict = {"current": "value"}
            old_dict = {"legacy": "value"}

            encrypted = CryptoUtils.encrypt(json.dumps(new_dict), self.MOCK_KEY)
            plaintext = json.dumps(old_dict)

            secret_dict = SecretDict.from_db(encrypted_value=encrypted, plaintext_value=plaintext)

            # Should use encrypted value, not plaintext
            assert secret_dict.get_plaintext() == new_dict
        finally:
            settings.encryption_key = original_key

    def test_plaintext_dict_caching(self):
        """Test that plaintext dictionary values are cached after first decryption."""
        from letta.settings import settings

        original_key = settings.encryption_key
        settings.encryption_key = self.MOCK_KEY

        try:
            plaintext_dict = {"key1": "value1", "key2": "value2", "nested": {"inner": "value"}}
            secret_dict = SecretDict.from_plaintext(plaintext_dict)

            # First call should decrypt and cache
            result1 = secret_dict.get_plaintext()
            assert result1 == plaintext_dict
            assert secret_dict._plaintext_cache == plaintext_dict

            # Second call should use cache
            result2 = secret_dict.get_plaintext()
            assert result2 == plaintext_dict
            assert result1 is result2  # Should be the same object reference
        finally:
            settings.encryption_key = original_key

    def test_dict_caching_only_decrypts_once(self):
        """Test that SecretDict decryption only happens once when caching is enabled."""
        from letta.settings import settings

        original_key = settings.encryption_key
        settings.encryption_key = self.MOCK_KEY

        try:
            plaintext_dict = {"api_key": "sk-12345", "api_secret": "secret-value"}
            encrypted = CryptoUtils.encrypt(json.dumps(plaintext_dict), self.MOCK_KEY)

            # Create a SecretDict from encrypted value
            secret_dict = SecretDict.from_encrypted(encrypted)

            # Mock the decrypt method to track calls
            with patch.object(CryptoUtils, "decrypt", wraps=CryptoUtils.decrypt) as mock_decrypt:
                # First call should decrypt
                result1 = secret_dict.get_plaintext()
                assert result1 == plaintext_dict
                assert mock_decrypt.call_count == 1

                # Second and third calls should use cache
                result2 = secret_dict.get_plaintext()
                result3 = secret_dict.get_plaintext()
                assert result2 == plaintext_dict
                assert result3 == plaintext_dict

                # Decrypt should still have been called only once
                assert mock_decrypt.call_count == 1
        finally:
            settings.encryption_key = original_key

    def test_cache_handles_none_values(self):
        """Test that caching works correctly with None/empty values."""
        # Test with None value
        secret_dict = SecretDict.from_plaintext(None)

        # First call
        result1 = secret_dict.get_plaintext()
        assert result1 is None

        # Second call should also return None (not trying to decrypt)
        result2 = secret_dict.get_plaintext()
        assert result2 is None

    def test_from_plaintext_dict_without_key(self):
        """Test creating a SecretDict from plaintext dictionary without encryption key (fallback)."""
        from letta.settings import settings

        original_key = settings.encryption_key
        settings.encryption_key = None

        try:
            plaintext_dict = {"key1": "value1", "key2": "value2"}

            # Should handle gracefully and store as JSON plaintext
            secret_dict = SecretDict.from_plaintext(plaintext_dict)

            # Should store the JSON string
            assert secret_dict._encrypted_value == json.dumps(plaintext_dict)
            assert secret_dict.get_plaintext() == plaintext_dict
            assert not secret_dict._was_encrypted
        finally:
            settings.encryption_key = original_key

    def test_encryption_key_transition_no_key_to_has_key(self):
        """Test transition from no encryption key to having one."""
        from letta.settings import settings

        original_key = settings.encryption_key

        try:
            # Start with no encryption key
            settings.encryption_key = None

            # Create secrets without encryption
            plaintext = "test-value-123"
            secret = Secret.from_plaintext(plaintext)

            plaintext_dict = {"api_key": "sk-12345", "api_secret": "secret"}
            secret_dict = SecretDict.from_plaintext(plaintext_dict)

            # Verify they're stored as plaintext
            assert secret._encrypted_value == plaintext
            assert secret_dict._encrypted_value == json.dumps(plaintext_dict)

            # Now add an encryption key
            settings.encryption_key = self.MOCK_KEY

            # Should still be able to read the plaintext values
            assert secret.get_plaintext() == plaintext
            assert secret_dict.get_plaintext() == plaintext_dict

            # Create new secrets with encryption enabled
            new_secret = Secret.from_plaintext("new-encrypted-value")
            assert new_secret._encrypted_value != "new-encrypted-value"  # Should be encrypted

        finally:
            settings.encryption_key = original_key

    def test_encryption_key_transition_has_key_to_no_key(self):
        """Test transition from having encryption key to not having one."""
        from letta.settings import settings

        original_key = settings.encryption_key

        try:
            # Start with encryption key
            settings.encryption_key = self.MOCK_KEY

            # Create secrets with encryption
            plaintext = "encrypted-test-value"
            secret = Secret.from_plaintext(plaintext)

            plaintext_dict = {"token": "bearer-xyz", "key": "value"}
            secret_dict = SecretDict.from_plaintext(plaintext_dict)

            # Verify they're encrypted
            assert secret._encrypted_value != plaintext
            assert secret_dict._encrypted_value != json.dumps(plaintext_dict)

            # Remove encryption key
            settings.encryption_key = None

            # Should handle gracefully - return None for encrypted values
            # (can't decrypt without key)
            result = secret.get_plaintext()
            assert result is None  # Can't decrypt without key

            dict_result = secret_dict.get_plaintext()
            assert dict_result is None  # Can't decrypt without key

        finally:
            settings.encryption_key = original_key

    def test_round_trip_compatibility(self):
        """Test that values can be read correctly regardless of when they were stored."""
        from letta.settings import settings

        original_key = settings.encryption_key

        try:
            # Create some values without encryption
            settings.encryption_key = None
            unencrypted_secret = Secret.from_plaintext("unencrypted")
            unencrypted_dict = SecretDict.from_plaintext({"plain": "text"})

            # Create some values with encryption
            settings.encryption_key = self.MOCK_KEY
            encrypted_secret = Secret.from_plaintext("encrypted")
            encrypted_dict = SecretDict.from_plaintext({"secure": "data"})

            # Mix them - can read unencrypted with key present
            assert unencrypted_secret.get_plaintext() == "unencrypted"
            assert unencrypted_dict.get_plaintext() == {"plain": "text"}
            assert encrypted_secret.get_plaintext() == "encrypted"
            assert encrypted_dict.get_plaintext() == {"secure": "data"}

            # Remove key - can only read unencrypted
            settings.encryption_key = None
            assert unencrypted_secret.get_plaintext() == "unencrypted"
            assert unencrypted_dict.get_plaintext() == {"plain": "text"}
            assert encrypted_secret.get_plaintext() is None  # Can't decrypt
            assert encrypted_dict.get_plaintext() is None  # Can't decrypt

            # Restore key - can read all again
            settings.encryption_key = self.MOCK_KEY
            assert unencrypted_secret.get_plaintext() == "unencrypted"
            assert unencrypted_dict.get_plaintext() == {"plain": "text"}
            assert encrypted_secret.get_plaintext() == "encrypted"
            assert encrypted_dict.get_plaintext() == {"secure": "data"}

        finally:
            settings.encryption_key = original_key
