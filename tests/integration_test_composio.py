import pytest
from fastapi.testclient import TestClient

from letta.log import get_logger
from letta.server.rest_api.app import app
from letta.settings import tool_settings

logger = get_logger(__name__)


@pytest.fixture
def fastapi_client():
    return TestClient(app)


def test_list_composio_apps(fastapi_client):
    response = fastapi_client.get("/v1/tools/composio/apps")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_list_composio_actions_by_app(fastapi_client):
    response = fastapi_client.get("/v1/tools/composio/apps/github/actions")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_add_composio_tool(fastapi_client):
    response = fastapi_client.post("/v1/tools/composio/GITHUB_STAR_A_REPOSITORY_FOR_THE_AUTHENTICATED_USER")
    assert response.status_code == 200
    assert "id" in response.json()
    assert "name" in response.json()


def test_composio_version_on_e2b_matches_server(check_e2b_key_is_set):
    import composio
    from e2b_code_interpreter import Sandbox
    from packaging.version import Version

    sbx = Sandbox(tool_settings.e2b_sandbox_template_id)
    result = sbx.run_code(
        """
        import composio
        print(str(composio.__version__))
    """
    )
    e2b_composio_version = result.logs.stdout[0].strip()
    composio_version = str(composio.__version__)

    # Compare versions
    if Version(composio_version) > Version(e2b_composio_version):
        raise AssertionError(f"Local composio version {composio_version} is greater than server version {e2b_composio_version}")
    elif Version(composio_version) < Version(e2b_composio_version):
        logger.warning(
            f"Local version of composio {composio_version} is less than the E2B version: {e2b_composio_version}. Please upgrade your local composio version."
        )

    # Print concise summary
    logger.info(f"Server version: {composio_version}, E2B version: {e2b_composio_version}")
