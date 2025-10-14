import os
import threading
import time

import pytest
import requests
from dotenv import load_dotenv
from letta_client import Letta
from letta_client.core.api_error import ApiError

from letta.constants import DEFAULT_HUMAN
from letta.orm.errors import NoResultFound
from letta.schemas.block import CreateBlock
from letta.schemas.enums import AgentType, JobStatus, JobType, ToolRuleType
from letta.schemas.group import ManagerType, SleeptimeManagerUpdate
from letta.schemas.message import MessageCreate
from letta.schemas.run import Run
from letta.utils import get_human_text, get_persona_text


@pytest.fixture(scope="module")
def server_url() -> str:
    """
    Provides the URL for the Letta server.
    If LETTA_SERVER_URL is not set, starts the server in a background thread
    and polls until it's accepting connections.
    """

    def _run_server() -> None:
        load_dotenv()
        from letta.server.rest_api.app import start_server

        start_server(debug=True)

    url: str = os.getenv("LETTA_SERVER_URL", "http://localhost:8283")

    if not os.getenv("LETTA_SERVER_URL"):
        thread = threading.Thread(target=_run_server, daemon=True)
        thread.start()

        # Poll until the server is up (or timeout)
        timeout_seconds = 30
        deadline = time.time() + timeout_seconds
        while time.time() < deadline:
            try:
                resp = requests.get(url + "/v1/health")
                if resp.status_code < 500:
                    break
            except requests.exceptions.RequestException:
                pass
            time.sleep(0.1)
        else:
            raise RuntimeError(f"Could not reach {url} within {timeout_seconds}s")

    return url


@pytest.fixture(scope="module")
def client(server_url: str) -> Letta:
    """
    Creates and returns a synchronous Letta REST client for testing.
    """
    client_instance = Letta(base_url=server_url)
    yield client_instance


@pytest.mark.flaky(max_runs=3)
@pytest.mark.asyncio(loop_scope="module")
async def test_sleeptime_group_chat(client):
    # 0. Refresh base tools
    client.tools.upsert_base_tools()

    # 1. Create sleeptime agent
    main_agent = client.agents.create(
        name="main_agent",
        memory_blocks=[
            CreateBlock(
                label="persona",
                value="You are a personal assistant that helps users with requests.",
            ),
            CreateBlock(
                label="human",
                value="My favorite plant is the fiddle leaf\nMy favorite color is lavender",
            ),
        ],
        model="anthropic/claude-sonnet-4-5-20250929",
        embedding="openai/text-embedding-3-small",
        enable_sleeptime=True,
        agent_type=AgentType.letta_v1_agent,
    )

    assert main_agent.enable_sleeptime == True
    main_agent_tools = [tool.name for tool in main_agent.tools]
    assert "core_memory_append" not in main_agent_tools
    assert "core_memory_replace" not in main_agent_tools
    assert "archival_memory_insert" not in main_agent_tools

    # 2. Override frequency for test
    group = client.groups.modify(
        group_id=main_agent.multi_agent_group.id,
        manager_config=SleeptimeManagerUpdate(
            sleeptime_agent_frequency=2,
        ),
    )

    assert group.manager_type == ManagerType.sleeptime
    assert group.sleeptime_agent_frequency == 2
    assert len(group.agent_ids) == 1

    # 3. Verify shared blocks
    sleeptime_agent_id = group.agent_ids[0]
    shared_block = client.agents.blocks.retrieve(agent_id=main_agent.id, block_label="human")
    agents = client.blocks.agents.list(block_id=shared_block.id)
    assert len(agents) == 2
    assert sleeptime_agent_id in [agent.id for agent in agents]
    assert main_agent.id in [agent.id for agent in agents]

    # 4 Verify sleeptime agent tools
    sleeptime_agent = client.agents.retrieve(agent_id=sleeptime_agent_id)
    sleeptime_agent_tools = [tool.name for tool in sleeptime_agent.tools]
    assert "memory_rethink" in sleeptime_agent_tools
    assert "memory_finish_edits" in sleeptime_agent_tools
    assert "memory_replace" in sleeptime_agent_tools
    assert "memory_insert" in sleeptime_agent_tools

    assert len([rule for rule in sleeptime_agent.tool_rules if rule.type == ToolRuleType.exit_loop]) > 0

    # 5. Send messages and verify run ids
    message_text = [
        "my favorite color is orange",
        "not particularly. today is a good day",
        "actually my favorite color is coral",
        "let's change the subject",
        "actually my fav plant is the the african spear",
        "indeed",
    ]
    run_ids = []
    for i, text in enumerate(message_text):
        response = client.agents.messages.create(
            agent_id=main_agent.id,
            messages=[
                MessageCreate(
                    role="user",
                    content=text,
                ),
            ],
        )

        assert len(response.messages) > 0
        assert len(response.usage.run_ids or []) == (i + 1) % 2
        run_ids.extend(response.usage.run_ids or [])

        runs = client.runs.list()
        agent_runs = [run for run in runs if run.agent_id == sleeptime_agent_id]
        assert len(agent_runs) == len(run_ids)

    # 6. Verify run status after sleep
    time.sleep(2)
    for run_id in run_ids:
        job = client.runs.retrieve(run_id=run_id)
        assert job.status == JobStatus.running or job.status == JobStatus.completed

    # 7. Delete agent
    client.agents.delete(agent_id=main_agent.id)

    with pytest.raises(ApiError):
        client.groups.retrieve(group_id=group.id)
    with pytest.raises(ApiError):
        client.agents.retrieve(agent_id=sleeptime_agent_id)


