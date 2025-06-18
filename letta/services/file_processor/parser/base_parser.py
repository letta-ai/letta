from abc import ABC, abstractmethod


class FileParser(ABC):
    """Abstract base class for file parser"""

    @abstractmethod
    async def extract_text(self, content: bytes, mime_type: str):
        """Extract text from PDF content"""
