import json
import uuid
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID, uuid4

from letta.errors import PendingApprovalError
from letta.helpers import ToolRulesSolver
from letta.log import get_logger
from letta.schemas.agent import AgentState
from letta.schemas.enums import MessageRole
from letta.schemas.letta_message import MessageType
from letta.schemas.letta_message_content import TextContent
from letta.schemas.letta_response import LettaResponse
from letta.schemas.letta_stop_reason import LettaStopReason, StopReasonType
from letta.schemas.message import ApprovalCreate, Message, MessageCreate, MessageCreateBase
from letta.schemas.tool_execution_result import ToolExecutionResult
from letta.schemas.usage import LettaUsageStatistics
from letta.schemas.user import User
from letta.server.rest_api.utils import create_approval_response_message_from_input, create_input_messages
from letta.services.message_manager import MessageManager

logger = get_logger(__name__)


def _create_letta_response(
    new_in_context_messages: list[Message],
    use_assistant_message: bool,
    usage: LettaUsageStatistics,
    stop_reason: Optional[LettaStopReason] = None,
    include_return_message_types: Optional[List[MessageType]] = None,
) -> LettaResponse:
    """
    Converts the newly created/persisted messages into a LettaResponse.
    """
    # NOTE: hacky solution to avoid returning heartbeat messages and the original user message
    filter_user_messages = [m for m in new_in_context_messages if m.role != "user"]

    # Convert to Letta messages first
    response_messages = Message.to_letta_messages_from_list(
        messages=filter_user_messages, use_assistant_message=use_assistant_message, reverse=False
    )
    # Filter approval response messages
    response_messages = [m for m in response_messages if m.message_type != "approval_response_message"]

    # Apply message type filtering if specified
    if include_return_message_types is not None:
        response_messages = [msg for msg in response_messages if msg.message_type in include_return_message_types]
    if stop_reason is None:
        stop_reason = LettaStopReason(stop_reason=StopReasonType.end_turn.value)
    return LettaResponse(messages=response_messages, stop_reason=stop_reason, usage=usage)


def _prepare_in_context_messages(
    input_messages: List[MessageCreate],
    agent_state: AgentState,
    message_manager: MessageManager,
    actor: User,
    run_id: str,
) -> Tuple[List[Message], List[Message]]:
    """
    Prepares in-context messages for an agent, based on the current state and a new user input.

    Args:
        input_messages (List[MessageCreate]): The new user input messages to process.
        agent_state (AgentState): The current state of the agent, including message buffer config.
        message_manager (MessageManager): The manager used to retrieve and create messages.
        actor (User): The user performing the action, used for access control and attribution.
        run_id (str): The run ID associated with this message processing.

    Returns:
        Tuple[List[Message], List[Message]]: A tuple containing:
            - The current in-context messages (existing context for the agent).
            - The new in-context messages (messages created from the new input).
    """

    if agent_state.message_buffer_autoclear:
        # If autoclear is enabled, only include the most recent system message (usually at index 0)
        current_in_context_messages = [message_manager.get_messages_by_ids(message_ids=agent_state.message_ids, actor=actor)[0]]
    else:
        # Otherwise, include the full list of messages by ID for context
        current_in_context_messages = message_manager.get_messages_by_ids(message_ids=agent_state.message_ids, actor=actor)

    # Create a new user message from the input and store it
    new_in_context_messages = message_manager.create_many_messages(
        create_input_messages(
            input_messages=input_messages, agent_id=agent_state.id, timezone=agent_state.timezone, run_id=run_id, actor=actor
        ),
        actor=actor,
    )

    return current_in_context_messages, new_in_context_messages


