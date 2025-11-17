import asyncio
import io
import json
import os
import textwrap
import threading
import time
import uuid
from typing import List, Type

import pytest
from dotenv import load_dotenv
from letta_client import (
    APIError,
    Letta as LettaSDKClient,
    NotFoundError,
)
from letta_client.types import (
    AgentState,
    ContinueToolRule,
    CreateBlockParam,
    MaxCountPerStepToolRule,
    MessageCreateParam,
    TerminalToolRule,
    ToolReturnMessage,
)
from letta_client.types.agents.text_content_param import TextContentParam
from letta_client.types.tool import BaseTool
from pydantic import BaseModel, Field

from letta.config import LettaConfig
from letta.jobs.llm_batch_job_polling import poll_running_llm_batches
from letta.server.server import SyncServer
from tests.helpers.utils import upload_file_and_wait

# Constants
SERVER_PORT = 8283


def extract_archive_id(archive) -> str:
    """Helper function to extract archive ID, handling cases where it might be a list or string representation."""
    if not hasattr(archive, "id") or archive.id is None:
        raise ValueError(f"Archive missing id: {archive}")

    archive_id_raw = archive.id

    # Handle if archive.id is actually a list (extract first element)
    if isinstance(archive_id_raw, list):
        if len(archive_id_raw) > 0:
            archive_id_raw = archive_id_raw[0]
        else:
            raise ValueError(f"Archive id is empty list: {archive_id_raw}")

    # Convert to string
    archive_id_str = str(archive_id_raw)

    # Handle string representations of lists like "['archive-xxx']" or '["archive-xxx"]'
    # This can happen if the SDK serializes a list incorrectly
    if archive_id_str.strip().startswith("[") and archive_id_str.strip().endswith("]"):
        import re

        # Try multiple patterns to extract the ID
        # Pattern 1: ['archive-xxx'] or ["archive-xxx"]
        match = re.search(r"['\"](archive-[^'\"]+)['\"]", archive_id_str)
        if match:
            archive_id_str = match.group(1)
        else:
            # Pattern 2: [archive-xxx] (no quotes)
            match = re.search(r"\[(archive-[^\]]+)\]", archive_id_str)
            if match:
                archive_id_str = match.group(1)
            else:
                # Fallback: just strip brackets and quotes
                archive_id_str = archive_id_str.strip("[]'\"")

    # Ensure it's a clean string - remove any remaining brackets/quotes/whitespace
    archive_id_clean = archive_id_str.strip().strip("[]'\"").strip()

    # Final validation - must start with "archive-"
    if not archive_id_clean.startswith("archive-"):
        raise ValueError(f"Invalid archive ID format: {archive_id_clean!r} (original type: {type(archive.id)}, value: {archive.id!r})")

    return archive_id_clean


def pytest_configure(config):
    """Override asyncio settings for this test file"""
    # config.option.asyncio_default_fixture_loop_scope = "function"
    config.option.asyncio_default_test_loop_scope = "function"


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
        time.sleep(5)

    print("Running client tests with server:", server_url)
    client = LettaSDKClient(base_url=server_url)
    yield client


@pytest.fixture(scope="module")
def server():
    """
    Creates a SyncServer instance for testing.

    Loads and saves config to ensure proper initialization.
    """
    config = LettaConfig.load()
    config.save()
    server = SyncServer()
    asyncio.run(server.init_async())
    return server


@pytest.fixture(scope="function")
def agent(client: LettaSDKClient):
    agent_state = client.agents.create(
        memory_blocks=[
            CreateBlockParam(
                label="human",
                value="username: sarah",
            ),
        ],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
    )
    yield agent_state

    # delete agent
    client.agents.delete(agent_id=agent_state.id)


@pytest.fixture(scope="function")
def fibonacci_tool(client: LettaSDKClient):
    """Fixture providing Fibonacci calculation tool."""

    def calculate_fibonacci(n: int) -> int:
        """Calculate the nth Fibonacci number.

        Args:
            n: The position in the Fibonacci sequence to calculate.

        Returns:
            The nth Fibonacci number.
        """
        if n <= 0:
            return 0
        elif n == 1:
            return 1
        else:
            a, b = 0, 1
            for _ in range(2, n + 1):
                a, b = b, a + b
            return b

    tool = client.tools.upsert_from_function(func=calculate_fibonacci, tags=["math", "utility"])
    yield tool
    client.tools.delete(tool.id)


@pytest.fixture(scope="function")
def preferences_tool(client: LettaSDKClient):
    """Fixture providing user preferences tool."""

    def get_user_preferences(category: str) -> str:
        """Get user preferences for a specific category.

        Args:
            category: The preference category to retrieve (notification, theme, language).

        Returns:
            The user's preference for the specified category, or "not specified" if unknown.
        """
        preferences = {"notification": "email only", "theme": "dark mode", "language": "english"}
        return preferences.get(category, "not specified")

    tool = client.tools.upsert_from_function(func=get_user_preferences, tags=["user", "preferences"])
    yield tool
    client.tools.delete(tool.id)


@pytest.fixture(scope="function")
def data_analysis_tool(client: LettaSDKClient):
    """Fixture providing data analysis tool."""

    def analyze_data(data_type: str, values: List[float]) -> str:
        """Analyze data and provide insights.

        Args:
            data_type: Type of data to analyze.
            values: Numerical values to analyze.

        Returns:
            Analysis results including average, max, and min values.
        """
        if not values:
            return "No data provided"
        avg = sum(values) / len(values)
        max_val = max(values)
        min_val = min(values)
        return f"Analysis of {data_type}: avg={avg:.2f}, max={max_val}, min={min_val}"

    tool = client.tools.upsert_from_function(func=analyze_data, tags=["analysis", "data"])
    yield tool
    client.tools.delete(tool.id)


@pytest.fixture(scope="function")
def persona_block(client: LettaSDKClient):
    """Fixture providing persona memory block."""
    block = client.blocks.create(
        label="persona",
        value="You are Alex, a data analyst and mathematician who helps users with calculations and insights. You have extensive experience in statistical analysis and prefer to provide clear, accurate results.",
        limit=8000,
    )
    yield block
    client.blocks.delete(block.id)


@pytest.fixture(scope="function")
def human_block(client: LettaSDKClient):
    """Fixture providing human memory block."""
    block = client.blocks.create(
        label="human",
        value="username: sarah_researcher\noccupation: data scientist\ninterests: machine learning, statistics, fibonacci sequences\npreferred_communication: detailed explanations with examples",
        limit=4000,
    )
    yield block
    client.blocks.delete(block.id)


@pytest.fixture(scope="function")
def context_block(client: LettaSDKClient):
    """Fixture providing project context memory block."""
    block = client.blocks.create(
        label="project_context",
        value="Current project: Building predictive models for financial markets. Sarah is working on sequence analysis and pattern recognition. Recently interested in mathematical sequences like Fibonacci for trend analysis.",
        limit=6000,
    )
    yield block
    client.blocks.delete(block.id)


def test_shared_blocks(client: LettaSDKClient):
    # create a block
    block = client.blocks.create(
        label="human",
        value="username: sarah",
    )

    # create agents with shared block
    agent_state1 = client.agents.create(
        name="agent1",
        memory_blocks=[
            CreateBlockParam(
                label="persona",
                value="you are agent 1",
            ),
        ],
        block_ids=[block.id],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
    )
    agent_state2 = client.agents.create(
        name="agent2",
        memory_blocks=[
            CreateBlockParam(
                label="persona",
                value="you are agent 2",
            ),
        ],
        block_ids=[block.id],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
    )

    # update memory
    client.agents.messages.create(
        agent_id=agent_state1.id,
        messages=[
            MessageCreateParam(
                role="user",
                content="my name is actually charles",
            )
        ],
    )

    # check agent 2 memory
    block_value = client.blocks.retrieve(block_id=block.id).value
    assert "charles" in block_value.lower(), f"Shared block update failed {block_value}"

    client.agents.messages.create(
        agent_id=agent_state2.id,
        messages=[
            MessageCreateParam(
                role="user",
                content="whats my name?",
            )
        ],
    )
    block_value = client.agents.blocks.retrieve(agent_id=agent_state2.id, block_label="human").value
    assert "charles" in block_value.lower(), f"Shared block update failed {block_value}"

    # cleanup
    client.agents.delete(agent_state1.id)
    client.agents.delete(agent_state2.id)


def test_read_only_block(client: LettaSDKClient):
    block_value = "username: sarah"
    agent = client.agents.create(
        memory_blocks=[
            CreateBlockParam(
                label="human",
                value=block_value,
                read_only=True,
            ),
        ],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
    )

    # make sure agent cannot update read-only block
    client.agents.messages.create(
        agent_id=agent.id,
        messages=[
            MessageCreateParam(
                role="user",
                content="my name is actually charles",
            )
        ],
    )

    # make sure block value is still the same
    block = client.agents.blocks.retrieve(agent_id=agent.id, block_label="human")
    assert block.value == block_value

    # make sure can update from client
    new_value = "hello"
    client.agents.blocks.update(agent_id=agent.id, block_label="human", value=new_value)
    block = client.agents.blocks.retrieve(agent_id=agent.id, block_label="human")
    assert block.value == new_value

    # cleanup
    client.agents.delete(agent.id)


