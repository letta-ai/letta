"""Pydantic schemas for git-based memory repositories.

These are used internally by the git-backed block/memory repository services.

Note: REST "sync" request/response schemas were removed when we switched to
clients interacting with repositories directly via git smart HTTP.
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import Field

from letta.schemas.letta_base import LettaBase


class MemoryCommit(LettaBase):
    """Represents a commit in the memory repository."""

    __id_prefix__ = "memcommit"

    sha: str = Field(..., description="Commit SHA (40-char hex).")
    parent_sha: Optional[str] = Field(None, description="Parent commit SHA.")
    message: str = Field(..., description="Commit message.")

    author_type: str = Field(..., description="Author type: agent, user, system.")
    author_id: str = Field(..., description="Author ID.")
    author_name: Optional[str] = Field(None, description="Human-readable author name.")

    timestamp: datetime = Field(..., description="Commit timestamp.")

    files_changed: List[str] = Field(default_factory=list, description="List of changed file paths.")
    additions: int = Field(default=0, description="Number of lines/chars added.")
    deletions: int = Field(default=0, description="Number of lines/chars deleted.")


class FileChange(LettaBase):
    """Represents a file change for committing."""

    path: str = Field(..., description="File path within repository.")
    content: Optional[str] = Field(None, description="New file content (None for delete).")
    change_type: str = Field(default="modify", description="Change type: add, modify, delete.")
