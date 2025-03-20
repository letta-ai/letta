import asyncio
import threading
from random import uniform
from typing import Any, Dict, List, Optional, Type, Union

import humps
from composio.constants import DEFAULT_ENTITY_ID
from pydantic import BaseModel, Field, create_model

from letta.constants import COMPOSIO_ENTITY_ENV_VAR_KEY, DEFAULT_MESSAGE_TOOL, DEFAULT_MESSAGE_TOOL_KWARG
from letta.functions.interface import MultiAgentMessagingInterface
from letta.orm.errors import NoResultFound
from letta.schemas.enums import MessageRole
from letta.schemas.letta_message import AssistantMessage
from letta.schemas.letta_response import LettaResponse
from letta.schemas.message import Message, MessageCreate
from letta.schemas.user import User
from letta.server.rest_api.utils import get_letta_server
from letta.settings import settings
from letta.utils import log_telemetry


# TODO: This is kind of hacky, as this is used to search up the action later on composio's side
# TODO: So be very careful changing/removing these pair of functions
def generate_func_name_from_composio_action(action_name: str) -> str:
    """
    Generates the composio function name from the composio action.

    Args:
        action_name: The composio action name

    Returns:
        function name
    """
    return action_name.lower()


def generate_composio_action_from_func_name(func_name: str) -> str:
    """
    Generates the composio action from the composio function name.

    Args:
        func_name: The composio function name

    Returns:
        composio action name
    """
    return func_name.upper()


# TODO needed?
def generate_mcp_tool_wrapper(mcp_tool_name: str) -> tuple[str, str]:

    wrapper_function_str = f"""\
def {mcp_tool_name}(**kwargs):
    raise RuntimeError("Something went wrong - we should never be using the persisted source code for MCP. Please reach out to Letta team")
"""

    # Compile safety check
    assert_code_gen_compilable(wrapper_function_str.strip())

    return mcp_tool_name, wrapper_function_str.strip()


def generate_composio_tool_wrapper(action_name: str) -> tuple[str, str]:
    # Generate func name
    func_name = generate_func_name_from_composio_action(action_name)

    wrapper_function_str = f"""\
def {func_name}(**kwargs):
    raise RuntimeError("Something went wrong - we should never be using the persisted source code for Composio. Please reach out to Letta team")
"""

    # Compile safety check
    assert_code_gen_compilable(wrapper_function_str.strip())

    return func_name, wrapper_function_str.strip()


def execute_composio_action(
    action_name: str, args: dict, api_key: Optional[str] = None, entity_id: Optional[str] = None
) -> tuple[str, str]:
    import os

    from composio.exceptions import (
        ApiKeyNotProvidedError,
        ComposioSDKError,
        ConnectedAccountNotFoundError,
        EnumMetadataNotFound,
        EnumStringNotFound,
    )
    from composio_langchain import ComposioToolSet

    entity_id = entity_id or os.getenv(COMPOSIO_ENTITY_ENV_VAR_KEY, DEFAULT_ENTITY_ID)
    try:
        composio_toolset = ComposioToolSet(api_key=api_key, entity_id=entity_id)
        response = composio_toolset.execute_action(action=action_name, params=args)
    except ApiKeyNotProvidedError:
        raise RuntimeError(
            f"Composio API key is missing for action '{action_name}'. "
            "Please set the sandbox environment variables either through the ADE or the API."
        )
    except ConnectedAccountNotFoundError:
        raise RuntimeError(f"No connected account was found for action '{action_name}'. " "Please link an account and try again.")
    except EnumStringNotFound as e:
        raise RuntimeError(f"Invalid value provided for action '{action_name}': " + str(e) + ". Please check the action parameters.")
    except EnumMetadataNotFound as e:
        raise RuntimeError(f"Invalid value provided for action '{action_name}': " + str(e) + ". Please check the action parameters.")
    except ComposioSDKError as e:
        raise RuntimeError(f"An unexpected error occurred in Composio SDK while executing action '{action_name}': " + str(e))

    if response["error"]:
        raise RuntimeError(f"Error while executing action '{action_name}': " + str(response["error"]))

    return response["data"]


