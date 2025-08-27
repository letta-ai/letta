import asyncio
import json
import uuid

import pytest

from letta.agents.letta_agent import LettaAgent
from letta.config import LettaConfig
from letta.schemas.letta_message import ToolCallMessage
from letta.schemas.message import MessageCreate
from letta.schemas.tool_rule import ChildToolRule, ContinueToolRule, InitToolRule, RequiredBeforeExitToolRule, TerminalToolRule
from letta.server.server import SyncServer
from letta.services.telemetry_manager import NoopTelemetryManager
from tests.helpers.endpoints_helper import (
    assert_invoked_function_call,
    assert_invoked_send_message_with_keyword,
    assert_sanity_checks,
    setup_agent,
)
from tests.helpers.utils import cleanup
from tests.utils import create_tool_from_func

# Generate uuid for agent name for this example
namespace = uuid.NAMESPACE_DNS
agent_uuid = str(uuid.uuid5(namespace, "test_agent_tool_graph"))
config_file = "tests/configs/llm_model_configs/openai-gpt-4o.json"


@pytest.fixture()
def server():
    config = LettaConfig.load()
    config.save()

    server = SyncServer()
    return server


@pytest.fixture(scope="function")
def first_secret_tool(server):
    def first_secret_word():
        """
        Retrieves the initial secret word in a multi-step sequence.

        Returns:
            str: The first secret word.
        """
        return "v0iq020i0g"

    actor = server.user_manager.get_user_or_default()
    tool = server.tool_manager.create_or_update_tool(create_tool_from_func(func=first_secret_word), actor=actor)
    yield tool


@pytest.fixture(scope="function")
def second_secret_tool(server):
    def second_secret_word(prev_secret_word: str):
        """
        Retrieves the second secret word.

        Args:
            prev_secret_word (str): The previously retrieved secret word.

        Returns:
            str: The second secret word.
        """
        if prev_secret_word != "v0iq020i0g":
            raise RuntimeError(f"Expected secret {'v0iq020i0g'}, got {prev_secret_word}")
        return "4rwp2b4gxq"

    actor = server.user_manager.get_user_or_default()
    tool = server.tool_manager.create_or_update_tool(create_tool_from_func(func=second_secret_word), actor=actor)
    yield tool


@pytest.fixture(scope="function")
def third_secret_tool(server):
    def third_secret_word(prev_secret_word: str):
        """
        Retrieves the third secret word.

        Args:
            prev_secret_word (str): The previously retrieved secret word.

        Returns:
            str: The third secret word.
        """
        if prev_secret_word != "4rwp2b4gxq":
            raise RuntimeError(f'Expected secret "4rwp2b4gxq", got {prev_secret_word}')
        return "hj2hwibbqm"

    actor = server.user_manager.get_user_or_default()
    tool = server.tool_manager.create_or_update_tool(create_tool_from_func(func=third_secret_word), actor=actor)
    yield tool


@pytest.fixture(scope="function")
def fourth_secret_tool(server):
    def fourth_secret_word(prev_secret_word: str):
        """
        Retrieves the final secret word.

        Args:
            prev_secret_word (str): The previously retrieved secret word.

        Returns:
            str: The final secret word.
        """
        if prev_secret_word != "hj2hwibbqm":
            raise RuntimeError(f"Expected secret {'hj2hwibbqm'}, got {prev_secret_word}")
        return "banana"

    actor = server.user_manager.get_user_or_default()
    tool = server.tool_manager.create_or_update_tool(create_tool_from_func(func=fourth_secret_word), actor=actor)
    yield tool


@pytest.fixture(scope="function")
def flip_coin_tool(server):
    def flip_coin():
        """
        Simulates a coin flip with a chance to return a secret word.

        Returns:
            str: A secret word or an empty string.
        """
        import random

        return "" if random.random() < 0.5 else "hj2hwibbqm"

    actor = server.user_manager.get_user_or_default()
    tool = server.tool_manager.create_or_update_tool(create_tool_from_func(func=flip_coin), actor=actor)
    yield tool


@pytest.fixture(scope="function")
def can_play_game_tool(server):
    def can_play_game():
        """
        Determines whether a game can be played.

        Returns:
            bool: True if allowed to play, False otherwise.
        """
        import random

        return random.random() < 0.5

    actor = server.user_manager.get_user_or_default()
    tool = server.tool_manager.create_or_update_tool(create_tool_from_func(func=can_play_game), actor=actor)
    yield tool


@pytest.fixture(scope="function")
def return_none_tool(server):
    def return_none():
        """
        Always returns None.

        Returns:
            None
        """
        return None

    actor = server.user_manager.get_user_or_default()
    tool = server.tool_manager.create_or_update_tool(create_tool_from_func(func=return_none), actor=actor)
    yield tool


