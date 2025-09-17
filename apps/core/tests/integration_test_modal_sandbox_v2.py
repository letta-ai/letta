"""
Integration tests for Modal Sandbox V2.

These tests cover:
- Basic tool execution with Modal
- Error handling and edge cases
- Async tool execution
- Version tracking and redeployment
- Persistence of deployment metadata
- Concurrent execution handling
- Multiple sandbox configurations
- Service restart scenarios
"""

import asyncio
import os
import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from letta.schemas.enums import ToolSourceType
from letta.schemas.organization import Organization
from letta.schemas.pip_requirement import PipRequirement
from letta.schemas.sandbox_config import ModalSandboxConfig, SandboxConfig, SandboxConfigCreate, SandboxType
from letta.schemas.tool import Tool
from letta.schemas.user import User
from letta.services.organization_manager import OrganizationManager
from letta.services.sandbox_config_manager import SandboxConfigManager
from letta.services.tool_sandbox.modal_sandbox_v2 import AsyncToolSandboxModalV2
from letta.services.tool_sandbox.modal_version_manager import ModalVersionManager, get_version_manager
from letta.services.user_manager import UserManager

# ============================================================================
# SHARED FIXTURES
# ============================================================================


@pytest.fixture
def test_organization():
    """Create a test organization in the database."""
    org_manager = OrganizationManager()
    org = org_manager.create_organization(Organization(name=f"test-org-{uuid.uuid4().hex[:8]}"))
    yield org
    # Cleanup would go here if needed


@pytest.fixture
def test_user(test_organization):
    """Create a test user in the database."""
    user_manager = UserManager()
    user = user_manager.create_user(User(name=f"test-user-{uuid.uuid4().hex[:8]}", organization_id=test_organization.id))
    yield user
    # Cleanup would go here if needed


@pytest.fixture
def mock_user():
    """Create a mock user for tests that don't need database persistence."""
    user = MagicMock()
    user.organization_id = f"test-org-{uuid.uuid4().hex[:8]}"
    user.id = f"user-{uuid.uuid4().hex[:8]}"
    return user


@pytest.fixture
def basic_tool(test_user):
    """Create a basic tool for testing."""
    from letta.services.tool_manager import ToolManager

    tool = Tool(
        id=f"tool-{uuid.uuid4().hex[:8]}",
        name="calculate",
        source_type=ToolSourceType.python,
        source_code="""
def calculate(operation: str, a: float, b: float) -> float:
    '''Perform a calculation on two numbers.

    Args:
        operation: The operation to perform (add, subtract, multiply, divide)
        a: The first number
        b: The second number

    Returns:
        float: The result of the calculation
    '''
    if operation == "add":
        return a + b
    elif operation == "subtract":
        return a - b
    elif operation == "multiply":
        return a * b
    elif operation == "divide":
        if b == 0:
            raise ValueError("Cannot divide by zero")
        return a / b
    else:
        raise ValueError(f"Unknown operation: {operation}")
""",
        json_schema={
            "parameters": {
                "properties": {
                    "operation": {"type": "string", "description": "The operation to perform"},
                    "a": {"type": "number", "description": "The first number"},
                    "b": {"type": "number", "description": "The second number"},
                }
            }
        },
    )

    # Create the tool in the database
    tool_manager = ToolManager()
    created_tool = tool_manager.create_or_update_tool(tool, actor=test_user)
    yield created_tool

    # Cleanup would go here if needed


@pytest.fixture
def async_tool(test_user):
    """Create an async tool for testing."""
    from letta.services.tool_manager import ToolManager

    tool = Tool(
        id=f"tool-{uuid.uuid4().hex[:8]}",
        name="fetch_data",
        source_type=ToolSourceType.python,
        source_code="""
import asyncio

async def fetch_data(url: str, delay: float = 0.1) -> Dict:
    '''Simulate fetching data from a URL.

    Args:
        url: The URL to fetch data from
        delay: The delay in seconds before returning

    Returns:
        Dict: A dictionary containing the fetched data
    '''
    await asyncio.sleep(delay)
    return {
        "url": url,
        "status": "success",
        "data": f"Data from {url}",
        "timestamp": "2024-01-01T00:00:00Z"
    }
""",
        json_schema={
            "parameters": {
                "properties": {
                    "url": {"type": "string", "description": "The URL to fetch data from"},
                    "delay": {"type": "number", "default": 0.1, "description": "The delay in seconds"},
                }
            }
        },
    )

    # Create the tool in the database
    tool_manager = ToolManager()
    created_tool = tool_manager.create_or_update_tool(tool, actor=test_user)
    yield created_tool

    # Cleanup would go here if needed


