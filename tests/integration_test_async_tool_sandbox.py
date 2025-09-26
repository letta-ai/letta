import os
import secrets
import string
import uuid
from pathlib import Path
from unittest.mock import patch

import pytest
from sqlalchemy import delete

from letta.config import LettaConfig
from letta.functions.function_sets.base import core_memory_append, core_memory_replace
from letta.orm.sandbox_config import SandboxConfig, SandboxEnvironmentVariable
from letta.schemas.agent import AgentState, CreateAgent
from letta.schemas.block import CreateBlock
from letta.schemas.environment_variables import AgentEnvironmentVariable, SandboxEnvironmentVariableCreate
from letta.schemas.organization import Organization
from letta.schemas.pip_requirement import PipRequirement
from letta.schemas.sandbox_config import E2BSandboxConfig, LocalSandboxConfig, SandboxConfigCreate
from letta.schemas.user import User
from letta.server.db import db_registry
from letta.server.server import SyncServer
from letta.services.organization_manager import OrganizationManager
from letta.services.sandbox_config_manager import SandboxConfigManager
from letta.services.tool_manager import ToolManager
from letta.services.tool_sandbox.e2b_sandbox import AsyncToolSandboxE2B
from letta.services.tool_sandbox.local_sandbox import AsyncToolSandboxLocal
from letta.services.user_manager import UserManager
from tests.helpers.utils import create_tool_from_func

# Constants
namespace = uuid.NAMESPACE_DNS
org_name = str(uuid.uuid5(namespace, "test-tool-execution-sandbox-org"))
user_name = str(uuid.uuid5(namespace, "test-tool-execution-sandbox-user"))

# Set environment variable immediately to prevent pooling issues
os.environ["LETTA_DISABLE_SQLALCHEMY_POOLING"] = "true"


# Disable SQLAlchemy connection pooling for tests to prevent event loop issues
@pytest.fixture(scope="session", autouse=True)
def disable_db_pooling_for_tests():
    """Disable database connection pooling for the entire test session."""
    # Environment variable is already set above and settings reloaded
    yield
    # Clean up environment variable after tests
    if "LETTA_DISABLE_SQLALCHEMY_POOLING" in os.environ:
        del os.environ["LETTA_DISABLE_SQLALCHEMY_POOLING"]


# @pytest.fixture(autouse=True)
# async def cleanup_db_connections():
#    """Cleanup database connections after each test."""
#    yield
#
#    # Dispose async engines in the current event loop
#    try:
#        await close_db()
#    except Exception as e:
#        # Log the error but don't fail the test
#        print(f"Warning: Failed to cleanup database connections: {e}")


# Fixtures
@pytest.fixture(scope="module")
def server():
    """
    Creates a SyncServer instance for testing.

    Loads and saves config to ensure proper initialization.
    """
    config = LettaConfig.load()

    config.save()

    server = SyncServer(init_with_default_org_and_user=True)
    # create user/org
    yield server


@pytest.fixture(autouse=True)
async def clear_tables():
    """Fixture to clear the organization table before each test."""
    from letta.server.db import db_registry

    async with db_registry.async_session() as session:
        await session.execute(delete(SandboxEnvironmentVariable))
        await session.execute(delete(SandboxConfig))
        await session.commit()  # Commit the deletion


@pytest.fixture
async def test_organization():
    """Fixture to create and return the default organization."""
    org = await OrganizationManager().create_organization_async(Organization(name=org_name))
    yield org


@pytest.fixture
async def test_user(test_organization):
    """Fixture to create and return the default user within the default organization."""
    user = await UserManager().create_actor_async(User(name=user_name, organization_id=test_organization.id))
    yield user


@pytest.fixture
async def add_integers_tool(test_user):
    def add(x: int, y: int) -> int:
        """
        Simple function that adds two integers.

        Parameters:
            x (int): The first integer to add.
            y (int): The second integer to add.

        Returns:
            int: The result of adding x and y.
        """
        return x + y

    tool = create_tool_from_func(add)
    tool = await ToolManager().create_or_update_tool_async(tool, test_user)
    yield tool


@pytest.fixture
async def cowsay_tool(test_user):
    # This defines a tool for a package we definitely do NOT have in letta
    # If this test passes, that means the tool was correctly executed in a separate Python environment
    def cowsay() -> str:
        """
        Simple function that uses the cowsay package to print out the secret word env variable.

        Returns:
            str: The cowsay ASCII art.
        """
        import os

        import cowsay

        cowsay.cow(os.getenv("secret_word"))

    tool = create_tool_from_func(cowsay)
    tool = await ToolManager().create_or_update_tool_async(tool, test_user)
    yield tool


@pytest.fixture
async def get_env_tool(test_user):
    def get_env() -> str:
        """
        Simple function that returns the secret word env variable.

        Returns:
            str: The secret word
        """
        import os

        secret_word = os.getenv("secret_word")
        print(secret_word)
        return secret_word

    tool = create_tool_from_func(get_env)
    tool = await ToolManager().create_or_update_tool_async(tool, test_user)
    yield tool


@pytest.fixture
async def get_warning_tool(test_user):
    def warn_hello_world() -> str:
        """
        Simple function that warns hello world.

        Returns:
            str: hello world
        """
        import warnings

        msg = "Hello World"
        warnings.warn(msg)
        return msg

    tool = create_tool_from_func(warn_hello_world)
    tool = await ToolManager().create_or_update_tool_async(tool, test_user)
    yield tool


