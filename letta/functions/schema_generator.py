import inspect
import warnings
from typing import Any, Dict, List, Optional, Tuple, Type, Union, get_args, get_origin

from composio.client.collections import ActionParametersModel
from docstring_parser import parse
from pydantic import BaseModel
from typing_extensions import Literal

from letta.constants import REQUEST_HEARTBEAT_DESCRIPTION, REQUEST_HEARTBEAT_PARAM
from letta.functions.mcp_client.types import MCPTool
from letta.log import get_logger

logger = get_logger(__name__)


def validate_google_style_docstring(function):
    """Validate that a function's docstring follows Google Python style format.

    Args:
        function: The function to validate

    Raises:
        ValueError: If the docstring is not in Google Python style format
    """
    if not function.__doc__:
        raise ValueError(
            f"Function '{function.__name__}' has no docstring. Expected Google Python style docstring with Args and Returns sections."
        )

    docstring = function.__doc__.strip()

    # Basic Google style requirements:
    # 1. Should have Args: section if function has parameters (excluding self, agent_state)
    # 2. Should have Returns: section if function returns something other than None
    # 3. Args and Returns sections should be properly formatted

    sig = inspect.signature(function)
    has_params = any(param.name not in ["self", "agent_state"] for param in sig.parameters.values())

    # Check for Args section if function has parameters
    if has_params and "Args:" not in docstring:
        raise ValueError(f"Function '{function.__name__}' with parameters must have 'Args:' section in Google Python style docstring")

    # NOTE: No check for Returns section - this is irrelevant to the LLM
    # In proper Google Python format, the Returns: is required

    # Validate Args section format if present
    if "Args:" in docstring:
        args_start = docstring.find("Args:")
        args_end = docstring.find("Returns:", args_start) if "Returns:" in docstring[args_start:] else len(docstring)
        args_section = docstring[args_start:args_end].strip()

        # Check that each parameter is documented
        for param in sig.parameters.values():
            if param.name in ["self", "agent_state"]:
                continue
            if f"{param.name} (" not in args_section and f"{param.name}:" not in args_section:
                raise ValueError(
                    f"Function '{function.__name__}' parameter '{param.name}' not documented in Args section of Google Python style docstring"
                )


def is_optional(annotation):
    # Check if the annotation is a Union
    if getattr(annotation, "__origin__", None) is Union:
        # Check if None is one of the options in the Union
        return type(None) in annotation.__args__
    return False


def optional_length(annotation):
    if is_optional(annotation):
        # Subtract 1 to account for NoneType
        return len(annotation.__args__) - 1
    else:
        raise ValueError("The annotation is not an Optional type")


