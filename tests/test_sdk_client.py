import asyncio
import os
import threading
import time
import uuid

import pytest
from dotenv import load_dotenv
from letta_client import CreateBlock
from letta_client import Letta as LettaSDKClient
from letta_client import MessageCreate
from letta_client.core import ApiError
from letta_client.types import AgentState, ToolReturnMessage

# Constants
SERVER_PORT = 8283


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
    client = LettaSDKClient(base_url=server_url, token=None)
    yield client


@pytest.fixture(scope="module")
def agent(client: LettaSDKClient):
    agent_state = client.agents.create(
        memory_blocks=[
            CreateBlock(
                label="human",
                value="username: sarah",
            ),
        ],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-ada-002",
    )
    yield agent_state

    # delete agent
    client.agents.delete(agent_id=agent_state.id)


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
            CreateBlock(
                label="persona",
                value="you are agent 1",
            ),
        ],
        block_ids=[block.id],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-ada-002",
    )
    agent_state2 = client.agents.create(
        name="agent2",
        memory_blocks=[
            CreateBlock(
                label="persona",
                value="you are agent 2",
            ),
        ],
        block_ids=[block.id],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-ada-002",
    )

    # update memory
    client.agents.messages.create(
        agent_id=agent_state1.id,
        messages=[
            MessageCreate(
                role="user",
                content="my name is actually charles",
            )
        ],
    )

    # check agent 2 memory
    assert (
        "charles" in client.blocks.retrieve(block_id=block.id).value.lower()
    ), f"Shared block update failed {client.retrieve_block(block.id).value}"

    client.agents.messages.create(
        agent_id=agent_state2.id,
        messages=[
            MessageCreate(
                role="user",
                content="whats my name?",
            )
        ],
    )
    assert (
        "charles" in client.agents.blocks.retrieve(agent_id=agent_state2.id, block_label="human").value.lower()
    ), f"Shared block update failed {client.agents.blocks.retrieve(agent_id=agent_state2.id, block_label="human").value}"

    # cleanup
    client.agents.delete(agent_state1.id)
    client.agents.delete(agent_state2.id)


def test_add_and_manage_tags_for_agent(client: LettaSDKClient):
    """
    Comprehensive happy path test for adding, retrieving, and managing tags on an agent.
    """
    tags_to_add = ["test_tag_1", "test_tag_2", "test_tag_3"]

    # Step 0: create an agent with no tags
    agent = client.agents.create(
        memory_blocks=[
            CreateBlock(
                label="human",
                value="username: sarah",
            ),
        ],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-ada-002",
    )
    assert len(agent.tags) == 0

    # Step 1: Add multiple tags to the agent
    client.agents.modify(agent_id=agent.id, tags=tags_to_add)

    # Step 2: Retrieve tags for the agent and verify they match the added tags
    retrieved_tags = client.agents.retrieve(agent_id=agent.id).tags
    assert set(retrieved_tags) == set(tags_to_add), f"Expected tags {tags_to_add}, but got {retrieved_tags}"

    # Step 3: Retrieve agents by each tag to ensure the agent is associated correctly
    for tag in tags_to_add:
        agents_with_tag = client.agents.list(tags=[tag])
        assert agent.id in [a.id for a in agents_with_tag], f"Expected agent {agent.id} to be associated with tag '{tag}'"

    # Step 4: Delete a specific tag from the agent and verify its removal
    tag_to_delete = tags_to_add.pop()
    client.agents.modify(agent_id=agent.id, tags=tags_to_add)

    # Verify the tag is removed from the agent's tags
    remaining_tags = client.agents.retrieve(agent_id=agent.id).tags
    assert tag_to_delete not in remaining_tags, f"Tag '{tag_to_delete}' was not removed as expected"
    assert set(remaining_tags) == set(tags_to_add), f"Expected remaining tags to be {tags_to_add[1:]}, but got {remaining_tags}"

    # Step 5: Delete all remaining tags from the agent
    client.agents.modify(agent_id=agent.id, tags=[])

    # Verify all tags are removed
    final_tags = client.agents.retrieve(agent_id=agent.id).tags
    assert len(final_tags) == 0, f"Expected no tags, but found {final_tags}"

    # Remove agent
    client.agents.delete(agent.id)