@pytest.fixture
async def always_err_tool(test_user):
    def error() -> str:
        """
        Simple function that errors

        Returns:
            str: not important
        """
        # Raise a unusual error so we know it's from this function
        print("Going to error now")
        raise ZeroDivisionError("This is an intentionally weird division!")

    tool = create_tool_from_func(error)
    tool = await ToolManager().create_or_update_tool_async(tool, test_user)
    yield tool


@pytest.fixture
async def list_tool(test_user):
    def create_list():
        """Simple function that returns a list"""

        return [1] * 5

    tool = create_tool_from_func(create_list)
    tool = await ToolManager().create_or_update_tool_async(tool, test_user)
    yield tool


@pytest.fixture
async def clear_core_memory_tool(test_user):
    def clear_memory(agent_state: "AgentState"):
        """Clear the core memory"""
        agent_state.memory.get_block("human").value = ""
        agent_state.memory.get_block("persona").value = ""

    tool = create_tool_from_func(clear_memory)
    tool = await ToolManager().create_or_update_tool_async(tool, test_user)
    yield tool


@pytest.fixture
async def external_codebase_tool(test_user):
    from tests.test_tool_sandbox.restaurant_management_system.adjust_menu_prices import adjust_menu_prices

    tool = create_tool_from_func(adjust_menu_prices)
    tool = await ToolManager().create_or_update_tool_async(tool, test_user)
    yield tool


@pytest.fixture
async def agent_state(server: SyncServer):
    await server.init_async(init_with_default_org_and_user=True)
    actor = await server.user_manager.create_default_actor_async()
    agent_state = await server.create_agent_async(
        CreateAgent(
            memory_blocks=[
                CreateBlock(
                    label="human",
                    value="username: sarah",
                ),
                CreateBlock(
                    label="persona",
                    value="This is the persona",
                ),
            ],
            include_base_tools=True,
            model="openai/gpt-4o-mini",
            tags=["test_agents"],
            embedding="letta/letta-free",
        ),
        actor=actor,
    )
    agent_state.tool_rules = []
    yield agent_state


@pytest.fixture
async def custom_test_sandbox_config(test_user):
    """
    Fixture to create a consistent local sandbox configuration for tests.

    Args:
        test_user: The test user to be used for creating the sandbox configuration.

    Returns:
        A tuple containing the SandboxConfigManager and the created sandbox configuration.
    """
    # Create the SandboxConfigManager
    manager = SandboxConfigManager()

    # Set the sandbox to be within the external codebase path and use a venv
    external_codebase_path = str(Path(__file__).parent / "test_tool_sandbox" / "restaurant_management_system")
    # tqdm is used in this codebase, but NOT in the requirements.txt, this tests that we can successfully install pip requirements
    local_sandbox_config = LocalSandboxConfig(
        sandbox_dir=external_codebase_path, use_venv=True, pip_requirements=[PipRequirement(name="tqdm")]
    )

    # Create the sandbox configuration
    config_create = SandboxConfigCreate(config=local_sandbox_config.model_dump())

    # Create or update the sandbox configuration
    await manager.create_or_update_sandbox_config_async(sandbox_config_create=config_create, actor=test_user)

    return manager, local_sandbox_config


# Tool-specific fixtures
@pytest.fixture
async def tool_with_pip_requirements(test_user):
    def use_requests_and_numpy() -> str:
        """
        Function that uses requests and numpy packages to test tool-specific pip requirements.

        Returns:
            str: Success message if packages are available.
        """
        try:
            import numpy as np
            import requests

            # Simple usage to verify packages work
            response = requests.get("https://httpbin.org/json", timeout=30)
            arr = np.array([1, 2, 3])
            return f"Success! Status: {response.status_code}, Array sum: {np.sum(arr)}"
        except ImportError as e:
            return f"Import error: {e}"
        except Exception as e:
            return f"Other error: {e}"

    tool = create_tool_from_func(use_requests_and_numpy)
    # Add pip requirements to the tool - using more recent versions for E2B compatibility
    tool.pip_requirements = [
        PipRequirement(name="requests", version="2.31.0"),
        PipRequirement(name="numpy"),  # , version="1.26.0"),
    ]
    tool = await ToolManager().create_or_update_tool_async(tool, test_user)
    yield tool


@pytest.fixture
async def tool_with_broken_pip_requirements(test_user):
    def use_broken_package() -> str:
        """
        Function that requires a package with known compatibility issues.

        Returns:
            str: Should not reach here due to pip install failure.
        """
        try:
            import some_nonexistent_package  # This will fail during pip install

            return "This should not execute"
        except ImportError as e:
            return f"Import error: {e}"

    tool = create_tool_from_func(use_broken_package)
    # Add pip requirements that will fail in E2B environment
    tool.pip_requirements = [
        PipRequirement(name="numpy"),  # , version="1.24.0"),  # Known to have compatibility issues
        PipRequirement(name="nonexistent-package-12345"),  # This package doesn't exist
    ]
    tool = await ToolManager().create_or_update_tool_async(tool, test_user)
    yield tool


@pytest.fixture
async def core_memory_tools(test_user):
    """Create all base tools for testing."""
    tools = {}
    for func in [
        core_memory_replace,
        core_memory_append,
    ]:
        tool = create_tool_from_func(func)
        tool = await ToolManager().create_or_update_tool_async(tool, test_user)
        tools[func.__name__] = tool
    yield tools


