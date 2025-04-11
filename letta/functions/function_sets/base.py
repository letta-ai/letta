from typing import Optional

from letta.agent import Agent


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


def conversation_search(self: "Agent", query: str, page: Optional[int] = 0) -> Optional[str]:
    """
    Search prior conversation history using case-insensitive string matching.

    Args:
        query (str): String to search for.
        page (int): Allows you to page through results. Only use on a follow-up query. Defaults to 0 (first page).

    Returns:
        str: Query result string
    """

    import math

    from letta.constants import RETRIEVAL_QUERY_DEFAULT_PAGE_SIZE
    from letta.helpers.json_helpers import json_dumps

    if page is None or (isinstance(page, str) and page.lower().strip() == "none"):
        page = 0
    try:
        page = int(page)
    except:
        raise ValueError(f"'page' argument must be an integer")
    count = RETRIEVAL_QUERY_DEFAULT_PAGE_SIZE
    # TODO: add paging by page number. currently cursor only works with strings.
    # original: start=page * count
    messages = self.message_manager.list_messages_for_agent(
        agent_id=self.agent_state.id,
        actor=self.user,
        query_text=query,
        limit=count,
    )
    total = len(messages)
    num_pages = math.ceil(total / count) - 1  # 0 index
    if len(messages) == 0:
        results_str = f"No results found."
    else:
        results_pref = f"Showing {len(messages)} of {total} results (page {page}/{num_pages}):"
        results_formatted = [message.content[0].text for message in messages]
        results_str = f"{results_pref} {json_dumps(results_formatted)}"
    return results_str


def archival_memory_insert(self: "Agent", content: str) -> Optional[str]:
    """
    Add to archival memory. Make sure to phrase the memory contents such that it can be easily queried later.

    Args:
        content (str): Content to write to the memory. All unicode (including emojis) are supported.

    Returns:
        Optional[str]: None is always returned as this function does not produce a response.
    """
    self.passage_manager.insert_passage(
        agent_state=self.agent_state,
        agent_id=self.agent_state.id,
        text=content,
        actor=self.user,
    )
    self.agent_manager.rebuild_system_prompt(agent_id=self.agent_state.id, actor=self.user, force=True)
    return None


def archival_memory_search(self: "Agent", query: str, page: Optional[int] = 0, start: Optional[int] = 0) -> Optional[str]:
    """
    Search archival memory using semantic (embedding-based) search.

    Args:
        query (str): String to search for.
        page (Optional[int]): Allows you to page through results. Only use on a follow-up query. Defaults to 0 (first page).
        start (Optional[int]): Starting index for the search results. Defaults to 0.

    Returns:
        str: Query result string
    """

    from letta.constants import RETRIEVAL_QUERY_DEFAULT_PAGE_SIZE

    if page is None or (isinstance(page, str) and page.lower().strip() == "none"):
        page = 0
    try:
        page = int(page)
    except:
        raise ValueError(f"'page' argument must be an integer")
    count = RETRIEVAL_QUERY_DEFAULT_PAGE_SIZE

    try:
        # Get results using passage manager
        all_results = self.agent_manager.list_passages(
            actor=self.user,
            agent_id=self.agent_state.id,
            query_text=query,
            limit=count + start,  # Request enough results to handle offset
            embedding_config=self.agent_state.embedding_config,
            embed_query=True,
        )

        # Apply pagination
        end = min(count + start, len(all_results))
        paged_results = all_results[start:end]

        # Format results to match previous implementation
        formatted_results = [{"timestamp": str(result.created_at), "content": result.text} for result in paged_results]

        return formatted_results, len(formatted_results)

    except Exception as e:
        raise e


def core_memory_append(agent_state: "AgentState", label: str, content: str) -> Optional[str]:  # type: ignore
    """
    Append to the contents of core memory.

    Args:
        label (str): Section of the memory to be edited (persona or human).
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
        label (str): Section of the memory to be edited (persona or human).
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
        agent_state.memory.create_block(label=target_block_label, value=new_memory)

    agent_state.memory.update_block_value(label=target_block_label, value=new_memory)
    return None


def finish_rethinking_memory(agent_state: "AgentState") -> None:  # type: ignore
    """
    This function is called when the agent is done rethinking the memory.

    Returns:
        Optional[str]: None is always returned as this function does not produce a response.
    """
    return None


def view_core_memory_with_line_numbers(agent_state: "AgentState", target_block_label: str) -> None:  # type: ignore
    """
    View the contents of core memory in editor mode with line numbers. Called before `core_memory_insert` to see line numbers of memory block.

    Args:
        target_block_label (str): The name of the block to view.

    Returns:
        None: None is always returned as this function does not produce a response.
    """
    return None


def core_memory_insert(agent_state: "AgentState", target_block_label: str, new_memory: str, line_number: Optional[int] = None, replace: bool = False) -> None:  # type: ignore
    """
    Insert new memory content into a core memory block at a specific line number. Call `view_core_memory_with_line_numbers` to see line numbers of the memory block before using this tool.

    Args:
        target_block_label (str): The name of the block to write to.
        new_memory (str): The new memory content to insert.
        line_number (Optional[int]): Line number to insert content into, 0 indexed (None for end of file).
        replace (bool): Whether to overwrite the content at the specified line number.

    Returns:
        None: None is always returned as this function does not produce a response.
    """
    current_value = str(agent_state.memory.get_block(target_block_label).value)
    current_value_list = current_value.split("\n")
    if line_number is None:
        line_number = len(current_value_list)
    if replace:
        current_value_list[line_number - 1] = new_memory
    else:
        current_value_list.insert(line_number, new_memory)
    new_value = "\n".join(current_value_list)
    agent_state.memory.update_block_value(label=target_block_label, value=new_value)
    return None