@pytest.mark.skip
@pytest.mark.asyncio(loop_scope="module")
async def test_sleeptime_removes_redundant_information(client):
    # 1. set up sleep-time agent as in test_sleeptime_group_chat
    client.tools.upsert_base_tools()
    main_agent = client.agents.create(
        name="main_agent",
        memory_blocks=[
            CreateBlock(
                label="persona",
                value="You are a personal assistant that helps users with requests.",
            ),
            CreateBlock(
                label="human",
                value="My favorite plant is the fiddle leaf\nMy favorite dog is the husky\nMy favorite plant is the fiddle leaf\nMy favorite plant is the fiddle leaf",
            ),
        ],
        model="anthropic/claude-sonnet-4-5-20250929",
        embedding="openai/text-embedding-3-small",
        enable_sleeptime=True,
        agent_type=AgentType.letta_v1_agent,
    )

    group = client.groups.modify(
        group_id=main_agent.multi_agent_group.id,
        manager_config=SleeptimeManagerUpdate(
            sleeptime_agent_frequency=1,
        ),
    )
    sleeptime_agent_id = group.agent_ids[0]
    shared_block = client.agents.blocks.retrieve(agent_id=main_agent.id, block_label="human")
    count_before_memory_edits = shared_block.value.count("fiddle leaf")
    test_messages = ["hello there", "my favorite bird is the sparrow"]

    for test_message in test_messages:
        _ = client.agents.messages.create(
            agent_id=main_agent.id,
            messages=[
                MessageCreate(
                    role="user",
                    content=test_message,
                ),
            ],
        )
    # 2. Allow memory blocks time to update
    time.sleep(5)

    # 3. Check that the memory blocks have been collapsed
    shared_block = client.agents.blocks.retrieve(agent_id=main_agent.id, block_label="human")
    count_after_memory_edits = shared_block.value.count("fiddle leaf")
    assert count_after_memory_edits < count_before_memory_edits

    # 4. Delete agent
    client.agents.delete(agent_id=main_agent.id)

    with pytest.raises(ApiError):
        client.groups.retrieve(group_id=group.id)
    with pytest.raises(ApiError):
        client.agents.retrieve(agent_id=sleeptime_agent_id)