def type_to_json_schema_type(py_type) -> dict:
    """
    Maps a Python type to a JSON schema type.
    Specifically handles typing.Optional and common Python types.
    """
    # if get_origin(py_type) is typing.Optional:
    if is_optional(py_type):
        # Assert that Optional has only one type argument
        type_args = get_args(py_type)
        assert optional_length(py_type) == 1, f"Optional type must have exactly one type argument, but got {py_type}"

        # Extract and map the inner type
        return type_to_json_schema_type(type_args[0])

    # Handle Union types (except Optional which is handled above)
    if get_origin(py_type) is Union:
        # TODO support mapping Unions to anyOf
        raise NotImplementedError("General Union types are not yet supported")

    # Handle array types
    origin = get_origin(py_type)
    if py_type == list or origin in (list, List):
        args = get_args(py_type)
        if len(args) == 0:
            # is this correct
            warnings.warn("Defaulting to string type for untyped List")
            return {
                "type": "array",
                "items": {"type": "string"},
            }

        if args and inspect.isclass(args[0]) and issubclass(args[0], BaseModel):
            # If it's a list of Pydantic models, return an array with the model schema as items
            return {
                "type": "array",
                "items": pydantic_model_to_json_schema(args[0]),
            }

        # Otherwise, recursively call the basic type checker
        return {
            "type": "array",
            # get the type of the items in the list
            "items": type_to_json_schema_type(args[0]),
        }

    # Handle literals
    if get_origin(py_type) is Literal:
        return {"type": "string", "enum": get_args(py_type)}

    # Handle tuple types (specifically fixed-length like Tuple[int, int])
    if origin in (tuple, Tuple):
        args = get_args(py_type)
        if len(args) == 0:
            raise ValueError("Tuple type must have at least one element")

        # Support only fixed-length tuples like Tuple[int, int], not variable-length like Tuple[int, ...]
        if len(args) == 2 and args[1] is Ellipsis:
            raise NotImplementedError("Variable-length tuples (e.g., Tuple[int, ...]) are not supported")

        return {
            "type": "array",
            "prefixItems": [type_to_json_schema_type(arg) for arg in args],
            "minItems": len(args),
            "maxItems": len(args),
        }

    # Handle object types
    if py_type == dict or origin in (dict, Dict):
        args = get_args(py_type)
        if not args:
            # Generic dict without type arguments
            return {
                "type": "object",
                # "properties": {}
            }
        else:
            raise ValueError(
                f"Dictionary types {py_type} with nested type arguments are not supported (consider using a Pydantic model instead)"
            )

        # NOTE: the below code works for generic JSON schema parsing, but there's a problem with the key inference
        #       when it comes to OpenAI function schema generation so it doesn't make sense to allow for dict[str, Any] type hints
        # key_type, value_type = args

        # # Ensure dict keys are strings
        # # Otherwise there's no JSON schema equivalent
        # if key_type != str:
        #     raise ValueError("Dictionary keys must be strings for OpenAI function schema compatibility")

        # # Handle value type to determine property schema
        # value_schema = {}
        # if inspect.isclass(value_type) and issubclass(value_type, BaseModel):
        #     value_schema = pydantic_model_to_json_schema(value_type)
        # else:
        #     value_schema = type_to_json_schema_type(value_type)

        # # NOTE: the problem lies here - the key is always "key_placeholder"
        # return {"type": "object", "properties": {"key_placeholder": value_schema}}

    # Handle direct Pydantic models
    if inspect.isclass(py_type) and issubclass(py_type, BaseModel):
        return pydantic_model_to_json_schema(py_type)

    # Mapping of Python types to JSON schema types
    type_map = {
        # Basic types
        # Optional, Union, and collections are handled above ^
        int: "integer",
        str: "string",
        bool: "boolean",
        float: "number",
        None: "null",
    }
    if py_type not in type_map:
        raise ValueError(f"Python type {py_type} has no corresponding JSON schema type - full map: {type_map}")
    else:
        return {"type": type_map[py_type]}


def pydantic_model_to_open_ai(model: Type[BaseModel]) -> dict:
    """
    Converts a Pydantic model as a singular arg to a JSON schema object for use in OpenAI function calling.
    """
    schema = model.model_json_schema()
    docstring = parse(model.__doc__ or "")
    parameters = {k: v for k, v in schema.items() if k not in ("title", "description")}
    for param in docstring.params:
        if (name := param.arg_name) in parameters["properties"] and (description := param.description):
            if "description" not in parameters["properties"][name]:
                parameters["properties"][name]["description"] = description

    parameters["required"] = sorted(k for k, v in parameters["properties"].items() if "default" not in v)

    if "description" not in schema:
        # Support multiline docstrings for complex functions, TODO (cliandy): consider having this as a setting
        if docstring.long_description:
            schema["description"] = docstring.long_description
        elif docstring.short_description:
            schema["description"] = docstring.short_description
        else:
            raise ValueError(f"No description found in docstring or description field (model: {model}, docstring: {docstring})")

    return {
        "name": schema["title"],
        "description": schema["description"],
        "parameters": parameters,
    }


