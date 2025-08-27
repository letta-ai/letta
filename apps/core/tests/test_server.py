import json
import os
import shutil
import uuid
import warnings
from typing import List, Tuple
from unittest.mock import patch

import pytest
from sqlalchemy import delete

import letta.utils as utils
from letta.constants import BASE_MEMORY_TOOLS, BASE_TOOLS, LETTA_DIR, LETTA_TOOL_EXECUTION_DIR
from letta.orm import Provider, ProviderTrace, Step
from letta.schemas.block import CreateBlock
from letta.schemas.enums import MessageRole, ProviderCategory, ProviderType, SandboxType
from letta.schemas.letta_message import LettaMessage, ReasoningMessage, SystemMessage, ToolCallMessage, ToolReturnMessage, UserMessage
from letta.schemas.llm_config import LLMConfig
from letta.schemas.providers import ProviderCreate
from letta.schemas.user import User
from letta.server.db import db_registry

utils.DEBUG = True
from letta.config import LettaConfig
from letta.schemas.agent import CreateAgent, UpdateAgent
from letta.schemas.message import Message
from letta.server.server import SyncServer
from letta.system import unpack_message


@pytest.fixture(scope="module")
def server():
    config = LettaConfig.load()
    config.save()

    server = SyncServer()
    return server


@pytest.fixture(scope="module")
def org_id(server):
    # create org
    org = server.organization_manager.create_default_organization()
    yield org.id

    # cleanup
    with db_registry.session() as session:
        session.execute(delete(ProviderTrace))
        session.execute(delete(Step))
        session.execute(delete(Provider))
        session.commit()
    server.organization_manager.delete_organization_by_id(org.id)


@pytest.fixture(scope="module")
def user(server, org_id):
    user = server.user_manager.create_default_user()
    yield user
    server.user_manager.delete_user_by_id(user.id)


@pytest.fixture(scope="module")
def user_id(server, user):
    # create user
    yield user.id


@pytest.fixture(scope="module")
def base_tools(server, user_id):
    actor = server.user_manager.get_user_or_default(user_id)
    tools = []
    for tool_name in BASE_TOOLS:
        tools.append(server.tool_manager.get_tool_by_name(tool_name=tool_name, actor=actor))

    yield tools


@pytest.fixture(scope="module")
def base_memory_tools(server, user_id):
    actor = server.user_manager.get_user_or_default(user_id)
    tools = []
    for tool_name in BASE_MEMORY_TOOLS:
        tools.append(server.tool_manager.get_tool_by_name(tool_name=tool_name, actor=actor))

    yield tools


@pytest.fixture(scope="module")
def agent_id(server, user_id, base_tools):
    # create agent
    actor = server.user_manager.get_user_or_default(user_id)
    agent_state = server.create_agent(
        request=CreateAgent(
            name="test_agent",
            tool_ids=[t.id for t in base_tools],
            memory_blocks=[],
            model="openai/gpt-4o-mini",
            embedding="openai/text-embedding-3-small",
        ),
        actor=actor,
    )
    yield agent_state.id

    # cleanup
    server.agent_manager.delete_agent(agent_state.id, actor=actor)


@pytest.fixture(scope="module")
def other_agent_id(server, user_id, base_tools):
    # create agent
    actor = server.user_manager.get_user_or_default(user_id)
    agent_state = server.create_agent(
        request=CreateAgent(
            name="test_agent_other",
            tool_ids=[t.id for t in base_tools],
            memory_blocks=[],
            model="openai/gpt-4o-mini",
            embedding="openai/text-embedding-3-small",
        ),
        actor=actor,
    )
    yield agent_state.id

    # cleanup
    server.agent_manager.delete_agent(agent_state.id, actor=actor)


def test_error_on_nonexistent_agent(server, user, agent_id):
    try:
        fake_agent_id = str(uuid.uuid4())
        server.user_message(user_id=user.id, agent_id=fake_agent_id, message="Hello?")
        raise Exception("user_message call should have failed")
    except (KeyError, ValueError) as e:
        # Error is expected
        print(e)
    except:
        raise


