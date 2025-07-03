from typing import Optional

from pydantic import BaseModel, Field


class SearchTask(BaseModel):
    query: str = Field(description="Search query for web search")
    question: str = Field(description="Question to answer from search results, considering full conversation context")


class FileOpenRequest(BaseModel):
    file_name: str = Field(description="Name of the file to open")
    offset: Optional[int] = Field(
        default=None, description="Optional starting line number (1-indexed). If not specified, starts from beginning of file."
    )
    length: Optional[int] = Field(
        default=None, description="Optional number of lines to view from offset (inclusive). If not specified, views to end of file."
    )
