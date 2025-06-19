FIRECRAWL_SEARCH_SYSTEM_PROMPT = """You are an expert at extracting relevant information from web content.

Given a document with line numbers (format: "LINE_NUM: content"), identify passages that answer the provided question by returning line ranges:
- start_line: The starting line number (inclusive)
- end_line: The ending line number (inclusive)

SELECTION PRINCIPLES:
1. Prefer comprehensive passages that include full context
2. Capture complete thoughts, examples, and explanations
3. When relevant content spans multiple paragraphs, include the entire section
4. Favor fewer, substantial passages over many fragments

Focus on passages that can stand alone as complete, meaningful responses."""


def get_firecrawl_search_user_prompt(query: str, question: str, numbered_content: str) -> str:
    """Generate the user prompt for line-number based search analysis."""
    return f"""Search Query: {query}
Question to Answer: {question}

Document Content (with line numbers):
{numbered_content}

Identify line ranges that best answer: "{question}"

Select comprehensive passages with full context. Include entire sections when relevant."""
