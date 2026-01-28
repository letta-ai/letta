"""Integration tests for TypeScript tool execution in E2B sandbox."""

import uuid

import pytest
from sqlalchemy import delete

from letta.config import LettaConfig
from letta.orm.sandbox_config import SandboxConfig, SandboxEnvironmentVariable
from letta.schemas.enums import ToolType
from letta.schemas.npm_requirement import NpmRequirement
from letta.schemas.organization import Organization
from letta.schemas.tool import Tool as PydanticTool, ToolCreate
from letta.schemas.user import User
from letta.server.server import SyncServer
from letta.services.organization_manager import OrganizationManager
from letta.services.tool_executor.tool_execution_sandbox import ToolExecutionSandbox
from letta.services.tool_manager import ToolManager
from letta.services.tool_sandbox.e2b_sandbox import AsyncToolSandboxE2B
from letta.services.user_manager import UserManager

# Constants
namespace = uuid.NAMESPACE_DNS
org_name = str(uuid.uuid5(namespace, "test-typescript-tool-execution-org"))
user_name = str(uuid.uuid5(namespace, "test-typescript-tool-execution-user"))


# Fixtures
@pytest.fixture(scope="module")
def server():
    """Creates a SyncServer instance for testing."""
    config = LettaConfig.load()
    config.save()
    server = SyncServer(init_with_default_org_and_user=True)
    yield server


@pytest.fixture(autouse=True)
async def clear_tables():
    """Fixture to clear sandbox tables before each test."""
    from letta.server.db import db_registry

    async with db_registry.async_session() as session:
        await session.execute(delete(SandboxEnvironmentVariable))
        await session.execute(delete(SandboxConfig))


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


# TypeScript Tool Fixtures


@pytest.fixture
async def add_numbers_ts_tool(test_user):
    """Simple TypeScript tool that adds two numbers."""
    tool = PydanticTool(
        name="add_numbers",
        description="Add two numbers together",
        source_code="""
export function add_numbers(x: number, y: number): number {
    return x + y;
}
""",
        source_type="typescript",
        tool_type=ToolType.CUSTOM,
        json_schema={
            "name": "add_numbers",
            "description": "Add two numbers together",
            "parameters": {
                "type": "object",
                "properties": {
                    "x": {"type": "number", "description": "First number"},
                    "y": {"type": "number", "description": "Second number"},
                },
                "required": ["x", "y"],
            },
        },
    )
    tool = await ToolManager().create_or_update_tool_async(tool, test_user)
    yield tool


@pytest.fixture
async def string_concat_ts_tool(test_user):
    """TypeScript tool that concatenates strings."""
    tool = PydanticTool(
        name="concat_strings",
        description="Concatenate two strings",
        source_code="""
export function concat_strings(a: string, b: string): string {
    return a + b;
}
""",
        source_type="typescript",
        tool_type=ToolType.CUSTOM,
        json_schema={
            "name": "concat_strings",
            "description": "Concatenate two strings",
            "parameters": {
                "type": "object",
                "properties": {
                    "a": {"type": "string", "description": "First string"},
                    "b": {"type": "string", "description": "Second string"},
                },
                "required": ["a", "b"],
            },
        },
    )
    tool = await ToolManager().create_or_update_tool_async(tool, test_user)
    yield tool


@pytest.fixture
async def async_ts_tool(test_user):
    """Async TypeScript tool."""
    tool = PydanticTool(
        name="async_delay",
        description="An async function that returns after a small delay",
        source_code="""
export async function async_delay(message: string): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 100));
    return `Delayed: ${message}`;
}
""",
        source_type="typescript",
        tool_type=ToolType.CUSTOM,
        json_schema={
            "name": "async_delay",
            "description": "An async function that returns after a small delay",
            "parameters": {
                "type": "object",
                "properties": {
                    "message": {"type": "string", "description": "Message to return"},
                },
                "required": ["message"],
            },
        },
    )
    tool = await ToolManager().create_or_update_tool_async(tool, test_user)
    yield tool


