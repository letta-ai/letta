from letta import BasicBlockMemory
from letta.client.client import Block, create_client
from letta.constants import DEFAULT_HUMAN, DEFAULT_PERSONA
from letta.offline_memory_agent import (
    finish_rethinking_memory,
    rethink_memory,
    send_message_offline_agent,
    trigger_rethink_memory,
)
from letta.prompts import gpt_system
from letta.schemas.agent import AgentType
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.llm_config import LLMConfig
from letta.schemas.tool_rule import TerminalToolRule
from letta.utils import get_human_text, get_persona_text


def test_chat_offline_memory():
    # Check that the agent can edit multiple blocks of memory
    client = create_client()
    assert client is not None

    trigger_rethink_memory_tool = client.create_tool(trigger_rethink_memory)
    send_message_offline_agent_tool = client.create_tool(send_message_offline_agent)

    conversation_human_block = Block(name="chat_agent_human", label="chat_agent_human", value=get_human_text(DEFAULT_HUMAN), limit=2000)
    conversation_persona_block = Block(name="chat_agent_persona", label="chat_agent_persona", value=get_persona_text(DEFAULT_PERSONA), limit=2000)
    offline_persona_block = Block(name="offline_memory_persona", label="offline_memory_persona", value=get_persona_text("offline_memory_persona"), limit=2000)

    conversation_human_block_new = Block(name="chat_agent_human_new", label="chat_agent_human_new", value=get_human_text(DEFAULT_HUMAN), limit=2000)
    conversation_persona_block_new = Block(name="chat_agent_persona_new", label="chat_agent_persona_new", value=get_persona_text(DEFAULT_PERSONA), limit=2000)
    conversation_messages_block = Block(name="conversation_block", label="conversation_block", value="", limit=20000)
    conversation_memory = BasicBlockMemory(blocks=[conversation_persona_block, conversation_human_block, conversation_messages_block])
    offline_memory = BasicBlockMemory(
        blocks=[offline_persona_block, conversation_human_block, conversation_persona_block, conversation_human_block_new, conversation_persona_block_new, conversation_messages_block]
    )

    conversation_agent = client.create_agent(
        name="conversation_agent",
        agent_type=AgentType.memgpt_agent,
        system=gpt_system.get_system_text("memgpt_convo_only"),
        llm_config=LLMConfig.default_config("gpt-4"),
        embedding_config=EmbeddingConfig.default_config("text-embedding-ada-002"),
        tools=[send_message_offline_agent_tool.name, trigger_rethink_memory_tool.name],
        memory=conversation_memory,
        include_base_tools=False,
        include_memory_tools=False,
    )
    assert conversation_agent is not None
    assert [tool.name for tool in client.get_tools_from_agent(agent_id=conversation_agent.id)] == [
        send_message_offline_agent_tool.name,
        trigger_rethink_memory_tool.name,
    ]

    rethink_memory_tool = client.create_tool(rethink_memory)
    finish_rethinking_memory_tool = client.create_tool(finish_rethinking_memory)
    offline_memory_agent = client.create_agent(
        name="offline_memory_agent",
        agent_type=AgentType.offline_memory_agent,
        system=gpt_system.get_system_text("memgpt_offline_memory_chat"),
        memory=offline_memory,
        llm_config=LLMConfig.default_config("gpt-4"),
        embedding_config=EmbeddingConfig.default_config("text-embedding-ada-002"),
        tools=[rethink_memory_tool.name, finish_rethinking_memory_tool.name],
        tool_rules=[TerminalToolRule(tool_name=finish_rethinking_memory_tool.name)],
        include_base_tools=False,
    )
    assert offline_memory_agent is not None

    for message in ["Hi there", "No, my first name is Swoodily"]:
        _ = client.user_message(agent_id=conversation_agent.id, message=message)

    offline_memory_agent = client.get_agent(agent_id=offline_memory_agent.id)
    _ = client.user_message(agent_id=conversation_agent.id, message="[trigger_rethink_memory]")
    offline_memory_agent = client.get_agent(agent_id=offline_memory_agent.id)
    assert offline_memory_agent.memory.get_block("chat_agent_human_new").value != get_human_text(DEFAULT_HUMAN) 
    conversation_agent = client.get_agent(agent_id=conversation_agent.id)
    assert offline_memory_agent.memory.get_block("chat_agent_human_new").value == conversation_agent.memory.get_block("chat_agent_human").value

    