@pytest.fixture
def tool_with_dependencies(test_user):
    """Create a tool that requires external dependencies."""
    from letta.services.tool_manager import ToolManager

    tool = Tool(
        id=f"tool-{uuid.uuid4().hex[:8]}",
        name="process_json",
        source_type=ToolSourceType.python,
        source_code="""
import json
import hashlib

def process_json(data: str) -> Dict:
    '''Process JSON data and return metadata.

    Args:
        data: The JSON string to process

    Returns:
        Dict: Metadata about the JSON data
    '''
    try:
        parsed = json.loads(data)
        data_hash = hashlib.md5(data.encode()).hexdigest()

        return {
            "valid": True,
            "keys": list(parsed.keys()) if isinstance(parsed, dict) else None,
            "type": type(parsed).__name__,
            "hash": data_hash,
            "size": len(data),
        }
    except json.JSONDecodeError as e:
        return {
            "valid": False,
            "error": str(e),
            "size": len(data),
        }
""",
        json_schema={
            "parameters": {
                "properties": {
                    "data": {"type": "string", "description": "The JSON string to process"},
                }
            }
        },
        pip_requirements=[PipRequirement(name="hashlib")],  # Actually built-in, but for testing
    )

    # Create the tool in the database
    tool_manager = ToolManager()
    created_tool = tool_manager.create_or_update_tool(tool, actor=test_user)
    yield created_tool

    # Cleanup would go here if needed


@pytest.fixture
def sandbox_config(test_user):
    """Create a test sandbox configuration in the database."""
    manager = SandboxConfigManager()
    modal_config = ModalSandboxConfig(
        timeout=60,
        pip_requirements=["pandas==2.0.0"],
    )
    config_create = SandboxConfigCreate(config=modal_config.model_dump())
    config = manager.create_or_update_sandbox_config(sandbox_config_create=config_create, actor=test_user)
    yield config
    # Cleanup would go here if needed


@pytest.fixture
def mock_sandbox_config():
    """Create a mock sandbox configuration for tests that don't need database persistence."""
    modal_config = ModalSandboxConfig(
        timeout=60,
        pip_requirements=["pandas==2.0.0"],
    )
    return SandboxConfig(
        id=f"sandbox-{uuid.uuid4().hex[:8]}",
        type=SandboxType.MODAL,
        config=modal_config.model_dump(),
    )


# ============================================================================
# BASIC EXECUTION TESTS (Requires Modal credentials)
# ============================================================================


@pytest.mark.skipif(
    True or not os.getenv("MODAL_TOKEN_ID") or not os.getenv("MODAL_TOKEN_SECRET"), reason="Modal credentials not configured"
)
class TestModalV2BasicExecution:
    """Basic execution tests with Modal."""

    @pytest.mark.asyncio
    async def test_basic_execution(self, basic_tool, test_user):
        """Test basic tool execution with different operations."""
        sandbox = AsyncToolSandboxModalV2(
            tool_name="calculate",
            args={"operation": "add", "a": 5, "b": 3},
            user=test_user,
            tool_object=basic_tool,
        )

        result = await sandbox.run()
        assert result.status == "success"
        assert result.func_return == 8.0

        # Test division
        sandbox2 = AsyncToolSandboxModalV2(
            tool_name="calculate",
            args={"operation": "divide", "a": 10, "b": 2},
            user=test_user,
            tool_object=basic_tool,
        )

        result2 = await sandbox2.run()
        assert result2.status == "success"
        assert result2.func_return == 5.0

    @pytest.mark.asyncio
    async def test_error_handling(self, basic_tool, test_user):
        """Test error handling in tool execution."""
        # Test division by zero
        sandbox = AsyncToolSandboxModalV2(
            tool_name="calculate",
            args={"operation": "divide", "a": 10, "b": 0},
            user=test_user,
            tool_object=basic_tool,
        )

        result = await sandbox.run()
        assert result.status == "error"
        assert "Cannot divide by zero" in str(result.func_return)

        # Test unknown operation
        sandbox2 = AsyncToolSandboxModalV2(
            tool_name="calculate",
            args={"operation": "unknown", "a": 1, "b": 2},
            user=test_user,
            tool_object=basic_tool,
        )

        result2 = await sandbox2.run()
        assert result2.status == "error"
        assert "Unknown operation" in str(result2.func_return)

    @pytest.mark.asyncio
    async def test_async_tool_execution(self, async_tool, test_user):
        """Test execution of async tools."""
        sandbox = AsyncToolSandboxModalV2(
            tool_name="fetch_data",
            args={"url": "https://example.com", "delay": 0.01},
            user=test_user,
            tool_object=async_tool,
        )

        result = await sandbox.run()
        assert result.status == "success"

        # Parse the result (it should be a dict)
        data = result.func_return
        assert isinstance(data, dict)
        assert data["url"] == "https://example.com"
        assert data["status"] == "success"
        assert "Data from https://example.com" in data["data"]

    @pytest.mark.asyncio
    async def test_concurrent_executions(self, basic_tool, test_user):
        """Test that concurrent executions work correctly."""
        # Create multiple sandboxes with different arguments
        sandboxes = [
            AsyncToolSandboxModalV2(
                tool_name="calculate",
                args={"operation": "add", "a": i, "b": i + 1},
                user=test_user,
                tool_object=basic_tool,
            )
            for i in range(5)
        ]

        # Execute all concurrently
        results = await asyncio.gather(*[s.run() for s in sandboxes])

        # Verify all succeeded with correct results
        for i, result in enumerate(results):
            assert result.status == "success"
            expected = i + (i + 1)  # a + b
            assert result.func_return == expected


