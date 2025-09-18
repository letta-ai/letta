from abc import ABC, abstractmethod
from typing import List

from letta.log import get_logger
from letta.schemas.enums import VectorDBProvider
from letta.schemas.passage import Passage
from letta.schemas.user import User

logger = get_logger(__name__)


class BaseEmbedder(ABC):
    """Abstract base class for embedding generation"""

    def __init__(self):
        # Default to NATIVE, subclasses will override this
        self.vector_db_type = VectorDBProvider.NATIVE

    @abstractmethod
    async def generate_embedded_passages(self, file_id: str, source_id: str, chunks: List[str], actor: User) -> List[Passage]:
        """Generate embeddings for chunks with batching and concurrent processing"""
