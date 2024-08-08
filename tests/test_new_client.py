import pytest
from crewai_tools import ScrapeWebsiteTool

from memgpt import create_client
from memgpt.schemas.memory import ChatMemory, Memory
from memgpt.schemas.tool import Tool


@pytest.fixture(scope="module")
def client():
    yield create_client()


@pytest.fixture(scope="module")
def agent(client):
    agent_state = client.create_agent(name="test_agent")
    yield agent_state

    client.delete_agent(agent_state.id)
    assert client.get_agent(agent_state.id) is None, f"Failed to properly delete agent {agent_state.id}"


def test_agent(client):

    tools = client.list_tools()

    # create agent
    agent_state_test = client.create_agent(
        name="test_agent2",
        memory=ChatMemory(human="I am a human", persona="I am an agent"),
        description="This is a test agent",
    )
    assert isinstance(agent_state_test.memory, Memory)

    # list agents
    agents = client.list_agents()
    assert agent_state_test.id in [a.id for a in agents]

    # get agent
    print("TOOLS", [t.name for t in tools])
    agent_state = client.get_agent(agent_state_test.id)
    assert agent_state.name == "test_agent2"

    assert isinstance(agent_state.memory, Memory)
    # update agent: name
    new_name = "new_agent"
    client.update_agent(agent_state_test.id, name=new_name)
    assert client.get_agent(agent_state_test.id).name == new_name

    assert isinstance(agent_state.memory, Memory)
    # update agent: system prompt
    new_system_prompt = agent_state.system + "\nAlways respond with a !"
    client.update_agent(agent_state_test.id, system=new_system_prompt)
    assert client.get_agent(agent_state_test.id).system == new_system_prompt

    assert isinstance(agent_state.memory, Memory)
    # update agent: message_ids
    old_message_ids = agent_state.message_ids
    new_message_ids = old_message_ids.copy()[:-1]  # pop one
    assert len(old_message_ids) != len(new_message_ids)
    client.update_agent(agent_state_test.id, message_ids=new_message_ids)
    assert client.get_agent(agent_state_test.id).message_ids == new_message_ids

    assert isinstance(agent_state.memory, Memory)
    # update agent: tools
    tool_to_delete = "send_message"
    assert tool_to_delete in agent_state.tools
    new_agent_tools = [t_name for t_name in agent_state.tools if t_name != tool_to_delete]
    client.update_agent(agent_state_test.id, tools=new_agent_tools)
    assert client.get_agent(agent_state_test.id).tools == new_agent_tools

    assert isinstance(agent_state.memory, Memory)
    # update agent: memory
    new_human = "My name is Mr Test, 100 percent human."
    new_persona = "I am an all-knowing AI."
    new_memory = ChatMemory(human=new_human, persona=new_persona)
    assert agent_state.memory.get_block("human").value != new_human
    assert agent_state.memory.get_block("persona").value != new_persona

    client.update_agent(agent_state_test.id, memory=new_memory)
    assert client.get_agent(agent_state_test.id).memory.get_block("human").value == new_human
    assert client.get_agent(agent_state_test.id).memory.get_block("persona").value == new_persona

    # update agent: llm config
    new_llm_config = agent_state.llm_config.model_copy(deep=True)
    new_llm_config.model = "fake_new_model"
    new_llm_config.context_window = 1e6
    assert agent_state.llm_config != new_llm_config
    client.update_agent(agent_state_test.id, llm_config=new_llm_config)
    assert client.get_agent(agent_state_test.id).llm_config == new_llm_config
    assert client.get_agent(agent_state_test.id).llm_config.model == "fake_new_model"
    assert client.get_agent(agent_state_test.id).llm_config.context_window == 1e6

    # update agent: embedding config
    new_embed_config = agent_state.embedding_config.model_copy(deep=True)
    new_embed_config.embedding_model = "fake_embed_model"
    assert agent_state.embedding_config != new_embed_config
    client.update_agent(agent_state_test.id, embedding_config=new_embed_config)
    assert client.get_agent(agent_state_test.id).embedding_config == new_embed_config
    assert client.get_agent(agent_state_test.id).embedding_config.embedding_model == "fake_embed_model"

    # delete agent
    client.delete_agent(agent_state_test.id)


def test_memory(client, agent):

    # get agent memory
    original_memory = client.get_in_context_memory(agent.id)
    assert original_memory is not None
    original_memory_value = str(original_memory.get_block("human").value)

    # update core memory
    updated_memory = client.update_in_context_memory(agent.id, section="human", value="I am a human")

    # get memory
    assert updated_memory.get_block("human").value != original_memory_value  # check if the memory has been updated


def test_archival_memory(client, agent):
    """Test functions for interacting with archival memory store"""

    # add archival memory
    memory_str = "I love chats"
    passage = client.insert_archival_memory(agent.id, memory=memory_str)[0]

    # list archival memory
    passages = client.get_archival_memory(agent.id)
    assert passage.text in [p.text for p in passages], f"Missing passage {passage.text} in {passages}"

    # delete archival memory
    client.delete_archival_memory(agent.id, passage.id)