# ============================================================================
# PERSISTENCE AND VERSION TRACKING TESTS
# ============================================================================


@pytest.mark.asyncio
class TestModalV2Persistence:
    """Tests for deployment persistence and version tracking."""

    async def test_deployment_persists_in_tool_metadata(self, mock_user, sandbox_config):
        """Test that deployment info is correctly stored in tool metadata."""
        tool = Tool(
            id=f"tool-{uuid.uuid4().hex[:8]}",
            name="calculate",
            source_code="def calculate(x: float) -> float:\n    '''Double a number.\n    \n    Args:\n        x: The number to double\n    \n    Returns:\n        The doubled value\n    '''\n    return x * 2",
            json_schema={"parameters": {"properties": {"x": {"type": "number"}}}},
            metadata_={},
        )

        with patch("letta.services.tool_sandbox.modal_version_manager.ToolManager") as MockToolManager:
            mock_tool_manager = MockToolManager.return_value
            mock_tool_manager.get_tool_by_id.return_value = tool
            mock_tool_manager.update_tool_by_id_async = AsyncMock(return_value=tool)

            version_manager = ModalVersionManager()

            # Register a deployment
            app_name = f"{mock_user.organization_id}-{tool.name}-v2"
            version_hash = "abc123def456"
            mock_app = MagicMock()

            await version_manager.register_deployment(
                tool_id=tool.id,
                app_name=app_name,
                version_hash=version_hash,
                app=mock_app,
                dependencies={"pandas", "numpy"},
                sandbox_config_id=sandbox_config.id,
                actor=mock_user,
            )

            # Verify update was called with correct metadata
            mock_tool_manager.update_tool_by_id_async.assert_called_once()
            call_args = mock_tool_manager.update_tool_by_id_async.call_args

            metadata = call_args[1]["tool_update"].metadata_
            assert "modal_deployments" in metadata
            assert sandbox_config.id in metadata["modal_deployments"]

            deployment_data = metadata["modal_deployments"][sandbox_config.id]
            assert deployment_data["app_name"] == app_name
            assert deployment_data["version_hash"] == version_hash
            assert set(deployment_data["dependencies"]) == {"pandas", "numpy"}

    async def test_version_tracking_and_redeployment(self, mock_user, basic_tool, sandbox_config):
        """Test version tracking and redeployment on code changes."""
        with patch("letta.services.tool_sandbox.modal_version_manager.ToolManager") as MockToolManager:
            mock_tool_manager = MockToolManager.return_value
            mock_tool_manager.get_tool_by_id.return_value = basic_tool

            # Track metadata updates
            metadata_store = {}

            async def update_tool(*args, **kwargs):
                metadata_store.update(kwargs.get("metadata_", {}))
                basic_tool.metadata_ = metadata_store
                return basic_tool

            mock_tool_manager.update_tool_by_id_async = AsyncMock(side_effect=update_tool)

            version_manager = ModalVersionManager()
            app_name = f"{mock_user.organization_id}-{basic_tool.name}-v2"

            # First deployment
            version1 = "version1hash"
            await version_manager.register_deployment(
                tool_id=basic_tool.id,
                app_name=app_name,
                version_hash=version1,
                app=MagicMock(),
                sandbox_config_id=sandbox_config.id,
                actor=mock_user,
            )

            # Should not need redeployment with same version
            assert not await version_manager.needs_redeployment(basic_tool.id, version1, sandbox_config.id, actor=mock_user)

            # Should need redeployment with different version
            version2 = "version2hash"
            assert await version_manager.needs_redeployment(basic_tool.id, version2, sandbox_config.id, actor=mock_user)

    async def test_deployment_survives_service_restart(self, mock_user, sandbox_config):
        """Test that deployment info survives a service restart."""
        tool_id = f"tool-{uuid.uuid4().hex[:8]}"
        app_name = f"{mock_user.organization_id}-calculate-v2"
        version_hash = "restart-test-v1"

        # Simulate existing deployment in metadata
        existing_metadata = {
            "modal_deployments": {
                sandbox_config.id: {
                    "app_name": app_name,
                    "version_hash": version_hash,
                    "deployed_at": datetime.now().isoformat(),
                    "dependencies": ["pandas"],
                }
            }
        }

        tool = Tool(
            id=tool_id,
            name="calculate",
            source_code="def calculate(x: float) -> float:\n    '''Identity function.\n    \n    Args:\n        x: The input value\n    \n    Returns:\n        The same value\n    '''\n    return x",
            json_schema={"parameters": {"properties": {}}},
            metadata_=existing_metadata,
        )

        with patch("letta.services.tool_sandbox.modal_version_manager.ToolManager") as MockToolManager:
            mock_tool_manager = MockToolManager.return_value
            mock_tool_manager.get_tool_by_id.return_value = tool

            # Create new version manager (simulating service restart)
            version_manager = ModalVersionManager()

            # Should be able to retrieve existing deployment
            deployment = await version_manager.get_deployment(tool_id, sandbox_config.id, actor=mock_user)

            assert deployment is not None
            assert deployment.app_name == app_name
            assert deployment.version_hash == version_hash
            assert deployment.dependencies == {"pandas"}

            # Should not need redeployment with same version
            assert not await version_manager.needs_redeployment(tool_id, version_hash, sandbox_config.id, actor=mock_user)

    async def test_different_sandbox_configs_same_tool(self, mock_user):
        """Test that different sandbox configs can have different deployments for the same tool."""
        tool = Tool(
            id=f"tool-{uuid.uuid4().hex[:8]}",
            name="multi_config",
            source_code="def test(x: int) -> int:\n    '''Test function.\n    \n    Args:\n        x: The input value\n    \n    Returns:\n        The same value\n    '''\n    return x",
            json_schema={"parameters": {"properties": {}}},
            metadata_={},
        )

        # Create two different sandbox configs
        config1 = SandboxConfig(
            id=f"sandbox-{uuid.uuid4().hex[:8]}",
            type=SandboxType.MODAL,
            config=ModalSandboxConfig(timeout=30, pip_requirements=["pandas"]).model_dump(),
        )

        config2 = SandboxConfig(
            id=f"sandbox-{uuid.uuid4().hex[:8]}",
            type=SandboxType.MODAL,
            config=ModalSandboxConfig(timeout=60, pip_requirements=["numpy"]).model_dump(),
        )

        with patch("letta.services.tool_sandbox.modal_version_manager.ToolManager") as MockToolManager:
            mock_tool_manager = MockToolManager.return_value
            mock_tool_manager.get_tool_by_id.return_value = tool

            # Track all metadata updates
            all_metadata = {"modal_deployments": {}}

            async def update_tool(*args, **kwargs):
                new_meta = kwargs.get("metadata_", {})
                if "modal_deployments" in new_meta:
                    all_metadata["modal_deployments"].update(new_meta["modal_deployments"])
                tool.metadata_ = all_metadata
                return tool

            mock_tool_manager.update_tool_by_id_async = AsyncMock(side_effect=update_tool)

            version_manager = ModalVersionManager()
            app_name = f"{mock_user.organization_id}-{tool.name}-v2"

            # Deploy with config1
            await version_manager.register_deployment(
                tool_id=tool.id,
                app_name=app_name,
                version_hash="config1-hash",
                app=MagicMock(),
                sandbox_config_id=config1.id,
                actor=mock_user,
            )

            # Deploy with config2
            await version_manager.register_deployment(
                tool_id=tool.id,
                app_name=app_name,
                version_hash="config2-hash",
                app=MagicMock(),
                sandbox_config_id=config2.id,
                actor=mock_user,
            )

            # Both deployments should exist
            deployment1 = await version_manager.get_deployment(tool.id, config1.id, actor=mock_user)
            deployment2 = await version_manager.get_deployment(tool.id, config2.id, actor=mock_user)

            assert deployment1 is not None
            assert deployment2 is not None
            assert deployment1.version_hash == "config1-hash"
            assert deployment2.version_hash == "config2-hash"

    async def test_sandbox_config_changes_trigger_redeployment(self, basic_tool, mock_user):
        """Test that sandbox config changes trigger redeployment."""
        # Skip the actual Modal deployment part in this test
        # Just test the version hash calculation changes

        config1 = SandboxConfig(
            id=f"sandbox-{uuid.uuid4().hex[:8]}",
            type=SandboxType.MODAL,
            config=ModalSandboxConfig(timeout=30).model_dump(),
        )

        config2 = SandboxConfig(
            id=f"sandbox-{uuid.uuid4().hex[:8]}",
            type=SandboxType.MODAL,
            config=ModalSandboxConfig(
                timeout=60,
                pip_requirements=["requests"],
            ).model_dump(),
        )

        # Mock the Modal credentials to allow sandbox instantiation
        with patch("letta.services.tool_sandbox.modal_sandbox_v2.tool_settings") as mock_settings:
            mock_settings.modal_token_id = "test-token-id"
            mock_settings.modal_token_secret = "test-token-secret"

            sandbox1 = AsyncToolSandboxModalV2(
                tool_name="calculate",
                args={"operation": "add", "a": 1, "b": 1},
                user=mock_user,
                tool_object=basic_tool,
                sandbox_config=config1,
            )

            sandbox2 = AsyncToolSandboxModalV2(
                tool_name="calculate",
                args={"operation": "add", "a": 2, "b": 2},
                user=mock_user,
                tool_object=basic_tool,
                sandbox_config=config2,
            )

            # Version hashes should be different due to config changes
            version1 = sandbox1._deployment_manager.calculate_version_hash(config1)
            version2 = sandbox2._deployment_manager.calculate_version_hash(config2)
            assert version1 != version2


