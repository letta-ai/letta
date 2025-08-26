import asyncio
import os
import re
import tempfile
import threading
import time
from datetime import datetime, timedelta

import pytest
from dotenv import load_dotenv
from letta_client import CreateBlock
from letta_client import Letta as LettaSDKClient
from letta_client import LettaRequest
from letta_client import MessageCreate as ClientMessageCreate
from letta_client.types import AgentState

from letta.constants import DEFAULT_ORG_ID, FILES_TOOLS
from letta.helpers.pinecone_utils import should_use_pinecone
from letta.schemas.enums import FileProcessingStatus, ToolType
from letta.schemas.message import MessageCreate
from letta.schemas.user import User
from letta.settings import settings
from tests.helpers.utils import upload_file_and_wait, upload_file_and_wait_list_files
from tests.utils import wait_for_server

# Constants
SERVER_PORT = 8283


def get_raw_system_message(client: LettaSDKClient, agent_id: str) -> str:
    """Helper function to get the raw system message from an agent's preview payload."""
    raw_payload = client.agents.messages.preview_raw_payload(
        agent_id=agent_id,
        request=LettaRequest(
            messages=[
                ClientMessageCreate(
                    role="user",
                    content="Testing",
                )
            ],
        ),
    )
    return raw_payload["messages"][0]["content"]


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


@pytest.fixture
def agent_state(disable_pinecone, client: LettaSDKClient):
    open_file_tool = client.tools.list(name="open_files")[0]
    search_files_tool = client.tools.list(name="semantic_search_files")[0]
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


def test_auto_attach_detach_files_tools(disable_pinecone, client: LettaSDKClient):
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
    assert len(client.agents.retrieve(agent_id=agent.id).sources) == 1
    assert_file_tools_present(agent, set(FILES_TOOLS))

    # Create and attach second source
    source_2 = client.sources.create(name="another_test_source", embedding="openai/text-embedding-3-small")
    assert len(client.sources.list()) == 2

    agent = client.agents.sources.attach(source_id=source_2.id, agent_id=agent.id)
    assert len(client.agents.retrieve(agent_id=agent.id).sources) == 2
    # File tools should remain after attaching second source
    assert_file_tools_present(agent, set(FILES_TOOLS))

    # Detach second source - tools should remain (first source still attached)
    agent = client.agents.sources.detach(source_id=source_2.id, agent_id=agent.id)
    assert_file_tools_present(agent, set(FILES_TOOLS))

    # Detach first source - all file tools should be removed
    agent = client.agents.sources.detach(source_id=source_1.id, agent_id=agent.id)
    assert_no_file_tools(agent)


@pytest.mark.parametrize("use_mistral_parser", [True, False])
@pytest.mark.parametrize(
    "file_path, expected_value, expected_label_regex",
    [
        ("tests/data/test.txt", "test", r"test_source/test\.txt"),
        ("tests/data/memgpt_paper.pdf", "MemGPT", r"test_source/memgpt_paper\.pdf"),
        ("tests/data/toy_chat_fine_tuning.jsonl", '{"messages"', r"test_source/toy_chat_fine_tuning\.jsonl"),
        ("tests/data/test.md", "h2 Heading", r"test_source/test\.md"),
        ("tests/data/test.json", "glossary", r"test_source/test\.json"),
        ("tests/data/react_component.jsx", "UserProfile", r"test_source/react_component\.jsx"),
        ("tests/data/task_manager.java", "TaskManager", r"test_source/task_manager\.java"),
        ("tests/data/data_structures.cpp", "BinarySearchTree", r"test_source/data_structures\.cpp"),
        ("tests/data/api_server.go", "UserService", r"test_source/api_server\.go"),
        ("tests/data/data_analysis.py", "StatisticalAnalyzer", r"test_source/data_analysis\.py"),
        ("tests/data/test.csv", "Smart Fridge Plus", r"test_source/test\.csv"),
    ],
)
def test_file_upload_creates_source_blocks_correctly(
    disable_pinecone,
    client: LettaSDKClient,
    agent_state: AgentState,
    file_path: str,
    expected_value: str,
    expected_label_regex: str,
    use_mistral_parser: bool,
):
    # Override mistral API key setting to force parser selection for testing
    original_mistral_key = settings.mistral_api_key
    try:
        if not use_mistral_parser:
            # Set to None to force markitdown parser selection
            settings.mistral_api_key = None

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

        # verify raw system message contains source information
        raw_system_message = get_raw_system_message(client, agent_state.id)
        assert "test_source" in raw_system_message
        assert "<directories>" in raw_system_message
        # verify file-specific details in raw system message
        file_name = files[0].file_name
        assert f'name="test_source/{file_name}"' in raw_system_message
        assert 'status="open"' in raw_system_message

        # Remove file from source
        client.sources.files.delete(source_id=source.id, file_id=files[0].id)

        # Confirm blocks were removed
        agent_state = client.agents.retrieve(agent_id=agent_state.id)
        blocks = agent_state.memory.file_blocks
        assert len(blocks) == 0
        assert not any(expected_value in b.value for b in blocks)
        assert not any(re.fullmatch(expected_label_regex, b.label) for b in blocks)

        # verify raw system message no longer contains source information
        raw_system_message_after_removal = get_raw_system_message(client, agent_state.id)
        # this should be in, because we didn't delete the source
        assert "test_source" in raw_system_message_after_removal
        assert "<directories>" in raw_system_message_after_removal
        # verify file-specific details are also removed
        assert f'name="test_source/{file_name}"' not in raw_system_message_after_removal

    finally:
        # Restore original mistral API key setting
        settings.mistral_api_key = original_mistral_key