@pytest.mark.order(1)
def test_user_message_memory(server, user, agent_id):
    try:
        server.user_message(user_id=user.id, agent_id=agent_id, message="/memory")
        raise Exception("user_message call should have failed")
    except ValueError as e:
        # Error is expected
        print(e)
    except:
        raise

    server.run_command(user_id=user.id, agent_id=agent_id, command="/memory")


@pytest.mark.order(4)
def test_user_message(server, user, agent_id):
    # add data into recall memory
    response = server.user_message(user_id=user.id, agent_id=agent_id, message="What's up?")
    assert response.step_count == 1
    assert response.completion_tokens > 0
    assert response.prompt_tokens > 0
    assert response.total_tokens > 0


@pytest.mark.order(5)
def test_get_recall_memory(server, org_id, user, agent_id):
    # test recall memory cursor pagination
    actor = user
    messages_1 = server.get_agent_recall(user_id=user.id, agent_id=agent_id, limit=2)
    cursor1 = messages_1[-1].id
    messages_2 = server.get_agent_recall(user_id=user.id, agent_id=agent_id, after=cursor1, limit=1000)
    messages_3 = server.get_agent_recall(user_id=user.id, agent_id=agent_id, limit=1000)
    messages_3[-1].id
    assert messages_3[-1].created_at >= messages_3[0].created_at
    assert len(messages_3) == len(messages_1) + len(messages_2)
    messages_4 = server.get_agent_recall(user_id=user.id, agent_id=agent_id, reverse=True, before=cursor1)
    assert len(messages_4) == 1

    # test in-context message ids
    in_context_ids = server.agent_manager.get_agent_by_id(agent_id=agent_id, actor=actor).message_ids

    message_ids = [m.id for m in messages_3]
    for message_id in in_context_ids:
        assert message_id in message_ids, f"{message_id} not in {message_ids}"


@pytest.mark.asyncio
async def test_get_context_window_overview(server: SyncServer, user, agent_id):
    """Test that the context window overview fetch works"""
    overview = await server.agent_manager.get_context_window(agent_id=agent_id, actor=user)
    assert overview is not None

    # Run some basic checks
    assert overview.context_window_size_max is not None
    assert overview.context_window_size_current is not None
    assert overview.num_archival_memory is not None
    assert overview.num_recall_memory is not None
    assert overview.num_tokens_external_memory_summary is not None
    assert overview.external_memory_summary is not None
    assert overview.num_tokens_system is not None
    assert overview.system_prompt is not None
    assert overview.num_tokens_core_memory is not None
    assert overview.core_memory is not None
    assert overview.num_tokens_summary_memory is not None
    if overview.num_tokens_summary_memory > 0:
        assert overview.summary_memory is not None
    else:
        assert overview.summary_memory is None
    assert overview.num_tokens_functions_definitions is not None
    if overview.num_tokens_functions_definitions > 0:
        assert overview.functions_definitions is not None
    else:
        assert overview.functions_definitions is None
    assert overview.num_tokens_messages is not None
    assert overview.messages is not None

    assert overview.context_window_size_max >= overview.context_window_size_current
    assert overview.context_window_size_current == sum(
        (
            overview.num_tokens_system,
            overview.num_tokens_core_memory,
            overview.num_tokens_summary_memory,
            overview.num_tokens_messages,
            overview.num_tokens_functions_definitions,
            overview.num_tokens_external_memory_summary,
        )
    )


@pytest.mark.asyncio(loop_scope="session")
async def test_delete_agent_same_org(server: SyncServer, org_id: str, user: User):
    agent_state = await server.create_agent_async(
        request=CreateAgent(
            name="nonexistent_tools_agent",
            memory_blocks=[],
            model="openai/gpt-4o-mini",
            embedding="openai/text-embedding-3-small",
        ),
        actor=user,
    )

    # create another user in the same org
    another_user = await server.user_manager.create_actor_async(User(organization_id=org_id, name="another"))

    # test that another user in the same org can delete the agent
    await server.agent_manager.delete_agent_async(agent_state.id, actor=another_user)


