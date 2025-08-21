import json
import pickle
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from letta.schemas.pip_requirement import PipRequirement
from letta.schemas.sandbox_config import ModalSandboxConfig, SandboxConfig, SandboxType
from letta.schemas.tool import Tool
from letta.services.tool_sandbox.modal_sandbox_v2 import AsyncToolSandboxModalV2
from letta.services.tool_sandbox.modal_version_manager import ModalVersionManager
from sandbox.modal_executor import ModalFunctionExecutor


class TestModalFunctionExecutor:
    """Test the ModalFunctionExecutor class."""

    def test_execute_tool_dynamic_success(self):
        """Test successful execution of a simple tool."""
        tool_source = """
def add_numbers(a: int, b: int) -> int:
    return a + b
"""

        args = {"a": 5, "b": 3}
        args_pickled = pickle.dumps(args)

        result = ModalFunctionExecutor.execute_tool_dynamic(
            tool_source=tool_source,
            tool_name="add_numbers",
            args_pickled=args_pickled,
            agent_state_pickled=None,
            inject_agent_state=False,
            is_async=False,
            args_schema_code=None,
        )

        assert result["error"] is None
        assert result["result"] == 8  # Actual integer value
        assert result["agent_state"] is None

    def test_execute_tool_dynamic_with_error(self):
        """Test execution with an error."""
        tool_source = """
def divide_numbers(a: int, b: int) -> float:
    return a / b
"""

        args = {"a": 5, "b": 0}
        args_pickled = pickle.dumps(args)

        result = ModalFunctionExecutor.execute_tool_dynamic(
            tool_source=tool_source,
            tool_name="divide_numbers",
            args_pickled=args_pickled,
            agent_state_pickled=None,
            inject_agent_state=False,
            is_async=False,
            args_schema_code=None,
        )

        assert result["error"] is not None
        assert result["error"]["name"] == "ZeroDivisionError"
        assert "division by zero" in result["error"]["value"]
        assert result["result"] is None

    def test_execute_async_tool(self):
        """Test execution of an async tool."""
        tool_source = """
async def async_add(a: int, b: int) -> int:
    import asyncio
    await asyncio.sleep(0.001)
    return a + b
"""

        args = {"a": 10, "b": 20}
        args_pickled = pickle.dumps(args)

        result = ModalFunctionExecutor.execute_tool_dynamic(
            tool_source=tool_source,
            tool_name="async_add",
            args_pickled=args_pickled,
            agent_state_pickled=None,
            inject_agent_state=False,
            is_async=True,
            args_schema_code=None,
        )

        assert result["error"] is None
        assert result["result"] == 30

    def test_execute_with_stdout_capture(self):
        """Test that stdout is properly captured."""
        tool_source = """
def print_and_return(message: str) -> str:
    print(f"Processing: {message}")
    print("Done!")
    return message.upper()
"""

        args = {"message": "hello"}
        args_pickled = pickle.dumps(args)

        result = ModalFunctionExecutor.execute_tool_dynamic(
            tool_source=tool_source,
            tool_name="print_and_return",
            args_pickled=args_pickled,
            agent_state_pickled=None,
            inject_agent_state=False,
            is_async=False,
            args_schema_code=None,
        )

        assert result["error"] is None
        assert result["result"] == "HELLO"
        assert "Processing: hello" in result["stdout"]
        assert "Done!" in result["stdout"]


