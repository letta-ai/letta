import ast
import json
from typing import Dict

# Registry of known types for annotation resolution
BUILTIN_TYPES = {
    "int": int,
    "float": float,
    "str": str,
    "dict": dict,
    "list": list,
    "set": set,
    "tuple": tuple,
    "bool": bool,
}


def resolve_type(annotation: str):
    """
    Resolve a type annotation string into a Python type.

    Args:
        annotation (str): The annotation string (e.g., 'int', 'list', etc.).

    Returns:
        type: The corresponding Python type.

    Raises:
        ValueError: If the annotation is unsupported or invalid.
    """
    if annotation in BUILTIN_TYPES:
        return BUILTIN_TYPES[annotation]

    try:
        parsed = ast.literal_eval(annotation)
        if isinstance(parsed, type):
            return parsed
        raise ValueError(f"Annotation '{annotation}' is not a recognized type.")
    except (ValueError, SyntaxError):
        raise ValueError(f"Unsupported annotation: {annotation}")


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


def coerce_dict_args_by_annotations(function_args: dict, annotations: Dict[str, str]) -> dict:
    """
    Coerce arguments in a dictionary to their annotated types.

    Args:
        function_args (dict): The original function arguments.
        annotations (Dict[str, str]): Argument annotations as strings.

    Returns:
        dict: The updated dictionary with coerced argument types.

    Raises:
        ValueError: If type coercion fails for an argument.
    """
    coerced_args = dict(function_args)  # Shallow copy for mutation safety

    for arg_name, value in coerced_args.items():
        if arg_name in annotations:
            annotation_str = annotations[arg_name]
            try:
                # Resolve the type from the annotation
                arg_type = resolve_type(annotation_str)

                # Handle JSON-like inputs for dict and list types
                if arg_type in {dict, list} and isinstance(value, str):
                    try:
                        # First, try JSON parsing
                        value = json.loads(value)
                    except json.JSONDecodeError:
                        # Fall back to literal_eval for Python-specific literals
                        value = ast.literal_eval(value)

                # Coerce the value to the resolved type
                coerced_args[arg_name] = arg_type(value)
            except (TypeError, ValueError, json.JSONDecodeError, SyntaxError) as e:
                raise ValueError(f"Failed to coerce argument '{arg_name}' to {annotation_str}: {e}")
    return coerced_args
