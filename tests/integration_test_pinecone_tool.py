import asyncio
import json
import os
import threading
import time

import pytest
import requests
from dotenv import load_dotenv
from letta_client import AsyncLetta, MessageCreate, ReasoningMessage, ToolCallMessage
from letta_client.core import RequestOptions

from tests.helpers.utils import upload_test_agentfile_from_disk_async

REASONING_THROTTLE_MS = 100
TEST_USER_MESSAGE = "What products or services does 11x AI sell?"


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


@pytest.fixture(scope="function")
def client(server_url: str):
    """
    Creates and returns an asynchronous Letta REST client for testing.
    """
    async_client_instance = AsyncLetta(base_url=server_url)
    yield async_client_instance


async def test_pinecone_tool(client: AsyncLetta, server_url: str) -> None:
    """
    Test the Pinecone tool integration with the Letta client.
    """
    response = await upload_test_agentfile_from_disk_async(client, "knowledge-base.af")

    agent_id = response.agent_ids[0]

    agent = await client.agents.modify(
        agent_id=agent_id,
        tool_exec_environment_variables={
            "PINECONE_INDEX_HOST": os.getenv("PINECONE_INDEX_HOST"),
            "PINECONE_API_KEY": os.getenv("PINECONE_API_KEY"),
            "PINECONE_NAMESPACE": os.getenv("PINECONE_NAMESPACE"),
        },
    )
    last_message = await client.agents.messages.list(
        agent_id=agent.id,
        limit=1,
    )

    curr_message_type = None
    messages = []
    reasoning_content = []
    last_reasoning_update_ms = 0
    tool_call_content = ""
    tool_return_content = ""
    summary = None
    pinecone_results = None
    queries = []

    try:
        response = client.agents.messages.create_stream(
            agent_id=agent.id,
            messages=[
                MessageCreate(
                    role="user",
                    content=TEST_USER_MESSAGE,
                ),
            ],
            stream_tokens=True,
            request_options=RequestOptions(
                timeout_in_seconds=1000,
            ),
        )

        async for chunk in response:
            if chunk.message_type != curr_message_type:
                messages.append(chunk)
                curr_message_type = chunk.message_type
                if curr_message_type == "reasoning_message":
                    reasoning_content = []
                if curr_message_type == "tool_call_message":
                    tool_call_content = ""

            if chunk.message_type == "reasoning_message":
                now_ms = time.time_ns() // 1_000_000
                if now_ms - last_reasoning_update_ms < REASONING_THROTTLE_MS:
                    await asyncio.sleep(REASONING_THROTTLE_MS / 1000)

                last_reasoning_update_ms = now_ms
                if len(reasoning_content) == 0:
                    reasoning_content = [chunk.reasoning]
                else:
                    reasoning_content[-1] += chunk.reasoning

                message_dict = messages[-1].model_dump()
                message_dict["reasoning"] = "".join(reasoning_content).strip()
                messages[-1] = ReasoningMessage(**message_dict)

            if chunk.message_type == "tool_return_message":
                tool_return_content += chunk.tool_return

                if chunk.status == "success":
                    try:
                        if chunk.name == "summarize_pinecone_results":
                            json_response = json.loads(chunk.tool_return)
                            summary = json_response.get("summary", None)
                            pinecone_results = json_response.get("pinecone_results", None)
                            tool_return_content = ""
                        elif chunk.name == "craft_queries":
                            queries.append(chunk.tool_return)
                            tool_return_content = ""
                    except Exception as e:
                        print(f"Error parsing JSON response: {str(e)}. {chunk.tool_return}\n")
                        tool_return_content = ""

            if chunk.message_type == "tool_call_message":
                if chunk.tool_call.arguments is not None:
                    tool_call_content += chunk.tool_call.arguments
                    message_dict = messages[-1].model_dump()
                    message_dict["tool_call"]["arguments"] = tool_call_content
                    messages[-1] = ToolCallMessage(**message_dict)

    except Exception as e:
        print(f"Failed to fetch knowledge base response: {str(e)}\n")
        print(tool_call_content)
        raise e

    assert len(messages) > 0, "No messages received from the agent."
    assert len(reasoning_content) > 0, "No reasoning content received from the agent."
    assert summary is not None, "No summary received from the agent."
    assert pinecone_results is not None, "No Pinecone results received from the agent."
    assert len(queries) > 0, "No queries received from the agent."

    assert messages[-2].message_type == "stop_reason", "Penultimate message in stream must be stop reason."
    assert messages[-1].message_type == "usage_statistics", "Last message in stream must be usage stats."
    response_messages_from_stream = [m for m in messages if m.message_type not in ["stop_reason", "usage_statistics"]]
    response_message_types_from_stream = [m.message_type for m in response_messages_from_stream]

    messages_from_db = await client.agents.messages.list(
        agent_id=agent.id,
        after=last_message[0].id,
        limit=100,
    )
    response_messages_from_db = [m for m in messages_from_db if m.message_type != "user_message"]
    response_message_types_from_db = [m.message_type for m in response_messages_from_db]

    assert len(response_messages_from_stream) == len(response_messages_from_db)
    assert response_message_types_from_stream == response_message_types_from_db
    for idx in range(len(response_messages_from_stream)):
        stream_message = response_messages_from_stream[idx]
        db_message = response_messages_from_db[idx]
        assert stream_message.message_type == db_message.message_type
        assert stream_message.id == db_message.id
        assert stream_message.otid == db_message.otid

        if stream_message.message_type == "reasoning_message":
            assert stream_message.reasoning == db_message.reasoning

        if stream_message.message_type == "tool_call_message":
            assert stream_message.tool_call.tool_call_id == db_message.tool_call.tool_call_id
            assert stream_message.tool_call.name == db_message.tool_call.name

            if stream_message.tool_call.name == "craft_queries":
                assert "queries" in stream_message.tool_call.arguments
                assert "queries" in db_message.tool_call.arguments
            if stream_message.tool_call.name == "search_and_store_pinecone_records":
                assert "query_text" in stream_message.tool_call.arguments
                assert "query_text" in db_message.tool_call.arguments
            if stream_message.tool_call.name == "summarize_pinecone_results":
                assert "summary" in stream_message.tool_call.arguments
                assert "summary" in db_message.tool_call.arguments

            assert "inner_thoughts" not in stream_message.tool_call.arguments
            assert "inner_thoughts" not in db_message.tool_call.arguments

        if stream_message.message_type == "tool_return_message":
            assert stream_message.tool_return == db_message.tool_return

    await client.agents.delete(agent_id=agent.id)
