from typing import TYPE_CHECKING, Any, List, Literal, Optional

from letta.constants import CORE_MEMORY_LINE_NUMBER_WARNING

if TYPE_CHECKING:
    from letta.schemas.agent import AgentState


def memory(
    agent_state: "AgentState",
    command: str,
    path: Optional[str] = None,
    file_text: Optional[str] = None,
    description: Optional[str] = None,
    old_str: Optional[str] = None,
    new_str: Optional[str] = None,
    insert_line: Optional[int] = None,
    insert_text: Optional[str] = None,
    old_path: Optional[str] = None,
    new_path: Optional[str] = None,
) -> Optional[str]:
    """
    Memory management tool with various sub-commands for memory block operations.

    Args:
        command (str): The sub-command to execute. Supported commands:
            - "create": Create a new memory block
            - "str_replace": Replace text in a memory block
            - "insert": Insert text at a specific line in a memory block
            - "delete": Delete a memory block
            - "rename": Rename a memory block
        path (Optional[str]): Path to the memory block (for str_replace, insert, delete)
        file_text (Optional[str]): The value to set in the memory block (for create)
        description (Optional[str]): The description to set in the memory block (for create, rename)
        old_str (Optional[str]): Old text to replace (for str_replace)
        new_str (Optional[str]): New text to replace with (for str_replace)
        insert_line (Optional[int]): Line number to insert at (for insert)
        insert_text (Optional[str]): Text to insert (for insert)
        old_path (Optional[str]): Old path for rename operation
        new_path (Optional[str]): New path for rename operation

    Returns:
        Optional[str]: Success message or error description

    Examples:
        # Replace text in a memory block
        memory(agent_state, "str_replace", path="/memories/user_preferences", old_str="theme: dark", new_str="theme: light")

        # Insert text at line 5
        memory(agent_state, "insert", path="/memories/notes", insert_line=5, insert_text="New note here")

        # Delete a memory block
        memory(agent_state, "delete", path="/memories/old_notes")

        # Rename a memory block
        memory(agent_state, "rename", old_path="/memories/temp", new_path="/memories/permanent")

        # Update the description of a memory block
        memory(agent_state, "rename", path="/memories/temp", description="The user's temporary notes.")

        # Create a memory block with starting text
        memory(agent_state, "create", path="/memories/coding_preferences", "description": "The user's coding preferences.", "file_text": "The user seems to add type hints to all of their Python code.")

        # Create an empty memory block
        memory(agent_state, "create", path="/memories/coding_preferences", "description": "The user's coding preferences.")
    """
    raise NotImplementedError("This should never be invoked directly. Contact Letta if you see this error message.")


def send_message(self: "Agent", message: str) -> Optional[str]:
    """
    Sends a message to the human user.

    Args:
        message (str): Message contents. All unicode (including emojis) are supported.

    Returns:
        Optional[str]: None is always returned as this function does not produce a response.
    """
    # FIXME passing of msg_obj here is a hack, unclear if guaranteed to be the correct reference
    if self.interface:
        self.interface.assistant_message(message)  # , msg_obj=self._messages[-1])
    return None


