import os
import re
import threading
import time

import pytest
from dotenv import load_dotenv
from letta_client import CreateBlock
from letta_client import Letta as LettaSDKClient
from letta_client.types import AgentState

from letta.constants import FILES_TOOLS
from letta.orm.enums import ToolType
from letta.schemas.message import MessageCreate
from tests.utils import wait_for_server

# Constants
SERVER_PORT = 8283


@pytest.fixture(autouse=True)
def clear_sources(client: LettaSDKClient):
    # Clear existing sources
    for source in client.sources.list():
        client.sources.delete(source_id=source.id)


def run_server():
    load_dotenv()

    from letta.server.rest_api.app import start_server

    print("Starting server...")
    start_server(debug=True)


@pytest.fixture(scope="module")
def client() -> LettaSDKClient:
    # Get URL from environment or start server
    server_url = os.getenv("LETTA_SERVER_URL", f"http://localhost:{SERVER_PORT}")
    if not os.getenv("LETTA_SERVER_URL"):
        print("Starting server thread")
        thread = threading.Thread(target=run_server, daemon=True)
        thread.start()
        wait_for_server(server_url)
    print("Running client tests with server:", server_url)
    client = LettaSDKClient(base_url=server_url, token=None)
    client.tools.upsert_base_tools()
    yield client


def upload_file_and_wait(client: LettaSDKClient, source_id: str, file_path: str, max_wait: int = 30):
    """Helper function to upload a file and wait for processing to complete"""
    with open(file_path, "rb") as f:
        file_metadata = client.sources.files.upload(source_id=source_id, file=f)

    # Wait for the file to be processed
    start_time = time.time()
    while file_metadata.processing_status != "completed" and file_metadata.processing_status != "error":
        if time.time() - start_time > max_wait:
            pytest.fail(f"File processing timed out after {max_wait} seconds")
        time.sleep(1)
        file_metadata = client.sources.get_file_metadata(source_id=source_id, file_id=file_metadata.id)
        print("Waiting for file processing to complete...", file_metadata.processing_status)

    if file_metadata.processing_status == "error":
        pytest.fail(f"File processing failed: {file_metadata.error_message}")

    return file_metadata


@pytest.fixture
def agent_state(client: LettaSDKClient):
    open_file_tool = client.tools.list(name="open_files")[0]
    search_files_tool = client.tools.list(name="search_files")[0]
    grep_tool = client.tools.list(name="grep_files")[0]

    agent_state = client.agents.create(
        name="test_sources_agent",
        memory_blocks=[
            CreateBlock(
                label="human",
                value="username: sarah",
            ),
        ],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
        tool_ids=[open_file_tool.id, search_files_tool.id, grep_tool.id],
    )
    yield agent_state


# Tests


def test_auto_attach_detach_files_tools(client: LettaSDKClient):
    """Test automatic attachment and detachment of file tools when managing agent sources."""
    # Create agent with basic configuration
    agent = client.agents.create(
        memory_blocks=[
            CreateBlock(label="human", value="username: sarah"),
        ],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
    )

    # Helper function to get file tools from agent
    def get_file_tools(agent_state):
        return {tool.name for tool in agent_state.tools if tool.tool_type == ToolType.LETTA_FILES_CORE}

    # Helper function to assert file tools presence
    def assert_file_tools_present(agent_state, expected_tools):
        actual_tools = get_file_tools(agent_state)
        assert actual_tools == expected_tools, f"File tools mismatch.\nExpected: {expected_tools}\nFound: {actual_tools}"

    # Helper function to assert no file tools
    def assert_no_file_tools(agent_state):
        has_file_tools = any(tool.tool_type == ToolType.LETTA_FILES_CORE for tool in agent_state.tools)
        assert not has_file_tools, "File tools should not be present"

    # Initial state: no file tools
    assert_no_file_tools(agent)

    # Create and attach first source
    source_1 = client.sources.create(name="test_source", embedding="openai/text-embedding-3-small")
    assert len(client.sources.list()) == 1

    agent = client.agents.sources.attach(source_id=source_1.id, agent_id=agent.id)
    assert_file_tools_present(agent, set(FILES_TOOLS))

    # Create and attach second source
    source_2 = client.sources.create(name="another_test_source", embedding="openai/text-embedding-3-small")
    assert len(client.sources.list()) == 2

    agent = client.agents.sources.attach(source_id=source_2.id, agent_id=agent.id)
    # File tools should remain after attaching second source
    assert_file_tools_present(agent, set(FILES_TOOLS))

    # Detach second source - tools should remain (first source still attached)
    agent = client.agents.sources.detach(source_id=source_2.id, agent_id=agent.id)
    assert_file_tools_present(agent, set(FILES_TOOLS))

    # Detach first source - all file tools should be removed
    agent = client.agents.sources.detach(source_id=source_1.id, agent_id=agent.id)
    assert_no_file_tools(agent)