def pydantic_model_to_json_schema(model: Type[BaseModel]) -> dict:
    """
    Converts a Pydantic model (as an arg that already is annotated) to a JSON schema object for use in OpenAI function calling.

    An example of a Pydantic model as an arg:

    class Step(BaseModel):
        name: str = Field(
            ...,
            description="Name of the step.",
        )
        key: str = Field(
            ...,
            description="Unique identifier for the step.",
        )
        description: str = Field(
            ...,
            description="An exhaustic description of what this step is trying to achieve and accomplish.",
        )

    def create_task_plan(steps: list[Step]):
        '''
        Creates a task plan for the current task.

        Args:
            steps: List of steps to add to the task plan.
        ...

    Should result in:
    {
      "name": "create_task_plan",
      "description": "Creates a task plan for the current task.",
      "parameters": {
        "type": "object",
        "properties": {
          "steps": {  # <= this is the name of the arg
            "type": "object",
            "description": "List of steps to add to the task plan.",
            "properties": {
              "name": {
                "type": "str",
                "description": "Name of the step.",
              },
              "key": {
                "type": "str",
                "description": "Unique identifier for the step.",
              },
              "description": {
                "type": "str",
                "description": "An exhaustic description of what this step is trying to achieve and accomplish.",
              },
            },
            "required": ["name", "key", "description"],
          }
        },
        "required": ["steps"],
      }
    }

    Specifically, the result of pydantic_model_to_json_schema(steps) (where `steps` is an instance of BaseModel) is:
    {
        "type": "object",
        "properties": {
            "name": {
                "type": "str",
                "description": "Name of the step."
            },
            "key": {
                "type": "str",
                "description": "Unique identifier for the step."
            },
            "description": {
                "type": "str",
                "description": "An exhaustic description of what this step is trying to achieve and accomplish."
            },
        },
        "required": ["name", "key", "description"],
    }
    """
    schema = model.model_json_schema()

    def clean_property(prop: dict, full_schema: dict) -> dict:
        """Clean up a property schema to match desired format"""

        if "description" not in prop:
            raise ValueError(f"Property {prop} lacks a 'description' key")

        if "type" not in prop and "$ref" in prop:
            prop["type"] = "object"

        # Handle the case where the property is a $ref to another model
        if "$ref" in prop:
            # Resolve the reference to the nested model
            ref_schema = resolve_ref(prop["$ref"], full_schema)
            # Recursively clean the nested model
            return {
                "type": "object",
                **clean_schema(ref_schema, full_schema),
                "description": prop["description"],
            }

        # Handle the case where the property uses anyOf (e.g., Optional types)
        if "anyOf" in prop:
            # For Optional types, extract the non-null type
            non_null_types = [t for t in prop["anyOf"] if t.get("type") != "null"]
            if len(non_null_types) == 1:
                # Simple Optional[T] case - use the non-null type
                return {
                    "type": non_null_types[0]["type"],
                    "description": prop["description"],
                }
            else:
                # Complex anyOf case - not supported yet
                raise ValueError(f"Complex anyOf patterns are not supported: {prop}")

        # If it's a regular property with a direct type (e.g., string, number)
        return {
            "type": "string" if prop["type"] == "string" else prop["type"],
            "description": prop["description"],
        }

    def resolve_ref(ref: str, schema: dict) -> dict:
        """Resolve a $ref reference in the schema"""
        if not ref.startswith("#/$defs/"):
            raise ValueError(f"Unexpected reference format: {ref}")

        model_name = ref.split("/")[-1]
        if model_name not in schema.get("$defs", {}):
            raise ValueError(f"Reference {model_name} not found in schema definitions")

        return schema["$defs"][model_name]

    def clean_schema(schema_part: dict, full_schema: dict) -> dict:
        """Clean up a schema part, handling references and nested structures"""
        # Handle $ref
        if "$ref" in schema_part:
            schema_part = resolve_ref(schema_part["$ref"], full_schema)

        if "type" not in schema_part:
            raise ValueError(f"Schema part lacks a 'type' key: {schema_part}")

        # Handle array type
        if schema_part["type"] == "array":
            items_schema = schema_part["items"]
            if "$ref" in items_schema:
                items_schema = resolve_ref(items_schema["$ref"], full_schema)
            return {"type": "array", "items": clean_schema(items_schema, full_schema), "description": schema_part.get("description", "")}

        # Handle object type
        if schema_part["type"] == "object":
            if "properties" not in schema_part:
                raise ValueError(f"Object schema lacks 'properties' key: {schema_part}")

            properties = {}
            for name, prop in schema_part["properties"].items():
                if "items" in prop:  # Handle arrays
                    if "description" not in prop:
                        raise ValueError(f"Property {prop} lacks a 'description' key")
                    properties[name] = {
                        "type": "array",
                        "items": clean_schema(prop["items"], full_schema),
                        "description": prop["description"],
                    }
                else:
                    properties[name] = clean_property(prop, full_schema)

            pydantic_model_schema_dict = {
                "type": "object",
                "properties": properties,
                "required": schema_part.get("required", []),
            }
            if "description" in schema_part:
                pydantic_model_schema_dict["description"] = schema_part["description"]

            return pydantic_model_schema_dict

        # Handle primitive types
        return clean_property(schema_part)

    return clean_schema(schema_part=schema, full_schema=schema)


