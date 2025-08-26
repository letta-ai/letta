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
                FileOpenRequest(file_name="project_utils/config.py", offset=0, length=50),     # Lines 1-50
                FileOpenRequest(file_name="project_utils/main.py", offset=100, length=100),    # Lines 101-200
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
    context_lines: Optional[int] = 1,
    offset: Optional[int] = None,
) -> str:
    """
    Searches file contents for pattern matches with surrounding context.

    Results are paginated - shows 20 matches per call. The response includes:
    - A summary of total matches and which files contain them
    - The current page of matches (20 at a time)
    - Instructions for viewing more matches using the offset parameter

    Example usage:
        First call: grep_files(pattern="TODO")
        Next call: grep_files(pattern="TODO", offset=20)  # Shows matches 21-40

    Returns search results containing:
    - Summary with total match count and file distribution
    - List of files with match counts per file
    - Current page of matches (up to 20)
    - Navigation hint for next page if more matches exist

    Args:
        pattern (str): Keyword or regex pattern to search within file contents.
        include (Optional[str]): Optional keyword or regex pattern to filter filenames to include in the search.
        context_lines (Optional[int]): Number of lines of context to show before and after each match.
                                       Equivalent to `-C` in grep_files. Defaults to 1.
        offset (Optional[int]): Number of matches to skip before showing results. Used for pagination.
                                For example, offset=20 shows matches starting from the 21st match.
                                Use offset=0 (or omit) for first page, offset=20 for second page,
                                offset=40 for third page, etc. The tool will tell you the exact
                                offset to use for the next page.
    """
    raise NotImplementedError("Tool not implemented. Please contact the Letta team.")


async def semantic_search_files(agent_state: "AgentState", query: str, limit: int = 5) -> List["FileMetadata"]:
    """
    Searches file contents using semantic meaning rather than exact matches.

    Ideal for:
    - Finding conceptually related information across files
    - Discovering relevant content without knowing exact keywords
    - Locating files with similar topics or themes

    Args:
        query (str): The search query text to find semantically similar content.
        limit: Maximum number of results to return (default: 5)

    Returns:
        List[FileMetadata]: List of matching files.
    """
    raise NotImplementedError("Tool not implemented. Please contact the Letta team.")