@pytest.mark.parametrize(
    "file_path, expected_value, expected_label_regex",
    [
        ("tests/data/test.txt", "test", r"test_[a-z0-9]+\.txt"),
        ("tests/data/memgpt_paper.pdf", "MemGPT", r"memgpt_paper_[a-z0-9]+\.pdf"),
        ("tests/data/toy_chat_fine_tuning.jsonl", '{"messages"', r"toy_chat_fine_tuning_[a-z0-9]+\.jsonl"),
        ("tests/data/test.md", "h2 Heading", r"test_[a-z0-9]+\.md"),
        ("tests/data/test.json", "glossary", r"test_[a-z0-9]+\.json"),
        ("tests/data/react_component.jsx", "UserProfile", r"react_component_[a-z0-9]+\.jsx"),
        ("tests/data/task_manager.java", "TaskManager", r"task_manager_[a-z0-9]+\.java"),
        ("tests/data/data_structures.cpp", "BinarySearchTree", r"data_structures_[a-z0-9]+\.cpp"),
        ("tests/data/api_server.go", "UserService", r"api_server_[a-z0-9]+\.go"),
        ("tests/data/data_analysis.py", "StatisticalAnalyzer", r"data_analysis_[a-z0-9]+\.py"),
        ("tests/data/test.csv", "Smart Fridge Plus", r"test_[a-z0-9]+\.csv"),
    ],
)
def test_file_upload_creates_source_blocks_correctly(
    client: LettaSDKClient,
    agent_state: AgentState,
    file_path: str,
    expected_value: str,
    expected_label_regex: str,
):
    # Create a new source
    source = client.sources.create(name="test_source", embedding="openai/text-embedding-3-small")
    assert len(client.sources.list()) == 1

    # Attach
    client.agents.sources.attach(source_id=source.id, agent_id=agent_state.id)

    # Upload the file
    upload_file_and_wait(client, source.id, file_path)

    # Get uploaded files
    files = client.sources.files.list(source_id=source.id, limit=1)
    assert len(files) == 1
    assert files[0].source_id == source.id

    # Check that blocks were created
    agent_state = client.agents.retrieve(agent_id=agent_state.id)
    blocks = agent_state.memory.file_blocks
    assert len(blocks) == 1
    assert any(expected_value in b.value for b in blocks)
    assert any(b.value.startswith("[Viewing file start") for b in blocks)
    assert any(re.fullmatch(expected_label_regex, b.label) for b in blocks)

    # Remove file from source
    client.sources.files.delete(source_id=source.id, file_id=files[0].id)

    # Confirm blocks were removed
    agent_state = client.agents.retrieve(agent_id=agent_state.id)
    blocks = agent_state.memory.file_blocks
    assert len(blocks) == 0
    assert not any(expected_value in b.value for b in blocks)
    assert not any(re.fullmatch(expected_label_regex, b.label) for b in blocks)


