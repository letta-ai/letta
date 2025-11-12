import os
import threading
import uuid

import pytest
from dotenv import load_dotenv
from letta_client import AgentState, Letta, MessageCreate
from letta_client.core.api_error import ApiError
from sqlalchemy import delete

from letta.orm import SandboxConfig, SandboxEnvironmentVariable
from tests.utils import wait_for_server

# Constants
SERVER_PORT = 8283
SANDBOX_DIR = "/tmp/sandbox"
UPDATED_SANDBOX_DIR = "/tmp/updated_sandbox"
ENV_VAR_KEY = "TEST_VAR"
UPDATED_ENV_VAR_KEY = "UPDATED_VAR"
ENV_VAR_VALUE = "test_value"
UPDATED_ENV_VAR_VALUE = "updated_value"
ENV_VAR_DESCRIPTION = "A test environment variable"


def run_server():
    load_dotenv()

    from letta.server.rest_api.app import start_server

    print("Starting server...")
    start_server(debug=True)


@pytest.fixture(
    scope="module",
)
def client(request):
    # Get URL from environment or start server
    api_url = os.getenv("LETTA_API_URL")
    server_url = os.getenv("LETTA_SERVER_URL", f"http://localhost:{SERVER_PORT}")
    if not os.getenv("LETTA_SERVER_URL"):
        print("Starting server thread")
        thread = threading.Thread(target=run_server, daemon=True)
        thread.start()
        wait_for_server(server_url)
    print("Running client tests with server:", server_url)

    # Overide the base_url if the LETTA_API_URL is set
    base_url = api_url if api_url else server_url
    # create the Letta client
    yield Letta(base_url=base_url, token=None)


# Fixture for test agent
@pytest.fixture(scope="module")
def agent(client: Letta):
    agent_state = client.agents.create(
        name="test_client",
        memory_blocks=[{"label": "human", "value": ""}, {"label": "persona", "value": ""}],
        model="letta/letta-free",
        embedding="letta/letta-free",
    )

    yield agent_state

    # delete agent
    client.agents.delete(agent_state.id)


# Fixture for test agent
@pytest.fixture
def search_agent_one(client: Letta):
    agent_state = client.agents.create(
        name="Search Agent One",
        memory_blocks=[{"label": "human", "value": ""}, {"label": "persona", "value": ""}],
        model="letta/letta-free",
        embedding="letta/letta-free",
    )

    yield agent_state

    # delete agent
    client.agents.delete(agent_state.id)


# Fixture for test agent
@pytest.fixture
def search_agent_two(client: Letta):
    agent_state = client.agents.create(
        name="Search Agent Two",
        memory_blocks=[{"label": "human", "value": ""}, {"label": "persona", "value": ""}],
        model="letta/letta-free",
        embedding="letta/letta-free",
    )

    yield agent_state

    # delete agent
    client.agents.delete(agent_state.id)


@pytest.fixture(autouse=True)
async def clear_tables():
    """Clear the sandbox tables before each test."""

    from letta.server.db import db_registry

    async with db_registry.async_session() as session:
        await session.execute(delete(SandboxEnvironmentVariable))
        await session.execute(delete(SandboxConfig))
        await session.commit()


# --------------------------------------------------------------------------------------------------------------------
# Agent tags
# --------------------------------------------------------------------------------------------------------------------


def test_add_and_manage_tags_for_agent(client: Letta):
    """
    Comprehensive happy path test for adding, retrieving, and managing tags on an agent.
    """
    tags_to_add = ["test_tag_1", "test_tag_2", "test_tag_3"]

    # Step 0: create an agent with no tags
    agent = client.agents.create(memory_blocks=[], model="letta/letta-free", embedding="letta/letta-free")
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


def test_agent_tags(client: Letta, clear_tables):
    """Test creating agents with tags and retrieving tags via the API."""

    # Create multiple agents with different tags
    agent1 = client.agents.create(
        name=f"test_agent_{str(uuid.uuid4())}",
        tags=["test", "agent1", "production"],
        model="letta/letta-free",
        embedding="letta/letta-free",
    )

    agent2 = client.agents.create(
        name=f"test_agent_{str(uuid.uuid4())}",
        tags=["test", "agent2", "development"],
        model="letta/letta-free",
        embedding="letta/letta-free",
    )

    agent3 = client.agents.create(
        name=f"test_agent_{str(uuid.uuid4())}",
        tags=["test", "agent3", "production"],
        model="letta/letta-free",
        embedding="letta/letta-free",
    )

    # Test getting all tags
    all_tags = client.tags.list()
    expected_tags = ["agent1", "agent2", "agent3", "development", "production", "test"]
    print("ALL TAGS", all_tags)
    print("EXPECTED TAGS", expected_tags)
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


