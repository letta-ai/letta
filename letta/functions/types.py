from pydantic import BaseModel, Field


class SearchTask(BaseModel):
    query: str = Field(description="Search query for web search")
    question: str = Field(description="Question to answer from search results, considering full conversation context")