async def _prepare_in_context_messages_async(
    input_messages: List[MessageCreate],
    agent_state: AgentState,
    message_manager: MessageManager,
    actor: User,
    run_id: str,
) -> Tuple[List[Message], List[Message]]:
    """
    Prepares in-context messages for an agent, based on the current state and a new user input.
    Async version of _prepare_in_context_messages.

    Args:
        input_messages (List[MessageCreate]): The new user input messages to process.
        agent_state (AgentState): The current state of the agent, including message buffer config.
        message_manager (MessageManager): The manager used to retrieve and create messages.
        actor (User): The user performing the action, used for access control and attribution.
        run_id (str): The run ID associated with this message processing.

    Returns:
        Tuple[List[Message], List[Message]]: A tuple containing:
            - The current in-context messages (existing context for the agent).
            - The new in-context messages (messages created from the new input).
    """

    if agent_state.message_buffer_autoclear:
        # If autoclear is enabled, only include the most recent system message (usually at index 0)
        current_in_context_messages = [await message_manager.get_message_by_id_async(message_id=agent_state.message_ids[0], actor=actor)]
    else:
        # Otherwise, include the full list of messages by ID for context
        current_in_context_messages = await message_manager.get_messages_by_ids_async(message_ids=agent_state.message_ids, actor=actor)

    # Create a new user message from the input and store it
    new_in_context_messages = await message_manager.create_many_messages_async(
        create_input_messages(
            input_messages=input_messages, agent_id=agent_state.id, timezone=agent_state.timezone, run_id=run_id, actor=actor
        ),
        actor=actor,
        project_id=agent_state.project_id,
    )

    return current_in_context_messages, new_in_context_messages


def validate_approval_tool_call_ids(approval_request_message: Message, approval_response_message: ApprovalCreate):
    approval_requests = approval_request_message.tool_calls
    approval_request_tool_call_ids = [approval_request.id for approval_request in approval_requests]

    approval_responses = approval_response_message.approvals
    approval_response_tool_call_ids = [approval_response.tool_call_id for approval_response in approval_responses]

    request_response_diff = set(approval_request_tool_call_ids).symmetric_difference(set(approval_response_tool_call_ids))
    if request_response_diff:
        if len(approval_request_tool_call_ids) == 1 and approval_response_tool_call_ids[0] == approval_request_message.id:
            # legacy case where we used to use message id instead of tool call id
            return

        raise ValueError(
            f"Invalid tool call IDs. Expected '{approval_request_tool_call_ids}', but received '{approval_response_tool_call_ids}'."
        )


async def _prepare_in_context_messages_no_persist_async(
    input_messages: List[MessageCreateBase],
    agent_state: AgentState,
    message_manager: MessageManager,
    actor: User,
    run_id: Optional[str] = None,
) -> Tuple[List[Message], List[Message]]:
    """
    Prepares in-context messages for an agent, based on the current state and a new user input.

    Args:
        input_messages (List[MessageCreate]): The new user input messages to process.
        agent_state (AgentState): The current state of the agent, including message buffer config.
        message_manager (MessageManager): The manager used to retrieve and create messages.
        actor (User): The user performing the action, used for access control and attribution.
        run_id (str): The run ID associated with this message processing.

    Returns:
        Tuple[List[Message], List[Message]]: A tuple containing:
            - The current in-context messages (existing context for the agent).
            - The new in-context messages (messages created from the new input).
    """

    if agent_state.message_buffer_autoclear:
        # If autoclear is enabled, only include the most recent system message (usually at index 0)
        current_in_context_messages = [await message_manager.get_message_by_id_async(message_id=agent_state.message_ids[0], actor=actor)]
    else:
        # Otherwise, include the full list of messages by ID for context
        current_in_context_messages = await message_manager.get_messages_by_ids_async(message_ids=agent_state.message_ids, actor=actor)

    # Check for approval-related message validation
    if len(input_messages) == 1 and input_messages[0].type == "approval":
        # User is trying to send an approval response
        if current_in_context_messages and current_in_context_messages[-1].role != "approval":
            raise ValueError(
                "Cannot process approval response: No tool call is currently awaiting approval. "
                "Please send a regular message to interact with the agent."
            )
        validate_approval_tool_call_ids(current_in_context_messages[-1], input_messages[0])
        new_in_context_messages = create_approval_response_message_from_input(
            agent_state=agent_state, input_message=input_messages[0], run_id=run_id
        )
    else:
        # User is trying to send a regular message
        if current_in_context_messages and current_in_context_messages[-1].role == "approval":
            raise PendingApprovalError(pending_request_id=current_in_context_messages[-1].id)

        # Create a new user message from the input but dont store it yet
        new_in_context_messages = create_input_messages(
            input_messages=input_messages, agent_id=agent_state.id, timezone=agent_state.timezone, run_id=run_id, actor=actor
        )

    return current_in_context_messages, new_in_context_messages