@pytest.fixture
async def async_add_integers_tool(test_user):
    async def async_add(x: int, y: int) -> int:
        """
        Async function that adds two integers.

        Parameters:
            x (int): The first integer to add.
            y (int): The second integer to add.

        Returns:
            int: The result of adding x and y.
        """
        import asyncio

        # Add a small delay to simulate async work
        await asyncio.sleep(0.1)
        return x + y

    tool = create_tool_from_func(async_add)
    tool = await ToolManager().create_or_update_tool_async(tool, test_user)
    yield tool


@pytest.fixture
async def async_get_env_tool(test_user):
    async def async_get_env() -> str:
        """
        Async function that returns the secret word env variable.

        Returns:
            str: The secret word
        """
        import asyncio
        import os

        # Add a small delay to simulate async work
        await asyncio.sleep(0.1)
        secret_word = os.getenv("secret_word")
        print(secret_word)
        return secret_word

    tool = create_tool_from_func(async_get_env)
    tool = await ToolManager().create_or_update_tool_async(tool, test_user)
    yield tool


@pytest.fixture
async def async_stateful_tool(test_user):
    async def async_clear_memory(agent_state: "AgentState"):
        """Async function that clears the core memory"""
        import asyncio

        # Add a small delay to simulate async work
        await asyncio.sleep(0.1)
        agent_state.memory.get_block("human").value = ""
        agent_state.memory.get_block("persona").value = ""

    tool = create_tool_from_func(async_clear_memory)
    tool = await ToolManager().create_or_update_tool_async(tool, test_user)
    yield tool


@pytest.fixture
async def async_error_tool(test_user):
    async def async_error() -> str:
        """
        Async function that errors

        Returns:
            str: not important
        """
        import asyncio

        # Add some async work before erroring
        await asyncio.sleep(0.1)
        print("Going to error now")
        raise ValueError("This is an intentional async error!")

    tool = create_tool_from_func(async_error)
    tool = await ToolManager().create_or_update_tool_async(tool, test_user)
    yield tool


@pytest.fixture
async def async_list_tool(test_user):
    async def async_create_list() -> list:
        """Async function that returns a list"""
        import asyncio

        await asyncio.sleep(0.05)
        return [1, 2, 3, 4, 5]

    tool = create_tool_from_func(async_create_list)
    tool = await ToolManager().create_or_update_tool_async(tool, test_user)
    yield tool


@pytest.fixture
async def async_complex_tool(test_user):
    async def async_complex_computation(iterations: int = 3) -> dict:
        """
        Async function that performs complex computation with multiple awaits.

        Parameters:
            iterations (int): Number of iterations to perform.

        Returns:
            dict: Results of the computation.
        """
        import asyncio
        import time

        results = []
        start_time = time.time()

        for i in range(iterations):
            # Simulate async I/O
            await asyncio.sleep(0.1)
            results.append(i * 2)

        end_time = time.time()

        return {
            "results": results,
            "duration": end_time - start_time,
            "iterations": iterations,
            "average": sum(results) / len(results) if results else 0,
        }

    tool = create_tool_from_func(async_complex_computation)
    tool = await ToolManager().create_or_update_tool_async(tool, test_user)
    yield tool


# Removed custom event_loop fixture to avoid conflicts with pytest-asyncio


# Local sandbox tests


@pytest.mark.asyncio
@pytest.mark.local_sandbox
async def test_local_sandbox_default(disable_e2b_api_key, add_integers_tool, test_user):
    args = {"x": 10, "y": 5}

    # Mock and assert correct pathway was invoked
    with patch.object(AsyncToolSandboxLocal, "run") as mock_run:
        sandbox = AsyncToolSandboxLocal(add_integers_tool.name, args, user=test_user)
        await sandbox.run()
        mock_run.assert_called_once()

    # Run again to get actual response
    sandbox = AsyncToolSandboxLocal(add_integers_tool.name, args, user=test_user)
    result = await sandbox.run()
    assert result.func_return == args["x"] + args["y"]


@pytest.mark.asyncio
@pytest.mark.local_sandbox
async def test_local_sandbox_stateful_tool(disable_e2b_api_key, clear_core_memory_tool, test_user, agent_state):
    args = {}
    sandbox = AsyncToolSandboxLocal(clear_core_memory_tool.name, args, user=test_user)
    result = await sandbox.run(agent_state=agent_state)
    assert sandbox.inject_agent_state == True
    assert result.agent_state.memory.get_block("human").value == ""
    assert result.agent_state.memory.get_block("persona").value == ""
    assert result.func_return is None


@pytest.mark.asyncio
@pytest.mark.local_sandbox
async def test_local_sandbox_with_list_rv(disable_e2b_api_key, list_tool, test_user):
    sandbox = AsyncToolSandboxLocal(list_tool.name, {}, user=test_user)
    result = await sandbox.run()
    assert len(result.func_return) == 5