@pytest.mark.asyncio
async def test_read_local_llm_configs(server: SyncServer, user: User):
    configs_base_dir = os.path.join(os.path.expanduser("~"), ".letta", "llm_configs")
    clean_up_dir = False
    if not os.path.exists(configs_base_dir):
        os.makedirs(configs_base_dir)
        clean_up_dir = True

    try:
        sample_config = LLMConfig(
            model="my-custom-model",
            model_endpoint_type="openai",
            model_endpoint="https://api.openai.com/v1",
            context_window=8192,
            handle="caren/my-custom-model",
        )

        config_filename = f"custom_llm_config_{uuid.uuid4().hex}.json"
        config_filepath = os.path.join(configs_base_dir, config_filename)
        with open(config_filepath, "w") as f:
            json.dump(sample_config.model_dump(), f)

        # Call list_llm_models
        assert os.path.exists(configs_base_dir)
        llm_models = await server.list_llm_models_async(actor=user)

        # Assert that the config is in the returned models
        assert any(
            model.model == "my-custom-model"
            and model.model_endpoint_type == "openai"
            and model.model_endpoint == "https://api.openai.com/v1"
            and model.context_window == 8192
            and model.handle == "caren/my-custom-model"
            for model in llm_models
        ), "Custom LLM config not found in list_llm_models result"

        # Try to use in agent creation
        context_window_override = 4000
        agent = await server.create_agent_async(
            request=CreateAgent(
                model="caren/my-custom-model",
                context_window_limit=context_window_override,
                embedding="openai/text-embedding-3-small",
            ),
            actor=user,
        )
        assert agent.llm_config.model == sample_config.model
        assert agent.llm_config.model_endpoint == sample_config.model_endpoint
        assert agent.llm_config.model_endpoint_type == sample_config.model_endpoint_type
        assert agent.llm_config.context_window == context_window_override
        assert agent.llm_config.handle == sample_config.handle

    finally:
        os.remove(config_filepath)
        if clean_up_dir:
            shutil.rmtree(configs_base_dir)