@pytest.fixture(scope="function")
def auto_error_tool(server):
    def auto_error():
        """
        Always raises an error when called.

        Raises:
            RuntimeError: Always triggered.
        """
        raise RuntimeError("This should never be called.")

    actor = server.user_manager.get_user_or_default()
    tool = server.tool_manager.create_or_update_tool(create_tool_from_func(func=auto_error), actor=actor)
    yield tool


@pytest.fixture(scope="function")
def save_data_tool(server):
    def save_data():
        """
        Saves important data before exiting.

        Returns:
            str: Confirmation that data was saved.
        """
        return "Data saved successfully"

    actor = server.user_manager.get_user_or_default()
    tool = server.tool_manager.create_or_update_tool(create_tool_from_func(func=save_data), actor=actor)
    yield tool


@pytest.fixture(scope="function")
def cleanup_temp_files_tool(server):
    def cleanup_temp_files():
        """
        Cleans up temporary files before exiting.

        Returns:
            str: Confirmation that cleanup was completed.
        """
        return "Temporary files cleaned up"

    actor = server.user_manager.get_user_or_default()
    tool = server.tool_manager.create_or_update_tool(create_tool_from_func(func=cleanup_temp_files), actor=actor)
    yield tool


@pytest.fixture(scope="function")
def validate_work_tool(server):
    def validate_work():
        """
        Validates that work is complete before exiting.

        Returns:
            str: Validation result.
        """
        return "Work validation passed"

    actor = server.user_manager.get_user_or_default()
    tool = server.tool_manager.create_or_update_tool(create_tool_from_func(func=validate_work), actor=actor)
    yield tool


@pytest.fixture
def default_user(server):
    yield server.user_manager.get_user_or_default()


async def run_agent_step(server, agent_id, input_messages, actor):
    """Helper function to run agent step using LettaAgent directly instead of server.send_messages."""
    agent_loop = LettaAgent(
        agent_id=agent_id,
        message_manager=server.message_manager,
        agent_manager=server.agent_manager,
        block_manager=server.block_manager,
        job_manager=server.job_manager,
        passage_manager=server.passage_manager,
        actor=actor,
        step_manager=server.step_manager,
        telemetry_manager=NoopTelemetryManager(),
    )

    return await agent_loop.step(
        input_messages,
        max_steps=50,
        use_assistant_message=False,
    )


@pytest.mark.timeout(60)  # Sets a 60-second timeout for the test since this could loop infinitely
@pytest.mark.asyncio
async def test_single_path_agent_tool_call_graph(
    server, disable_e2b_api_key, first_secret_tool, second_secret_tool, third_secret_tool, fourth_secret_tool, auto_error_tool, default_user
):
    cleanup(server=server, agent_uuid=agent_uuid, actor=default_user)

    # Add tools
    tools = [first_secret_tool, second_secret_tool, third_secret_tool, fourth_secret_tool, auto_error_tool]

    # Make tool rules
    tool_rules = [
        InitToolRule(tool_name="first_secret_word"),
        ChildToolRule(tool_name="first_secret_word", children=["second_secret_word"]),
        ChildToolRule(tool_name="second_secret_word", children=["third_secret_word"]),
        ChildToolRule(tool_name="third_secret_word", children=["fourth_secret_word"]),
        ChildToolRule(tool_name="fourth_secret_word", children=["send_message"]),
        TerminalToolRule(tool_name="send_message"),
    ]

    # Make agent state
    agent_state = setup_agent(server, config_file, agent_uuid=agent_uuid, tool_ids=[t.id for t in tools], tool_rules=tool_rules)
    response = await run_agent_step(
        server=server,
        agent_id=agent_state.id,
        input_messages=[MessageCreate(role="user", content="What is the fourth secret word?")],
        actor=default_user,
    )

    # Make checks
    assert_sanity_checks(response)

    # Assert the tools were called
    assert_invoked_function_call(response.messages, "first_secret_word")
    assert_invoked_function_call(response.messages, "second_secret_word")
    assert_invoked_function_call(response.messages, "third_secret_word")
    assert_invoked_function_call(response.messages, "fourth_secret_word")

    # Check ordering of tool calls
    tool_names = [t.name for t in [first_secret_tool, second_secret_tool, third_secret_tool, fourth_secret_tool]]
    tool_names += ["send_message"]
    for m in response.messages:
        if isinstance(m, ToolCallMessage):
            # Check that it's equal to the first one
            assert m.tool_call.name == tool_names[0]

            # Pop out first one
            tool_names = tool_names[1:]

    # Check final send message contains "done"
    assert_invoked_send_message_with_keyword(response.messages, "banana")

    print(f"Got successful response from client: \n\n{response}")
    cleanup(server=server, agent_uuid=agent_uuid, actor=default_user)


