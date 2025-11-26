import os
from typing import List

import httpx
import pytest
from letta_client import Letta

from letta.schemas.agent import AgentState


@pytest.fixture(scope="function")
def test_agents(client: Letta) -> List[AgentState]:
    """
    Creates test agents - some hidden, some not hidden.
    Cleans them up after the test.
    """
    agents = []

    # Create 3 non-hidden agents
    for i in range(3):
        agent = client.agents.create(
            name=f"test_agent_visible_{i}",
            tags=["test", "visible"],
            model="openai/gpt-4o-mini",
            embedding="openai/text-embedding-3-small",
        )
        agents.append(agent)

    # Create 2 hidden agents
    for i in range(2):
        # Create agent as hidden using direct HTTP call (SDK might not support hidden parameter yet)
        response = httpx.post(
            f"{client._client._base_url}/v1/agents/",
            json={
                "name": f"test_agent_hidden_{i}",
                "tags": ["test", "hidden"],
                "model": "openai/gpt-4o-mini",
                "embedding": "openai/text-embedding-3-small",
                "hidden": True,
            },
            headers=client._client._headers,
            timeout=10.0,
        )
        response.raise_for_status()
        agent_data = response.json()

        # Create a simple AgentState-like object for tracking
        class SimpleAgent:
            def __init__(self, id):
                self.id = id

        agents.append(SimpleAgent(agent_data["id"]))

    yield agents

    # Cleanup
    for agent in agents:
        try:
            client.agents.delete(agent.id)
        except:
            pass


def test_internal_agents_count_exclude_hidden(client: Letta, test_agents: List[AgentState]):
    """
    Test that the internal agents count endpoint correctly excludes hidden agents
    when exclude_hidden=True (default).
    """
    # Make a request to the internal endpoint
    # Note: We need to use the raw HTTP client since the SDK might not have this endpoint
    response = httpx.get(
        f"{client._client._base_url}/v1/_internal_agents/count",
        params={"exclude_hidden": True},
        headers=client._client._headers,
        timeout=10.0,
    )

    assert response.status_code == 200
    count = response.json()

    # Should count at least the 3 visible agents we created
    # (there might be other agents in the system)
    assert isinstance(count, int)
    assert count >= 3

    # Get the total count with hidden agents included
    response_with_hidden = httpx.get(
        f"{client._client._base_url}/v1/_internal_agents/count",
        params={"exclude_hidden": False},
        headers=client._client._headers,
        timeout=10.0,
    )

    assert response_with_hidden.status_code == 200
    count_with_hidden = response_with_hidden.json()

    # The count with hidden should be at least 2 more than without hidden
    assert count_with_hidden >= count + 2


def test_internal_agents_count_include_all(client: Letta, test_agents: List[AgentState]):
    """
    Test that the internal agents count endpoint correctly includes all agents
    when exclude_hidden=False.
    """
    response = httpx.get(
        f"{client._client._base_url}/v1/_internal_agents/count",
        params={"exclude_hidden": False},
        headers=client._client._headers,
        timeout=10.0,
    )

    assert response.status_code == 200
    count = response.json()

    # Should count at least all 5 agents we created (3 visible + 2 hidden)
    assert isinstance(count, int)
    assert count >= 5


def test_internal_agents_count_default_behavior(client: Letta, test_agents: List[AgentState]):
    """
    Test that the default behavior (exclude_hidden=True) works correctly.
    """
    # Call without specifying exclude_hidden (should default to True)
    response = httpx.get(
        f"{client._client._base_url}/v1/_internal_agents/count",
        headers=client._client._headers,
        timeout=10.0,
    )

    assert response.status_code == 200
    count = response.json()

    # Should count at least the 3 visible agents we created
    assert isinstance(count, int)
    assert count >= 3

    # This should be the same as explicitly setting exclude_hidden=True
    response_explicit = httpx.get(
        f"{client._client._base_url}/v1/_internal_agents/count",
        params={"exclude_hidden": True},
        headers=client._client._headers,
        timeout=10.0,
    )

    count_explicit = response_explicit.json()

    # The two counts should be equal
    assert count == count_explicit
