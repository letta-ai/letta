import os
import random
import string
import time
from datetime import datetime, timezone
from typing import Dict, Iterator, List, Optional, Tuple

from letta_client import Letta, SystemMessage

from letta.config import LettaConfig
from letta.data_sources.connectors import DataConnector
from letta.functions.functions import parse_source_code
from letta.schemas.file import FileMetadata
from letta.schemas.tool import Tool
from letta.settings import TestSettings

from .constants import TIMEOUT


class DummyDataConnector(DataConnector):
    """Fake data connector for texting which yields document/passage texts from a provided list"""

    def __init__(self, texts: List[str]):
        self.texts = texts
        self.file_to_text = {}

    def find_files(self, source) -> Iterator[FileMetadata]:
        for text in self.texts:
            file_metadata = FileMetadata(
                source_id=source.id,
                file_name="",
                file_path="",
                file_type="",
                file_size=0,  # Set to 0 as a placeholder
                file_creation_date="1970-01-01",  # Placeholder date
                file_last_modified_date="1970-01-01",  # Placeholder date
                created_at=datetime.now(timezone.utc),
            )
            self.file_to_text[file_metadata.id] = text

            yield file_metadata

    def generate_passages(self, file: FileMetadata, chunk_size: int = 1024) -> Iterator[Tuple[str | Dict]]:
        yield self.file_to_text[file.id], {}


def wipe_config():
    test_settings = TestSettings()
    config_path = os.path.join(test_settings.letta_dir, "config")
    if os.path.exists(config_path):
        # delete
        os.remove(config_path)


def wipe_letta_home():
    """Wipes ~/.letta (moves to a backup), and initializes a new ~/.letta dir"""

    # Get the current timestamp in a readable format (e.g., YYYYMMDD_HHMMSS)
    timestamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d_%H%M%S")

    # Construct the new backup directory name with the timestamp
    backup_dir = f"~/.letta_test_backup_{timestamp}"

    # Use os.system to execute the 'mv' command
    os.system(f"mv ~/.letta {backup_dir}")

    # Setup the initial directory
    test_settings = TestSettings()
    config_path = os.path.join(test_settings.letta_dir, "config")
    config = LettaConfig(config_path=config_path)
    config.create_config_dir()


def configure_letta_localllm():
    import pexpect

    wipe_config()
    child = pexpect.spawn("letta configure")

    child.expect("Select LLM inference provider", timeout=TIMEOUT)
    child.send("\x1b[B")  # Send the down arrow key
    child.send("\x1b[B")  # Send the down arrow key
    child.sendline()

    child.expect("Select LLM backend", timeout=TIMEOUT)
    child.sendline()

    child.expect("Enter default endpoint", timeout=TIMEOUT)
    child.sendline()

    child.expect("Select default model wrapper", timeout=TIMEOUT)
    child.sendline()

    child.expect("Select your model's context window", timeout=TIMEOUT)
    child.sendline()

    child.expect("Select embedding provider", timeout=TIMEOUT)
    child.send("\x1b[B")  # Send the down arrow key
    child.send("\x1b[B")  # Send the down arrow key
    child.send("\x1b[B")  # Send the down arrow key
    child.sendline()

    child.expect("Select default preset", timeout=TIMEOUT)
    child.sendline()

    child.expect("Select default persona", timeout=TIMEOUT)
    child.sendline()

    child.expect("Select default human", timeout=TIMEOUT)
    child.sendline()

    child.expect("Select storage backend for archival data", timeout=TIMEOUT)
    child.sendline()

    child.sendline()

    child.expect(pexpect.EOF, timeout=TIMEOUT)  # Wait for child to exit
    child.close()
    assert child.isalive() is False, "CLI should have terminated."
    assert child.exitstatus == 0, "CLI did not exit cleanly."


def configure_letta(enable_openai=False, enable_azure=False):
    if enable_openai:
        raise NotImplementedError
    elif enable_azure:
        raise NotImplementedError
    else:
        configure_letta_localllm()


def wait_for_incoming_message(
    client: Letta,
    agent_id: str,
    substring: str = "[Incoming message from agent with ID",
    max_wait_seconds: float = 10.0,
    sleep_interval: float = 0.5,
) -> bool:
    """
    Polls for up to `max_wait_seconds` to see if the agent's message list
    contains a system message with `substring`.
    Returns True if found, otherwise False after timeout.
    """
    deadline = time.time() + max_wait_seconds

    while time.time() < deadline:
        messages = client.agents.messages.list(agent_id)[1:]

        # Check for the system message containing `substring`
        def get_message_text(message: SystemMessage) -> str:
            return message.content if message.content else ""

        if any(isinstance(message, SystemMessage) and substring in get_message_text(message) for message in messages):
            return True
        time.sleep(sleep_interval)

    return False


def wait_for_server(url, timeout=30, interval=0.5):
    """Wait for server to become available by polling the given URL."""
    import requests
    from requests.exceptions import ConnectionError

    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            response = requests.get(f"{url}/v1/health", timeout=2)
            if response.status_code == 200:
                return True
        except (ConnectionError, requests.Timeout):
            pass
        time.sleep(interval)

    raise TimeoutError(f"Server at {url} did not start within {timeout} seconds")


def random_string(length: int) -> str:
    return "".join(random.choices(string.ascii_letters + string.digits, k=length))


def create_tool_from_func(
    func,
    tags: Optional[List[str]] = None,
    description: Optional[str] = None,
):
    source_code = parse_source_code(func)
    source_type = "python"
    if not tags:
        tags = []

    return Tool(
        source_type=source_type,
        source_code=source_code,
        tags=tags,
        description=description,
    )