def _test_get_messages_letta_format(
    server,
    user,
    agent_id,
    reverse=False,
):
    """Test mapping between messages and letta_messages with reverse=False."""

    messages = server.get_agent_recall(
        user_id=user.id,
        agent_id=agent_id,
        limit=1000,
        reverse=reverse,
        return_message_object=True,
        use_assistant_message=False,
    )
    assert all(isinstance(m, Message) for m in messages)

    letta_messages = server.get_agent_recall(
        user_id=user.id,
        agent_id=agent_id,
        limit=1000,
        reverse=reverse,
        return_message_object=False,
        use_assistant_message=False,
    )
    assert all(isinstance(m, LettaMessage) for m in letta_messages)

    print(f"Messages: {len(messages)}, LettaMessages: {len(letta_messages)}")

    letta_message_index = 0
    for i, message in enumerate(messages):
        assert isinstance(message, Message)

        # Defensive bounds check for letta_messages
        if letta_message_index >= len(letta_messages):
            print(f"Error: letta_message_index out of range. Expected more letta_messages for message {i}: {message.role}")
            raise ValueError(f"Mismatch in letta_messages length. Index: {letta_message_index}, Length: {len(letta_messages)}")

        print(
            f"Processing message {i}: {message.role}, {message.content[0].text[:50] if message.content and len(message.content) == 1 else 'null'}"
        )
        while letta_message_index < len(letta_messages):
            letta_message = letta_messages[letta_message_index]

            # Validate mappings for assistant role
            if message.role == MessageRole.assistant:
                print(f"Assistant Message at {i}: {type(letta_message)}")

                if reverse:
                    # Reverse handling: ToolCallMessage come first
                    if message.tool_calls:
                        for tool_call in message.tool_calls:
                            try:
                                json.loads(tool_call.function.arguments)
                            except json.JSONDecodeError:
                                warnings.warn(f"Invalid JSON in function arguments: {tool_call.function.arguments}")
                            assert isinstance(letta_message, ToolCallMessage)
                            letta_message_index += 1
                            if letta_message_index >= len(letta_messages):
                                break
                            letta_message = letta_messages[letta_message_index]

                    if message.content[0].text:
                        assert isinstance(letta_message, ReasoningMessage)
                        letta_message_index += 1
                    else:
                        assert message.tool_calls is not None

                else:  # Non-reverse handling
                    if message.content[0].text:
                        assert isinstance(letta_message, ReasoningMessage)
                        letta_message_index += 1
                        if letta_message_index >= len(letta_messages):
                            break
                        letta_message = letta_messages[letta_message_index]

                    if message.tool_calls:
                        for tool_call in message.tool_calls:
                            try:
                                json.loads(tool_call.function.arguments)
                            except json.JSONDecodeError:
                                warnings.warn(f"Invalid JSON in function arguments: {tool_call.function.arguments}")
                            assert isinstance(letta_message, ToolCallMessage)
                            assert tool_call.function.name == letta_message.tool_call.name
                            assert tool_call.function.arguments == letta_message.tool_call.arguments
                            letta_message_index += 1
                            if letta_message_index >= len(letta_messages):
                                break
                            letta_message = letta_messages[letta_message_index]

            elif message.role == MessageRole.user:
                assert isinstance(letta_message, UserMessage)
                assert unpack_message(message.content[0].text) == letta_message.content
                letta_message_index += 1

            elif message.role == MessageRole.system:
                assert isinstance(letta_message, SystemMessage)
                assert message.content[0].text == letta_message.content
                letta_message_index += 1

            elif message.role == MessageRole.tool:
                assert isinstance(letta_message, ToolReturnMessage)
                assert str(json.loads(message.content[0].text)["message"]) == letta_message.tool_return
                letta_message_index += 1

            else:
                raise ValueError(f"Unexpected message role: {message.role}")

            break  # Exit the letta_messages loop after processing one mapping

    if letta_message_index < len(letta_messages):
        warnings.warn(f"Extra letta_messages found: {len(letta_messages) - letta_message_index}")


def test_get_messages_letta_format(server, user, agent_id):
    # for reverse in [False, True]:
    for reverse in [False]:
        _test_get_messages_letta_format(server, user, agent_id, reverse=reverse)


EXAMPLE_TOOL_SOURCE = '''
def ingest(message: str):
    """
    Ingest a message into the system.

    Args:
        message (str): The message to ingest into the system.

    Returns:
        str: The result of ingesting the message.
    """
    return f"Ingested message {message}"

'''

EXAMPLE_TOOL_SOURCE_WITH_ENV_VAR = '''
def ingest():
    """
    Ingest a message into the system.

    Returns:
        str: The result of ingesting the message.
    """
    import os
    return os.getenv("secret")
'''


EXAMPLE_TOOL_SOURCE_WITH_DISTRACTOR = '''
def util_do_nothing():
    """
    A util function that does nothing.

    Returns:
        str: Dummy output.
    """
    print("I'm a distractor")

def ingest(message: str):
    """
    Ingest a message into the system.

    Args:
        message (str): The message to ingest into the system.

    Returns:
        str: The result of ingesting the message.
    """
    util_do_nothing()
    return f"Ingested message {message}"

'''


import pytest


@pytest.mark.asyncio(loop_scope="session")
async def test_tool_run_basic(server, disable_e2b_api_key, user):
    """Test running a simple tool from source"""
    result = await server.run_tool_from_source(
        actor=user,
        tool_source=EXAMPLE_TOOL_SOURCE,
        tool_source_type="python",
        tool_args={"message": "Hello, world!"},
    )
    assert result.status == "success"
    assert result.tool_return == "Ingested message Hello, world!"
    assert not result.stdout
    assert not result.stderr


