import asyncio
import json
import os
import threading
from typing import Any, List

import pytest
from dotenv import load_dotenv
from letta_client import AsyncLetta, MessageCreate

from letta.log import get_logger
from letta.schemas.agent import AgentState
from letta.schemas.enums import AgentType, JobStatus
from letta.schemas.llm_config import LLMConfig

logger = get_logger(__name__)


def get_llm_config(filename: str, llm_config_dir: str = "tests/configs/llm_model_configs") -> LLMConfig:
    filename = os.path.join(llm_config_dir, filename)
    with open(filename, "r") as f:
        config_data = json.load(f)
    llm_config = LLMConfig(**config_data)
    return llm_config


all_configs = [
    "openai-gpt-4o-mini.json",
    "openai-o3.json",
    "openai-gpt-5.json",
    "claude-4-5-sonnet.json",
    "claude-4-1-opus.json",
    "gemini-2.5-flash.json",
]

requested = os.getenv("LLM_CONFIG_FILE")
filenames = [requested] if requested else all_configs
TESTED_LLM_CONFIGS: List[LLMConfig] = [get_llm_config(fn) for fn in filenames]


def roll_dice(num_sides: int) -> int:
    """
    Returns a random number between 1 and num_sides.
    Args:
        num_sides (int): The number of sides on the die.
    Returns:
        int: A random integer between 1 and num_sides, representing the die roll.
    """
    import random

    return random.randint(1, num_sides)


USER_MESSAGE_ROLL_DICE: List[MessageCreate] = [
    MessageCreate(
        role="user",
        content="This is an automated test message. Call the roll_dice tool with 16 sides and reply back to me with the outcome.",
    )
]


async def accumulate_chunks(chunks: Any) -> List[Any]:
    """
    Accumulates chunks into a list of messages.
    """
    messages = []
    current_message = None
    prev_message_type = None
    async for chunk in chunks:
        current_message_type = chunk.message_type
        if prev_message_type != current_message_type:
            messages.append(current_message)
            current_message = chunk
        else:
            current_message = chunk
        prev_message_type = current_message_type
    messages.append(current_message)
    return [m for m in messages if m is not None]


async def cancel_run_after_delay(client: AsyncLetta, agent_id: str, delay: float = 0.5):
    await asyncio.sleep(delay)
    await client.agents.messages.cancel(agent_id=agent_id)


@pytest.fixture(scope="function")
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

        timeout_seconds = 30
        import time

        import httpx

        start_time = time.time()
        while time.time() - start_time < timeout_seconds:
            try:
                response = httpx.get(url + "/v1/health", timeout=1.0)
                if response.status_code == 200:
                    break
            except Exception:
                pass
            time.sleep(0.5)
        else:
            raise TimeoutError(f"Server at {url} did not become ready in {timeout_seconds}s")

    return url


@pytest.fixture(scope="function")
async def client(server_url: str) -> AsyncLetta:
    """
    Creates and returns an asynchronous Letta REST client for testing.
    """
    client_instance = AsyncLetta(base_url=server_url)
    yield client_instance


@pytest.fixture(scope="function")
async def agent_state(client: AsyncLetta) -> AgentState:
    """
    Creates and returns an agent state for testing with a pre-configured agent.
    The agent is configured with the roll_dice tool.
    """
    dice_tool = await client.tools.upsert_from_function(func=roll_dice)

    agent_state_instance = await client.agents.create(
        agent_type=AgentType.letta_v1_agent,
        name="test_agent",
        include_base_tools=False,
        tool_ids=[dice_tool.id],
        model="openai/gpt-4o",
        embedding="openai/text-embedding-3-small",
        tags=["test"],
    )
    yield agent_state_instance

    await client.agents.delete(agent_state_instance.id)


@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
@pytest.mark.asyncio(loop_scope="function")
async def test_background_streaming_cancellation(
    disable_e2b_api_key: Any,
    client: AsyncLetta,
    agent_state: AgentState,
    llm_config: LLMConfig,
) -> None:
    agent_state = await client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)

    delay = 5 if llm_config.model == "gpt-5" else 0.5
    _cancellation_task = asyncio.create_task(cancel_run_after_delay(client, agent_state.id, delay=delay))

    response = client.agents.messages.create_stream(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_ROLL_DICE,
        stream_tokens=True,
        background=True,
    )
    messages = await accumulate_chunks(response)
    run_id = messages[0].run_id

    await _cancellation_task

    run = await client.runs.retrieve(run_id=run_id)
    assert run.status == JobStatus.cancelled

    response = client.runs.stream(run_id=run_id, starting_after=0)
    messages_from_stream = await accumulate_chunks(response)
    assert len(messages_from_stream) > 0
