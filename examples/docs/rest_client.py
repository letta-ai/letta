from letta_client import CreateBlock, Letta, MessageCreate

"""
Make sure you run the Letta server before running this example.
```
letta server
```
"""


def main():
    # Connect to the server as a user
    client = Letta(base_url="http://localhost:8283")

    # list available configs on the server
    llm_configs = client.models.list_llms()
    print(f"Available LLM configs: {llm_configs}")
    embedding_configs = client.models.list_embedding_models()
    print(f"Available embedding configs: {embedding_configs}")

    # Create an agent
    agent_state = client.agents.create(
        name="my_agent",
        memory_blocks=[
            CreateBlock(
                label="human",
                value="My name is Sarah",
            ),
            CreateBlock(
                label="persona",
                value="I am a friendly AI",
            ),
        ],
        model=llm_configs[0].handle,
        embedding=embedding_configs[0].handle,
    )
    print(f"Created agent: {agent_state.name} with ID {str(agent_state.id)}")

    # Send a message to the agent
    print(f"Created agent: {agent_state.name} with ID {str(agent_state.id)}")
    response = client.agents.messages.create(
        agent_id=agent_state.id, 
        messages=[
            MessageCreate(
                role="user",
                content="Whats my name?",
            )
        ],
    )
    print(f"Received response:", response.messages)

    # Delete agent
    client.agents.delete(agent_id=agent_state.id)
    print(f"Deleted agent: {agent_state.name} with ID {str(agent_state.id)}")


if __name__ == "__main__":
    main()