@pytest.mark.timeout(60)
@pytest.mark.parametrize(
    "config_file",
    [
        "tests/configs/llm_model_configs/claude-3-5-sonnet.json",
        "tests/configs/llm_model_configs/openai-gpt-3.5-turbo.json",
        "tests/configs/llm_model_configs/openai-gpt-4o.json",
    ],
)
@pytest.mark.parametrize("init_tools_case", ["single", "multiple"])
def test_check_tool_rules_with_different_models_parametrized(
    server, disable_e2b_api_key, first_secret_tool, second_secret_tool, third_secret_tool, default_user, config_file, init_tools_case
):
    """Test that tool rules are properly validated across model configurations and init tool scenarios."""
    agent_uuid = str(uuid.uuid4())

    if init_tools_case == "multiple":
        tools = [first_secret_tool, second_secret_tool]
        tool_rules = [
            InitToolRule(tool_name=first_secret_tool.name),
            InitToolRule(tool_name=second_secret_tool.name),
        ]
    else:  # "single"
        tools = [third_secret_tool]
        tool_rules = [InitToolRule(tool_name=third_secret_tool.name)]

    if "gpt-4o" in config_file or init_tools_case == "single":
        # Should succeed
        agent_state = setup_agent(
            server,
            config_file,
            agent_uuid=agent_uuid,
            tool_ids=[t.id for t in tools],
            tool_rules=tool_rules,
        )
        assert agent_state is not None
    else:
        # Non-structured model with multiple init tools should fail
        with pytest.raises(ValueError, match="Multiple initial tools are not supported for non-structured models"):
            setup_agent(
                server,
                config_file,
                agent_uuid=agent_uuid,
                tool_ids=[t.id for t in tools],
                tool_rules=tool_rules,
            )

    cleanup(server=server, agent_uuid=agent_uuid, actor=default_user)


@pytest.mark.timeout(180)
@pytest.mark.asyncio
async def test_claude_initial_tool_rule_enforced(
    server,
    disable_e2b_api_key,
    first_secret_tool,
    second_secret_tool,
    default_user,
):
    """Test that the initial tool rule is enforced for the first message using Claude model."""
    tool_rules = [
        InitToolRule(tool_name=first_secret_tool.name),
        ChildToolRule(tool_name=first_secret_tool.name, children=[second_secret_tool.name]),
        TerminalToolRule(tool_name=second_secret_tool.name),
    ]
    tools = [first_secret_tool, second_secret_tool]
    anthropic_config_file = "tests/configs/llm_model_configs/claude-3-5-sonnet.json"

    for i in range(3):
        agent_uuid = str(uuid.uuid4())
        agent_state = setup_agent(
            server,
            anthropic_config_file,
            agent_uuid=agent_uuid,
            tool_ids=[t.id for t in tools],
            tool_rules=tool_rules,
        )

        response = await run_agent_step(
            server=server,
            agent_id=agent_state.id,
            input_messages=[MessageCreate(role="user", content="What is the second secret word?")],
            actor=default_user,
        )

        assert_sanity_checks(response)

        # Check that the expected tools were invoked
        assert_invoked_function_call(response.messages, "first_secret_word")
        assert_invoked_function_call(response.messages, "second_secret_word")

        tool_names = [t.name for t in [first_secret_tool, second_secret_tool]] + ["send_message"]
        for m in response.messages:
            if isinstance(m, ToolCallMessage):
                assert m.tool_call.name == tool_names[0]
                tool_names = tool_names[1:]

        print(f"Passed iteration {i}")
        cleanup(server=server, agent_uuid=agent_uuid, actor=default_user)

        # Exponential backoff
        if i < 2:
            backoff_time = 10 * (2**i)
            await asyncio.sleep(backoff_time)