def test_attach_existing_files_creates_source_blocks_correctly(client: LettaSDKClient, agent_state: AgentState):
    # Create a new source
    source = client.sources.create(name="test_source", embedding="openai/text-embedding-3-small")
    assert len(client.sources.list()) == 1

    # Load files into the source
    file_path = "tests/data/test.txt"

    # Upload the files
    upload_file_and_wait(client, source.id, file_path)

    # Get the first file with pagination
    files = client.sources.files.list(source_id=source.id, limit=1)
    assert len(files) == 1
    assert files[0].source_id == source.id

    # Attach after uploading the file
    client.agents.sources.attach(source_id=source.id, agent_id=agent_state.id)

    # Get the agent state, check blocks exist
    agent_state = client.agents.retrieve(agent_id=agent_state.id)
    blocks = agent_state.memory.file_blocks
    assert len(blocks) == 1
    assert any("test" in b.value for b in blocks)
    assert any(b.value.startswith("[Viewing file start") for b in blocks)
    assert any(re.fullmatch(r"test_[a-z0-9]+\.txt", b.label) for b in blocks)

    # Detach the source
    client.agents.sources.detach(source_id=source.id, agent_id=agent_state.id)

    # Get the agent state, check blocks do NOT exist
    agent_state = client.agents.retrieve(agent_id=agent_state.id)
    blocks = agent_state.memory.file_blocks
    assert len(blocks) == 0
    assert not any("test" in b.value for b in blocks)
    assert not any(re.fullmatch(r"test_[a-z0-9]+\.txt", b.label) for b in blocks)


def test_delete_source_removes_source_blocks_correctly(client: LettaSDKClient, agent_state: AgentState):
    # Create a new source
    source = client.sources.create(name="test_source", embedding="openai/text-embedding-3-small")
    assert len(client.sources.list()) == 1

    # Attach
    client.agents.sources.attach(source_id=source.id, agent_id=agent_state.id)

    # Load files into the source
    file_path = "tests/data/test.txt"

    # Upload the files
    upload_file_and_wait(client, source.id, file_path)

    # Get the agent state, check blocks exist
    agent_state = client.agents.retrieve(agent_id=agent_state.id)
    blocks = agent_state.memory.file_blocks
    assert len(blocks) == 1
    assert any("test" in b.value for b in blocks)
    assert any(re.fullmatch(r"test_[a-z0-9]+\.txt", b.label) for b in blocks)

    # Remove file from source
    client.sources.delete(source_id=source.id)

    # Get the agent state, check blocks do NOT exist
    agent_state = client.agents.retrieve(agent_id=agent_state.id)
    blocks = agent_state.memory.file_blocks
    assert len(blocks) == 0
    assert not any("test" in b.value for b in blocks)
    assert not any(re.fullmatch(r"test_[a-z0-9]+\.txt", b.label) for b in blocks)