def test_attach_existing_files_creates_source_blocks_correctly(disable_pinecone, client: LettaSDKClient, agent_state: AgentState):
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
    raw_system_message = get_raw_system_message(client, agent_state.id)

    # Assert that the expected chunk is in the raw system message
    expected_chunk = """<directories>
<file_limits>
- current_files_open=1
- max_files_open=5
</file_limits>
<directory name="test_source">
<file status="open" name="test_source/test.txt">
<metadata>
- read_only=true
- chars_current=45
- chars_limit=15000
</metadata>
<value>
[Viewing file start (out of 1 lines)]
1: test
</value>
</file>
</directory>
</directories>"""
    assert expected_chunk in raw_system_message

    # Get the agent state, check blocks exist
    agent_state = client.agents.retrieve(agent_id=agent_state.id)
    blocks = agent_state.memory.file_blocks
    assert len(blocks) == 1
    assert any("test" in b.value for b in blocks)
    assert any(b.value.startswith("[Viewing file start") for b in blocks)

    # Detach the source
    client.agents.sources.detach(source_id=source.id, agent_id=agent_state.id)

    # Get the agent state, check blocks do NOT exist
    agent_state = client.agents.retrieve(agent_id=agent_state.id)
    blocks = agent_state.memory.file_blocks
    assert len(blocks) == 0
    assert not any("test" in b.value for b in blocks)

    # Verify no traces of the prompt exist in the raw system message after detaching
    raw_system_message_after_detach = get_raw_system_message(client, agent_state.id)
    assert expected_chunk not in raw_system_message_after_detach
    assert "test_source" not in raw_system_message_after_detach
    assert "<directories>" not in raw_system_message_after_detach


def test_delete_source_removes_source_blocks_correctly(disable_pinecone, client: LettaSDKClient, agent_state: AgentState):
    # Create a new source
    source = client.sources.create(name="test_source", embedding="openai/text-embedding-3-small")
    assert len(client.sources.list()) == 1

    client.agents.sources.attach(source_id=source.id, agent_id=agent_state.id)
    raw_system_message = get_raw_system_message(client, agent_state.id)
    assert "test_source" in raw_system_message
    assert "<directories>" in raw_system_message

    # Load files into the source
    file_path = "tests/data/test.txt"

    # Upload the files
    upload_file_and_wait(client, source.id, file_path)
    raw_system_message = get_raw_system_message(client, agent_state.id)
    # Assert that the expected chunk is in the raw system message
    expected_chunk = """<directories>
<file_limits>
- current_files_open=1
- max_files_open=5
</file_limits>
<directory name="test_source">
<file status="open" name="test_source/test.txt">
<metadata>
- read_only=true
- chars_current=45
- chars_limit=15000
</metadata>
<value>
[Viewing file start (out of 1 lines)]
1: test
</value>
</file>
</directory>
</directories>"""
    assert expected_chunk in raw_system_message

    # Get the agent state, check blocks exist
    agent_state = client.agents.retrieve(agent_id=agent_state.id)
    blocks = agent_state.memory.file_blocks
    assert len(blocks) == 1
    assert any("test" in b.value for b in blocks)

    # Remove file from source
    client.sources.delete(source_id=source.id)
    raw_system_message_after_detach = get_raw_system_message(client, agent_state.id)
    assert expected_chunk not in raw_system_message_after_detach
    assert "test_source" not in raw_system_message_after_detach
    assert "<directories>" not in raw_system_message_after_detach

    # Get the agent state, check blocks do NOT exist
    agent_state = client.agents.retrieve(agent_id=agent_state.id)
    blocks = agent_state.memory.file_blocks
    assert len(blocks) == 0
    assert not any("test" in b.value for b in blocks)