@pytest.mark.timeout(60)
@pytest.mark.parametrize(
    "config_file",
    [
        "tests/configs/llm_model_configs/claude-3-5-sonnet.json",
        "tests/configs/llm_model_configs/openai-gpt-4o.json",
    ],
)
@pytest.mark.asyncio
async def test_agent_no_structured_output_with_one_child_tool_parametrized(
    server,
    disable_e2b_api_key,
    default_user,
    config_file,
):
    """Test that agent correctly calls tool chains with unstructured output under various model configs."""
    send_message = server.tool_manager.get_tool_by_name(tool_name="send_message", actor=default_user)
    archival_memory_search = server.tool_manager.get_tool_by_name(tool_name="archival_memory_search", actor=default_user)
    archival_memory_insert = server.tool_manager.get_tool_by_name(tool_name="archival_memory_insert", actor=default_user)

    tools = [send_message, archival_memory_search, archival_memory_insert]

    tool_rules = [
        InitToolRule(tool_name="archival_memory_search"),
        ChildToolRule(tool_name="archival_memory_search", children=["archival_memory_insert"]),
        ChildToolRule(tool_name="archival_memory_insert", children=["send_message"]),
        TerminalToolRule(tool_name="send_message"),
    ]

    max_retries = 3
    last_error = None
    agent_uuid = str(uuid.uuid4())

    for attempt in range(max_retries):
        try:
            agent_state = setup_agent(
                server,
                config_file,
                agent_uuid=agent_uuid,
                tool_ids=[t.id for t in tools],
                tool_rules=tool_rules,
            )

            response = await run_agent_step(
                server=server,
                agent_id=agent_state.id,
                input_messages=[MessageCreate(role="user", content="hi. run archival memory search")],
                actor=default_user,
            )

            # Run assertions
            assert_sanity_checks(response)
            assert_invoked_function_call(response.messages, "archival_memory_search")
            assert_invoked_function_call(response.messages, "archival_memory_insert")
            assert_invoked_function_call(response.messages, "send_message")

            tool_names = [t.name for t in [archival_memory_search, archival_memory_insert, send_message]]
            for m in response.messages:
                if isinstance(m, ToolCallMessage):
                    assert m.tool_call.name == tool_names[0]
                    tool_names = tool_names[1:]

            print(f"[{config_file}] Got successful response:\n\n{response}")
            break  # success

        except AssertionError as e:
            last_error = e
            print(f"[{config_file}] Attempt {attempt + 1} failed")
            cleanup(server=server, agent_uuid=agent_uuid, actor=default_user)

    if last_error:
        raise last_error

    cleanup(server=server, agent_uuid=agent_uuid, actor=default_user)


@pytest.mark.timeout(30)
@pytest.mark.parametrize("include_base_tools", [False, True])
@pytest.mark.asyncio
async def test_init_tool_rule_always_fails(
    server,
    disable_e2b_api_key,
    auto_error_tool,
    default_user,
    include_base_tools,
):
    """Test behavior when InitToolRule invokes a tool that always fails."""
    config_file = "tests/configs/llm_model_configs/claude-3-5-sonnet.json"
    agent_uuid = str(uuid.uuid4())

    tool_rule = InitToolRule(tool_name=auto_error_tool.name)
    agent_state = setup_agent(
        server,
        config_file,
        agent_uuid=agent_uuid,
        tool_ids=[auto_error_tool.id],
        tool_rules=[tool_rule],
        include_base_tools=include_base_tools,
    )

    response = await run_agent_step(
        server=server,
        agent_id=agent_state.id,
        input_messages=[MessageCreate(role="user", content="blah blah blah")],
        actor=default_user,
    )

    assert_invoked_function_call(response.messages, auto_error_tool.name)

    cleanup(server=server, agent_uuid=agent_uuid, actor=default_user)


@pytest.mark.asyncio
async def test_continue_tool_rule(server, default_user):
    """Test the continue tool rule by forcing send_message to loop before ending with core_memory_append."""
    config_file = "tests/configs/llm_model_configs/claude-3-5-sonnet.json"
    agent_uuid = str(uuid.uuid4())

    tool_ids = [
        server.tool_manager.get_tool_by_name("send_message", actor=default_user).id,
        server.tool_manager.get_tool_by_name("core_memory_append", actor=default_user).id,
    ]

    tool_rules = [
        ContinueToolRule(tool_name="send_message"),
        TerminalToolRule(tool_name="core_memory_append"),
    ]

    agent_state = setup_agent(
        server,
        config_file,
        agent_uuid,
        tool_ids=tool_ids,
        tool_rules=tool_rules,
        include_base_tools=False,
        include_base_tool_rules=False,
    )
    print(agent_state)

    response = await run_agent_step(
        server=server,
        agent_id=agent_state.id,
        input_messages=[MessageCreate(role="user", content="Send me some messages, and then call core_memory_append to end your turn.")],
        actor=default_user,
    )
    print(response)

    assert_invoked_function_call(response.messages, "send_message")
    assert_invoked_function_call(response.messages, "core_memory_append")

    # Check order
    send_idx = next(i for i, m in enumerate(response.messages) if isinstance(m, ToolCallMessage) and m.tool_call.name == "send_message")
    append_idx = next(
        i for i, m in enumerate(response.messages) if isinstance(m, ToolCallMessage) and m.tool_call.name == "core_memory_append"
    )
    assert send_idx < append_idx, "send_message should occur before core_memory_append"

    cleanup(server=server, agent_uuid=agent_uuid, actor=default_user)