def test_agent_uses_open_close_file_correctly(client: LettaSDKClient, agent_state: AgentState):
    # Create a new source
    source = client.sources.create(name="test_source", embedding="openai/text-embedding-3-small")

    sources_list = client.sources.list()
    assert len(sources_list) == 1

    # Attach source to agent
    client.agents.sources.attach(source_id=source.id, agent_id=agent_state.id)

    # Load files into the source
    file_path = "tests/data/long_test.txt"

    # Upload the files
    upload_file_and_wait(client, source.id, file_path)

    # Get uploaded files
    files = client.sources.files.list(source_id=source.id, limit=1)
    assert len(files) == 1
    assert files[0].source_id == source.id
    file = files[0]

    # Check that file is opened initially
    agent_state = client.agents.retrieve(agent_id=agent_state.id)
    blocks = agent_state.memory.file_blocks
    print(f"Agent has {len(blocks)} file block(s)")
    if blocks:
        initial_content_length = len(blocks[0].value)
        print(f"Initial file content length: {initial_content_length} characters")
        print(f"First 100 chars of content: {blocks[0].value[:100]}...")
        assert initial_content_length > 10, f"Expected file content > 10 chars, got {initial_content_length}"

    # Ask agent to open the file for a specific range using offset/length
    offset, length = 1, 5  # 1-indexed offset, 5 lines
    print(f"Requesting agent to open file with offset={offset}, length={length}")
    open_response1 = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=[
            MessageCreate(
                role="user",
                content=f"Use ONLY the open_files tool to open the file named {file.file_name} with offset {offset} and length {length}",
            )
        ],
    )
    print(f"First open request sent, got {len(open_response1.messages)} message(s) in response")
    print(open_response1.messages)

    # Check that file is opened
    agent_state = client.agents.retrieve(agent_id=agent_state.id)
    blocks = agent_state.memory.file_blocks
    old_value = blocks[0].value
    old_content_length = len(old_value)
    print(f"File content length after first open: {old_content_length} characters")
    print(f"First range content: '{old_value}'")
    assert old_content_length > 10, f"Expected content > 10 chars for offset={offset}, length={length}, got {old_content_length}"

    # Assert specific content expectations for first range (lines 1-5)
    assert "[Viewing chunks 1 to 5 (out of 554 chunks)]" in old_value, f"Expected viewing header for lines 1-5, got: {old_value[:100]}..."
    assert "1: Enrico Letta" in old_value, f"Expected line 1 to start with '1: Enrico Letta', got: {old_value[:200]}..."
    assert "5: appointed to the Cabinet" in old_value, f"Expected line 5 to contain '5: appointed to the Cabinet', got: {old_value}"

    # Ask agent to open the file for a different range
    offset, length = 6, 5  # Different offset, same length
    open_response2 = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=[
            MessageCreate(
                role="user",
                content=f"Use ONLY the open_files tool to open the file named {file.file_name} with offset {offset} and length {length}",
            )
        ],
    )
    print(f"Second open request sent, got {len(open_response2.messages)} message(s) in response")
    print(open_response2.messages)

    # Check that file is opened, but for different range
    print("Verifying file is opened with second range...")
    agent_state = client.agents.retrieve(agent_id=agent_state.id)
    blocks = agent_state.memory.file_blocks
    new_value = blocks[0].value
    new_content_length = len(new_value)
    print(f"File content length after second open: {new_content_length} characters")
    print(f"Second range content: '{new_value}'")
    assert new_content_length > 10, f"Expected content > 10 chars for offset={offset}, length={length}, got {new_content_length}"

    # Assert specific content expectations for second range (lines 6-10)
    assert "[Viewing chunks 6 to 10 (out of 554 chunks)]" in new_value, f"Expected viewing header for lines 6-10, got: {new_value[:100]}..."
    assert (
        "6: was promoted to become Minister" in new_value
    ), f"Expected line 6 to start with '6: was promoted to become Minister', got: {new_value[:200]}..."
    assert (
        "10: produced an inconclusive result" in new_value
    ), f"Expected line 10 to contain '10: produced an inconclusive result', got: {new_value}"

    print(f"Comparing content ranges:")
    print(f"  First range (offset=1, length=5):  '{old_value}'")
    print(f"  Second range (offset=6, length=5): '{new_value}'")

    assert new_value != old_value, f"Different view ranges should have different content. New: '{new_value}', Old: '{old_value}'"

    # Assert that ranges don't overlap - first range should not contain line 6, second should not contain line 1
    assert "6: was promoted" not in old_value, f"First range (1-5) should not contain line 6, got: {old_value}"
    assert "1: Enrico Letta" not in new_value, f"Second range (6-10) should not contain line 1, got: {new_value}"

    print("✓ File successfully opened with different range - content differs as expected")


