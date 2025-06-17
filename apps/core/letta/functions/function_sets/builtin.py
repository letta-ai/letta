from typing import Literal


async def web_search(query: str) -> str:
    """
    Search the web for information.
    Args:
        query (str): The query to search the web for.
    Returns:
        str: The search results.
    """

    raise NotImplementedError("This is only available on the latest agent architecture. Please contact the Letta team.")


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


async def firecrawl_search(
    query: str,
    question: str,
    limit: int = 5,
    return_raw: bool = False,
) -> str:
    """
    Search the web with the `query` and extract passages that answer the provided `question`.

    Examples:
    query -> "Tesla Q1 2025 earnings report PDF"
    question -> "What was Tesla's net profit in Q1 2025?"

    query -> "Letta API prebuilt tools core_memory_append"
    question -> "What does the core_memory_append tool do in Letta?"

    Args:
        query (str): The raw web-search query.
        question (str): The information goal to answer using the retrieved pages. Consider the context and intent of the conversation so far when forming the question.
        limit (int, optional): Maximum number of URLs to fetch and analyse (must be > 0). Defaults to 5.
        return_raw (bool, optional): If set to True, returns the raw content of the web page. This should be False unless otherwise specified by the user. Defaults to False.

    Returns:
        str: A JSON-encoded string containing ranked snippets with their source
        URLs and relevance scores.
    """
    raise NotImplementedError("This is only available on the latest agent architecture. Please contact the Letta team.")