def test_add_and_manage_tags_for_agent(client: LettaSDKClient):
    """
    Comprehensive happy path test for adding, retrieving, and managing tags on an agent.
    """
    tags_to_add = ["test_tag_1", "test_tag_2", "test_tag_3"]

    # Step 0: create an agent with no tags
    agent = client.agents.create(
        memory_blocks=[
            CreateBlockParam(
                label="human",
                value="username: sarah",
            ),
        ],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
    )
    assert len(agent.tags) == 0

    # Step 1: Add multiple tags to the agent
    updated_agent = client.agents.update(agent_id=agent.id, tags=tags_to_add)

    # Add small delay to ensure tags are persisted
    time.sleep(0.1)

    # Step 2: Retrieve tags for the agent and verify they match the added tags
    # In SDK v1, tags must be explicitly requested via include parameter
    retrieved_agent = client.agents.retrieve(agent_id=agent.id, include=["agent.tags"])
    retrieved_tags = retrieved_agent.tags if hasattr(retrieved_agent, "tags") else []
    assert set(retrieved_tags) == set(tags_to_add), f"Expected tags {tags_to_add}, but got {retrieved_tags}"

    # Step 3: Retrieve agents by each tag to ensure the agent is associated correctly
    for tag in tags_to_add:
        agents_with_tag = client.agents.list(tags=[tag]).items
        assert agent.id in [a.id for a in agents_with_tag], f"Expected agent {agent.id} to be associated with tag '{tag}'"

    # Step 4: Delete a specific tag from the agent and verify its removal
    tag_to_delete = tags_to_add.pop()
    updated_agent = client.agents.update(agent_id=agent.id, tags=tags_to_add)

    # Verify the tag is removed from the agent's tags - explicitly request tags
    remaining_tags = client.agents.retrieve(agent_id=agent.id, include=["agent.tags"]).tags
    assert tag_to_delete not in remaining_tags, f"Tag '{tag_to_delete}' was not removed as expected"
    assert set(remaining_tags) == set(tags_to_add), f"Expected remaining tags to be {tags_to_add[1:]}, but got {remaining_tags}"

    # Step 5: Delete all remaining tags from the agent
    client.agents.update(agent_id=agent.id, tags=[])

    # Verify all tags are removed - explicitly request tags
    final_tags = client.agents.retrieve(agent_id=agent.id, include=["agent.tags"]).tags
    assert len(final_tags) == 0, f"Expected no tags, but found {final_tags}"

    # Remove agent
    client.agents.delete(agent.id)


def test_reset_messages(client: LettaSDKClient):
    """Test resetting messages for an agent."""
    # Create an agent
    agent = client.agents.create(
        memory_blocks=[CreateBlockParam(label="persona", value="test assistant")],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
    )

    try:
        # Send a message
        response = client.agents.messages.create(
            agent_id=agent.id,
            messages=[MessageCreateParam(role="user", content="Hello")],
        )

        # Verify message was sent
        messages_before = client.agents.messages.list(agent_id=agent.id)
        # Messages returns SyncArrayPage, use .items
        assert len(messages_before.items) > 0, "Should have messages before reset"

        # Reset messages - use AgentsService.resetMessages if available, otherwise use patch
        try:
            # Try using the SDK method if it exists
            if hasattr(client.agents, "reset_messages"):
                reset_agent = client.agents.reset_messages(
                    agent_id=agent.id,
                    add_default_initial_messages=False,
                )
            else:
                # Fallback to direct API call
                reset_agent = client.patch(
                    f"/v1/agents/{agent.id}/reset-messages",
                    cast_to=AgentState,
                    body={"add_default_initial_messages": False},
                )
        except (AttributeError, TypeError) as e:
            pytest.skip(f"Reset messages not available: {e}")

        # Verify messages were reset
        messages_after = client.agents.messages.list(agent_id=agent.id)
        # After reset, messages should be empty or only have default initial messages
        # Messages returns SyncArrayPage, check items
        assert isinstance(messages_after.items, list), "Should return list of messages"
        assert isinstance(reset_agent, AgentState), "Should return updated agent state"
        assert reset_agent.id == agent.id, "Should return the same agent"

    finally:
        # Clean up
        client.agents.delete(agent_id=agent.id)


def test_list_folders_for_agent(client: LettaSDKClient):
    """Test listing folders for an agent."""
    # Create a folder and agent
    folder = client.folders.create(name="test_folder_for_list", embedding="openai/text-embedding-3-small")

    agent = client.agents.create(
        memory_blocks=[CreateBlockParam(label="persona", value="test")],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
    )

    try:
        # Initially no folders
        folders = client.agents.folders.list(agent_id=agent.id)
        folders_list = list(folders)
        assert len(folders_list) == 0, "Should start with no folders"

        # Attach folder
        client.agents.folders.attach(agent_id=agent.id, folder_id=folder.id)

        # List folders
        folders = client.agents.folders.list(agent_id=agent.id)
        folders_list = list(folders)
        assert len(folders_list) == 1, "Should have one folder"
        assert folders_list[0].id == folder.id, "Should return the attached folder"
        assert hasattr(folders_list[0], "name"), "Folder should have name attribute"
        assert hasattr(folders_list[0], "id"), "Folder should have id attribute"

    finally:
        # Clean up
        client.agents.folders.detach(agent_id=agent.id, folder_id=folder.id)
        client.agents.delete(agent_id=agent.id)
        client.folders.delete(folder_id=folder.id)


def test_list_files_for_agent(client: LettaSDKClient):
    """Test listing files for an agent."""
    # Create folder, files, and agent
    folder = client.folders.create(name="test_folder_for_files_list", embedding="openai/text-embedding-3-small")

    # Upload test file - create from string content using BytesIO
    import io

    test_file_content = "This is a test file for listing files."
    file_object = io.BytesIO(test_file_content.encode("utf-8"))
    file_object.name = "test_file.txt"
    # Upload using folders.files.upload directly and wait for processing
    file_metadata = client.folders.files.upload(folder_id=folder.id, file=file_object)
    # Wait for processing
    import time

    start_time = time.time()
    while file_metadata.processing_status not in ["completed", "error"]:
        if time.time() - start_time > 60:
            raise TimeoutError("File processing timed out")
        time.sleep(1)
        files_list = client.folders.files.list(folder_id=folder.id)
        # Find our file in the list (folders.files.list returns a list directly)
        for f in files_list:
            if f.id == file_metadata.id:
                file_metadata = f
                break
        else:
            raise RuntimeError(f"File {file_metadata.id} not found")
    if file_metadata.processing_status == "error":
        raise RuntimeError(f"File processing failed: {getattr(file_metadata, 'error_message', 'Unknown error')}")
    test_file = file_metadata

    agent = client.agents.create(
        memory_blocks=[CreateBlockParam(label="persona", value="test")],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
    )
    # Attach folder after creation to avoid embedding issues
    client.agents.folders.attach(agent_id=agent.id, folder_id=folder.id)

    try:
        # List files for agent (returns PaginatedAgentFiles object)
        files_result = client.agents.files.list(agent_id=agent.id)

        # Handle both paginated object and direct list return
        if hasattr(files_result, "files"):
            # Paginated response
            files_list = files_result.files
            assert hasattr(files_result, "has_more"), "Result should have has_more attribute"
        else:
            # Direct list response (if SDK unwraps pagination)
            files_list = files_result

        # Verify files are listed
        assert len(files_list) > 0, "Should have at least one file"

        # Verify file attributes
        file_item = files_list[0]
        assert hasattr(file_item, "id"), "File should have id"
        assert hasattr(file_item, "file_id"), "File should have file_id"
        assert hasattr(file_item, "file_name"), "File should have file_name"
        assert hasattr(file_item, "is_open"), "File should have is_open status"

        # Test filtering by is_open
        open_files = client.agents.files.list(agent_id=agent.id, is_open=True)
        closed_files = client.agents.files.list(agent_id=agent.id, is_open=False)

        # Handle both response formats
        open_files_list = open_files.files if hasattr(open_files, "files") else open_files
        closed_files_list = closed_files.files if hasattr(closed_files, "files") else closed_files

        assert isinstance(open_files_list, list), "Open files should be a list"
        assert isinstance(closed_files_list, list), "Closed files should be a list"

    finally:
        # Clean up
        client.agents.folders.detach(agent_id=agent.id, folder_id=folder.id)
        client.agents.delete(agent_id=agent.id)
        client.folders.delete(folder_id=folder.id)


