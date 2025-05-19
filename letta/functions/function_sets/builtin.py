from typing import Literal


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
