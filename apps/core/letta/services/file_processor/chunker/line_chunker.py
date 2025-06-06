from typing import List, Optional

from letta.log import get_logger

logger = get_logger(__name__)


class LineChunker:
    """Newline chunker"""

    def __init__(self):
        pass

    # TODO: Make this more general beyond Mistral
    def chunk_text(self, text: str, start: Optional[int] = None, end: Optional[int] = None) -> List[str]:
        """Split lines"""
        content_lines = [line.strip() for line in text.split("\n") if line.strip()]
        total_lines = len(content_lines)

        if start and end:
            content_lines = content_lines[start:end]
            line_offset = start
        else:
            line_offset = 0

        content_lines = [f"Line {i + line_offset}: {line}" for i, line in enumerate(content_lines)]

        # Add metadata about total lines
        if start and end:
            content_lines.insert(0, f"[Viewing lines {start} to {end} (out of {total_lines} lines)]")
        else:
            content_lines.insert(0, f"[Viewing file start (out of {total_lines} lines)]")

        return content_lines
