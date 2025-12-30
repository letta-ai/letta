"""
VoyageAI Embeddings Example

This example demonstrates how to use VoyageAI's embedding models with Letta.
VoyageAI provides three types of embedding models:

1. **Text embeddings**: Standard models for general text (voyage-3.5, voyage-3.5-lite, voyage-code-3, etc.)
2. **Contextual embeddings**: Models that understand document context (voyage-context-3)
3. **Multimodal embeddings**: Models that handle text+images (voyage-multimodal-3) or text+images+video (voyage-multimodal-3.5)

Prerequisites:
- Run the Letta server: `letta server`
- Set VOYAGEAI_API_KEY environment variable
- Install letta_client: `pip install letta-client`

Execute this script using: `uv run python3 examples/voyageai_embeddings.py`
"""

import os
import time

from letta_client import CreateBlock, Letta, MessageCreate

# Check if VOYAGEAI_API_KEY is set
if not os.getenv("VOYAGEAI_API_KEY"):
    print("⚠️  VOYAGEAI_API_KEY environment variable not set!")
    print("Please set it with: export VOYAGEAI_API_KEY='your-api-key'")
    exit(1)

# Connect to local Letta server
client = Letta(base_url="http://localhost:8283")

print("=" * 80)
print("VoyageAI Embeddings Demo")
print("=" * 80)

# ============================================================================
# Step 0: Register VoyageAI Provider (if not already registered)
# ============================================================================
print("\n🔧 Setting up VoyageAI provider...")
print("-" * 80)

# Check if VoyageAI provider already exists
provider = None
try:
    providers = client.providers.list()
    for p in providers:
        if p.provider_type == "voyageai":
            provider = p
            print(f"✅ Found existing VoyageAI provider: {provider.id}")
            break
except Exception as e:
    print(f"   Note: {e}")

# Create provider if it doesn't exist
if provider is None:
    try:
        provider = client.providers.create(
            name="voyageai",
            provider_type="voyageai",
            api_key=os.getenv("VOYAGEAI_API_KEY"),
        )
        print(f"✅ VoyageAI provider registered: {provider.id}")
    except Exception as e:
        print(f"❌ Provider registration failed: {e}")
        print("   Cannot continue with example")
        exit(1)

# ============================================================================
# Example 1: Text Embeddings (voyage-3.5)
# ============================================================================
print("\n📝 Example 1: Creating agent with VoyageAI text embeddings (voyage-3.5)")
print("-" * 80)

agent_text = client.agents.create(
    name="voyageai_text_agent",
    memory_blocks=[
        CreateBlock(
            label="human",
            value="Name: Alex. Interests: Machine Learning, AI, Python",
        ),
        CreateBlock(
            label="persona",
            value="I am a helpful AI assistant powered by VoyageAI embeddings.",
        ),
    ],
    model="openai/gpt-4o-mini",
    embedding="voyageai/voyage-3.5",  # High-quality general-purpose embedding
)

print(f"✅ Created agent '{agent_text.name}' with ID: {agent_text.id}")
print(f"   Embedding model: voyageai/voyage-3.5")

# Send a message to test
response = client.agents.messages.create(
    agent_id=agent_text.id,
    messages=[
        MessageCreate(
            role="user",
            content="What are my interests?",
        )
    ],
)

print(f"\n💬 User: What are my interests?")
print(f"🤖 Assistant: {response.messages[-1].content}")

# ============================================================================
# Example 2: Lightweight Text Embeddings (voyage-3.5-lite)
# ============================================================================
print("\n\n🚀 Example 2: Creating agent with lightweight embeddings (voyage-3.5-lite)")
print("-" * 80)

agent_lite = client.agents.create(
    name="voyageai_lite_agent",
    memory_blocks=[
        CreateBlock(
            label="human",
            value="Name: Sam. Role: Software Engineer",
        ),
        CreateBlock(
            label="persona",
            value="I am a fast and efficient AI assistant.",
        ),
    ],
    model="openai/gpt-4o-mini",
    embedding="voyageai/voyage-3.5-lite",  # Faster, smaller embedding model
)

print(f"✅ Created agent '{agent_lite.name}' with ID: {agent_lite.id}")
print(f"   Embedding model: voyageai/voyage-3.5-lite (512-dim, faster performance)")

# ============================================================================
# Example 3: Domain-Specific Embeddings (voyage-code-3)
# ============================================================================
print("\n\n💻 Example 3: Creating agent with code-specific embeddings")
print("-" * 80)