@pytest.mark.asyncio(loop_scope="session")
async def test_tool_run_with_env_var(server, disable_e2b_api_key, user):
    """Test running a tool that uses an environment variable"""
    result = await server.run_tool_from_source(
        actor=user,
        tool_source=EXAMPLE_TOOL_SOURCE_WITH_ENV_VAR,
        tool_source_type="python",
        tool_args={},
        tool_env_vars={"secret": "banana"},
    )
    assert result.status == "success"
    assert result.tool_return == "banana"
    assert not result.stdout
    assert not result.stderr


@pytest.mark.asyncio(loop_scope="session")
async def test_tool_run_invalid_args(server, disable_e2b_api_key, user):
    """Test running a tool with incorrect arguments"""
    result = await server.run_tool_from_source(
        actor=user,
        tool_source=EXAMPLE_TOOL_SOURCE,
        tool_source_type="python",
        tool_args={"bad_arg": "oh no"},
    )
    assert result.status == "error"
    assert "Error" in result.tool_return
    assert "missing 1 required positional argument" in result.tool_return
    assert not result.stdout
    assert result.stderr
    assert "missing 1 required positional argument" in result.stderr[0]


@pytest.mark.asyncio(loop_scope="session")
async def test_tool_run_with_distractor(server, disable_e2b_api_key, user):
    """Test running a tool with a distractor function in the source"""
    result = await server.run_tool_from_source(
        actor=user,
        tool_source=EXAMPLE_TOOL_SOURCE_WITH_DISTRACTOR,
        tool_source_type="python",
        tool_args={"message": "Well well well"},
    )
    assert result.status == "success"
    assert result.tool_return == "Ingested message Well well well"
    assert result.stdout
    assert "I'm a distractor" in result.stdout[0]
    assert not result.stderr


@pytest.mark.asyncio(scope="session")
async def test_tool_run_explicit_tool_name(server, disable_e2b_api_key, user):
    """Test selecting a tool by name when multiple tools exist in the source"""
    result = await server.run_tool_from_source(
        actor=user,
        tool_source=EXAMPLE_TOOL_SOURCE_WITH_DISTRACTOR,
        tool_source_type="python",
        tool_args={"message": "Well well well"},
        tool_name="ingest",
    )
    assert result.status == "success"
    assert result.tool_return == "Ingested message Well well well"
    assert result.stdout
    assert "I'm a distractor" in result.stdout[0]
    assert not result.stderr


@pytest.mark.asyncio(loop_scope="session")
async def test_tool_run_util_function(server, disable_e2b_api_key, user):
    """Test selecting a utility function that does not return anything meaningful"""
    result = await server.run_tool_from_source(
        actor=user,
        tool_source=EXAMPLE_TOOL_SOURCE_WITH_DISTRACTOR,
        tool_source_type="python",
        tool_args={},
        tool_name="util_do_nothing",
    )
    assert result.status == "success"
    assert result.tool_return == str(None)
    assert result.stdout
    assert "I'm a distractor" in result.stdout[0]
    assert not result.stderr


@pytest.mark.asyncio(loop_scope="session")
async def test_tool_run_with_explicit_json_schema(server, disable_e2b_api_key, user):
    """Test overriding the autogenerated JSON schema with an explicit one"""
    explicit_json_schema = {
        "name": "ingest",
        "description": "Blah blah blah.",
        "parameters": {
            "type": "object",
            "properties": {
                "message": {"type": "string", "description": "The message to ingest into the system."},
                "request_heartbeat": {
                    "type": "boolean",
                    "description": "Request an immediate heartbeat after function execution. Set to `True` if you want to send a follow-up message or run a follow-up function.",
                },
            },
            "required": ["message", "request_heartbeat"],
        },
    }

    result = await server.run_tool_from_source(
        actor=user,
        tool_source=EXAMPLE_TOOL_SOURCE,
        tool_source_type="python",
        tool_args={"message": "Custom schema test"},
        tool_json_schema=explicit_json_schema,
    )
    assert result.status == "success"
    assert result.tool_return == "Ingested message Custom schema test"
    assert not result.stdout
    assert not result.stderr