@pytest.fixture
async def error_ts_tool(test_user):
    """TypeScript tool that throws an error."""
    tool = PydanticTool(
        name="throw_error",
        description="A function that always throws an error",
        source_code="""
export function throw_error(): never {
    throw new Error("This is an intentional test error");
}
""",
        source_type="typescript",
        tool_type=ToolType.CUSTOM,
        json_schema={
            "name": "throw_error",
            "description": "A function that always throws an error",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    )
    tool = await ToolManager().create_or_update_tool_async(tool, test_user)
    yield tool


@pytest.fixture
async def array_ts_tool(test_user):
    """TypeScript tool that works with arrays."""
    tool = PydanticTool(
        name="sum_array",
        description="Sum all numbers in an array",
        source_code="""
export function sum_array(numbers: number[]): number {
    return numbers.reduce((acc, curr) => acc + curr, 0);
}
""",
        source_type="typescript",
        tool_type=ToolType.CUSTOM,
        json_schema={
            "name": "sum_array",
            "description": "Sum all numbers in an array",
            "parameters": {
                "type": "object",
                "properties": {
                    "numbers": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "Array of numbers to sum",
                    },
                },
                "required": ["numbers"],
            },
        },
    )
    tool = await ToolManager().create_or_update_tool_async(tool, test_user)
    yield tool


@pytest.fixture
async def object_ts_tool(test_user):
    """TypeScript tool that works with objects."""
    tool = PydanticTool(
        name="get_name",
        description="Extract name from a person object",
        source_code="""
export function get_name(person: { firstName: string; lastName: string }): string {
    return `${person.firstName} ${person.lastName}`;
}
""",
        source_type="typescript",
        tool_type=ToolType.CUSTOM,
        json_schema={
            "name": "get_name",
            "description": "Extract name from a person object",
            "parameters": {
                "type": "object",
                "properties": {
                    "person": {
                        "type": "object",
                        "properties": {
                            "firstName": {"type": "string"},
                            "lastName": {"type": "string"},
                        },
                        "required": ["firstName", "lastName"],
                        "description": "Person object with name fields",
                    },
                },
                "required": ["person"],
            },
        },
    )
    tool = await ToolManager().create_or_update_tool_async(tool, test_user)
    yield tool


# Tests


class TestTypescriptToolValidation:
    """Tests for TypeScript tool validation."""

    def test_typescript_tool_requires_json_schema(self):
        """Test that TypeScript tools require explicit json_schema."""
        with pytest.raises(ValueError, match="TypeScript tools require an explicit json_schema"):
            ToolCreate(
                source_code='export function test(): string { return "hello"; }',
                source_type="typescript",
                # Deliberately not providing json_schema
            )

    def test_typescript_tool_with_schema_is_valid(self, test_user):
        """Test that TypeScript tools with json_schema are valid."""
        tool_create = ToolCreate(
            source_code='export function test(): string { return "hello"; }',
            source_type="typescript",
            json_schema={
                "name": "test",
                "description": "Test function",
                "parameters": {"type": "object", "properties": {}, "required": []},
            },
        )
        assert tool_create.source_type == "typescript"
        assert tool_create.json_schema is not None

    def test_python_tool_without_schema_is_valid(self):
        """Test that Python tools can still be created without explicit json_schema."""
        tool_create = ToolCreate(
            source_code='def test(): return "hello"',
            source_type="python",
            # No json_schema - should be auto-generated for Python
        )
        assert tool_create.source_type == "python"

    @pytest.mark.asyncio
    async def test_typescript_tool_does_not_inject_agent_state(self, test_user):
        """Test that TypeScript tools do not support agent_state injection (legacy Python feature)."""
        # Create a TypeScript tool that has 'agent_state' in its parameters
        # (this shouldn't happen in practice, but we test the sandbox behavior)
        tool = PydanticTool(
            name="test_no_agent_state",
            description="Test tool",
            source_code="""
export function test_no_agent_state(x: number): number {
    return x;
}
""",
            source_type="typescript",
            tool_type=ToolType.CUSTOM,
            json_schema={
                "name": "test_no_agent_state",
                "description": "Test tool",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "x": {"type": "number"},
                    },
                    "required": ["x"],
                },
            },
        )
        tool = await ToolManager().create_or_update_tool_async(tool, test_user)

        sandbox = AsyncToolSandboxE2B(
            tool_name=tool.name,
            args={"x": 42},
            user=test_user,
            tool_id=tool.id,
            tool_object=tool,
        )

        # Initialize the sandbox to trigger the _init_async method
        await sandbox._init_async()

        # Verify agent_state injection is disabled for TypeScript tools
        assert sandbox.inject_agent_state is False


