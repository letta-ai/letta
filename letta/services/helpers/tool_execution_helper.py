import os
import platform
import subprocess
import venv
from typing import TYPE_CHECKING, Dict, Optional

from datamodel_code_generator import DataModelType, PythonVersion
from datamodel_code_generator.model import get_data_model_types
from datamodel_code_generator.parser.jsonschema import JsonSchemaParser

from letta.log import get_logger
from letta.schemas.sandbox_config import LocalSandboxConfig

if TYPE_CHECKING:
    from letta.schemas.tool import Tool

logger = get_logger(__name__)


def find_python_executable(local_configs: LocalSandboxConfig) -> str:
    """
    Determines the Python executable path based on sandbox configuration and platform.
    Resolves any '~' (tilde) paths to absolute paths.

    Returns:
        str: Full path to the Python binary.
    """
    sandbox_dir = os.path.expanduser(local_configs.sandbox_dir)  # Expand tilde

    if not local_configs.use_venv:
        return "python.exe" if platform.system().lower().startswith("win") else "python3"

    venv_path = os.path.join(sandbox_dir, local_configs.venv_name)
    python_exec = (
        os.path.join(venv_path, "Scripts", "python.exe")
        if platform.system().startswith("Win")
        else os.path.join(venv_path, "bin", "python3")
    )

    if not os.path.isfile(python_exec):
        raise FileNotFoundError(f"Python executable not found: {python_exec}. Ensure the virtual environment exists.")

    return python_exec


def run_subprocess(command: list, env: Optional[Dict[str, str]] = None, fail_msg: str = "Command failed"):
    """
    Helper to execute a subprocess with logging and error handling.

    Args:
        command (list): The command to run as a list of arguments.
        env (dict, optional): The environment variables to use for the process.
        fail_msg (str): The error message to log in case of failure.

    Raises:
        RuntimeError: If the subprocess execution fails.
    """
    logger.info(f"Running command: {' '.join(command)}")
    try:
        result = subprocess.run(command, check=True, capture_output=True, text=True, env=env)
        logger.info(f"Command successful. Output:\n{result.stdout}")
        return result.stdout
    except subprocess.CalledProcessError as e:
        logger.error(f"{fail_msg}\nSTDOUT:\n{e.stdout}\nSTDERR:\n{e.stderr}")
        raise RuntimeError(f"{fail_msg}: {e.stderr.strip()}") from e
    except Exception as e:
        logger.error(f"{fail_msg}: {e}")
        raise RuntimeError(f"{fail_msg}: {e}")


def ensure_pip_is_up_to_date(python_exec: str, env: Optional[Dict[str, str]] = None):
    """
    Ensures pip, setuptools, and wheel are up to date before installing any other dependencies.

    Args:
        python_exec (str): Path to the Python executable to use.
        env (dict, optional): Environment variables to pass to subprocess.
    """
    run_subprocess(
        [python_exec, "-m", "pip", "install", "--upgrade", "pip", "setuptools", "wheel"],
        env=env,
        fail_msg="Failed to upgrade pip, setuptools, and wheel.",
    )


def install_pip_requirements_for_sandbox(
    local_configs: LocalSandboxConfig,
    upgrade: bool = True,
    user_install_if_no_venv: bool = False,
    env: Optional[Dict[str, str]] = None,
    tool: Optional["Tool"] = None,
):
    """
    Installs the specified pip requirements inside the correct environment (venv or system).
    Installs both sandbox-level and tool-specific pip requirements.
    """
    sandbox_dir = os.path.expanduser(local_configs.sandbox_dir)  # Expand tilde
    local_configs.sandbox_dir = sandbox_dir  # Update the object to store the absolute path

    python_exec = find_python_executable(local_configs)

    # If using a virtual environment, upgrade pip before installing dependencies.
    if local_configs.use_venv:
        ensure_pip_is_up_to_date(python_exec, env=env)

    # Collect all pip requirements
    all_packages = []

    # Add sandbox-level pip requirements
    if local_configs.pip_requirements:
        packages = [f"{req.name}=={req.version}" if req.version else req.name for req in local_configs.pip_requirements]
        all_packages.extend(packages)
        logger.debug(f"Added sandbox pip requirements: {packages}")

    # Add tool-specific pip requirements
    if tool and tool.pip_requirements:
        tool_packages = [str(req) for req in tool.pip_requirements]
        all_packages.extend(tool_packages)
        logger.debug(f"Added tool pip requirements for {tool.name}: {tool_packages}")

    if not all_packages:
        logger.debug("No pip requirements specified; skipping installation.")
        return

    # Construct pip install command
    pip_cmd = [python_exec, "-m", "pip", "install"]
    if upgrade:
        pip_cmd.append("--upgrade")
    pip_cmd += all_packages

    if user_install_if_no_venv and not local_configs.use_venv:
        pip_cmd.append("--user")

    # Enhanced error message for better debugging
    sandbox_packages = [f"{req.name}=={req.version}" if req.version else req.name for req in (local_configs.pip_requirements or [])]
    tool_packages = [str(req) for req in (tool.pip_requirements if tool and tool.pip_requirements else [])]

    error_details = []
    if sandbox_packages:
        error_details.append(f"sandbox requirements: {', '.join(sandbox_packages)}")
    if tool_packages:
        error_details.append(f"tool requirements: {', '.join(tool_packages)}")

    context = f" ({'; '.join(error_details)})" if error_details else ""
    fail_msg = f"Failed to install pip packages{context}. This may be due to package version incompatibility. Consider updating package versions or removing version constraints."

    run_subprocess(pip_cmd, env=env, fail_msg=fail_msg)


