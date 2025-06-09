import re
from typing import List, Optional

from letta.log import get_logger
from letta.schemas.file import FileMetadata
from letta.services.file_processor.file_types import ChunkingStrategy, file_type_registry

logger = get_logger(__name__)


class LineChunker:
    """Content-aware line chunker that adapts chunking strategy based on file type"""

    def __init__(self):
        self.file_type_registry = file_type_registry

    def _determine_chunking_strategy(self, file_metadata: FileMetadata) -> ChunkingStrategy:
        """Determine the best chunking strategy based on file metadata"""
        # Try to get strategy from MIME type first
        if file_metadata.file_type:
            try:
                return self.file_type_registry.get_chunking_strategy_by_mime_type(file_metadata.file_type)
            except Exception:
                pass

        # Fallback to filename extension
        if file_metadata.file_name:
            try:
                # Extract extension from filename
                import os

                _, ext = os.path.splitext(file_metadata.file_name)
                if ext:
                    return self.file_type_registry.get_chunking_strategy_by_extension(ext)
            except Exception:
                pass

        # Default fallback
        return ChunkingStrategy.LINE_BASED

    def _chunk_by_lines(self, text: str, preserve_indentation: bool = False) -> List[str]:
        """Traditional line-based chunking for code and structured data"""
        lines = []
        for line in text.splitlines():
            if preserve_indentation:
                # For code: preserve leading whitespace (indentation), remove trailing whitespace
                line = line.rstrip()
                # Only skip completely empty lines
                if line:
                    lines.append(line)
            else:
                # For structured data: strip all whitespace
                line = line.strip()
                if line:
                    lines.append(line)
        return lines

    def _chunk_by_sentences(self, text: str) -> List[str]:
        """Sentence-based chunking for documentation and markup"""
        # Simple sentence splitting on periods, exclamation marks, and question marks
        # followed by whitespace or end of string
        sentence_pattern = r"(?<=[.!?])\s+(?=[A-Z])"

        # Split text into sentences
        sentences = re.split(sentence_pattern, text.strip())

        # Clean up sentences - remove extra whitespace and empty sentences
        cleaned_sentences = []
        for sentence in sentences:
            sentence = re.sub(r"\s+", " ", sentence.strip())  # Normalize whitespace
            if sentence:
                cleaned_sentences.append(sentence)

        return cleaned_sentences

    def _chunk_by_characters(self, text: str, target_line_length: int = 100) -> List[str]:
        """Character-based wrapping for prose text"""
        words = text.split()
        lines = []
        current_line = []
        current_length = 0

        for word in words:
            # Check if adding this word would exceed the target length
            word_length = len(word)
            if current_length + word_length + len(current_line) > target_line_length and current_line:
                # Start a new line
                lines.append(" ".join(current_line))
                current_line = [word]
                current_length = word_length
            else:
                current_line.append(word)
                current_length += word_length

        # Add the last line if there's content
        if current_line:
            lines.append(" ".join(current_line))

        return [line for line in lines if line.strip()]

    def chunk_text(
        self, text: str, file_metadata: FileMetadata, start: Optional[int] = None, end: Optional[int] = None, add_metadata: bool = True
    ) -> List[str]:
        """Content-aware text chunking based on file type"""
        strategy = self._determine_chunking_strategy(file_metadata)

        # Apply the appropriate chunking strategy
        if strategy == ChunkingStrategy.DOCUMENTATION:
            content_lines = self._chunk_by_sentences(text)
        elif strategy == ChunkingStrategy.PROSE:
            content_lines = self._chunk_by_characters(text)
        elif strategy == ChunkingStrategy.CODE:
            content_lines = self._chunk_by_lines(text, preserve_indentation=True)
        else:  # STRUCTURED_DATA or LINE_BASED
            content_lines = self._chunk_by_lines(text, preserve_indentation=False)

        total_chunks = len(content_lines)

        # Handle start/end slicing
        if start is not None and end is not None:
            content_lines = content_lines[start:end]
            line_offset = start
        else:
            line_offset = 0

        # Add line numbers for all strategies
        content_lines = [f"{i + line_offset}: {line}" for i, line in enumerate(content_lines)]

        # Add metadata about total chunks
        if add_metadata:
            chunk_type = (
                "sentences" if strategy == ChunkingStrategy.DOCUMENTATION else "chunks" if strategy == ChunkingStrategy.PROSE else "lines"
            )
            if start is not None and end is not None:
                content_lines.insert(0, f"[Viewing {chunk_type} {start} to {end-1} (out of {total_chunks} {chunk_type})]")
            else:
                content_lines.insert(0, f"[Viewing file start (out of {total_chunks} {chunk_type})]")

        return content_lines