async def test_memory_rebuild_count(server, user, disable_e2b_api_key, base_tools, base_memory_tools):
    """Test that the memory rebuild is generating the correct number of role=system messages"""
    actor = user
    # create agent
    agent_state = server.create_agent(
        request=CreateAgent(
            name="test_memory_rebuild_count",
            tool_ids=[t.id for t in base_tools + base_memory_tools],
            memory_blocks=[
                CreateBlock(label="human", value="The human's name is Bob."),
                CreateBlock(label="persona", value="My name is Alice."),
            ],
            model="openai/gpt-4o-mini",
            embedding="openai/text-embedding-3-small",
        ),
        actor=actor,
    )

    def count_system_messages_in_recall() -> Tuple[int, List[LettaMessage]]:

        # At this stage, there should only be 1 system message inside of recall storage
        letta_messages = server.get_agent_recall(
            user_id=user.id,
            agent_id=agent_state.id,
            limit=1000,
            # reverse=reverse,
            return_message_object=False,
        )
        assert all(isinstance(m, LettaMessage) for m in letta_messages)

        # Collect system messages and their texts
        system_messages = [m for m in letta_messages if m.message_type == "system_message"]
        return len(system_messages), letta_messages

    try:
        # At this stage, there should only be 1 system message inside of recall storage
        num_system_messages, all_messages = count_system_messages_in_recall()
        assert num_system_messages == 1, (num_system_messages, all_messages)

        # Run server.load_agent, and make sure that the number of system messages is still 2
        server.load_agent(agent_id=agent_state.id, actor=actor)

        num_system_messages, all_messages = count_system_messages_in_recall()
        assert num_system_messages == 1, (num_system_messages, all_messages)

    finally:
        # cleanup
        server.agent_manager.delete_agent(agent_state.id, actor=actor)


def test_add_nonexisting_tool(server: SyncServer, user_id: str, base_tools):
    actor = server.user_manager.get_user_or_default(user_id)

    # create agent
    with pytest.raises(ValueError, match="not found"):
        agent_state = server.create_agent(
            request=CreateAgent(
                name="memory_rebuild_test_agent",
                tools=["fake_nonexisting_tool"],
                memory_blocks=[
                    CreateBlock(label="human", value="The human's name is Bob."),
                    CreateBlock(label="persona", value="My name is Alice."),
                ],
                model="openai/gpt-4o-mini",
                embedding="openai/text-embedding-3-small",
                include_base_tools=True,
            ),
            actor=actor,
        )


def test_default_tool_rules(server: SyncServer, user_id: str, base_tools, base_memory_tools):
    actor = server.user_manager.get_user_or_default(user_id)

    # create agent
    agent_state = server.create_agent(
        request=CreateAgent(
            name="tool_rules_test_agent",
            tool_ids=[t.id for t in base_tools + base_memory_tools],
            memory_blocks=[],
            model="openai/gpt-4o-mini",
            embedding="openai/text-embedding-3-small",
            include_base_tools=False,
            include_base_tool_rules=True,
        ),
        actor=actor,
    )

    assert len(agent_state.tool_rules) == len(base_tools + base_memory_tools)