@pytest.mark.asyncio
@pytest.mark.local_sandbox
async def test_local_sandbox_env(disable_e2b_api_key, get_env_tool, test_user):
    manager = SandboxConfigManager()
    sandbox_dir = str(Path(__file__).parent / "test_tool_sandbox")
    config_create = SandboxConfigCreate(config=LocalSandboxConfig(sandbox_dir=sandbox_dir).model_dump())
    config = await manager.create_or_update_sandbox_config_async(config_create, test_user)

    key = "secret_word"
    long_random_string = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(20))
    await manager.create_sandbox_env_var_async(
        SandboxEnvironmentVariableCreate(key=key, value=long_random_string), sandbox_config_id=config.id, actor=test_user
    )

    sandbox = AsyncToolSandboxLocal(get_env_tool.name, {}, user=test_user)
    result = await sandbox.run()
    assert long_random_string in result.func_return


@pytest.mark.asyncio
@pytest.mark.local_sandbox
async def test_local_sandbox_per_agent_env(disable_e2b_api_key, get_env_tool, agent_state, test_user):
    manager = SandboxConfigManager()
    key = "secret_word"
    sandbox_dir = str(Path(__file__).parent / "test_tool_sandbox")
    config_create = SandboxConfigCreate(config=LocalSandboxConfig(sandbox_dir=sandbox_dir).model_dump())
    config = await manager.create_or_update_sandbox_config_async(config_create, test_user)

    wrong_val = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(20))
    await manager.create_sandbox_env_var_async(
        SandboxEnvironmentVariableCreate(key=key, value=wrong_val), sandbox_config_id=config.id, actor=test_user
    )

    correct_val = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(20))
    agent_state.secrets = [AgentEnvironmentVariable(key=key, value=correct_val, agent_id=agent_state.id)]

    sandbox = AsyncToolSandboxLocal(get_env_tool.name, {}, user=test_user)
    result = await sandbox.run(agent_state=agent_state)
    assert wrong_val not in result.func_return
    assert correct_val in result.func_return


@pytest.mark.asyncio
@pytest.mark.local_sandbox
async def test_local_sandbox_external_codebase_with_venv(
    disable_e2b_api_key, custom_test_sandbox_config, external_codebase_tool, test_user
):
    args = {"percentage": 10}
    sandbox = AsyncToolSandboxLocal(external_codebase_tool.name, args, user=test_user)
    result = await sandbox.run()
    assert result.func_return == "Price Adjustments:\nBurger: $8.99 -> $9.89\nFries: $2.99 -> $3.29\nSoda: $1.99 -> $2.19"
    assert "Hello World" in result.stdout[0]


@pytest.mark.asyncio
@pytest.mark.local_sandbox
async def test_local_sandbox_with_venv_and_warnings_does_not_error(
    disable_e2b_api_key, custom_test_sandbox_config, get_warning_tool, test_user
):
    sandbox = AsyncToolSandboxLocal(get_warning_tool.name, {}, user=test_user)
    result = await sandbox.run()
    assert result.func_return == "Hello World"


@pytest.mark.asyncio
@pytest.mark.e2b_sandbox
async def test_local_sandbox_with_venv_errors(disable_e2b_api_key, custom_test_sandbox_config, always_err_tool, test_user):
    sandbox = AsyncToolSandboxLocal(always_err_tool.name, {}, user=test_user)
    result = await sandbox.run()
    assert len(result.stdout) != 0
    assert "error" in result.stdout[0]
    assert len(result.stderr) != 0
    assert "ZeroDivisionError: This is an intentionally weird division!" in result.stderr[0]


@pytest.mark.asyncio
@pytest.mark.e2b_sandbox
async def test_local_sandbox_with_venv_pip_installs_basic(disable_e2b_api_key, cowsay_tool, test_user):
    manager = SandboxConfigManager()
    config_create = SandboxConfigCreate(
        config=LocalSandboxConfig(use_venv=True, pip_requirements=[PipRequirement(name="cowsay")]).model_dump()
    )
    config = await manager.create_or_update_sandbox_config_async(config_create, test_user)

    key = "secret_word"
    long_random_string = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(20))
    await manager.create_sandbox_env_var_async(
        SandboxEnvironmentVariableCreate(key=key, value=long_random_string), sandbox_config_id=config.id, actor=test_user
    )

    sandbox = AsyncToolSandboxLocal(cowsay_tool.name, {}, user=test_user, force_recreate_venv=True)
    result = await sandbox.run()
    assert long_random_string in result.stdout[0]


@pytest.mark.asyncio
@pytest.mark.local_sandbox
async def test_local_sandbox_with_tool_pip_requirements(disable_e2b_api_key, tool_with_pip_requirements, test_user):
    """Test that local sandbox installs tool-specific pip requirements."""
    manager = SandboxConfigManager()
    sandbox_dir = str(Path(__file__).parent / "test_tool_sandbox")
    config_create = SandboxConfigCreate(config=LocalSandboxConfig(sandbox_dir=sandbox_dir, use_venv=True).model_dump())
    await manager.create_or_update_sandbox_config_async(config_create, test_user)

    sandbox = AsyncToolSandboxLocal(
        tool_with_pip_requirements.name, {}, user=test_user, tool_object=tool_with_pip_requirements, force_recreate_venv=True
    )
    result = await sandbox.run()

    # Should succeed since tool pip requirements were installed
    assert "Success!" in result.func_return
    assert "Status: 200" in result.func_return
    assert "Array sum: 6" in result.func_return


