from typing import List, Tuple

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


class MarkdownChunker:
    """Markdown-specific chunker that preserves line numbers for citation purposes"""

    def __init__(self, chunk_size: int = 2048):
        self.chunk_size = chunk_size
        # No overlap for line-based citations to avoid ambiguity

        from llama_index.core.node_parser import MarkdownNodeParser

        self.parser = MarkdownNodeParser()

    def chunk_markdown_with_line_numbers(self, markdown_content: str) -> List[Tuple[str, int, int]]:
        """
        Chunk markdown content while preserving line number mappings.

        Returns:
            List of tuples: (chunk_text, start_line, end_line)
        """
        try:
            # Split content into lines for line number tracking
            lines = markdown_content.split("\n")

            # Create nodes using MarkdownNodeParser
            from llama_index.core import Document

            document = Document(text=markdown_content)
            nodes = self.parser.get_nodes_from_documents([document])

            chunks_with_line_numbers = []

            for node in nodes:
                chunk_text = node.text

                # Find the line numbers for this chunk
                start_line, end_line = self._find_line_numbers(chunk_text, lines)

                chunks_with_line_numbers.append((chunk_text, start_line, end_line))

            return chunks_with_line_numbers

        except Exception as e:
            logger.error(f"Markdown chunking failed: {str(e)}")
            # Fallback to simple line-based chunking
            return self._fallback_line_chunking(markdown_content)

    def _find_line_numbers(self, chunk_text: str, lines: List[str]) -> Tuple[int, int]:
        """Find the start and end line numbers for a given chunk of text."""
        chunk_lines = chunk_text.split("\n")

        # Find the first line of the chunk in the original document
        start_line = 1
        for i, line in enumerate(lines):
            if chunk_lines[0].strip() in line.strip() and len(chunk_lines[0].strip()) > 10:  # Avoid matching short lines
                start_line = i + 1
                break

        # Calculate end line
        end_line = start_line + len(chunk_lines) - 1

        return start_line, min(end_line, len(lines))

    def _fallback_line_chunking(self, markdown_content: str) -> List[Tuple[str, int, int]]:
        """Fallback chunking method that simply splits by lines with no overlap."""
        lines = markdown_content.split("\n")
        chunks = []

        i = 0
        while i < len(lines):
            chunk_lines = []
            start_line = i + 1
            char_count = 0

            # Build chunk until we hit size limit
            while i < len(lines) and char_count < self.chunk_size:
                line = lines[i]
                chunk_lines.append(line)
                char_count += len(line) + 1  # +1 for newline
                i += 1

            end_line = i
            chunk_text = "\n".join(chunk_lines)
            chunks.append((chunk_text, start_line, end_line))

            # No overlap - continue from where we left off

        return chunks