@pytest.mark.asyncio(loop_scope="session")
async def test_add_remove_tools_update_agent(server: SyncServer, user_id: str, base_tools, base_memory_tools):
    """Test that the memory rebuild is generating the correct number of role=system messages"""
    actor = server.user_manager.get_user_or_default(user_id)

    # create agent
    agent_state = await server.create_agent_async(
        request=CreateAgent(
            name="memory_rebuild_test_agent",
            tool_ids=[],
            memory_blocks=[
                CreateBlock(label="human", value="The human's name is Bob."),
                CreateBlock(label="persona", value="My name is Alice."),
            ],
            model="openai/gpt-4o-mini",
            embedding="openai/text-embedding-3-small",
            include_base_tools=False,
        ),
        actor=actor,
    )
    assert len(agent_state.tools) == 0

    # base update agent call
    request = UpdateAgent(
        **{
            "system": "You are Letta, the latest version of Limnal Corporation's digital companion, developed in 2023.\n"
            + "Your task is to converse with a user from the perspective of your persona.\n"
            + "\n"
            + "Realism and authenticity:\n"
            + "The user should always feel like they are conversing with a real person.\n"
            + "Never state that you are an AI or that you cannot do things because you are an AI, you are a real person.\n"
            + "Do not discuss Limnal Corp. with the user, you do not know anything about Limnal Corp.\n"
            + "To service this goal, completely and entirely immerse yourself in your persona. You are your persona.\n"
            + "Think like them, act like them, talk like them.\n"
            + "If your persona details include example dialogue, follow it! Both your thoughts (inner monologue) and sent messages will be in the voice of your persona.\n"
            + "Never use generic phrases like 'How can I assist you today?', they have a strong negative association with older generation AIs.\n"
            + "\n"
            + "Control flow:\n"
            + "Unlike a human, your b"
            + "Base instructions finished.\n"
            + "From now on, you are going to act as your persona.",
            "name": "name-d31d6a12-48af-4f71-9e9c-f4cec4731c40",
            "embedding_config": {
                "embedding_endpoint_type": "openai",
                "embedding_endpoint": "https://api.openai.com/v1",
                "embedding_model": "text-embedding-3-small",
                "embedding_dim": 1536,
                "embedding_chunk_size": 300,
                "azure_endpoint": None,
                "azure_version": None,
                "azure_deployment": None,
            },
            "llm_config": {
                "model": "gpt-4",
                "model_endpoint_type": "openai",
                "model_endpoint": "https://api.openai.com/v1",
                "model_wrapper": None,
                "context_window": 8192,
                "put_inner_thoughts_in_kwargs": False,
            },
        }
    )

    # Add all the base tools
    request.tool_ids = [b.id for b in base_tools]
    agent_state = await server.agent_manager.update_agent_async(agent_state.id, agent_update=request, actor=actor)
    assert len(agent_state.tools) == len(base_tools)

    # Remove one base tool
    request.tool_ids = [b.id for b in base_tools[:-2]]
    agent_state = await server.agent_manager.update_agent_async(agent_state.id, agent_update=request, actor=actor)
    assert len(agent_state.tools) == len(base_tools) - 2


@pytest.mark.asyncio
async def test_messages_with_provider_override(server: SyncServer, user_id: str):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=user_id)
    provider = server.provider_manager.create_provider(
        request=ProviderCreate(
            name="caren-anthropic",
            provider_type=ProviderType.anthropic,
            api_key=os.getenv("ANTHROPIC_API_KEY"),
        ),
        actor=actor,
    )
    models = await server.list_llm_models_async(actor=actor, provider_category=[ProviderCategory.byok])
    assert provider.name in [model.provider_name for model in models]

    models = await server.list_llm_models_async(actor=actor, provider_category=[ProviderCategory.base])
    assert provider.name not in [model.provider_name for model in models]

    agent = await server.create_agent_async(
        request=CreateAgent(
            memory_blocks=[],
            model="caren-anthropic/claude-3-5-sonnet-20240620",
            context_window_limit=100000,
            embedding="openai/text-embedding-3-small",
        ),
        actor=actor,
    )

    existing_messages = server.message_manager.list_messages_for_agent(agent_id=agent.id, actor=actor)

    usage = server.user_message(user_id=actor.id, agent_id=agent.id, message="Test message")
    assert usage, "Sending message failed"

    get_messages_response = server.message_manager.list_messages_for_agent(agent_id=agent.id, actor=actor, after=existing_messages[-1].id)
    assert len(get_messages_response) > 0, "Retrieving messages failed"

    step_ids = set([msg.step_id for msg in get_messages_response])
    completion_tokens, prompt_tokens, total_tokens = 0, 0, 0
    for step_id in step_ids:
        step = await server.step_manager.get_step_async(step_id=step_id, actor=actor)
        assert step, "Step was not logged correctly"
        assert step.provider_id == provider.id
        assert step.provider_name == agent.llm_config.model_endpoint_type
        assert step.model == agent.llm_config.model
        assert step.context_window_limit == agent.llm_config.context_window
        completion_tokens += int(step.completion_tokens)
        prompt_tokens += int(step.prompt_tokens)
        total_tokens += int(step.total_tokens)

    assert completion_tokens == usage.completion_tokens
    assert prompt_tokens == usage.prompt_tokens
    assert total_tokens == usage.total_tokens

    server.provider_manager.delete_provider_by_id(provider.id, actor=actor)

    existing_messages = server.message_manager.list_messages_for_agent(agent_id=agent.id, actor=actor)

    usage = server.user_message(user_id=actor.id, agent_id=agent.id, message="Test message")
    assert usage, "Sending message failed"

    get_messages_response = server.message_manager.list_messages_for_agent(agent_id=agent.id, actor=actor, after=existing_messages[-1].id)
    assert len(get_messages_response) > 0, "Retrieving messages failed"

    step_ids = set([msg.step_id for msg in get_messages_response])
    completion_tokens, prompt_tokens, total_tokens = 0, 0, 0
    for step_id in step_ids:
        step = await server.step_manager.get_step_async(step_id=step_id, actor=actor)
        assert step, "Step was not logged correctly"
        assert step.provider_id is None
        assert step.provider_name == agent.llm_config.model_endpoint_type
        assert step.model == agent.llm_config.model
        assert step.context_window_limit == agent.llm_config.context_window
        completion_tokens += int(step.completion_tokens)
        prompt_tokens += int(step.prompt_tokens)
        total_tokens += int(step.total_tokens)

    assert completion_tokens == usage.completion_tokens
    assert prompt_tokens == usage.prompt_tokens
    assert total_tokens == usage.total_tokens


