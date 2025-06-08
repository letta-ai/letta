"""
Centralized file type configuration for supported file formats.

This module provides a single source of truth for file type definitions,
mime types, and file processing capabilities across the Letta codebase.
"""

import mimetypes
from dataclasses import dataclass
from typing import Dict, Set


@dataclass
class FileTypeInfo:
    """Information about a supported file type."""

    extension: str
    mime_type: str
    is_simple_text: bool
    description: str


class FileTypeRegistry:
    """Central registry for supported file types."""

    def __init__(self):
        """Initialize the registry with default supported file types."""
        self._file_types: Dict[str, FileTypeInfo] = {}
        self._register_default_types()

    def _register_default_types(self) -> None:
        """Register all default supported file types."""
        # Document formats
        self.register(".pdf", "application/pdf", False, "PDF document")
        self.register(".txt", "text/plain", True, "Plain text file")
        self.register(".md", "text/markdown", True, "Markdown document")
        self.register(".markdown", "text/markdown", True, "Markdown document")
        self.register(".json", "application/json", True, "JSON data file")
        self.register(".jsonl", "application/jsonl", True, "JSON Lines file")

        # Programming languages
        self.register(".py", "text/x-python", True, "Python source code")
        self.register(".js", "text/javascript", True, "JavaScript source code")
        self.register(".ts", "text/x-typescript", True, "TypeScript source code")
        self.register(".java", "text/x-java-source", True, "Java source code")
        self.register(".cpp", "text/x-c++", True, "C++ source code")
        self.register(".cxx", "text/x-c++", True, "C++ source code")
        self.register(".c", "text/x-c", True, "C source code")
        self.register(".h", "text/x-c", True, "C/C++ header file")
        self.register(".cs", "text/x-csharp", True, "C# source code")
        self.register(".php", "text/x-php", True, "PHP source code")
        self.register(".rb", "text/x-ruby", True, "Ruby source code")
        self.register(".go", "text/x-go", True, "Go source code")
        self.register(".rs", "text/x-rust", True, "Rust source code")
        self.register(".swift", "text/x-swift", True, "Swift source code")
        self.register(".kt", "text/x-kotlin", True, "Kotlin source code")
        self.register(".scala", "text/x-scala", True, "Scala source code")
        self.register(".r", "text/x-r", True, "R source code")
        self.register(".m", "text/x-objective-c", True, "Objective-C source code")

        # Web technologies
        self.register(".html", "text/html", True, "HTML document")
        self.register(".htm", "text/html", True, "HTML document")
        self.register(".css", "text/css", True, "CSS stylesheet")
        self.register(".scss", "text/x-scss", True, "SCSS stylesheet")
        self.register(".sass", "text/x-sass", True, "Sass stylesheet")
        self.register(".less", "text/x-less", True, "Less stylesheet")
        self.register(".vue", "text/x-vue", True, "Vue.js component")
        self.register(".jsx", "text/x-jsx", True, "JSX source code")
        self.register(".tsx", "text/x-tsx", True, "TSX source code")

        # Configuration and data formats
        self.register(".xml", "application/xml", True, "XML document")
        self.register(".yaml", "text/x-yaml", True, "YAML configuration")
        self.register(".yml", "text/x-yaml", True, "YAML configuration")
        self.register(".toml", "application/toml", True, "TOML configuration")
        self.register(".ini", "text/x-ini", True, "INI configuration")
        self.register(".cfg", "text/x-conf", True, "Configuration file")
        self.register(".conf", "text/x-conf", True, "Configuration file")

        # Scripts and SQL
        self.register(".sh", "text/x-shellscript", True, "Shell script")
        self.register(".bash", "text/x-shellscript", True, "Bash script")
        self.register(".ps1", "text/x-powershell", True, "PowerShell script")
        self.register(".bat", "text/x-batch", True, "Batch script")
        self.register(".cmd", "text/x-batch", True, "Command script")
        self.register(".dockerfile", "text/x-dockerfile", True, "Dockerfile")
        self.register(".sql", "text/x-sql", True, "SQL script")

    def register(self, extension: str, mime_type: str, is_simple_text: bool, description: str) -> None:
        """
        Register a new file type.

        Args:
            extension: File extension (with leading dot, e.g., '.py')
            mime_type: MIME type for the file
            is_simple_text: Whether this is a simple text file that can be read directly
            description: Human-readable description of the file type
        """
        if not extension.startswith("."):
            extension = f".{extension}"

        self._file_types[extension] = FileTypeInfo(
            extension=extension, mime_type=mime_type, is_simple_text=is_simple_text, description=description
        )

    def register_mime_types(self) -> None:
        """Register all file types with Python's mimetypes module."""
        for file_type in self._file_types.values():
            mimetypes.add_type(file_type.mime_type, file_type.extension)

        # Also register some additional MIME type aliases that may be encountered
        mimetypes.add_type("text/x-markdown", ".md")
        mimetypes.add_type("application/x-jsonlines", ".jsonl")
        mimetypes.add_type("text/xml", ".xml")

    def get_allowed_media_types(self) -> Set[str]:
        """
        Get set of all allowed MIME types.

        Returns:
            Set of MIME type strings that are supported for upload
        """
        allowed_types = {file_type.mime_type for file_type in self._file_types.values()}

        # Add additional MIME type aliases
        allowed_types.update(
            {
                "text/x-markdown",  # Alternative markdown MIME type
                "application/x-jsonlines",  # Alternative JSONL MIME type
                "text/xml",  # Alternative XML MIME type
            }
        )

        return allowed_types

    def get_extension_to_mime_type_map(self) -> Dict[str, str]:
        """
        Get mapping from file extensions to MIME types.

        Returns:
            Dictionary mapping extensions (with leading dot) to MIME types
        """
        return {file_type.extension: file_type.mime_type for file_type in self._file_types.values()}

    def get_simple_text_mime_types(self) -> Set[str]:
        """
        Get set of MIME types that represent simple text files.

        Returns:
            Set of MIME type strings for files that can be read as plain text
        """
        return {file_type.mime_type for file_type in self._file_types.values() if file_type.is_simple_text}

    def is_simple_text_mime_type(self, mime_type: str) -> bool:
        """
        Check if a MIME type represents simple text that can be read directly.

        Args:
            mime_type: MIME type to check

        Returns:
            True if the MIME type represents simple text
        """
        # Check if it's in our registered simple text types
        if mime_type in self.get_simple_text_mime_types():
            return True

        # Check for text/* types
        if mime_type.startswith("text/"):
            return True

        # Check for known aliases that represent simple text
        simple_text_aliases = {
            "application/x-jsonlines",  # Alternative JSONL MIME type
            "text/xml",  # Alternative XML MIME type
        }
        return mime_type in simple_text_aliases

    def get_supported_extensions(self) -> Set[str]:
        """
        Get set of all supported file extensions.

        Returns:
            Set of file extensions (with leading dots)
        """
        return set(self._file_types.keys())

    def is_supported_extension(self, extension: str) -> bool:
        """
        Check if a file extension is supported.

        Args:
            extension: File extension (with or without leading dot)

        Returns:
            True if the extension is supported
        """
        if not extension.startswith("."):
            extension = f".{extension}"
        return extension in self._file_types

    def get_file_type_info(self, extension: str) -> FileTypeInfo:
        """
        Get information about a file type by extension.

        Args:
            extension: File extension (with or without leading dot)

        Returns:
            FileTypeInfo object with details about the file type

        Raises:
            KeyError: If the extension is not supported
        """
        if not extension.startswith("."):
            extension = f".{extension}"
        return self._file_types[extension]


# Global registry instance
file_type_registry = FileTypeRegistry()


# Convenience functions for backward compatibility and ease of use
def register_mime_types() -> None:
    """Register all supported file types with Python's mimetypes module."""
    file_type_registry.register_mime_types()


def get_allowed_media_types() -> Set[str]:
    """Get set of all allowed MIME types for file uploads."""
    return file_type_registry.get_allowed_media_types()


def get_extension_to_mime_type_map() -> Dict[str, str]:
    """Get mapping from file extensions to MIME types."""
    return file_type_registry.get_extension_to_mime_type_map()


def get_simple_text_mime_types() -> Set[str]:
    """Get set of MIME types that represent simple text files."""
    return file_type_registry.get_simple_text_mime_types()


def is_simple_text_mime_type(mime_type: str) -> bool:
    """Check if a MIME type represents simple text."""
    return file_type_registry.is_simple_text_mime_type(mime_type)
