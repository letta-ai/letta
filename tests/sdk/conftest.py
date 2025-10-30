import os
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

import pytest
import requests
from dotenv import load_dotenv
from letta_client import Letta


@pytest.fixture(scope="session")
def server_url() -> str:
    """
    Provides the URL for the Letta server.
    If LETTA_SERVER_URL is not set, starts the server in a background thread
    and polls until it's accepting connections.
    """

    def _run_server() -> None:
        load_dotenv()
        from letta.server.rest_api.app import start_server

        start_server(debug=True)

    url: str = os.getenv("LETTA_SERVER_URL", "http://localhost:8283")

    if not os.getenv("LETTA_SERVER_URL"):
        thread = threading.Thread(target=_run_server, daemon=True)
        thread.start()

        # Poll until the server is up (or timeout)
        timeout_seconds = 30
        deadline = time.time() + timeout_seconds
        while time.time() < deadline:
            try:
                resp = requests.get(url + "/v1/health")
                if resp.status_code < 500:
                    break
            except requests.exceptions.RequestException:
                pass
            time.sleep(0.1)
        else:
            raise RuntimeError(f"Could not reach {url} within {timeout_seconds}s")

    return url


# This fixture creates a client for each test module
@pytest.fixture(scope="session")
def client(server_url):
    print("Running client tests with server:", server_url)

    # Overide the base_url if the LETTA_API_URL is set
    api_url = os.getenv("LETTA_API_URL")
    base_url = api_url if api_url else server_url
    # create the Letta client
    yield Letta(base_url=base_url, token=None, timeout=300.0)


def skip_test_if_not_implemented(handler, resource_name, test_name):
    if not hasattr(handler, test_name):
        pytest.skip(f"client.{resource_name}.{test_name} not implemented")