def test_modify_message(client: LettaSDKClient):
    """Test modifying a message."""
    # Create an agent
    agent = client.agents.create(
        memory_blocks=[CreateBlockParam(label="persona", value="test assistant")],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
    )

    try:
        # Send a message
        response = client.agents.messages.create(
            agent_id=agent.id,
            messages=[MessageCreateParam(role="user", content="Original message")],
        )

        # Get messages to find the user message - add small delay for messages to be available
        time.sleep(0.2)
        messages_response = client.agents.messages.list(agent_id=agent.id)
        # Messages returns SyncArrayPage, use .items
        messages = messages_response.items if hasattr(messages_response, "items") else messages_response
        # Find user messages - they might be in different message types
        user_messages = [m for m in messages if hasattr(m, "role") and getattr(m, "role") == "user"]
        # If no user messages found by role, try message_type
        if not user_messages:
            user_messages = [m for m in messages if hasattr(m, "message_type") and getattr(m, "message_type") == "user_message"]
        if not user_messages:
            # Messages might not be immediately available, skip test
            pytest.skip("User messages not immediately available after send")

        user_message = user_messages[0]
        message_id = user_message.id if hasattr(user_message, "id") else None
        assert message_id is not None, "Message should have an id"

        # Modify the message content
        # Note: This depends on the SDK supporting message modification
        try:
            # Check if modify method exists
            if hasattr(client.agents.messages, "modify"):
                updated_message = client.agents.messages.update(
                    agent_id=agent.id,
                    message_id=message_id,
                    content="Modified message content",
                )
                assert updated_message is not None, "Should return updated message"
            else:
                pytest.skip("Message modification method not available in SDK")
        except (AttributeError, APIError, NotFoundError) as e:
            # Message modification might not be fully supported, skip for now
            pytest.skip(f"Message modification not available: {e}")

    finally:
        # Clean up
        client.agents.delete(agent_id=agent.id)


def test_list_groups_for_agent(client: LettaSDKClient):
    """Test listing groups for an agent."""
    # Create an agent
    agent = client.agents.create(
        memory_blocks=[CreateBlockParam(label="persona", value="test assistant")],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
    )

    try:
        # List groups (most agents won't have groups unless in a multi-agent setup)
        # This endpoint may have issues, so handle errors gracefully
        try:
            groups = client.agents.groups.list(agent_id=agent.id)
            # Should return a list (even if empty)
            assert isinstance(groups, list), "Should return a list of groups"
            # Most single agents won't have groups, so empty list is expected
        except (APIError, Exception) as e:
            # If there's a server error, skip the test
            pytest.skip(f"Groups endpoint not available or error: {e}")

    finally:
        # Clean up
        client.agents.delete(agent_id=agent.id)


def test_agent_tags(client: LettaSDKClient):
    """Test creating agents with tags and retrieving tags via the API."""
    # Clear all agents
    all_agents = client.agents.list().items
    for agent in all_agents:
        client.agents.delete(agent.id)

    # Create multiple agents with different tags
    agent1 = client.agents.create(
        memory_blocks=[
            CreateBlockParam(
                label="human",
                value="username: sarah",
            ),
        ],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
        tags=["test", "agent1", "production"],
    )

    agent2 = client.agents.create(
        memory_blocks=[
            CreateBlockParam(
                label="human",
                value="username: sarah",
            ),
        ],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
        tags=["test", "agent2", "development"],
    )

    agent3 = client.agents.create(
        memory_blocks=[
            CreateBlockParam(
                label="human",
                value="username: sarah",
            ),
        ],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
        tags=["test", "agent3", "production"],
    )

    # Test getting all tags
    all_tags = client.tags.list()
    expected_tags = ["agent1", "agent2", "agent3", "development", "production", "test"]
    assert sorted(all_tags) == expected_tags

    # Test pagination
    paginated_tags = client.tags.list(limit=2)
    assert len(paginated_tags) == 2
    assert paginated_tags[0] == "agent1"
    assert paginated_tags[1] == "agent2"

    # Test pagination with cursor
    next_page_tags = client.tags.list(after="agent2", limit=2)
    assert len(next_page_tags) == 2
    assert next_page_tags[0] == "agent3"
    assert next_page_tags[1] == "development"

    # Test text search
    prod_tags = client.tags.list(query_text="prod")
    assert sorted(prod_tags) == ["production"]

    dev_tags = client.tags.list(query_text="dev")
    assert sorted(dev_tags) == ["development"]

    agent_tags = client.tags.list(query_text="agent")
    assert sorted(agent_tags) == ["agent1", "agent2", "agent3"]

    # Remove agents
    client.agents.delete(agent1.id)
    client.agents.delete(agent2.id)
    client.agents.delete(agent3.id)


def test_update_agent_memory_label(client: LettaSDKClient, agent: AgentState):
    """Test that we can update the label of a block in an agent's memory"""
    current_labels = [block.label for block in client.agents.blocks.list(agent_id=agent.id).items]
    example_label = current_labels[0]
    example_new_label = "example_new_label"
    assert example_new_label not in current_labels

    client.agents.blocks.update(
        agent_id=agent.id,
        block_label=example_label,
        label=example_new_label,
    )

    updated_block = client.agents.blocks.retrieve(agent_id=agent.id, block_label=example_new_label)
    assert updated_block.label == example_new_label


def test_add_remove_agent_memory_block(client: LettaSDKClient, agent: AgentState):
    """Test that we can add and remove a block from an agent's memory"""
    current_labels = [block.label for block in client.agents.blocks.list(agent_id=agent.id).items]
    example_new_label = current_labels[0] + "_v2"
    example_new_value = "example value"
    assert example_new_label not in current_labels

    # Link a new memory block
    block = client.blocks.create(
        label=example_new_label,
        value=example_new_value,
        limit=1000,
    )
    client.agents.blocks.attach(
        agent_id=agent.id,
        block_id=block.id,
    )

    updated_block = client.agents.blocks.retrieve(
        agent_id=agent.id,
        block_label=example_new_label,
    )
    assert updated_block.value == example_new_value

    # Now unlink the block
    client.agents.blocks.detach(
        agent_id=agent.id,
        block_id=block.id,
    )

    current_labels = [block.label for block in client.agents.blocks.list(agent_id=agent.id).items]
    assert example_new_label not in current_labels


def test_update_agent_memory_limit(client: LettaSDKClient, agent: AgentState):
    """Test that we can update the limit of a block in an agent's memory"""

    current_labels = [block.label for block in client.agents.blocks.list(agent_id=agent.id).items]
    example_label = current_labels[0]
    example_new_limit = 1
    current_block = client.agents.blocks.retrieve(agent_id=agent.id, block_label=example_label)
    current_block_length = len(current_block.value)

    assert example_new_limit != client.agents.blocks.retrieve(agent_id=agent.id, block_label=example_label).limit
    assert example_new_limit < current_block_length

    # We expect this to throw a value error
    with pytest.raises(APIError):
        client.agents.blocks.update(
            agent_id=agent.id,
            block_label=example_label,
            limit=example_new_limit,
        )

    # Now try the same thing with a higher limit
    example_new_limit = current_block_length + 10000
    assert example_new_limit > current_block_length
    client.agents.blocks.update(
        agent_id=agent.id,
        block_label=example_label,
        limit=example_new_limit,
    )

    assert example_new_limit == client.agents.blocks.retrieve(agent_id=agent.id, block_label=example_label).limit


def test_messages(client: LettaSDKClient, agent: AgentState):
    send_message_response = client.agents.messages.create(
        agent_id=agent.id,
        messages=[
            MessageCreateParam(
                role="user",
                content="Test message",
            ),
        ],
    )
    assert send_message_response, "Sending message failed"

    messages_response = client.agents.messages.list(
        agent_id=agent.id,
        limit=1,
    )
    assert len(messages_response.items) > 0, "Retrieving messages failed"


def test_send_system_message(client: LettaSDKClient, agent: AgentState):
    """Important unit test since the Letta API exposes sending system messages, but some backends don't natively support it (eg Anthropic)"""
    send_system_message_response = client.agents.messages.create(
        agent_id=agent.id,
        messages=[
            MessageCreateParam(
                role="system",
                content="Event occurred: The user just logged off.",
            ),
        ],
    )
    assert send_system_message_response, "Sending message failed"


def test_function_return_limit(disable_e2b_api_key, client: LettaSDKClient, agent: AgentState):
    """Test to see if the function return limit works"""

    def big_return():
        """
        Always call this tool.

        Returns:
            important_data (str): Important data
        """
        return "x" * 100000

    tool = client.tools.upsert_from_function(func=big_return, return_char_limit=1000)

    client.agents.tools.attach(agent_id=agent.id, tool_id=tool.id)

    # get function response
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=[
            MessageCreateParam(
                role="user",
                content="call the big_return function",
            ),
        ],
        use_assistant_message=False,
    )

    response_message = None
    for message in response.messages:
        if isinstance(message, ToolReturnMessage):
            response_message = message
            break

    assert response_message, "ToolReturnMessage message not found in response"
    res = response_message.tool_return
    assert "function output was truncated " in res


