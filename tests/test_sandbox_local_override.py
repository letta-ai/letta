"""Test the metadata_["sandbox"] = "local" override feature."""

import pytest
from unittest.mock import MagicMock, AsyncMock, patch
import sys

from letta.schemas.enums import SandboxType
from letta.schemas.tool import Tool
from letta.schemas.tool_execution_result import ToolExecutionResult


class TestSandboxLocalOverride:
    """Test that tools can opt-out of E2B by setting metadata_["sandbox"] = "local"."""

    @pytest.fixture
    def mock_tool_without_metadata(self):
        """Tool without sandbox metadata - should follow default behavior."""
        tool = MagicMock(spec=Tool)
        tool.id = "tool-12345678"
        tool.name = "test_tool"
        tool.metadata_ = {}
        tool.source_code = "def test_tool(x: int) -> int: return x"
        tool.source_type = "python"
        tool.json_schema = {"parameters": {"properties": {"x": {"type": "integer"}}}}
        tool.args_json_schema = None
        return tool

    @pytest.fixture
    def mock_tool_with_local_override(self):
        """Tool with sandbox=local metadata - should force local execution."""
        tool = MagicMock(spec=Tool)
        tool.id = "tool-87654321"
        tool.name = "local_tool"
        tool.metadata_ = {"sandbox": "local"}
        tool.source_code = "def local_tool(x: int) -> int: return x"
        tool.source_type = "python"
        tool.json_schema = {"parameters": {"properties": {"x": {"type": "integer"}}}}
        tool.args_json_schema = None
        return tool

    @pytest.fixture
    def mock_user(self):
        user = MagicMock()
        user.id = "user-123"
        user.organization_id = "org-123"
        return user

    @pytest.fixture
    def mock_executor(self):
        """Create a SandboxToolExecutor with mocked dependencies."""
        from letta.services.tool_executor.sandbox_tool_executor import SandboxToolExecutor

        executor = SandboxToolExecutor(
            message_manager=MagicMock(),
            agent_manager=MagicMock(),
            block_manager=MagicMock(),
            run_manager=MagicMock(),
            passage_manager=MagicMock(),
            actor=MagicMock(),
        )
        return executor

    @pytest.mark.asyncio
    async def test_tool_without_metadata_uses_e2b_when_configured(
        self, mock_tool_without_metadata, mock_user, mock_executor
    ):
        """When E2B is configured and tool has no override, E2B should be used."""
        mock_e2b_class = MagicMock()
        mock_e2b_instance = AsyncMock()
        mock_e2b_instance.run.return_value = ToolExecutionResult(
            status="success", func_return=42, agent_state=None, stdout=[], stderr=[]
        )
        mock_e2b_class.return_value = mock_e2b_instance

        mock_local_class = MagicMock()

        # Create a mock module for e2b_sandbox
        mock_e2b_module = MagicMock()
        mock_e2b_module.AsyncToolSandboxE2B = mock_e2b_class

        with (
            patch("letta.services.tool_executor.sandbox_tool_executor.tool_settings") as mock_settings,
            patch("letta.services.tool_executor.sandbox_tool_executor.AsyncToolSandboxLocal", mock_local_class),
            patch.dict(sys.modules, {"letta.services.tool_sandbox.e2b_sandbox": mock_e2b_module}),
            patch("letta.services.tool_executor.sandbox_tool_executor.SandboxCredentialsService") as mock_creds,
        ):
            mock_settings.sandbox_type = SandboxType.E2B
            mock_settings.modal_sandbox_enabled = False
            mock_creds.return_value.fetch_credentials = AsyncMock(return_value={})

            await mock_executor.execute(
                function_name="test_tool",
                function_args={"x": 1},
                tool=mock_tool_without_metadata,
                actor=mock_user,
            )

            # E2B should be used
            mock_e2b_class.assert_called_once()
            mock_local_class.assert_not_called()

    @pytest.mark.asyncio
    async def test_tool_with_local_override_uses_local_even_with_e2b_configured(
        self, mock_tool_with_local_override, mock_user, mock_executor
    ):
        """When tool has metadata_["sandbox"] = "local", local sandbox should be used."""
        mock_local_class = MagicMock()
        mock_local_instance = AsyncMock()
        mock_local_instance.run.return_value = ToolExecutionResult(
            status="success", func_return=42, agent_state=None, stdout=[], stderr=[]
        )
        mock_local_class.return_value = mock_local_instance

        with (
            patch("letta.services.tool_executor.sandbox_tool_executor.tool_settings") as mock_settings,
            patch("letta.services.tool_executor.sandbox_tool_executor.AsyncToolSandboxLocal", mock_local_class),
            patch("letta.services.tool_executor.sandbox_tool_executor.SandboxCredentialsService") as mock_creds,
        ):
            mock_settings.sandbox_type = SandboxType.E2B
            mock_settings.modal_sandbox_enabled = False
            mock_creds.return_value.fetch_credentials = AsyncMock(return_value={})

            await mock_executor.execute(
                function_name="local_tool",
                function_args={"x": 1},
                tool=mock_tool_with_local_override,
                actor=mock_user,
            )

            # Local should be used despite E2B being configured
            mock_local_class.assert_called_once()

    @pytest.mark.asyncio
    async def test_tool_without_metadata_uses_local_when_e2b_not_configured(
        self, mock_tool_without_metadata, mock_user, mock_executor
    ):
        """When E2B is not configured, local sandbox should be used."""
        mock_local_class = MagicMock()
        mock_local_instance = AsyncMock()
        mock_local_instance.run.return_value = ToolExecutionResult(
            status="success", func_return=42, agent_state=None, stdout=[], stderr=[]
        )
        mock_local_class.return_value = mock_local_instance

        with (
            patch("letta.services.tool_executor.sandbox_tool_executor.tool_settings") as mock_settings,
            patch("letta.services.tool_executor.sandbox_tool_executor.AsyncToolSandboxLocal", mock_local_class),
            patch("letta.services.tool_executor.sandbox_tool_executor.SandboxCredentialsService") as mock_creds,
        ):
            mock_settings.sandbox_type = SandboxType.LOCAL
            mock_settings.modal_sandbox_enabled = False
            mock_creds.return_value.fetch_credentials = AsyncMock(return_value={})

            await mock_executor.execute(
                function_name="test_tool",
                function_args={"x": 1},
                tool=mock_tool_without_metadata,
                actor=mock_user,
            )

            # Local should be used
            mock_local_class.assert_called_once()
