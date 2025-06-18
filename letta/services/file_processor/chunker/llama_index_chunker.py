from typing import List

from mistralai import OCRPageObject

from letta.log import get_logger

logger = get_logger(__name__)


class LlamaIndexChunker:
    """LlamaIndex-based text chunking"""

    def __init__(self, chunk_size: int = 512, chunk_overlap: int = 50):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

        from llama_index.core.node_parser import SentenceSplitter

        self.parser = SentenceSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)

    # TODO: Make this more general beyond Mistral
    def chunk_text(self, page: OCRPageObject) -> List[str]:
        """Chunk text using LlamaIndex splitter"""
        try:
            return self.parser.split_text(page.markdown)

        except Exception as e:
            logger.error(f"Chunking failed: {str(e)}")
            raise