def test_recall_memory(client, agent):
    """Test functions for interacting with recall memory store"""

    ## helper function for parsing me
    # def collect_user_messages(messages):
    #    user_messages = []
    #    for m in messages:
    #        if m.role == "user":
    #            data = json.loads(m.text)
    #            if "message" in data:
    #                user_messages.append(data["message"])
    #    return user_messages

    # send message to the agent
    message_str = "Hello"
    client.send_message(message_str, "user", agent.id)

    # list messages
    messages = client.get_messages(agent.id)
    # assert message_str in collect_user_messages(messages), f"Missing message {message_str} in {[m[:100] for m in messages]}"
    assert message_str in [m.text for m in messages], f"Missing message {message_str} in {[m[:100] for m in messages]}"

    # get in-context messages
    in_context_messages = client.get_in_context_messages(agent.id)
    assert message_str in [
        m.text for m in in_context_messages
    ], f"Missing message {message_str} in {[m[:100] for m in in_context_messages]}"
    # assert message_str in collect_user_messages(
    #    in_context_messages
    # ), f"Missing message {message_str} in {[m[:100] for m in in_context_messages]}"


def test_tools(client):

    def print_tool(message: str):
        """
        A tool to print a message

        Args:
            message (str): The message to print.

        Returns:
            str: The message that was printed.

        """
        print(message)
        return message

    def print_tool2(msg: str):
        """
        Another tool to print a message

        Args:
            msg (str): The message to print.
        """
        print(msg)

    # create tool
    orig_tool_length = len(client.list_tools())
    tool = client.create_tool(print_tool, tags=["extras"])

    # list tools
    tools = client.list_tools()
    assert tool.name in [t.name for t in tools]

    # get tool id
    assert tool.id == client.get_tool_id(name="print_tool")

    # update tool: extras
    extras2 = ["extras2"]
    client.update_tool(tool.id, tags=extras2)
    assert client.get_tool(tool.id).tags == extras2

    # update tool: source code
    client.update_tool(tool.id, name="print_tool2", func=print_tool2)
    assert client.get_tool(tool.id).name == "print_tool2"

    # delete tool
    client.delete_tool(tool.id)
    assert len(client.list_tools()) == orig_tool_length


def test_tools_from_crewai(client):
    # create crewAI tool
    crewai_tool = ScrapeWebsiteTool()

    # Translate to memGPT Tool
    tool = Tool.from_crewai(crewai_tool)

    # Add the tool
    client.add_tool(tool)

    # list tools
    tools = client.list_tools()
    assert tool.name in [t.name for t in tools]

    # get tool
    tool_id = client.get_tool_id(name=tool.name)
    retrieved_tool = client.get_tool(tool_id)
    source_code = retrieved_tool.source_code

    print(source_code)

    # Parse the function and attempt to use it
    local_scope = {}
    exec(source_code, {}, local_scope)
    func = local_scope[tool.name]

    # Pull a simple HTML website and check that scraping it works
    # TODO: This is very hacky and can break at any time if the website changes.
    # Host our own websites to test website tool calling on.
    simple_webpage_url = "https://www.york.ac.uk/teaching/cws/wws/webpage1.html"
    expected_content = "There are lots of ways to create web pages using already coded programmes."
    assert expected_content in func(website_url=simple_webpage_url)


def test_sources(client, agent):

    # list sources (empty)
    sources = client.list_sources()
    assert len(sources) == 0

    # create a source
    test_source_name = "test_source"
    source = client.create_source(name=test_source_name)

    # list sources
    sources = client.list_sources()
    assert len(sources) == 1
    assert sources[0].metadata_["num_passages"] == 0
    assert sources[0].metadata_["num_documents"] == 0

    # update the source
    original_id = source.id
    original_name = source.name
    new_name = original_name + "_new"
    client.update_source(source_id=source.id, name=new_name)

    # get the source name (check that it's been updated)
    source = client.get_source(source_id=source.id)
    assert source.name == new_name
    assert source.id == original_id

    # get the source id (make sure that it's the same)
    assert str(original_id) == client.get_source_id(source_name=new_name)

    # check agent archival memory size
    archival_memories = client.get_archival_memory(agent_id=agent.id)
    print(archival_memories)
    assert len(archival_memories) == 0

    # load a file into a source
    filename = "CONTRIBUTING.md"
    upload_job = client.load_file_into_source(filename=filename, source_id=source.id)
    print("Upload job", upload_job, upload_job.status, upload_job.metadata_)

    # TODO: make sure things run in the right order
    archival_memories = client.get_archival_memory(agent_id=agent.id)
    assert len(archival_memories) == 0

    # attach a source
    client.attach_source_to_agent(source_id=source.id, agent_id=agent.id)

    # list archival memory
    archival_memories = client.get_archival_memory(agent_id=agent.id)
    # print(archival_memories)
    assert len(archival_memories) == 20 or len(archival_memories) == 21

    # check number of passages
    sources = client.list_sources()

    # TODO: do we want to add this metadata back?
    # assert sources[0].metadata_["num_passages"] > 0
    # assert sources[0].metadata_["num_documents"] == 0  # TODO: fix this once document store added
    print(sources)

    # detach the source
    # TODO: add when implemented
    # client.detach_source(source.name, agent.id)

    # delete the source
    client.delete_source(source.id)