# @pytest.mark.timeout(60)  # Sets a 60-second timeout for the test since this could loop infinitely
# def test_agent_conditional_tool_easy(disable_e2b_api_key):
#     """
#     Test the agent with a conditional tool that has a child tool.
#
#                 Tool Flow:
#
#                      -------
#                     |       |
#                     |       v
#                      -- flip_coin
#                             |
#                             v
#                     reveal_secret_word
#     """
#
#
#     cleanup(client=client, agent_uuid=agent_uuid)
#
#     coin_flip_name = "flip_coin"
#     secret_word_tool = "fourth_secret_word"
#     flip_coin_tool = client.create_or_update_tool(flip_coin)
#     reveal_secret = client.create_or_update_tool(fourth_secret_word)
#
#     # Make tool rules
#     tool_rules = [
#         InitToolRule(tool_name=coin_flip_name),
#         ConditionalToolRule(
#             tool_name=coin_flip_name,
#             default_child=coin_flip_name,
#             child_output_mapping={
#                 "hj2hwibbqm": secret_word_tool,
#             },
#         ),
#         TerminalToolRule(tool_name=secret_word_tool),
#     ]
#     tools = [flip_coin_tool, reveal_secret]
#
#     config_file = "tests/configs/llm_model_configs/claude-3-5-sonnet.json"
#     agent_state = setup_agent(client, config_file, agent_uuid=agent_uuid, tool_ids=[t.id for t in tools], tool_rules=tool_rules)
#     response = client.user_message(agent_id=agent_state.id, message="flip a coin until you get the secret word")
#
#     # Make checks
#     assert_sanity_checks(response)
#
#     # Assert the tools were called
#     assert_invoked_function_call(response.messages, "flip_coin")
#     assert_invoked_function_call(response.messages, "fourth_secret_word")
#
#     # Check ordering of tool calls
#     found_secret_word = False
#     for m in response.messages:
#         if isinstance(m, ToolCallMessage):
#             if m.tool_call.name == secret_word_tool:
#                 # Should be the last tool call
#                 found_secret_word = True
#             else:
#                 # Before finding secret_word, only flip_coin should be called
#                 assert m.tool_call.name == coin_flip_name
#                 assert not found_secret_word
#
#     # Ensure we found the secret word exactly once
#     assert found_secret_word
#
#     print(f"Got successful response from client: \n\n{response}")
#     cleanup(client=client, agent_uuid=agent_uuid)


# @pytest.mark.timeout(60)
# def test_agent_conditional_tool_without_default_child(disable_e2b_api_key):
#     """
#     Test the agent with a conditional tool that allows any child tool to be called if a function returns None.
#
#                 Tool Flow:
#
#                 return_none
#                      |
#                      v
#                 any tool...  <-- When output doesn't match mapping, agent can call any tool
#     """
#
#     cleanup(client=client, agent_uuid=agent_uuid)
#
#     # Create tools - we'll make several available to the agent
#     tool_name = "return_none"
#
#     tool = client.create_or_update_tool(return_none)
#     secret_word = client.create_or_update_tool(first_secret_word)
#
#     # Make tool rules - only map one output, let others be free choice
#     tool_rules = [
#         InitToolRule(tool_name=tool_name),
#         ConditionalToolRule(
#             tool_name=tool_name,
#             default_child=None,  # Allow any tool to be called if output doesn't match
#             child_output_mapping={"anything but none": "first_secret_word"},
#         ),
#     ]
#     tools = [tool, secret_word]
#
#     # Setup agent with all tools
#     agent_state = setup_agent(client, config_file, agent_uuid=agent_uuid, tool_ids=[t.id for t in tools], tool_rules=tool_rules)
#
#     # Ask agent to try different tools based on the game output
#     response = client.user_message(agent_id=agent_state.id, message="call a function, any function. then call send_message")
#
#     # Make checks
#     assert_sanity_checks(response)
#
#     # Assert return_none was called
#     assert_invoked_function_call(response.messages, tool_name)
#
#     # Assert any base function called afterward
#     found_any_tool = False
#     found_return_none = False
#     for m in response.messages:
#         if isinstance(m, ToolCallMessage):
#             if m.tool_call.name == tool_name:
#                 found_return_none = True
#             elif found_return_none and m.tool_call.name:
#                 found_any_tool = True
#                 break
#
#     assert found_any_tool, "Should have called any tool after return_none"
#
#     print(f"Got successful response from client: \n\n{response}")
#     cleanup(client=client, agent_uuid=agent_uuid)


