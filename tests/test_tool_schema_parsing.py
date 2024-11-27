import json
import os

# from letta.functions.schema_generator import generate_schema
from letta.functions.functions import derive_openai_json_schema

# from .test_tool_schema_parsing_files.list_of_pydantic_example import create_task_plan


def _clean_diff(d1, d2):
    """Utility function to clean up the diff between two dictionaries."""

    # Keys in d1 but not in d2
    removed = {k: d1[k] for k in d1.keys() - d2.keys()}

    # Keys in d2 but not in d1
    added = {k: d2[k] for k in d2.keys() - d1.keys()}

    # Keys in both but values changed
    changed = {k: (d1[k], d2[k]) for k in d1.keys() & d2.keys() if d1[k] != d2[k]}

    return {k: v for k, v in {"removed": removed, "added": added, "changed": changed}.items() if v}  # Only include non-empty differences


def _compare_schemas(generated_schema: dict, expected_schema: dict, strip_heartbeat: bool = True):
    """Compare an autogenerated schema to an expected schema."""

    if strip_heartbeat:
        # Pop out the heartbeat parameter
        del generated_schema["parameters"]["properties"]["request_heartbeat"]
        # Remove from the required list
        generated_schema["parameters"]["required"].remove("request_heartbeat")

    # Check that the two schemas are equal
    # If not, pretty print the difference by dumping with indent=4
    if generated_schema != expected_schema:
        print("==== GENERATED SCHEMA ====")
        print(json.dumps(generated_schema, indent=4))
        print("==== EXPECTED SCHEMA ====")
        print(json.dumps(expected_schema, indent=4))
        print("==== DIFF ====")
        print(json.dumps(_clean_diff(generated_schema, expected_schema), indent=4))
        raise AssertionError("Schemas are not equal")
    else:
        print("Schemas are equal")


def _run_schema_test(schema_name: str, desired_function_name: str):
    """Load a file and compare the autogenerated schema to the expected schema."""

    # Open the python file as a string
    # Use the absolute path to make it easier to run the test from the root directory
    with open(os.path.join(os.path.dirname(__file__), f"test_tool_schema_parsing_files/{schema_name}.py"), "r") as file:
        source_code = file.read()

    # Derive the schema
    schema = derive_openai_json_schema(source_code, name=desired_function_name)

    # Assert that the schema matches the expected schema
    with open(os.path.join(os.path.dirname(__file__), f"test_tool_schema_parsing_files/{schema_name}.json"), "r") as file:
        expected_schema = json.load(file)

    _compare_schemas(schema, expected_schema)


def test_derive_openai_json_schema():
    """Test that the schema generator works across a variety of example source code inputs."""

    print("==== TESTING basic example where the arg is a pydantic model ====")
    _run_schema_test("list_of_pydantic_example", "create_task_plan")

    print("==== TESTING more complex example where the arg is a nested pydantic model ====")
    _run_schema_test("nested_pydantic_as_arg_example", "create_task_plan")

    print("==== TESTING simple function with no args ====")
    _run_schema_test("simple_d20", "roll_d20")

    print("==== TESTING complex function with many args ====")
    _run_schema_test("all_python_complex", "check_order_status")
