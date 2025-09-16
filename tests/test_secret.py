import json

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
        """Test creating a Secret from plaintext without encryption key."""
        from letta.settings import settings

        # Clear encryption key
        original_key = settings.encryption_key
        settings.encryption_key = None

        try:
            plaintext = "my-plaintext-value"

            # Should raise error when trying to encrypt without key
            with pytest.raises(ValueError):
                Secret.from_plaintext(plaintext)
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