# @pytest.mark.timeout(60)
# def test_agent_reload_remembers_function_response(disable_e2b_api_key):
#     """
#     Test that when an agent is reloaded, it remembers the last function response for conditional tool chaining.
#
#                 Tool Flow:
#
#                 flip_coin
#                      |
#                      v
#             fourth_secret_word  <-- Should remember coin flip result after reload
#     """
#
#     cleanup(client=client, agent_uuid=agent_uuid)
#
#     # Create tools
#     flip_coin_name = "flip_coin"
#     secret_word = "fourth_secret_word"
#     flip_coin_tool = client.create_or_update_tool(flip_coin)
#     secret_word_tool = client.create_or_update_tool(fourth_secret_word)
#
#     # Make tool rules - map coin flip to fourth_secret_word
#     tool_rules = [
#         InitToolRule(tool_name=flip_coin_name),
#         ConditionalToolRule(
#             tool_name=flip_coin_name,
#             default_child=flip_coin_name,  # Allow any tool to be called if output doesn't match
#             child_output_mapping={"hj2hwibbqm": secret_word},
#         ),
#         TerminalToolRule(tool_name=secret_word),
#     ]
#     tools = [flip_coin_tool, secret_word_tool]
#
#     # Setup initial agent
#     agent_state = setup_agent(client, config_file, agent_uuid=agent_uuid, tool_ids=[t.id for t in tools], tool_rules=tool_rules)
#
#     # Call flip_coin first
#     response = client.user_message(agent_id=agent_state.id, message="flip a coin")
#     assert_invoked_function_call(response.messages, flip_coin_name)
#     assert_invoked_function_call(response.messages, secret_word)
#     found_fourth_secret = False
#     for m in response.messages:
#         if isinstance(m, ToolCallMessage) and m.tool_call.name == secret_word:
#             found_fourth_secret = True
#             break
#
#     assert found_fourth_secret, "Reloaded agent should remember coin flip result and call fourth_secret_word if True"
#
#     # Reload the agent
#     reloaded_agent = client.server.load_agent(agent_id=agent_state.id, actor=client.user)
#     assert reloaded_agent.last_function_response is not None
#
#     print(f"Got successful response from client: \n\n{response}")
#     cleanup(client=client, agent_uuid=agent_uuid)


# @pytest.mark.timeout(60)  # Sets a 60-second timeout for the test since this could loop infinitely
# def test_simple_tool_rule(disable_e2b_api_key):
#     """
#     Test a simple tool rule where fourth_secret_word must be called after flip_coin.
#
#     Tool Flow:
#         flip_coin
#            |
#            v
#     fourth_secret_word
#     """
#
#     cleanup(client=client, agent_uuid=agent_uuid)
#
#     # Create tools
#     flip_coin_name = "flip_coin"
#     secret_word = "fourth_secret_word"
#     flip_coin_tool = client.create_or_update_tool(flip_coin)
#     secret_word_tool = client.create_or_update_tool(fourth_secret_word)
#     another_secret_word_tool = client.create_or_update_tool(first_secret_word)
#     random_tool = client.create_or_update_tool(can_play_game)
#     tools = [flip_coin_tool, secret_word_tool, another_secret_word_tool, random_tool]
#
#     # Create tool rule: after flip_coin, must call fourth_secret_word
#     tool_rule = ConditionalToolRule(
#         tool_name=flip_coin_name,
#         default_child=secret_word,
#         child_output_mapping={"*": secret_word},
#     )
#
#     # Set up agent with the tool rule
#     agent_state = setup_agent(
#         client, config_file, agent_uuid, tool_rules=[tool_rule], tool_ids=[t.id for t in tools], include_base_tools=False
#     )
#
#     # Start conversation
#     response = client.user_message(agent_id=agent_state.id, message="Help me test the tools.")
#
#     # Verify the tool calls
#     tool_calls = [msg for msg in response.messages if isinstance(msg, ToolCallMessage)]
#     assert len(tool_calls) >= 2  # Should have at least flip_coin and fourth_secret_word calls
#     assert_invoked_function_call(response.messages, flip_coin_name)
#     assert_invoked_function_call(response.messages, secret_word)
#
#     # Find the flip_coin call
#     flip_coin_call = next((call for call in tool_calls if call.tool_call.name == "flip_coin"), None)
#
#     # Verify that fourth_secret_word was called after flip_coin
#     flip_coin_call_index = tool_calls.index(flip_coin_call)
#     assert tool_calls[flip_coin_call_index + 1].tool_call.name == secret_word, "Fourth secret word should be called after flip_coin"
#
#     cleanup(client, agent_uuid=agent_state.id)