def create_venv_for_local_sandbox(sandbox_dir_path: str, venv_path: str, env: Dict[str, str], force_recreate: bool):
    """
    Creates a virtual environment for the sandbox. If force_recreate is True, deletes and recreates the venv.

    Args:
        sandbox_dir_path (str): Path to the sandbox directory.
        venv_path (str): Path to the virtual environment directory.
        env (dict): Environment variables to use.
        force_recreate (bool): If True, delete and recreate the virtual environment.
    """
    sandbox_dir_path = os.path.expanduser(sandbox_dir_path)
    venv_path = os.path.expanduser(venv_path)

    # If venv exists and force_recreate is True, delete it
    if force_recreate and os.path.isdir(venv_path):
        logger.warning(f"Force recreating virtual environment at: {venv_path}")
        import shutil

        shutil.rmtree(venv_path)

    # Create venv if it does not exist
    if not os.path.isdir(venv_path):
        logger.info(f"Creating new virtual environment at {venv_path}")
        venv.create(venv_path, with_pip=True)

    pip_path = os.path.join(venv_path, "bin", "pip")
    try:
        # Step 2: Upgrade pip
        logger.info("Upgrading pip in the virtual environment...")
        subprocess.run([pip_path, "install", "--upgrade", "pip"], env=env, check=True)

        # Step 3: Install packages from requirements.txt if available
        requirements_txt_path = os.path.join(sandbox_dir_path, "requirements.txt")
        if os.path.isfile(requirements_txt_path):
            logger.info(f"Installing packages from requirements file: {requirements_txt_path}")
            subprocess.run([pip_path, "install", "-r", requirements_txt_path], env=env, check=True)
            logger.info("Successfully installed packages from requirements.txt")
        else:
            logger.warning("No requirements.txt file found. Skipping package installation.")

    except subprocess.CalledProcessError as e:
        logger.error(f"Error while setting up the virtual environment: {e}")
        raise RuntimeError(f"Failed to set up the virtual environment: {e}")


def add_imports_and_pydantic_schemas_for_args(args_json_schema: dict) -> str:
    data_model_types = get_data_model_types(DataModelType.PydanticV2BaseModel, target_python_version=PythonVersion.PY_311)
    parser = JsonSchemaParser(
        str(args_json_schema),
        data_model_type=data_model_types.data_model,
        data_model_root_type=data_model_types.root_model,
        data_model_field_type=data_model_types.field_model,
        data_type_manager_type=data_model_types.data_type_manager,
        dump_resolve_reference_action=data_model_types.dump_resolve_reference_action,
    )
    result = parser.parse()
    return result


def prepare_local_sandbox(
    local_cfg: LocalSandboxConfig,
    env: Dict[str, str],
    force_recreate: bool = False,
) -> None:
    """
    Ensure the sandbox virtual-env is freshly created and that
    requirements are installed.  Uses your existing helpers.
    """
    sandbox_dir = os.path.expanduser(local_cfg.sandbox_dir)
    venv_path = os.path.join(sandbox_dir, local_cfg.venv_name)

    create_venv_for_local_sandbox(
        sandbox_dir_path=sandbox_dir,
        venv_path=venv_path,
        env=env,
        force_recreate=force_recreate,
    )

    install_pip_requirements_for_sandbox(
        local_cfg,
        upgrade=True,
        user_install_if_no_venv=False,
        env=env,
    )