@pytest.mark.asyncio
@pytest.mark.local_sandbox
async def test_local_sandbox_with_mixed_pip_requirements(disable_e2b_api_key, tool_with_pip_requirements, test_user):
    """Test that local sandbox installs both sandbox and tool pip requirements."""
    manager = SandboxConfigManager()
    sandbox_dir = str(Path(__file__).parent / "test_tool_sandbox")

    # Add sandbox-level pip requirement
    config_create = SandboxConfigCreate(
        config=LocalSandboxConfig(sandbox_dir=sandbox_dir, use_venv=True, pip_requirements=[PipRequirement(name="cowsay")]).model_dump()
    )
    await manager.create_or_update_sandbox_config_async(config_create, test_user)

    sandbox = AsyncToolSandboxLocal(
        tool_with_pip_requirements.name, {}, user=test_user, tool_object=tool_with_pip_requirements, force_recreate_venv=True
    )
    result = await sandbox.run()

    # Should succeed since both sandbox and tool pip requirements were installed
    assert "Success!" in result.func_return
    assert "Status: 200" in result.func_return
    assert "Array sum: 6" in result.func_return


@pytest.mark.asyncio
@pytest.mark.e2b_sandbox
async def test_local_sandbox_with_venv_pip_installs_with_update(disable_e2b_api_key, cowsay_tool, test_user):
    manager = SandboxConfigManager()
    config_create = SandboxConfigCreate(config=LocalSandboxConfig(use_venv=True).model_dump())
    config = await manager.create_or_update_sandbox_config_async(config_create, test_user)

    key = "secret_word"
    long_random_string = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(20))
    await manager.create_sandbox_env_var_async(
        SandboxEnvironmentVariableCreate(key=key, value=long_random_string), sandbox_config_id=config.id, actor=test_user
    )

    sandbox = AsyncToolSandboxLocal(cowsay_tool.name, {}, user=test_user, force_recreate_venv=True)
    result = await sandbox.run()
    assert len(result.stdout) == 0
    assert "No module named 'cowsay'" in result.stderr[0]

    config_create = SandboxConfigCreate(
        config=LocalSandboxConfig(use_venv=True, pip_requirements=[PipRequirement(name="cowsay")]).model_dump()
    )
    await manager.create_or_update_sandbox_config_async(config_create, test_user)

    sandbox = AsyncToolSandboxLocal(cowsay_tool.name, {}, user=test_user, force_recreate_venv=False)
    result = await sandbox.run()
    assert long_random_string in result.stdout[0]


# E2B sandbox tests


@pytest.mark.asyncio
@pytest.mark.e2b_sandbox
async def test_e2b_sandbox_default(check_e2b_key_is_set, add_integers_tool, test_user):
    args = {"x": 10, "y": 5}

    # Mock and assert correct pathway was invoked
    with patch.object(AsyncToolSandboxE2B, "run") as mock_run:
        sandbox = AsyncToolSandboxE2B(add_integers_tool.name, args, user=test_user)
        await sandbox.run()
        mock_run.assert_called_once()

    # Run again to get actual response
    sandbox = AsyncToolSandboxE2B(add_integers_tool.name, args, user=test_user)
    result = await sandbox.run()
    assert int(result.func_return) == args["x"] + args["y"]


@pytest.mark.asyncio
@pytest.mark.e2b_sandbox
async def test_e2b_sandbox_pip_installs(check_e2b_key_is_set, cowsay_tool, test_user):
    manager = SandboxConfigManager()
    config_create = SandboxConfigCreate(config=E2BSandboxConfig(pip_requirements=["cowsay"]).model_dump())
    config = await manager.create_or_update_sandbox_config_async(config_create, test_user)

    key = "secret_word"
    long_random_string = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(20))
    await manager.create_sandbox_env_var_async(
        SandboxEnvironmentVariableCreate(key=key, value=long_random_string),
        sandbox_config_id=config.id,
        actor=test_user,
    )

    sandbox = AsyncToolSandboxE2B(cowsay_tool.name, {}, user=test_user)
    result = await sandbox.run()
    assert long_random_string in result.stdout[0]


@pytest.mark.asyncio
@pytest.mark.e2b_sandbox
async def test_e2b_sandbox_stateful_tool(check_e2b_key_is_set, clear_core_memory_tool, test_user, agent_state):
    sandbox = AsyncToolSandboxE2B(clear_core_memory_tool.name, {}, user=test_user)
    result = await sandbox.run(agent_state=agent_state)
    assert result.agent_state.memory.get_block("human").value == ""
    assert result.agent_state.memory.get_block("persona").value == ""
    assert result.func_return is None


@pytest.mark.asyncio
@pytest.mark.e2b_sandbox
async def test_e2b_sandbox_inject_env_var_existing_sandbox(check_e2b_key_is_set, get_env_tool, test_user):
    manager = SandboxConfigManager()
    config_create = SandboxConfigCreate(config=E2BSandboxConfig().model_dump())
    config = await manager.create_or_update_sandbox_config_async(config_create, test_user)

    sandbox = AsyncToolSandboxE2B(get_env_tool.name, {}, user=test_user)
    result = await sandbox.run()
    assert result.func_return is None

    key = "secret_word"
    long_random_string = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(20))
    await manager.create_sandbox_env_var_async(
        SandboxEnvironmentVariableCreate(key=key, value=long_random_string),
        sandbox_config_id=config.id,
        actor=test_user,
    )

    sandbox = AsyncToolSandboxE2B(get_env_tool.name, {}, user=test_user)
    result = await sandbox.run()
    assert long_random_string in result.func_return