def test_ripple_edit():
    client = create_client()
    assert client is not None

    trigger_rethink_memory_tool = client.create_tool(trigger_rethink_memory)
    send_message_offline_agent_tool = client.create_tool(send_message_offline_agent)

    conversation_human_block = Block(name="human", label="human", value=get_human_text(DEFAULT_HUMAN), limit=2000)
    conversation_persona_block = Block(name="persona", label="persona", value=get_persona_text(DEFAULT_PERSONA), limit=2000)
    offline_human_block = Block(name="human", label="human", value=get_human_text(DEFAULT_HUMAN), limit=2000)
    offline_persona_block = Block(name="persona", label="persona", value=get_persona_text("offline_memory_persona"), limit=2000)

    # Figure 1. from Evaluating the Ripple Effects of Knowledge Editing in Language Models (Cohen et al., 2023)
    # https://arxiv.org/pdf/2307.12976
    fact_block = Block(
        name="fact_block",
        label="fact_block",
        value="""Messi resides in the Paris.
               Messi plays in the league Ligue 1.
               Messi plays for the team Paris Saint-Germain.
               The national team Messi plays for is the Argentina team.
               Messi is also known as Leo Messi
               Victor Ulloa plays for Inter Miami""",
        limit=2000,
    )

    new_memory = Block(name="rethink_memory_block", label="rethink_memory_block", value="[empty]", limit=2000)
    conversation_memory = BasicBlockMemory(blocks=[conversation_persona_block, conversation_human_block, fact_block])  # , new_memory])
    offline_memory = BasicBlockMemory(blocks=[offline_persona_block, offline_human_block, fact_block, new_memory])

    conversation_agent = client.create_agent(
        agent_type=AgentType.memgpt_agent,
        system=gpt_system.get_system_text("memgpt_convo_only"),
        llm_config=LLMConfig.default_config("gpt-4"),
        embedding_config=EmbeddingConfig.default_config("text-embedding-ada-002"),
        tools=[send_message_offline_agent_tool.name, trigger_rethink_memory_tool.name],
        memory=conversation_memory,
        include_base_tools=False,
    )
    assert conversation_agent is not None
    assert conversation_agent.memory.list_block_labels() == [
        "persona",
        "human",
        "fact_block",
    ]

    rethink_memory_tool = client.create_tool(rethink_memory)
    finish_rethinking_memory_tool = client.create_tool(finish_rethinking_memory)
    offline_memory_agent = client.create_agent(
        agent_type=AgentType.offline_memory_agent,
        system=gpt_system.get_system_text("memgpt_offline_memory"),
        memory=offline_memory,
        llm_config=LLMConfig.default_config("gpt-4"),
        embedding_config=EmbeddingConfig.default_config("text-embedding-ada-002"),
        tools=[rethink_memory_tool.name, finish_rethinking_memory_tool.name],
        tool_rules=[TerminalToolRule(tool_name=finish_rethinking_memory_tool.name)],
        include_base_tools=False,
    )
    assert offline_memory_agent is not None
    assert offline_memory_agent.memory.list_block_labels() == ["persona", "human", "fact_block", "rethink_memory_block"]
    _ = client.user_message(
        agent_id=conversation_agent.id, message="[trigger_rethink_memory]: Messi has now moved to playing for Inter Miami"
    )
    offline_memory_agent = client.get_agent(agent_id=offline_memory_agent.id)
    offline_memory_agent = client.get_agent(agent_id=offline_memory_agent.id)
    assert offline_memory_agent.memory.get_block("rethink_memory_block").value != "[empty]"
    conversation_agent = client.get_agent(agent_id=conversation_agent.id)

    '''
    for agent in client.list_agents():
        if agent.agent_type == AgentType.offline_memory_agent:
            client.delete_agent(agent.id)
    conversation_agent.memory.link_block(offline_memory_agent.memory.get_block("rethink_memory_block"))
    conversation_agent = client.get_agent(agent_id=conversation_agent.id)
    print(new_memory)

    new_conversation_human_block = Block(name="human", label="human", value=get_human_text(DEFAULT_HUMAN), limit=2000)
    new_conversation_persona_block = Block(name="persona", label="persona", value=get_persona_text(DEFAULT_PERSONA), limit=2000)
    new_fact_block = Block(
        name="fact_block",
        label="fact_block",
        value="""Messi resides in the Paris.
               Messi plays in the league Ligue 1.
               Messi plays for the team Paris Saint-Germain.
               The national team Messi plays for is the Argentina team.
               Messi is also known as Leo Messi
               Victor Ulloa plays for Inter Miami""",
        limit=2000,
    )

    new_conversation_memory = BasicBlockMemory(blocks=[new_conversation_persona_block, new_conversation_human_block, new_fact_block])  # , new_memory])
    new_conversation_agent = client.create_agent(
        agent_type=AgentType.memgpt_agent,
        # system=gpt_system.get_system_text("memgpt_convo_only"),
        llm_config=LLMConfig.default_config("gpt-4"),
        embedding_config=EmbeddingConfig.default_config("text-embedding-ada-002"),
        # tools=[send_message_offline_agent_tool.name, trigger_rethink_memory_tool.name],
        memory=new_conversation_memory,
    )
    assert new_conversation_agent is not None
    assert new_conversation_agent.memory.list_block_labels() == [
        "persona",
        "human",
        "fact_block",
    ]
    _ = client.user_message(
        agent_id=new_conversation_agent.id, message="Messi has now moved to playing for Inter Miami"
    )
    '''


