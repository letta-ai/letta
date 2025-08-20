from typing import Literal, Optional

from pydantic import BaseModel, Field

from letta.constants import DEFAULT_EMBEDDING_CHUNK_SIZE


class EmbeddingConfig(BaseModel):
    """Configuration for embedding model connection and processing parameters."""

    embedding_endpoint_type: Literal[
        "openai",
        "anthropic",
        "bedrock",
        "google_ai",
        "google_vertex",
        "azure",
        "groq",
        "ollama",
        "webui",
        "webui-legacy",
        "lmstudio",
        "lmstudio-legacy",
        "llamacpp",
        "koboldcpp",
        "vllm",
        "hugging-face",
        "mistral",
        "together",  # completions endpoint
        "pinecone",
    ] = Field(..., description="The endpoint type for the model.")
    embedding_endpoint: Optional[str] = Field(None, description="The endpoint for the model (`None` if local).")
    embedding_model: str = Field(..., description="The model for the embedding.")
    embedding_dim: int = Field(..., description="The dimension of the embedding.")
    embedding_chunk_size: Optional[int] = Field(300, description="The chunk size of the embedding.")
    handle: Optional[str] = Field(None, description="The handle for this config, in the format provider/model-name.")
    batch_size: int = Field(32, description="The maximum batch size for processing embeddings.")

    # azure only
    azure_endpoint: Optional[str] = Field(None, description="The Azure endpoint for the model.")
    azure_version: Optional[str] = Field(None, description="The Azure version for the model.")
    azure_deployment: Optional[str] = Field(None, description="The Azure deployment for the model.")

    @classmethod
    def default_config(cls, model_name: Optional[str] = None, provider: Optional[str] = None):

        if model_name == "text-embedding-ada-002" and provider == "openai":
            return cls(
                embedding_model="text-embedding-ada-002",
                embedding_endpoint_type="openai",
                embedding_endpoint="https://api.openai.com/v1",
                embedding_dim=1536,
                embedding_chunk_size=DEFAULT_EMBEDDING_CHUNK_SIZE,
            )
        if (model_name == "text-embedding-3-small" and provider == "openai") or (not model_name and provider == "openai"):
            return cls(
                embedding_model="text-embedding-3-small",
                embedding_endpoint_type="openai",
                embedding_endpoint="https://api.openai.com/v1",
                embedding_dim=2000,
                embedding_chunk_size=DEFAULT_EMBEDDING_CHUNK_SIZE,
            )
        elif model_name == "letta":
            return cls(
                embedding_endpoint="https://embeddings.letta.com/",
                embedding_model="letta-free",
                embedding_dim=1536,
                embedding_chunk_size=DEFAULT_EMBEDDING_CHUNK_SIZE,
                embedding_endpoint_type="openai",
            )
        elif provider == "pinecone":
            # default config for pinecone with empty endpoint
            return cls(
                embedding_endpoint=None,
                embedding_model="llama-text-embed-v2",
                embedding_dim=1536,  # assuming default openai dimension
                embedding_chunk_size=DEFAULT_EMBEDDING_CHUNK_SIZE,
                embedding_endpoint_type="pinecone",
            )
        else:
            raise ValueError(f"Model {model_name} not supported.")

    def pretty_print(self) -> str:
        return (
            f"{self.embedding_model}"
            + (f" [type={self.embedding_endpoint_type}]" if self.embedding_endpoint_type else "")
            + (f" [ip={self.embedding_endpoint}]" if self.embedding_endpoint else "")
        )
