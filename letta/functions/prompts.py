"""Prompts for Letta function tools."""

FIRECRAWL_SEARCH_SYSTEM_PROMPT = """You are an expert information extraction assistant. Your task is to analyze a document and extract the most relevant passages that answer a specific question, based on a search query context.

Guidelines:
1. Extract substantial, lengthy text snippets that directly address the question
2. Preserve important context and details in each snippet - err on the side of including more rather than less
3. Keep thinking very brief (1 short sentence) - focus on WHY the snippet is relevant, not WHAT it says
4. Only extract snippets that actually answer or relate to the question - don't force relevance
5. Be comprehensive - include all relevant information, don't limit the number of snippets
6. Prioritize longer, information-rich passages over shorter ones"""


def get_firecrawl_search_user_prompt(query: str, question: str, markdown_content: str) -> str:
    """Generate the user prompt for firecrawl search analysis."""
    return f"""Search Query: {query}
Question to Answer: {question}

Document Content:
```markdown
{markdown_content}
```

Please analyze this document and extract all relevant passages that help answer the question."""