def test_agent_tags(client: LettaSDKClient):
    """Test creating agents with tags and retrieving tags via the API."""
    # Clear all agents
    all_agents = client.agents.list()
    for agent in all_agents:
        client.agents.delete(agent.id)

    # Create multiple agents with different tags
    agent1 = client.agents.create(
        memory_blocks=[
            CreateBlock(
                label="human",
                value="username: sarah",
            ),
        ],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-ada-002",
        tags=["test", "agent1", "production"],
    )

    agent2 = client.agents.create(
        memory_blocks=[
            CreateBlock(
                label="human",
                value="username: sarah",
            ),
        ],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-ada-002",
        tags=["test", "agent2", "development"],
    )

    agent3 = client.agents.create(
        memory_blocks=[
            CreateBlock(
                label="human",
                value="username: sarah",
            ),
        ],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-ada-002",
        tags=["test", "agent3", "production"],
    )

    # Test getting all tags
    all_tags = client.tag.list_tags()
    expected_tags = ["agent1", "agent2", "agent3", "development", "production", "test"]
    assert sorted(all_tags) == expected_tags

    # Test pagination
    paginated_tags = client.tag.list_tags(limit=2)
    assert len(paginated_tags) == 2
    assert paginated_tags[0] == "agent1"
    assert paginated_tags[1] == "agent2"

    # Test pagination with cursor
    next_page_tags = client.tag.list_tags(after="agent2", limit=2)
    assert len(next_page_tags) == 2
    assert next_page_tags[0] == "agent3"
    assert next_page_tags[1] == "development"

    # Test text search
    prod_tags = client.tag.list_tags(query_text="prod")
    assert sorted(prod_tags) == ["production"]

    dev_tags = client.tag.list_tags(query_text="dev")
    assert sorted(dev_tags) == ["development"]

    agent_tags = client.tag.list_tags(query_text="agent")
    assert sorted(agent_tags) == ["agent1", "agent2", "agent3"]

    # Remove agents
    client.agents.delete(agent1.id)
    client.agents.delete(agent2.id)
    client.agents.delete(agent3.id)


def test_update_agent_memory_label(client: LettaSDKClient, agent: AgentState):
    """Test that we can update the label of a block in an agent's memory"""
    current_labels = [block.label for block in client.agents.blocks.list(agent_id=agent.id)]
    example_label = current_labels[0]
    example_new_label = "example_new_label"
    assert example_new_label not in current_labels

    client.agents.blocks.modify(
        agent_id=agent.id,
        block_label=example_label,
        label=example_new_label,
    )

    updated_block = client.agents.blocks.retrieve(agent_id=agent.id, block_label=example_new_label)
    assert updated_block.label == example_new_label


def test_add_remove_agent_memory_block(client: LettaSDKClient, agent: AgentState):
    """Test that we can add and remove a block from an agent's memory"""
    current_labels = [block.label for block in client.agents.blocks.list(agent_id=agent.id)]
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

    current_labels = [block.label for block in client.agents.blocks.list(agent_id=agent.id)]
    assert example_new_label not in current_labels


def test_update_agent_memory_limit(client: LettaSDKClient, agent: AgentState):
    """Test that we can update the limit of a block in an agent's memory"""

    current_labels = [block.label for block in client.agents.blocks.list(agent_id=agent.id)]
    example_label = current_labels[0]
    example_new_limit = 1
    current_block = client.agents.blocks.retrieve(agent_id=agent.id, block_label=example_label)
    current_block_length = len(current_block.value)

    assert example_new_limit != client.agents.blocks.retrieve(agent_id=agent.id, block_label=example_label).limit
    assert example_new_limit < current_block_length

    # We expect this to throw a value error
    with pytest.raises(ApiError):
        client.agents.blocks.modify(
            agent_id=agent.id,
            block_label=example_label,
            limit=example_new_limit,
        )

    # Now try the same thing with a higher limit
    example_new_limit = current_block_length + 10000
    assert example_new_limit > current_block_length
    client.agents.blocks.modify(
        agent_id=agent.id,
        block_label=example_label,
        limit=example_new_limit,
    )

    assert example_new_limit == client.agents.blocks.retrieve(agent_id=agent.id, block_label=example_label).limit


