from typing import List, Optional, Union

from mistralai import OCRPageObject

from letta.log import get_logger
from letta.otel.tracing import trace_method
from letta.services.file_processor.file_types import ChunkingStrategy, file_type_registry

logger = get_logger(__name__)


class LlamaIndexChunker:
    """LlamaIndex-based text chunking with automatic splitter selection"""

    # Conservative default chunk sizes for fallback scenarios
    DEFAULT_CONSERVATIVE_CHUNK_SIZE = 384
    DEFAULT_CONSERVATIVE_CHUNK_OVERLAP = 25

    def __init__(self, chunk_size: int = 512, chunk_overlap: int = 50, file_type: Optional[str] = None):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.file_type = file_type

        # Create appropriate parser based on file type
        self.parser = self._create_parser_for_file_type(file_type, chunk_size, chunk_overlap)

        # Log which parser was selected
        parser_name = type(self.parser).__name__
        logger.info(f"LlamaIndexChunker initialized with {parser_name} for file type: {file_type}")

    def _create_parser_for_file_type(self, file_type: Optional[str], chunk_size: int, chunk_overlap: int):
        """Create appropriate parser based on file type"""
        if not file_type:
            # Default fallback
            from llama_index.core.node_parser import SentenceSplitter

            return SentenceSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)

        try:
            # Get chunking strategy from file type registry
            chunking_strategy = file_type_registry.get_chunking_strategy_by_mime_type(file_type)
            logger.debug(f"Chunking strategy for {file_type}: {chunking_strategy}")

            if chunking_strategy == ChunkingStrategy.CODE:
                from llama_index.core.node_parser import CodeSplitter

                return CodeSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)

            elif chunking_strategy == ChunkingStrategy.DOCUMENTATION:
                if file_type in ["text/markdown", "text/x-markdown"]:
                    from llama_index.core.node_parser import MarkdownNodeParser

                    return MarkdownNodeParser()
                elif file_type in ["text/html"]:
                    from llama_index.core.node_parser import HTMLNodeParser

                    return HTMLNodeParser()
                else:
                    # Fall back to sentence splitter for other documentation
                    from llama_index.core.node_parser import SentenceSplitter

                    return SentenceSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)

            elif chunking_strategy == ChunkingStrategy.STRUCTURED_DATA:
                if file_type in ["application/json", "application/jsonl"]:
                    from llama_index.core.node_parser import JSONNodeParser

                    return JSONNodeParser()
                else:
                    # Fall back to sentence splitter for other structured data
                    from llama_index.core.node_parser import SentenceSplitter

                    return SentenceSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)

            else:
                # Default to sentence splitter for PROSE and LINE_BASED
                from llama_index.core.node_parser import SentenceSplitter

                return SentenceSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)

        except Exception as e:
            logger.warning(f"Failed to create specialized parser for {file_type}: {str(e)}. Using default SentenceSplitter.")
            from llama_index.core.node_parser import SentenceSplitter

            return SentenceSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)

    @trace_method
    def chunk_text(self, content: Union[OCRPageObject, str]) -> List[str]:
        """Chunk text using LlamaIndex splitter"""
        try:
            # Handle different input types
            if isinstance(content, OCRPageObject):
                # Extract markdown from OCR page object
                text_content = content.markdown
            else:
                # Assume it's a string
                text_content = content

            # Use the selected parser
            if hasattr(self.parser, "split_text"):
                # Most parsers have split_text method
                return self.parser.split_text(text_content)
            elif hasattr(self.parser, "get_nodes_from_documents"):
                # Some parsers need Document objects
                from llama_index.core import Document
                from llama_index.core.node_parser import SentenceSplitter

                document = Document(text=text_content)
                nodes = self.parser.get_nodes_from_documents([document])

                # Further split nodes that exceed chunk_size using SentenceSplitter
                final_chunks = []
                sentence_splitter = SentenceSplitter(chunk_size=self.chunk_size, chunk_overlap=self.chunk_overlap)

                for node in nodes:
                    if len(node.text) > self.chunk_size:
                        # Split oversized nodes with sentence splitter
                        sub_chunks = sentence_splitter.split_text(node.text)
                        final_chunks.extend(sub_chunks)
                    else:
                        final_chunks.append(node.text)

                return final_chunks
            else:
                # Fallback - try to call the parser directly
                return self.parser(text_content)

        except Exception as e:
            logger.error(f"Chunking failed with {type(self.parser).__name__}: {str(e)}")
            # Try fallback with SentenceSplitter
            try:
                logger.info("Attempting fallback to SentenceSplitter")
                from llama_index.core.node_parser import SentenceSplitter

                fallback_parser = SentenceSplitter(chunk_size=self.chunk_size, chunk_overlap=self.chunk_overlap)

                # Extract text content if needed
                if isinstance(content, OCRPageObject):
                    text_content = content.markdown
                else:
                    text_content = content

                return fallback_parser.split_text(text_content)
            except Exception as fallback_error:
                logger.error(f"Fallback chunking also failed: {str(fallback_error)}")
                raise e  # Raise the original error

    @trace_method
    def default_chunk_text(self, content: Union[OCRPageObject, str], chunk_size: int = None, chunk_overlap: int = None) -> List[str]:
        """Chunk text using default SentenceSplitter regardless of file type with conservative defaults"""
        try:
            from llama_index.core.node_parser import SentenceSplitter

            # Use provided defaults or fallback to conservative values
            chunk_size = chunk_size if chunk_size is not None else self.DEFAULT_CONSERVATIVE_CHUNK_SIZE
            chunk_overlap = chunk_overlap if chunk_overlap is not None else self.DEFAULT_CONSERVATIVE_CHUNK_OVERLAP
            default_parser = SentenceSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)

            # Handle different input types
            if isinstance(content, OCRPageObject):
                text_content = content.markdown
            else:
                text_content = content

            return default_parser.split_text(text_content)

        except Exception as e:
            logger.error(f"Default chunking failed: {str(e)}")
            raise