def generate_langchain_tool_wrapper(
    tool: "LangChainBaseTool", additional_imports_module_attr_map: dict[str, str] = None
) -> tuple[str, str]:
    tool_name = tool.__class__.__name__
    import_statement = f"from langchain_community.tools import {tool_name}"
    extra_module_imports = generate_import_code(additional_imports_module_attr_map)

    # Safety check that user has passed in all required imports:
    assert_all_classes_are_imported(tool, additional_imports_module_attr_map)

    tool_instantiation = f"tool = {generate_imported_tool_instantiation_call_str(tool)}"
    run_call = f"return tool._run(**kwargs)"
    func_name = humps.decamelize(tool_name)

    # Combine all parts into the wrapper function
    wrapper_function_str = f"""
def {func_name}(**kwargs):
    import importlib
    {import_statement}
    {extra_module_imports}
    {tool_instantiation}
    {run_call}
"""

    # Compile safety check
    assert_code_gen_compilable(wrapper_function_str)

    return func_name, wrapper_function_str


def assert_code_gen_compilable(code_str):
    try:
        compile(code_str, "<string>", "exec")
    except SyntaxError as e:
        print(f"Syntax error in code: {e}")


def assert_all_classes_are_imported(tool: Union["LangChainBaseTool"], additional_imports_module_attr_map: dict[str, str]) -> None:
    # Safety check that user has passed in all required imports:
    tool_name = tool.__class__.__name__
    current_class_imports = {tool_name}
    if additional_imports_module_attr_map:
        current_class_imports.update(set(additional_imports_module_attr_map.values()))
    required_class_imports = set(find_required_class_names_for_import(tool))

    if not current_class_imports.issuperset(required_class_imports):
        err_msg = f"[ERROR] You are missing module_attr pairs in `additional_imports_module_attr_map`. Currently, you have imports for {current_class_imports}, but the required classes for import are {required_class_imports}"
        print(err_msg)
        raise RuntimeError(err_msg)


def find_required_class_names_for_import(obj: Union["LangChainBaseTool", BaseModel]) -> list[str]:
    """
    Finds all the class names for required imports when instantiating the `obj`.
    NOTE: This does not return the full import path, only the class name.

    We accomplish this by running BFS and deep searching all the BaseModel objects in the obj parameters.
    """
    class_names = {obj.__class__.__name__}
    queue = [obj]

    while queue:
        # Get the current object we are inspecting
        curr_obj = queue.pop()

        # Collect all possible candidates for BaseModel objects
        candidates = []
        if is_base_model(curr_obj):
            # If it is a base model, we get all the values of the object parameters
            # i.e., if obj('b' = <class A>), we would want to inspect <class A>
            fields = dict(curr_obj)
            # Generate code for each field, skipping empty or None values
            candidates = list(fields.values())
        elif isinstance(curr_obj, dict):
            # If it is a dictionary, we get all the values
            # i.e., if obj = {'a': 3, 'b': <class A>}, we would want to inspect <class A>
            candidates = list(curr_obj.values())
        elif isinstance(curr_obj, list):
            # If it is a list, we inspect all the items in the list
            # i.e., if obj = ['a', 3, None, <class A>], we would want to inspect <class A>
            candidates = curr_obj

        # Filter out all candidates that are not BaseModels
        # In the list example above, ['a', 3, None, <class A>], we want to filter out 'a', 3, and None
        candidates = filter(lambda x: is_base_model(x), candidates)

        # Classic BFS here
        for c in candidates:
            c_name = c.__class__.__name__
            if c_name not in class_names:
                class_names.add(c_name)
                queue.append(c)

    return list(class_names)


