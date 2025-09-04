from typing import List, Literal, Optional


def run_code(code: str, language: Literal["python", "js", "ts", "r", "java"]) -> str:
    """
    Run code in a sandbox. Supports Python, Javascript, Typescript, R, and Java.

    Args:
        code (str): The code to run.
        language (Literal["python", "js", "ts", "r", "java"]): The language of the code.
    Returns:
        str: The output of the code, the stdout, the stderr, and error traces (if any).
    """

    raise NotImplementedError("This is only available on the latest agent architecture. Please contact the Letta team.")


async def web_search(
    query: str,
    num_results: int = 10,
    category: Optional[
        Literal["company", "research paper", "news", "pdf", "github", "tweet", "personal site", "linkedin profile", "financial report"]
    ] = None,
    include_text: bool = False,
    include_domains: Optional[List[str]] = None,
    exclude_domains: Optional[List[str]] = None,
    start_published_date: Optional[str] = None,
    end_published_date: Optional[str] = None,
    user_location: Optional[str] = None,
) -> str:
    """
    Search the web using Exa's AI-powered search engine and retrieve relevant content.

    Examples:
    web_search("Tesla Q1 2025 earnings report", num_results=5, category="financial report")
    web_search("Latest research in large language models", category="research paper", include_domains=["arxiv.org", "paperswithcode.com"])
    web_search("Letta API documentation core_memory_append", num_results=3)

    Args:
        query (str): The search query to find relevant web content.
        num_results (int, optional): Number of results to return (1-100). Defaults to 10.
        category (Optional[Literal], optional): Focus search on specific content types. Defaults to None.
        include_text (bool, optional): Whether to retrieve full page content. Defaults to False (only returns summary and highlights, since the full text usually will overflow the context window).
        include_domains (Optional[List[str]], optional): List of domains to include in search results. Defaults to None.
        exclude_domains (Optional[List[str]], optional): List of domains to exclude from search results. Defaults to None.
        start_published_date (Optional[str], optional): Only return content published after this date (ISO format). Defaults to None.
        end_published_date (Optional[str], optional): Only return content published before this date (ISO format). Defaults to None.
        user_location (Optional[str], optional): Two-letter country code for localized results (e.g., "US"). Defaults to None.

    Returns:
        str: A JSON-encoded string containing search results with title, URL, content, highlights, and summary.
    """
    raise NotImplementedError("This is only available on the latest agent architecture. Please contact the Letta team.")


async def fetch_webpage(url: str) -> str:
    """
    Fetch a webpage and convert it to markdown/text format using Jina AI reader.

    Args:
        url: The URL of the webpage to fetch and convert

    Returns:
        String containing the webpage content in markdown/text format
    """
    raise NotImplementedError("This is only available on the latest agent architecture. Please contact the Letta team.")