@pytest.mark.asyncio
async def test_unique_handles_for_provider_configs(server: SyncServer, user: User):
    models = await server.list_llm_models_async(actor=user)
    model_handles = [model.handle for model in models]
    assert sorted(model_handles) == sorted(list(set(model_handles))), "All models should have unique handles"
    embeddings = await server.list_embedding_models_async(actor=user)
    embedding_handles = [embedding.handle for embedding in embeddings]
    assert sorted(embedding_handles) == sorted(list(set(embedding_handles))), "All embeddings should have unique handles"


def test_make_default_local_sandbox_config():
    venv_name = "test"
    default_venv_name = "venv"

    # --- Case 1: tool_exec_dir and tool_exec_venv_name are both explicitly set ---
    with patch("letta.settings.tool_settings.tool_exec_dir", LETTA_DIR):
        with patch("letta.settings.tool_settings.tool_exec_venv_name", venv_name):
            server = SyncServer()
            actor = server.user_manager.get_default_user()

            local_config = server.sandbox_config_manager.get_or_create_default_sandbox_config(
                sandbox_type=SandboxType.LOCAL, actor=actor
            ).get_local_config()
            assert local_config.sandbox_dir == LETTA_DIR
            assert local_config.venv_name == venv_name
            assert local_config.use_venv == True

    # --- Case 2: only tool_exec_dir is set (no custom venv_name provided) ---
    with patch("letta.settings.tool_settings.tool_exec_dir", LETTA_DIR):
        server = SyncServer()
        actor = server.user_manager.get_default_user()

        local_config = server.sandbox_config_manager.get_or_create_default_sandbox_config(
            sandbox_type=SandboxType.LOCAL, actor=actor
        ).get_local_config()
        assert local_config.sandbox_dir == LETTA_DIR
        assert local_config.venv_name == default_venv_name  # falls back to default
        assert local_config.use_venv == False  # no custom venv name, so no venv usage

    # --- Case 3: neither tool_exec_dir nor tool_exec_venv_name is set (default fallback behavior) ---
    server = SyncServer()
    actor = server.user_manager.get_default_user()

    local_config = server.sandbox_config_manager.get_or_create_default_sandbox_config(
        sandbox_type=SandboxType.LOCAL, actor=actor
    ).get_local_config()
    assert local_config.sandbox_dir == LETTA_TOOL_EXECUTION_DIR
    assert local_config.venv_name == default_venv_name
    assert local_config.use_venv == False