def generate_schema(function, name: Optional[str] = None, description: Optional[str] = None, tool_id: Optional[str] = None) -> dict:
    # Validate that the function has a Google Python style docstring
    try:
        validate_google_style_docstring(function)
    except ValueError as e:
        logger.warning(
            f"Function `{function.__name__}` in module `{function.__module__}` "
            f"{'(tool_id=' + tool_id + ') ' if tool_id else ''}"
            f"is not in Google style docstring format. "
            f"Docstring received:\n{repr(function.__doc__[:200]) if function.__doc__ else 'None'}"
            f"\nError: {str(e)}"
        )

    # Get the signature of the function
    sig = inspect.signature(function)

    # Parse the docstring
    docstring = parse(function.__doc__)

    if not description:
        # Support multiline docstrings for complex functions, TODO (cliandy): consider having this as a setting
        # Always prefer combining short + long description when both exist
        if docstring.short_description and docstring.long_description:
            description = f"{docstring.short_description}\n\n{docstring.long_description}"
        elif docstring.short_description:
            description = docstring.short_description
        elif docstring.long_description:
            description = docstring.long_description
        else:
            description = "No description available"

        examples_section = extract_examples_section(function.__doc__)
        if examples_section and "Examples:" not in description:
            description = f"{description}\n\n{examples_section}"

    # Prepare the schema dictionary
    schema = {
        "name": function.__name__ if name is None else name,
        "description": description,
        "parameters": {"type": "object", "properties": {}, "required": []},
    }

    # TODO: ensure that 'agent' keyword is reserved for `Agent` class

    for param in sig.parameters.values():
        # Exclude 'self' parameter
        # TODO: eventually remove this (only applies to BASE_TOOLS)
        if param.name in ["self", "agent_state"]:  # Add agent_manager to excluded
            continue

        # Assert that the parameter has a type annotation
        if param.annotation == inspect.Parameter.empty:
            raise TypeError(f"Parameter '{param.name}' in function '{function.__name__}' lacks a type annotation")

        # Find the parameter's description in the docstring
        param_doc = next((d for d in docstring.params if d.arg_name == param.name), None)

        # Assert that the parameter has a description
        if not param_doc or not param_doc.description:
            raise ValueError(f"Parameter '{param.name}' in function '{function.__name__}' lacks a description in the docstring")

        # If the parameter is a pydantic model, we need to unpack the Pydantic model type into a JSON schema object
        # if inspect.isclass(param.annotation) and issubclass(param.annotation, BaseModel):
        if (
            (inspect.isclass(param.annotation) or inspect.isclass(get_origin(param.annotation) or param.annotation))
            and not get_origin(param.annotation)
            and issubclass(param.annotation, BaseModel)
        ):
            # print("Generating schema for pydantic model:", param.annotation)
            # Extract the properties from the pydantic model
            schema["parameters"]["properties"][param.name] = pydantic_model_to_json_schema(param.annotation)
            schema["parameters"]["properties"][param.name]["description"] = param_doc.description

        # Otherwise, we convert the Python typing to JSON schema types
        # NOTE: important - if a dict or list, the internal type can be a Pydantic model itself
        #                   however in that
        else:
            # print("Generating schema for non-pydantic model:", param.annotation)
            # Grab the description for the parameter from the extended docstring
            # If it doesn't exist, we should raise an error
            param_doc = next((d for d in docstring.params if d.arg_name == param.name), None)
            if not param_doc:
                raise ValueError(f"Parameter '{param.name}' in function '{function.__name__}' lacks a description in the docstring")
            elif not isinstance(param_doc.description, str):
                raise ValueError(
                    f"Parameter '{param.name}' in function '{function.__name__}' has a description in the docstring that is not a string (type: {type(param_doc.description)})"
                )
            else:
                # If it's a string or a basic type, then all you need is: (1) type, (2) description
                # If it's a more complex type, then you also need either:
                # - for array, you need "items", each of which has "type"
                # - for a dict, you need "properties", which has keys which each have "type"
                if param.annotation != inspect.Parameter.empty:
                    param_generated_schema = type_to_json_schema_type(param.annotation)
                else:
                    # TODO why are we inferring here?
                    param_generated_schema = {"type": "string"}

                # Add in the description
                param_generated_schema["description"] = param_doc.description

                # Add the schema to the function arg key
                schema["parameters"]["properties"][param.name] = param_generated_schema

        # If the parameter doesn't have a default value, it is required (so we need to add it to the required list)
        if param.default == inspect.Parameter.empty and not is_optional(param.annotation):
            schema["parameters"]["required"].append(param.name)

        # TODO what's going on here?
        # If the parameter is a list of strings we need to hard cast to "string" instead of `str`
        if get_origin(param.annotation) is list:
            if get_args(param.annotation)[0] is str:
                schema["parameters"]["properties"][param.name]["items"] = {"type": "string"}

        # TODO is this not duplicating the other append directly above?
        if param.annotation == inspect.Parameter.empty:
            schema["parameters"]["required"].append(param.name)
    return schema


