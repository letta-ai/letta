import ast
import importlib
import inspect
from collections.abc import Callable
from textwrap import dedent  # remove indentation
from types import ModuleType
from typing import Any, Dict, List, Literal, Optional

from letta.errors import LettaToolCreateError
from letta.functions.schema_generator import generate_schema

# NOTE: THIS FILE WILL BE DEPRECATED


class MockFunction:
    """A mock function object that mimics the attributes expected by generate_schema."""

    def __init__(self, name: str, docstring: str, signature: inspect.Signature):
        self.__name__ = name
        self.__doc__ = docstring
        self.__signature__ = signature

    def __call__(self, *args, **kwargs):
        raise NotImplementedError("This is a mock function and cannot be called")


def _parse_type_annotation(annotation_node: ast.AST, imports_map: Dict[str, Any]) -> Any:
    """Parse an AST type annotation node back into a Python type object."""
    if annotation_node is None:
        return inspect.Parameter.empty

    if isinstance(annotation_node, ast.Name):
        type_name = annotation_node.id
        return imports_map.get(type_name, type_name)

    elif isinstance(annotation_node, ast.Subscript):
        # Generic type like 'List[str]', 'Optional[int]'
        value_name = annotation_node.value.id if isinstance(annotation_node.value, ast.Name) else str(annotation_node.value)
        origin_type = imports_map.get(value_name, value_name)

        # Parse the slice (the part inside the brackets)
        if isinstance(annotation_node.slice, ast.Name):
            slice_type = _parse_type_annotation(annotation_node.slice, imports_map)
            if hasattr(origin_type, "__getitem__"):
                try:
                    return origin_type[slice_type]
                except (TypeError, AttributeError):
                    pass
            return f"{origin_type}[{slice_type}]"
        else:
            slice_type = _parse_type_annotation(annotation_node.slice, imports_map)
            if hasattr(origin_type, "__getitem__"):
                try:
                    return origin_type[slice_type]
                except (TypeError, AttributeError):
                    pass
            return f"{origin_type}[{slice_type}]"

    else:
        # Fallback - return string representation
        return ast.unparse(annotation_node)


def _build_imports_map(tree: ast.AST) -> Dict[str, Any]:
    """Build a mapping of imported names to their Python objects."""
    imports_map = {
        "Optional": Optional,
        "List": List,
        "Dict": Dict,
        "Literal": Literal,
        # Built-in types
        "str": str,
        "int": int,
        "bool": bool,
        "float": float,
        "list": list,
        "dict": dict,
    }

    # Try to resolve Pydantic imports if they exist in the source
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            if node.module == "pydantic":
                for alias in node.names:
                    if alias.name == "BaseModel":
                        try:
                            from pydantic import BaseModel

                            imports_map["BaseModel"] = BaseModel
                        except ImportError:
                            pass
                    elif alias.name == "Field":
                        try:
                            from pydantic import Field

                            imports_map["Field"] = Field
                        except ImportError:
                            pass
        elif isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name == "typing":
                    imports_map.update(
                        {
                            "typing.Optional": Optional,
                            "typing.List": List,
                            "typing.Dict": Dict,
                            "typing.Literal": Literal,
                        }
                    )

    return imports_map


