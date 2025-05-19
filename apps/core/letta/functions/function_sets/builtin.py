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