def generate_imported_tool_instantiation_call_str(obj: Any) -> Optional[str]:
    if isinstance(obj, (int, float, str, bool, type(None))):
        # This is the base case
        # If it is a basic Python type, we trivially return the string version of that value
        # Handle basic types
        return repr(obj)
    elif is_base_model(obj):
        # Otherwise, if it is a BaseModel
        # We want to pull out all the parameters, and reformat them into strings
        # e.g. {arg}={value}
        # The reason why this is recursive, is because the value can be another BaseModel that we need to stringify
        model_name = obj.__class__.__name__
        fields = obj.dict()
        # Generate code for each field, skipping empty or None values
        field_assignments = []
        for arg, value in fields.items():
            python_string = generate_imported_tool_instantiation_call_str(value)
            if python_string:
                field_assignments.append(f"{arg}={python_string}")

        assignments = ", ".join(field_assignments)
        return f"{model_name}({assignments})"
    elif isinstance(obj, dict):
        # Inspect each of the items in the dict and stringify them
        # This is important because the dictionary may contain other BaseModels
        dict_items = []
        for k, v in obj.items():
            python_string = generate_imported_tool_instantiation_call_str(v)
            if python_string:
                dict_items.append(f"{repr(k)}: {python_string}")

        joined_items = ", ".join(dict_items)
        return f"{{{joined_items}}}"
    elif isinstance(obj, list):
        # Inspect each of the items in the list and stringify them
        # This is important because the list may contain other BaseModels
        list_items = [generate_imported_tool_instantiation_call_str(v) for v in obj]
        filtered_list_items = list(filter(None, list_items))
        list_items = ", ".join(filtered_list_items)
        return f"[{list_items}]"
    else:
        # Otherwise, if it is none of the above, that usually means it is a custom Python class that is NOT a BaseModel
        # Thus, we cannot get enough information about it to stringify it
        # This may cause issues, but we are making the assumption that any of these custom Python types are handled correctly by the parent library, such as LangChain
        # An example would be that WikipediaAPIWrapper has an argument that is a wikipedia (pip install wikipedia) object
        # We cannot stringify this easily, but WikipediaAPIWrapper handles the setting of this parameter internally
        # This assumption seems fair to me, since usually they are external imports, and LangChain should be bundling those as module-level imports within the tool
        # We throw a warning here anyway and provide the class name
        print(
            f"[WARNING] Skipping parsing unknown class {obj.__class__.__name__} (does not inherit from the Pydantic BaseModel and is not a basic Python type)"
        )
        if obj.__class__.__name__ == "function":
            import inspect

            print(inspect.getsource(obj))

        return None


def is_base_model(obj: Any):
    return isinstance(obj, BaseModel)


def generate_import_code(module_attr_map: Optional[dict]):
    if not module_attr_map:
        return ""

    code_lines = []
    for module, attr in module_attr_map.items():
        module_name = module.split(".")[-1]
        code_lines.append(f"# Load the module\n    {module_name} = importlib.import_module('{module}')")
        code_lines.append(f"    # Access the {attr} from the module")
        code_lines.append(f"    {attr} = getattr({module_name}, '{attr}')")
    return "\n".join(code_lines)


def parse_letta_response_for_assistant_message(
    target_agent_id: str,
    letta_response: LettaResponse,
) -> Optional[str]:
    messages = []
    for m in letta_response.messages:
        if isinstance(m, AssistantMessage):
            messages.append(m.content)

    if messages:
        messages_str = "\n".join(messages)
        return f"{target_agent_id} said: '{messages_str}'"
    else:
        return f"No response from {target_agent_id}"


async def async_execute_send_message_to_agent(
    sender_agent: "Agent",
    messages: List[MessageCreate],
    other_agent_id: str,
    log_prefix: str,
) -> Optional[str]:
    """
    Async helper to:
      1) validate the target agent exists & is in the same org,
      2) send a message via async_send_message_with_retries.
    """
    server = get_letta_server()

    # 1. Validate target agent
    try:
        server.agent_manager.get_agent_by_id(agent_id=other_agent_id, actor=sender_agent.user)
    except NoResultFound:
        raise ValueError(f"Target agent {other_agent_id} either does not exist or is not in org " f"({sender_agent.user.organization_id}).")

    # 2. Use your async retry logic
    return await async_send_message_with_retries(
        server=server,
        sender_agent=sender_agent,
        target_agent_id=other_agent_id,
        messages=messages,
        max_retries=settings.multi_agent_send_message_max_retries,
        timeout=settings.multi_agent_send_message_timeout,
        logging_prefix=log_prefix,
    )


def execute_send_message_to_agent(
    sender_agent: "Agent",
    messages: List[MessageCreate],
    other_agent_id: str,
    log_prefix: str,
) -> Optional[str]:
    """
    Synchronous wrapper that calls `async_execute_send_message_to_agent` using asyncio.run.
    This function must be called from a synchronous context (i.e., no running event loop).
    """
    return asyncio.run(async_execute_send_message_to_agent(sender_agent, messages, other_agent_id, log_prefix))