# --------------------------------------------------------------------------------------------------------------------
# Agent memory blocks
# --------------------------------------------------------------------------------------------------------------------
def test_shared_blocks(disable_e2b_api_key, client: Letta):
    # create a block
    block = client.blocks.create(label="human", value="username: sarah")

    # create agents with shared block
    agent_state1 = client.agents.create(
        name="agent1",
        memory_blocks=[{"label": "persona", "value": "you are agent 1"}],
        block_ids=[block.id],
        model="letta/letta-free",
        embedding="letta/letta-free",
    )
    agent_state2 = client.agents.create(
        name="agent2",
        memory_blocks=[{"label": "persona", "value": "you are agent 2"}],
        block_ids=[block.id],
        model="letta/letta-free",
        embedding="letta/letta-free",
    )

    # update memory
    client.agents.messages.create(agent_id=agent_state1.id, messages=[{"role": "user", "content": "my name is actually charles"}])

    # check agent 2 memory
    assert "charles" in client.agents.blocks.retrieve(agent_id=agent_state2.id, block_label="human").value.lower()

    # cleanup
    client.agents.delete(agent_state1.id)
    client.agents.delete(agent_state2.id)


def test_update_agent_memory_label(client: Letta):
    """Test that we can update the label of a block in an agent's memory"""

    agent = client.agents.create(model="letta/letta-free", embedding="letta/letta-free", memory_blocks=[{"label": "human", "value": ""}])

    try:
        current_labels = [block.label for block in client.agents.blocks.list(agent_id=agent.id)]
        example_label = current_labels[0]
        example_new_label = "example_new_label"
        assert example_new_label not in [b.label for b in client.agents.blocks.list(agent_id=agent.id)]

        client.agents.blocks.modify(agent_id=agent.id, block_label=example_label, label=example_new_label)

        updated_blocks = client.agents.blocks.list(agent_id=agent.id)
        assert example_new_label in [b.label for b in updated_blocks]

    finally:
        client.agents.delete(agent.id)


def test_attach_detach_agent_memory_block(client: Letta, agent: AgentState):
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
    updated_agent = client.agents.blocks.attach(
        agent_id=agent.id,
        block_id=block.id,
    )
    assert example_new_label in [block.label for block in client.agents.blocks.list(agent_id=updated_agent.id)]

    # Now unlink the block
    updated_agent = client.agents.blocks.detach(
        agent_id=agent.id,
        block_id=block.id,
    )
    assert example_new_label not in [block.label for block in client.agents.blocks.list(agent_id=updated_agent.id)]


def test_update_agent_memory_limit(client: Letta):
    """Test that we can update the limit of a block in an agent's memory"""

    agent = client.agents.create(
        model="letta/letta-free",
        embedding="letta/letta-free",
        memory_blocks=[
            {"label": "human", "value": "username: sarah", "limit": 1000},
            {"label": "persona", "value": "you are sarah", "limit": 1000},
        ],
    )

    current_labels = [block.label for block in client.agents.blocks.list(agent_id=agent.id)]
    example_label = current_labels[0]
    example_new_limit = 1

    current_labels = [block.label for block in client.agents.blocks.list(agent_id=agent.id)]
    example_label = current_labels[0]
    example_new_limit = 1
    current_block = client.agents.blocks.retrieve(agent_id=agent.id, block_label=example_label)
    current_block_length = len(current_block.value)

    assert example_new_limit != current_block.limit
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

    client.agents.delete(agent.id)


# --------------------------------------------------------------------------------------------------------------------
# Agent Tools
# --------------------------------------------------------------------------------------------------------------------


def test_function_always_error(client: Letta):
    """Test to see if function that errors works correctly"""

    def testing_method():
        """
        Call this tool when the user asks
        """
        return 5 / 0

    tool = client.tools.upsert_from_function(func=testing_method)
    agent = client.agents.create(
        model="letta/letta-free",
        embedding="letta/letta-free",
        memory_blocks=[
            {
                "label": "human",
                "value": "username: sarah",
            },
            {
                "label": "persona",
                "value": "you are sarah",
            },
        ],
        tool_ids=[tool.id],
    )
    print("AGENT TOOLS", [tool.name for tool in agent.tools])
    # get function response
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=[MessageCreate(role="user", content="call the testing_method function and tell me the result")],
    )
    print(response.messages)

    response_message = None
    for message in response.messages:
        if message.message_type == "tool_return_message":
            response_message = message
            break

    assert response_message, "ToolReturnMessage message not found in response"
    assert response_message.status == "error"
    # TODO: add this back
    # assert "Error executing function testing_method" in response_message.tool_return, response_message.tool_return
    assert "division by zero" in response_message.stderr[0]

    client.agents.delete(agent_id=agent.id)