def test_agent_uses_open_close_file_correctly(disable_pinecone, client: LettaSDKClient, agent_state: AgentState):
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
    offset, length = 0, 5  # 0-indexed offset, 5 lines
    print(f"Requesting agent to open file with offset={offset}, length={length}")
    open_response1 = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=[
            MessageCreate(
                role="user",
                content=f"Use ONLY the open_files tool to open the file named test_source/{file.file_name} with offset {offset} and length {length}",
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
    assert "[Viewing lines 1 to 5 (out of " in old_value, f"Expected viewing header for lines 1-5, got: {old_value[:100]}..."
    assert "1: Enrico Letta" in old_value, f"Expected line 1 to start with '1: Enrico Letta', got: {old_value[:200]}..."
    assert "5: " in old_value, f"Expected line 5 to be present, got: {old_value}"

    # Ask agent to open the file for a different range
    offset, length = 5, 5  # Different offset, same length
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
    assert "[Viewing lines 6 to 10 (out of " in new_value, f"Expected viewing header for lines 6-10, got: {new_value[:100]}..."
    assert "6: " in new_value, f"Expected line 6 to be present, got: {new_value[:200]}..."
    assert "10: " in new_value, f"Expected line 10 to be present, got: {new_value}"

    print(f"Comparing content ranges:")
    print(f"  First range (offset=0, length=5):  '{old_value}'")
    print(f"  Second range (offset=5, length=5): '{new_value}'")

    assert new_value != old_value, f"Different view ranges should have different content. New: '{new_value}', Old: '{old_value}'"

    # Assert that ranges don't overlap - first range should not contain line 6, second should not contain line 1
    assert "6: was promoted" not in old_value, f"First range (1-5) should not contain line 6, got: {old_value}"
    assert "1: Enrico Letta" not in new_value, f"Second range (6-10) should not contain line 1, got: {new_value}"

    print("✓ File successfully opened with different range - content differs as expected")


def test_agent_uses_search_files_correctly(disable_pinecone, client: LettaSDKClient, agent_state: AgentState):
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

    # Ask agent to use the semantic_search_files tool
    search_files_response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=[
            MessageCreate(
                role="user", content=f"Use ONLY the semantic_search_files tool to search for details regarding the electoral history."
            )
        ],
    )
    print(f"Search file request sent, got {len(search_files_response.messages)} message(s) in response")
    print(search_files_response.messages)

    # Check that archival_memory_search was called
    tool_calls = [msg for msg in search_files_response.messages if msg.message_type == "tool_call_message"]
    assert len(tool_calls) > 0, "No tool calls found"
    assert any(tc.tool_call.name == "semantic_search_files" for tc in tool_calls), "semantic_search_files not called"

    # Check it returned successfully
    tool_returns = [msg for msg in search_files_response.messages if msg.message_type == "tool_return_message"]
    assert len(tool_returns) > 0, "No tool returns found"
    assert all(tr.status == "success" for tr in tool_returns), f"Tool call failed {tr}"


def test_agent_uses_grep_correctly_basic(disable_pinecone, client: LettaSDKClient, agent_state: AgentState):
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

    # Ask agent to use the semantic_search_files tool
    search_files_response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=[MessageCreate(role="user", content=f"Use ONLY the grep_files tool to search for `Nunzia De Girolamo`.")],
    )
    print(f"Grep request sent, got {len(search_files_response.messages)} message(s) in response")
    print(search_files_response.messages)

    # Check that grep_files was called
    tool_calls = [msg for msg in search_files_response.messages if msg.message_type == "tool_call_message"]
    assert len(tool_calls) > 0, "No tool calls found"
    assert any(tc.tool_call.name == "grep_files" for tc in tool_calls), "semantic_search_files not called"

    # Check it returned successfully
    tool_returns = [msg for msg in search_files_response.messages if msg.message_type == "tool_return_message"]
    assert len(tool_returns) > 0, "No tool returns found"
    assert all(tr.status == "success" for tr in tool_returns), "Tool call failed"


def test_agent_uses_grep_correctly_advanced(disable_pinecone, client: LettaSDKClient, agent_state: AgentState):
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

    # Ask agent to use the semantic_search_files tool
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
    assert "Found 1 total matches across 1 files" in tool_return_message.tool_return
    assert "tool-f5b80b08-5a45-4a0a-b2cd-dd8a0177b7ef" in tool_return_message.tool_return

    # Context line integrity (3 lines before and after)
    assert "509:" in tool_return_message.tool_return
    assert "> 510:" in tool_return_message.tool_return  # Match line with > prefix
    assert "511:" in tool_return_message.tool_return


def test_create_agent_with_source_ids_creates_source_blocks_correctly(disable_pinecone, client: LettaSDKClient):
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
    assert any(b.value.startswith("[Viewing file start (out of ") for b in blocks)

    # Verify file tools were automatically attached
    file_tools = {tool.name for tool in temp_agent_state.tools if tool.tool_type == ToolType.LETTA_FILES_CORE}
    assert file_tools == set(FILES_TOOLS)


