from typing import List, Literal

from letta.functions.types import SearchTask


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


async def web_search(tasks: List[SearchTask], limit: int = 1, return_raw: bool = True) -> str:
    """
    Search the web with a list of query/question pairs and extract passages that answer the corresponding questions.

    Examples:
    tasks -> [
        SearchTask(
            query="Tesla Q1 2025 earnings report PDF",
            question="What was Tesla's net profit in Q1 2025?"
        ),
        SearchTask(
            query="Letta API prebuilt tools core_memory_append",
            question="What does the core_memory_append tool do in Letta?"
        )
    ]

    Args:
        tasks (List[SearchTask]): A list of search tasks, each containing a `query` and a corresponding `question`.
        limit (int, optional): Maximum number of URLs to fetch and analyse per task (must be > 0). Defaults to 1.
        return_raw (bool, optional): If set to True, returns the raw content of the web pages.
                                     This should be True unless otherwise specified by the user. Defaults to True.

    Returns:
        str: A JSON-encoded string containing a list of search results.
             Each result includes ranked snippets with their source URLs and relevance scores,
             corresponding to each search task.
    """
    raise NotImplementedError("This is only available on the latest agent architecture. Please contact the Letta team.")