@pytest.mark.e2b_sandbox
class TestTypescriptToolExecution:
    """Tests for TypeScript tool execution in E2B sandbox."""

    @pytest.mark.asyncio
    async def test_e2b_typescript_add_numbers(self, check_e2b_key_is_set, add_numbers_ts_tool, test_user):
        """Test basic TypeScript tool execution with number arguments."""
        sandbox = AsyncToolSandboxE2B(
            tool_name=add_numbers_ts_tool.name,
            args={"x": 10, "y": 5},
            user=test_user,
            tool_id=add_numbers_ts_tool.id,
            tool_object=add_numbers_ts_tool,
        )
        result = await sandbox.run()

        assert result.status == "success"
        assert result.func_return == 15

    @pytest.mark.asyncio
    async def test_e2b_typescript_string_concat(self, check_e2b_key_is_set, string_concat_ts_tool, test_user):
        """Test TypeScript tool execution with string arguments."""
        sandbox = AsyncToolSandboxE2B(
            tool_name=string_concat_ts_tool.name,
            args={"a": "Hello, ", "b": "World!"},
            user=test_user,
            tool_id=string_concat_ts_tool.id,
            tool_object=string_concat_ts_tool,
        )
        result = await sandbox.run()

        assert result.status == "success"
        assert result.func_return == "Hello, World!"

    @pytest.mark.asyncio
    async def test_e2b_typescript_async_function(self, check_e2b_key_is_set, async_ts_tool, test_user):
        """Test async TypeScript tool execution."""
        sandbox = AsyncToolSandboxE2B(
            tool_name=async_ts_tool.name,
            args={"message": "test"},
            user=test_user,
            tool_id=async_ts_tool.id,
            tool_object=async_ts_tool,
        )
        result = await sandbox.run()

        assert result.status == "success"
        assert result.func_return == "Delayed: test"

    @pytest.mark.asyncio
    async def test_e2b_typescript_error_handling(self, check_e2b_key_is_set, error_ts_tool, test_user):
        """Test TypeScript tool error handling."""
        sandbox = AsyncToolSandboxE2B(
            tool_name=error_ts_tool.name,
            args={},
            user=test_user,
            tool_id=error_ts_tool.id,
            tool_object=error_ts_tool,
        )
        result = await sandbox.run()

        assert result.status == "error"
        assert "error" in result.func_return.lower() or "Error" in str(result.stderr)

    @pytest.mark.asyncio
    async def test_e2b_typescript_array_argument(self, check_e2b_key_is_set, array_ts_tool, test_user):
        """Test TypeScript tool with array argument."""
        sandbox = AsyncToolSandboxE2B(
            tool_name=array_ts_tool.name,
            args={"numbers": [1, 2, 3, 4, 5]},
            user=test_user,
            tool_id=array_ts_tool.id,
            tool_object=array_ts_tool,
        )
        result = await sandbox.run()

        assert result.status == "success"
        assert result.func_return == 15

    @pytest.mark.asyncio
    async def test_e2b_typescript_object_argument(self, check_e2b_key_is_set, object_ts_tool, test_user):
        """Test TypeScript tool with object argument."""
        sandbox = AsyncToolSandboxE2B(
            tool_name=object_ts_tool.name,
            args={"person": {"firstName": "John", "lastName": "Doe"}},
            user=test_user,
            tool_id=object_ts_tool.id,
            tool_object=object_ts_tool,
        )
        result = await sandbox.run()

        assert result.status == "success"
        assert result.func_return == "John Doe"