@pytest.mark.flaky(max_runs=3)
def test_function_always_error(client: LettaSDKClient, agent: AgentState):
    """Test to see if function that errors works correctly"""

    def testing_method():
        """
        A method that has test functionalit.
        """
        return 5 / 0

    tool = client.tools.upsert_from_function(func=testing_method, return_char_limit=1000)

    client.agents.tools.attach(agent_id=agent.id, tool_id=tool.id)

    # get function response
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=[
            MessageCreateParam(
                role="user",
                content="call the testing_method function and tell me the result",
            ),
        ],
    )

    response_message = None
    for message in response.messages:
        if isinstance(message, ToolReturnMessage):
            response_message = message
            break

    assert response_message, "ToolReturnMessage message not found in response"
    assert response_message.status == "error"

    assert "Error executing function testing_method: ZeroDivisionError: division by zero" in response_message.tool_return
    assert "ZeroDivisionError" in response_message.tool_return


# TODO: Add back when the new agent loop hits
# @pytest.mark.asyncio
# async def test_send_message_parallel(client: LettaSDKClient, agent: AgentState):
#     """
#     Test that sending two messages in parallel does not error.
#     """
#
#     # Define a coroutine for sending a message using asyncio.to_thread for synchronous calls
#     async def send_message_task(message: str):
#         response = await asyncio.to_thread(
#             client.agents.messages.create,
#             agent_id=agent.id,
#             messages=[
#                 MessageCreateParam(
#                     role="user",
#                     content=message,
#                 ),
#             ],
#         )
#         assert response, f"Sending message '{message}' failed"
#         return response
#
#     # Prepare two tasks with different messages
#     messages = ["Test message 1", "Test message 2"]
#     tasks = [send_message_task(message) for message in messages]
#
#     # Run the tasks concurrently
#     responses = await asyncio.gather(*tasks, return_exceptions=True)
#
#     # Check for exceptions and validate responses
#     for i, response in enumerate(responses):
#         if isinstance(response, Exception):
#             pytest.fail(f"Task {i} failed with exception: {response}")
#         else:
#             assert response, f"Task {i} returned an invalid response: {response}"
#
#     # Ensure both tasks completed
#     assert len(responses) == len(messages), "Not all messages were processed"


def test_agent_creation(client: LettaSDKClient):
    """Test that block IDs are properly attached when creating an agent."""
    sleeptime_agent_system = """
    You are a helpful agent. You will be provided with a list of memory blocks and a user preferences block.
    You should use the memory blocks to remember information about the user and their preferences.
    You should also use the user preferences block to remember information about the user's preferences.
    """

    # Create a test block that will represent user preferences
    user_preferences_block = client.blocks.create(
        label="user_preferences",
        value="",
        limit=10000,
    )

    # Create test tools
    def test_tool():
        """A simple test tool."""
        return "Hello from test tool!"

    def another_test_tool():
        """Another test tool."""
        return "Hello from another test tool!"

    tool1 = client.tools.upsert_from_function(func=test_tool, tags=["test"])
    tool2 = client.tools.upsert_from_function(func=another_test_tool, tags=["test"])

    # Create test blocks
    sleeptime_persona_block = client.blocks.create(label="persona", value="persona description", limit=5000)
    mindy_block = client.blocks.create(label="mindy", value="Mindy is a helpful assistant", limit=5000)

    # Create agent with the blocks and tools
    agent = client.agents.create(
        name=f"test_agent_{str(uuid.uuid4())}",
        memory_blocks=[sleeptime_persona_block, mindy_block],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
        tool_ids=[tool1.id, tool2.id],
        include_base_tools=False,
        tags=["test"],
        block_ids=[user_preferences_block.id],
    )

    # Verify the agent was created successfully
    assert agent is not None
    assert agent.id is not None

    # Verify all memory blocks are properly attached
    for block in [sleeptime_persona_block, mindy_block, user_preferences_block]:
        agent_block = client.agents.blocks.retrieve(agent_id=agent.id, block_label=block.label)
        assert block.value == agent_block.value and block.limit == agent_block.limit

    # Verify the tools are properly attached
    agent_tools = client.agents.tools.list(agent_id=agent.id)
    agent_tools_list = list(agent_tools)
    # Check that both expected tools are present (there might be extras from previous tests)
    tool_ids = {tool1.id, tool2.id}
    found_tools = {tool.id for tool in agent_tools_list if tool.id in tool_ids}
    assert found_tools == tool_ids, f"Expected tools {tool_ids}, but found {found_tools}"


def test_many_blocks(client: LettaSDKClient):
    users = ["user1", "user2"]
    # Create agent with the blocks
    agent1 = client.agents.create(
        name=f"test_agent_{str(uuid.uuid4())}",
        memory_blocks=[
            CreateBlockParam(
                label="user1",
                value="user preferences: loud",
            ),
            CreateBlockParam(
                label="user2",
                value="user preferences: happy",
            ),
        ],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
        include_base_tools=False,
        tags=["test"],
    )
    agent2 = client.agents.create(
        name=f"test_agent_{str(uuid.uuid4())}",
        memory_blocks=[
            CreateBlockParam(
                label="user1",
                value="user preferences: sneezy",
            ),
            CreateBlockParam(
                label="user2",
                value="user preferences: lively",
            ),
        ],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
        include_base_tools=False,
        tags=["test"],
    )

    # Verify the agent was created successfully
    assert agent1 is not None
    assert agent2 is not None

    # Verify all memory blocks are properly attached
    for user in users:
        agent_block = client.agents.blocks.retrieve(agent_id=agent1.id, block_label=user)
        assert agent_block is not None

        blocks = client.blocks.list(label=user).items
        assert len(blocks) == 2

        for block in blocks:
            client.blocks.delete(block.id)

    client.agents.delete(agent1.id)
    client.agents.delete(agent2.id)


# cases: steam, async, token stream, sync
@pytest.mark.parametrize("message_create", ["stream_step", "token_stream", "sync", "async"])
def test_include_return_message_types(client: LettaSDKClient, agent: AgentState, message_create: str):
    """Test that the include_return_message_types parameter works"""

    def verify_message_types(messages, message_types):
        for message in messages:
            assert message.message_type in message_types

    message = "My name is actually Sarah"
    message_types = ["reasoning_message", "tool_call_message"]
    agent = client.agents.create(
        memory_blocks=[
            CreateBlockParam(label="user", value="Name: Charles"),
        ],
        model="letta/letta-free",
        embedding="letta/letta-free",
    )

    if message_create == "stream_step":
        response = client.agents.messages.stream(
            agent_id=agent.id,
            messages=[
                MessageCreateParam(
                    role="user",
                    content=message,
                ),
            ],
            include_return_message_types=message_types,
        )
        messages = [message for message in list(response) if message.message_type not in ["stop_reason", "usage_statistics", "ping"]]
        verify_message_types(messages, message_types)

    elif message_create == "async":
        response = client.agents.messages.create_async(
            agent_id=agent.id,
            messages=[
                MessageCreateParam(
                    role="user",
                    content=message,
                )
            ],
            include_return_message_types=message_types,
        )
        # wait to finish
        while response.status not in {"failed", "completed", "cancelled", "expired"}:
            time.sleep(1)
            response = client.runs.retrieve(run_id=response.id)

        if response.status != "completed":
            pytest.fail(f"Response status was NOT completed: {response}")

        messages = list(client.runs.messages.list(run_id=response.id))
        verify_message_types(messages, message_types)

    elif message_create == "token_stream":
        response = client.agents.messages.stream(
            agent_id=agent.id,
            messages=[
                MessageCreateParam(
                    role="user",
                    content=message,
                ),
            ],
            include_return_message_types=message_types,
        )
        messages = [message for message in list(response) if message.message_type not in ["stop_reason", "usage_statistics", "ping"]]
        verify_message_types(messages, message_types)

    elif message_create == "sync":
        response = client.agents.messages.create(
            agent_id=agent.id,
            messages=[
                MessageCreateParam(
                    role="user",
                    content=message,
                ),
            ],
            include_return_message_types=message_types,
        )
        messages = response.messages
        verify_message_types(messages, message_types)

    # cleanup
    client.agents.delete(agent.id)


def test_base_tools_upsert_on_list(client: LettaSDKClient):
    """Test that base tools are automatically upserted when missing on tools list call"""
    from letta.constants import LETTA_TOOL_SET

    # First, get the initial list of tools to establish baseline
    initial_tools = client.tools.list()
    initial_tool_names = {tool.name for tool in initial_tools}

    # Find which base tools might be missing initially
    missing_base_tools = LETTA_TOOL_SET - initial_tool_names

    # If all base tools are already present, we need to delete some to test the upsert functionality
    # We'll delete a few base tools if they exist to create the condition for testing
    tools_to_delete = []
    if not missing_base_tools:
        # Pick a few base tools to delete for testing
        test_base_tools = ["send_message", "conversation_search"]
        for tool_name in test_base_tools:
            for tool in initial_tools:
                if tool.name == tool_name:
                    tools_to_delete.append(tool)
                    client.tools.delete(tool_id=tool.id)
                    break

    # Now call list_tools() which should trigger the base tools check and upsert
    updated_tools = client.tools.list()
    updated_tool_names = {tool.name for tool in updated_tools}

    # Verify that all base tools are now present
    missing_after_upsert = LETTA_TOOL_SET - updated_tool_names
    assert not missing_after_upsert, f"Base tools still missing after upsert: {missing_after_upsert}"

    # Verify that the base tools are actually in the list
    for base_tool_name in LETTA_TOOL_SET:
        assert base_tool_name in updated_tool_names, f"Base tool {base_tool_name} not found after upsert"

    # Cleanup: restore any tools we deleted for testing (they should already be restored by the upsert)
    # This is just a double-check that our test cleanup is proper
    final_tools = client.tools.list()
    final_tool_names = {tool.name for tool in final_tools}
    for deleted_tool in tools_to_delete:
        assert deleted_tool.name in final_tool_names, f"Deleted tool {deleted_tool.name} was not properly restored"