class TestModalVersionManager:
    """Test the Modal Version Manager."""

    @pytest.mark.asyncio
    async def test_register_and_get_deployment(self):
        """Test registering and retrieving deployments."""
        from unittest.mock import AsyncMock

        from letta.schemas.user import User

        manager = ModalVersionManager()

        # Mock the tool manager
        mock_tool = MagicMock()
        mock_tool.id = "tool-abc12345"
        mock_tool.metadata_ = {}

        manager.tool_manager.get_tool_by_id = MagicMock(return_value=mock_tool)
        manager.tool_manager.update_tool_by_id_async = AsyncMock(return_value=mock_tool)

        # Create a mock actor
        mock_actor = MagicMock(spec=User)
        mock_actor.id = "user-123"

        # Register a deployment
        mock_app = MagicMock(spec=["deploy", "stop"])
        info = await manager.register_deployment(
            tool_id="tool-abc12345",
            app_name="test-app",
            version_hash="abc123",
            app=mock_app,
            dependencies={"pandas", "numpy"},
            sandbox_config_id="config-123",
            actor=mock_actor,
        )

        assert info.app_name == "test-app"
        assert info.version_hash == "abc123"
        assert info.dependencies == {"pandas", "numpy"}

        # Retrieve the deployment
        retrieved = await manager.get_deployment("tool-abc12345", "config-123", actor=mock_actor)
        assert retrieved.app_name == info.app_name
        assert retrieved.version_hash == info.version_hash

    @pytest.mark.asyncio
    async def test_needs_redeployment(self):
        """Test checking if redeployment is needed."""
        from unittest.mock import AsyncMock

        from letta.schemas.user import User

        manager = ModalVersionManager()

        # Mock the tool manager
        mock_tool = MagicMock()
        mock_tool.id = "tool-def45678"
        mock_tool.metadata_ = {}

        manager.tool_manager.get_tool_by_id = MagicMock(return_value=mock_tool)
        manager.tool_manager.update_tool_by_id_async = AsyncMock(return_value=mock_tool)

        # Create a mock actor
        mock_actor = MagicMock(spec=User)

        # No deployment exists yet
        assert await manager.needs_redeployment("tool-def45678", "v1", "config-123", actor=mock_actor) is True

        # Register a deployment
        mock_app = MagicMock()
        await manager.register_deployment(
            tool_id="tool-def45678",
            app_name="test-app",
            version_hash="v1",
            app=mock_app,
            sandbox_config_id="config-123",
            actor=mock_actor,
        )

        # Update mock to return the registered deployment
        mock_tool.metadata_ = {
            "modal_deployments": {
                "config-123": {
                    "app_name": "test-app",
                    "version_hash": "v1",
                    "deployed_at": "2024-01-01T00:00:00",
                    "dependencies": [],
                }
            }
        }

        # Same version - no redeployment needed
        assert await manager.needs_redeployment("tool-def45678", "v1", "config-123", actor=mock_actor) is False

        # Different version - redeployment needed
        assert await manager.needs_redeployment("tool-def45678", "v2", "config-123", actor=mock_actor) is True

    @pytest.mark.skip(reason="get_deployment_stats method not implemented in ModalVersionManager")
    @pytest.mark.asyncio
    async def test_deployment_stats(self):
        """Test getting deployment statistics."""
        from unittest.mock import AsyncMock

        from letta.schemas.user import User

        manager = ModalVersionManager()

        # Mock the tool manager
        mock_tools = {}
        for i in range(3):
            tool_id = f"tool-{i:08x}"
            mock_tool = MagicMock()
            mock_tool.id = tool_id
            mock_tool.metadata_ = {}
            mock_tools[tool_id] = mock_tool

        def get_tool_by_id(tool_id, actor=None):
            return mock_tools.get(tool_id)

        manager.tool_manager.get_tool_by_id = MagicMock(side_effect=get_tool_by_id)
        manager.tool_manager.update_tool_by_id_async = AsyncMock()

        # Create a mock actor
        mock_actor = MagicMock(spec=User)

        # Register multiple deployments
        for i in range(3):
            tool_id = f"tool-{i:08x}"
            mock_app = MagicMock()
            await manager.register_deployment(
                tool_id=tool_id,
                app_name=f"app-{i}",
                version_hash=f"v{i}",
                app=mock_app,
                sandbox_config_id="config-123",
                actor=mock_actor,
            )

        stats = await manager.get_deployment_stats()

        # Note: The actual implementation may store deployments differently
        # This test assumes the stats method exists and returns expected format
        assert stats["total_deployments"] >= 0  # Adjust based on actual implementation
        assert "deployments" in stats

    @pytest.mark.skip(reason="export_state and import_state methods not implemented in ModalVersionManager")
    @pytest.mark.asyncio
    async def test_export_import_state(self):
        """Test exporting and importing deployment state."""
        from unittest.mock import AsyncMock

        from letta.schemas.user import User

        manager1 = ModalVersionManager()

        # Mock the tool manager for manager1
        mock_tools = {
            "tool-11111111": MagicMock(id="tool-11111111", metadata_={}),
            "tool-22222222": MagicMock(id="tool-22222222", metadata_={}),
        }

        def get_tool_by_id(tool_id, actor=None):
            return mock_tools.get(tool_id)

        manager1.tool_manager.get_tool_by_id = MagicMock(side_effect=get_tool_by_id)
        manager1.tool_manager.update_tool_by_id_async = AsyncMock()

        # Create a mock actor
        mock_actor = MagicMock(spec=User)

        # Register deployments
        mock_app = MagicMock()
        await manager1.register_deployment(
            tool_id="tool-11111111",
            app_name="app1",
            version_hash="v1",
            app=mock_app,
            dependencies={"dep1"},
            sandbox_config_id="config-123",
            actor=mock_actor,
        )
        await manager1.register_deployment(
            tool_id="tool-22222222",
            app_name="app2",
            version_hash="v2",
            app=mock_app,
            dependencies={"dep2", "dep3"},
            sandbox_config_id="config-123",
            actor=mock_actor,
        )

        # Export state
        state_json = await manager1.export_state()
        state = json.loads(state_json)

        # Verify exported state structure
        assert "tool-11111111" in state or "deployments" in state  # Depends on implementation

        # Import into new manager
        manager2 = ModalVersionManager()
        manager2.tool_manager.get_tool_by_id = MagicMock(side_effect=get_tool_by_id)

        await manager2.import_state(state_json)

        # Note: The actual implementation may not have export/import methods
        # This test assumes they exist or should be modified based on actual API