def extract_examples_section(docstring: Optional[str]) -> Optional[str]:
    """Extracts the 'Examples:' section from a Google-style docstring.

    Args:
        docstring (Optional[str]): The full docstring of a function.

    Returns:
        Optional[str]: The extracted examples section, or None if not found.
    """
    if not docstring or "Examples:" not in docstring:
        return None

    lines = docstring.strip().splitlines()
    in_examples = False
    examples_lines = []

    for line in lines:
        stripped = line.strip()

        if not in_examples and stripped.startswith("Examples:"):
            in_examples = True
            examples_lines.append(line)
            continue

        if in_examples:
            if stripped and not line.startswith(" ") and stripped.endswith(":"):
                break
            examples_lines.append(line)

    return "\n".join(examples_lines).strip() if examples_lines else None


def generate_schema_from_args_schema_v2(
    args_schema: Type[BaseModel], name: Optional[str] = None, description: Optional[str] = None, append_heartbeat: bool = True
) -> Dict[str, Any]:
    properties = {}
    required = []
    for field_name, field in args_schema.model_fields.items():
        field_type_annotation = field.annotation
        properties[field_name] = type_to_json_schema_type(field_type_annotation)
        properties[field_name]["description"] = field.description
        if field.is_required():
            required.append(field_name)

    function_call_json = {
        "name": name,
        "description": description,
        "parameters": {"type": "object", "properties": properties, "required": required},
    }

    if append_heartbeat:
        function_call_json["parameters"]["properties"][REQUEST_HEARTBEAT_PARAM] = {
            "type": "boolean",
            "description": REQUEST_HEARTBEAT_DESCRIPTION,
        }
        function_call_json["parameters"]["required"].append(REQUEST_HEARTBEAT_PARAM)

    return function_call_json