# ============================================================================
# MOCKED INTEGRATION TESTS (No Modal credentials required)
# ============================================================================


class TestModalV2MockedIntegration:
    """Integration tests with mocked Modal components."""

    @pytest.mark.asyncio
    async def test_full_integration_with_persistence(self, mock_user, sandbox_config):
        """Test the full Modal sandbox V2 integration with persistence."""
        tool = Tool(
            id=f"tool-{uuid.uuid4().hex[:8]}",
            name="integration_test",
            source_code="""
def calculate(operation: str, a: float, b: float) -> float:
    '''Perform a simple calculation'''
    if operation == "add":
        return a + b
    return 0
""",
            json_schema={
                "parameters": {
                    "properties": {
                        "operation": {"type": "string"},
                        "a": {"type": "number"},
                        "b": {"type": "number"},
                    }
                }
            },
            metadata_={},
        )

        with patch("letta.services.tool_sandbox.modal_version_manager.ToolManager") as MockToolManager:
            with patch("letta.services.tool_sandbox.modal_sandbox_v2.modal") as mock_modal:
                mock_tool_manager = MockToolManager.return_value
                mock_tool_manager.get_tool_by_id.return_value = tool

                # Track metadata updates
                async def update_tool(*args, **kwargs):
                    tool.metadata_ = kwargs.get("metadata_", {})
                    return tool

                mock_tool_manager.update_tool_by_id_async = update_tool

                # Mock Modal app
                mock_app = MagicMock()
                mock_app.run = MagicMock()

                # Mock the function decorator
                def mock_function_decorator(*args, **kwargs):
                    def decorator(func):
                        mock_func = MagicMock()
                        mock_func.remote = MagicMock()
                        mock_func.remote.aio = AsyncMock(
                            return_value={
                                "result": 8,
                                "agent_state": None,
                                "stdout": "",
                                "stderr": "",
                                "error": None,
                            }
                        )
                        mock_app.tool_executor = mock_func
                        return mock_func

                    return decorator

                mock_app.function = mock_function_decorator
                mock_app.deploy = MagicMock()
                mock_app.deploy.aio = AsyncMock()

                mock_modal.App.return_value = mock_app

                # Mock the sandbox config manager
                with patch("letta.services.tool_sandbox.base.SandboxConfigManager") as MockSCM:
                    mock_scm = MockSCM.return_value
                    mock_scm.get_sandbox_env_vars_as_dict_async = AsyncMock(return_value={})

                    # Create sandbox
                    sandbox = AsyncToolSandboxModalV2(
                        tool_name="integration_test",
                        args={"operation": "add", "a": 5, "b": 3},
                        user=mock_user,
                        tool_object=tool,
                        sandbox_config=sandbox_config,
                    )

                    # Mock version manager methods through deployment manager
                    version_manager = sandbox._deployment_manager.version_manager
                    if version_manager:
                        with patch.object(version_manager, "get_deployment", return_value=None):
                            with patch.object(version_manager, "register_deployment", return_value=None):
                                # First execution - should deploy
                                result1 = await sandbox.run()
                                assert result1.status == "success"
                                assert result1.func_return == 8
                    else:
                        # If no version manager, just run
                        result1 = await sandbox.run()
                        assert result1.status == "success"
                        assert result1.func_return == 8

    @pytest.mark.asyncio
    async def test_concurrent_deployment_handling(self, mock_user, sandbox_config):
        """Test that concurrent deployment requests are handled correctly."""
        tool = Tool(
            id=f"tool-{uuid.uuid4().hex[:8]}",
            name="concurrent_test",
            source_code="def test(x: int) -> int:\n    '''Test function.\n    \n    Args:\n        x: The input value\n    \n    Returns:\n        The same value\n    '''\n    return x",
            json_schema={"parameters": {"properties": {}}},
            metadata_={},
        )

        with patch("letta.services.tool_sandbox.modal_version_manager.ToolManager") as MockToolManager:
            mock_tool_manager = MockToolManager.return_value
            mock_tool_manager.get_tool_by_id.return_value = tool

            # Track update calls
            update_calls = []

            async def track_update(*args, **kwargs):
                update_calls.append((args, kwargs))
                await asyncio.sleep(0.01)  # Simulate slight delay
                return tool

            mock_tool_manager.update_tool_by_id_async = AsyncMock(side_effect=track_update)

            version_manager = ModalVersionManager()
            app_name = f"{mock_user.organization_id}-{tool.name}-v2"
            version_hash = "concurrent123"

            # Launch multiple concurrent deployments
            tasks = []
            for i in range(5):
                task = version_manager.register_deployment(
                    tool_id=tool.id,
                    app_name=app_name,
                    version_hash=version_hash,
                    app=MagicMock(),
                    sandbox_config_id=sandbox_config.id,
                    actor=mock_user,
                )
                tasks.append(task)

            # Wait for all to complete
            await asyncio.gather(*tasks)

            # All calls should complete (current implementation doesn't dedupe)
            assert len(update_calls) == 5


