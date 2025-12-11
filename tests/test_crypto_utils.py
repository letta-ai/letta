import base64
import json
import os
from unittest.mock import patch

import pytest

from letta.helpers.crypto_utils import CryptoUtils


class TestCryptoUtils:
    """Test suite for CryptoUtils encryption/decryption functionality."""

    # Mock master keys for testing
    MOCK_KEY_1 = "test-master-key-1234567890abcdef"
    MOCK_KEY_2 = "another-test-key-fedcba0987654321"

    def test_encrypt_decrypt_roundtrip(self):
        """Test that encryption followed by decryption returns the original value."""
        test_cases = [
            "simple text",
            "text with special chars: !@#$%^&*()",
            "unicode text: 你好世界 🌍",
            "very long text " * 1000,
            '{"json": "data", "nested": {"key": "value"}}',
            "",  # Empty string
        ]

        for plaintext in test_cases:
            encrypted = CryptoUtils.encrypt(plaintext, self.MOCK_KEY_1)
            assert encrypted != plaintext, f"Encryption failed for: {plaintext[:50]}"
            # Encrypted value is base64 encoded
            assert len(encrypted) > 0, "Encrypted value should not be empty"

            decrypted = CryptoUtils.decrypt(encrypted, self.MOCK_KEY_1)
            assert decrypted == plaintext, f"Roundtrip failed for: {plaintext[:50]}"

    def test_encrypt_with_different_keys(self):
        """Test that different keys produce different ciphertexts."""
        plaintext = "sensitive data"

        encrypted1 = CryptoUtils.encrypt(plaintext, self.MOCK_KEY_1)
        encrypted2 = CryptoUtils.encrypt(plaintext, self.MOCK_KEY_2)

        # Different keys should produce different ciphertexts
        assert encrypted1 != encrypted2

        # Each should decrypt correctly with its own key
        assert CryptoUtils.decrypt(encrypted1, self.MOCK_KEY_1) == plaintext
        assert CryptoUtils.decrypt(encrypted2, self.MOCK_KEY_2) == plaintext

    def test_decrypt_with_wrong_key_fails(self):
        """Test that decryption with wrong key raises an error."""
        plaintext = "secret message"
        encrypted = CryptoUtils.encrypt(plaintext, self.MOCK_KEY_1)

        with pytest.raises(Exception):  # Could be ValueError or cryptography exception
            CryptoUtils.decrypt(encrypted, self.MOCK_KEY_2)

    def test_encrypt_none_value(self):
        """Test handling of None values."""
        # Encrypt None should raise TypeError (None has no encode method)
        with pytest.raises((TypeError, AttributeError)):
            CryptoUtils.encrypt(None, self.MOCK_KEY_1)

    def test_decrypt_none_value(self):
        """Test that decrypting None raises an error."""
        with pytest.raises(ValueError):
            CryptoUtils.decrypt(None, self.MOCK_KEY_1)

    def test_decrypt_empty_string(self):
        """Test that decrypting empty string raises an error."""
        with pytest.raises(Exception):  # base64 decode error
            CryptoUtils.decrypt("", self.MOCK_KEY_1)

    def test_decrypt_plaintext_value(self):
        """Test that decrypting non-encrypted value raises an error."""
        plaintext = "not encrypted"
        with pytest.raises(Exception):  # Will fail base64 decode or decryption
            CryptoUtils.decrypt(plaintext, self.MOCK_KEY_1)

    def test_encrypted_format_structure(self):
        """Test the structure of encrypted values."""
        plaintext = "test data"
        encrypted = CryptoUtils.encrypt(plaintext, self.MOCK_KEY_1)

        # Should be base64 encoded
        encrypted_data = encrypted

        # Should be valid base64
        try:
            decoded = base64.b64decode(encrypted_data)
            assert len(decoded) > 0
        except Exception as e:
            pytest.fail(f"Invalid base64 encoding: {e}")

        # Decoded data should contain salt, IV, tag, and ciphertext
        # Total should be at least SALT_SIZE + IV_SIZE + TAG_SIZE bytes
        min_size = CryptoUtils.SALT_SIZE + CryptoUtils.IV_SIZE + CryptoUtils.TAG_SIZE
        assert len(decoded) >= min_size

    def test_deterministic_with_same_salt(self):
        """Test that encryption is deterministic when using the same salt (for testing)."""
        plaintext = "deterministic test"

        # Note: In production, each encryption generates a random salt
        # This test verifies the encryption mechanism itself
        encrypted1 = CryptoUtils.encrypt(plaintext, self.MOCK_KEY_1)
        encrypted2 = CryptoUtils.encrypt(plaintext, self.MOCK_KEY_1)

        # Due to random salt, these should be different
        assert encrypted1 != encrypted2

        # But both should decrypt to the same value
        assert CryptoUtils.decrypt(encrypted1, self.MOCK_KEY_1) == plaintext
        assert CryptoUtils.decrypt(encrypted2, self.MOCK_KEY_1) == plaintext

    def test_encrypt_uses_env_key_when_none_provided(self):
        """Test that encryption uses environment key when no key is provided."""
        from letta.settings import settings

        # Mock the settings to have an encryption key
        original_key = settings.encryption_key
        settings.encryption_key = "env-test-key-123"

        try:
            plaintext = "test with env key"

            # Should use key from settings
            encrypted = CryptoUtils.encrypt(plaintext)
            assert len(encrypted) > 0

            # Should decrypt with same key
            decrypted = CryptoUtils.decrypt(encrypted)
            assert decrypted == plaintext
        finally:
            # Restore original key
            settings.encryption_key = original_key

    def test_encrypt_without_key_raises_error(self):
        """Test that encryption without any key raises an error."""
        from letta.settings import settings

        # Mock settings to have no encryption key
        original_key = settings.encryption_key
        settings.encryption_key = None

        try:
            with pytest.raises(ValueError, match="No encryption key configured"):
                CryptoUtils.encrypt("test data")

            with pytest.raises(ValueError, match="No encryption key configured"):
                CryptoUtils.decrypt("test data")
        finally:
            # Restore original key
            settings.encryption_key = original_key

    def test_large_data_encryption(self):
        """Test encryption of large data."""
        # Create 10MB of data
        large_data = "x" * (10 * 1024 * 1024)

        encrypted = CryptoUtils.encrypt(large_data, self.MOCK_KEY_1)
        assert len(encrypted) > 0
        assert encrypted != large_data

        decrypted = CryptoUtils.decrypt(encrypted, self.MOCK_KEY_1)
        assert decrypted == large_data

    def test_json_data_encryption(self):
        """Test encryption of JSON data."""
        json_data = {
            "user": "test_user",
            "token": "secret_token_123",
            "nested": {"api_key": "sk-1234567890", "headers": {"Authorization": "Bearer token"}},
        }

        json_str = json.dumps(json_data)
        encrypted = CryptoUtils.encrypt(json_str, self.MOCK_KEY_1)

        decrypted_str = CryptoUtils.decrypt(encrypted, self.MOCK_KEY_1)
        decrypted_data = json.loads(decrypted_str)

        assert decrypted_data == json_data

    def test_invalid_encrypted_format(self):
        """Test handling of invalid encrypted data format."""
        invalid_cases = [
            "invalid-base64!@#",  # Invalid base64
            "dGVzdA==",  # Valid base64 but too short for encrypted data
        ]

        for invalid in invalid_cases:
            with pytest.raises(Exception):  # Could be various exceptions
                CryptoUtils.decrypt(invalid, self.MOCK_KEY_1)

    def test_key_derivation_consistency(self):
        """Test that key derivation is consistent."""
        plaintext = "test key derivation"

        # Multiple encryptions with same key should work
        encrypted_values = []
        for _ in range(5):
            encrypted = CryptoUtils.encrypt(plaintext, self.MOCK_KEY_1)
            encrypted_values.append(encrypted)

        # All should decrypt correctly
        for encrypted in encrypted_values:
            assert CryptoUtils.decrypt(encrypted, self.MOCK_KEY_1) == plaintext

    def test_special_characters_in_key(self):
        """Test encryption with keys containing special characters."""
        special_key = "key-with-special-chars!@#$%^&*()_+"
        plaintext = "test data"

        encrypted = CryptoUtils.encrypt(plaintext, special_key)
        decrypted = CryptoUtils.decrypt(encrypted, special_key)

        assert decrypted == plaintext

    def test_whitespace_handling(self):
        """Test encryption of strings with various whitespace."""
        test_cases = [
            "  leading spaces",
            "trailing spaces  ",
            "  both sides  ",
            "multiple\n\nlines",
            "\ttabs\there\t",
            "mixed \t\n whitespace \r\n",
        ]

        for plaintext in test_cases:
            encrypted = CryptoUtils.encrypt(plaintext, self.MOCK_KEY_1)
            decrypted = CryptoUtils.decrypt(encrypted, self.MOCK_KEY_1)
            assert decrypted == plaintext, f"Whitespace handling failed for: {repr(plaintext)}"