def generate_tool_schema_for_mcp(
    mcp_tool: MCPTool,
    append_heartbeat: bool = True,
    strict: bool = False,
) -> Dict[str, Any]:

    # MCP tool.inputSchema is a JSON schema
    # https://github.com/modelcontextprotocol/python-sdk/blob/775f87981300660ee957b63c2a14b448ab9c3675/src/mcp/types.py#L678
    parameters_schema = mcp_tool.inputSchema
    name = mcp_tool.name
    description = mcp_tool.description

    assert "type" in parameters_schema, parameters_schema
    assert "properties" in parameters_schema, parameters_schema
    # assert "required" in parameters_schema, parameters_schema

    # Zero-arg tools often omit "required" because nothing is required.
    # Normalise so downstream code can treat it consistently.
    parameters_schema.setdefault("required", [])

    # Add the optional heartbeat parameter
    if append_heartbeat:
        parameters_schema["properties"][REQUEST_HEARTBEAT_PARAM] = {
            "type": "boolean",
            "description": REQUEST_HEARTBEAT_DESCRIPTION,
        }
        parameters_schema["required"].append(REQUEST_HEARTBEAT_PARAM)

    # Return the final schema
    if strict:
        # https://platform.openai.com/docs/guides/function-calling#strict-mode

        # Add additionalProperties: False
        parameters_schema["additionalProperties"] = False

        return {
            "strict": True,  # NOTE
            "name": name,
            "description": description,
            "parameters": parameters_schema,
        }
    else:
        return {
            "name": name,
            "description": description,
            "parameters": parameters_schema,
        }


def generate_tool_schema_for_composio(
    parameters_model: ActionParametersModel,
    name: str,
    description: str,
    append_heartbeat: bool = True,
    strict: bool = False,
) -> Dict[str, Any]:
    properties_json = {}
    required_fields = parameters_model.required or []

    # Extract properties from the ActionParametersModel
    for field_name, field_props in parameters_model.properties.items():
        # Initialize the property structure
        property_schema = {
            "type": field_props["type"],
            "description": field_props.get("description", ""),
        }

        # Handle optional default values
        if "default" in field_props:
            property_schema["default"] = field_props["default"]

        # Handle enumerations
        if "enum" in field_props:
            property_schema["enum"] = field_props["enum"]

        # Handle array item types
        if field_props["type"] == "array":
            if "items" in field_props:
                property_schema["items"] = field_props["items"]
            elif "anyOf" in field_props:
                property_schema["items"] = [t for t in field_props["anyOf"] if "items" in t][0]["items"]

        # Add the property to the schema
        properties_json[field_name] = property_schema

    # Add the optional heartbeat parameter
    if append_heartbeat:
        properties_json[REQUEST_HEARTBEAT_PARAM] = {
            "type": "boolean",
            "description": REQUEST_HEARTBEAT_DESCRIPTION,
        }
        required_fields.append(REQUEST_HEARTBEAT_PARAM)

    # Return the final schema
    if strict:
        # https://platform.openai.com/docs/guides/function-calling#strict-mode
        return {
            "name": name,
            "description": description,
            "strict": True,  # NOTE
            "parameters": {
                "type": "object",
                "properties": properties_json,
                "additionalProperties": False,  # NOTE
                "required": required_fields,
            },
        }
    else:
        return {
            "name": name,
            "description": description,
            "parameters": {
                "type": "object",
                "properties": properties_json,
                "required": required_fields,
            },
        }
