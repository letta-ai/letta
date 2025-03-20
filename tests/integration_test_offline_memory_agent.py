import pytest

from letta import BasicBlockMemory
from letta.client.client import create_client
from letta.constants import DEFAULT_HUMAN, DEFAULT_PERSONA
from letta.offline_memory_agent import finish_rethinking_memory, rethink_memory, trigger_rethink_memory
from letta.prompts import gpt_system
from letta.schemas.agent import AgentType
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.llm_config import LLMConfig
from letta.schemas.memory import BasicBlockMemory, Block
from letta.schemas.tool_rule import TerminalToolRule
from letta.utils import get_human_text, get_persona_text


@pytest.fixture(scope="module")
def client():
    client = create_client()
    client.set_default_llm_config(LLMConfig.default_config("gpt-4o-mini"))
    client.set_default_embedding_config(EmbeddingConfig.default_config(provider="openai"))

    yield client


@pytest.fixture(autouse=True)
def clear_agents(client):
    for agent in client.list_agents():
        client.delete_agent(agent.id)


def test_ripple_edit(client, mock_e2b_api_key_none):
    trigger_rethink_memory_tool = client.create_or_update_tool(trigger_rethink_memory)
    send_message = client.server.tool_manager.get_tool_by_name(tool_name="send_message", actor=client.user)

    conversation_human_block = client.create_block(label="human", value=get_human_text(DEFAULT_HUMAN), limit=2000)
    conversation_persona_block = client.create_block(label="persona", value=get_persona_text(DEFAULT_PERSONA), limit=2000)
    offline_human_block = client.create_block(label="human", value=get_human_text(DEFAULT_HUMAN), limit=2000)
    offline_persona_block = client.create_block(label="persona", value=get_persona_text("offline_memory_persona"), limit=2000)

    # Figure 1. from Evaluating the Ripple Effects of Knowledge Editing in Language Models (Cohen et al., 2023)
    # https://arxiv.org/pdf/2307.12976
    fact_block = client.create_block(
        label="fact_block",
        value="""Messi resides in the Paris.
               Messi plays in the league Ligue 1.
               Messi plays for the team Paris Saint-Germain.
               The national team Messi plays for is the Argentina team.
               Messi is also known as Leo Messi
               Victor Ulloa plays for Inter Miami""",
        limit=2000,
    )
    new_memory = client.create_block(label="rethink_memory_block", value="[empty]", limit=2000)

    # conversation_human_block = Block(name="human", label="human", value=get_human_text(DEFAULT_HUMAN), limit=2000)
    # conversation_persona_block = Block(name="persona", label="persona", value=get_persona_text(DEFAULT_PERSONA), limit=2000)
    # offline_human_block = Block(name="human", label="human", value=get_human_text(DEFAULT_HUMAN), limit=2000)
    # offline_persona_block = Block(name="persona", label="persona", value=get_persona_text("offline_memory_persona"), limit=2000)

    ## Figure 1. from Evaluating the Ripple Effects of Knowledge Editing in Language Models (Cohen et al., 2023)
    ## https://arxiv.org/pdf/2307.12976
    # fact_block = Block(
    #    name="fact_block",
    #    label="fact_block",
    #    value="""Messi resides in the Paris.
    #           Messi plays in the league Ligue 1.
    #           Messi plays for the team Paris Saint-Germain.
    #           The national team Messi plays for is the Argentina team.
    #           Messi is also known as Leo Messi
    #           Victor Ulloa plays for Inter Miami""",
    #    limit=2000,
    # )
    # new_memory = Block(name="rethink_memory_block", label="rethink_memory_block", value="[empty]", limit=2000)
    # conversation_memory = BasicBlockMemory(blocks=[conversation_persona_block, conversation_human_block, fact_block, new_memory])
    conversation_memory = BasicBlockMemory(blocks=[conversation_persona_block, conversation_human_block, fact_block])
    # offline_memory = BasicBlockMemory(blocks=[offline_persona_block, offline_human_block, fact_block, new_memory])
    offline_memory = BasicBlockMemory(blocks=[offline_persona_block, offline_human_block, fact_block])

    conversation_agent = client.create_agent(
        name="conversation_agent",
        agent_type=AgentType.memgpt_agent,
        system=gpt_system.get_system_text("memgpt_convo_only"),
        llm_config=LLMConfig.default_config("gpt-4"),
        embedding_config=EmbeddingConfig.default_config("text-embedding-ada-002"),
        tool_ids=[send_message.id, trigger_rethink_memory_tool.id],
        memory=conversation_memory,
        block_ids=[new_memory.id],
        include_base_tools=False,
    )
    assert conversation_agent is not None

    assert set(conversation_agent.memory.list_block_labels()) == {"persona", "human", "fact_block", "rethink_memory_block"}

    rethink_memory_tool = client.create_or_update_tool(rethink_memory)
    finish_rethinking_memory_tool = client.create_or_update_tool(finish_rethinking_memory)
    offline_memory_agent = client.create_agent(
        name="offline_memory_agent",
        agent_type=AgentType.offline_memory_agent,
        system=gpt_system.get_system_text("memgpt_offline_memory"),
        memory=offline_memory,
        llm_config=LLMConfig.default_config("gpt-4"),
        embedding_config=EmbeddingConfig.default_config("text-embedding-ada-002"),
        tool_ids=[rethink_memory_tool.id, finish_rethinking_memory_tool.id],
        tool_rules=[TerminalToolRule(tool_name=finish_rethinking_memory_tool.name)],
        block_ids=[new_memory.id],
        include_base_tools=False,
    )
    assert offline_memory_agent is not None
    assert set(offline_memory_agent.memory.list_block_labels()) == {"persona", "human", "fact_block", "rethink_memory_block"}
    response = client.user_message(
        agent_id=conversation_agent.id, message="[trigger_rethink_memory]: Messi has now moved to playing for Inter Miami"
    )
    offline_memory_agent = client.get_agent(agent_id=offline_memory_agent.id)

    assert offline_memory_agent.memory.get_block("rethink_memory_block").value != "[empty]"
    conversation_agent = client.get_agent(agent_id=conversation_agent.id)
    assert conversation_agent.memory.get_block("rethink_memory_block").value != "[empty]"

    # Clean up agent
    client.delete_agent(conversation_agent.id)
    client.delete_agent(offline_memory_agent.id)


