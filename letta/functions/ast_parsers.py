import ast
import builtins
import json
import typing
from typing import Dict, Optional, Tuple

from letta.errors import LettaToolCreateError
from letta.types import JsonDict


def resolve_type(annotation: str):
    """
    Resolve a type annotation string into a Python type.
    Previously, primitive support for int, float, str, dict, list, set, tuple, bool.

    Args:
        annotation (str): The annotation string (e.g., 'int', 'list[int]', 'dict[str, int]').

    Returns:
        type: The corresponding Python type.

    Raises:
        ValueError: If the annotation is unsupported or invalid.
    """
    python_types = {**vars(typing), **vars(builtins)}

    if annotation in python_types:
        return python_types[annotation]

    try:
        # Allow use of typing and builtins in a safe eval context
        return eval(annotation, python_types)
    except Exception:
        raise ValueError(f"Unsupported annotation: {annotation}")


# TODO :: THIS MUST BE EDITED TO HANDLE THINGS
def get_function_annotations_from_source(source_code: str, function_name: str) -> Dict[str, str]:
    """
    Parse the source code to extract annotations for a given function name.

    Args:
        source_code (str): The Python source code containing the function.
        function_name (str): The name of the function to extract annotations for.

    Returns:
        Dict[str, str]: A dictionary of argument names to their annotation strings.

    Raises:
        ValueError: If the function is not found in the source code.
    """
    tree = ast.parse(source_code)
    for node in ast.iter_child_nodes(tree):
        if isinstance(node, ast.FunctionDef) and node.name == function_name:
            annotations = {}
            for arg in node.args.args:
                if arg.annotation is not None:
                    annotation_str = ast.unparse(arg.annotation)
                    annotations[arg.arg] = annotation_str
            return annotations
    raise ValueError(f"Function '{function_name}' not found in the provided source code.")


# NOW json_loads -> ast.literal_eval -> typing.get_origin
def coerce_dict_args_by_annotations(function_args: JsonDict, annotations: Dict[str, str]) -> dict:
    coerced_args = dict(function_args)  # Shallow copy

    for arg_name, value in coerced_args.items():
        if arg_name in annotations:
            annotation_str = annotations[arg_name]
            try:
                arg_type = resolve_type(annotation_str)

                # Always parse strings using literal_eval or json if possible
                if isinstance(value, str):
                    try:
                        value = json.loads(value)
                    except json.JSONDecodeError:
                        try:
                            value = ast.literal_eval(value)
                        except (SyntaxError, ValueError) as e:
                            if arg_type is not str:
                                raise ValueError(f"Failed to coerce argument '{arg_name}' to {annotation_str}: {e}")

                origin = typing.get_origin(arg_type)
                if origin in (list, dict, tuple, set):
                    # Let the origin (e.g., list) handle coercion
                    coerced_args[arg_name] = origin(value)
                else:
                    # Coerce simple types (e.g., int, float)
                    coerced_args[arg_name] = arg_type(value)

            except Exception as e:
                raise ValueError(f"Failed to coerce argument '{arg_name}' to {annotation_str}: {e}")

    return coerced_args


def get_function_name_and_docstring(source_code: str, name: Optional[str] = None) -> Tuple[str, str]:
    """Gets the name and docstring for a given function source code by parsing the AST.

    Args:
        source_code: The source code to parse
        name: Optional override for the function name

    Returns:
        Tuple of (function_name, docstring)
    """
    try:
        # Parse the source code into an AST
        tree = ast.parse(source_code)

        # Find the last function definition
        function_def = None
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                function_def = node

        if not function_def:
            raise LettaToolCreateError("No function definition found in source code")

        # Get the function name
        function_name = name if name is not None else function_def.name

        # Get the docstring if it exists
        docstring = ast.get_docstring(function_def)

        if not function_name:
            raise LettaToolCreateError("Could not determine function name")

        if not docstring:
            raise LettaToolCreateError("Docstring is missing")

        return function_name, docstring

    except Exception as e:
        import traceback

        traceback.print_exc()
        raise LettaToolCreateError(f"Failed to parse function name and docstring: {str(e)}")
