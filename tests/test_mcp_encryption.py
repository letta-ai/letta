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
    MCPServer as PydanticMCPServer,
    MCPServerType,
    SSEServerConfig,
    StdioServerConfig,
)
from letta.schemas.secret import Secret, SecretDict
from letta.server.server import SyncServer
from letta.services.mcp_manager import MCPManager


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
    @patch.dict(os.environ, {"LETTA_ENCRYPTION_KEY": MOCK_ENCRYPTION_KEY})
    @patch("letta.services.mcp_manager.MCPManager.get_mcp_client")
    async def test_create_mcp_server_with_token_encryption(self, mock_get_client, server, default_user):
        """Test that MCP server tokens are encrypted when stored."""
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
        async with server.mcp_manager.session_maker() as session:
            result = await session.execute(select(ORMMCPServer).where(ORMMCPServer.id == created_server.id))
            db_server = result.scalar_one()

            # Token should be encrypted in database
            assert db_server.token_enc is not None
            assert db_server.token_enc.startswith("enc:")
            assert db_server.token_enc != token  # Should not be plaintext

            # Decrypt to verify correctness
            decrypted_token = CryptoUtils.decrypt(db_server.token_enc, self.MOCK_ENCRYPTION_KEY)
            assert decrypted_token == token

            # Legacy plaintext column should be None (or empty for dual-write)
            # During migration phase, might store both
            if db_server.token:
                assert db_server.token == token  # Dual-write phase

        # Clean up
        await server.mcp_manager.delete_mcp_server_by_id(created_server.id, actor=default_user)

    @pytest.mark.asyncio
    @patch.dict(os.environ, {"LETTA_ENCRYPTION_KEY": MOCK_ENCRYPTION_KEY})
    @patch("letta.services.mcp_manager.MCPManager.get_mcp_client")
    async def test_create_mcp_server_with_custom_headers_encryption(self, mock_get_client, server, default_user):
        """Test that MCP server custom headers are encrypted when stored."""
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
        async with server.mcp_manager.session_maker() as session:
            result = await session.execute(select(ORMMCPServer).where(ORMMCPServer.id == created_server.id))
            db_server = result.scalar_one()

            # Custom headers should be encrypted as JSON
            assert db_server.custom_headers_enc is not None
            assert db_server.custom_headers_enc.startswith("enc:")

            # Decrypt and parse JSON
            decrypted_json = CryptoUtils.decrypt(db_server.custom_headers_enc, self.MOCK_ENCRYPTION_KEY)
            decrypted_headers = json.loads(decrypted_json)
            assert decrypted_headers == custom_headers

        # Clean up
        await server.mcp_manager.delete_mcp_server_by_id(created_server.id, actor=default_user)

    @pytest.mark.asyncio
    @patch.dict(os.environ, {"LETTA_ENCRYPTION_KEY": MOCK_ENCRYPTION_KEY})
    async def test_retrieve_mcp_server_decrypts_values(self, server, default_user):
        """Test that retrieving MCP server decrypts encrypted values."""
        # Manually insert encrypted server into database
        server_id = str(uuid4())
        server_name = f"test_decrypt_server_{uuid4().hex[:8]}"
        plaintext_token = "decryption-test-token"
        encrypted_token = CryptoUtils.encrypt(plaintext_token, self.MOCK_ENCRYPTION_KEY)

        async with server.mcp_manager.session_maker() as session:
            db_server = ORMMCPServer(
                id=server_id,
                server_name=server_name,
                server_type=MCPServerType.SSE.value,
                server_url="https://test.com",
                token_enc=encrypted_token,
                token=None,  # No plaintext
                user_id=default_user.id,
                organization_id=default_user.organization_id,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            session.add(db_server)
            await session.commit()

        # Retrieve server through manager
        servers = await server.mcp_manager.list_mcp_servers(actor=default_user)
        test_server = next((s for s in servers if s.id == server_id), None)

        assert test_server is not None
        assert test_server.server_name == server_name
        # Token should be decrypted when retrieved
        assert test_server.token == plaintext_token

        # Clean up
        async with server.mcp_manager.session_maker() as session:
            result = await session.execute(select(ORMMCPServer).where(ORMMCPServer.id == server_id))
            db_server = result.scalar_one()
            await session.delete(db_server)
            await session.commit()

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
        async with server.mcp_manager.session_maker() as session:
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
    @patch.dict(os.environ, {"LETTA_ENCRYPTION_KEY": MOCK_ENCRYPTION_KEY})
    async def test_create_oauth_session_with_encryption(self, server, default_user):
        """Test that OAuth tokens are encrypted when stored."""
        provider = "github"
        provider_url = "https://github.com"

        oauth_session = MCPOAuthSessionCreate(
            provider=provider,
            provider_url=provider_url,
            access_token="github-access-token-abc123",
            refresh_token="github-refresh-token-xyz789",
            client_id="client-id-123",
            client_secret="client-secret-super-secret",
            expires_at=datetime.now(timezone.utc),
        )

        created_session = await server.mcp_manager.create_oauth_session(oauth_session, actor=default_user)

        assert created_session.provider == provider
        assert created_session.provider_url == provider_url

        # Check database directly for encryption
        async with server.mcp_manager.session_maker() as session:
            result = await session.execute(select(MCPOAuth).where(MCPOAuth.id == created_session.id))
            db_oauth = result.scalar_one()

            # All sensitive fields should be encrypted
            assert db_oauth.access_token_enc is not None
            assert db_oauth.access_token_enc.startswith("enc:")
            assert db_oauth.access_token_enc != oauth_session.access_token

            assert db_oauth.refresh_token_enc is not None
            assert db_oauth.refresh_token_enc.startswith("enc:")

            assert db_oauth.client_secret_enc is not None
            assert db_oauth.client_secret_enc.startswith("enc:")

            # Verify decryption
            decrypted_access = CryptoUtils.decrypt(db_oauth.access_token_enc, self.MOCK_ENCRYPTION_KEY)
            assert decrypted_access == oauth_session.access_token

            decrypted_refresh = CryptoUtils.decrypt(db_oauth.refresh_token_enc, self.MOCK_ENCRYPTION_KEY)
            assert decrypted_refresh == oauth_session.refresh_token

            decrypted_secret = CryptoUtils.decrypt(db_oauth.client_secret_enc, self.MOCK_ENCRYPTION_KEY)
            assert decrypted_secret == oauth_session.client_secret

        # Clean up
        await server.mcp_manager.delete_oauth_session_by_id(created_session.id, actor=default_user)

    @pytest.mark.asyncio
    @patch.dict(os.environ, {"LETTA_ENCRYPTION_KEY": MOCK_ENCRYPTION_KEY})
    async def test_retrieve_oauth_session_decrypts_tokens(self, server, default_user):
        """Test that retrieving OAuth session decrypts tokens."""
        # Manually insert encrypted OAuth session
        session_id = str(uuid4())
        access_token = "test-access-token"
        refresh_token = "test-refresh-token"
        client_secret = "test-client-secret"

        encrypted_access = CryptoUtils.encrypt(access_token, self.MOCK_ENCRYPTION_KEY)
        encrypted_refresh = CryptoUtils.encrypt(refresh_token, self.MOCK_ENCRYPTION_KEY)
        encrypted_secret = CryptoUtils.encrypt(client_secret, self.MOCK_ENCRYPTION_KEY)

        async with server.mcp_manager.session_maker() as session:
            db_oauth = MCPOAuth(
                id=session_id,
                provider="test_provider",
                provider_url="https://test.com",
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

        # Retrieve through manager
        sessions = await server.mcp_manager.list_oauth_sessions_by_provider("test_provider", actor=default_user)

        test_session = next((s for s in sessions if s.id == session_id), None)
        assert test_session is not None

        # Tokens should be decrypted
        assert test_session.access_token == access_token
        assert test_session.refresh_token == refresh_token
        assert test_session.client_secret == client_secret

        # Clean up
        await server.mcp_manager.delete_oauth_session_by_id(session_id, actor=default_user)

    @pytest.mark.asyncio
    @patch.dict(os.environ, {"LETTA_ENCRYPTION_KEY": MOCK_ENCRYPTION_KEY})
    async def test_update_oauth_session_maintains_encryption(self, server, default_user):
        """Test that updating OAuth session maintains encryption."""
        # Create initial session
        oauth_session = MCPOAuthSessionCreate(
            provider="test_update",
            provider_url="https://test.com",
            access_token="initial-token",
            refresh_token="initial-refresh",
            client_id="client-123",
            client_secret="initial-secret",
        )

        created_session = await server.mcp_manager.create_oauth_session(oauth_session, actor=default_user)

        # Update with new tokens
        new_access_token = "updated-access-token"
        new_refresh_token = "updated-refresh-token"

        updated_session = await server.mcp_manager.update_oauth_session(
            created_session.id, access_token=new_access_token, refresh_token=new_refresh_token, actor=default_user
        )

        # Verify update worked
        assert updated_session.access_token == new_access_token
        assert updated_session.refresh_token == new_refresh_token

        # Check database encryption
        async with server.mcp_manager.session_maker() as session:
            result = await session.execute(select(MCPOAuth).where(MCPOAuth.id == created_session.id))
            db_oauth = result.scalar_one()

            # New tokens should be encrypted
            assert db_oauth.access_token_enc.startswith("enc:")
            decrypted_access = CryptoUtils.decrypt(db_oauth.access_token_enc, self.MOCK_ENCRYPTION_KEY)
            assert decrypted_access == new_access_token

            assert db_oauth.refresh_token_enc.startswith("enc:")
            decrypted_refresh = CryptoUtils.decrypt(db_oauth.refresh_token_enc, self.MOCK_ENCRYPTION_KEY)
            assert decrypted_refresh == new_refresh_token

        # Clean up
        await server.mcp_manager.delete_oauth_session_by_id(created_session.id, actor=default_user)

    @pytest.mark.asyncio
    @patch.dict(os.environ, {"LETTA_ENCRYPTION_KEY": MOCK_ENCRYPTION_KEY})
    async def test_dual_read_backward_compatibility(self, server, default_user):
        """Test that system can read both encrypted and plaintext values (migration support)."""
        # Insert a record with both encrypted and plaintext values
        session_id = str(uuid4())
        plaintext_token = "legacy-plaintext-token"
        new_encrypted_token = "new-encrypted-token"
        encrypted_new = CryptoUtils.encrypt(new_encrypted_token, self.MOCK_ENCRYPTION_KEY)

        async with server.mcp_manager.session_maker() as session:
            db_oauth = MCPOAuth(
                id=session_id,
                provider="dual_read_test",
                provider_url="https://test.com",
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
        sessions = await server.mcp_manager.list_oauth_sessions_by_provider("dual_read_test", actor=default_user)

        test_session = next((s for s in sessions if s.id == session_id), None)
        assert test_session is not None

        # Should prefer encrypted value over plaintext
        assert test_session.access_token == new_encrypted_token

        # Clean up
        await server.mcp_manager.delete_oauth_session_by_id(session_id, actor=default_user)