@pytest.mark.e2b_sandbox
class TestTypescriptToolWithLettaClient:
    """Tests for TypeScript tools with Letta client integration."""

    @pytest.mark.asyncio
    async def test_e2b_typescript_letta_client_available(self, check_e2b_key_is_set, test_user):
        """Test that the Letta client is available in TypeScript sandbox (as null when no API key)."""
        # Create a tool that checks if the client variable exists
        tool = PydanticTool(
            name="check_client",
            description="Check if Letta client is available",
            source_code="""
export function check_client(): string {
    // client is injected by the sandbox - it will be null if no API key
    return client === null ? "client is null (no API key)" : "client is available";
}
""",
            source_type="typescript",
            tool_type=ToolType.CUSTOM,
            json_schema={
                "name": "check_client",
                "description": "Check if Letta client is available",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": [],
                },
            },
        )
        tool = await ToolManager().create_or_update_tool_async(tool, test_user)

        sandbox = AsyncToolSandboxE2B(
            tool_name=tool.name,
            args={},
            user=test_user,
            tool_id=tool.id,
            tool_object=tool,
        )
        result = await sandbox.run()

        assert result.status == "success"
        # Without LETTA_API_KEY, client should be null
        assert "client" in result.func_return.lower()


@pytest.mark.e2b_sandbox
class TestTypescriptToolWithNpmPackages:
    """Tests for TypeScript tools with npm package dependencies."""

    @pytest.mark.asyncio
    async def test_e2b_typescript_with_npm_package(self, check_e2b_key_is_set, test_user):
        """Test TypeScript tool execution with npm package dependency."""
        # Create a tool that uses the 'lodash' npm package
        tool = PydanticTool(
            name="lodash_capitalize",
            description="Capitalize a string using lodash",
            source_code="""
import _ from 'lodash';

export function lodash_capitalize(text: string): string {
    return _.capitalize(text);
}
""",
            source_type="typescript",
            tool_type=ToolType.CUSTOM,
            npm_requirements=[NpmRequirement(name="lodash"), NpmRequirement(name="@types/lodash")],
            json_schema={
                "name": "lodash_capitalize",
                "description": "Capitalize a string using lodash",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "text": {"type": "string", "description": "Text to capitalize"},
                    },
                    "required": ["text"],
                },
            },
        )
        tool = await ToolManager().create_or_update_tool_async(tool, test_user)

        sandbox = AsyncToolSandboxE2B(
            tool_name=tool.name,
            args={"text": "hello world"},
            user=test_user,
            tool_id=tool.id,
            tool_object=tool,
        )
        result = await sandbox.run()

        assert result.status == "success"
        assert result.func_return == "Hello world"