def test_agent_uses_search_files_correctly(client: LettaSDKClient, agent_state: AgentState):
    # Create a new source
    source = client.sources.create(name="test_source", embedding="openai/text-embedding-3-small")

    sources_list = client.sources.list()
    assert len(sources_list) == 1

    # Attach source to agent
    client.agents.sources.attach(source_id=source.id, agent_id=agent_state.id)

    # Load files into the source
    file_path = "tests/data/long_test.txt"
    print(f"Uploading file: {file_path}")

    # Upload the files
    file_metadata = upload_file_and_wait(client, source.id, file_path)
    print(f"File uploaded and processed: {file_metadata.file_name}")

    # Get uploaded files
    files = client.sources.files.list(source_id=source.id, limit=1)
    assert len(files) == 1
    assert files[0].source_id == source.id

    # Ask agent to use the search_files tool
    search_files_response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=[
            MessageCreate(role="user", content=f"Use ONLY the search_files tool to search for details regarding the electoral history.")
        ],
    )
    print(f"Search file request sent, got {len(search_files_response.messages)} message(s) in response")
    print(search_files_response.messages)

    # Check that archival_memory_search was called
    tool_calls = [msg for msg in search_files_response.messages if msg.message_type == "tool_call_message"]
    assert len(tool_calls) > 0, "No tool calls found"
    assert any(tc.tool_call.name == "search_files" for tc in tool_calls), "search_files not called"

    # Check it returned successfully
    tool_returns = [msg for msg in search_files_response.messages if msg.message_type == "tool_return_message"]
    assert len(tool_returns) > 0, "No tool returns found"
    assert all(tr.status == "success" for tr in tool_returns), "Tool call failed"


def test_agent_uses_grep_correctly_basic(client: LettaSDKClient, agent_state: AgentState):
    # Create a new source
    source = client.sources.create(name="test_source", embedding="openai/text-embedding-3-small")

    sources_list = client.sources.list()
    assert len(sources_list) == 1

    # Attach source to agent
    client.agents.sources.attach(source_id=source.id, agent_id=agent_state.id)

    # Load files into the source
    file_path = "tests/data/long_test.txt"
    print(f"Uploading file: {file_path}")

    # Upload the files
    file_metadata = upload_file_and_wait(client, source.id, file_path)
    print(f"File uploaded and processed: {file_metadata.file_name}")

    # Get uploaded files
    files = client.sources.files.list(source_id=source.id, limit=1)
    assert len(files) == 1
    assert files[0].source_id == source.id

    # Ask agent to use the search_files tool
    search_files_response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=[MessageCreate(role="user", content=f"Use ONLY the grep_files tool to search for `Nunzia De Girolamo`.")],
    )
    print(f"Grep request sent, got {len(search_files_response.messages)} message(s) in response")
    print(search_files_response.messages)

    # Check that grep_files was called
    tool_calls = [msg for msg in search_files_response.messages if msg.message_type == "tool_call_message"]
    assert len(tool_calls) > 0, "No tool calls found"
    assert any(tc.tool_call.name == "grep_files" for tc in tool_calls), "search_files not called"

    # Check it returned successfully
    tool_returns = [msg for msg in search_files_response.messages if msg.message_type == "tool_return_message"]
    assert len(tool_returns) > 0, "No tool returns found"
    assert all(tr.status == "success" for tr in tool_returns), "Tool call failed"