def test_messages(client: LettaSDKClient, agent: AgentState):
    send_message_response = client.agents.messages.create(
        agent_id=agent.id,
        messages=[
            MessageCreate(
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
    assert len(messages_response) > 0, "Retrieving messages failed"


def test_send_system_message(client: LettaSDKClient, agent: AgentState):
    """Important unit test since the Letta API exposes sending system messages, but some backends don't natively support it (eg Anthropic)"""
    send_system_message_response = client.agents.messages.create(
        agent_id=agent.id,
        messages=[
            MessageCreate(
                role="system",
                content="Event occurred: The user just logged off.",
            ),
        ],
    )
    assert send_system_message_response, "Sending message failed"


def test_function_return_limit(client: LettaSDKClient, agent: AgentState):
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
            MessageCreate(
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
            MessageCreate(
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

    assert response_message.tool_return == "Error executing function testing_method: ZeroDivisionError: division by zero"
    assert "ZeroDivisionError" in response_message.tool_return


@pytest.mark.asyncio
async def test_send_message_parallel(client: LettaSDKClient, agent: AgentState):
    """
    Test that sending two messages in parallel does not error.
    """

    # Define a coroutine for sending a message using asyncio.to_thread for synchronous calls
    async def send_message_task(message: str):
        response = await asyncio.to_thread(
            client.agents.messages.create,
            agent_id=agent.id,
            messages=[
                MessageCreate(
                    role="user",
                    content=message,
                ),
            ],
        )
        assert response, f"Sending message '{message}' failed"
        return response

    # Prepare two tasks with different messages
    messages = ["Test message 1", "Test message 2"]
    tasks = [send_message_task(message) for message in messages]

    # Run the tasks concurrently
    responses = await asyncio.gather(*tasks, return_exceptions=True)

    # Check for exceptions and validate responses
    for i, response in enumerate(responses):
        if isinstance(response, Exception):
            pytest.fail(f"Task {i} failed with exception: {response}")
        else:
            assert response, f"Task {i} returned an invalid response: {response}"

    # Ensure both tasks completed
    assert len(responses) == len(messages), "Not all messages were processed"


def test_send_message_async(client: LettaSDKClient, agent: AgentState):
    """
    Test that we can send a message asynchronously and retrieve the messages, along with usage statistics
    """
    test_message = "This is a test message, respond to the user with a sentence."
    run = client.agents.messages.create_async(
        agent_id=agent.id,
        messages=[
            MessageCreate(
                role="user",
                content=test_message,
            ),
        ],
        use_assistant_message=False,
    )
    assert run.id is not None
    assert run.status == "created"

    # Wait for the job to complete, cancel it if takes over 10 seconds
    start_time = time.time()
    while run.status == "created":
        time.sleep(1)
        run = client.runs.retrieve_run(run_id=run.id)
        print(f"Run status: {run.status}")
        if time.time() - start_time > 10:
            pytest.fail("Run took too long to complete")

    print(f"Run completed in {time.time() - start_time} seconds, run={run}")
    assert run.status == "completed"

    # Get messages for the job
    messages = client.runs.list_run_messages(run_id=run.id)
    assert len(messages) >= 2  # At least assistant response

    # Check filters
    assistant_messages = client.runs.list_run_messages(run_id=run.id, role="assistant")
    assert len(assistant_messages) > 0
    tool_messages = client.runs.list_run_messages(run_id=run.id, role="tool")
    assert len(tool_messages) > 0

    # specific_tool_messages = [message for message in client.runs.list_run_messages(run_id=run.id) if isinstance(message, ToolCallMessage)]
    # assert specific_tool_messages[0].tool_call.name == "send_message"
    # assert len(specific_tool_messages) > 0

    # Get and verify usage statistics
    usage = client.runs.retrieve_run_usage(run_id=run.id)
    assert usage.completion_tokens >= 0
    assert usage.prompt_tokens >= 0
    assert usage.total_tokens >= 0
    assert usage.total_tokens == usage.completion_tokens + usage.prompt_tokens


def test_agent_creation(client: LettaSDKClient):
    """Test that block IDs are properly attached when creating an agent."""
    offline_memory_agent_system = """
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
    offline_persona_block = client.blocks.create(label="persona", value="persona description", limit=5000)
    mindy_block = client.blocks.create(label="mindy", value="Mindy is a helpful assistant", limit=5000)

    # Create agent with the blocks and tools
    agent = client.agents.create(
        name=f"test_agent_{str(uuid.uuid4())}",
        memory_blocks=[offline_persona_block, mindy_block],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-ada-002",
        tool_ids=[tool1.id, tool2.id],
        include_base_tools=False,
        tags=["test"],
        block_ids=[user_preferences_block.id],
    )

    # Verify the agent was created successfully
    assert agent is not None
    assert agent.id is not None

    # Verify all memory blocks are properly attached
    for block in [offline_persona_block, mindy_block, user_preferences_block]:
        agent_block = client.agents.blocks.retrieve(agent_id=agent.id, block_label=block.label)
        assert block.value == agent_block.value and block.limit == agent_block.limit

    # Verify the tools are properly attached
    agent_tools = client.agents.tools.list(agent_id=agent.id)
    assert len(agent_tools) == 2
    tool_ids = {tool1.id, tool2.id}
    assert all(tool.id in tool_ids for tool in agent_tools)