@pytest.mark.asyncio
@pytest.mark.e2b_sandbox
async def test_e2b_sandbox_per_agent_env(check_e2b_key_is_set, get_env_tool, agent_state, test_user):
    manager = SandboxConfigManager()
    key = "secret_word"
    wrong_val = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(20))
    correct_val = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(20))

    config_create = SandboxConfigCreate(config=LocalSandboxConfig().model_dump())
    config = await manager.create_or_update_sandbox_config_async(config_create, test_user)
    await manager.create_sandbox_env_var_async(
        SandboxEnvironmentVariableCreate(key=key, value=wrong_val),
        sandbox_config_id=config.id,
        actor=test_user,
    )

    agent_state.secrets = [AgentEnvironmentVariable(key=key, value=correct_val, agent_id=agent_state.id)]

    sandbox = AsyncToolSandboxE2B(get_env_tool.name, {}, user=test_user)
    result = await sandbox.run(agent_state=agent_state)
    assert wrong_val not in result.func_return
    assert correct_val in result.func_return


@pytest.mark.asyncio
@pytest.mark.e2b_sandbox
async def test_e2b_sandbox_with_list_rv(check_e2b_key_is_set, list_tool, test_user):
    sandbox = AsyncToolSandboxE2B(list_tool.name, {}, user=test_user)
    result = await sandbox.run()
    assert len(result.func_return) == 5


@pytest.mark.asyncio
@pytest.mark.e2b_sandbox
async def test_e2b_sandbox_with_tool_pip_requirements(check_e2b_key_is_set, tool_with_pip_requirements, test_user):
    """Test that E2B sandbox installs tool-specific pip requirements."""
    manager = SandboxConfigManager()
    config_create = SandboxConfigCreate(config=E2BSandboxConfig().model_dump())
    await manager.create_or_update_sandbox_config_async(config_create, test_user)

    sandbox = AsyncToolSandboxE2B(tool_with_pip_requirements.name, {}, user=test_user, tool_object=tool_with_pip_requirements)
    result = await sandbox.run()

    # Should succeed since tool pip requirements were installed
    assert "Success!" in result.func_return
    assert "Status: 200" in result.func_return
    assert "Array sum: 6" in result.func_return


@pytest.mark.asyncio
@pytest.mark.e2b_sandbox
async def test_e2b_sandbox_with_mixed_pip_requirements(check_e2b_key_is_set, tool_with_pip_requirements, test_user):
    """Test that E2B sandbox installs both sandbox and tool pip requirements."""
    manager = SandboxConfigManager()

    # Add sandbox-level pip requirement
    config_create = SandboxConfigCreate(config=E2BSandboxConfig(pip_requirements=["cowsay"]).model_dump())
    await manager.create_or_update_sandbox_config_async(config_create, test_user)

    sandbox = AsyncToolSandboxE2B(tool_with_pip_requirements.name, {}, user=test_user, tool_object=tool_with_pip_requirements)
    result = await sandbox.run()

    # Should succeed since both sandbox and tool pip requirements were installed
    assert "Success!" in result.func_return
    assert "Status: 200" in result.func_return
    assert "Array sum: 6" in result.func_return


@pytest.mark.asyncio
@pytest.mark.e2b_sandbox
async def test_e2b_sandbox_with_broken_tool_pip_requirements_error_handling(
    check_e2b_key_is_set, tool_with_broken_pip_requirements, test_user
):
    """Test that E2B sandbox provides informative error messages for broken tool pip requirements."""
    manager = SandboxConfigManager()
    config_create = SandboxConfigCreate(config=E2BSandboxConfig().model_dump())
    await manager.create_or_update_sandbox_config_async(config_create, test_user)

    sandbox = AsyncToolSandboxE2B(tool_with_broken_pip_requirements.name, {}, user=test_user, tool_object=tool_with_broken_pip_requirements)

    # Should raise a RuntimeError with informative message
    with pytest.raises(RuntimeError) as exc_info:
        await sandbox.run()

    error_message = str(exc_info.value)
    print(error_message)

    # Verify the error message contains helpful information
    assert "Failed to install tool pip requirement" in error_message
    assert "use_broken_package" in error_message  # Tool name
    assert "E2B sandbox" in error_message
    assert "package version incompatibility" in error_message
    assert "Consider updating the package version or removing the version constraint" in error_message

    # Should mention one of the problematic packages
    assert "numpy==1.24.0" in error_message or "nonexistent-package-12345" in error_message


# Async function tests


@pytest.mark.asyncio
async def test_async_function_detection(add_integers_tool, async_add_integers_tool, test_user):
    """Test that async function detection works correctly"""
    # Test sync function detection
    sync_sandbox = AsyncToolSandboxE2B(add_integers_tool.name, {}, test_user, tool_object=add_integers_tool)
    await sync_sandbox._init_async()
    assert not sync_sandbox.is_async_function

    # Test async function detection
    async_sandbox = AsyncToolSandboxE2B(async_add_integers_tool.name, {}, test_user, tool_object=async_add_integers_tool)
    await async_sandbox._init_async()
    assert async_sandbox.is_async_function


