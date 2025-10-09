"""
Integration tests for MCP server and OAuth session encryption.
Tests the end-to-end encryption functionality in the MCP manager.
"""

import json
import os
from datetime import datetime, timezone
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest
from sqlalchemy import select

from letta.config import LettaConfig
from letta.helpers.crypto_utils import CryptoUtils
from letta.orm import MCPOAuth, MCPServer as ORMMCPServer
from letta.schemas.mcp import (
    MCPOAuthSessionCreate,
    MCPOAuthSessionUpdate,
    MCPServer as PydanticMCPServer,
    MCPServerType,
    SSEServerConfig,
    StdioServerConfig,
)
from letta.schemas.secret import Secret
from letta.server.db import db_registry
from letta.server.server import SyncServer
from letta.services.mcp_manager import MCPManager
from letta.settings import settings


@pytest.fixture(scope="module")
def server():
    """Fixture to create and return a SyncServer instance with MCP manager."""
    config = LettaConfig.load()
    config.save()
    server = SyncServer(init_with_default_org_and_user=False)
    return server


class TestMCPServerEncryption:
    """Test MCP server encryption functionality."""

    MOCK_ENCRYPTION_KEY = "test-mcp-encryption-key-123456"

    @pytest.mark.asyncio
    @patch("letta.services.mcp_manager.MCPManager.get_mcp_client")
    async def test_create_mcp_server_with_token_encryption(self, mock_get_client, server, default_user):
        """Test that MCP server tokens are encrypted when stored."""
        # Set encryption key directly on settings
        original_key = settings.encryption_key
        settings.encryption_key = self.MOCK_ENCRYPTION_KEY

        try:
            # Mock the MCP client
            mock_client = AsyncMock()
            mock_client.list_tools.return_value = []
            mock_get_client.return_value = mock_client

            # Create MCP server with token
            server_name = f"test_encrypted_server_{uuid4().hex[:8]}"
            token = "super-secret-api-token-12345"
            server_url = "https://api.example.com/mcp"

            mcp_server = PydanticMCPServer(server_name=server_name, server_type=MCPServerType.SSE, server_url=server_url, token=token)

            created_server = await server.mcp_manager.create_or_update_mcp_server(mcp_server, actor=default_user)

            # Verify server was created
            assert created_server.server_name == server_name
            assert created_server.server_type == MCPServerType.SSE

            # Check database directly to verify encryption
            async with db_registry.async_session() as session:
                result = await session.execute(select(ORMMCPServer).where(ORMMCPServer.id == created_server.id))
                db_server = result.scalar_one()

                # Token should be encrypted in database
                assert db_server.token_enc is not None
                assert db_server.token_enc != token  # Should not be plaintext

                # Decrypt to verify correctness
                decrypted_token = CryptoUtils.decrypt(db_server.token_enc)
                assert decrypted_token == token

                # Legacy plaintext column should be None (or empty for dual-write)
                # During migration phase, might store both
                if db_server.token:
                    assert db_server.token == token  # Dual-write phase

            # Clean up
            await server.mcp_manager.delete_mcp_server_by_id(created_server.id, actor=default_user)

        finally:
            # Restore original encryption key
            settings.encryption_key = original_key

    @pytest.mark.asyncio
    @patch("letta.services.mcp_manager.MCPManager.get_mcp_client")
    async def test_create_mcp_server_with_custom_headers_encryption(self, mock_get_client, server, default_user):
        """Test that MCP server custom headers are encrypted when stored."""
        # Set encryption key directly on settings
        original_key = settings.encryption_key
        settings.encryption_key = self.MOCK_ENCRYPTION_KEY

        try:
            # Mock the MCP client
            mock_client = AsyncMock()
            mock_client.list_tools.return_value = []
            mock_get_client.return_value = mock_client

            server_name = f"test_headers_server_{uuid4().hex[:8]}"
            custom_headers = {"Authorization": "Bearer secret-token-xyz", "X-API-Key": "api-key-123456", "X-Custom-Header": "custom-value"}
            server_url = "https://api.example.com/mcp"

            mcp_server = PydanticMCPServer(
                server_name=server_name, server_type=MCPServerType.STREAMABLE_HTTP, server_url=server_url, custom_headers=custom_headers
            )

            created_server = await server.mcp_manager.create_or_update_mcp_server(mcp_server, actor=default_user)

            # Check database directly
            async with db_registry.async_session() as session:
                result = await session.execute(select(ORMMCPServer).where(ORMMCPServer.id == created_server.id))
                db_server = result.scalar_one()

                # Custom headers should be encrypted as JSON
                assert db_server.custom_headers_enc is not None

                # Decrypt and parse JSON
                decrypted_json = CryptoUtils.decrypt(db_server.custom_headers_enc)
                decrypted_headers = json.loads(decrypted_json)
                assert decrypted_headers == custom_headers

            # Clean up
            await server.mcp_manager.delete_mcp_server_by_id(created_server.id, actor=default_user)

        finally:
            # Restore original encryption key
            settings.encryption_key = original_key

    @pytest.mark.asyncio
    async def test_retrieve_mcp_server_decrypts_values(self, server, default_user):
        """Test that retrieving MCP server decrypts encrypted values."""
        # Set encryption key directly on settings
        original_key = settings.encryption_key
        settings.encryption_key = self.MOCK_ENCRYPTION_KEY

        try:
            # Manually insert encrypted server into database
            server_id = f"mcp_server-{uuid4().hex[:8]}"
            server_name = f"test_decrypt_server_{uuid4().hex[:8]}"
            plaintext_token = "decryption-test-token"
            encrypted_token = CryptoUtils.encrypt(plaintext_token)

            async with db_registry.async_session() as session:
                db_server = ORMMCPServer(
                    id=server_id,
                    server_name=server_name,
                    server_type=MCPServerType.SSE.value,
                    server_url="https://test.com",
                    token_enc=encrypted_token,
                    token=None,  # No plaintext
                    created_by_id=default_user.id,
                    last_updated_by_id=default_user.id,
                    organization_id=default_user.organization_id,
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                )
                session.add(db_server)
                await session.commit()

            # Retrieve server directly by ID to avoid issues with other servers in DB
            test_server = await server.mcp_manager.get_mcp_server_by_id_async(server_id, actor=default_user)

            assert test_server is not None
            assert test_server.server_name == server_name
            # Token should be decrypted when accessed via the secret method
            token_secret = test_server.get_token_secret()
            assert token_secret.get_plaintext() == plaintext_token

            # Clean up
            async with db_registry.async_session() as session:
                result = await session.execute(select(ORMMCPServer).where(ORMMCPServer.id == server_id))
                db_server = result.scalar_one()
                await session.delete(db_server)
                await session.commit()

        finally:
            # Restore original encryption key
            settings.encryption_key = original_key

    @pytest.mark.asyncio
    @patch.dict(os.environ, {}, clear=True)  # No encryption key
    @patch("letta.services.mcp_manager.MCPManager.get_mcp_client")
    async def test_create_mcp_server_without_encryption_key(self, mock_get_client, server, default_user):
        """Test that MCP servers work without encryption key (backward compatibility)."""
        # Remove encryption key
        os.environ.pop("LETTA_ENCRYPTION_KEY", None)

        # Mock the MCP client
        mock_client = AsyncMock()
        mock_client.list_tools.return_value = []
        mock_get_client.return_value = mock_client

        server_name = f"test_no_encrypt_server_{uuid4().hex[:8]}"
        token = "plaintext-token-no-encryption"

        mcp_server = PydanticMCPServer(
            server_name=server_name, server_type=MCPServerType.SSE, server_url="https://api.example.com", token=token
        )

        created_server = await server.mcp_manager.create_or_update_mcp_server(mcp_server, actor=default_user)

        # Check database - should store as plaintext
        async with db_registry.async_session() as session:
            result = await session.execute(select(ORMMCPServer).where(ORMMCPServer.id == created_server.id))
            db_server = result.scalar_one()

            # Should store in plaintext column
            assert db_server.token == token
            assert db_server.token_enc is None  # No encryption

        # Clean up
        await server.mcp_manager.delete_mcp_server_by_id(created_server.id, actor=default_user)