def serialize_message_history(messages: List[str], context: str) -> str:
    """
    Produce an XML document like:

    <memory>
      <messages>
        <message>…</message>
        <message>…</message>
        …
      </messages>
      <context>…</context>
    </memory>
    """
    root = ET.Element("memory")

    msgs_el = ET.SubElement(root, "messages")
    for msg in messages:
        m = ET.SubElement(msgs_el, "message")
        m.text = msg

    sum_el = ET.SubElement(root, "context")
    sum_el.text = context

    # ET.tostring will escape reserved chars for you
    return ET.tostring(root, encoding="unicode")


def deserialize_message_history(xml_str: str) -> Tuple[List[str], str]:
    """
    Parse the XML back into (messages, context). Raises ValueError if tags are missing.
    """
    try:
        root = ET.fromstring(xml_str)
    except ET.ParseError as e:
        raise ValueError(f"Invalid XML: {e}")

    msgs_el = root.find("messages")
    if msgs_el is None:
        raise ValueError("Missing <messages> section")

    messages = []
    for m in msgs_el.findall("message"):
        # .text may be None if empty, so coerce to empty string
        messages.append(m.text or "")

    sum_el = root.find("context")
    if sum_el is None:
        raise ValueError("Missing <context> section")
    context = sum_el.text or ""

    return messages, context


def generate_step_id(uid: Optional[UUID] = None) -> str:
    uid = uid or uuid4()
    return f"step-{uid}"


def _safe_load_tool_call_str(tool_call_args_str: str) -> dict:
    """Lenient JSON → dict with fallback to eval on assertion failure."""
    # Temp hack to gracefully handle parallel tool calling attempt, only take first one
    if "}{" in tool_call_args_str:
        tool_call_args_str = tool_call_args_str.split("}{", 1)[0] + "}"

    try:
        tool_args = json.loads(tool_call_args_str)
        if not isinstance(tool_args, dict):
            # Load it again - this is due to sometimes Anthropic returning weird json @caren
            tool_args = json.loads(tool_args)
    except json.JSONDecodeError:
        logger.error("Failed to JSON decode tool call argument string: %s", tool_call_args_str)
        tool_args = {}

    return tool_args


def _json_type_matches(value: Any, expected_type: Any) -> bool:
    """Basic JSON Schema type checking for common types.

    expected_type can be a string (e.g., "string") or a list (union).
    This is intentionally lightweight; deeper validation can be added as needed.
    """

    def match_one(v: Any, t: str) -> bool:
        if t == "string":
            return isinstance(v, str)
        if t == "integer":
            # bool is subclass of int in Python; exclude
            return isinstance(v, int) and not isinstance(v, bool)
        if t == "number":
            return (isinstance(v, int) and not isinstance(v, bool)) or isinstance(v, float)
        if t == "boolean":
            return isinstance(v, bool)
        if t == "object":
            return isinstance(v, dict)
        if t == "array":
            return isinstance(v, list)
        if t == "null":
            return v is None
        # Fallback: don't over-reject on unknown types
        return True

    if isinstance(expected_type, list):
        return any(match_one(value, t) for t in expected_type)
    if isinstance(expected_type, str):
        return match_one(value, expected_type)
    return True