@pytest.mark.timeout(60)
@pytest.mark.asyncio
async def test_single_required_before_exit_tool(server, disable_e2b_api_key, save_data_tool, default_user):
    """Test that agent is forced to call a single required-before-exit tool before ending."""
    agent_name = "required_exit_single_tool_agent"
    config_file = "tests/configs/llm_model_configs/openai-gpt-4o.json"

    # Set up tools and rules
    tools = [save_data_tool]
    tool_rules = [
        InitToolRule(tool_name="send_message"),
        RequiredBeforeExitToolRule(tool_name="save_data"),
        TerminalToolRule(tool_name="send_message"),
    ]

    # Create agent
    agent_state = setup_agent(server, config_file, agent_uuid=agent_name, tool_ids=[t.id for t in tools], tool_rules=tool_rules)

    # Send message that would normally cause exit
    response = await run_agent_step(
        server=server,
        agent_id=agent_state.id,
        input_messages=[MessageCreate(role="user", content="Please finish your work and send me a message.")],
        actor=default_user,
    )

    # Assertions
    assert_sanity_checks(response)
    assert_invoked_function_call(response.messages, "save_data")
    assert_invoked_function_call(response.messages, "send_message")

    # The key test is that both tools were called - the agent was forced to call save_data
    # even when it tried to exit early with send_message
    tool_calls = [m for m in response.messages if isinstance(m, ToolCallMessage)]
    save_data_calls = [tc for tc in tool_calls if tc.tool_call.name == "save_data"]
    send_message_calls = [tc for tc in tool_calls if tc.tool_call.name == "send_message"]

    assert len(save_data_calls) >= 1, "save_data should be called at least once"
    assert len(send_message_calls) >= 1, "send_message should be called at least once"

    print(f"✓ Agent '{agent_name}' successfully called required tool before exit")


@pytest.mark.timeout(60)
@pytest.mark.asyncio
async def test_multiple_required_before_exit_tools(server, disable_e2b_api_key, save_data_tool, cleanup_temp_files_tool, default_user):
    """Test that agent calls all required-before-exit tools before ending."""
    agent_name = "required_exit_multi_tool_agent"
    config_file = "tests/configs/llm_model_configs/openai-gpt-4o.json"

    # Set up tools and rules
    tools = [save_data_tool, cleanup_temp_files_tool]
    tool_rules = [
        InitToolRule(tool_name="send_message"),
        RequiredBeforeExitToolRule(tool_name="save_data"),
        RequiredBeforeExitToolRule(tool_name="cleanup_temp_files"),
        TerminalToolRule(tool_name="send_message"),
    ]

    # Create agent
    agent_state = setup_agent(server, config_file, agent_uuid=agent_name, tool_ids=[t.id for t in tools], tool_rules=tool_rules)

    # Send message that would normally cause exit
    response = await run_agent_step(
        server=server,
        agent_id=agent_state.id,
        input_messages=[MessageCreate(role="user", content="Complete all necessary tasks and then send me a message.")],
        actor=default_user,
    )

    # Assertions
    assert_sanity_checks(response)
    assert_invoked_function_call(response.messages, "save_data")
    assert_invoked_function_call(response.messages, "cleanup_temp_files")
    assert_invoked_function_call(response.messages, "send_message")

    # Verify that all required tools were eventually called
    tool_calls = [m for m in response.messages if isinstance(m, ToolCallMessage)]
    save_data_calls = [tc for tc in tool_calls if tc.tool_call.name == "save_data"]
    cleanup_calls = [tc for tc in tool_calls if tc.tool_call.name == "cleanup_temp_files"]
    send_message_calls = [tc for tc in tool_calls if tc.tool_call.name == "send_message"]

    assert len(save_data_calls) >= 1, "save_data should be called at least once"
    assert len(cleanup_calls) >= 1, "cleanup_temp_files should be called at least once"
    assert len(send_message_calls) >= 1, "send_message should be called at least once"

    print(f"✓ Agent '{agent_name}' successfully called all required tools before exit")


@pytest.mark.timeout(60)
@pytest.mark.asyncio
async def test_required_before_exit_with_other_rules(server, disable_e2b_api_key, first_secret_tool, save_data_tool, default_user):
    """Test required-before-exit rules work alongside other tool rules."""
    agent_name = "required_exit_with_rules_agent"
    config_file = "tests/configs/llm_model_configs/openai-gpt-4o.json"

    # Set up tools and rules - combine with child tool rules
    tools = [first_secret_tool, save_data_tool]
    tool_rules = [
        InitToolRule(tool_name="first_secret_word"),
        ChildToolRule(tool_name="first_secret_word", children=["send_message"]),
        RequiredBeforeExitToolRule(tool_name="save_data"),
        TerminalToolRule(tool_name="send_message"),
    ]

    # Create agent
    agent_state = setup_agent(server, config_file, agent_uuid=agent_name, tool_ids=[t.id for t in tools], tool_rules=tool_rules)

    # Send message that would trigger tool flow
    response = await run_agent_step(
        server=server,
        agent_id=agent_state.id,
        input_messages=[MessageCreate(role="user", content="Get the first secret word and then finish up.")],
        actor=default_user,
    )

    # Assertions
    assert_sanity_checks(response)
    assert_invoked_function_call(response.messages, "first_secret_word")
    assert_invoked_function_call(response.messages, "save_data")
    assert_invoked_function_call(response.messages, "send_message")

    # Verify that all tools were called (first_secret_word due to InitToolRule, save_data due to RequiredBeforeExitToolRule)
    tool_calls = [m for m in response.messages if isinstance(m, ToolCallMessage)]
    first_secret_calls = [tc for tc in tool_calls if tc.tool_call.name == "first_secret_word"]
    save_data_calls = [tc for tc in tool_calls if tc.tool_call.name == "save_data"]
    send_message_calls = [tc for tc in tool_calls if tc.tool_call.name == "send_message"]

    assert len(first_secret_calls) >= 1, "first_secret_word should be called due to InitToolRule"
    assert len(save_data_calls) >= 1, "save_data should be called due to RequiredBeforeExitToolRule"
    assert len(send_message_calls) >= 1, "send_message should be called eventually"

    print(f"✓ Agent '{agent_name}' successfully handled mixed tool rules")