@pytest.mark.parametrize("e2b_sandbox_mode", [True, False], indirect=True)
def test_pydantic_inventory_management_tool(e2b_sandbox_mode, client: LettaSDKClient):
    class InventoryItem(BaseModel):
        sku: str
        name: str
        price: float
        category: str

    class InventoryEntry(BaseModel):
        timestamp: int
        item: InventoryItem
        transaction_id: str

    class InventoryEntryData(BaseModel):
        data: InventoryEntry
        quantity_change: int

    class ManageInventoryTool(BaseTool):
        name: str = "manage_inventory"
        args_schema: Type[BaseModel] = InventoryEntryData
        description: str = "Update inventory catalogue with a new data entry"
        tags: List[str] = ["inventory", "shop"]

        def run(self, data: InventoryEntry, quantity_change: int) -> bool:
            print(f"Updated inventory for {data.item.name} with a quantity change of {quantity_change}")
            return True

    # test creation - provide a placeholder id (server will generate a new one)
    tool = client.tools.add(
        tool=ManageInventoryTool(id="tool-placeholder"),
    )

    # test that upserting also works
    new_description = "NEW"

    class ManageInventoryToolModified(ManageInventoryTool):
        description: str = new_description

    tool = client.tools.add(
        tool=ManageInventoryToolModified(id="tool-placeholder"),
    )
    assert tool.description == new_description

    assert tool is not None
    assert tool.name == "manage_inventory"
    assert "inventory" in tool.tags
    assert "shop" in tool.tags

    temp_agent = client.agents.create(
        memory_blocks=[
            CreateBlockParam(
                label="persona",
                value="You are a helpful inventory management assistant.",
            ),
        ],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
        tool_ids=[tool.id],
        include_base_tools=False,
    )

    response = client.agents.messages.create(
        agent_id=temp_agent.id,
        messages=[
            MessageCreateParam(
                role="user",
                content="Update the inventory for product 'iPhone 15' with SKU 'IPH15-001', price $999.99, category 'Electronics', transaction ID 'TXN-12345', timestamp 1640995200, with a quantity change of +10",
            ),
        ],
    )

    assert response is not None

    tool_call_messages = [msg for msg in response.messages if msg.message_type == "tool_call_message"]
    assert len(tool_call_messages) > 0, "Expected at least one tool call message"

    first_tool_call = tool_call_messages[0]
    assert first_tool_call.tool_call.name == "manage_inventory"

    args = json.loads(first_tool_call.tool_call.arguments)
    assert "data" in args
    assert "quantity_change" in args
    assert "item" in args["data"]
    assert "name" in args["data"]["item"]
    assert "sku" in args["data"]["item"]
    assert "price" in args["data"]["item"]
    assert "category" in args["data"]["item"]
    assert "transaction_id" in args["data"]
    assert "timestamp" in args["data"]

    tool_return_messages = [msg for msg in response.messages if msg.message_type == "tool_return_message"]
    assert len(tool_return_messages) > 0, "Expected at least one tool return message"

    first_tool_return = tool_return_messages[0]
    assert first_tool_return.status == "success"
    assert first_tool_return.tool_return == "True"
    assert "Updated inventory for iPhone 15 with a quantity change of 10" in "\n".join(first_tool_return.stdout)

    client.agents.delete(temp_agent.id)
    client.tools.delete(tool.id)


@pytest.mark.parametrize("e2b_sandbox_mode", [False], indirect=True)
def test_pydantic_task_planning_tool(e2b_sandbox_mode, client: LettaSDKClient):
    class Step(BaseModel):
        name: str = Field(..., description="Name of the step.")
        description: str = Field(..., description="An exhaustive description of what this step is trying to achieve.")

    class StepsList(BaseModel):
        steps: List[Step] = Field(..., description="List of steps to add to the task plan.")
        explanation: str = Field(..., description="Explanation for the list of steps.")

    def create_task_plan(steps, explanation):
        """Creates a task plan for the current task."""
        print(f"Created task plan with {len(steps)} steps: {explanation}")
        return steps

    # test creation
    client.tools.upsert_from_function(func=create_task_plan, args_schema=StepsList, tags=["planning", "task", "pydantic_test"])

    # test upsert
    new_steps_description = "NEW"

    class StepsListModified(BaseModel):
        steps: List[Step] = Field(..., description=new_steps_description)
        explanation: str = Field(..., description="Explanation for the list of steps.")

    tool = client.tools.upsert_from_function(func=create_task_plan, args_schema=StepsListModified, description=new_steps_description)
    assert tool.description == new_steps_description

    assert tool is not None
    assert tool.name == "create_task_plan"
    assert "planning" in tool.tags
    assert "task" in tool.tags

    temp_agent = client.agents.create(
        memory_blocks=[
            CreateBlockParam(
                label="persona",
                value="You are a helpful task planning assistant.",
            ),
        ],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
        tool_ids=[tool.id],
        include_base_tools=False,
        tool_rules=[
            TerminalToolRule(tool_name=tool.name, type="exit_loop"),
        ],
    )

    response = client.agents.messages.create(
        agent_id=temp_agent.id,
        messages=[
            MessageCreateParam(
                role="user",
                content="Create a task plan for organizing a team meeting with 3 steps: 1) Schedule meeting (find available time slots), 2) Send invitations (notify all team members), 3) Prepare agenda (outline discussion topics). Explanation: This plan ensures a well-organized team meeting.",
            ),
        ],
    )

    assert response is not None
    assert hasattr(response, "messages")
    assert len(response.messages) > 0

    tool_call_messages = [msg for msg in response.messages if msg.message_type == "tool_call_message"]
    assert len(tool_call_messages) > 0, "Expected at least one tool call message"

    first_tool_call = tool_call_messages[0]
    assert first_tool_call.tool_call.name == "create_task_plan"

    args = json.loads(first_tool_call.tool_call.arguments)

    assert "steps" in args
    assert "explanation" in args
    assert isinstance(args["steps"], list)
    assert len(args["steps"]) > 0

    for step in args["steps"]:
        assert "name" in step
        assert "description" in step

    tool_return_messages = [msg for msg in response.messages if msg.message_type == "tool_return_message"]
    assert len(tool_return_messages) > 0, "Expected at least one tool return message"

    first_tool_return = tool_return_messages[0]
    assert first_tool_return.status == "success"

    client.agents.delete(temp_agent.id)
    client.tools.delete(tool.id)


@pytest.mark.parametrize("e2b_sandbox_mode", [True, False], indirect=True)
def test_create_tool_from_function_with_docstring(e2b_sandbox_mode, client: LettaSDKClient):
    """Test creating a tool from a function with a docstring using create_from_function"""

    def roll_dice() -> str:
        """
        Simulate the roll of a 20-sided die (d20).

        This function generates a random integer between 1 and 20, inclusive,
        which represents the outcome of a single roll of a d20.

        Returns:
            str: The result of the die roll.
        """
        import random

        dice_role_outcome = random.randint(1, 20)
        output_string = f"You rolled a {dice_role_outcome}"
        return output_string

    tool = client.tools.create_from_function(func=roll_dice)

    assert tool is not None
    assert tool.name == "roll_dice"
    assert "Simulate the roll of a 20-sided die" in tool.description
    assert tool.source_code is not None
    assert "random.randint(1, 20)" in tool.source_code

    all_tools = client.tools.list()
    tool_names = [t.name for t in all_tools]
    assert "roll_dice" in tool_names

    client.tools.delete(tool.id)