agent_code = client.agents.create(
    name="voyageai_code_agent",
    memory_blocks=[
        CreateBlock(
            label="human",
            value="Developer working with Python and TypeScript",
        ),
        CreateBlock(
            label="persona",
            value="I am a coding assistant specialized in Python and TypeScript.",
        ),
    ],
    model="openai/gpt-4o-mini",
    embedding="voyageai/voyage-code-3",  # Optimized for code and technical content
)

print(f"✅ Created agent '{agent_code.name}' with ID: {agent_code.id}")
print(f"   Embedding model: voyageai/voyage-code-3 (optimized for code)")

# ============================================================================
# Example 4: Contextual Embeddings (voyage-context-3)
# ============================================================================
print("\n\n🧠 Example 4: Creating agent with contextual embeddings")
print("-" * 80)

agent_contextual = client.agents.create(
    name="voyageai_contextual_agent",
    memory_blocks=[
        CreateBlock(
            label="human",
            value="Name: Jordan. Works with large documents and research papers",
        ),
        CreateBlock(
            label="persona",
            value="I am a research assistant that understands document context.",
        ),
    ],
    model="openai/gpt-4o-mini",
    embedding="voyageai/voyage-context-3",  # Contextual embeddings for better document understanding
)

print(f"✅ Created agent '{agent_contextual.name}' with ID: {agent_contextual.id}")
print(f"   Embedding model: voyageai/voyage-context-3 (contextual understanding)")
print(f"   Note: Contextual embeddings understand relationships between document chunks")

# ============================================================================
# Example 5: Multimodal Embeddings (voyage-multimodal-3)
# ============================================================================
print("\n\n🖼️  Example 5: Creating agent with multimodal embeddings")
print("-" * 80)

agent_multimodal = client.agents.create(
    name="voyageai_multimodal_agent",
    memory_blocks=[
        CreateBlock(
            label="human",
            value="Name: Taylor. Works with images and text",
        ),
        CreateBlock(
            label="persona",
            value="I am a multimodal AI assistant that can process both text and images.",
        ),
    ],
    model="openai/gpt-4o-mini",
    embedding="voyageai/voyage-multimodal-3",  # Supports both text and image embeddings
)

print(f"✅ Created agent '{agent_multimodal.name}' with ID: {agent_multimodal.id}")
print(f"   Embedding model: voyageai/voyage-multimodal-3 (text + image support)")
print(f"   Note: Can handle both text and image inputs for embeddings")

# ============================================================================
# Example 6: Finance Domain Embeddings (voyage-finance-2)
# ============================================================================
print("\n\n💰 Example 6: Creating agent with finance-specific embeddings")
print("-" * 80)

agent_finance = client.agents.create(
    name="voyageai_finance_agent",
    memory_blocks=[
        CreateBlock(
            label="human",
            value="Name: Morgan. Financial analyst",
        ),
        CreateBlock(
            label="persona",
            value="I am a financial assistant specialized in market analysis.",
        ),
    ],
    model="openai/gpt-4o-mini",
    embedding="voyageai/voyage-finance-2",  # Optimized for financial content
)

print(f"✅ Created agent '{agent_finance.name}' with ID: {agent_finance.id}")
print(f"   Embedding model: voyageai/voyage-finance-2 (finance domain-specific)")

# ============================================================================
# Summary
# ============================================================================
print("\n\n" + "=" * 80)
print("📊 Summary of VoyageAI Embedding Models")
print("=" * 80)

print("""
General Purpose:
  • voyage-3.5          - High-quality, general-purpose (1024-dim)
  • voyage-3.5-lite     - Lightweight, faster performance (512-dim)
  • voyage-3            - Previous generation (1024-dim)
  • voyage-3-lite       - Previous generation lite (512-dim)

Specialized Models:
  • voyage-context-3    - Contextual embeddings for documents (1024-dim)
  • voyage-multimodal-3   - Text + image support (1024-dim)
  • voyage-multimodal-3.5 - Text + image + video support (1024-dim, preview)
  • voyage-code-3       - Optimized for code (1024-dim)
  • voyage-finance-2    - Financial domain (1024-dim)
  • voyage-law-2        - Legal domain (1024-dim)

For more information: https://docs.voyageai.com/
""")

# ============================================================================
# Cleanup
# ============================================================================
print("\n🧹 Cleaning up created agents...")
print("-" * 80)

agents_to_delete = [
    agent_text,
    agent_lite,
    agent_code,
    agent_contextual,
    agent_multimodal,
    agent_finance,
]

for agent in agents_to_delete:
    try:
        client.agents.delete(agent_id=agent.id)
        print(f"✅ Deleted agent: {agent.name}")
    except Exception as e:
        print(f"⚠️  Failed to delete agent {agent.name}: {e}")


print("\n" + "=" * 80)
print("✨ VoyageAI Embeddings Demo Complete!")
print("=" * 80)