async def send_message_to_agent_no_stream(
    server: "SyncServer",
    agent_id: str,
    actor: User,
    messages: Union[List[Message], List[MessageCreate]],
    metadata: Optional[dict] = None,
) -> LettaResponse:
    """
    A simpler helper to send messages to a single agent WITHOUT streaming.
    Returns a LettaResponse containing the final messages.
    """
    interface = MultiAgentMessagingInterface()
    if metadata:
        interface.metadata = metadata

    # Offload the synchronous `send_messages` call
    usage_stats = await asyncio.to_thread(
        server.send_messages,
        actor=actor,
        agent_id=agent_id,
        messages=messages,
        interface=interface,
        metadata=metadata,
    )

    final_messages = interface.get_captured_send_messages()
    return LettaResponse(messages=final_messages, usage=usage_stats)


async def async_send_message_with_retries(
    server: "SyncServer",
    sender_agent: "Agent",
    target_agent_id: str,
    messages: List[MessageCreate],
    max_retries: int,
    timeout: int,
    logging_prefix: Optional[str] = None,
) -> str:
    logging_prefix = logging_prefix or "[async_send_message_with_retries]"
    log_telemetry(sender_agent.logger, f"async_send_message_with_retries start", target_agent_id=target_agent_id)

    for attempt in range(1, max_retries + 1):
        try:
            log_telemetry(
                sender_agent.logger,
                f"async_send_message_with_retries -> asyncio wait for send_message_to_agent_no_stream start",
                target_agent_id=target_agent_id,
            )
            response = await asyncio.wait_for(
                send_message_to_agent_no_stream(
                    server=server,
                    agent_id=target_agent_id,
                    actor=sender_agent.user,
                    messages=messages,
                ),
                timeout=timeout,
            )
            log_telemetry(
                sender_agent.logger,
                f"async_send_message_with_retries -> asyncio wait for send_message_to_agent_no_stream finish",
                target_agent_id=target_agent_id,
            )

            # Then parse out the assistant message
            assistant_message = parse_letta_response_for_assistant_message(target_agent_id, response)
            if assistant_message:
                sender_agent.logger.info(f"{logging_prefix} - {assistant_message}")
                log_telemetry(
                    sender_agent.logger, f"async_send_message_with_retries finish with assistant message", target_agent_id=target_agent_id
                )
                return assistant_message
            else:
                msg = f"(No response from agent {target_agent_id})"
                sender_agent.logger.info(f"{logging_prefix} - {msg}")
                log_telemetry(sender_agent.logger, f"async_send_message_with_retries finish no response", target_agent_id=target_agent_id)
                return msg

        except asyncio.TimeoutError:
            error_msg = f"(Timeout on attempt {attempt}/{max_retries} for agent {target_agent_id})"
            sender_agent.logger.warning(f"{logging_prefix} - {error_msg}")

        except Exception as e:
            error_msg = f"(Error on attempt {attempt}/{max_retries} for agent {target_agent_id}: {e})"
            sender_agent.logger.warning(f"{logging_prefix} - {error_msg}")

        # Exponential backoff before retrying
        if attempt < max_retries:
            backoff = uniform(0.5, 2) * (2**attempt)
            sender_agent.logger.warning(f"{logging_prefix} - Retrying the agent-to-agent send_message...sleeping for {backoff}")
            await asyncio.sleep(backoff)
        else:
            sender_agent.logger.error(f"{logging_prefix} - Fatal error: {error_msg}")
            log_telemetry(
                sender_agent.logger,
                f"async_send_message_with_retries finish fatal error",
                target_agent_id=target_agent_id,
                error_msg=error_msg,
            )
            raise Exception(error_msg)


