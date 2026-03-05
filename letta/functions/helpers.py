import json
import logging
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Type, Union

if TYPE_CHECKING:
    try:
        from langchain.tools.base import BaseTool as LangChainBaseTool
    except ImportError:
        LangChainBaseTool = None

import humps
from pydantic import BaseModel, Field, create_model

from letta.constants import DEFAULT_MESSAGE_TOOL, DEFAULT_MESSAGE_TOOL_KWARG
from letta.schemas.message import Message


# TODO needed?
def generate_mcp_tool_wrapper(mcp_tool_name: str) -> tuple[str, str]:
    wrapper_function_str = f"""\
def {mcp_tool_name}(**kwargs):
    raise RuntimeError("Something went wrong - we should never be using the persisted source code for MCP. Please reach out to Letta team")
"""

    # Compile safety check
    _assert_code_gen_compilable(wrapper_function_str.strip())

    return mcp_tool_name, wrapper_function_str.strip()


def generate_langchain_tool_wrapper(
    tool: "LangChainBaseTool",
    additional_imports_module_attr_map: dict[str, str] | None = None,
) -> tuple[str, str]:
    tool_name = tool.__class__.__name__
    import_statement = f"from langchain_community.tools import {tool_name}"
    extra_module_imports = _generate_import_code(additional_imports_module_attr_map)

    # Safety check that user has passed in all required imports:
    _assert_all_classes_are_imported(tool, additional_imports_module_attr_map)

    tool_instantiation = f"tool = {generate_imported_tool_instantiation_call_str(tool)}"
    run_call = "return tool._run(**kwargs)"
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
    _assert_code_gen_compilable(wrapper_function_str)

    return func_name, wrapper_function_str


def _assert_code_gen_compilable(code_str):
    try:
        compile(code_str, "<string>", "exec")
    except SyntaxError as e:
        print(f"Syntax error in code: {e}")


def _assert_all_classes_are_imported(tool: Union["LangChainBaseTool"], additional_imports_module_attr_map: dict[str, str]) -> None:
    # Safety check that user has passed in all required imports:
    tool_name = tool.__class__.__name__
    current_class_imports = {tool_name}
    if additional_imports_module_attr_map:
        current_class_imports.update(set(additional_imports_module_attr_map.values()))
    required_class_imports = set(_find_required_class_names_for_import(tool))

    if not current_class_imports.issuperset(required_class_imports):
        err_msg = f"[ERROR] You are missing module_attr pairs in `additional_imports_module_attr_map`. Currently, you have imports for {current_class_imports}, but the required classes for import are {required_class_imports}"
        print(err_msg)
        raise RuntimeError(err_msg)


def _find_required_class_names_for_import(obj: Union["LangChainBaseTool", BaseModel]) -> list[str]:
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
        if _is_base_model(curr_obj):
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
        candidates = filter(lambda x: _is_base_model(x), candidates)

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
    elif _is_base_model(obj):
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


def _is_base_model(obj: Any):
    return isinstance(obj, BaseModel)


def _generate_import_code(module_attr_map: Optional[dict]):
    if not module_attr_map:
        return ""

    code_lines = []
    for module, attr in module_attr_map.items():
        module_name = module.split(".")[-1]
        code_lines.append(f"# Load the module\n    {module_name} = importlib.import_module('{module}')")
        code_lines.append(f"    # Access the {attr} from the module")
        code_lines.append(f"    {attr} = getattr({module_name}, '{attr}')")
    return "\n".join(code_lines)


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


def _create_model_from_schema(
    name: str, model_schema: Dict[str, Any], nested_models: Dict[str, Type[BaseModel]] | None = None
) -> Type[BaseModel]:
    fields = {}
    for field_name, field_schema in model_schema["properties"].items():
        field_type = _get_field_type(field_schema, nested_models)
        required = field_name in model_schema.get("required", [])
        description = field_schema.get("description", "")  # Get description or empty string
        fields[field_name] = (field_type, Field(..., description=description) if required else Field(None, description=description))

    return create_model(name, **fields)


def _get_field_type(field_schema: Dict[str, Any], nested_models: Dict[str, Type[BaseModel]] | None = None) -> Any:
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
            # TODO: This is totally GPT generated and I'm not sure it works
            # TODO: This is done to quickly patch some tests, we should nuke this whole pathway asap
            ap = field_schema["additionalProperties"]

            if ap is True:
                return dict
            elif ap is False:
                raise ValueError("additionalProperties=false is not supported.")
            else:
                # Try resolving nested type
                nested_type = _get_field_type(ap, nested_models)
                # If nested_type is Any, fall back to `dict`, or raise, depending on how strict you want to be
                if nested_type == Any:
                    return dict
                return Dict[str, nested_type]

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


def extract_send_message_from_steps_messages(
    steps_messages: List[List[Message]],
    agent_send_message_tool_name: str = DEFAULT_MESSAGE_TOOL,
    agent_send_message_tool_kwarg: str = DEFAULT_MESSAGE_TOOL_KWARG,
    logger: Optional[logging.Logger] = None,
) -> List[str]:
    extracted_messages = []

    for step in steps_messages:
        for message in step:
            if message.tool_calls:
                for tool_call in message.tool_calls:
                    if tool_call.function.name == agent_send_message_tool_name:
                        try:
                            # Parse arguments to extract the "message" field
                            arguments = json.loads(tool_call.function.arguments)
                            if agent_send_message_tool_kwarg in arguments:
                                extracted_messages.append(arguments[agent_send_message_tool_kwarg])
                        except json.JSONDecodeError:
                            logger.error(f"Failed to parse arguments for tool call: {tool_call.id}")

    return extracted_messages