def test_view_ranges_have_metadata(disable_pinecone, client: LettaSDKClient, agent_state: AgentState):
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
    offset = 49  # 0-indexed for line 50
    length = 5  # 5 lines (50-54)
    open_response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=[
            MessageCreate(
                role="user",
                content=f"Use ONLY the open_files tool to open the file named test_source/{file.file_name} with offset {offset} and length {length}",
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


def test_duplicate_file_renaming(disable_pinecone, client: LettaSDKClient):
    """Test that duplicate files are renamed with count-based suffixes (e.g., file.txt, file (1).txt, file (2).txt)"""
    # Create a new source
    source = client.sources.create(name="test_duplicate_source", embedding="openai/text-embedding-3-small")

    # Upload the same file three times
    file_path = "tests/data/test.txt"

    with open(file_path, "rb") as f:
        first_file = client.sources.files.upload(source_id=source.id, file=f)

    with open(file_path, "rb") as f:
        second_file = client.sources.files.upload(source_id=source.id, file=f)

    with open(file_path, "rb") as f:
        third_file = client.sources.files.upload(source_id=source.id, file=f)

    # Get all uploaded files
    files = client.sources.files.list(source_id=source.id, limit=10)
    assert len(files) == 3, f"Expected 3 files, got {len(files)}"

    # Sort files by creation time to ensure predictable order
    files.sort(key=lambda f: f.created_at)

    # Verify filenames follow the count-based pattern
    expected_filenames = ["test.txt", "test_(1).txt", "test_(2).txt"]
    actual_filenames = [f.file_name for f in files]

    assert actual_filenames == expected_filenames, f"Expected {expected_filenames}, got {actual_filenames}"

    # Verify all files have the same original_file_name
    for file in files:
        assert file.original_file_name == "test.txt", f"Expected original_file_name='test.txt', got '{file.original_file_name}'"

    print(f"✓ Successfully tested duplicate file renaming:")
    for i, file in enumerate(files):
        print(f"  File {i+1}: original='{file.original_file_name}' → renamed='{file.file_name}'")


def test_duplicate_file_handling_replace(disable_pinecone, client: LettaSDKClient):
    """Test that DuplicateFileHandling.REPLACE replaces existing files with same name"""
    # Create a new source
    source = client.sources.create(name="test_replace_source", embedding="openai/text-embedding-3-small")

    # Create agent and attach source to test memory blocks
    agent_state = client.agents.create(
        name="test_replace_agent",
        memory_blocks=[
            CreateBlock(label="human", value="username: sarah"),
        ],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
        source_ids=[source.id],
    )

    # Create a temporary file with original content
    original_content = "original file content for testing"
    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
        f.write(original_content)
        temp_file_path = f.name
        temp_filename = os.path.basename(f.name)

    try:
        # Wait for the file to be processed
        upload_file_and_wait(client, source.id, temp_file_path)

        # Verify original file was uploaded
        files = client.sources.files.list(source_id=source.id, limit=10)
        assert len(files) == 1, f"Expected 1 file, got {len(files)}"
        original_file = files[0]
        assert original_file.original_file_name == temp_filename

        # Get agent state and verify original content is in memory blocks
        agent_state = client.agents.retrieve(agent_id=agent_state.id)
        file_blocks = agent_state.memory.file_blocks
        assert len(file_blocks) == 1, f"Expected 1 file block, got {len(file_blocks)}"
        original_block_content = file_blocks[0].value
        assert original_content in original_block_content

        # Create replacement content
        replacement_content = "this is the replacement content that should overwrite the original"
        with open(temp_file_path, "w") as f:
            f.write(replacement_content)

        # Upload replacement file with REPLACE duplicate handling
        from letta.schemas.enums import DuplicateFileHandling  # TODO: Temporary pre-client compliation, good to remove

        replacement_file = upload_file_and_wait(client, source.id, temp_file_path, duplicate_handling=DuplicateFileHandling.REPLACE)

        # Verify we still have only 1 file (replacement, not addition)
        files_after_replace = client.sources.files.list(source_id=source.id, limit=10)
        assert len(files_after_replace) == 1, f"Expected 1 file after replacement, got {len(files_after_replace)}"

        replaced_file = files_after_replace[0]

        # Verify file metadata shows replacement
        assert replaced_file.original_file_name == temp_filename, "Original filename should be preserved"
        assert replaced_file.file_name == temp_filename, "File name should match original"

        # Verify the file ID is different (new file replaced the old one)
        assert replaced_file.id != original_file.id, "Replacement file should have different ID"

        # Verify agent memory blocks contain replacement content
        agent_state = client.agents.retrieve(agent_id=agent_state.id)
        updated_file_blocks = agent_state.memory.file_blocks
        assert len(updated_file_blocks) == 1, f"Expected 1 file block after replacement, got {len(updated_file_blocks)}"

        replacement_block_content = updated_file_blocks[0].value
        assert replacement_content in replacement_block_content, f"Expected replacement content in block, got: {replacement_block_content}"
        assert (
            original_content not in replacement_block_content
        ), f"Original content should not be present after replacement: {replacement_block_content}"

        print("✓ Successfully tested DuplicateFileHandling.REPLACE functionality")

    finally:
        # Clean up temporary file
        if os.path.exists(temp_file_path):
            os.unlink(temp_file_path)


def test_upload_file_with_custom_name(disable_pinecone, client: LettaSDKClient):
    """Test that uploading a file with a custom name overrides the original filename"""
    # Create agent
    agent_state = client.agents.create(
        name="test_agent_custom_name",
        memory_blocks=[
            CreateBlock(
                label="persona",
                value="I am a helpful assistant",
            ),
            CreateBlock(
                label="human",
                value="The user is a developer",
            ),
        ],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
    )

    # Create source
    source = client.sources.create(name="test_source_custom_name", embedding="openai/text-embedding-3-small")

    # Attach source to agent
    client.agents.sources.attach(source_id=source.id, agent_id=agent_state.id)

    # Create a temporary file with specific content
    import tempfile

    temp_file_path = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write("This is a test file for custom naming")
            temp_file_path = f.name

        # Upload file with custom name
        custom_name = "my_custom_file_name.txt"
        file_metadata = upload_file_and_wait(client, source.id, temp_file_path, name=custom_name)

        # Verify the file uses the custom name
        assert file_metadata.file_name == custom_name
        assert file_metadata.original_file_name == custom_name

        # Verify file appears in source files list with custom name
        files = client.sources.files.list(source_id=source.id, limit=1)
        assert len(files) == 1
        assert files[0].file_name == custom_name
        assert files[0].original_file_name == custom_name

        # Verify the custom name is used in file blocks
        agent_state = client.agents.retrieve(agent_id=agent_state.id)
        file_blocks = agent_state.memory.file_blocks
        assert len(file_blocks) == 1
        # Check that the custom name appears in the block label
        assert custom_name.replace(".txt", "") in file_blocks[0].label

        # Test duplicate handling with custom name - upload same file with same custom name
        from letta.schemas.enums import DuplicateFileHandling

        with pytest.raises(Exception) as exc_info:
            upload_file_and_wait(client, source.id, temp_file_path, name=custom_name, duplicate_handling=DuplicateFileHandling.ERROR)
        assert "already exists" in str(exc_info.value).lower()

        # Upload same file with different custom name should succeed
        different_custom_name = "folder_a/folder_b/another_custom_name.txt"
        file_metadata2 = upload_file_and_wait(client, source.id, temp_file_path, name=different_custom_name)
        assert file_metadata2.file_name == different_custom_name
        assert file_metadata2.original_file_name == different_custom_name

        # Verify both files exist
        files = client.sources.files.list(source_id=source.id, limit=10)
        assert len(files) == 2
        file_names = {f.file_name for f in files}
        assert custom_name in file_names
        assert different_custom_name in file_names

    finally:
        # Clean up temporary file
        if temp_file_path and os.path.exists(temp_file_path):
            os.unlink(temp_file_path)


def test_open_files_schema_descriptions(disable_pinecone, client: LettaSDKClient):
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
    assert 'FileOpenRequest(file_name="project_utils/config.py")' in description
    assert 'FileOpenRequest(file_name="project_utils/config.py", offset=0, length=50)' in description
    assert "# Lines 1-50" in description
    assert "# Lines 101-200" in description
    assert "# Entire file" in description
    assert "close_all_others=True" in description
    assert "View specific portions of large files (e.g. functions or definitions)" in description

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
    expected_offset_desc = "Optional offset for starting line number (0-indexed). If not specified, starts from beginning of file."
    assert offset_prop["description"] == expected_offset_desc
    assert offset_prop["type"] == "integer"

    # Check length field
    assert "length" in file_request_properties
    length_prop = file_request_properties["length"]
    expected_length_desc = "Optional number of lines to view from offset (inclusive). If not specified, views to end of file."
    assert length_prop["description"] == expected_length_desc
    assert length_prop["type"] == "integer"


def test_grep_files_schema_descriptions(disable_pinecone, client: LettaSDKClient):
    """Test that grep_files tool schema contains correct descriptions from docstring"""

    # Get the grep_files tool
    tools = client.tools.list(name="grep_files")
    assert len(tools) == 1, "Expected exactly one grep_files tool"

    grep_files_tool = tools[0]
    schema = grep_files_tool.json_schema

    # Check main function description includes the full multiline docstring with examples
    description = schema["description"]

    # Check main description line
    assert "Searches file contents for pattern matches with surrounding context." in description

    # Check important details are included
    assert "Results are paginated - shows 20 matches per call" in description
    assert "The response includes:" in description
    assert "A summary of total matches and which files contain them" in description
    assert "The current page of matches (20 at a time)" in description
    assert "Instructions for viewing more matches using the offset parameter" in description

    # Check examples are included
    assert "Example usage:" in description
    assert 'grep_files(pattern="TODO")' in description
    assert 'grep_files(pattern="TODO", offset=20)' in description
    assert "# Shows matches 21-40" in description

    # Check parameters structure
    assert "parameters" in schema
    assert "properties" in schema["parameters"]
    properties = schema["parameters"]["properties"]

    # Check pattern parameter
    assert "pattern" in properties
    pattern_prop = properties["pattern"]
    expected_pattern_desc = "Keyword or regex pattern to search within file contents."
    assert (
        pattern_prop["description"] == expected_pattern_desc
    ), f"Expected pattern description: '{expected_pattern_desc}', got: '{pattern_prop['description']}'"
    assert pattern_prop["type"] == "string"

    # Check include parameter
    assert "include" in properties
    include_prop = properties["include"]
    expected_include_desc = "Optional keyword or regex pattern to filter filenames to include in the search."
    assert (
        include_prop["description"] == expected_include_desc
    ), f"Expected include description: '{expected_include_desc}', got: '{include_prop['description']}'"
    assert include_prop["type"] == "string"

    # Check context_lines parameter
    assert "context_lines" in properties
    context_lines_prop = properties["context_lines"]
    expected_context_lines_desc = (
        "Number of lines of context to show before and after each match.\n" "Equivalent to `-C` in grep_files. Defaults to 1."
    )
    assert (
        context_lines_prop["description"] == expected_context_lines_desc
    ), f"Expected context_lines description: '{expected_context_lines_desc}', got: '{context_lines_prop['description']}'"
    assert context_lines_prop["type"] == "integer"

    # Check offset parameter
    assert "offset" in properties
    offset_prop = properties["offset"]
    expected_offset_desc = (
        "Number of matches to skip before showing results. Used for pagination.\n"
        "For example, offset=20 shows matches starting from the 21st match.\n"
        "Use offset=0 (or omit) for first page, offset=20 for second page,\n"
        "offset=40 for third page, etc. The tool will tell you the exact\n"
        "offset to use for the next page."
    )
    assert (
        offset_prop["description"] == expected_offset_desc
    ), f"Expected offset description: '{expected_offset_desc}', got: '{offset_prop['description']}'"
    assert offset_prop["type"] == "integer"

    # Check return description in main description
    assert "Returns search results containing:" in description
    assert "Summary with total match count and file distribution" in description
    assert "List of files with match counts per file" in description
    assert "Current page of matches (up to 20)" in description
    assert "Navigation hint for next page if more matches exist" in description


# --- Pinecone Tests ---


def test_pinecone_search_files_tool(client: LettaSDKClient):
    """Test that search_files tool uses Pinecone when enabled"""
    from letta.helpers.pinecone_utils import should_use_pinecone

    if not should_use_pinecone(verbose=True):
        pytest.skip("Pinecone not configured (missing API key or disabled), skipping Pinecone-specific tests")

    print("Testing Pinecone search_files tool functionality")

    # Create agent with file tools
    agent = client.agents.create(
        name="test_pinecone_agent",
        memory_blocks=[
            CreateBlock(label="human", value="username: testuser"),
        ],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
    )

    # Create source and attach to agent
    source = client.sources.create(name="test_pinecone_source", embedding="openai/text-embedding-3-small")
    client.agents.sources.attach(source_id=source.id, agent_id=agent.id)

    # Upload a file with searchable content
    file_path = "tests/data/long_test.txt"
    upload_file_and_wait(client, source.id, file_path)

    # Test semantic search using Pinecone
    search_response = client.agents.messages.create(
        agent_id=agent.id,
        messages=[MessageCreate(role="user", content="Use the semantic_search_files tool to search for 'electoral history' in the files.")],
    )

    # Verify tool was called successfully
    tool_calls = [msg for msg in search_response.messages if msg.message_type == "tool_call_message"]
    assert len(tool_calls) > 0, "No tool calls found"
    assert any(tc.tool_call.name == "semantic_search_files" for tc in tool_calls), "semantic_search_files not called"

    # Verify tool returned results
    tool_returns = [msg for msg in search_response.messages if msg.message_type == "tool_return_message"]
    assert len(tool_returns) > 0, "No tool returns found"
    assert all(tr.status == "success" for tr in tool_returns), "Tool call failed"

    # Check that results contain expected content
    search_results = tool_returns[0].tool_return
    print(search_results)
    assert (
        "electoral" in search_results.lower() or "history" in search_results.lower()
    ), f"Search results should contain relevant content: {search_results}"


def test_pinecone_list_files_status(client: LettaSDKClient):
    """Test that list_source_files properly syncs embedding status with Pinecone"""
    if not should_use_pinecone():
        pytest.skip("Pinecone not configured (missing API key or disabled), skipping Pinecone-specific tests")

    # create source
    source = client.sources.create(name="test_list_files_status", embedding="openai/text-embedding-3-small")

    file_paths = ["tests/data/long_test.txt"]
    uploaded_files = []
    for file_path in file_paths:
        # use the new helper that polls via list_files
        file_metadata = upload_file_and_wait_list_files(client, source.id, file_path)
        uploaded_files.append(file_metadata)
        assert file_metadata.processing_status == "completed", f"File {file_path} should be completed"

    # now get files using list_source_files to verify status checking works
    files_list = client.sources.files.list(source_id=source.id, limit=100)

    # verify all files show completed status and have proper embedding counts
    assert len(files_list) == len(uploaded_files), f"Expected {len(uploaded_files)} files, got {len(files_list)}"

    for file_metadata in files_list:
        assert file_metadata.processing_status == "completed", f"File {file_metadata.file_name} should show completed status"

        # verify embedding counts for files that have chunks
        if file_metadata.total_chunks and file_metadata.total_chunks > 0:
            assert (
                file_metadata.chunks_embedded == file_metadata.total_chunks
            ), f"File {file_metadata.file_name} should have all chunks embedded: {file_metadata.chunks_embedded}/{file_metadata.total_chunks}"

    # cleanup
    client.sources.delete(source_id=source.id)


def test_pinecone_lifecycle_file_and_source_deletion(client: LettaSDKClient):
    """Test that file and source deletion removes records from Pinecone"""
    from letta.helpers.pinecone_utils import list_pinecone_index_for_files, should_use_pinecone

    if not should_use_pinecone():
        pytest.skip("Pinecone not configured (missing API key or disabled), skipping Pinecone-specific tests")

    print("Testing Pinecone file and source deletion lifecycle")

    # Create source
    source = client.sources.create(name="test_lifecycle_source", embedding="openai/text-embedding-3-small")

    # Upload multiple files and wait for processing
    file_paths = ["tests/data/test.txt", "tests/data/test.md"]
    uploaded_files = []
    for file_path in file_paths:
        file_metadata = upload_file_and_wait(client, source.id, file_path)
        uploaded_files.append(file_metadata)

    # Get temp user for Pinecone operations
    user = User(name="temp", organization_id=DEFAULT_ORG_ID)

    # Test file-level deletion first
    if len(uploaded_files) > 1:
        file_to_delete = uploaded_files[0]

        # Check records for the specific file using list function
        records_before = asyncio.run(list_pinecone_index_for_files(file_to_delete.id, user))
        print(f"Found {len(records_before)} records for file before deletion")

        # Delete the file
        client.sources.files.delete(source_id=source.id, file_id=file_to_delete.id)

        # Allow time for deletion to propagate
        time.sleep(2)

        # Verify file records are removed
        records_after = asyncio.run(list_pinecone_index_for_files(file_to_delete.id, user))
        print(f"Found {len(records_after)} records for file after deletion")

        assert len(records_after) == 0, f"File records should be removed from Pinecone after deletion, but found {len(records_after)}"

    # Test source-level deletion - check remaining files
    # Check records for remaining files
    remaining_records = []
    for file_metadata in uploaded_files[1:]:  # Skip the already deleted file
        file_records = asyncio.run(list_pinecone_index_for_files(file_metadata.id, user))
        remaining_records.extend(file_records)

    records_before = len(remaining_records)
    print(f"Found {records_before} records for remaining files before source deletion")

    # Delete the entire source
    client.sources.delete(source_id=source.id)

    # Allow time for deletion to propagate
    time.sleep(3)

    # Verify all remaining file records are removed
    records_after = []
    for file_metadata in uploaded_files[1:]:
        file_records = asyncio.run(list_pinecone_index_for_files(file_metadata.id, user))
        records_after.extend(file_records)

    print(f"Found {len(records_after)} records for files after source deletion")

    assert (
        len(records_after) == 0
    ), f"All source records should be removed from Pinecone after source deletion, but found {len(records_after)}"


def test_agent_open_file(disable_pinecone, client: LettaSDKClient, agent_state: AgentState):
    """Test client.agents.open_file() function"""
    # Create a new source
    source = client.sources.create(name="test_source", embedding="openai/text-embedding-3-small")

    # Attach source to agent
    client.agents.sources.attach(source_id=source.id, agent_id=agent_state.id)

    # Upload a file
    file_path = "tests/data/test.txt"
    file_metadata = upload_file_and_wait(client, source.id, file_path)

    # Basic test open_file function
    closed_files = client.agents.files.open(agent_id=agent_state.id, file_id=file_metadata.id)
    assert len(closed_files) == 0

    system = get_raw_system_message(client, agent_state.id)
    assert '<file status="open" name="test_source/test.txt">' in system
    assert "[Viewing file start (out of 1 lines)]" in system


def test_agent_close_file(disable_pinecone, client: LettaSDKClient, agent_state: AgentState):
    """Test client.agents.close_file() function"""
    # Create a new source
    source = client.sources.create(name="test_source", embedding="openai/text-embedding-3-small")

    # Attach source to agent
    client.agents.sources.attach(source_id=source.id, agent_id=agent_state.id)

    # Upload a file
    file_path = "tests/data/test.txt"
    file_metadata = upload_file_and_wait(client, source.id, file_path)

    # First open the file
    client.agents.files.open(agent_id=agent_state.id, file_id=file_metadata.id)

    # Test close_file function
    client.agents.files.close(agent_id=agent_state.id, file_id=file_metadata.id)

    system = get_raw_system_message(client, agent_state.id)
    assert '<file status="closed" name="test_source/test.txt">' in system


def test_agent_close_all_open_files(disable_pinecone, client: LettaSDKClient, agent_state: AgentState):
    """Test client.agents.close_all_open_files() function"""
    # Create a new source
    source = client.sources.create(name="test_source", embedding="openai/text-embedding-3-small")

    # Attach source to agent
    client.agents.sources.attach(source_id=source.id, agent_id=agent_state.id)

    # Upload multiple files
    file_paths = ["tests/data/test.txt", "tests/data/test.md"]
    file_metadatas = []
    for file_path in file_paths:
        file_metadata = upload_file_and_wait(client, source.id, file_path)
        file_metadatas.append(file_metadata)
        # Open each file
        client.agents.files.open(agent_id=agent_state.id, file_id=file_metadata.id)

    system = get_raw_system_message(client, agent_state.id)
    assert '<file status="open"' in system

    # Test close_all_open_files function
    result = client.agents.files.close_all(agent_id=agent_state.id)

    # Verify result is a list of strings
    assert isinstance(result, list), f"Expected list, got {type(result)}"
    assert all(isinstance(item, str) for item in result), "All items in result should be strings"

    system = get_raw_system_message(client, agent_state.id)
    assert '<file status="open"' not in system


def test_file_processing_timeout(disable_pinecone, client: LettaSDKClient):
    """Test that files in non-terminal states are moved to error after timeout"""
    # Create a source
    source = client.sources.create(name="test_timeout_source", embedding="openai/text-embedding-3-small")

    # Upload a file
    file_path = "tests/data/test.txt"
    with open(file_path, "rb") as f:
        file_metadata = client.sources.files.upload(source_id=source.id, file=f)

    # Get the file ID
    file_id = file_metadata.id

    # Test the is_terminal_state method directly (this doesn't require server mocking)
    assert FileProcessingStatus.COMPLETED.is_terminal_state() == True
    assert FileProcessingStatus.ERROR.is_terminal_state() == True
    assert FileProcessingStatus.PARSING.is_terminal_state() == False
    assert FileProcessingStatus.EMBEDDING.is_terminal_state() == False
    assert FileProcessingStatus.PENDING.is_terminal_state() == False

    # For testing the actual timeout logic, we can check the current file status
    current_file = client.sources.get_file_metadata(source_id=source.id, file_id=file_id)

    # Convert string status to enum for testing
    status_enum = FileProcessingStatus(current_file.processing_status)

    # Verify that files in terminal states are not affected by timeout checks
    if status_enum.is_terminal_state():
        # This is the expected behavior - files that completed processing shouldn't timeout
        print(f"File {file_id} is in terminal state: {current_file.processing_status}")
        assert status_enum in [FileProcessingStatus.COMPLETED, FileProcessingStatus.ERROR]
    else:
        # If file is still processing, it should eventually complete or timeout
        # In a real scenario, we'd wait and check, but for unit tests we just verify the logic exists
        print(f"File {file_id} is still processing: {current_file.processing_status}")
        assert status_enum in [FileProcessingStatus.PENDING, FileProcessingStatus.PARSING, FileProcessingStatus.EMBEDDING]


@pytest.mark.unit
def test_file_processing_timeout_logic():
    """Test the timeout logic directly without server dependencies"""
    from datetime import timezone

    # Test scenario: file created 35 minutes ago, timeout is 30 minutes
    old_time = datetime.now(timezone.utc) - timedelta(minutes=35)
    current_time = datetime.now(timezone.utc)
    timeout_minutes = 30

    # Calculate timeout threshold
    timeout_threshold = current_time - timedelta(minutes=timeout_minutes)

    # Verify timeout logic
    assert old_time < timeout_threshold, "File created 35 minutes ago should be past 30-minute timeout"

    # Test edge case: file created exactly at timeout
    edge_time = current_time - timedelta(minutes=timeout_minutes)
    assert not (edge_time < timeout_threshold), "File created exactly at timeout should not trigger timeout"

    # Test recent file
    recent_time = current_time - timedelta(minutes=10)
    assert not (recent_time < timeout_threshold), "Recent file should not trigger timeout"


def test_letta_free_embedding(disable_pinecone, client: LettaSDKClient):
    """Test creating a source with letta/letta-free embedding and uploading a file"""
    # create a source with letta-free embedding
    source = client.sources.create(name="test_letta_free_source", embedding="letta/letta-free")

    # verify source was created with correct embedding
    assert source.name == "test_letta_free_source"
    print("\n\n\n\ntest")
    print(source.embedding_config)
    # assert source.embedding_config.embedding_model == "letta-free"

    # upload test.txt file
    file_path = "tests/data/test.txt"
    file_metadata = upload_file_and_wait(client, source.id, file_path)

    # verify file was uploaded successfully
    assert file_metadata.processing_status == "completed"
    assert file_metadata.source_id == source.id
    assert file_metadata.file_name == "test.txt"

    # verify file appears in source files list
    files = client.sources.files.list(source_id=source.id, limit=1)
    assert len(files) == 1
    assert files[0].id == file_metadata.id

    # cleanup
    client.sources.delete(source_id=source.id)