# ============================================================================
# DEPLOYMENT STATISTICS TESTS
# ============================================================================


@pytest.mark.skipif(not os.getenv("MODAL_TOKEN_ID") or not os.getenv("MODAL_TOKEN_SECRET"), reason="Modal credentials not configured")
class TestModalV2DeploymentStats:
    """Tests for deployment statistics tracking."""

    @pytest.mark.asyncio
    async def test_deployment_stats(self, basic_tool, async_tool, test_user):
        """Test deployment statistics tracking."""
        version_manager = get_version_manager()

        # Clear any existing deployments (for test isolation)
        version_manager.clear_deployments()

        # Ensure clean state
        await asyncio.sleep(0.1)

        # Deploy multiple tools
        tools = [basic_tool, async_tool]
        for tool in tools:
            sandbox = AsyncToolSandboxModalV2(
                tool_name=tool.name,
                args={},
                user=test_user,
                tool_object=tool,
            )
            await sandbox.run()

        # Get stats
        stats = await version_manager.get_deployment_stats()

        assert stats["total_deployments"] >= 2
        assert stats["active_deployments"] >= 2
        assert stats["stale_deployments"] == 0

        # Check individual deployment info
        for deployment in stats["deployments"]:
            assert "app_name" in deployment
            assert "version" in deployment
            assert "usage_count" in deployment
            assert deployment["usage_count"] >= 1


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