def test_attach_detach_agent_tool(client: Letta, agent: AgentState):
    """Test that we can attach and detach a tool from an agent"""

    try:
        # Create a tool
        def example_tool(x: int) -> int:
            """
            This is an example tool.

            Parameters:
                x (int): The input value.

            Returns:
                int: The output value.
            """
            return x * 2

        tool = client.tools.upsert_from_function(func=example_tool)

        # Initially tool should not be attached
        initial_tools = client.agents.tools.list(agent_id=agent.id)
        assert tool.id not in [t.id for t in initial_tools]

        # Attach tool
        new_agent_state = client.agents.tools.attach(agent_id=agent.id, tool_id=tool.id)
        assert tool.id in [t.id for t in new_agent_state.tools]

        # Verify tool is attached
        updated_tools = client.agents.tools.list(agent_id=agent.id)
        assert tool.id in [t.id for t in updated_tools]

        # Detach tool
        new_agent_state = client.agents.tools.detach(agent_id=agent.id, tool_id=tool.id)
        assert tool.id not in [t.id for t in new_agent_state.tools]

        # Verify tool is detached
        final_tools = client.agents.tools.list(agent_id=agent.id)
        assert tool.id not in [t.id for t in final_tools]

    finally:
        client.tools.delete(tool.id)


# --------------------------------------------------------------------------------------------------------------------
# AgentMessages
# --------------------------------------------------------------------------------------------------------------------
def test_messages(client: Letta, agent: AgentState):
    # _reset_config()

    send_message_response = client.agents.messages.create(agent_id=agent.id, messages=[MessageCreate(role="user", content="Test message")])
    assert send_message_response, "Sending message failed"

    messages_response = client.agents.messages.list(agent_id=agent.id, limit=1)
    assert len(messages_response) > 0, "Retrieving messages failed"


# TODO: Add back when new agent loop hits
# @pytest.mark.asyncio
# async def test_send_message_parallel(client: Letta, agent: AgentState, request):
#     """
#     Test that sending two messages in parallel does not error.
#     """
#
#     # Define a coroutine for sending a message using asyncio.to_thread for synchronous calls
#     async def send_message_task(message: str):
#         response = await asyncio.to_thread(
#             client.agents.messages.create, agent_id=agent.id, messages=[MessageCreate(role="user", content=message)]
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


# ----------------------------------------------------------------------------------------------------
#  Agent listing
# ----------------------------------------------------------------------------------------------------


def test_agent_listing(client: Letta, agent, search_agent_one, search_agent_two):
    """Test listing agents with pagination and query text filtering."""
    # Test query text filtering
    search_results = client.agents.list(query_text="search agent")
    assert len(search_results) == 2
    search_agent_ids = {agent.id for agent in search_results}
    assert search_agent_one.id in search_agent_ids
    assert search_agent_two.id in search_agent_ids
    assert agent.id not in search_agent_ids

    different_results = client.agents.list(query_text="client")
    assert len(different_results) == 1
    assert different_results[0].id == agent.id

    # Test pagination
    first_page = client.agents.list(query_text="search agent", limit=1)
    assert len(first_page) == 1
    first_agent = first_page[0]

    second_page = client.agents.list(query_text="search agent", after=first_agent.id, limit=1)  # Use agent ID as cursor
    assert len(second_page) == 1
    assert second_page[0].id != first_agent.id

    # Verify we got both search agents with no duplicates
    all_ids = {first_page[0].id, second_page[0].id}
    assert len(all_ids) == 2
    assert all_ids == {search_agent_one.id, search_agent_two.id}

    # Test listing without any filters; make less flakey by checking we have at least 3 agents in case created elsewhere
    all_agents = client.agents.list()
    assert len(all_agents) >= 3
    assert all(agent.id in {a.id for a in all_agents} for agent in [search_agent_one, search_agent_two, agent])