@pytest.mark.asyncio(loop_scope="module")
async def test_sleeptime_edit(client):
    sleeptime_agent = client.agents.create(
        name="sleeptime_agent",
        agent_type=AgentType.sleeptime_agent,
        memory_blocks=[
            CreateBlock(
                label="human",
                value=get_human_text(DEFAULT_HUMAN),
                limit=2000,
            ),
            CreateBlock(
                label="memory_persona",
                value=get_persona_text("sleeptime_memory_persona"),
                limit=2000,
            ),
            CreateBlock(
                label="fact_block",
                value="""Messi resides in the Paris.
                    Messi plays in the league Ligue 1.
                    Messi plays for the team Paris Saint-Germain.
                    The national team Messi plays for is the Argentina team.
                    Messi is also known as Leo Messi
                    Victor Ulloa plays for Inter Miami""",
                limit=2000,
            ),
        ],
        model="anthropic/claude-sonnet-4-5-20250929",
        embedding="openai/text-embedding-3-small",
        enable_sleeptime=True,
    )

    _ = client.agents.messages.create(
        agent_id=sleeptime_agent.id,
        messages=[
            MessageCreate(
                role="user",
                content="Messi has now moved to playing for Inter Miami",
            ),
        ],
    )
    fact_block = client.agents.blocks.retrieve(agent_id=sleeptime_agent.id, block_label="fact_block")
    print(fact_block.value)
    assert fact_block.value.count("Inter Miami") > 1


@pytest.mark.asyncio(loop_scope="module")
async def test_sleeptime_agent_new_block_attachment(client):
    """Test that a new block created after agent creation is properly attached to both main and sleeptime agents."""
    # 0. Refresh base tools
    client.tools.upsert_base_tools()

    # 1. Create sleeptime agent
    main_agent = client.agents.create(
        name="main_agent",
        memory_blocks=[
            CreateBlock(
                label="persona",
                value="You are a personal assistant that helps users with requests.",
            ),
            CreateBlock(
                label="human",
                value="My favorite plant is the fiddle leaf\nMy favorite color is lavender",
            ),
        ],
        model="anthropic/claude-sonnet-4-5-20250929",
        embedding="openai/text-embedding-3-small",
        enable_sleeptime=True,
        agent_type=AgentType.letta_v1_agent,
    )

    assert main_agent.enable_sleeptime == True

    # 2. Get the sleeptime agent ID
    group = main_agent.multi_agent_group
    sleeptime_agent_id = group.agent_ids[0]

    # 3. Verify initial shared blocks
    main_agent_refreshed = client.agents.retrieve(agent_id=main_agent.id)
    initial_blocks = main_agent_refreshed.memory.blocks
    initial_block_count = len(initial_blocks)

    # Verify both agents share the initial blocks
    for block in initial_blocks:
        agents = client.blocks.agents.list(block_id=block.id)
        assert len(agents) == 2
        assert sleeptime_agent_id in [agent.id for agent in agents]
        assert main_agent.id in [agent.id for agent in agents]

    # 4. Create a new block after agent creation
    from letta.schemas.block import Block as PydanticBlock

    new_block = client.blocks.create(
        label="preferences",
        value="My favorite season is autumn\nI prefer tea over coffee",
    )

    # 5. Attach the new block to the main agent
    client.agents.blocks.attach(agent_id=main_agent.id, block_id=new_block.id)

    # 6. Verify the new block is attached to the main agent
    main_agent_refreshed = client.agents.retrieve(agent_id=main_agent.id)
    main_agent_blocks = main_agent_refreshed.memory.blocks
    assert len(main_agent_blocks) == initial_block_count + 1
    main_agent_block_ids = [block.id for block in main_agent_blocks]
    assert new_block.id in main_agent_block_ids

    # 7. Check if the new block is also attached to the sleeptime agent (this is where the bug might be)
    sleeptime_agent = client.agents.retrieve(agent_id=sleeptime_agent_id)
    sleeptime_agent_blocks = sleeptime_agent.memory.blocks
    sleeptime_agent_block_ids = [block.id for block in sleeptime_agent_blocks]

    # This assertion should pass if the bug is fixed
    assert new_block.id in sleeptime_agent_block_ids, f"New block {new_block.id} not attached to sleeptime agent {sleeptime_agent_id}"

    # 8. Verify that agents sharing the new block include both main and sleeptime agents
    agents_with_new_block = client.blocks.agents.list(block_id=new_block.id)
    agent_ids_with_new_block = [agent.id for agent in agents_with_new_block]

    assert main_agent.id in agent_ids_with_new_block, "Main agent should have access to the new block"
    assert sleeptime_agent_id in agent_ids_with_new_block, "Sleeptime agent should have access to the new block"
    assert len(agents_with_new_block) == 2, "Both main and sleeptime agents should share the new block"

    # 9. Clean up
    client.agents.delete(agent_id=main_agent.id)
