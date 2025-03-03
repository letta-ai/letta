import datetime
import json
import math
import os
import random
import uuid

import pytest
from faker import Faker
from tqdm import tqdm

from letta import create_client
from letta.orm import Base
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message
from letta.services.agent_manager import AgentManager
from letta.services.message_manager import MessageManager
from tests.integration_test_summarizer import LLM_CONFIG_DIR


@pytest.fixture(autouse=True)
def truncate_database():
    from letta.server.db import db_context

    with db_context() as session:
        for table in reversed(Base.metadata.sorted_tables):  # Reverse to avoid FK issues
            session.execute(table.delete())  # Truncate table
        session.commit()


@pytest.fixture(scope="function")
def client():
    filename = os.path.join(LLM_CONFIG_DIR, "claude-3-5-sonnet.json")
    config_data = json.load(open(filename, "r"))
    llm_config = LLMConfig(**config_data)
    client = create_client()
    client.set_default_llm_config(llm_config)
    client.set_default_embedding_config(EmbeddingConfig.default_config(provider="openai"))

    yield client


def generate_tool_call_id():
    """Generates a unique tool call ID."""
    return "toolu_" + uuid.uuid4().hex[:24]


def generate_timestamps(base_time):
    """Creates a sequence of timestamps for user, assistant, and tool messages."""
    user_time = base_time
    send_time = user_time + datetime.timedelta(seconds=random.randint(2, 5))
    tool_time = send_time + datetime.timedelta(seconds=random.randint(1, 3))
    next_group_time = tool_time + datetime.timedelta(seconds=random.randint(5, 10))

    return user_time, send_time, tool_time, next_group_time


def get_conversation_pair():
    fake = Faker()
    return f"Where does {fake.name()} live?", f"{fake.address()}"


def create_user_message(agent_id, organization_id, message_text, timestamp):
    """Creates a user message dictionary."""
    return {
        "role": "user",
        "content": [
            {
                "type": "text",
                "text": json.dumps(
                    {"type": "user_message", "message": message_text, "time": timestamp.strftime("%Y-%m-%d %I:%M:%S %p PST-0800")}, indent=2
                ),
            }
        ],
        "organization_id": organization_id,
        "agent_id": agent_id,
        "model": None,
        "name": None,
        "tool_calls": None,
        "tool_call_id": None,
    }


def create_send_message(agent_id, organization_id, assistant_text, tool_call_id, timestamp):
    """Creates an assistant message dictionary."""
    return {
        "role": "assistant",
        "content": [{"type": "text", "text": f"Assistant reply generated at {timestamp.strftime('%Y-%m-%d %I:%M:%S %p PST-0800')}."}],
        "organization_id": organization_id,
        "agent_id": agent_id,
        "model": "claude-3-5-haiku-20241022",
        "name": None,
        "tool_calls": [
            {
                "id": tool_call_id,
                "function": {
                    "name": "send_message",
                    "arguments": json.dumps(
                        {"message": assistant_text, "time": timestamp.strftime("%Y-%m-%d %I:%M:%S %p PST-0800")}, indent=2
                    ),
                },
                "type": "function",
            }
        ],
        "tool_call_id": None,
    }


def create_tool_message(agent_id, organization_id, tool_call_id, timestamp):
    """Creates a tool response message dictionary."""
    return {
        "role": "tool",
        "content": [
            {
                "type": "text",
                "text": json.dumps(
                    {"status": "OK", "message": "None", "time": timestamp.strftime("%Y-%m-%d %I:%M:%S %p PST-0800")}, indent=2
                ),
            }
        ],
        "organization_id": organization_id,
        "agent_id": agent_id,
        "model": "claude-3-5-haiku-20241022",
        "name": "send_message",
        "tool_calls": None,
        "tool_call_id": tool_call_id,
    }


@pytest.mark.parametrize("num_messages", [1000])
def test_many_messages_performance(client, num_messages):
    """Main test function to generate messages and insert them into the database."""
    message_manager = MessageManager()
    agent_manager = AgentManager()
    actor = client.user

    start_time = datetime.datetime.now()
    last_event_time = start_time  # Track last event time

    def log_event(event):
        nonlocal last_event_time
        now = datetime.datetime.now()
        total_elapsed = (now - start_time).total_seconds()
        step_elapsed = (now - last_event_time).total_seconds()
        print(f"[+{total_elapsed:.3f}s | Δ{step_elapsed:.3f}s] {event}")
        last_event_time = now  # Update last event time

    log_event(f"Starting test with {num_messages} messages")

    agent_state = client.create_agent(name="manager")
    log_event(f"Created agent with ID {agent_state.id}")

    message_group_size = 3
    num_groups = math.ceil((num_messages - 4) / message_group_size)
    base_time = datetime.datetime(2025, 2, 10, 16, 3, 22)
    current_time = base_time
    organization_id = "org-00000000-0000-4000-8000-000000000000"

    all_messages = []

    for _ in tqdm(range(num_groups)):
        user_text, assistant_text = get_conversation_pair()
        tool_call_id = generate_tool_call_id()
        user_time, send_time, tool_time, current_time = generate_timestamps(current_time)
        new_messages = [
            Message(**create_user_message(agent_state.id, organization_id, user_text, user_time)),
            Message(**create_send_message(agent_state.id, organization_id, assistant_text, tool_call_id, send_time)),
            Message(**create_tool_message(agent_state.id, organization_id, tool_call_id, tool_time)),
        ]
        all_messages.extend(new_messages)

    log_event(f"Finished generating {len(all_messages)} messages")

    message_manager.create_many_messages(all_messages, actor=actor)
    log_event("Inserted messages into the database")

    agent_manager.set_in_context_messages(
        agent_id=agent_state.id, message_ids=agent_state.message_ids + [m.id for m in all_messages], actor=client.user
    )
    log_event("Updated agent context with messages")

    messages = message_manager.list_messages_for_agent(agent_id=agent_state.id, actor=client.user, limit=1000000000)
    log_event(f"Retrieved {len(messages)} messages from the database")

    assert len(messages) >= num_groups * message_group_size

    response = client.send_message(
        agent_id=agent_state.id,
        role="user",
        message="What have we been talking about?",
    )
    log_event("Sent message to agent and received response")

    assert response
    log_event("Test completed successfully")