def fire_and_forget_send_to_agent(
    sender_agent: "Agent",
    messages: List[MessageCreate],
    other_agent_id: str,
    log_prefix: str,
    use_retries: bool = False,
) -> None:
    """
    Fire-and-forget send of messages to a specific agent.
    Returns immediately in the calling thread, never blocks.

    Args:
        sender_agent (Agent): The sender agent object.
        server: The Letta server instance
        messages (List[MessageCreate]): The messages to send.
        other_agent_id (str): The ID of the target agent.
        log_prefix (str): Prefix for logging.
        use_retries (bool): If True, uses async_send_message_with_retries;
                            if False, calls server.send_message_to_agent directly.
    """
    server = get_letta_server()

    # 1) Validate the target agent (raises ValueError if not in same org)
    try:
        server.agent_manager.get_agent_by_id(agent_id=other_agent_id, actor=sender_agent.user)
    except NoResultFound:
        raise ValueError(
            f"The passed-in agent_id {other_agent_id} either does not exist, "
            f"or does not belong to the same org ({sender_agent.user.organization_id})."
        )

    # 2) Define the async coroutine to run
    async def background_task():
        try:
            if use_retries:
                result = await async_send_message_with_retries(
                    server=server,
                    sender_agent=sender_agent,
                    target_agent_id=other_agent_id,
                    messages=messages,
                    max_retries=settings.multi_agent_send_message_max_retries,
                    timeout=settings.multi_agent_send_message_timeout,
                    logging_prefix=log_prefix,
                )
                sender_agent.logger.info(f"{log_prefix} fire-and-forget success with retries: {result}")
            else:
                # Direct call to server.send_message_to_agent, no retry logic
                await server.send_message_to_agent(
                    agent_id=other_agent_id,
                    actor=sender_agent.user,
                    messages=messages,
                    stream_steps=False,
                    stream_tokens=False,
                    use_assistant_message=True,
                    assistant_message_tool_name=DEFAULT_MESSAGE_TOOL,
                    assistant_message_tool_kwarg=DEFAULT_MESSAGE_TOOL_KWARG,
                )
                sender_agent.logger.info(f"{log_prefix} fire-and-forget success (no retries).")
        except Exception as e:
            sender_agent.logger.error(f"{log_prefix} fire-and-forget send failed: {e}")

    # 3) Helper to run the coroutine in a brand-new event loop in a separate thread
    def run_in_background_thread(coro):
        def runner():
            loop = asyncio.new_event_loop()
            try:
                asyncio.set_event_loop(loop)
                loop.run_until_complete(coro)
            finally:
                loop.close()

        thread = threading.Thread(target=runner, daemon=True)
        thread.start()

    # 4) Try to schedule the coroutine in an existing loop, else spawn a thread
    try:
        loop = asyncio.get_running_loop()
        # If we get here, a loop is running; schedule the coroutine in background
        loop.create_task(background_task())
    except RuntimeError:
        # Means no event loop is running in this thread
        run_in_background_thread(background_task())


async def _send_message_to_agents_matching_tags_async(
    sender_agent: "Agent", message: str, match_all: List[str], match_some: List[str]
) -> List[str]:
    log_telemetry(
        sender_agent.logger,
        "_send_message_to_agents_matching_tags_async start",
        message=message,
        match_all=match_all,
        match_some=match_some,
    )
    server = get_letta_server()

    augmented_message = (
        f"[Incoming message from agent with ID '{sender_agent.agent_state.id}' - to reply to this message, "
        f"make sure to use the 'send_message' at the end, and the system will notify the sender of your response] "
        f"{message}"
    )

    # Retrieve up to 100 matching agents
    log_telemetry(
        sender_agent.logger,
        "_send_message_to_agents_matching_tags_async listing agents start",
        message=message,
        match_all=match_all,
        match_some=match_some,
    )
    matching_agents = server.agent_manager.list_agents_matching_tags(actor=sender_agent.user, match_all=match_all, match_some=match_some)

    log_telemetry(
        sender_agent.logger,
        "_send_message_to_agents_matching_tags_async  listing agents finish",
        message=message,
        match_all=match_all,
        match_some=match_some,
    )

    # Create a system message
    messages = [MessageCreate(role=MessageRole.system, content=augmented_message, name=sender_agent.agent_state.name)]

    # Possibly limit concurrency to avoid meltdown:
    sem = asyncio.Semaphore(settings.multi_agent_concurrent_sends)

    async def _send_single(agent_state):
        async with sem:
            return await async_send_message_with_retries(
                server=server,
                sender_agent=sender_agent,
                target_agent_id=agent_state.id,
                messages=messages,
                max_retries=3,
                timeout=settings.multi_agent_send_message_timeout,
            )

    tasks = [asyncio.create_task(_send_single(agent_state)) for agent_state in matching_agents]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    final = []
    for r in results:
        if isinstance(r, Exception):
            final.append(str(r))
        else:
            final.append(r)

    log_telemetry(
        sender_agent.logger,
        "_send_message_to_agents_matching_tags_async finish",
        message=message,
        match_all=match_all,
        match_some=match_some,
    )
    return final