def test_offline_memory_agent():
    client = create_client()
    assert client is not None

    trigger_rethink_memory_tool = client.create_tool(trigger_rethink_memory)
    send_message_offline_agent_tool = client.create_tool(send_message_offline_agent)

    conversation_human_block = Block(name="human", label="human", value=get_human_text(DEFAULT_HUMAN), limit=2000)
    conversation_persona_block = Block(name="persona", label="persona", value=get_persona_text(DEFAULT_PERSONA), limit=2000)
    offline_human_block = Block(name="human", label="human", value=get_human_text(DEFAULT_HUMAN), limit=2000)
    offline_persona_block = Block(name="persona", label="persona", value=get_persona_text("offline_memory_persona"), limit=2000)

    block1 = Block(
        name="interaction_1",
        label="interaction_1",
        value="User clicked on product 2, and not product 1. User clicked on product 1 not product 3.",
        limit=2000,
    )
    block2 = Block(
        name="interaction_2",
        label="interaction_2",
        value="User clicked on product 2 and not product 3. User clicked on product 1 not product 3.",
        limit=2000,
    )

    new_memory = Block(name="rethink_memory_block", label="rethink_memory_block", value="[empty]", limit=2000)
    conversation_memory = BasicBlockMemory(blocks=[conversation_persona_block, conversation_human_block, block1, block2])  # , new_memory])
    offline_memory = BasicBlockMemory(blocks=[offline_persona_block, offline_human_block, block1, block2, new_memory])

    conversation_agent = client.create_agent(
        agent_type=AgentType.memgpt_agent,
        system=gpt_system.get_system_text("memgpt_convo_only"),
        llm_config=LLMConfig.default_config("gpt-4"),
        embedding_config=EmbeddingConfig.default_config("text-embedding-ada-002"),
        tools=[send_message_offline_agent_tool.name, trigger_rethink_memory_tool.name],
        memory=conversation_memory,
        include_base_tools=False,
    )
    assert conversation_agent is not None
    assert conversation_agent.memory.list_block_labels() == [
        "persona",
        "human",
        "interaction_1",
        "interaction_2",
    ]  # , "rethink_memory_block"]

    rethink_memory_tool = client.create_tool(rethink_memory)
    finish_rethinking_memory_tool = client.create_tool(finish_rethinking_memory)
    offline_memory_agent = client.create_agent(
        agent_type=AgentType.offline_memory_agent,
        system=gpt_system.get_system_text("memgpt_offline_memory"),
        memory=offline_memory,
        llm_config=LLMConfig.default_config("gpt-4"),
        embedding_config=EmbeddingConfig.default_config("text-embedding-ada-002"),
        tools=[rethink_memory_tool.name, finish_rethinking_memory_tool.name],
        tool_rules=[TerminalToolRule(tool_name=finish_rethinking_memory_tool.name)],
        include_base_tools=False,
    )
    assert offline_memory_agent is not None
    assert offline_memory_agent.memory.list_block_labels() == ["persona", "human", "interaction_1", "interaction_2", "rethink_memory_block"]
    _ = client.user_message(agent_id=conversation_agent.id, message="trigger_rethink_memory")
    offline_memory_agent = client.get_agent(agent_id=offline_memory_agent.id)
    offline_memory_agent = client.get_agent(agent_id=offline_memory_agent.id)
    assert offline_memory_agent.memory.get_block("rethink_memory_block").value != "[empty]"
    conversation_agent = client.get_agent(agent_id=conversation_agent.id)
    # TODO(kevin) terminate the subagent
    # TODO(kevin) link the new block to the conversation agent


if __name__ == "__main__":
    test_offline_memory_agent()