def test_chat_only_agent(client, mock_e2b_api_key_none):
    from letta.offline_memory_agent import finish_rethinking_memory, rethink_memory

    send_message = client.server.tool_manager.get_tool_by_name(tool_name="send_message", actor=client.user)
    rethink_memory = client.create_or_update_tool(rethink_memory)
    finish_rethinking_memory = client.create_or_update_tool(finish_rethinking_memory)
    conversation_human_block = client.create_block(label="chat_only_agent_human", value=get_human_text(DEFAULT_HUMAN), limit=2000)
    conversation_persona_block = client.create_block(label="chat_only_agent_persona", value=get_persona_text(DEFAULT_PERSONA), limit=2000)

    offline_persona_block = Block(
        name="offline_memory_persona",
        label="offline_memory_persona",
        value=get_persona_text("offline_memory_persona"),
        limit=2000,
    )

    offline_memory = BasicBlockMemory(
        blocks=[
            offline_persona_block,
            conversation_human_block,
            conversation_persona_block,
        ]
    )

    offline_memory_agent = client.create_agent(
        name="offline_memory_agent",
        agent_type=AgentType.offline_memory_agent,
        system=gpt_system.get_system_text("memgpt_memory_only"),
        memory=offline_memory,
        llm_config=LLMConfig.default_config("gpt-4"),
        embedding_config=EmbeddingConfig.default_config("text-embedding-ada-002"),
        tool_ids=[rethink_memory.id, finish_rethinking_memory.id],
        include_base_tools=False,
    )

    chat_only_agent = client.create_agent(
        name="conversation_agent",
        agent_type=AgentType.memgpt_agent,
        llm_config=LLMConfig.default_config("gpt-4"),
        system=gpt_system.get_system_text("memgpt_convo_only"),
        embedding_config=EmbeddingConfig.default_config("text-embedding-ada-002"),
        tool_ids=[send_message.id],
        memory=BasicBlockMemory(blocks=[conversation_persona_block, conversation_human_block]),
        include_base_tools=False,
    )

    assert chat_only_agent is not None
    assert offline_memory_agent is not None

    # NOTE: the system messages sent to the offline memory agent here are not the actual messages,
    # from the chat only agent. We need to actually stream the responses from the agent to the offline memory
    # these are just for testing
    for message in [
        ("hello", "user"),
        ("hi chad, how's it going?", "system"),
        ("my name is not chad, my name is swoodily", "user"),
        ("I'm sorry, I'm make a note of that, swoodily", "system"),
        ("what's the weather like today?", "user"),
        ("could you specify where you are at?", "system"),
        ("I'm in SF", "user"),
        ("it's currently 60 degrees in SF", "system"),
        ("actually, I'm in Palo Alto", "user"),
        ("it's currently 60 degrees in Palo Alto", "system"),
        ("that sounds nice, I might go for a hike today then", "user"),
        ("Here are some hikes near Palo Alto: 1. The Dish 2. Redtail Loop 3. Adobe Creek", "system"),
        ("I'm going to try the first one, the Dish", "user"),
        ("That sounds great, hope you enjoy it", "system"),
    ]:
        if message[1] == "user":
            client.send_message(agent_id=chat_only_agent.id, message=message[0], role=message[1])
            client.send_message(agent_id=offline_memory_agent.id, message=message[0], role=message[1])
        else:
            client.send_message(agent_id=offline_memory_agent.id, message=message[0], role=message[1])

        offline_memory_agent = client.get_agent(agent_id=offline_memory_agent.id)
        chat_only_agent = client.get_agent(agent_id=chat_only_agent.id)

    assert chat_only_agent.memory.get_block("chat_only_agent_human").value != get_human_text(DEFAULT_HUMAN)
    client.delete_agent(chat_only_agent.id)
    client.delete_agent(offline_memory_agent.id)


def test_initial_message_sequence(client, mock_e2b_api_key_none):
    """
    Test that when we set the initial sequence to an empty list,
    we do not get the default initial message sequence.
    """
    offline_memory_agent = client.create_agent(
        name="offline_memory_agent",
        agent_type=AgentType.offline_memory_agent,
        system=gpt_system.get_system_text("memgpt_offline_memory"),
        llm_config=LLMConfig.default_config("gpt-4"),
        embedding_config=EmbeddingConfig.default_config("text-embedding-ada-002"),
        include_base_tools=False,
        initial_message_sequence=[],
    )
    assert offline_memory_agent is not None
    assert len(offline_memory_agent.message_ids) == 1  # There should just the system message

    client.delete_agent(offline_memory_agent.id)