@pytest.mark.timeout(60)
@pytest.mark.asyncio
async def test_required_tools_called_during_normal_flow(server, disable_e2b_api_key, save_data_tool, default_user):
    """Test that agent can exit normally when required tools are called during regular operation."""
    agent_name = "required_exit_normal_flow_agent"
    config_file = "tests/configs/llm_model_configs/openai-gpt-4o.json"

    # Set up tools and rules
    tools = [save_data_tool]
    tool_rules = [
        InitToolRule(tool_name="save_data"),
        RequiredBeforeExitToolRule(tool_name="save_data"),
        TerminalToolRule(tool_name="send_message"),
    ]

    # Create agent
    agent_state = setup_agent(server, config_file, agent_uuid=agent_name, tool_ids=[t.id for t in tools], tool_rules=tool_rules)

    # Send message that explicitly mentions calling the required tool
    response = await run_agent_step(
        server=server,
        agent_id=agent_state.id,
        input_messages=[MessageCreate(role="user", content="Please save data and then send me a message when done.")],
        actor=default_user,
    )

    # Assertions
    assert_sanity_checks(response)
    assert_invoked_function_call(response.messages, "save_data")
    assert_invoked_function_call(response.messages, "send_message")

    # Should not have excessive tool calls - agent should exit cleanly after requirements are met
    tool_calls = [m for m in response.messages if isinstance(m, ToolCallMessage)]
    save_data_calls = [tc for tc in tool_calls if tc.tool_call.name == "save_data"]
    send_message_calls = [tc for tc in tool_calls if tc.tool_call.name == "send_message"]

    assert len(save_data_calls) == 1, "Should call save_data exactly once"
    assert len(send_message_calls) == 1, "Should call send_message exactly once"

    print(f"✓ Agent '{agent_name}' exited cleanly after calling required tool normally")


@pytest.mark.timeout(60)
@pytest.mark.asyncio
async def test_terminal_tool_rule_send_message_request_heartbeat_false(server, disable_e2b_api_key, default_user):
    """Test that when there's a terminal tool rule on send_message, the tool call has request_heartbeat=False."""
    agent_name = "terminal_send_message_heartbeat_test"
    config_file = "tests/configs/llm_model_configs/openai-gpt-4o.json"

    # Set up tool rules with terminal rule on send_message
    tool_rules = [
        TerminalToolRule(tool_name="send_message"),
    ]

    # Create agent
    agent_state = setup_agent(server, config_file, agent_uuid=agent_name, tool_ids=[], tool_rules=tool_rules)

    # Send message that should trigger send_message tool call
    response = await run_agent_step(
        server=server,
        agent_id=agent_state.id,
        input_messages=[MessageCreate(role="user", content="Please send me a simple message.")],
        actor=default_user,
    )

    # Assertions
    assert_sanity_checks(response)
    assert_invoked_function_call(response.messages, "send_message")

    # Find the send_message tool call and check request_heartbeat is False
    send_message_call = None
    for message in response.messages:
        if isinstance(message, ToolCallMessage) and message.tool_call.name == "send_message":
            send_message_call = message
            break

    assert send_message_call is not None, "send_message tool call should be found"

    # Parse the arguments and check request_heartbeat
    try:
        arguments = json.loads(send_message_call.tool_call.arguments)
        assert "request_heartbeat" in arguments, "request_heartbeat should be present in send_message arguments"
        assert arguments["request_heartbeat"] is False, "request_heartbeat should be False for terminal tool rule"

        print(f"✓ Agent '{agent_name}' correctly set request_heartbeat=False for terminal send_message")
    except json.JSONDecodeError:
        pytest.fail("Failed to parse tool call arguments as JSON")
    finally:
        cleanup(server=server, agent_uuid=agent_name, actor=default_user)
