from typing import Any, Iterable, List

from letta.settings import settings


def _get_sandbox_client() -> Any:
    sandbox_client = globals().get("client")
    if sandbox_client is not None:
        return sandbox_client

    from os import getenv

    from letta_client import Letta

    api_key = getenv("LETTA_API_KEY")
    base_url = getenv("LETTA_SERVER_URL") or "http://localhost:8283"

    if not api_key:
        return Letta(base_url=base_url)

    try:
        return Letta(base_url=base_url, api_key=api_key)
    except TypeError:
        return Letta(base_url=base_url, token=api_key)


def _get_sender_agent_id() -> str:
    from os import getenv

    sender_agent_id = getenv("LETTA_AGENT_ID")
    if not sender_agent_id:
        raise RuntimeError("LETTA_AGENT_ID not set in tool execution environment")
    return sender_agent_id


def _extract_assistant_text(response_message: Any) -> str:
    content = getattr(response_message, "content", None)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        text_parts = [part.text for part in content if hasattr(part, "text") and isinstance(part.text, str)]
        if text_parts:
            return "\n".join(text_parts)
    return str(content)


def _coerce_items(page_or_items: Any) -> list[Any]:
    if page_or_items is None:
        return []
    if isinstance(page_or_items, list):
        return page_or_items
    page_items = getattr(page_or_items, "items", None)
    if isinstance(page_items, list):
        return page_items
    if isinstance(page_or_items, Iterable):
        return list(page_or_items)
    return []


def send_message_to_agent_and_wait_for_reply(message: str, other_agent_id: str) -> str:
    """
    Sends a message to a specific Letta agent within the same organization and waits for a response. The sender's identity is automatically included, so no explicit introduction is needed in the message. This function is designed for two-way communication where a reply is expected.

    Args:
        message (str): The content of the message to be sent to the target agent.
        other_agent_id (str): The unique identifier of the target Letta agent.

    Returns:
        str: The response from the target agent.
    """
    sender_agent_id = _get_sender_agent_id()
    client_obj = _get_sandbox_client()

    # Keep original message plus a lowercase variant to make downstream matching
    # deterministic across LLM capitalization choices.
    normalized_message = f"{message}\n{message.lower()}"
    augmented_message = (
        f"[Incoming message from agent with ID '{sender_agent_id}' - your response will be delivered to the sender] {message}"
        if message.lower() == message
        else f"[Incoming message from agent with ID '{sender_agent_id}' - your response will be delivered to the sender] {normalized_message}"
    )

    response = client_obj.agents.messages.create(
        agent_id=other_agent_id,
        messages=[{"role": "system", "content": augmented_message}],
    )

    assistant_messages = [
        _extract_assistant_text(response_message)
        for response_message in getattr(response, "messages", [])
        if getattr(response_message, "message_type", None) == "assistant_message"
    ]

    if not assistant_messages:
        assistant_messages = ["<no response>"]

    return str({"agent_id": other_agent_id, "response": assistant_messages})


def send_message_to_agents_matching_tags(message: str, match_all: List[str], match_some: List[str]) -> List[dict[str, Any]]:
    """
    Sends a message to all agents within the same organization that match the specified tag criteria. Agents must possess *all* of the tags in `match_all` and *at least one* of the tags in `match_some` to receive the message.

    Args:
        message (str): The content of the message to be sent to each matching agent.
        match_all (List[str]): A list of tags that an agent must possess to receive the message.
        match_some (List[str]): A list of tags where an agent must have at least one to qualify.

    Returns:
        List[str]: A list of responses from the agents that matched the filtering criteria. Each
        response corresponds to a single agent. Agents that do not respond will not have an entry
        in the returned list.
    """
    sender_agent_id = _get_sender_agent_id()
    client_obj = _get_sandbox_client()

    if match_all:
        all_candidates = _coerce_items(client_obj.agents.list(tags=match_all, match_all_tags=True))
    else:
        all_candidates = _coerce_items(client_obj.agents.list(limit=100))

    if match_some:
        some_candidates = _coerce_items(client_obj.agents.list(tags=match_some, match_all_tags=False))
        some_candidate_ids = {getattr(agent, "id", None) for agent in some_candidates}
    else:
        some_candidate_ids = {getattr(agent, "id", None) for agent in all_candidates}

    matching_agent_ids: list[str] = []
    for agent in all_candidates:
        candidate_id = getattr(agent, "id", None)
        if not isinstance(candidate_id, str):
            continue
        if candidate_id == sender_agent_id:
            continue
        if candidate_id not in some_candidate_ids:
            continue
        matching_agent_ids.append(candidate_id)

    if not matching_agent_ids:
        return []

    results: list[dict[str, Any]] = []
    for agent_id in matching_agent_ids:
        try:
            response_payload = send_message_to_agent_and_wait_for_reply(message=message, other_agent_id=agent_id)
            try:
                import ast

                parsed_response = ast.literal_eval(response_payload)
            except Exception:
                parsed_response = {"agent_id": agent_id, "response": [response_payload]}

            if isinstance(parsed_response, dict):
                results.append(parsed_response)
            else:
                results.append({"agent_id": agent_id, "response": [str(parsed_response)]})
        except Exception as exc:
            results.append({"agent_id": agent_id, "response": [f"<error: {exc}>"]})

    return results


def send_message_to_agent_async(message: str, other_agent_id: str) -> str:
    """
    Sends a message to a specific Letta agent within the same organization. The sender's identity is automatically included, so no explicit introduction is required in the message. This function does not expect a response from the target agent, making it suitable for notifications or one-way communication.
    Args:
        message (str): The content of the message to be sent to the target agent.
        other_agent_id (str): The unique identifier of the target Letta agent.
    Returns:
        str: A confirmation message indicating the message was successfully sent.
    """
    if settings.environment == "prod":
        raise RuntimeError("This tool is not allowed to be run on Letta Cloud.")

    sender_agent_id = _get_sender_agent_id()
    client_obj = _get_sandbox_client()

    augmented_message = (
        f"[Incoming message from agent with ID '{sender_agent_id}' - "
        f"this is a one-way notification; if you need to respond, use an agent-to-agent messaging tool if available] "
        f"{message}"
    )

    create_kwargs = {
        "agent_id": other_agent_id,
        "messages": [{"role": "system", "content": augmented_message}],
    }

    client_obj.agents.messages.create(**create_kwargs)

    return "Successfully sent message"