def _extract_pydantic_classes(tree: ast.AST, imports_map: Dict[str, Any]) -> Dict[str, Any]:
    """Extract Pydantic model classes from the AST and create them dynamically."""
    pydantic_classes = {}

    # Check if BaseModel is available
    if "BaseModel" not in imports_map:
        return pydantic_classes

    BaseModel = imports_map["BaseModel"]
    Field = imports_map.get("Field")

    # First pass: collect all class definitions
    class_definitions = []
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef):
            # Check if this class inherits from BaseModel
            inherits_basemodel = False
            for base in node.bases:
                if isinstance(base, ast.Name) and base.id == "BaseModel":
                    inherits_basemodel = True
                    break

            if inherits_basemodel:
                class_definitions.append(node)

    # Create classes in order, handling dependencies
    created_classes = {}
    remaining_classes = class_definitions.copy()

    while remaining_classes:
        progress_made = False

        for node in remaining_classes.copy():
            class_name = node.name

            # Try to create this class
            try:
                fields = {}
                annotations = {}

                # Parse class body for field definitions
                for stmt in node.body:
                    if isinstance(stmt, ast.AnnAssign) and isinstance(stmt.target, ast.Name):
                        field_name = stmt.target.id

                        # Update imports_map with already created classes for type resolution
                        current_imports = {**imports_map, **created_classes}
                        field_annotation = _parse_type_annotation(stmt.annotation, current_imports)
                        annotations[field_name] = field_annotation

                        # Handle Field() definitions
                        if stmt.value and isinstance(stmt.value, ast.Call):
                            if isinstance(stmt.value.func, ast.Name) and stmt.value.func.id == "Field" and Field:
                                # Parse Field arguments
                                field_kwargs = {}
                                for keyword in stmt.value.keywords:
                                    if keyword.arg == "description":
                                        if isinstance(keyword.value, ast.Constant):
                                            field_kwargs["description"] = keyword.value.value

                                # Handle positional args for required fields
                                if stmt.value.args:
                                    try:
                                        default_val = ast.literal_eval(stmt.value.args[0])
                                        if default_val == ...:  # Ellipsis means required
                                            pass  # Field is required, no default
                                        else:
                                            field_kwargs["default"] = default_val
                                    except:
                                        pass

                                fields[field_name] = Field(**field_kwargs)
                            else:
                                # Not a Field call, try to evaluate the default value
                                try:
                                    default_val = ast.literal_eval(stmt.value)
                                    fields[field_name] = default_val
                                except:
                                    pass

                # Create the dynamic Pydantic model
                model_dict = {"__annotations__": annotations, **fields}

                DynamicModel = type(class_name, (BaseModel,), model_dict)
                created_classes[class_name] = DynamicModel
                remaining_classes.remove(node)
                progress_made = True

            except Exception:
                # This class might depend on others, try later
                continue

        if not progress_made:
            # If we can't make progress, create remaining classes without proper field types
            for node in remaining_classes:
                class_name = node.name
                # Create a minimal mock class
                MockModel = type(class_name, (BaseModel,), {})
                created_classes[class_name] = MockModel
            break

    return created_classes


def _parse_function_from_source(source_code: str, desired_name: Optional[str] = None) -> MockFunction:
    """Parse a function from source code without executing it."""
    try:
        tree = ast.parse(source_code)
    except SyntaxError as e:
        raise LettaToolCreateError(f"Failed to parse source code: {e}")

    # Build imports mapping and find pydantic classes
    imports_map = _build_imports_map(tree)
    pydantic_classes = _extract_pydantic_classes(tree, imports_map)
    imports_map.update(pydantic_classes)

    # Find function definitions
    functions = []
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            functions.append(node)

    if not functions:
        raise LettaToolCreateError("No functions found in source code")

    # Use the last function (matching original behavior)
    func_node = functions[-1]

    # Extract function name
    func_name = func_node.name

    # Extract docstring
    docstring = None
    if (
        func_node.body
        and isinstance(func_node.body[0], ast.Expr)
        and isinstance(func_node.body[0].value, ast.Constant)
        and isinstance(func_node.body[0].value.value, str)
    ):
        docstring = func_node.body[0].value.value

    if not docstring:
        raise LettaToolCreateError(f"Function {func_name} missing docstring")

    # Build function signature
    parameters = []
    for arg in func_node.args.args:
        param_name = arg.arg
        param_annotation = _parse_type_annotation(arg.annotation, imports_map)

        # Handle default values
        defaults_offset = len(func_node.args.args) - len(func_node.args.defaults)
        param_index = func_node.args.args.index(arg)

        if param_index >= defaults_offset:
            default_index = param_index - defaults_offset
            try:
                default_value = ast.literal_eval(func_node.args.defaults[default_index])
            except (ValueError, TypeError):
                # Can't evaluate the default, use Parameter.empty
                default_value = inspect.Parameter.empty
            param = inspect.Parameter(
                param_name, inspect.Parameter.POSITIONAL_OR_KEYWORD, annotation=param_annotation, default=default_value
            )
        else:
            param = inspect.Parameter(param_name, inspect.Parameter.POSITIONAL_OR_KEYWORD, annotation=param_annotation)
        parameters.append(param)

    signature = inspect.Signature(parameters)

    return MockFunction(func_name, docstring, signature)