class TestMCPOAuthEncryption:
    """Test MCP OAuth session encryption functionality."""

    MOCK_ENCRYPTION_KEY = "test-oauth-encryption-key-123456"

    @pytest.mark.asyncio
    async def test_create_oauth_session_with_encryption(self, server, default_user):
        """Test that OAuth tokens are encrypted when stored."""
        # Set encryption key directly on settings
        original_key = settings.encryption_key
        settings.encryption_key = self.MOCK_ENCRYPTION_KEY

        try:
            server_url = "https://github.com/mcp"
            server_name = "GitHub MCP"

            # Step 1: Create OAuth session (without tokens initially)
            oauth_session_create = MCPOAuthSessionCreate(
                server_url=server_url,
                server_name=server_name,
                organization_id=default_user.organization_id,
                user_id=default_user.id,
            )

            created_session = await server.mcp_manager.create_oauth_session(oauth_session_create, actor=default_user)

            assert created_session.server_url == server_url
            assert created_session.server_name == server_name

            # Step 2: Update session with tokens (simulating OAuth callback)
            update_data = MCPOAuthSessionUpdate(
                access_token="github-access-token-abc123",
                refresh_token="github-refresh-token-xyz789",
                client_id="client-id-123",
                client_secret="client-secret-super-secret",
                expires_at=datetime.now(timezone.utc),
            )

            await server.mcp_manager.update_oauth_session(created_session.id, update_data, actor=default_user)

            # Check database directly for encryption
            async with db_registry.async_session() as session:
                result = await session.execute(select(MCPOAuth).where(MCPOAuth.id == created_session.id))
                db_oauth = result.scalar_one()

                # All sensitive fields should be encrypted
                assert db_oauth.access_token_enc is not None
                assert db_oauth.access_token_enc != update_data.access_token

                assert db_oauth.refresh_token_enc is not None

                assert db_oauth.client_secret_enc is not None

                # Verify decryption
                decrypted_access = CryptoUtils.decrypt(db_oauth.access_token_enc)
                assert decrypted_access == update_data.access_token

                decrypted_refresh = CryptoUtils.decrypt(db_oauth.refresh_token_enc)
                assert decrypted_refresh == update_data.refresh_token

                decrypted_secret = CryptoUtils.decrypt(db_oauth.client_secret_enc)
                assert decrypted_secret == update_data.client_secret

        finally:
            # Restore original encryption key
            settings.encryption_key = original_key

        # Clean up not needed - test database is reset

    @pytest.mark.asyncio
    async def test_retrieve_oauth_session_decrypts_tokens(self, server, default_user):
        """Test that retrieving OAuth session decrypts tokens."""
        # Set encryption key directly on settings
        original_key = settings.encryption_key
        settings.encryption_key = self.MOCK_ENCRYPTION_KEY

        try:
            # Manually insert encrypted OAuth session
            session_id = f"mcp-oauth-{str(uuid4())[:8]}"
            access_token = "test-access-token"
            refresh_token = "test-refresh-token"
            client_secret = "test-client-secret"

            encrypted_access = CryptoUtils.encrypt(access_token)
            encrypted_refresh = CryptoUtils.encrypt(refresh_token)
            encrypted_secret = CryptoUtils.encrypt(client_secret)

            async with db_registry.async_session() as session:
                db_oauth = MCPOAuth(
                    id=session_id,
                    state=f"test-state-{uuid4().hex[:8]}",
                    server_url="https://test.com/mcp",
                    server_name="Test Provider",
                    access_token_enc=encrypted_access,
                    refresh_token_enc=encrypted_refresh,
                    client_id="test-client",
                    client_secret_enc=encrypted_secret,
                    user_id=default_user.id,
                    organization_id=default_user.organization_id,
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                )
                session.add(db_oauth)
                await session.commit()

            # Retrieve through manager by ID
            test_session = await server.mcp_manager.get_oauth_session_by_id(session_id, actor=default_user)
            assert test_session is not None

            # Tokens should be decrypted
            assert test_session.access_token == access_token
            assert test_session.refresh_token == refresh_token
            assert test_session.client_secret == client_secret

            # Clean up not needed - test database is reset

        finally:
            # Restore original encryption key
            settings.encryption_key = original_key

    @pytest.mark.asyncio
    async def test_update_oauth_session_maintains_encryption(self, server, default_user):
        """Test that updating OAuth session maintains encryption."""
        # Set encryption key directly on settings
        original_key = settings.encryption_key
        settings.encryption_key = self.MOCK_ENCRYPTION_KEY

        try:
            # Create initial session (without tokens)
            oauth_session_create = MCPOAuthSessionCreate(
                server_url="https://test.com/mcp",
                server_name="Test Update Provider",
                organization_id=default_user.organization_id,
                user_id=default_user.id,
            )

            created_session = await server.mcp_manager.create_oauth_session(oauth_session_create, actor=default_user)

            # Add initial tokens
            initial_update = MCPOAuthSessionUpdate(
                access_token="initial-token",
                refresh_token="initial-refresh",
                client_id="client-123",
                client_secret="initial-secret",
            )

            await server.mcp_manager.update_oauth_session(created_session.id, initial_update, actor=default_user)

            # Update with new tokens
            new_access_token = "updated-access-token"
            new_refresh_token = "updated-refresh-token"

            new_update = MCPOAuthSessionUpdate(
                access_token=new_access_token,
                refresh_token=new_refresh_token,
            )

            updated_session = await server.mcp_manager.update_oauth_session(created_session.id, new_update, actor=default_user)

            # Verify update worked
            assert updated_session.access_token == new_access_token
            assert updated_session.refresh_token == new_refresh_token

            # Check database encryption
            async with db_registry.async_session() as session:
                result = await session.execute(select(MCPOAuth).where(MCPOAuth.id == created_session.id))
                db_oauth = result.scalar_one()

                # New tokens should be encrypted
                decrypted_access = CryptoUtils.decrypt(db_oauth.access_token_enc)
                assert decrypted_access == new_access_token

                decrypted_refresh = CryptoUtils.decrypt(db_oauth.refresh_token_enc)
                assert decrypted_refresh == new_refresh_token

            # Clean up not needed - test database is reset

        finally:
            # Restore original encryption key
            settings.encryption_key = original_key

    @pytest.mark.asyncio
    async def test_dual_read_backward_compatibility(self, server, default_user):
        """Test that system can read both encrypted and plaintext values (migration support)."""
        # Set encryption key directly on settings
        original_key = settings.encryption_key
        settings.encryption_key = self.MOCK_ENCRYPTION_KEY

        try:
            # Insert a record with both encrypted and plaintext values
            session_id = f"mcp-oauth-{str(uuid4())[:8]}"
            plaintext_token = "legacy-plaintext-token"
            new_encrypted_token = "new-encrypted-token"
            encrypted_new = CryptoUtils.encrypt(new_encrypted_token)

            async with db_registry.async_session() as session:
                db_oauth = MCPOAuth(
                    id=session_id,
                    state=f"dual-read-state-{uuid4().hex[:8]}",
                    server_url="https://test.com/mcp",
                    server_name="Dual Read Test",
                    # Both encrypted and plaintext values
                    access_token=plaintext_token,  # Legacy plaintext
                    access_token_enc=encrypted_new,  # New encrypted
                    client_id="test-client",
                    user_id=default_user.id,
                    organization_id=default_user.organization_id,
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                )
                session.add(db_oauth)
                await session.commit()

            # Retrieve through manager
            test_session = await server.mcp_manager.get_oauth_session_by_id(session_id, actor=default_user)
            assert test_session is not None

            # Should prefer encrypted value over plaintext
            assert test_session.access_token == new_encrypted_token

            # Clean up not needed - test database is reset

        finally:
            # Restore original encryption key
            settings.encryption_key = original_key