def _schema_accepts_value(prop_schema: Dict[str, Any], value: Any) -> bool:
    """Check if a value is acceptable for a property schema.

    Handles: type, enum, const, anyOf, oneOf (by shallow traversal).
    """
    if prop_schema is None:
        return True

    # const has highest precedence
    if "const" in prop_schema:
        return value == prop_schema["const"]

    # enums
    if "enum" in prop_schema:
        try:
            return value in prop_schema["enum"]
        except Exception:
            return False

    # unions
    for union_key in ("anyOf", "oneOf"):
        if union_key in prop_schema and isinstance(prop_schema[union_key], list):
            for sub in prop_schema[union_key]:
                if _schema_accepts_value(sub, value):
                    return True
            return False

    # type-based
    if "type" in prop_schema:
        if not _json_type_matches(value, prop_schema["type"]):
            return False

    # No strict constraints specified: accept
    return True


def merge_and_validate_prefilled_args(tool: "Tool", llm_args: Dict[str, Any], prefilled_args: Dict[str, Any]) -> Dict[str, Any]:
    """Merge LLM-provided args with prefilled args from tool rules.

    - Overlapping keys are replaced by prefilled values (prefilled wins).
    - Validates that prefilled keys exist on the tool schema and that values satisfy
      basic JSON Schema constraints (type/enum/const/anyOf/oneOf).
    - Returns merged args, or raises ValueError on invalid prefilled inputs.
    """
    from letta.schemas.tool import Tool  # local import to avoid circulars in type hints

    assert isinstance(tool, Tool)
    schema = (tool.json_schema or {}).get("parameters", {})
    props: Dict[str, Any] = schema.get("properties", {}) if isinstance(schema, dict) else {}

    errors: list[str] = []
    for k, v in prefilled_args.items():
        if k not in props:
            errors.append(f"Unknown argument '{k}' for tool '{tool.name}'.")
            continue
        if not _schema_accepts_value(props.get(k), v):
            expected = props.get(k, {}).get("type")
            errors.append(f"Invalid value for '{k}': {v!r} does not match expected schema type {expected!r}.")

    if errors:
        raise ValueError("; ".join(errors))

    merged = dict(llm_args or {})
    merged.update(prefilled_args)
    return merged


def _pop_heartbeat(tool_args: dict) -> bool:
    hb = tool_args.pop("request_heartbeat", False)
    return str(hb).lower() == "true" if isinstance(hb, str) else bool(hb)


def _build_rule_violation_result(tool_name: str, valid: list[str], solver: ToolRulesSolver) -> ToolExecutionResult:
    hint_lines = solver.guess_rule_violation(tool_name)
    hint_txt = ("\n** Hint: Possible rules that were violated:\n" + "\n".join(f"\t- {h}" for h in hint_lines)) if hint_lines else ""
    msg = f"[ToolConstraintError] Cannot call {tool_name}, valid tools include: {valid}.{hint_txt}"
    return ToolExecutionResult(status="error", func_return=msg)


def _load_last_function_response(in_context_messages: list[Message]):
    """Load the last function response from message history"""
    for msg in reversed(in_context_messages):
        if msg.role == MessageRole.tool and msg.content and len(msg.content) == 1 and isinstance(msg.content[0], TextContent):
            text_content = msg.content[0].text
            try:
                response_json = json.loads(text_content)
                if response_json.get("message"):
                    return response_json["message"]
            except (json.JSONDecodeError, KeyError):
                raise ValueError(f"Invalid JSON format in message: {text_content}")
    return None


def _maybe_get_approval_messages(messages: list[Message]) -> Tuple[Message | None, Message | None]:
    if len(messages) >= 2:
        maybe_approval_request, maybe_approval_response = messages[-2], messages[-1]
        if maybe_approval_request.role == "approval" and maybe_approval_response.role == "approval":
            return maybe_approval_request, maybe_approval_response
    return None, None


def _maybe_get_pending_tool_call_message(messages: list[Message]) -> Message | None:
    """
    Only used in the case where hitl is invoked with parallel tool calling,
    where agent calls some tools that require approval, and others that don't.
    """
    if len(messages) >= 3:
        maybe_tool_call_message = messages[-3]
        if (
            maybe_tool_call_message.role == "assistant"
            and maybe_tool_call_message.tool_calls is not None
            and len(maybe_tool_call_message.tool_calls) > 0
        ):
            return maybe_tool_call_message
    return None