class TestTypescriptGeneratorUnit:
    """Unit tests for TypeScript code generation."""

    def test_convert_param_to_ts_value_string(self):
        """Test string parameter conversion."""
        from letta.services.tool_sandbox.typescript_generator import convert_param_to_ts_value

        assert convert_param_to_ts_value("string", "hello") == '"hello"'
        assert convert_param_to_ts_value("string", 'hello "world"') == '"hello \\"world\\""'

    def test_convert_param_to_ts_value_number(self):
        """Test number parameter conversion."""
        from letta.services.tool_sandbox.typescript_generator import convert_param_to_ts_value

        assert convert_param_to_ts_value("number", 42) == "42"
        assert convert_param_to_ts_value("number", 3.14) == "3.14"
        assert convert_param_to_ts_value("integer", 100) == "100"

    def test_convert_param_to_ts_value_boolean(self):
        """Test boolean parameter conversion."""
        from letta.services.tool_sandbox.typescript_generator import convert_param_to_ts_value

        assert convert_param_to_ts_value("boolean", True) == "true"
        assert convert_param_to_ts_value("boolean", False) == "false"

    def test_convert_param_to_ts_value_array(self):
        """Test array parameter conversion."""
        from letta.services.tool_sandbox.typescript_generator import convert_param_to_ts_value

        assert convert_param_to_ts_value("array", [1, 2, 3]) == "[1, 2, 3]"

    def test_convert_param_to_ts_value_object(self):
        """Test object parameter conversion."""
        from letta.services.tool_sandbox.typescript_generator import convert_param_to_ts_value

        result = convert_param_to_ts_value("object", {"key": "value"})
        assert result == '{"key": "value"}'

    def test_extract_typescript_function_name(self):
        """Test TypeScript function name extraction."""
        from letta.services.tool_sandbox.typescript_generator import extract_typescript_function_name

        assert extract_typescript_function_name("export function myFunc(): void {}") == "myFunc"
        assert extract_typescript_function_name("export async function asyncFunc(): Promise<void> {}") == "asyncFunc"
        assert extract_typescript_function_name("function notExported(): void {}") is None

    def test_is_async_typescript_function(self):
        """Test async function detection."""
        from letta.services.tool_sandbox.typescript_generator import is_async_typescript_function

        assert is_async_typescript_function("export async function test(): Promise<void> {}", "test") is True
        assert is_async_typescript_function("export function test(): void {}", "test") is False

    def test_generate_typescript_execution_script(self):
        """Test TypeScript execution script generation."""
        from letta.services.tool_sandbox.typescript_generator import generate_typescript_execution_script

        script = generate_typescript_execution_script(
            tool_name="add",
            tool_source_code="export function add(x: number, y: number): number { return x + y; }",
            args={"x": 1, "y": 2},
            json_schema={
                "name": "add",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "x": {"type": "number"},
                        "y": {"type": "number"},
                    },
                },
            },
        )

        # Verify Letta client initialization is included (using dynamic import with try/catch)
        assert "let client: any = null;" in script
        assert "await import('@letta-ai/letta-client')" in script
        assert "process.env.LETTA_API_KEY" in script
        assert "} catch (e) {" in script  # Graceful fallback if package not available

        # Verify arguments are initialized
        assert "const x = 1;" in script
        assert "const y = 2;" in script
        assert "function add" in script  # 'export' is stripped for inline execution
        assert "const _result = add(x, y);" in script
        assert "JSON.stringify(_output);" in script

        # Verify agent_state is null (not supported for TypeScript)
        assert "agent_state: null" in script

    def test_parse_typescript_result(self):
        """Test TypeScript result parsing."""
        from letta.services.tool_sandbox.typescript_generator import parse_typescript_result

        # Valid JSON result
        result, agent_state = parse_typescript_result('{"results": 42, "agent_state": null}')
        assert result == 42
        assert agent_state is None

        # Invalid JSON returns raw text
        result, agent_state = parse_typescript_result("not json")
        assert result == "not json"
        assert agent_state is None

        # Empty result
        result, agent_state = parse_typescript_result("")
        assert result is None
        assert agent_state is None

    def test_sandbox_tool_executor_skips_ast_for_typescript(self):
        """Test that SandboxToolExecutor._prepare_function_args skips AST parsing for TypeScript."""
        from letta.schemas.tool import Tool as PydanticTool
        from letta.services.tool_executor.sandbox_tool_executor import SandboxToolExecutor

        ts_tool = PydanticTool(
            name="ts_func",
            description="Test TypeScript tool",
            source_code="""
export function ts_func(a: number, b: string): string {
    return b.repeat(a);
}
""",
            source_type="typescript",
            tool_type=ToolType.CUSTOM,
            json_schema={
                "name": "ts_func",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "a": {"type": "number"},
                        "b": {"type": "string"},
                    },
                    "required": ["a", "b"],
                },
            },
        )

        # This should NOT raise a SyntaxError - it should skip AST parsing for TypeScript
        result = SandboxToolExecutor._prepare_function_args(
            function_args={"a": 3, "b": "test"},
            tool=ts_tool,
            function_name="ts_func",
        )

        # Should return original args unchanged (no type coercion for TypeScript)
        assert result == {"a": 3, "b": "test"}