@pytest.mark.asyncio
async def test_async_template_selection(add_integers_tool, async_add_integers_tool, test_user):
    """Test that correct templates are selected for sync vs async functions"""
    # Test sync function uses regular template
    sync_sandbox = AsyncToolSandboxE2B(add_integers_tool.name, {}, test_user, tool_object=add_integers_tool)
    sync_script = await sync_sandbox.generate_execution_script(agent_state=None)
    print("=== SYNC SCRIPT ===")
    print(sync_script)
    print("=== END SYNC SCRIPT ===")
    assert "import asyncio" not in sync_script
    assert "asyncio.run" not in sync_script

    # Test async function uses async template
    async_sandbox = AsyncToolSandboxE2B(async_add_integers_tool.name, {}, test_user, tool_object=async_add_integers_tool)
    async_script = await async_sandbox.generate_execution_script(agent_state=None)
    print("=== ASYNC SCRIPT ===")
    print(async_script)
    print("=== END ASYNC SCRIPT ===")
    assert "import asyncio" in async_script
    assert "await _async_wrapper()" in async_script  # E2B uses top-level await
    assert "_async_wrapper" in async_script


@pytest.mark.asyncio
@pytest.mark.local_sandbox
async def test_local_sandbox_async_function_execution(disable_e2b_api_key, async_add_integers_tool, test_user):
    """Test that async functions execute correctly in local sandbox"""
    args = {"x": 15, "y": 25}

    sandbox = AsyncToolSandboxLocal(async_add_integers_tool.name, args, user=test_user)
    result = await sandbox.run()
    assert result.func_return == args["x"] + args["y"]


@pytest.mark.asyncio
@pytest.mark.e2b_sandbox
async def test_e2b_sandbox_async_function_execution(check_e2b_key_is_set, async_add_integers_tool, test_user):
    """Test that async functions execute correctly in E2B sandbox"""
    args = {"x": 20, "y": 30}

    sandbox = AsyncToolSandboxE2B(async_add_integers_tool.name, args, user=test_user)
    result = await sandbox.run()
    assert int(result.func_return) == args["x"] + args["y"]


@pytest.mark.asyncio
@pytest.mark.local_sandbox
async def test_local_sandbox_async_complex_computation(disable_e2b_api_key, async_complex_tool, test_user):
    """Test complex async computation with multiple awaits in local sandbox"""
    args = {"iterations": 2}

    sandbox = AsyncToolSandboxLocal(async_complex_tool.name, args, user=test_user)
    result = await sandbox.run()

    assert isinstance(result.func_return, dict)
    assert result.func_return["results"] == [0, 2]
    assert result.func_return["iterations"] == 2
    assert result.func_return["average"] == 1.0
    assert result.func_return["duration"] > 0.15  # Should take at least 0.2s due to sleep


@pytest.mark.asyncio
@pytest.mark.e2b_sandbox
async def test_e2b_sandbox_async_complex_computation(check_e2b_key_is_set, async_complex_tool, test_user):
    """Test complex async computation with multiple awaits in E2B sandbox"""
    args = {"iterations": 2}

    sandbox = AsyncToolSandboxE2B(async_complex_tool.name, args, user=test_user)
    result = await sandbox.run()

    func_return = result.func_return
    assert isinstance(func_return, dict)
    assert func_return["results"] == [0, 2]
    assert func_return["iterations"] == 2
    assert func_return["average"] == 1.0
    assert func_return["duration"] > 0.15


@pytest.mark.asyncio
@pytest.mark.local_sandbox
async def test_local_sandbox_async_list_return(disable_e2b_api_key, async_list_tool, test_user):
    """Test async function returning list in local sandbox"""
    sandbox = AsyncToolSandboxLocal(async_list_tool.name, {}, user=test_user)
    result = await sandbox.run()
    assert result.func_return == [1, 2, 3, 4, 5]


@pytest.mark.asyncio
@pytest.mark.e2b_sandbox
async def test_e2b_sandbox_async_list_return(check_e2b_key_is_set, async_list_tool, test_user):
    """Test async function returning list in E2B sandbox"""
    sandbox = AsyncToolSandboxE2B(async_list_tool.name, {}, user=test_user)
    result = await sandbox.run()
    assert result.func_return == [1, 2, 3, 4, 5]


@pytest.mark.asyncio
@pytest.mark.local_sandbox
async def test_local_sandbox_async_with_env_vars(disable_e2b_api_key, async_get_env_tool, test_user):
    """Test async function with environment variables in local sandbox"""
    manager = SandboxConfigManager()

    # Create custom local sandbox config
    sandbox_dir = str(Path(__file__).parent / "test_tool_sandbox")
    config_create = SandboxConfigCreate(config=LocalSandboxConfig(sandbox_dir=sandbox_dir).model_dump())
    config = await manager.create_or_update_sandbox_config_async(config_create, test_user)

    # Create environment variablecreate_user_async
    key = "secret_word"
    test_value = "async_local_test_value_789"
    await manager.create_sandbox_env_var_async(
        SandboxEnvironmentVariableCreate(key=key, value=test_value), sandbox_config_id=config.id, actor=test_user
    )

    sandbox = AsyncToolSandboxLocal(async_get_env_tool.name, {}, user=test_user)
    result = await sandbox.run()

    assert test_value in result.func_return