def create_test_module(
    resource_name: str,
    id_param_name: str,
    create_params: List[Tuple[str, Dict[str, Any], Dict[str, Any], Optional[Exception]]] = [],
    upsert_params: List[Tuple[str, Dict[str, Any], Dict[str, Any], Optional[Exception]]] = [],
    modify_params: List[Tuple[str, Dict[str, Any], Dict[str, Any], Optional[Exception]]] = [],
    list_params: List[Tuple[Dict[str, Any], int]] = [],
) -> Dict[str, Any]:
    """Create a test module for a resource.

    This function creates all the necessary test methods and returns them in a dictionary
    that can be added to the globals() of the module.

    Args:
        resource_name: Name of the resource (e.g., "blocks", "tools")
        id_param_name: Name of the ID parameter (e.g., "block_id", "tool_id")
        create_params: List of (name, params, expected_error) tuples for create tests
        modify_params: List of (name, params, expected_error) tuples for modify tests
        list_params: List of (query_params, expected_count) tuples for list tests

    Returns:
        Dict: A dictionary of all test functions that should be added to the module globals
    """
    # Create shared test state
    test_item_ids = {}

    # Create fixture functions
    @pytest.fixture(scope="session")
    def handler(client):
        return getattr(client, resource_name)

    @pytest.fixture(scope="session")
    def caren_agent(client, request):
        """Create an agent to be used as manager in supervisor groups."""
        agent = client.agents.create(
            name="caren_agent",
            model="openai/gpt-4o-mini",
            embedding="openai/text-embedding-3-small",
        )

        # Add finalizer to ensure cleanup happens in the right order
        request.addfinalizer(lambda: client.agents.delete(agent_id=agent.id))

        return agent

    # Create standalone test functions
    @pytest.mark.order(0)
    def test_create(handler, caren_agent, name, params, extra_expected_values, expected_error):
        """Test creating a resource."""
        skip_test_if_not_implemented(handler, resource_name, "create")

        # Use preprocess_params which adds fixtures
        processed_params = preprocess_params(params, caren_agent)
        processed_extra_expected = preprocess_params(extra_expected_values, caren_agent)

        try:
            item = handler.create(**processed_params)
        except Exception as e:
            if expected_error is not None:
                if hasattr(e, "status_code"):
                    assert e.status_code == expected_error
                elif hasattr(e, "status"):
                    assert e.status == expected_error
                else:
                    pytest.fail(f"Expected error with status {expected_error}, but got {type(e)}: {e}")
            else:
                raise e

        # Store item ID for later tests
        test_item_ids[name] = item.id

        # Verify item properties
        expected_values = processed_params | processed_extra_expected
        for key, value in expected_values.items():
            if hasattr(item, key):
                if key == "model" or key == "embedding":
                    # NOTE: add back these tests after v1 migration
                    continue
                print(f"item.{key}: {getattr(item, key)}")
                assert custom_model_dump(getattr(item, key)) == value, f"For key {key}, expected {value}, but got {getattr(item, key)}"

    @pytest.mark.order(1)
    def test_retrieve(handler):
        """Test retrieving resources."""
        skip_test_if_not_implemented(handler, resource_name, "retrieve")
        for name, item_id in test_item_ids.items():
            kwargs = {id_param_name: item_id}
            item = handler.retrieve(**kwargs)
            assert hasattr(item, "id") and item.id == item_id, f"{resource_name.capitalize()} {name} with id {item_id} not found"

    @pytest.mark.order(2)
    def test_upsert(handler, name, params, extra_expected_values, expected_error):
        """Test upserting resources."""
        skip_test_if_not_implemented(handler, resource_name, "upsert")
        existing_item_id = test_item_ids[name]
        try:
            item = handler.upsert(**params)
        except Exception as e:
            if expected_error is not None:
                if hasattr(e, "status_code"):
                    assert e.status_code == expected_error
                elif hasattr(e, "status"):
                    assert e.status == expected_error
                else:
                    pytest.fail(f"Expected error with status {expected_error}, but got {type(e)}: {e}")
            else:
                raise e

        assert existing_item_id == item.id

        # Verify item properties
        expected_values = params | extra_expected_values
        for key, value in expected_values.items():
            if hasattr(item, key):
                assert custom_model_dump(getattr(item, key)) == value

    @pytest.mark.order(3)
    def test_modify(handler, caren_agent, name, params, extra_expected_values, expected_error):
        """Test modifying a resource."""
        skip_test_if_not_implemented(handler, resource_name, "modify")
        if name not in test_item_ids:
            pytest.skip(f"Item '{name}' not found in test_items")

        kwargs = {id_param_name: test_item_ids[name]}
        kwargs.update(params)
        processed_params = preprocess_params(kwargs, caren_agent)
        processed_extra_expected = preprocess_params(extra_expected_values, caren_agent)

        try:
            item = handler.modify(**processed_params)
        except Exception as e:
            if expected_error is not None:
                assert isinstance(e, expected_error), f"Expected error with type {expected_error}, but got {type(e)}: {e}"
                return
            else:
                raise e

        # Verify item properties
        expected_values = processed_params | processed_extra_expected
        for key, value in expected_values.items():
            if hasattr(item, key):
                assert custom_model_dump(getattr(item, key)) == value

        # Verify via retrieve as well
        retrieve_kwargs = {id_param_name: item.id}
        retrieved_item = handler.retrieve(**retrieve_kwargs)

        expected_values = processed_params | processed_extra_expected
        for key, value in expected_values.items():
            if hasattr(retrieved_item, key):
                assert custom_model_dump(getattr(retrieved_item, key)) == value

    @pytest.mark.order(4)
    def test_list(handler, query_params, count):
        """Test listing resources."""
        skip_test_if_not_implemented(handler, resource_name, "list")
        all_items = handler.list(**query_params)

        test_items_list = [item.id for item in all_items if item.id in test_item_ids.values()]
        assert len(test_items_list) == count

    @pytest.mark.order(-1)
    def test_delete(handler):
        """Test deleting resources."""
        skip_test_if_not_implemented(handler, resource_name, "delete")
        for item_id in test_item_ids.values():
            kwargs = {id_param_name: item_id}
            handler.delete(**kwargs)

        for name, item_id in test_item_ids.items():
            try:
                kwargs = {id_param_name: item_id}
                item = handler.retrieve(**kwargs)
                raise AssertionError(f"{resource_name.capitalize()} {name} with id {item.id} was not deleted")
            except Exception as e:
                if isinstance(e, AssertionError):
                    raise e
                if hasattr(e, "status_code"):
                    assert e.status_code == 404, f"Expected 404 error, got {e.status_code}"
                else:
                    raise AssertionError(f"Unexpected error type: {type(e)}")

        test_item_ids.clear()

    # Create test methods dictionary
    result = {
        "handler": handler,
        "caren_agent": caren_agent,
        "test_create": pytest.mark.parametrize("name, params, extra_expected_values, expected_error", create_params)(test_create),
        "test_retrieve": test_retrieve,
        "test_upsert": pytest.mark.parametrize("name, params, extra_expected_values, expected_error", upsert_params)(test_upsert),
        "test_modify": pytest.mark.parametrize("name, params, extra_expected_values, expected_error", modify_params)(test_modify),
        "test_delete": test_delete,
        "test_list": pytest.mark.parametrize("query_params, count", list_params)(test_list),
    }

    return result


def custom_model_dump(model):
    """
    Dumps the given model to a form that can be easily compared.

    Args:
        model: The model to dump

    Returns:
        The dumped model
    """
    if isinstance(model, (str, int, float, bool, type(None))):
        return model
    if isinstance(model, list):
        return [custom_model_dump(item) for item in model]
    if isinstance(model, dict):
        return {key: custom_model_dump(value) for key, value in model.items()}
    else:
        return model.model_dump()


def add_fixture_params(value, caren_agent):
    """
    Replaces string values containing '.id' with their mapped values.

    Args:
        value: The value to process (should be a string)
        caren_agent: The agent object to use for ID replacement

    Returns:
        The processed value with ID strings replaced by actual values
    """
    param_to_fixture_mapping = {
        "caren_agent.id": caren_agent.id,
    }
    return param_to_fixture_mapping.get(value, value)


def preprocess_params(params, caren_agent):
    """
    Recursively processes a nested structure of dictionaries and lists,
    replacing string values containing '.id' with their mapped values.

    Args:
        params: The parameters to process (dict, list, or scalar value)
        caren_agent: The agent object to use for ID replacement

    Returns:
        The processed parameters with ID strings replaced by actual values
    """
    if isinstance(params, dict):
        # Process each key-value pair in the dictionary
        return {key: preprocess_params(value, caren_agent) for key, value in params.items()}
    elif isinstance(params, list):
        # Process each item in the list
        return [preprocess_params(item, caren_agent) for item in params]
    elif isinstance(params, str) and ".id" in params:
        # Replace string values containing '.id' with their mapped values
        return add_fixture_params(params, caren_agent)
    else:
        # Return other values unchanged
        return params