def derive_openai_json_schema(source_code: str, name: Optional[str] = None) -> dict:
    """Derives the OpenAI JSON schema for a given function source code.

    Parses the source code statically to extract function signature and docstring,
    then generates the schema without executing any code.

    Limitations:
    - Complex nested Pydantic models with forward references may not be fully supported
    - Only basic Pydantic Field definitions are parsed (description, ellipsis for required)
    - Simple types (str, int, bool, float, list, dict) and basic Pydantic models work well
    """
    try:
        # Parse the function from source code without executing it
        mock_func = _parse_function_from_source(source_code, name)

        # Generate schema using the mock function
        try:
            schema = generate_schema(mock_func, name=name)
            return schema
        except TypeError as e:
            raise LettaToolCreateError(f"Type error in schema generation: {str(e)}")
        except ValueError as e:
            raise LettaToolCreateError(f"Value error in schema generation: {str(e)}")
        except Exception as e:
            raise LettaToolCreateError(f"Unexpected error in schema generation: {str(e)}")

    except Exception as e:
        import traceback

        traceback.print_exc()
        raise LettaToolCreateError(f"Schema generation failed: {str(e)}") from e


def parse_source_code(func) -> str:
    """Parse the source code of a function and remove indendation"""
    source_code = dedent(inspect.getsource(func))
    return source_code


# TODO (cliandy) refactor below two funcs
def get_function_from_module(module_name: str, function_name: str) -> Callable[..., Any]:
    """
    Dynamically imports a function from a specified module.

    Args:
        module_name (str): The name of the module to import (e.g., 'base').
        function_name (str): The name of the function to retrieve.

    Returns:
        Callable: The imported function.

    Raises:
        ModuleNotFoundError: If the specified module cannot be found.
        AttributeError: If the function is not found in the module.
    """
    try:
        # Dynamically import the module
        module = importlib.import_module(module_name)
        # Retrieve the function
        return getattr(module, function_name)
    except ModuleNotFoundError:
        raise ModuleNotFoundError(f"Module '{module_name}' not found.")
    except AttributeError:
        raise AttributeError(f"Function '{function_name}' not found in module '{module_name}'.")


def get_json_schema_from_module(module_name: str, function_name: str) -> dict:
    """
    Dynamically loads a specific function from a module and generates its JSON schema.

    Args:
        module_name (str): The name of the module to import (e.g., 'base').
        function_name (str): The name of the function to retrieve.

    Returns:
        dict: The JSON schema for the specified function.

    Raises:
        ModuleNotFoundError: If the specified module cannot be found.
        AttributeError: If the function is not found in the module.
        ValueError: If the attribute is not a user-defined function.
    """
    try:
        # Dynamically import the module
        module = importlib.import_module(module_name)

        # Retrieve the function
        attr = getattr(module, function_name, None)

        # Check if it's a user-defined function
        if not (inspect.isfunction(attr) and attr.__module__ == module.__name__):
            raise ValueError(f"'{function_name}' is not a user-defined function in module '{module_name}'")

        # Generate schema (assuming a `generate_schema` function exists)
        generated_schema = generate_schema(attr)

        return generated_schema
    except ModuleNotFoundError:
        raise ModuleNotFoundError(f"Module '{module_name}' not found.")
    except AttributeError:
        raise AttributeError(f"Function '{function_name}' not found in module '{module_name}'.")


def load_function_set(module: ModuleType) -> dict:
    """Load the functions and generate schema for them, given a module object"""
    function_dict = {}

    for attr_name in dir(module):
        # Get the attribute
        attr = getattr(module, attr_name)

        # Check if it's a callable function and not a built-in or special method
        if inspect.isfunction(attr) and attr.__module__ == module.__name__:
            if attr_name in function_dict:
                raise ValueError(f"Found a duplicate of function name '{attr_name}'")

            generated_schema = generate_schema(attr)
            function_dict[attr_name] = {
                "module": inspect.getsource(module),
                "python_function": attr,
                "json_schema": generated_schema,
            }

    if len(function_dict) == 0:
        raise ValueError(f"No functions found in module {module}")
    return function_dict
