from letta_client import CreateBlock, Letta, MessageCreate
from letta_client.types import TerminalToolRule

"""
Make sure you run the Letta server before running this example.
```
letta server
```
"""

client = Letta(base_url="http://localhost:8283")

# define a function with a docstring
def roll_d20() -> str:
    """
    Simulate the roll of a 20-sided die (d20).

    This function generates a random integer between 1 and 20, inclusive,
    which represents the outcome of a single roll of a d20.

    Returns:
        int: A random integer between 1 and 20, representing the die roll.

    Example:
        >>> roll_d20()
        15  # This is an example output and may vary each time the function is called.
    """
    import random

    dice_role_outcome = random.randint(1, 20)
    output_string = f"You rolled a {dice_role_outcome}"
    return output_string


# create a tool from the function
tool = client.tools.upsert_from_function(func=roll_d20)
print(f"Created tool with name {tool.name}")

# create a new agent
agent_state = client.agents.create(
    memory_blocks=[
        CreateBlock(
            label="human",
            value="Name: Sarah",
        ),
    ],
    # set automatic defaults for LLM/embedding config
    model="openai/gpt-4o-mini",
    embedding="openai/text-embedding-3-small",
    # create the agent with an additional tool
    tool_ids=[tool.id],
    tool_rules=[
        # exit after roll_d20 is called
        TerminalToolRule(tool_name=tool.name),
        # exit after send_message is called (default behavior)
        TerminalToolRule(tool_name="send_message"),
    ]
)
print(f"Created agent with name {agent_state.name} with tools {[t.name for t in agent_state.tools]}")

# Message an agent
response = client.agents.messages.create(
    agent_id=agent_state.id, 
    messages=[
        MessageCreate(
            role="user",
            content="roll a dice",
        )
    ],
)
print("Usage", response.usage)
print("Agent messages", response.messages)

# remove a tool from the agent
client.agents.tools.detach(agent_id=agent_state.id, tool_id=tool.id)

# add a tool to the agent
client.agents.tools.attach(agent_id=agent_state.id, tool_id=tool.id)

client.agents.delete(agent_id=agent_state.id)

# create an agent with only a subset of default tools
send_message_tool = [t for t in client.tools.list() if t.name == "send_message"][0]
agent_state = client.agents.create(
    memory_blocks=[
        CreateBlock(
            label="human",
            value="username: sarah",
        ),
    ],
    model="openai/gpt-4o-mini",
    embedding="openai/text-embedding-3-small",
    include_base_tools=False, 
    tool_ids=[tool.id, send_message_tool.id],
)

# message the agent to search archival memory (will be unable to do so)
client.agents.messages.create(
    agent_id=agent_state.id,
    messages=[
        MessageCreate(
            role="user",
            content="search your archival memory",
        )
    ],
)
print("Usage", response.usage)
print("Agent messages", response.messages)

client.agents.delete(agent_id=agent_state.id)