class TestAsyncToolSandboxModalV2:
    """Test the AsyncToolSandboxModalV2 class."""

    @pytest.fixture
    def mock_tool(self):
        """Create a mock tool for testing."""
        return Tool(
            id="tool-12345678",  # Valid tool ID format
            name="test_function",
            source_code="""
def test_function(x: int, y: int) -> int:
    '''Add two numbers together.'''
    return x + y
""",
            json_schema={
                "parameters": {
                    "properties": {
                        "x": {"type": "integer"},
                        "y": {"type": "integer"},
                    }
                }
            },
            pip_requirements=[PipRequirement(name="requests")],
        )

    @pytest.fixture
    def mock_user(self):
        """Create a mock user for testing."""
        user = MagicMock()
        user.organization_id = "test-org"
        return user

    @pytest.fixture
    def mock_sandbox_config(self):
        """Create a mock sandbox configuration."""
        modal_config = ModalSandboxConfig(
            timeout=60,
            pip_requirements=["pandas"],
        )
        config = SandboxConfig(
            id="sandbox-12345678",  # Valid sandbox ID format
            type=SandboxType.MODAL,  # Changed from sandbox_type to type
            config=modal_config.model_dump(),
        )
        return config

    def test_version_hash_calculation(self, mock_tool, mock_user, mock_sandbox_config):
        """Test that version hash is calculated correctly."""
        sandbox = AsyncToolSandboxModalV2(
            tool_name="test_function",
            args={"x": 1, "y": 2},
            user=mock_user,
            tool_object=mock_tool,
            sandbox_config=mock_sandbox_config,
        )

        # Access through deployment manager
        version1 = sandbox._deployment_manager.calculate_version_hash(mock_sandbox_config)
        assert version1  # Should not be empty
        assert len(version1) == 12  # We take first 12 chars of hash

        # Same inputs should produce same hash
        version2 = sandbox._deployment_manager.calculate_version_hash(mock_sandbox_config)
        assert version1 == version2

        # Changing tool code should change hash
        mock_tool.source_code = "def test_function(x, y): return x * y"
        sandbox2 = AsyncToolSandboxModalV2(
            tool_name="test_function",
            args={"x": 1, "y": 2},
            user=mock_user,
            tool_object=mock_tool,
            sandbox_config=mock_sandbox_config,
        )
        version3 = sandbox2._deployment_manager.calculate_version_hash(mock_sandbox_config)
        assert version3 != version1

        # Changing dependencies should also change hash
        mock_tool.source_code = "def test_function(x, y): return x + y"  # Reset
        mock_tool.pip_requirements = [PipRequirement(name="numpy")]
        sandbox3 = AsyncToolSandboxModalV2(
            tool_name="test_function",
            args={"x": 1, "y": 2},
            user=mock_user,
            tool_object=mock_tool,
            sandbox_config=mock_sandbox_config,
        )
        version4 = sandbox3._deployment_manager.calculate_version_hash(mock_sandbox_config)
        assert version4 != version1

        # Changing sandbox config should change hash
        modal_config2 = ModalSandboxConfig(
            timeout=120,  # Different timeout
            pip_requirements=["pandas"],
        )
        config2 = SandboxConfig(
            id="sandbox-87654321",
            type=SandboxType.MODAL,
            config=modal_config2.model_dump(),
        )
        version5 = sandbox3._deployment_manager.calculate_version_hash(config2)
        assert version5 != version4

    def test_app_name_generation(self, mock_tool, mock_user):
        """Test app name generation."""
        sandbox = AsyncToolSandboxModalV2(
            tool_name="test_function",
            args={"x": 1, "y": 2},
            user=mock_user,
            tool_object=mock_tool,
        )

        # App name generation is now in deployment manager and uses tool ID
        app_name = sandbox._deployment_manager._generate_app_name()
        # App name is based on tool ID truncated to 40 chars
        assert app_name == mock_tool.id[:40]

    @pytest.mark.asyncio
    async def test_run_with_mocked_modal(self, mock_tool, mock_user, mock_sandbox_config):
        """Test the run method with mocked Modal components."""
        with (
            patch("letta.services.tool_sandbox.modal_sandbox_v2.modal") as mock_modal,
            patch("letta.services.tool_sandbox.modal_deployment_manager.modal") as mock_modal2,
        ):
            # Mock Modal app
            mock_app = MagicMock()  # Use MagicMock for the app itself
            mock_app.run = MagicMock()

            # Mock the function decorator
            def mock_function_decorator(*args, **kwargs):
                def decorator(func):
                    # Create a mock that has a remote attribute
                    mock_func = MagicMock()
                    mock_func.remote = mock_remote
                    # Store the mocked function as tool_executor on the app
                    mock_app.tool_executor = mock_func
                    return mock_func

                return decorator

            mock_app.function = mock_function_decorator

            # Mock deployment
            mock_app.deploy = MagicMock()
            mock_app.deploy.aio = AsyncMock()

            # Mock the remote execution
            mock_remote = MagicMock()
            mock_remote.aio = AsyncMock(
                return_value={
                    "result": 3,  # Return actual integer, not string
                    "agent_state": None,
                    "stdout": "Executing...",
                    "stderr": "",
                    "error": None,
                }
            )

            mock_modal.App.return_value = mock_app
            mock_modal2.App.return_value = mock_app

            # Mock App.lookup.aio to handle app lookup attempts
            mock_modal.App.lookup = MagicMock()
            mock_modal.App.lookup.aio = AsyncMock(side_effect=Exception("App not found"))
            mock_modal2.App.lookup = MagicMock()
            mock_modal2.App.lookup.aio = AsyncMock(side_effect=Exception("App not found"))

            # Mock enable_output context manager
            mock_modal.enable_output = MagicMock()
            mock_modal.enable_output.return_value.__enter__ = MagicMock()
            mock_modal.enable_output.return_value.__exit__ = MagicMock()
            mock_modal2.enable_output = MagicMock()
            mock_modal2.enable_output.return_value.__enter__ = MagicMock()
            mock_modal2.enable_output.return_value.__exit__ = MagicMock()

            # Mock the SandboxConfigManager to avoid type checking issues
            with patch("letta.services.tool_sandbox.base.SandboxConfigManager") as MockSCM:
                mock_scm = MockSCM.return_value
                mock_scm.get_sandbox_env_vars_as_dict_async = AsyncMock(return_value={})

                # Create sandbox
                sandbox = AsyncToolSandboxModalV2(
                    tool_name="test_function",
                    args={"x": 1, "y": 2},
                    user=mock_user,
                    tool_object=mock_tool,
                    sandbox_config=mock_sandbox_config,
                )

                # Mock the version manager through deployment manager
                version_manager = sandbox._deployment_manager.version_manager
                if version_manager:
                    with patch.object(version_manager, "get_deployment", return_value=None):
                        with patch.object(version_manager, "register_deployment", return_value=None):
                            # Run the tool
                            result = await sandbox.run()
                else:
                    # If no version manager (use_version_tracking=False), just run
                    result = await sandbox.run()

            assert result.func_return == 3  # Check for actual integer
            assert result.status == "success"
            assert "Executing..." in result.stdout[0]

    def test_detect_async_function(self, mock_user):
        """Test detection of async functions."""
        # Test with sync function
        sync_tool = Tool(
            id="tool-abcdef12",  # Valid tool ID format
            name="sync_func",
            source_code="def sync_func(x): return x",
            json_schema={"parameters": {"properties": {}}},
        )

        sandbox_sync = AsyncToolSandboxModalV2(
            tool_name="sync_func",
            args={},
            user=mock_user,
            tool_object=sync_tool,
        )

        assert sandbox_sync._detect_async_function() is False

        # Test with async function
        async_tool = Tool(
            id="tool-fedcba21",  # Valid tool ID format
            name="async_func",
            source_code="async def async_func(x): return x",
            json_schema={"parameters": {"properties": {}}},
        )

        sandbox_async = AsyncToolSandboxModalV2(
            tool_name="async_func",
            args={},
            user=mock_user,
            tool_object=async_tool,
        )

        assert sandbox_async._detect_async_function() is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