def test_agent_uses_grep_correctly_advanced(client: LettaSDKClient, agent_state: AgentState):
    # Create a new source
    source = client.sources.create(name="test_source", embedding="openai/text-embedding-3-small")

    sources_list = client.sources.list()
    assert len(sources_list) == 1

    # Attach source to agent
    client.agents.sources.attach(source_id=source.id, agent_id=agent_state.id)

    # Load files into the source
    file_path = "tests/data/list_tools.json"
    print(f"Uploading file: {file_path}")

    # Upload the files
    file_metadata = upload_file_and_wait(client, source.id, file_path)
    print(f"File uploaded and processed: {file_metadata.file_name}")

    # Get uploaded files
    files = client.sources.files.list(source_id=source.id, limit=1)
    assert len(files) == 1
    assert files[0].source_id == source.id

    # Ask agent to use the search_files tool
    search_files_response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=[
            MessageCreate(role="user", content=f"Use ONLY the grep_files tool to search for `tool-f5b80b08-5a45-4a0a-b2cd-dd8a0177b7ef`.")
        ],
    )
    print(f"Grep request sent, got {len(search_files_response.messages)} message(s) in response")
    print(search_files_response.messages)

    tool_return_message = next((m for m in search_files_response.messages if m.message_type == "tool_return_message"), None)
    assert tool_return_message is not None, "No ToolReturnMessage found in messages"

    # Basic structural integrity checks
    assert tool_return_message.name == "grep_files"
    assert tool_return_message.status == "success"
    assert "Found 1 matches" in tool_return_message.tool_return
    assert "tool-f5b80b08-5a45-4a0a-b2cd-dd8a0177b7ef" in tool_return_message.tool_return

    # Context line integrity (3 lines before and after)
    assert "507:" in tool_return_message.tool_return
    assert "508:" in tool_return_message.tool_return
    assert "509:" in tool_return_message.tool_return
    assert "> 510:" in tool_return_message.tool_return  # Match line with > prefix
    assert "511:" in tool_return_message.tool_return
    assert "512:" in tool_return_message.tool_return
    assert "513:" in tool_return_message.tool_return


def test_create_agent_with_source_ids_creates_source_blocks_correctly(client: LettaSDKClient):
    """Test that creating an agent with source_ids parameter correctly creates source blocks."""
    # Create a new source
    source = client.sources.create(name="test_source", embedding="openai/text-embedding-3-small")
    assert len(client.sources.list()) == 1

    # Upload a file to the source before attaching
    file_path = "tests/data/long_test.txt"
    upload_file_and_wait(client, source.id, file_path)

    # Get uploaded files to verify
    files = client.sources.files.list(source_id=source.id, limit=1)
    assert len(files) == 1
    assert files[0].source_id == source.id

    # Create agent with source_ids parameter
    temp_agent_state = client.agents.create(
        name="test_agent_with_sources",
        memory_blocks=[
            CreateBlock(
                label="human",
                value="username: sarah",
            ),
        ],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
        source_ids=[source.id],  # Attach source during creation
    )

    # Verify agent was created successfully
    assert temp_agent_state is not None
    assert temp_agent_state.name == "test_agent_with_sources"

    # Check that source blocks were created correctly
    blocks = temp_agent_state.memory.file_blocks
    assert len(blocks) == 1
    assert any(b.value.startswith("[Viewing file start (out of 554 chunks)]") for b in blocks)
    assert any(re.fullmatch(r"long_test_[a-z0-9]+\.txt", b.label) for b in blocks)

    # Verify file tools were automatically attached
    file_tools = {tool.name for tool in temp_agent_state.tools if tool.tool_type == ToolType.LETTA_FILES_CORE}
    assert file_tools == set(FILES_TOOLS)


def test_view_ranges_have_metadata(client: LettaSDKClient, agent_state: AgentState):
    # Create a new source
    source = client.sources.create(name="test_source", embedding="openai/text-embedding-3-small")

    sources_list = client.sources.list()
    assert len(sources_list) == 1

    # Attach source to agent
    client.agents.sources.attach(source_id=source.id, agent_id=agent_state.id)

    # Load files into the source
    file_path = "tests/data/1_to_100.py"

    # Upload the files
    upload_file_and_wait(client, source.id, file_path)

    # Get uploaded files
    files = client.sources.files.list(source_id=source.id, limit=1)
    assert len(files) == 1
    assert files[0].source_id == source.id
    file = files[0]

    # Check that file is opened initially
    agent_state = client.agents.retrieve(agent_id=agent_state.id)
    blocks = agent_state.memory.file_blocks
    assert len(blocks) == 1
    block = blocks[0]
    assert block.value.startswith("[Viewing file start (out of 100 lines)]")

    # Open a specific range using offset/length
    offset = 50  # 1-indexed line 50
    length = 5  # 5 lines (50-54)
    open_response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=[
            MessageCreate(
                role="user",
                content=f"Use ONLY the open_files tool to open the file named {file.file_name} with offset {offset} and length {length}",
            )
        ],
    )
    print(f"Open request sent, got {len(open_response.messages)} message(s) in response")
    print(open_response.messages)

    # Check that file is opened correctly
    agent_state = client.agents.retrieve(agent_id=agent_state.id)
    blocks = agent_state.memory.file_blocks
    assert len(blocks) == 1
    block = blocks[0]
    print(block.value)
    assert (
        block.value
        == """
    [Viewing lines 50 to 54 (out of 100 lines)]
50: x50 = 50
51: x51 = 51
52: x52 = 52
53: x53 = 53
54: x54 = 54
    """.strip()
    )