@pytest.mark.asyncio
@pytest.mark.e2b_sandbox
async def test_e2b_sandbox_async_with_env_vars(check_e2b_key_is_set, async_get_env_tool, test_user):
    """Test async function with environment variables in E2B sandbox"""
    manager = SandboxConfigManager()
    config_create = SandboxConfigCreate(config=E2BSandboxConfig().model_dump())
    config = await manager.create_or_update_sandbox_config_async(config_create, test_user)

    # Create environment variable
    key = "secret_word"
    test_value = "async_e2b_test_value_456"
    await manager.create_sandbox_env_var_async(
        SandboxEnvironmentVariableCreate(key=key, value=test_value), sandbox_config_id=config.id, actor=test_user
    )

    sandbox = AsyncToolSandboxE2B(async_get_env_tool.name, {}, user=test_user)
    result = await sandbox.run()

    assert test_value in result.func_return


@pytest.mark.asyncio
@pytest.mark.local_sandbox
async def test_local_sandbox_async_with_agent_state(disable_e2b_api_key, async_stateful_tool, test_user, agent_state):
    """Test async function with agent state in local sandbox"""
    sandbox = AsyncToolSandboxLocal(async_stateful_tool.name, {}, user=test_user)
    result = await sandbox.run(agent_state=agent_state)

    assert result.agent_state is not None
    assert result.agent_state.memory.get_block("human").value == ""
    assert result.agent_state.memory.get_block("persona").value == ""
    assert result.func_return is None


@pytest.mark.asyncio
@pytest.mark.e2b_sandbox
async def test_e2b_sandbox_async_with_agent_state(check_e2b_key_is_set, async_stateful_tool, test_user, agent_state):
    """Test async function with agent state in E2B sandbox"""
    sandbox = AsyncToolSandboxE2B(async_stateful_tool.name, {}, user=test_user)
    result = await sandbox.run(agent_state=agent_state)

    assert result.agent_state.memory.get_block("human").value == ""
    assert result.agent_state.memory.get_block("persona").value == ""
    assert result.func_return is None


@pytest.mark.asyncio
@pytest.mark.local_sandbox
async def test_local_sandbox_async_error_handling(disable_e2b_api_key, async_error_tool, test_user):
    """Test async function error handling in local sandbox"""
    sandbox = AsyncToolSandboxLocal(async_error_tool.name, {}, user=test_user)
    result = await sandbox.run()

    # Check that error was captured
    assert len(result.stdout) != 0, "stdout not empty"
    assert "error" in result.stdout[0], "stdout contains printed string"
    assert len(result.stderr) != 0, "stderr not empty"
    assert "ValueError: This is an intentional async error!" in result.stderr[0], "stderr contains expected error"


@pytest.mark.asyncio
@pytest.mark.e2b_sandbox
async def test_e2b_sandbox_async_error_handling(check_e2b_key_is_set, async_error_tool, test_user):
    """Test async function error handling in E2B sandbox"""
    sandbox = AsyncToolSandboxE2B(async_error_tool.name, {}, user=test_user)
    result = await sandbox.run()

    # Check that error was captured
    assert len(result.stdout) != 0, "stdout not empty"
    assert "error" in result.stdout[0], "stdout contains printed string"
    assert len(result.stderr) != 0, "stderr not empty"
    assert "ValueError: This is an intentional async error!" in result.stderr[0], "stderr contains expected error"


@pytest.mark.asyncio
@pytest.mark.local_sandbox
async def test_local_sandbox_async_per_agent_env(disable_e2b_api_key, async_get_env_tool, agent_state, test_user):
    """Test async function with per-agent environment variables in local sandbox"""
    manager = SandboxConfigManager()
    key = "secret_word"
    sandbox_dir = str(Path(__file__).parent / "test_tool_sandbox")
    config_create = SandboxConfigCreate(config=LocalSandboxConfig(sandbox_dir=sandbox_dir).model_dump())
    config = await manager.create_or_update_sandbox_config_async(config_create, test_user)

    wrong_val = "wrong_async_local_value"
    await manager.create_sandbox_env_var_async(
        SandboxEnvironmentVariableCreate(key=key, value=wrong_val), sandbox_config_id=config.id, actor=test_user
    )

    correct_val = "correct_async_local_value"
    agent_state.secrets = [AgentEnvironmentVariable(key=key, value=correct_val, agent_id=agent_state.id)]

    sandbox = AsyncToolSandboxLocal(async_get_env_tool.name, {}, user=test_user)
    result = await sandbox.run(agent_state=agent_state)
    assert wrong_val not in result.func_return
    assert correct_val in result.func_return


@pytest.mark.asyncio
@pytest.mark.e2b_sandbox
async def test_e2b_sandbox_async_per_agent_env(check_e2b_key_is_set, async_get_env_tool, agent_state, test_user):
    """Test async function with per-agent environment variables in E2B sandbox"""
    manager = SandboxConfigManager()
    key = "secret_word"
    wrong_val = "wrong_async_e2b_value"
    correct_val = "correct_async_e2b_value"

    config_create = SandboxConfigCreate(config=LocalSandboxConfig().model_dump())
    config = await manager.create_or_update_sandbox_config_async(config_create, test_user)
    await manager.create_sandbox_env_var_async(
        SandboxEnvironmentVariableCreate(key=key, value=wrong_val),
        sandbox_config_id=config.id,
        actor=test_user,
    )

    agent_state.secrets = [AgentEnvironmentVariable(key=key, value=correct_val, agent_id=agent_state.id)]

    sandbox = AsyncToolSandboxE2B(async_get_env_tool.name, {}, user=test_user)
    result = await sandbox.run(agent_state=agent_state)
    assert wrong_val not in result.func_return
    assert correct_val in result.func_return