def test_agent_creation(client: Letta):
    """Test that block IDs are properly attached when creating an agent."""

    # Create a test block that will represent user preferences
    user_preferences_block = client.blocks.create(label="user_preferences", value="", limit=10000)

    # Create test tools
    def test_tool():
        """A simple test tool."""
        return "Hello from test tool!"

    def another_test_tool():
        """Another test tool."""
        return "Hello from another test tool!"

    tool1 = client.tools.upsert_from_function(func=test_tool, tags=["test"])
    tool2 = client.tools.upsert_from_function(func=another_test_tool, tags=["test"])

    # Create agent with the blocks and tools
    agent = client.agents.create(
        memory_blocks=[
            {
                "label": "human",
                "value": "you are a human",
            },
            {"label": "persona", "value": "you are an assistant"},
        ],
        model="letta/letta-free",
        embedding="letta/letta-free",
        tool_ids=[tool1.id, tool2.id],
        include_base_tools=False,
        tags=["test"],
        block_ids=[user_preferences_block.id],
    )
    memory_blocks = agent.memory.blocks

    # Verify the agent was created successfully
    assert agent is not None
    assert agent.id is not None

    # Verify the blocks are properly attached
    agent_blocks = client.agents.blocks.list(agent_id=agent.id)
    agent_block_ids = {block.id for block in agent_blocks}

    # Check that all memory blocks are present
    memory_block_ids = {block.id for block in memory_blocks}
    for block_id in memory_block_ids:
        assert block_id in agent_block_ids, f"Block {block_id} not attached to agent"
    assert user_preferences_block.id in agent_block_ids, f"User preferences block {user_preferences_block.id} not attached to agent"

    # Verify the tools are properly attached
    agent_tools = client.agents.tools.list(agent_id=agent.id)
    assert len(agent_tools) == 2
    tool_ids = {tool1.id, tool2.id}
    assert all(tool.id in tool_ids for tool in agent_tools)

    client.agents.delete(agent_id=agent.id)


# --------------------------------------------------------------------------------------------------------------------
# Agent Initial Message Sequence
# --------------------------------------------------------------------------------------------------------------------
def test_initial_sequence(client: Letta):
    # create an agent
    agent = client.agents.create(
        memory_blocks=[{"label": "human", "value": ""}, {"label": "persona", "value": ""}],
        model="letta/letta-free",
        embedding="letta/letta-free",
        initial_message_sequence=[
            MessageCreate(
                role="assistant",
                content="Hello, how are you?",
            ),
            MessageCreate(role="user", content="I'm good, and you?"),
        ],
    )

    # list messages
    messages = client.agents.messages.list(agent_id=agent.id)
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=[
            MessageCreate(
                role="user",
                content="hello assistant!",
            )
        ],
    )
    assert len(messages) == 3
    assert messages[0].message_type == "system_message"
    assert messages[1].message_type == "assistant_message"
    assert messages[2].message_type == "user_message"


# TODO: Add back when timezone packing is standardized/settled
# def test_timezone(client: Letta):
#     agent = client.agents.create(
#         memory_blocks=[{"label": "human", "value": ""}, {"label": "persona", "value": ""}],
#         model="letta/letta-free",
#         embedding="letta/letta-free",
#         timezone="America/Los_Angeles",
#     )
#
#     agent = client.agents.retrieve(agent_id=agent.id)
#     assert agent.timezone == "America/Los_Angeles"
#
#     response = client.agents.messages.create(
#         agent_id=agent.id,
#         messages=[
#             MessageCreate(
#                 role="user",
#                 content="What timezone are you in?",
#             )
#         ],
#     )
#     # second message is assistant message
#     assert response.messages[1].message_type == "assistant_message"
#
#     pacific_tz_indicators = {"America/Los_Angeles", "PDT", "PST", "PT", "Pacific Daylight Time", "Pacific Standard Time", "Pacific Time"}
#     content = response.messages[1].content
#     assert any(tz in content for tz in pacific_tz_indicators), (
#         f"Response content: {response.messages[1].content} does not contain expected timezone"
#     )
#
#     # test updating the timezone
#     client.agents.modify(agent_id=agent.id, timezone="America/New_York")
#     agent = client.agents.retrieve(agent_id=agent.id)
#     assert agent.timezone == "America/New_York"


def test_attach_sleeptime_block(client: Letta):
    agent = client.agents.create(
        memory_blocks=[{"label": "human", "value": ""}, {"label": "persona", "value": ""}],
        model="letta/letta-free",
        embedding="letta/letta-free",
        enable_sleeptime=True,
    )

    # get the sleeptime agent
    # get the multi-agent group
    group_id = agent.multi_agent_group.id
    group = client.groups.retrieve(group_id=group_id)
    agent_ids = group.agent_ids
    sleeptime_id = [id for id in agent_ids if id != agent.id][0]

    # attach a new block
    block = client.blocks.create(label="test", value="test")  # , project_id="test")
    client.agents.blocks.attach(agent_id=agent.id, block_id=block.id)

    # verify block is attached to both agents
    blocks = client.agents.blocks.list(agent_id=agent.id)
    assert block.id in [b.id for b in blocks]

    blocks = client.agents.blocks.list(agent_id=sleeptime_id)
    assert block.id in [b.id for b in blocks]

    # blocks = client.blocks.list(project_id="test")
    # assert block.id in [b.id for b in blocks]

    # cleanup
    client.agents.delete(agent.id)