def test_open_files_schema_descriptions(client: LettaSDKClient):
    """Test that open_files tool schema contains correct descriptions from docstring"""

    # Get the open_files tool
    tools = client.tools.list(name="open_files")
    assert len(tools) == 1, "Expected exactly one open_files tool"

    open_files_tool = tools[0]
    schema = open_files_tool.json_schema

    # Check main function description includes the full multiline docstring with examples
    description = schema["description"]

    # Check main description line
    assert (
        "Open one or more files and load their contents into files section in core memory. Maximum of 5 files can be opened simultaneously."
        in description
    )

    # Check that examples are included
    assert "Examples:" in description
    assert 'FileOpenRequest(file_name="config.py")' in description
    assert 'FileOpenRequest(file_name="config.py", offset=1, length=50)' in description
    assert "# Lines 1-50" in description
    assert "# Lines 100-199" in description
    assert "# Entire file" in description
    assert "close_all_others=True" in description

    # Check parameters structure
    assert "parameters" in schema
    assert "properties" in schema["parameters"]
    properties = schema["parameters"]["properties"]

    # Check file_requests parameter
    assert "file_requests" in properties
    file_requests_prop = properties["file_requests"]
    expected_file_requests_desc = "List of file open requests, each specifying file name and optional view range."
    assert (
        file_requests_prop["description"] == expected_file_requests_desc
    ), f"Expected file_requests description: '{expected_file_requests_desc}', got: '{file_requests_prop['description']}'"

    # Check close_all_others parameter
    assert "close_all_others" in properties
    close_all_others_prop = properties["close_all_others"]
    expected_close_all_others_desc = "If True, closes all other currently open files first. Defaults to False."
    assert (
        close_all_others_prop["description"] == expected_close_all_others_desc
    ), f"Expected close_all_others description: '{expected_close_all_others_desc}', got: '{close_all_others_prop['description']}'"

    # Check that file_requests is an array type
    assert file_requests_prop["type"] == "array", f"Expected file_requests type to be 'array', got: '{file_requests_prop['type']}'"

    # Check FileOpenRequest schema within file_requests items
    assert "items" in file_requests_prop
    file_request_items = file_requests_prop["items"]
    assert file_request_items["type"] == "object", "Expected FileOpenRequest to be object type"

    # Check FileOpenRequest properties
    assert "properties" in file_request_items
    file_request_properties = file_request_items["properties"]

    # Check file_name field
    assert "file_name" in file_request_properties
    file_name_prop = file_request_properties["file_name"]
    assert file_name_prop["description"] == "Name of the file to open"
    assert file_name_prop["type"] == "string"

    # Check offset field
    assert "offset" in file_request_properties
    offset_prop = file_request_properties["offset"]
    expected_offset_desc = "Optional starting line number (1-indexed). If not specified, starts from beginning of file."
    assert offset_prop["description"] == expected_offset_desc
    assert offset_prop["type"] == "integer"

    # Check length field
    assert "length" in file_request_properties
    length_prop = file_request_properties["length"]
    expected_length_desc = "Optional number of lines to view from offset. If not specified, views to end of file."
    assert length_prop["description"] == expected_length_desc
    assert length_prop["type"] == "integer"
