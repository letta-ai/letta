import json
import os
import threading
import time
import uuid
from typing import List, Type

import pytest
from dotenv import load_dotenv
from letta_client import CreateBlock
from letta_client import Letta as LettaSDKClient
from letta_client import LettaRequest, MessageCreate, TextContent
from letta_client.client import BaseTool
from letta_client.core import ApiError
from letta_client.types import AgentState, ToolReturnMessage
from pydantic import BaseModel, Field

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
        embedding="openai/text-embedding-3-small",
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
        embedding="openai/text-embedding-3-small",
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
        embedding="openai/text-embedding-3-small",
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
    block_value = client.blocks.retrieve(block_id=block.id).value
    assert "charles" in block_value.lower(), f"Shared block update failed {block_value}"

    client.agents.messages.create(
        agent_id=agent_state2.id,
        messages=[
            MessageCreate(
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
            CreateBlock(
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
            MessageCreate(
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
    client.agents.blocks.modify(agent_id=agent.id, block_label="human", value=new_value)
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
            CreateBlock(
                label="human",
                value="username: sarah",
            ),
        ],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
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
        embedding="openai/text-embedding-3-small",
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
        embedding="openai/text-embedding-3-small",
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
#                 MessageCreate(
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
    assert len(agent_tools) == 2
    tool_ids = {tool1.id, tool2.id}
    assert all(tool.id in tool_ids for tool in agent_tools)


def test_many_blocks(client: LettaSDKClient):
    users = ["user1", "user2"]
    # Create agent with the blocks
    agent1 = client.agents.create(
        name=f"test_agent_{str(uuid.uuid4())}",
        memory_blocks=[
            CreateBlock(
                label="user1",
                value="user preferences: loud",
            ),
            CreateBlock(
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
            CreateBlock(
                label="user1",
                value="user preferences: sneezy",
            ),
            CreateBlock(
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

        blocks = client.blocks.list(label=user)
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
            CreateBlock(label="user", value="Name: Charles"),
        ],
        model="letta/letta-free",
        embedding="letta/letta-free",
    )

    if message_create == "stream_step":
        response = client.agents.messages.create_stream(
            agent_id=agent.id,
            messages=[
                MessageCreate(
                    role="user",
                    content=message,
                ),
            ],
            include_return_message_types=message_types,
        )
        messages = [message for message in list(response) if message.message_type not in ["stop_reason", "usage_statistics"]]
        verify_message_types(messages, message_types)

    elif message_create == "async":
        response = client.agents.messages.create_async(
            agent_id=agent.id,
            messages=[
                MessageCreate(
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

        messages = client.runs.messages.list(run_id=response.id)
        verify_message_types(messages, message_types)

    elif message_create == "token_stream":
        response = client.agents.messages.create_stream(
            agent_id=agent.id,
            messages=[
                MessageCreate(
                    role="user",
                    content=message,
                ),
            ],
            include_return_message_types=message_types,
        )
        messages = [message for message in list(response) if message.message_type not in ["stop_reason", "usage_statistics"]]
        verify_message_types(messages, message_types)

    elif message_create == "sync":
        response = client.agents.messages.create(
            agent_id=agent.id,
            messages=[
                MessageCreate(
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

    tool = client.tools.add(
        tool=ManageInventoryTool(),
    )

    assert tool is not None
    assert tool.name == "manage_inventory"
    assert "inventory" in tool.tags
    assert "shop" in tool.tags

    temp_agent = client.agents.create(
        memory_blocks=[
            CreateBlock(
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
            MessageCreate(
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


@pytest.mark.parametrize("e2b_sandbox_mode", [True, False], indirect=True)
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

    tool = client.tools.upsert_from_function(func=create_task_plan, args_schema=StepsList, tags=["planning", "task", "pydantic_test"])

    assert tool is not None
    assert tool.name == "create_task_plan"
    assert "planning" in tool.tags
    assert "task" in tool.tags

    temp_agent = client.agents.create(
        memory_blocks=[
            CreateBlock(
                label="persona",
                value="You are a helpful task planning assistant.",
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
            MessageCreate(
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
            CreateBlock(
                label="human",
                value="username: sarah",
            ),
        ],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
    )

    try:
        payload = client.agents.messages.preview_raw_payload(
            agent_id=temp_agent.id,
            request=LettaRequest(
                messages=[
                    MessageCreate(
                        role="user",
                        content=[
                            TextContent(
                                text="text",
                            )
                        ],
                    )
                ],
            ),
        )

        assert isinstance(payload, dict)
        assert "model" in payload
        assert "messages" in payload
        assert "tools" in payload
        assert "frequency_penalty" in payload
        assert "max_completion_tokens" in payload
        assert "temperature" in payload
        assert "user" in payload
        assert "parallel_tool_calls" in payload
        assert "tool_choice" in payload

        assert payload["model"] == "gpt-4o-mini"

        assert isinstance(payload["messages"], list)
        assert len(payload["messages"]) >= 3

        system_message = payload["messages"][0]
        assert system_message["role"] == "system"
        assert "base_instructions" in system_message["content"]
        assert "memory_blocks" in system_message["content"]
        assert "Letta" in system_message["content"]

        assert isinstance(payload["tools"], list)
        assert len(payload["tools"]) > 0

        for tool in payload["tools"]:
            assert tool["type"] == "function"
            assert "function" in tool
            assert "name" in tool["function"]
            assert "description" in tool["function"]
            assert "parameters" in tool["function"]
            assert tool["function"]["strict"] is True

        assert payload["frequency_penalty"] == 1.0
        assert payload["max_completion_tokens"] == 4096
        assert payload["temperature"] == 0.7
        assert payload["parallel_tool_calls"] is False
        assert payload["tool_choice"] == "required"
        assert payload["user"].startswith("user-")

        print(payload)
    finally:
        # Clean up the agent
        client.agents.delete(agent_id=temp_agent.id)


def test_agent_tools_list(client: LettaSDKClient):
    """Test the optimized agent tools list endpoint for correctness."""
    # Create a test agent
    agent_state = client.agents.create(
        name="test_agent_tools_list",
        memory_blocks=[
            CreateBlock(
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
        assert len(tools) > 0, "Agent should have base tools attached"

        # Verify tool objects have expected attributes
        for tool in tools:
            assert hasattr(tool, "id"), "Tool should have id attribute"
            assert hasattr(tool, "name"), "Tool should have name attribute"
            assert tool.id is not None, "Tool id should not be None"
            assert tool.name is not None, "Tool name should not be None"

    finally:
        # Clean up
        client.agents.delete(agent_id=agent_state.id)


def test_update_tool_source_code_changes_name(client: LettaSDKClient):
    """Test that updating a tool's source code correctly changes its name"""
    import textwrap

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
        def updated_tool(x: int, y: int) -> int:
            '''
            Add two numbers together

            Args:
                x: First number
                y: Second number
            Returns:
                Sum of x and y
            '''
            return x + y
        """
        ).strip()

        # Update the tool's source code
        updated = client.tools.modify(tool_id=tool.id, source_code=new_source_code)

        # Verify the name changed
        assert updated.name == "updated_tool"
        assert updated.source_code == new_source_code

        # Verify the schema was updated for the new parameters
        assert updated.json_schema is not None
        assert updated.json_schema["name"] == "updated_tool"
        assert updated.json_schema["description"] == "Add two numbers together"

        # Check parameters
        params = updated.json_schema.get("parameters", {})
        properties = params.get("properties", {})
        assert "x" in properties
        assert "y" in properties
        assert properties["x"]["type"] == "integer"
        assert properties["y"]["type"] == "integer"
        assert properties["x"]["description"] == "First number"
        assert properties["y"]["description"] == "Second number"
        assert params["required"] == ["x", "y"]

    finally:
        # Clean up
        client.tools.delete(tool_id=tool.id)


def test_update_tool_source_code_duplicate_name_error(client: LettaSDKClient):
    """Test that updating a tool's source code to have the same name as another existing tool raises an error"""
    import textwrap

    # Create first tool
    def first_tool(x: int) -> int:
        """
        Multiply a number by 2

        Args:
            x: The input number

        Returns:
            The input multiplied by 2
        """
        return x * 2

    # Create second tool
    def second_tool(x: int) -> int:
        """
        Multiply a number by 3

        Args:
            x: The input number

        Returns:
            The input multiplied by 3
        """
        return x * 3

    # Create both tools
    tool1 = client.tools.upsert_from_function(func=first_tool)
    tool2 = client.tools.upsert_from_function(func=second_tool)

    assert tool1.name == "first_tool"
    assert tool2.name == "second_tool"

    try:
        # Try to update second_tool to have the same name as first_tool
        new_source_code = textwrap.dedent(
            """
        def first_tool(x: int) -> int:
            '''
            Multiply a number by 4

            Args:
                x: The input number

            Returns:
                The input multiplied by 4
            '''
            return x * 4
        """
        ).strip()

        # This should raise an error since first_tool already exists
        with pytest.raises(Exception) as exc_info:
            client.tools.modify(tool_id=tool2.id, source_code=new_source_code)

        # Verify the error message indicates duplicate name
        error_message = str(exc_info.value)
        assert "already exists" in error_message.lower() or "duplicate" in error_message.lower() or "conflict" in error_message.lower()

        # Verify that tool2 was not modified
        tool2_check = client.tools.retrieve(tool_id=tool2.id)
        assert tool2_check.name == "second_tool"  # Name should remain unchanged

    finally:
        # Clean up both tools
        client.tools.delete(tool_id=tool1.id)
        client.tools.delete(tool_id=tool2.id)


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


def test_tool_name_auto_update_with_multiple_functions(client: LettaSDKClient):
    """Test that tool name auto-updates when source code changes with multiple functions"""
    import textwrap

    # Initial source code with multiple functions
    initial_source_code = textwrap.dedent(
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

    # Create tool with initial source code
    tool = client.tools.create(
        source_code=initial_source_code,
    )

    try:
        # Verify the tool was created with the last function's name
        assert tool is not None
        assert tool.name == "main_function"
        assert tool.source_code == initial_source_code

        # Now modify the source code with a different function order
        new_source_code = textwrap.dedent(
            """
            def process_data(data: str, count: int) -> str:
                '''
                Process data by repeating it

                Args:
                    data: The input data
                    count: Number of times to repeat

                Returns:
                    The processed data
                '''
                return data * count

            def helper_utility(x: float) -> float:
                '''
                Helper utility function

                Args:
                    x: Input value

                Returns:
                    Squared value
                '''
                return x * x
            """
        ).strip()

        # Modify the tool with new source code
        modified_tool = client.tools.modify(tool_id=tool.id, source_code=new_source_code)

        # Verify the name automatically updated to the last function
        assert modified_tool.name == "helper_utility"
        assert modified_tool.source_code == new_source_code

        # Verify the JSON schema updated correctly
        assert modified_tool.json_schema is not None
        assert modified_tool.json_schema["name"] == "helper_utility"
        assert modified_tool.json_schema["description"] == "Helper utility function"

        # Check parameters updated correctly
        params = modified_tool.json_schema.get("parameters", {})
        properties = params.get("properties", {})
        assert "x" in properties
        assert properties["x"]["type"] == "number"  # float maps to number
        assert params["required"] == ["x"]

        # Test one more modification with only one function
        single_function_code = textwrap.dedent(
            """
            def calculate_total(items: list, tax_rate: float) -> float:
                '''
                Calculate total with tax

                Args:
                    items: List of item prices
                    tax_rate: Tax rate as decimal

                Returns:
                    Total including tax
                '''
                subtotal = sum(items)
                return subtotal * (1 + tax_rate)
            """
        ).strip()

        # Modify again
        final_tool = client.tools.modify(tool_id=tool.id, source_code=single_function_code)

        # Verify name updated again
        assert final_tool.name == "calculate_total"
        assert final_tool.source_code == single_function_code
        assert final_tool.json_schema["description"] == "Calculate total with tax"

    finally:
        # Clean up
        client.tools.delete(tool_id=tool.id)


def test_tool_rename_with_json_schema_and_source_code(client: LettaSDKClient):
    """Test that passing both new JSON schema AND source code still renames the tool based on source code"""
    import textwrap

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

        # Modify the tool with both new source code AND JSON schema
        modified_tool = client.tools.modify(tool_id=tool.id, source_code=new_source_code, json_schema=custom_json_schema)

        # Verify the name comes from the source code function name, not the JSON schema
        assert modified_tool.name == "renamed_function"
        assert modified_tool.source_code == new_source_code

        # Verify the JSON schema was updated to match the function name from source code
        assert modified_tool.json_schema is not None
        assert modified_tool.json_schema["name"] == "renamed_function"

        # The description should come from the source code docstring, not the JSON schema
        assert modified_tool.json_schema["description"] == "Multiply a value by a multiplier"

        # Verify parameters are from the source code, not the custom JSON schema
        params = modified_tool.json_schema.get("parameters", {})
        properties = params.get("properties", {})
        assert "value" in properties
        assert "multiplier" in properties
        assert properties["value"]["type"] == "number"
        assert properties["multiplier"]["type"] == "number"
        assert params["required"] == ["value"]

    finally:
        # Clean up
        client.tools.delete(tool_id=tool.id)
