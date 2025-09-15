from typing import Optional

from letta.schemas.agent import AgentState


def create_or_attach_memory_block(
    agent_state: AgentState, 
    label: str, 
    value: str = "", 
    description: Optional[str] = None, 
    read_only: bool = False, 
    limit: int = 5000
) -> str:
    """
    Create a new memory block and attach it to the agent, or attach existing block if it already exists.

    Args:
        label: Label for the block (letters and underscores only)
        value: Initial content for the block (ignored if block already exists)
        description: Description of what this block contains (ignored if block already exists)
        read_only: Whether the agent has read-only access to the block (default: False, ignored if block already exists)
        limit: Character limit for the block (default: 5000, ignored if block already exists)
        agent_state: The agent state object containing agent information

    Returns:
        String confirming the block was created/attached
    """
    from letta.schemas.block import Block
    
    # Check if block already exists in memory
    try:
        existing_block = agent_state.memory.get_block(label)
        return f"Block '{label}' already exists in memory"
    except KeyError:
        pass  # Block doesn't exist, continue with creation
    
    # Create a new block
    new_block = Block(
        label=label,
        value=value,
        description=description,
        read_only=read_only,
        limit=limit
    )
    
    # Get server and actor from agent state (these are typically available)
    if hasattr(agent_state, '_server') and hasattr(agent_state, '_actor'):
        server = agent_state._server
        actor = agent_state._actor
        
        # Create the block in the database
        created_block = server.block_manager.create_or_update_block(new_block, actor)
        
        # Attach the block to the agent
        server.agent_manager.attach_block(
            agent_id=agent_state.id, 
            block_id=created_block.id, 
            actor=actor
        )
        
        return f"Created and attached persistent memory block '{label}'"
    else:
        # Fallback: add block directly to memory (non-persistent)
        agent_state.memory.set_block(new_block)
        return f"Created memory block '{label}' in core memory"


def add_memory_block(
    agent_state: AgentState, 
    label: str, 
    value: str = "", 
    limit: int = 5000, 
    read_only: bool = False
) -> str:
    """
    Add a memory block directly to agent's core memory (non-persistent).

    This function creates a block that exists only in the agent's current session
    and is not persisted to the database.

    Args:
        agent_state: The agent state object containing agent information
        label: Label for the block (letters and underscores only)
        value: Initial content for the block (default: empty string)
        limit: Character limit for the block (default: 5000)
        read_only: Whether the agent has read-only access to the block (default: False)

    Returns:
        String confirming the block was added to core memory
    """
    from letta.schemas.block import Block
    
    # Check if block already exists
    try:
        existing_block = agent_state.memory.get_block(label)
        return f"Block '{label}' already exists in core memory"
    except KeyError:
        pass  # Block doesn't exist, continue with creation
    
    # Create block and add to memory
    new_block = Block(
        label=label,
        value=value, 
        limit=limit,
        read_only=read_only
    )
    
    agent_state.memory.set_block(new_block)
    return f"Added memory block '{label}' to core memory"


def remove_memory_block(agent_state: AgentState, label: str) -> str:
    """
    Remove a memory block from the agent's core memory.

    This function removes a block from the agent's current memory but does not
    delete it from the database if it was persisted.

    Args:
        agent_state: The agent state object containing agent information
        label: Label of the block to remove

    Returns:
        String confirming the block was removed or noting it didn't exist
    """
    try:
        # Get the block to verify it exists
        block = agent_state.memory.get_block(label)
        
        # Remove from memory by creating a new list without this block
        agent_state.memory.blocks = [
            b for b in agent_state.memory.blocks if b.label != label
        ]
        
        return f"Removed memory block '{label}' from core memory"
    except KeyError:
        return f"Block '{label}' not found in core memory"


def list_memory_blocks(agent_state: AgentState) -> str:
    """
    List all memory blocks currently in the agent's core memory.

    Args:
        agent_state: The agent state object containing agent information

    Returns:
        String listing all memory block labels and their current character counts
    """
    blocks = agent_state.memory.get_blocks()
    
    if not blocks:
        return "No memory blocks found in core memory"
    
    block_info = []
    for block in blocks:
        char_count = len(block.value) if block.value else 0
        read_status = " (read-only)" if block.read_only else ""
        block_info.append(f"'{block.label}': {char_count}/{block.limit} chars{read_status}")
    
    return f"Memory blocks: {', '.join(block_info)}"


def get_memory_block_info(agent_state: AgentState, label: str) -> str:
    """
    Get detailed information about a specific memory block.

    Args:
        agent_state: The agent state object containing agent information
        label: Label of the block to get information about

    Returns:
        String with detailed block information or error if block doesn't exist
    """
    try:
        block = agent_state.memory.get_block(label)
        
        char_count = len(block.value) if block.value else 0
        description = block.description if block.description else "No description"
        read_status = "read-only" if block.read_only else "read-write"
        
        return (f"Block '{label}': {char_count}/{block.limit} chars, "
                f"{read_status}, Description: {description}")
    except KeyError:
        return f"Block '{label}' not found in core memory"