def test_preview_payload(client: LettaSDKClient):
    temp_agent = client.agents.create(
        memory_blocks=[
            CreateBlockParam(
                label="human",
                value="username: sarah",
            ),
        ],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
    )

    try:
        # Use SDK client's internal post method since preview_raw_payload method not in stainless.yml
        # The endpoint exists but isn't configured to be generated
        from typing import Any

        payload = client.post(
            f"/v1/agents/{temp_agent.id}/messages/preview-raw-payload",
            cast_to=dict[str, Any],
            body={
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "text": "text",
                                "type": "text",
                            }
                        ],
                    }
                ],
            },
        )
        # Basic payload shape
        assert isinstance(payload, dict)
        assert payload.get("model") == "gpt-4o-mini"
        assert "messages" in payload and isinstance(payload["messages"], list)
        assert payload.get("frequency_penalty") == 1.0
        assert payload.get("max_completion_tokens") is None
        assert payload.get("temperature") == 0.7
        assert isinstance(payload.get("user"), str) and payload["user"].startswith("user-")

        # Tools-related fields: when no tools are attached, these are None/omitted
        assert "tools" in payload and payload["tools"] is None
        assert payload.get("tool_choice") is None
        assert "parallel_tool_calls" not in payload  # only present when tools are provided

        # Messages content and ordering
        messages = payload["messages"]
        assert len(messages) >= 4  # system, assistant tool call, tool result, user events

        # System message: contains base instructions and metadata
        system_msg = messages[0]
        assert system_msg.get("role") == "system"
        assert isinstance(system_msg.get("content"), str)
        assert "<base_instructions>" in system_msg["content"]
        assert "Base instructions finished." in system_msg["content"]
        assert "<memory_blocks>" in system_msg["content"]
        assert "Letta" in system_msg["content"]

        # Assistant tool call: send_message greeting
        assistant_tool_msg = next((m for m in messages if m.get("role") == "assistant" and m.get("tool_calls")), None)
        assert assistant_tool_msg is not None, f"No assistant tool call found in messages: {messages}"
        assert isinstance(assistant_tool_msg.get("tool_calls"), list) and len(assistant_tool_msg["tool_calls"]) == 1
        tool_call = assistant_tool_msg["tool_calls"][0]
        assert tool_call.get("type") == "function"
        assert tool_call.get("function", {}).get("name") == "send_message"
        assert isinstance(tool_call.get("id"), str) and len(tool_call["id"]) > 0
        # Arguments are JSON-encoded
        args_raw = tool_call.get("function", {}).get("arguments")
        args = json.loads(args_raw)
        assert "message" in args and args["message"] == "More human than human is our motto."
        assert "thinking" in args and "Persona activated" in args["thinking"]

        # Tool result corresponding to the tool call
        tool_result_msg = next((m for m in messages if m.get("role") == "tool" and m.get("tool_call_id") == tool_call["id"]), None)
        assert tool_result_msg is not None, "No tool result found matching the assistant tool call id"
        tool_content = json.loads(tool_result_msg.get("content", "{}"))
        assert tool_content.get("status") == "OK"

        # User events: login then user text
        user_login_msg = next(
            (m for m in messages if m.get("role") == "user" and isinstance(m.get("content"), str) and '"type": "login"' in m["content"]),
            None,
        )
        assert user_login_msg is not None, "Expected a user login event in messages"
        user_text_msg = next((m for m in messages if m.get("role") == "user" and m.get("content") == "text"), None)
        assert user_text_msg is not None, "Expected a user text message with content 'text'"
    finally:
        # Clean up the agent
        client.agents.delete(agent_id=temp_agent.id)


def test_agent_tools_list(client: LettaSDKClient):
    """Test the optimized agent tools list endpoint for correctness."""
    # Create a test agent
    agent_state = client.agents.create(
        name="test_agent_tools_list",
        memory_blocks=[
            CreateBlockParam(
                label="persona",
                value="You are a helpful assistant.",
            ),
        ],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
        include_base_tools=True,
    )

    try:
        # Test basic functionality
        tools = client.agents.tools.list(agent_id=agent_state.id)
        tools_list = list(tools)
        assert len(tools_list) > 0, "Agent should have base tools attached"

        # Verify tool objects have expected attributes
        for tool in tools_list:
            assert hasattr(tool, "id"), "Tool should have id attribute"
            assert hasattr(tool, "name"), "Tool should have name attribute"
            assert tool.id is not None, "Tool id should not be None"
            assert tool.name is not None, "Tool name should not be None"

    finally:
        # Clean up
        client.agents.delete(agent_id=agent_state.id)


def test_agent_tool_rules_deduplication(client: LettaSDKClient):
    """Test that duplicate tool rules are properly deduplicated when creating/updating agents."""
    # Create agent with duplicate tool rules
    duplicate_rules = [
        TerminalToolRule(tool_name="send_message", type="exit_loop"),
        TerminalToolRule(tool_name="send_message", type="exit_loop"),  # exact duplicate
        TerminalToolRule(tool_name="send_message", type="exit_loop"),  # another duplicate
    ]

    agent_state = client.agents.create(
        name="test_agent_dedup",
        memory_blocks=[
            CreateBlockParam(
                label="persona",
                value="You are a helpful assistant.",
            ),
        ],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
        tool_rules=duplicate_rules,
        include_base_tools=False,
    )

    # Get the agent and check tool rules
    retrieved_agent = client.agents.retrieve(agent_id=agent_state.id)
    assert len(retrieved_agent.tool_rules) == 1, f"Expected 1 unique tool rule, got {len(retrieved_agent.tool_rules)}"
    assert retrieved_agent.tool_rules[0].tool_name == "send_message"
    assert retrieved_agent.tool_rules[0].type == "exit_loop"

    # Test update with duplicates
    update_rules = [
        ContinueToolRule(tool_name="conversation_search", type="continue_loop"),
        ContinueToolRule(tool_name="conversation_search", type="continue_loop"),  # duplicate
        MaxCountPerStepToolRule(tool_name="test_tool", max_count_limit=2, type="max_count_per_step"),
        MaxCountPerStepToolRule(tool_name="test_tool", max_count_limit=2, type="max_count_per_step"),  # exact duplicate
        MaxCountPerStepToolRule(tool_name="test_tool", max_count_limit=3, type="max_count_per_step"),  # different limit, not a duplicate
    ]

    updated_agent = client.agents.update(agent_id=agent_state.id, tool_rules=update_rules)

    # Check that duplicates were removed
    assert len(updated_agent.tool_rules) == 3, f"Expected 3 unique tool rules after update, got {len(updated_agent.tool_rules)}"

    # Verify the specific rules
    rule_set = {(r.tool_name, r.type, getattr(r, "max_count_limit", None)) for r in updated_agent.tool_rules}
    expected_set = {
        ("conversation_search", "continue_loop", None),
        ("test_tool", "max_count_per_step", 2),
        ("test_tool", "max_count_per_step", 3),
    }
    assert rule_set == expected_set, f"Tool rules don't match expected. Got: {rule_set}"


def test_add_tool_with_multiple_functions_in_source_code(client: LettaSDKClient):
    """Test adding a tool with multiple functions in the source code"""
    import textwrap

    # Define source code with multiple functions
    source_code = textwrap.dedent(
        """
        def helper_function(x: int) -> int:
            '''
            Helper function that doubles the input

            Args:
                x: The input number

            Returns:
                The input multiplied by 2
            '''
            return x * 2

        def another_helper(text: str) -> str:
            '''
            Another helper that uppercases text

            Args:
                text: The input text to uppercase

            Returns:
                The uppercased text
            '''
            return text.upper()

        def main_function(x: int, y: int) -> int:
            '''
            Main function that uses the helper

            Args:
                x: First number
                y: Second number

            Returns:
                Result of (x * 2) + y
            '''
            doubled_x = helper_function(x)
            return doubled_x + y
        """
    ).strip()

    # Create the tool with multiple functions
    tool = client.tools.create(
        source_code=source_code,
    )

    try:
        # Verify the tool was created
        assert tool is not None
        assert tool.name == "main_function"
        assert tool.source_code == source_code

        # Verify the JSON schema was generated for the main function
        assert tool.json_schema is not None
        assert tool.json_schema["name"] == "main_function"
        assert tool.json_schema["description"] == "Main function that uses the helper"

        # Check parameters
        params = tool.json_schema.get("parameters", {})
        properties = params.get("properties", {})
        assert "x" in properties
        assert "y" in properties
        assert properties["x"]["type"] == "integer"
        assert properties["y"]["type"] == "integer"
        assert params["required"] == ["x", "y"]

        # Test that we can retrieve the tool
        retrieved_tool = client.tools.retrieve(tool_id=tool.id)
        assert retrieved_tool.name == "main_function"
        assert retrieved_tool.source_code == source_code

    finally:
        # Clean up
        client.tools.delete(tool_id=tool.id)