class TestIsEncrypted:
    """Test suite for is_encrypted heuristic detection."""

    MOCK_KEY = "test-master-key-1234567890abcdef"

    def test_actually_encrypted_values_detected(self):
        """Test that actually encrypted values are correctly identified."""
        test_values = ["short", "medium length string", "a"]

        for plaintext in test_values:
            encrypted = CryptoUtils.encrypt(plaintext, self.MOCK_KEY)
            assert CryptoUtils.is_encrypted(encrypted), f"Failed to detect encrypted value for: {plaintext}"

    def test_openai_api_keys_not_detected(self):
        """Test that OpenAI API keys are not detected as encrypted."""
        openai_keys = [
            "sk-1234567890abcdefghijklmnopqrstuvwxyz1234567890ab",
            "sk-proj-1234567890abcdefghijklmnopqrstuvwxyz",
            "sk-ant-api03-1234567890abcdefghijklmnopqrstuvwxyz",
        ]

        for key in openai_keys:
            assert not CryptoUtils.is_encrypted(key), f"OpenAI key incorrectly detected as encrypted: {key}"

    def test_github_tokens_not_detected(self):
        """Test that GitHub tokens are not detected as encrypted."""
        github_tokens = [
            "ghp_1234567890abcdefghijklmnopqrstuvwxyz",
            "gho_1234567890abcdefghijklmnopqrstuvwxyz",
            "ghu_1234567890abcdefghijklmnopqrstuvwxyz",
            "ghs_1234567890abcdefghijklmnopqrstuvwxyz",
            "ghr_1234567890abcdefghijklmnopqrstuvwxyz",
        ]

        for token in github_tokens:
            assert not CryptoUtils.is_encrypted(token), f"GitHub token incorrectly detected as encrypted: {token}"

    def test_aws_keys_not_detected(self):
        """Test that AWS access keys are not detected as encrypted."""
        aws_keys = [
            "AKIAIOSFODNN7EXAMPLE",
            "ASIAJEXAMPLEXEG2JICEA",
            "ABIA1234567890ABCDEF",
            "ACCA1234567890ABCDEF",
        ]

        for key in aws_keys:
            assert not CryptoUtils.is_encrypted(key), f"AWS key incorrectly detected as encrypted: {key}"

    def test_slack_tokens_not_detected(self):
        """Test that Slack tokens are not detected as encrypted."""
        slack_tokens = [
            "xoxb-1234567890-1234567890123-abcdefghijklmnopqrstuvwx",
            "xoxp-1234567890-1234567890123-1234567890123-abcdefghij",
        ]

        for token in slack_tokens:
            assert not CryptoUtils.is_encrypted(token), f"Slack token incorrectly detected as encrypted: {token}"

    def test_bearer_tokens_not_detected(self):
        """Test that Bearer tokens are not detected as encrypted."""
        bearer_tokens = [
            "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
            "Bearer some-long-token-string-1234567890abcdefghijklmnop",
        ]

        for token in bearer_tokens:
            assert not CryptoUtils.is_encrypted(token), f"Bearer token incorrectly detected as encrypted: {token}"

    def test_generic_prefixes_not_detected(self):
        """Test that strings with generic API key prefixes are not detected as encrypted."""
        generic_keys = [
            "pk-1234567890abcdefghijklmnopqrstuvwxyz",
            "api-1234567890abcdefghijklmnopqrstuvwxyz",
            "key-1234567890abcdefghijklmnopqrstuvwxyz",
            "token-1234567890abcdefghijklmnopqrstuvwxyz",
        ]

        for key in generic_keys:
            assert not CryptoUtils.is_encrypted(key), f"Generic key incorrectly detected as encrypted: {key}"

    def test_short_strings_not_detected(self):
        """Test that short strings are not detected as encrypted."""
        short_strings = ["short", "abc", "1234567890", ""]

        for s in short_strings:
            assert not CryptoUtils.is_encrypted(s), f"Short string incorrectly detected as encrypted: {s}"

    def test_invalid_base64_not_detected(self):
        """Test that invalid base64 strings are not detected as encrypted."""
        invalid_strings = [
            "not-valid-base64!@#$",
            "spaces are invalid",
            "special!chars@here",
        ]

        for s in invalid_strings:
            assert not CryptoUtils.is_encrypted(s), f"Invalid base64 incorrectly detected as encrypted: {s}"

    def test_valid_base64_but_too_short_not_detected(self):
        """Test that valid base64 strings that are too short are not detected."""
        # base64 encode something short (less than SALT + IV + TAG + 1 = 45 bytes)
        short_data = base64.b64encode(b"x" * 40).decode()
        assert not CryptoUtils.is_encrypted(short_data)
