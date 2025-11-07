from letta.constants import DEFAULT_MAX_STEPS
from letta.schemas.agent import AgentState
from letta.schemas.enums import DuplicateFileHandling
from letta.schemas.letta_message import MessageType
from letta.schemas.message import MessageCreate
from letta.schemas.user import User


class LettuceClient:
    """Base class for LettuceClient."""

    def __init__(self):
        """Initialize the LettuceClient."""
        self.client: None = None

    @classmethod
    async def create(cls) -> "LettuceClient":
        """
        Asynchronously creates the client.

        Returns:
            LettuceClient: The created LettuceClient instance.
        """
        instance = cls()
        return instance

    def get_client(self) -> None:
        """
        Get the inner client.

        Returns:
            None: The inner client.
        """
        return self.client

    async def get_status(self, run_id: str) -> str | None:
        """
        Get the status of a run.

        Args:
            run_id (str): The ID of the run.

        Returns:
            str | None: The status of the run or None if not available.
        """
        return None

    async def cancel(self, run_id: str) -> str | None:
        """
        Cancel a run.

        Args:
            run_id (str): The ID of the run to cancel.

        Returns:
            str | None: The ID of the canceled run or None if not available.
        """
        return None

    async def step(
        self,
        agent_state: AgentState,
        actor: User,
        input_messages: list[MessageCreate],
        max_steps: int = DEFAULT_MAX_STEPS,
        run_id: str | None = None,
        use_assistant_message: bool = True,
        include_return_message_types: list[MessageType] | None = None,
        request_start_timestamp_ns: int | None = None,
    ) -> str | None:
        """
        Execute the agent loop on Lettuce service.

        Args:
            agent_state (AgentState): The state of the agent.
            actor (User): The actor.
            input_messages (list[MessageCreate]): The input messages.
            max_steps (int, optional): The maximum number of steps. Defaults to DEFAULT_MAX_STEPS.
            run_id (str | None, optional): The ID of the run. Defaults to None.
            use_assistant_message (bool, optional): Whether to use the assistant message. Defaults to True.
            include_return_message_types (list[MessageType] | None, optional): The message types to include in the return. Defaults to None.
            request_start_timestamp_ns (int | None, optional): The start timestamp of the request. Defaults to None.

        Returns:
            str | None: The ID of the run or None if client is not available.
        """
        return None

    async def upload_file_to_folder(
        self,
        *,
        folder_id: str,
        actor_id: str,
        file_name: str,
        content: bytes,
        content_type: str | None = None,
        duplicate_handling: DuplicateFileHandling | None = None,
        override_name: str | None = None,
    ):
        """Kick off upload workflow. Base client does nothing and returns None."""
        return None