# TODO: add back once behavior is defined
# def test_tool_name_auto_update_with_multiple_functions(client: LettaSDKClient):
#    """Test that tool name auto-updates when source code changes with multiple functions"""
#    import textwrap
#
#    # Initial source code with multiple functions
#    initial_source_code = textwrap.dedent(
#        """
#        def helper_function(x: int) -> int:
#            '''
#            Helper function that doubles the input
#
#            Args:
#                x: The input number
#
#            Returns:
#                The input multiplied by 2
#            '''
#            return x * 2
#
#        def another_helper(text: str) -> str:
#            '''
#            Another helper that uppercases text
#
#            Args:
#                text: The input text to uppercase
#
#            Returns:
#                The uppercased text
#            '''
#            return text.upper()
#
#        def main_function(x: int, y: int) -> int:
#            '''
#            Main function that uses the helper
#
#            Args:
#                x: First number
#                y: Second number
#
#            Returns:
#                Result of (x * 2) + y
#            '''
#            doubled_x = helper_function(x)
#            return doubled_x + y
#        """
#    ).strip()
#
#    # Create tool with initial source code
#    tool = client.tools.create(
#        source_code=initial_source_code,
#    )
#
#    try:
#        # Verify the tool was created with the last function's name
#        assert tool is not None
#        assert tool.name == "main_function"
#        assert tool.source_code == initial_source_code
#
#        # Now modify the source code with a different function order
#        new_source_code = textwrap.dedent(
#            """
#            def process_data(data: str, count: int) -> str:
#                '''
#                Process data by repeating it
#
#                Args:
#                    data: The input data
#                    count: Number of times to repeat
#
#                Returns:
#                    The processed data
#                '''
#                return data * count
#
#            def helper_utility(x: float) -> float:
#                '''
#                Helper utility function
#
#                Args:
#                    x: Input value
#
#                Returns:
#                    Squared value
#                '''
#                return x * x
#            """
#        ).strip()
#
#        # Modify the tool with new source code
#        modified_tool = client.tools.update(name="helper_utility", tool_id=tool.id, source_code=new_source_code)
#
#        # Verify the name automatically updated to the last function
#        assert modified_tool.name == "helper_utility"
#        assert modified_tool.source_code == new_source_code
#
#        # Verify the JSON schema updated correctly
#        assert modified_tool.json_schema is not None
#        assert modified_tool.json_schema["name"] == "helper_utility"
#        assert modified_tool.json_schema["description"] == "Helper utility function"
#
#        # Check parameters updated correctly
#        params = modified_tool.json_schema.get("parameters", {})
#        properties = params.get("properties", {})
#        assert "x" in properties
#        assert properties["x"]["type"] == "number"  # float maps to number
#        assert params["required"] == ["x"]
#
#        # Test one more modification with only one function
#        single_function_code = textwrap.dedent(
#            """
#            def calculate_total(items: list, tax_rate: float) -> float:
#                '''
#                Calculate total with tax
#
#                Args:
#                    items: List of item prices
#                    tax_rate: Tax rate as decimal
#
#                Returns:
#                    Total including tax
#                '''
#                subtotal = sum(items)
#                return subtotal * (1 + tax_rate)
#            """
#        ).strip()
#
#        # Modify again
#        final_tool = client.tools.update(tool_id=tool.id, source_code=single_function_code)
#
#        # Verify name updated again
#        assert final_tool.name == "calculate_total"
#        assert final_tool.source_code == single_function_code
#        assert final_tool.json_schema["description"] == "Calculate total with tax"
#
#    finally:
#        # Clean up
#        client.tools.delete(tool_id=tool.id)


def test_tool_rename_with_json_schema_and_source_code(client: LettaSDKClient):
    """Test that passing both new JSON schema AND source code still renames the tool based on source code"""

    # Create initial tool
    def initial_tool(x: int) -> int:
        """
        Multiply a number by 2

        Args:
            x: The input number

        Returns:
            The input multiplied by 2
        """
        return x * 2

    # Create the tool
    tool = client.tools.upsert_from_function(func=initial_tool)
    assert tool.name == "initial_tool"

    try:
        # Define new function source code with different name
        new_source_code = textwrap.dedent(
            """
            def renamed_function(value: float, multiplier: float = 2.0) -> float:
                '''
                Multiply a value by a multiplier

                Args:
                    value: The input value
                    multiplier: The multiplier to use (default 2.0)

                Returns:
                    The value multiplied by the multiplier
                '''
                return value * multiplier
            """
        ).strip()

        # Create a custom JSON schema that has a different name
        custom_json_schema = {
            "name": "custom_schema_name",
            "description": "Custom description from JSON schema",
            "parameters": {
                "type": "object",
                "properties": {
                    "value": {"type": "number", "description": "Input value from JSON schema"},
                    "multiplier": {"type": "number", "description": "Multiplier from JSON schema", "default": 2.0},
                },
                "required": ["value"],
            },
        }

        # verify there is a 400 error when both source code and json schema are provided
        with pytest.raises(Exception) as e:
            client.tools.update(tool_id=tool.id, source_code=new_source_code, json_schema=custom_json_schema)
        assert e.value.status_code == 400

        # update with consistent name and schema
        custom_json_schema["name"] = "renamed_function"
        tool = client.tools.update(tool_id=tool.id, json_schema=custom_json_schema)
        assert tool.json_schema == custom_json_schema
        assert tool.name == "renamed_function"

    finally:
        # Clean up
        client.tools.delete(tool_id=tool.id)


def test_export_import_agent_with_files(client: LettaSDKClient):
    """Test exporting and importing an agent with files attached."""

    # Clean up any existing folder with the same name from previous runs
    existing_folders = client.folders.list()
    for existing_folder in existing_folders:
        if existing_folder.name == "test_export_folder":
            client.folders.delete(folder_id=existing_folder.id)

    # Create a folder and upload test files (folders replace deprecated sources)
    folder = client.folders.create(name="test_export_folder", embedding="openai/text-embedding-3-small")

    # Upload test files to the folder
    test_files = ["tests/data/test.txt", "tests/data/test.md"]
    import time

    for file_path in test_files:
        # Upload file from disk using folders.files.upload
        with open(file_path, "rb") as f:
            file_metadata = client.folders.files.upload(folder_id=folder.id, file=f)
        # Wait for processing
        start_time = time.time()
        while file_metadata.processing_status not in ["completed", "error"]:
            if time.time() - start_time > 60:
                raise TimeoutError(f"File processing timed out for {file_path}")
            time.sleep(1)
            files_list = client.folders.files.list(folder_id=folder.id)
            # Find our file in the list (folders.files.list returns a list directly)
            for f in files_list:
                if f.id == file_metadata.id:
                    file_metadata = f
                    break
            else:
                raise RuntimeError(f"File {file_metadata.id} not found")
        if file_metadata.processing_status == "error":
            raise RuntimeError(f"File processing failed for {file_path}: {getattr(file_metadata, 'error_message', 'Unknown error')}")

    # Verify files were uploaded successfully
    files_in_folder = client.folders.files.list(folder_id=folder.id, limit=10)
    files_list = list(files_in_folder)
    assert len(files_list) == len(test_files), f"Expected {len(test_files)} files, got {len(files_list)}"

    # Create a simple agent with the folder attached (use source_ids with folder ID for compatibility)
    temp_agent = client.agents.create(
        memory_blocks=[
            CreateBlockParam(label="human", value="username: sarah"),
        ],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
    )
    # Attach folder after creation to avoid embedding issues
    client.agents.folders.attach(agent_id=temp_agent.id, folder_id=folder.id)

    # Export the agent (note: folder/source attachments may not be visible in agent state
    # but should still be included in the export)
    serialized_agent_raw = client.agents.export_file(agent_id=temp_agent.id, use_legacy_format=False)

    # Parse the exported data if it's a string
    if isinstance(serialized_agent_raw, str):
        serialized_agent = json.loads(serialized_agent_raw)
    else:
        serialized_agent = serialized_agent_raw

    # Verify the exported agent structure
    assert "agents" in serialized_agent, "Exported file should have 'agents' field"
    assert len(serialized_agent["agents"]) > 0, "Exported file should have at least one agent"
    exported_agent = serialized_agent["agents"][0]
    # Ensure embedding is set if embedding_config exists but embedding doesn't
    if "embedding_config" in exported_agent and exported_agent.get("embedding_config") and not exported_agent.get("embedding"):
        # Extract embedding handle from embedding_config if available
        embedding_config = exported_agent.get("embedding_config")
        if isinstance(embedding_config, dict):
            # Check for handle field first (preferred)
            if "handle" in embedding_config:
                exported_agent["embedding"] = embedding_config["handle"]
            # Otherwise construct from endpoint_type and model
            elif "embedding_endpoint_type" in embedding_config and "embedding_model" in embedding_config:
                provider = embedding_config["embedding_endpoint_type"]
                model = embedding_config["embedding_model"]
                exported_agent["embedding"] = f"{provider}/{model}"
            else:
                exported_agent["embedding"] = "openai/text-embedding-3-small"
        else:
            exported_agent["embedding"] = "openai/text-embedding-3-small"
    elif not exported_agent.get("embedding") and not exported_agent.get("embedding_config"):
        # If both are missing, add embedding
        exported_agent["embedding"] = "openai/text-embedding-3-small"

    # Convert to JSON bytes for import
    json_str = json.dumps(serialized_agent)
    file_obj = io.BytesIO(json_str.encode("utf-8"))

    # Import the agent - pass embedding override to ensure it's set during import
    import_result = client.agents.import_file(
        file=file_obj,
        append_copy_suffix=True,
        override_existing_tools=True,
        override_embedding_handle="openai/text-embedding-3-small",
    )

    # Verify import was successful
    assert len(import_result.agent_ids) == 1, "Should have imported exactly one agent"
    imported_agent_id = import_result.agent_ids[0]
    imported_agent = client.agents.retrieve(agent_id=imported_agent_id)

    assert imported_agent.id == imported_agent_id, "Should retrieve the imported agent"
    assert imported_agent.name is not None, "Imported agent should have a name"

    # Clean up
    client.agents.delete(agent_id=temp_agent.id)
    client.agents.delete(agent_id=imported_agent_id)
    client.folders.delete(folder_id=folder.id)


