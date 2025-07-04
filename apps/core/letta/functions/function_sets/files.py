from typing import TYPE_CHECKING, List, Optional

from letta.functions.types import FileOpenRequest

if TYPE_CHECKING:
    from letta.schemas.agent import AgentState
    from letta.schemas.file import FileMetadata


async def open_files(agent_state: "AgentState", file_requests: List[FileOpenRequest], close_all_others: bool = False) -> str:
    """Open one or more files and load their contents into files section in core memory. Maximum of 5 files can be opened simultaneously.

    Use this when you want to:
    - Inspect or reference file contents during reasoning
    - View specific portions of large files (e.g. functions or definitions)
    - Replace currently open files with a new set for focused context (via `close_all_others=True`)

    Examples:
        Open single file belonging to a directory named `project_utils` (entire content):
            file_requests = [FileOpenRequest(file_name="project_utils/config.py")]

        Open multiple files with different view ranges:
            file_requests = [
                FileOpenRequest(file_name="project_utils/config.py", offset=1, length=50),     # Lines 1-50
                FileOpenRequest(file_name="project_utils/main.py", offset=100, length=100),    # Lines 100-199
                FileOpenRequest(file_name="project_utils/utils.py")                            # Entire file
            ]

        Close all other files and open new ones:
            open_files(agent_state, file_requests, close_all_others=True)

    Args:
        file_requests (List[FileOpenRequest]): List of file open requests, each specifying file name and optional view range.
        close_all_others (bool): If True, closes all other currently open files first. Defaults to False.

    Returns:
        str: A status message
    """
    raise NotImplementedError("Tool not implemented. Please contact the Letta team.")


async def grep_files(
    agent_state: "AgentState",
    pattern: str,
    include: Optional[str] = None,
    context_lines: Optional[int] = 3,
) -> str:
    """
    Grep tool to search files across data sources using a keyword or regex pattern.

    Use this when you want to:
    - Quickly find occurrences of a variable, function, or keyword
    - Locate log messages, error codes, or TODOs across files
    - Understand surrounding code by including `context_lines`

    Args:
        pattern (str): Keyword or regex pattern to search within file contents.
        include (Optional[str]): Optional keyword or regex pattern to filter filenames to include in the search.
        context_lines (Optional[int]): Number of lines of context to show before and after each match.
                                       Equivalent to `-C` in grep_files. Defaults to 3.

    Returns:
        str: Matching lines with optional surrounding context or a summary output.
    """
    raise NotImplementedError("Tool not implemented. Please contact the Letta team.")


async def semantic_search_files(agent_state: "AgentState", query: str, limit: int = 5) -> List["FileMetadata"]:
    """
    Get list of most relevant chunks from any file using vector/embedding search.

    Use this when you want to:
    - Find related content that without using exact keywords (e.g., conceptually similar sections)
    - Look up high-level descriptions, documentation, or config patterns
    - Perform fuzzy search when grep isn't sufficient

    Args:
        query (str): The search query.
        limit: Maximum number of results to return (default: 5)

    Returns:
        List[FileMetadata]: List of matching files.
    """
    raise NotImplementedError("Tool not implemented. Please contact the Letta team.")
