from letta_client import Letta

client = Letta(base_url="http://localhost:8283")

# list available models
models = client.models.list_llms()
for model in models:
    print(f"Provider {model.model_endpoint_type} model {model.model}: {model.handle}")

# list available embedding models
embedding_models = client.models.list_embedding_models()
for model in embedding_models:
    print(f"Provider {model.handle}")

# openai
openai_agent = client.agents.create(
    model="openai/gpt-4o-mini",
    embedding="openai/text-embedding-3-small",
    # optional configuration
    context_window_limit=16000,
    embedding_chunk_size=300,
)

# Azure OpenAI
azure_openai_agent = client.agents.create(
    model="azure/gpt-4o-mini",
    embedding="azure/text-embedding-3-small",
    # optional configuration
    context_window_limit=16000,
    embedding_chunk_size=300,
)

# anthropic
anthropic_agent = client.agents.create(
    model="anthropic/claude-3-5-sonnet-20241022",
    # note: anthropic does not support embeddings so you will need another provider
    embedding="openai/text-embedding-3-small",
    # optional configuration
    context_window_limit=16000,
    embedding_chunk_size=300,
)

# Groq
groq_agent = client.agents.create(
    model="groq/llama-3.3-70b-versatile",
    # note: groq does not support embeddings so you will need another provider
    embedding="openai/text-embedding-3-small",
    # optional configuration
    context_window_limit=16000,
    embedding_chunk_size=300,
)

# Ollama
ollama_agent = client.agents.create(
    model="ollama/thewindmom/hermes-3-llama-3.1-8b:latest",
    embedding="ollama/mxbai-embed-large:latest",
    # optional configuration
    context_window_limit=16000,
    embedding_chunk_size=300,
)