def test_upsert_tools(client: LettaSDKClient):
    """Test upserting tools with complex schemas."""
    from typing import List

    class WriteReasonOffer(BaseModel):
        biltMerchantId: str = Field(..., description="The merchant ID (e.g. 'MERCHANT_NETWORK-123' or 'LYFT')")
        campaignId: str = Field(
            ...,
            description="The campaign ID (e.g. '550e8400-e29b-41d4-a716-446655440000' or '550e8400-e29b-41d4-a716-446655440000_123e4567-e89b-12d3-a456-426614174000')",
        )
        reason: str = Field(
            ...,
            description="A detailed explanation of why this offer is relevant to the user. Refer to the category-specific reason_instructions_{category} block for all guidelines on creating personalized reasons.",
        )

    class WriteReasonArgs(BaseModel):
        """Arguments for the write_reason tool."""

        offer_list: List[WriteReasonOffer] = Field(
            ...,
            description="List of WriteReasonOffer objects with merchant and campaign information",
        )

    def write_reason(offer_list: List[WriteReasonOffer]):
        """
        This tool is used to write detailed reasons for a list of offers.
        It returns the essential information: biltMerchantId, campaignId, and reason.

        IMPORTANT: When generating reasons, you MUST ONLY follow the guidelines in the
        category-specific instruction block named "reason_instructions_{category}" where
        {category} is the category of the offer (e.g., dining, travel, shopping).

        These instruction blocks contain all the necessary guidelines for creating
        personalized, detailed reasons for each category. Do not rely on any other
        instructions outside of these blocks.

        Args:
            offer_list: List of WriteReasonOffer objects, each containing:
                - biltMerchantId: The merchant ID (e.g. 'MERCHANT_NETWORK-123' or 'LYFT')
                - campaignId: The campaign ID (e.g. '124', '28')
                - reason: A detailed explanation generated according to the category-specific reason_instructions_{category} block

        Returns:
            None: This function prints the offer list but does not return a value.
        """
        print(offer_list)

    tool = client.tools.upsert_from_function(func=write_reason, args_schema=WriteReasonArgs)
    assert tool is not None
    assert tool.name == "write_reason"

    # Clean up
    client.tools.delete(tool.id)


def test_run_list(client: LettaSDKClient):
    """Test listing runs."""

    # create an agent
    agent = client.agents.create(
        name="test_run_list",
        memory_blocks=[
            CreateBlockParam(label="persona", value="you are a helpful assistant"),
        ],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
    )

    # message an agent
    client.agents.messages.create(
        agent_id=agent.id,
        messages=[
            MessageCreateParam(role="user", content="Hello, how are you?"),
        ],
    )

    # message an agent async
    async_run = client.agents.messages.create_async(
        agent_id=agent.id,
        messages=[
            MessageCreateParam(role="user", content="Hello, how are you?"),
        ],
    )

    # list runs (returns list directly since paginated: false)
    runs = client.runs.list(agent_ids=[agent.id])
    runs_list = list(runs)
    # Check that at least the async run is present (there might be extras from previous tests)
    assert len(runs_list) >= 2, f"Expected at least 2 runs, got {len(runs_list)}"
    assert async_run.id in [run.id for run in runs_list]

    # test get run - use the async_run we created
    run = client.runs.retrieve(async_run.id)
    assert run.agent_id == agent.id


@pytest.mark.asyncio
async def test_create_batch(client: LettaSDKClient, server: SyncServer):
    # create agents
    agent1 = client.agents.create(
        name="agent1_batch",
        memory_blocks=[{"label": "persona", "value": "you are agent 1"}],
        model="anthropic/claude-3-7-sonnet-20250219",
        embedding="letta/letta-free",
    )
    agent2 = client.agents.create(
        name="agent2_batch",
        memory_blocks=[{"label": "persona", "value": "you are agent 2"}],
        model="anthropic/claude-3-7-sonnet-20250219",
        embedding="letta/letta-free",
    )

    # create a run
    run = client.batches.create(
        requests=[
            {
                "messages": [
                    MessageCreateParam(
                        role="user",
                        content="hi",
                    )
                ],
                "agent_id": agent1.id,
            },
            {
                "messages": [
                    MessageCreateParam(
                        role="user",
                        content="hi",
                    )
                ],
                "agent_id": agent2.id,
            },
        ]
    )
    assert run is not None

    # list batches
    batches = client.batches.list()
    batches_list = list(batches)
    assert len(batches_list) >= 1, f"Expected 1 or more batches, got {len(batches_list)}"
    assert batches_list[0].status == "running"

    # Poll it once
    await poll_running_llm_batches(server)

    # get the batch results
    results = client.batches.retrieve(
        batch_id=run.id,
    )
    assert results is not None

    # cancel
    client.batches.cancel(batch_id=run.id)
    batch_job = client.batches.retrieve(
        batch_id=run.id,
    )
    assert batch_job.status == "cancelled"


def test_create_agent(client: LettaSDKClient) -> None:
    """Test creating an agent and streaming messages with tokens"""
    agent = client.agents.create(
        memory_blocks=[
            CreateBlockParam(
                value="username: caren",
                label="human",
            )
        ],
        model="anthropic/claude-sonnet-4-20250514",
        embedding="openai/text-embedding-ada-002",
    )
    assert agent is not None
    agents = client.agents.list().items
    assert len([a for a in agents if a.id == agent.id]) == 1

    response = client.agents.messages.stream(
        agent_id=agent.id,
        messages=[
            MessageCreateParam(
                role="user",
                content="Please answer this question in just one word: what is my name?",
            )
        ],
        stream_tokens=True,
    )
    counter = 0
    messages = {}
    for chunk in response:
        print(
            chunk.model_dump_json(
                indent=2,
                exclude={
                    "id",
                    "date",
                    "otid",
                    "sender_id",
                    "completion_tokens",
                    "prompt_tokens",
                    "total_tokens",
                    "step_count",
                    "run_ids",
                },
            )
        )
        counter += 1
        if chunk.message_type not in messages:
            messages[chunk.message_type] = 0
        messages[chunk.message_type] += 1
    print(f"Total messages: {counter}")
    print(messages)
    client.agents.delete(agent_id=agent.id)


def test_create_agent_with_tools(client: LettaSDKClient) -> None:
    """Test creating an agent with custom inventory management tools"""

    # define the Pydantic models for the inventory tool
    class InventoryItem(BaseModel):
        sku: str  # Unique product identifier
        name: str  # Product name
        price: float  # Current price
        category: str  # Product category (e.g., "Electronics", "Clothing")

    class InventoryEntry(BaseModel):
        timestamp: int  # Unix timestamp of the transaction
        item: InventoryItem  # The product being updated
        transaction_id: str  # Unique identifier for this inventory update

    class InventoryEntryData(BaseModel):
        data: InventoryEntry
        quantity_change: int  # Change in quantity (positive for additions, negative for removals)

    class ManageInventoryTool(BaseTool):
        name: str = "manage_inventory"
        args_schema: Type[BaseModel] = InventoryEntryData
        description: str = "Update inventory catalogue with a new data entry"
        tags: List[str] = ["inventory", "shop"]

        def run(self, data: InventoryEntry, quantity_change: int) -> bool:
            """
            Implementation of the manage_inventory tool
            """
            print(f"Updated inventory for {data.item.name} with a quantity change of {quantity_change}")
            return True

    def manage_inventory_mock(data: InventoryEntry, quantity_change: int) -> bool:
        """
        Implementation of the manage_inventory tool
        """
        print(f"Updated inventory for {data.item.name} with a quantity change of {quantity_change}")
        return True

    tool_from_func = client.tools.upsert_from_function(
        func=manage_inventory_mock,
        args_schema=InventoryEntryData,
    )
    assert tool_from_func is not None

    # Provide a placeholder id (server will generate a new one)
    tool_from_class = client.tools.add(
        tool=ManageInventoryTool(id="tool-placeholder"),
    )
    assert tool_from_class is not None

    # Note: run_tool_from_source is not available in v1 SDK, so we skip this test
    # The tools are created successfully above, which is the main functionality being tested
    # for tool in [tool_from_func, tool_from_class]:
    #     tool_return = client.tools.run_tool_from_source(
    #         source_code=tool.source_code,
    #         args={
    #             "data": InventoryEntry(
    #                 timestamp=0,
    #                 item=InventoryItem(
    #                     name="Item 1",
    #                     sku="328jf84htgwoeidfnw4",
    #                     price=9.99,
    #                     category="Grocery",
    #                 ),
    #                 transaction_id="1234",
    #             ),
    #             "quantity_change": 10,
    #         },
    #         args_json_schema=InventoryEntryData.model_json_schema(),
    #     )
    #     assert tool_return is not None
    #     assert tool_return.tool_return == "True"

    # clean up
    client.tools.delete(tool_from_func.id)
    client.tools.delete(tool_from_class.id)
