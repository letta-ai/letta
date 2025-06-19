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
def clear_sources_jobs(client: LettaSDKClient):
    # Clear existing sources
    for source in client.sources.list():
        client.sources.delete(source_id=source.id)

    # Clear existing jobs
    for job in client.jobs.list():
        client.jobs.delete(job_id=job.id)


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
def agent_state(client: LettaSDKClient):
    open_file_tool = client.tools.list(name="open_file")[0]
    close_file_tool = client.tools.list(name="close_file")[0]
    search_files_tool = client.tools.list(name="search_files")[0]
    grep_tool = client.tools.list(name="grep")[0]

    agent_state = client.agents.create(
        memory_blocks=[
            CreateBlock(
                label="human",
                value="username: sarah",
            ),
        ],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
        tool_ids=[open_file_tool.id, close_file_tool.id, search_files_tool.id, grep_tool.id],
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
    with open(file_path, "rb") as f:
        job = client.sources.files.upload(source_id=source.id, file=f)

    # Wait for the job to complete
    while job.status != "completed" and job.status != "failed":
        time.sleep(1)
        job = client.jobs.retrieve(job_id=job.id)
        print("Waiting for jobs to complete...", job.status)

    if job.status == "failed":
        pytest.fail("Job failed. Check error logs.")

    # Get uploaded files
    files = client.sources.files.list(source_id=source.id, limit=1)
    assert len(files) == 1
    assert files[0].source_id == source.id

    # Check that blocks were created
    agent_state = client.agents.retrieve(agent_id=agent_state.id)
    blocks = agent_state.memory.file_blocks
    assert len(blocks) == 1
    assert any(expected_value in b.value for b in blocks)
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
    with open(file_path, "rb") as f:
        job = client.sources.files.upload(source_id=source.id, file=f)

    # Wait for the jobs to complete
    while job.status != "completed":
        time.sleep(1)
        job = client.jobs.retrieve(job_id=job.id)
        print("Waiting for jobs to complete...", job.status)

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
    with open(file_path, "rb") as f:
        job = client.sources.files.upload(source_id=source.id, file=f)

    # Wait for the jobs to complete
    while job.status != "completed":
        time.sleep(1)
        job = client.jobs.retrieve(job_id=job.id)
        print("Waiting for jobs to complete...", job.status)

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
    with open(file_path, "rb") as f:
        job = client.sources.files.upload(source_id=source.id, file=f)

    # Wait for the jobs to complete
    while job.status != "completed":
        print(f"Waiting for job {job.id} to complete... Current status: {job.status}")
        time.sleep(1)
        job = client.jobs.retrieve(job_id=job.id)

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

    # Ask agent to close the file
    print(f"Requesting agent to close file: {file.file_name}")
    close_response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=[MessageCreate(role="user", content=f"Use ONLY the close_file tool to close the file named {file.file_name}")],
    )
    print(f"Close file request sent, got {len(close_response.messages)} message(s) in response")
    print(close_response.messages)

    # Check that file is closed
    agent_state = client.agents.retrieve(agent_id=agent_state.id)
    blocks = agent_state.memory.file_blocks
    closed_content_length = len(blocks[0].value) if blocks else 0
    print(f"File content length after close: {closed_content_length} characters")
    assert closed_content_length == 0, f"Expected empty content after close, got {closed_content_length} chars"

    # Ask agent to open the file for a specific range
    start, end = 0, 5
    print(f"Requesting agent to open file for range [{start}, {end}]")
    open_response1 = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=[
            MessageCreate(
                role="user", content=f"Use ONLY the open_file tool to open the file named {file.file_name} for view range [{start}, {end}]"
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
    assert old_content_length > 10, f"Expected content > 10 chars for range [{start}, {end}], got {old_content_length}"

    # Ask agent to open the file for a different range
    start, end = 5, 10
    open_response2 = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=[
            MessageCreate(
                role="user", content=f"Use ONLY the open_file tool to open the file named {file.file_name} for view range [{start}, {end}]"
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
    assert new_content_length > 10, f"Expected content > 10 chars for range [{start}, {end}], got {new_content_length}"

    print(f"Comparing content ranges:")
    print(f"  First range [0, 5]:  '{old_value}'")
    print(f"  Second range [5, 10]: '{new_value}'")

    assert new_value != old_value, f"Different view ranges should have different content. New: '{new_value}', Old: '{old_value}'"
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
    with open(file_path, "rb") as f:
        job = client.sources.files.upload(source_id=source.id, file=f)

    print(f"File upload job created with ID: {job.id}, initial status: {job.status}")

    # Wait for the jobs to complete
    while job.status != "completed":
        print(f"Waiting for job {job.id} to complete... Current status: {job.status}")
        time.sleep(1)
        job = client.jobs.retrieve(job_id=job.id)

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


def test_agent_uses_grep_correctly(client: LettaSDKClient, agent_state: AgentState):
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
    with open(file_path, "rb") as f:
        job = client.sources.files.upload(source_id=source.id, file=f)

    print(f"File upload job created with ID: {job.id}, initial status: {job.status}")

    # Wait for the jobs to complete
    while job.status != "completed":
        print(f"Waiting for job {job.id} to complete... Current status: {job.status}")
        time.sleep(1)
        job = client.jobs.retrieve(job_id=job.id)

    # Get uploaded files
    files = client.sources.files.list(source_id=source.id, limit=1)
    assert len(files) == 1
    assert files[0].source_id == source.id

    # Ask agent to use the search_files tool
    search_files_response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=[MessageCreate(role="user", content=f"Use ONLY the grep tool to search for `Nunzia De Girolamo`.")],
    )
    print(f"Grep request sent, got {len(search_files_response.messages)} message(s) in response")
    print(search_files_response.messages)

    # Check that archival_memory_search was called
    tool_calls = [msg for msg in search_files_response.messages if msg.message_type == "tool_call_message"]
    assert len(tool_calls) > 0, "No tool calls found"
    assert any(tc.tool_call.name == "grep" for tc in tool_calls), "search_files not called"

    # Check it returned successfully
    tool_returns = [msg for msg in search_files_response.messages if msg.message_type == "tool_return_message"]
    assert len(tool_returns) > 0, "No tool returns found"
    assert all(tr.status == "success" for tr in tool_returns), "Tool call failed"


def test_view_ranges_have_metadata(client: LettaSDKClient, agent_state: AgentState):
    # Create a new source
    source = client.sources.create(name="test_source", embedding="openai/text-embedding-3-small")

    sources_list = client.sources.list()
    assert len(sources_list) == 1

    # Attach source to agent
    client.agents.sources.attach(source_id=source.id, agent_id=agent_state.id)

    # Load files into the source
    file_path = "tests/data/0_to_99.py"

    # Upload the files
    with open(file_path, "rb") as f:
        job = client.sources.files.upload(source_id=source.id, file=f)

    # Wait for the jobs to complete
    while job.status != "completed":
        print(f"Waiting for job {job.id} to complete... Current status: {job.status}")
        time.sleep(1)
        job = client.jobs.retrieve(job_id=job.id)

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

    # Open a specific range
    start = 50
    end = 55
    open_response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=[
            MessageCreate(
                role="user", content=f"Use ONLY the open_file tool to open the file named {file.file_name} for view range [{start}, {end}]"
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