async def _send_message_to_all_agents_in_group_async(sender_agent: "Agent", message: str) -> List[str]:
    server = get_letta_server()

    augmented_message = (
        f"[Incoming message from agent with ID '{sender_agent.agent_state.id}' - to reply to this message, "
        f"make sure to use the 'send_message' at the end, and the system will notify the sender of your response] "
        f"{message}"
    )

    worker_agents_ids = sender_agent.agent_state.multi_agent_group.agent_ids
    worker_agents = [server.agent_manager.get_agent_by_id(agent_id=agent_id, actor=sender_agent.user) for agent_id in worker_agents_ids]

    # Create a system message
    messages = [MessageCreate(role=MessageRole.system, content=augmented_message, name=sender_agent.agent_state.name)]

    # Possibly limit concurrency to avoid meltdown:
    sem = asyncio.Semaphore(settings.multi_agent_concurrent_sends)

    async def _send_single(agent_state):
        async with sem:
            return await async_send_message_with_retries(
                server=server,
                sender_agent=sender_agent,
                target_agent_id=agent_state.id,
                messages=messages,
                max_retries=3,
                timeout=settings.multi_agent_send_message_timeout,
            )

    tasks = [asyncio.create_task(_send_single(agent_state)) for agent_state in worker_agents]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    final = []
    for r in results:
        if isinstance(r, Exception):
            final.append(str(r))
        else:
            final.append(r)

    return final


def generate_model_from_args_json_schema(schema: Dict[str, Any]) -> Type[BaseModel]:
    """Creates a Pydantic model from a JSON schema.

    Args:
        schema: The JSON schema dictionary

    Returns:
        A Pydantic model class
    """
    # First create any nested models from $defs in reverse order to handle dependencies
    nested_models = {}
    if "$defs" in schema:
        for name, model_schema in reversed(list(schema.get("$defs", {}).items())):
            nested_models[name] = _create_model_from_schema(name, model_schema, nested_models)

    # Create and return the main model
    return _create_model_from_schema(schema.get("title", "DynamicModel"), schema, nested_models)


def _create_model_from_schema(name: str, model_schema: Dict[str, Any], nested_models: Dict[str, Type[BaseModel]] = None) -> Type[BaseModel]:
    fields = {}
    for field_name, field_schema in model_schema["properties"].items():
        field_type = _get_field_type(field_schema, nested_models)
        required = field_name in model_schema.get("required", [])
        description = field_schema.get("description", "")  # Get description or empty string
        fields[field_name] = (field_type, Field(..., description=description) if required else Field(None, description=description))

    return create_model(name, **fields)


def _get_field_type(field_schema: Dict[str, Any], nested_models: Dict[str, Type[BaseModel]] = None) -> Any:
    """Helper to convert JSON schema types to Python types."""
    if field_schema.get("type") == "string":
        return str
    elif field_schema.get("type") == "integer":
        return int
    elif field_schema.get("type") == "number":
        return float
    elif field_schema.get("type") == "boolean":
        return bool
    elif field_schema.get("type") == "array":
        item_type = field_schema["items"].get("$ref", "").split("/")[-1]
        if item_type and nested_models and item_type in nested_models:
            return List[nested_models[item_type]]
        return List[_get_field_type(field_schema["items"], nested_models)]
    elif field_schema.get("type") == "object":
        if "$ref" in field_schema:
            ref_type = field_schema["$ref"].split("/")[-1]
            if nested_models and ref_type in nested_models:
                return nested_models[ref_type]
        elif "additionalProperties" in field_schema:
            value_type = _get_field_type(field_schema["additionalProperties"], nested_models)
            return Dict[str, value_type]
        return dict
    elif field_schema.get("$ref") is not None:
        ref_type = field_schema["$ref"].split("/")[-1]
        if nested_models and ref_type in nested_models:
            return nested_models[ref_type]
        else:
            raise ValueError(f"Reference {ref_type} not found in nested models")
    elif field_schema.get("anyOf") is not None:
        types = []
        has_null = False
        for type_option in field_schema["anyOf"]:
            if type_option.get("type") == "null":
                has_null = True
            else:
                types.append(_get_field_type(type_option, nested_models))
        # If we have exactly one type and null, make it Optional
        if has_null and len(types) == 1:
            return Optional[types[0]]
        # Otherwise make it a Union of all types
        else:
            return Union[tuple(types)]
    raise ValueError(f"Unable to convert pydantic field schema to type: {field_schema}")
