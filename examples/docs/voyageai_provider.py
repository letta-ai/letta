import os
from letta_client import CreateBlock, Letta, MessageCreate

"""
Using VoyageAI Embeddings with Letta

This example demonstrates how to use VoyageAI's embedding models with Letta agents.
VoyageAI provides high-quality embeddings for various use cases:
- voyage-3.5: General-purpose embeddings
- voyage-context-3: Contextual embeddings for document understanding
- voyage-multimodal-3: Multimodal embeddings for text and images
- voyage-code-3: Code-specific embeddings
- voyage-finance-2, voyage-law-2: Domain-specific embeddings

Prerequisites:
- Run the Letta server: `letta server`
- Set VOYAGEAI_API_KEY environment variable: `export VOYAGEAI_API_KEY='your-key'`
"""

# Connect to Letta server
client = Letta(base_url="http://localhost:8283")

# Step 1: Register VoyageAI provider (one-time setup)
# Check if provider already exists
provider = None
providers = client.providers.list()
for p in providers:
    if p.provider_type == "voyageai":
        provider = p
        print(f"Using existing VoyageAI provider: {provider.id}")
        break

# Create provider if it doesn't exist
if provider is None:
    provider = client.providers.create(
        name="voyageai",
        provider_type="voyageai",
        api_key=os.getenv("VOYAGEAI_API_KEY"),
    )
    print(f"Created VoyageAI provider: {provider.id}")

# Step 2: Create an agent with VoyageAI embeddings
agent_state = client.agents.create(
    memory_blocks=[
        CreateBlock(
            label="human",
            value="Name: Alex. Interests: AI and machine learning research",
        ),
    ],
    model="openai/gpt-4o-mini",
    embedding="voyageai/voyage-3.5",  # Use VoyageAI's latest embedding model
)
print(f"Created agent: {agent_state.name} (ID: {agent_state.id})")
print(f"Using embedding model: voyageai/voyage-3.5")

# Step 3: Send a message to the agent
response = client.agents.messages.create(
    agent_id=agent_state.id,
    messages=[
        MessageCreate(
            role="user",
            content="What are my interests?",
        )
    ],
)
print(f"\nUser: What are my interests?")
print(f"Assistant: {response.messages[-1].content}")

# Step 4: Cleanup
client.agents.delete(agent_id=agent_state.id)
print(f"\nAgent deleted successfully")