def conversation_search(
    self: "Agent",
    query: str,
    roles: Optional[List[Literal["assistant", "user", "tool"]]] = None,
    limit: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> Optional[str]:
    """
    Search prior conversation history using hybrid search (text + semantic similarity).

    Args:
        query (str): String to search for using both text matching and semantic similarity.
        roles (Optional[List[Literal["assistant", "user", "tool"]]]): Optional list of message roles to filter by.
        limit (Optional[int]): Maximum number of results to return. Uses system default if not specified.
        start_date (Optional[str]): Filter results to messages created on or after this date (INCLUSIVE). When using date-only format (e.g., "2024-01-15"), includes messages starting from 00:00:00 of that day. ISO 8601 format: "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM". Examples: "2024-01-15" (from start of Jan 15), "2024-01-15T14:30" (from 2:30 PM on Jan 15).
        end_date (Optional[str]): Filter results to messages created on or before this date (INCLUSIVE). When using date-only format (e.g., "2024-01-20"), includes all messages from that entire day. ISO 8601 format: "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM". Examples: "2024-01-20" (includes all of Jan 20), "2024-01-20T17:00" (up to 5 PM on Jan 20).

    Examples:
        # Search all messages
        conversation_search(query="project updates")

        # Search only assistant messages
        conversation_search(query="error handling", roles=["assistant"])

        # Search with date range (inclusive of both dates)
        conversation_search(query="meetings", start_date="2024-01-15", end_date="2024-01-20")
        # This includes all messages from Jan 15 00:00:00 through Jan 20 23:59:59

        # Search messages from a specific day (inclusive)
        conversation_search(query="bug reports", start_date="2024-09-04", end_date="2024-09-04")
        # This includes ALL messages from September 4, 2024

        # Search with specific time boundaries
        conversation_search(query="deployment", start_date="2024-01-15T09:00", end_date="2024-01-15T17:30")
        # This includes messages from 9 AM to 5:30 PM on Jan 15

        # Search with limit
        conversation_search(query="debugging", limit=10)

    Returns:
        str: Query result string containing matching messages with timestamps and content.
    """

    from letta.constants import RETRIEVAL_QUERY_DEFAULT_PAGE_SIZE
    from letta.helpers.json_helpers import json_dumps

    # Use provided limit or default
    if limit is None:
        limit = RETRIEVAL_QUERY_DEFAULT_PAGE_SIZE

    messages = self.message_manager.list_messages_for_agent(
        agent_id=self.agent_state.id,
        actor=self.user,
        query_text=query,
        roles=roles,
        limit=limit,
    )

    if len(messages) == 0:
        results_str = "No results found."
    else:
        results_pref = f"Found {len(messages)} results:"
        results_formatted = []
        for message in messages:
            # Extract text content from message
            text_content = message.content[0].text if message.content else ""
            result_entry = {"role": message.role, "content": text_content}
            results_formatted.append(result_entry)
        results_str = f"{results_pref} {json_dumps(results_formatted)}"
    return results_str


async def archival_memory_insert(self: "Agent", content: str, tags: Optional[list[str]] = None) -> Optional[str]:
    """
    Add information to long-term archival memory for later retrieval.

    Use this tool to store facts, knowledge, or context that you want to remember
    across all future conversations. Archival memory is permanent and searchable by
    semantic similarity.

    Best practices:
    - Store self-contained facts or summaries, not conversational fragments
    - Add descriptive tags to make information easier to find later
    - Use for: meeting notes, project updates, conversation summaries, events, reports
    - Information stored here persists indefinitely and can be searched semantically

    Args:
        content: The information to store. Should be clear and self-contained.
        tags: Optional list of category tags (e.g., ["meetings", "project-updates"])

    Returns:
        Confirmation message with the ID of the inserted memory.

    Examples:
        archival_memory_insert(
            content="Meeting on 2024-03-15: Discussed Q2 roadmap priorities. Decided to focus on performance optimization and API v2 release. John will lead the optimization effort.",
            tags=["meetings", "roadmap", "q2-2024"]
        )
    """
    raise NotImplementedError("This should never be invoked directly. Contact Letta if you see this error message.")


async def archival_memory_search(
    self: "Agent",
    query: str,
    tags: Optional[list[str]] = None,
    tag_match_mode: Literal["any", "all"] = "any",
    top_k: Optional[int] = None,
    start_datetime: Optional[str] = None,
    end_datetime: Optional[str] = None,
) -> Optional[str]:
    """
    Search archival memory using semantic similarity to find relevant information.

    This tool searches your long-term memory storage by meaning, not exact keyword
    matching. Use it when you need to recall information from past conversations or
    knowledge you've stored.

    Search strategy:
    - Query by concept/meaning, not exact phrases
    - Use tags to narrow results when you know the category
    - Start broad, then narrow with tags if needed
    - Results are ranked by semantic relevance

    Args:
        query: What you're looking for, described naturally (e.g., "meetings about API redesign")
        tags: Filter to memories with these tags. Use tag_match_mode to control matching.
        tag_match_mode: "any" = match memories with ANY of the tags, "all" = match only memories with ALL tags
        start_datetime: Only return memories created after this time (ISO 8601: "2024-01-15" or "2024-01-15T14:30")
        end_datetime: Only return memories created before this time (ISO 8601 format)
        top_k: Maximum number of results to return (default: 10)

    Returns:
        A list of relevant memories with timestamps and content, ranked by similarity.

    Examples:
        # Search for project discussions
        archival_memory_search(
            query="database migration decisions and timeline",
            tags=["projects"]
        )

        # Search meeting notes from Q1
        archival_memory_search(
            query="roadmap planning discussions",
            start_datetime="2024-01-01",
            end_datetime="2024-03-31",
            tags=["meetings", "roadmap"],
            tag_match_mode="all"
        )
    """
    raise NotImplementedError("This should never be invoked directly. Contact Letta if you see this error message.")


def core_memory_append(agent_state: "AgentState", label: str, content: str) -> Optional[str]:  # type: ignore
    """
    Append to the contents of core memory.

    Args:
        label (str): Section of the memory to be edited.
        content (str): Content to write to the memory. All unicode (including emojis) are supported.

    Returns:
        Optional[str]: None is always returned as this function does not produce a response.
    """
    current_value = str(agent_state.memory.get_block(label).value)
    new_value = current_value + "\n" + str(content)
    agent_state.memory.update_block_value(label=label, value=new_value)
    return None


def core_memory_replace(agent_state: "AgentState", label: str, old_content: str, new_content: str) -> Optional[str]:  # type: ignore
    """
    Replace the contents of core memory. To delete memories, use an empty string for new_content.

    Args:
        label (str): Section of the memory to be edited.
        old_content (str): String to replace. Must be an exact match.
        new_content (str): Content to write to the memory. All unicode (including emojis) are supported.

    Returns:
        Optional[str]: None is always returned as this function does not produce a response.
    """
    current_value = str(agent_state.memory.get_block(label).value)
    if old_content not in current_value:
        raise ValueError(f"Old content '{old_content}' not found in memory block '{label}'")
    new_value = current_value.replace(str(old_content), str(new_content))
    agent_state.memory.update_block_value(label=label, value=new_value)
    return None


def rethink_memory(agent_state: "AgentState", new_memory: str, target_block_label: str) -> None:
    """
    Rewrite memory block for the main agent, new_memory should contain all current information from the block that is not outdated or inconsistent, integrating any new information, resulting in a new memory block that is organized, readable, and comprehensive.

    Args:
        new_memory (str): The new memory with information integrated from the memory block. If there is no new information, then this should be the same as the content in the source block.
        target_block_label (str): The name of the block to write to.

    Returns:
        None: None is always returned as this function does not produce a response.
    """

    if agent_state.memory.get_block(target_block_label) is None:
        from letta.schemas.block import Block

        new_block = Block(label=target_block_label, value=new_memory)
        agent_state.memory.set_block(new_block)

    agent_state.memory.update_block_value(label=target_block_label, value=new_memory)
    return None


## Attempted v2 of sleep-time function set, meant to work better across all types

SNIPPET_LINES: int = 4


# Based off of: https://github.com/anthropics/anthropic-quickstarts/blob/main/computer-use-demo/computer_use_demo/tools/edit.py?ref=musings.yasyf.com#L154
def memory_replace(agent_state: "AgentState", label: str, old_str: str, new_str: str) -> str:  # type: ignore
    """
    The memory_replace command allows you to replace a specific string in a memory block with a new string. This is used for making precise edits.
    Do NOT attempt to replace long strings, e.g. do not attempt to replace the entire contents of a memory block with a new string.

    Args:
        label (str): Section of the memory to be edited, identified by its label.
        old_str (str): The text to replace (must match exactly, including whitespace and indentation).
        new_str (str): The new text to insert in place of the old text. Do not include line number prefixes.

    Examples:
        # Update a block containing information about the user
        memory_replace(label="human", old_str="Their name is Alice", new_str="Their name is Bob")

        # Update a block containing a todo list
        memory_replace(label="todos", old_str="- [ ] Step 5: Search the web", new_str="- [x] Step 5: Search the web")

        # Pass an empty string to
        memory_replace(label="human", old_str="Their name is Alice", new_str="")

        # Bad example - do NOT add (view-only) line numbers to the args
        memory_replace(label="human", old_str="1: Their name is Alice", new_str="1: Their name is Bob")

        # Bad example - do NOT include the line number warning either
        memory_replace(label="human", old_str="# NOTE: Line numbers shown below (with arrows like '1→') are to help during editing. Do NOT include line number prefixes in your memory edit tool calls.\\n1→ Their name is Alice", new_str="1→ Their name is Bob")

        # Good example - no line numbers or line number warning (they are view-only), just the text
        memory_replace(label="human", old_str="Their name is Alice", new_str="Their name is Bob")

    Returns:
        str: The success message
    """
    import re

    if bool(re.search(r"\nLine \d+: ", old_str)):
        raise ValueError(
            "old_str contains a line number prefix, which is not allowed. Do not include line numbers when calling memory tools (line numbers are for display purposes only)."
        )
    if CORE_MEMORY_LINE_NUMBER_WARNING in old_str:
        raise ValueError(
            "old_str contains a line number warning, which is not allowed. Do not include line number information when calling memory tools (line numbers are for display purposes only)."
        )
    if bool(re.search(r"\nLine \d+: ", new_str)):
        raise ValueError(
            "new_str contains a line number prefix, which is not allowed. Do not include line numbers when calling memory tools (line numbers are for display purposes only)."
        )

    old_str = str(old_str).expandtabs()
    new_str = str(new_str).expandtabs()
    current_value = str(agent_state.memory.get_block(label).value).expandtabs()

    # Check if old_str is unique in the block
    occurences = current_value.count(old_str)
    if occurences == 0:
        raise ValueError(f"No replacement was performed, old_str `{old_str}` did not appear verbatim in memory block with label `{label}`.")
    elif occurences > 1:
        content_value_lines = current_value.split("\n")
        lines = [idx + 1 for idx, line in enumerate(content_value_lines) if old_str in line]
        raise ValueError(
            f"No replacement was performed. Multiple occurrences of old_str `{old_str}` in lines {lines}. Please ensure it is unique."
        )

    # Replace old_str with new_str
    new_value = current_value.replace(str(old_str), str(new_str))

    # Write the new content to the block
    agent_state.memory.update_block_value(label=label, value=new_value)

    # Create a snippet of the edited section
    # SNIPPET_LINES = 3
    # replacement_line = current_value.split(old_str)[0].count("\n")
    # start_line = max(0, replacement_line - SNIPPET_LINES)
    # end_line = replacement_line + SNIPPET_LINES + new_str.count("\n")
    # snippet = "\n".join(new_value.split("\n")[start_line : end_line + 1])

    # Prepare the success message
    success_msg = f"The core memory block with label `{label}` has been edited. "
    # success_msg += self._make_output(
    #     snippet, f"a snippet of {path}", start_line + 1
    # )
    # success_msg += f"A snippet of core memory block `{label}`:\n{snippet}\n"
    success_msg += "Review the changes and make sure they are as expected (correct indentation, no duplicate lines, etc). Edit the memory block again if necessary."

    # return None
    return success_msg


def memory_insert(agent_state: "AgentState", label: str, new_str: str, insert_line: int = -1) -> Optional[str]:  # type: ignore
    """
    The memory_insert command allows you to insert text at a specific location in a memory block.

    Args:
        label (str): Section of the memory to be edited, identified by its label.
        new_str (str): The text to insert. Do not include line number prefixes.
        insert_line (int): The line number after which to insert the text (0 for beginning of file). Defaults to -1 (end of the file).

    Examples:
        # Update a block containing information about the user (append to the end of the block)
        memory_insert(label="customer", new_str="The customer's ticket number is 12345")

        # Update a block containing information about the user (insert at the beginning of the block)
        memory_insert(label="customer", new_str="The customer's ticket number is 12345", insert_line=0)

    Returns:
        Optional[str]: None is always returned as this function does not produce a response.
    """
    import re

    if bool(re.search(r"\nLine \d+: ", new_str)):
        raise ValueError(
            "new_str contains a line number prefix, which is not allowed. Do not include line numbers when calling memory tools (line numbers are for display purposes only)."
        )
    if CORE_MEMORY_LINE_NUMBER_WARNING in new_str:
        raise ValueError(
            "new_str contains a line number warning, which is not allowed. Do not include line number information when calling memory tools (line numbers are for display purposes only)."
        )

    current_value = str(agent_state.memory.get_block(label).value).expandtabs()
    new_str = str(new_str).expandtabs()
    current_value_lines = current_value.split("\n")
    n_lines = len(current_value_lines)

    # Check if we're in range, from 0 (pre-line), to 1 (first line), to n_lines (last line)
    if insert_line == -1:
        insert_line = n_lines
    elif insert_line < 0 or insert_line > n_lines:
        raise ValueError(
            f"Invalid `insert_line` parameter: {insert_line}. It should be within the range of lines of the memory block: {[0, n_lines]}, or -1 to append to the end of the memory block."
        )

    # Insert the new string as a line
    new_str_lines = new_str.split("\n")
    new_value_lines = current_value_lines[:insert_line] + new_str_lines + current_value_lines[insert_line:]
    snippet_lines = (
        current_value_lines[max(0, insert_line - SNIPPET_LINES) : insert_line]
        + new_str_lines
        + current_value_lines[insert_line : insert_line + SNIPPET_LINES]
    )

    # Collate into the new value to update
    new_value = "\n".join(new_value_lines)
    # snippet = "\n".join(snippet_lines)

    # Write into the block
    agent_state.memory.update_block_value(label=label, value=new_value)

    # Prepare the success message
    success_msg = f"The core memory block with label `{label}` has been edited. "
    # success_msg += self._make_output(
    #     snippet,
    #     "a snippet of the edited file",
    #     max(1, insert_line - SNIPPET_LINES + 1),
    # )
    # success_msg += f"A snippet of core memory block `{label}`:\n{snippet}\n"
    success_msg += "Review the changes and make sure they are as expected (correct indentation, no duplicate lines, etc). Edit the memory block again if necessary."

    return success_msg


def memory_apply_patch(agent_state: "AgentState", label: str, patch: str) -> str:  # type: ignore
    """
    Apply a unified-diff style patch to a memory block by anchoring on content and context (not line numbers).

    The patch format is a simplified unified diff that supports one or more hunks. Each hunk may optionally
    start with a line beginning with `@@` and then contains lines that begin with one of:
    - " " (space): context lines that must match the current memory content
    - "-": lines to remove (must match exactly in the current content)
    - "+": lines to add

    Notes:
    - Do not include line number prefixes like "Line 12:" anywhere in the patch. Line numbers are for display only.
    - Do not include the line-number warning banner. Provide only the text to edit.
    - Tabs are normalized to spaces for matching consistency.

    Args:
        label (str): The memory block to edit, identified by its label.
        patch (str): The simplified unified-diff patch text composed of context (" "), deletion ("-"), and addition ("+") lines. Optional
            lines beginning with "@@" can be used to delimit hunks. Do not include visual line numbers or warning banners.

    Examples:
        Simple replacement:
            label="human",
            patch:
                @@
                -Their name is Alice
                +Their name is Bob

        Replacement with surrounding context for disambiguation:
            label="persona",
            patch:
                @@
                 Persona:
                -Friendly and curious
                +Friendly, curious, and precise
                 Likes: Hiking

        Insertion (no deletions) between two context lines:
            label="todos",
            patch:
                @@
                 - [ ] Step 1: Gather requirements
                 + [ ] Step 1.5: Clarify stakeholders
                 - [ ] Step 2: Draft design

    Returns:
        str: A success message if the patch applied cleanly; raises ValueError otherwise.
    """
    raise NotImplementedError("This should never be invoked directly. Contact Letta if you see this error message.")


def memory_rethink(agent_state: "AgentState", label: str, new_memory: str) -> None:
    """
    The memory_rethink command allows you to completely rewrite the contents of a memory block. Use this tool to make large sweeping changes (e.g. when you want to condense or reorganize the memory blocks), do NOT use this tool to make small precise edits (e.g. add or remove a line, replace a specific string, etc).

    Args:
        label (str): The memory block to be rewritten, identified by its label.
        new_memory (str): The new memory contents with information integrated from existing memory blocks and the conversation context.

    Returns:
        None: None is always returned as this function does not produce a response.
    """
    import re

    if bool(re.search(r"\nLine \d+: ", new_memory)):
        raise ValueError(
            "new_memory contains a line number prefix, which is not allowed. Do not include line numbers when calling memory tools (line numbers are for display purposes only)."
        )
    if CORE_MEMORY_LINE_NUMBER_WARNING in new_memory:
        raise ValueError(
            "new_memory contains a line number warning, which is not allowed. Do not include line number information when calling memory tools (line numbers are for display purposes only)."
        )

    if agent_state.memory.get_block(label) is None:
        from letta.schemas.block import Block

        new_block = Block(label=label, value=new_memory)
        agent_state.memory.set_block(new_block)

    agent_state.memory.update_block_value(label=label, value=new_memory)

    # Prepare the success message
    success_msg = f"The core memory block with label `{label}` has been edited. "
    # success_msg += self._make_output(
    #     snippet, f"a snippet of {path}", start_line + 1
    # )
    # success_msg += f"A snippet of core memory block `{label}`:\n{snippet}\n"
    success_msg += "Review the changes and make sure they are as expected (correct indentation, no duplicate lines, etc). Edit the memory block again if necessary."

    # return None
    return success_msg


def memory_finish_edits(agent_state: "AgentState") -> None:  # type: ignore
    """
    Call the memory_finish_edits command when you are finished making edits (integrating all new information) into the memory blocks. This function is called when the agent is done rethinking the memory.

    Returns:
        Optional[str]: None is always returned as this function does not produce a response.
    """
    return None
