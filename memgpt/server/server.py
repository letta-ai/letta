import json
import subprocess
import logging
import uuid
from abc import abstractmethod
from functools import wraps
from threading import Lock
from typing import Union, Callable, Optional, List

from fastapi import HTTPException
import uvicorn

import memgpt.constants as constants
import memgpt.presets.presets as presets
import memgpt.server.utils as server_utils
import memgpt.system as system
from memgpt.agent import Agent, save_agent
from memgpt.agent_store.storage import StorageConnector, TableType

# from memgpt.llm_api_tools import openai_get_model_list, azure_openai_get_model_list, smart_urljoin
from memgpt.cli.cli_config import get_model_options
from memgpt.config import MemGPTConfig
from memgpt.constants import JSON_LOADS_STRICT, JSON_ENSURE_ASCII
from memgpt.credentials import MemGPTCredentials
from memgpt.data_sources.connectors import DataConnector, load_data
from memgpt.data_types import (
    User,
    Source,
    AgentState,
    LLMConfig,
    EmbeddingConfig,
    Message,
    Token,
    Preset,
)
from memgpt.interface import AgentInterface  # abstract

# TODO use custom interface
from memgpt.interface import CLIInterface  # for printing to terminal
from memgpt.metadata import MetadataStore

logger = logging.getLogger(__name__)


def generate_self_signed_cert(cert_path="selfsigned.crt", key_path="selfsigned.key"):
    """Generate a self-signed SSL certificate.

    NOTE: intended to be used for development only.
    """
    subprocess.run(
        [
            "openssl",
            "req",
            "-x509",
            "-newkey",
            "rsa:4096",
            "-keyout",
            key_path,
            "-out",
            cert_path,
            "-days",
            "365",
            "-nodes",
            "-subj",
            "/C=US/ST=Denial/L=Springfield/O=Dis/CN=localhost",
        ],
        check=True,
    )
    return cert_path, key_path


def start_server(
    config: MemGPTConfig,
    port: Optional[int] = None,
    host: Optional[str] = None,
    use_ssl: bool = False,
    ssl_cert: Optional[str] = None,
    ssl_key: Optional[str] = None,
    debug: bool = False,
):
    if debug:
        # Set the logging level
        logger.setLevel(logging.DEBUG)
        # Create a StreamHandler
        stream_handler = logging.StreamHandler()
        # Set the formatter (optional)
        formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
        stream_handler.setFormatter(formatter)
        # Add the handler to the logger
        logger.addHandler(stream_handler)

    if use_ssl:
        if ssl_cert is None:  # No certificate path provided, generate a self-signed certificate
            ssl_certfile, ssl_keyfile = generate_self_signed_cert()
            print(f"Running server with self-signed SSL cert: {ssl_certfile}, {ssl_keyfile}")
        else:
            ssl_certfile, ssl_keyfile = ssl_cert, ssl_key  # Assuming cert includes both
            print(f"Running server with provided SSL cert: {ssl_certfile}, {ssl_keyfile}")

        # This will start the server on HTTPS
        assert isinstance(ssl_certfile, str) and os.path.exists(ssl_certfile), ssl_certfile
        assert isinstance(ssl_keyfile, str) and os.path.exists(ssl_keyfile), ssl_keyfile
        print(
            f"Running: uvicorn {app}:app --host {host or 'localhost'} --port {port or REST_DEFAULT_PORT} --ssl-keyfile {ssl_keyfile} --ssl-certfile {ssl_certfile}"
        )
        uvicorn.run(
            app,
            host=host or "localhost",
            port=port or REST_DEFAULT_PORT,
            ssl_keyfile=ssl_keyfile,
            ssl_certfile=ssl_certfile,
        )
    else:
        # Start the subprocess in a new session
        print(f"Running: uvicorn {app}:app --host {host or 'localhost'} --port {port or REST_DEFAULT_PORT}")
        uvicorn.run(
            app,
            host=host or "localhost",
            port=port or REST_DEFAULT_PORT,
        )


class Server(object):
    """Abstract server class that supports multi-agent multi-user"""

    @abstractmethod
    def list_agents(self, user_id: uuid.UUID) -> dict:
        """List all available agents to a user"""
        raise NotImplementedError

    @abstractmethod
    def get_agent_messages(self, user_id: uuid.UUID, agent_id: uuid.UUID, start: int, count: int) -> list:
        """Paginated query of in-context messages in agent message queue"""
        raise NotImplementedError

    @abstractmethod
    def get_agent_memory(self, user_id: uuid.UUID, agent_id: uuid.UUID) -> dict:
        """Return the memory of an agent (core memory + non-core statistics)"""
        raise NotImplementedError

    @abstractmethod
    def get_agent_config(self, user_id: uuid.UUID, agent_id: uuid.UUID) -> dict:
        """Return the config of an agent"""
        raise NotImplementedError

    @abstractmethod
    def get_server_config(self, user_id: uuid.UUID) -> dict:
        """Return the base config"""
        raise NotImplementedError

    @abstractmethod
    def update_agent_core_memory(self, user_id: uuid.UUID, agent_id: uuid.UUID, new_memory_contents: dict) -> dict:
        """Update the agents core memory block, return the new state"""
        raise NotImplementedError

    @abstractmethod
    def create_agent(
        self,
        user_id: uuid.UUID,
        agent_config: Union[dict, AgentState],
        interface: Union[AgentInterface, None],
        # persistence_manager: Union[PersistenceManager, None],
    ) -> str:
        """Create a new agent using a config"""
        raise NotImplementedError

    @abstractmethod
    def user_message(self, user_id: uuid.UUID, agent_id: uuid.UUID, message: str) -> None:
        """Process a message from the user, internally calls step"""
        raise NotImplementedError

    @abstractmethod
    def system_message(self, user_id: uuid.UUID, agent_id: uuid.UUID, message: str) -> None:
        """Process a message from the system, internally calls step"""
        raise NotImplementedError

    @abstractmethod
    def run_command(self, user_id: uuid.UUID, agent_id: uuid.UUID, command: str) -> Union[str, None]:
        """Run a command on the agent, e.g. /memory

        May return a string with a message generated by the command
        """
        raise NotImplementedError


class LockingServer(Server):
    """Basic support for concurrency protections (all requests that modify an agent lock the agent until the operation is complete)"""

    # Locks for each agent
    _agent_locks = {}

    @staticmethod
    def agent_lock_decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(self, user_id: uuid.UUID, agent_id: uuid.UUID, *args, **kwargs):
            # logger.info("Locking check")

            # Initialize the lock for the agent_id if it doesn't exist
            if agent_id not in self._agent_locks:
                # logger.info(f"Creating lock for agent_id = {agent_id}")
                self._agent_locks[agent_id] = Lock()

            # Check if the agent is currently locked
            if not self._agent_locks[agent_id].acquire(blocking=False):
                # logger.info(f"agent_id = {agent_id} is busy")
                raise HTTPException(status_code=423, detail=f"Agent '{agent_id}' is currently busy.")

            try:
                # Execute the function
                # logger.info(f"running function on agent_id = {agent_id}")
                print("USERID", user_id)
                return func(self, user_id, agent_id, *args, **kwargs)
            finally:
                # Release the lock
                # logger.info(f"releasing lock on agent_id = {agent_id}")
                self._agent_locks[agent_id].release()

        return wrapper

    @agent_lock_decorator
    def user_message(self, user_id: uuid.UUID, agent_id: uuid.UUID, message: str) -> None:
        raise NotImplementedError

    @agent_lock_decorator
    def run_command(self, user_id: uuid.UUID, agent_id: uuid.UUID, command: str) -> Union[str, None]:
        raise NotImplementedError


class SyncServer(LockingServer):
    """Simple single-threaded / blocking server process"""

    def __init__(
        self,
        chaining: bool = True,
        max_chaining_steps: bool = None,
        # default_interface_cls: AgentInterface = CLIInterface,
        default_interface: AgentInterface = CLIInterface(),
        # default_persistence_manager_cls: PersistenceManager = LocalStateManager,
        # auth_mode: str = "none",  # "none, "jwt", "external"
    ):
        """Server process holds in-memory agents that are being run"""

        # Server supports several auth modes:
        # "none":
        #   no authentication, trust the incoming requests to have access to the user_id being modified
        # "jwt_local":
        #   clients send bearer JWT tokens, which decode to user_ids
        #   JWT tokens are generated by the server process (using pyJWT) and stored in a database table
        # "jwt_external":
        #   clients still send bearer JWT tokens, but token generation and validation is handled by an external service
        #   ie the server process will call 'external.decode(token)' to get the user_id
        # if auth_mode == "none":
        #     self.auth_mode = auth_mode
        #     raise NotImplementedError  # TODO
        # elif auth_mode == "jwt_local":
        #     self.auth_mode = auth_mode
        # elif auth_mode == "jwt_external":
        #     self.auth_mode = auth_mode
        #     raise NotImplementedError  # TODO
        # else:
        #     raise ValueError(auth_mode)

        # List of {'user_id': user_id, 'agent_id': agent_id, 'agent': agent_obj} dicts
        self.active_agents = []

        # chaining = whether or not to run again if request_heartbeat=true
        self.chaining = chaining

        # if chaining == true, what's the max number of times we'll chain before yielding?
        # none = no limit, can go on forever
        self.max_chaining_steps = max_chaining_steps

        # The default interface that will get assigned to agents ON LOAD
        # self.default_interface_cls = default_interface_cls
        self.default_interface = default_interface

        # The default persistence manager that will get assigned to agents ON CREATION
        # self.default_persistence_manager_cls = default_persistence_manager_cls

        # Initialize the connection to the DB
        self.config = MemGPTConfig.load()
        assert self.config.persona is not None, "Persona must be set in the config"
        assert self.config.human is not None, "Human must be set in the config"

        # TODO figure out how to handle credentials for the server
        self.credentials = MemGPTCredentials.load()

        # Ensure valid database configuration
        # TODO: add back once tests are matched
        # assert (
        #    self.config.metadata_storage_type == "postgres"
        # ), f"Invalid metadata_storage_type for server: {self.config.metadata_storage_type}"
        # assert (
        #    self.config.archival_storage_type == "postgres"
        # ), f"Invalid archival_storage_type for server: {self.config.archival_storage_type}"
        # assert self.config.recall_storage_type == "postgres", f"Invalid recall_storage_type for server: {self.config.recall_storage_type}"

        # Generate default LLM/Embedding configs for the server
        # TODO: we may also want to do the same thing with default persona/human/etc.
        self.server_llm_config = LLMConfig(
            model=self.config.default_llm_config.model,
            model_endpoint_type=self.config.default_llm_config.model_endpoint_type,
            model_endpoint=self.config.default_llm_config.model_endpoint,
            model_wrapper=self.config.default_llm_config.model_wrapper,
            context_window=self.config.default_llm_config.context_window,
            # openai_key=self.credentials.openai_key,
            # azure_key=self.credentials.azure_key,
            # azure_endpoint=self.credentials.azure_endpoint,
            # azure_version=self.credentials.azure_version,
            # azure_deployment=self.credentials.azure_deployment,
        )
        self.server_embedding_config = EmbeddingConfig(
            embedding_endpoint_type=self.config.default_embedding_config.embedding_endpoint_type,
            embedding_endpoint=self.config.default_embedding_config.embedding_endpoint,
            embedding_dim=self.config.default_embedding_config.embedding_dim,
            # openai_key=self.credentials.openai_key,
        )

        # Initialize the metadata store
        self.ms = MetadataStore(self.config)

        # NOTE: removed, since server should be multi-user
        ## Create the default user
        # base_user_id = uuid.UUID(self.config.anon_clientid)
        # if not self.ms.get_user(user_id=base_user_id):
        #    base_user = User(id=base_user_id)
        #    self.ms.create_user(base_user)

    def save_agents(self):
        """Saves all the agents that are in the in-memory object store"""
        for agent_d in self.active_agents:
            try:
                # agent_d["agent"].save()
                save_agent(agent_d["agent"], self.ms)
                logger.info(f"Saved agent {agent_d['agent_id']}")
            except Exception as e:
                logger.exception(f"Error occurred while trying to save agent {agent_d['agent_id']}:\n{e}")

    def _get_agent(self, user_id: uuid.UUID, agent_id: uuid.UUID) -> Union[Agent, None]:
        """Get the agent object from the in-memory object store"""
        for d in self.active_agents:
            if d["user_id"] == str(user_id) and d["agent_id"] == str(agent_id):
                return d["agent"]
        return None

    def _add_agent(self, user_id: uuid.UUID, agent_id: uuid.UUID, agent_obj: Agent) -> None:
        """Put an agent object inside the in-memory object store"""
        # Make sure the agent doesn't already exist
        if self._get_agent(user_id=user_id, agent_id=agent_id) is not None:
            # Can be triggered on concucrent request, so don't throw a full error
            # raise KeyError(f"Agent (user={user_id}, agent={agent_id}) is already loaded")
            logger.exception(f"Agent (user={user_id}, agent={agent_id}) is already loaded")
            return
        # Add Agent instance to the in-memory list
        self.active_agents.append(
            {
                "user_id": str(user_id),
                "agent_id": str(agent_id),
                "agent": agent_obj,
            }
        )

    def _load_agent(self, user_id: uuid.UUID, agent_id: uuid.UUID, interface: Union[AgentInterface, None] = None) -> Agent:
        """Loads a saved agent into memory (if it doesn't exist, throw an error)"""
        assert isinstance(user_id, uuid.UUID), user_id
        assert isinstance(agent_id, uuid.UUID), agent_id

        # If an interface isn't specified, use the default
        if interface is None:
            interface = self.default_interface

        try:
            logger.info(f"Grabbing agent user_id={user_id} agent_id={agent_id} from database")
            agent_state = self.ms.get_agent(agent_id=agent_id, user_id=user_id)
            if not agent_state:
                logger.exception(f"agent_id {agent_id} does not exist")
                raise ValueError(f"agent_id {agent_id} does not exist")
            # print(f"server._load_agent :: load got agent state {agent_id}, messages = {agent_state.state['messages']}")

            # Instantiate an agent object using the state retrieved
            logger.info(f"Creating an agent object")
            memgpt_agent = Agent(agent_state=agent_state, interface=interface)

            # Add the agent to the in-memory store and return its reference
            logger.info(f"Adding agent to the agent cache: user_id={user_id}, agent_id={agent_id}")
            self._add_agent(user_id=user_id, agent_id=agent_id, agent_obj=memgpt_agent)
            return memgpt_agent

        except Exception as e:
            logger.exception(f"Error occurred while trying to get agent {agent_id}:\n{e}")
            raise

    def _get_or_load_agent(self, user_id: uuid.UUID, agent_id: uuid.UUID) -> Agent:
        """Check if the agent is in-memory, then load"""
        logger.info(f"Checking for agent user_id={user_id} agent_id={agent_id}")
        memgpt_agent = self._get_agent(user_id=user_id, agent_id=agent_id)
        if not memgpt_agent:
            logger.info(f"Agent not loaded, loading agent user_id={user_id} agent_id={agent_id}")
            memgpt_agent = self._load_agent(user_id=user_id, agent_id=agent_id)
        return memgpt_agent

    def _step(self, user_id: uuid.UUID, agent_id: uuid.UUID, input_message: Union[str, Message]) -> int:
        """Send the input message through the agent"""

        logger.debug(f"Got input message: {input_message}")

        # Get the agent object (loaded in memory)
        memgpt_agent = self._get_or_load_agent(user_id=user_id, agent_id=agent_id)
        if memgpt_agent is None:
            raise KeyError(f"Agent (user={user_id}, agent={agent_id}) is not loaded")

        logger.debug(f"Starting agent step")
        no_verify = True
        next_input_message = input_message
        counter = 0
        while True:
            new_messages, heartbeat_request, function_failed, token_warning, tokens_accumulated = memgpt_agent.step(
                next_input_message,
                first_message=False,
                skip_verify=no_verify,
                return_dicts=False,
            )
            counter += 1

            # Chain stops
            if not self.chaining:
                logger.debug("No chaining, stopping after one step")
                break
            elif self.max_chaining_steps is not None and counter > self.max_chaining_steps:
                logger.debug(f"Hit max chaining steps, stopping after {counter} steps")
                break
            # Chain handlers
            elif token_warning:
                next_input_message = system.get_token_limit_warning()
                continue  # always chain
            elif function_failed:
                next_input_message = system.get_heartbeat(constants.FUNC_FAILED_HEARTBEAT_MESSAGE)
                continue  # always chain
            elif heartbeat_request:
                next_input_message = system.get_heartbeat(constants.REQ_HEARTBEAT_MESSAGE)
                continue  # always chain
            # MemGPT no-op / yield
            else:
                break

        memgpt_agent.interface.step_yield()
        logger.debug(f"Finished agent step")

        return tokens_accumulated

    def _command(self, user_id: uuid.UUID, agent_id: uuid.UUID, command: str) -> Union[str, None]:
        """Process a CLI command"""

        logger.debug(f"Got command: {command}")

        # Get the agent object (loaded in memory)
        memgpt_agent = self._get_or_load_agent(user_id=user_id, agent_id=agent_id)
        # print("AGENT", memgpt_agent.agent_state.id, memgpt_agent.agent_state.user_id)

        if command.lower() == "exit":
            # exit not supported on server.py
            raise ValueError(command)

        elif command.lower() == "save" or command.lower() == "savechat":
            save_agent(memgpt_agent, self.ms)

        elif command.lower() == "attach":
            # Different from CLI, we extract the data source name from the command
            command = command.strip().split()
            try:
                data_source = int(command[1])
            except:
                raise ValueError(command)

            # attach data to agent from source
            source_connector = StorageConnector.get_storage_connector(TableType.PASSAGES, self.config, user_id=user_id)
            memgpt_agent.attach_source(data_source, source_connector, self.ms)

        elif command.lower() == "dump" or command.lower().startswith("dump "):
            # Check if there's an additional argument that's an integer
            command = command.strip().split()
            amount = int(command[1]) if len(command) > 1 and command[1].isdigit() else 0
            if amount == 0:
                memgpt_agent.interface.print_messages(memgpt_agent.messages, dump=True)
            else:
                memgpt_agent.interface.print_messages(memgpt_agent.messages[-min(amount, len(memgpt_agent.messages)) :], dump=True)

        elif command.lower() == "dumpraw":
            memgpt_agent.interface.print_messages_raw(memgpt_agent.messages)

        elif command.lower() == "memory":
            ret_str = (
                f"\nDumping memory contents:\n"
                + f"\n{str(memgpt_agent.memory)}"
                + f"\n{str(memgpt_agent.persistence_manager.archival_memory)}"
                + f"\n{str(memgpt_agent.persistence_manager.recall_memory)}"
            )
            return ret_str

        elif command.lower() == "pop" or command.lower().startswith("pop "):
            # Check if there's an additional argument that's an integer
            command = command.strip().split()
            pop_amount = int(command[1]) if len(command) > 1 and command[1].isdigit() else 3
            n_messages = len(memgpt_agent.messages)
            MIN_MESSAGES = 2
            if n_messages <= MIN_MESSAGES:
                logger.info(f"Agent only has {n_messages} messages in stack, none left to pop")
            elif n_messages - pop_amount < MIN_MESSAGES:
                logger.info(f"Agent only has {n_messages} messages in stack, cannot pop more than {n_messages - MIN_MESSAGES}")
            else:
                logger.info(f"Popping last {pop_amount} messages from stack")
                for _ in range(min(pop_amount, len(memgpt_agent.messages))):
                    memgpt_agent.messages.pop()

        elif command.lower() == "retry":
            # TODO this needs to also modify the persistence manager
            logger.info(f"Retrying for another answer")
            while len(memgpt_agent.messages) > 0:
                if memgpt_agent.messages[-1].get("role") == "user":
                    # we want to pop up to the last user message and send it again
                    memgpt_agent.messages[-1].get("content")
                    memgpt_agent.messages.pop()
                    break
                memgpt_agent.messages.pop()

        elif command.lower() == "rethink" or command.lower().startswith("rethink "):
            # TODO this needs to also modify the persistence manager
            if len(command) < len("rethink "):
                logger.warning("Missing text after the command")
            else:
                for x in range(len(memgpt_agent.messages) - 1, 0, -1):
                    if memgpt_agent.messages[x].get("role") == "assistant":
                        text = command[len("rethink ") :].strip()
                        memgpt_agent.messages[x].update({"content": text})
                        break

        elif command.lower() == "rewrite" or command.lower().startswith("rewrite "):
            # TODO this needs to also modify the persistence manager
            if len(command) < len("rewrite "):
                logger.warning("Missing text after the command")
            else:
                for x in range(len(memgpt_agent.messages) - 1, 0, -1):
                    if memgpt_agent.messages[x].get("role") == "assistant":
                        text = command[len("rewrite ") :].strip()
                        args = json.loads(memgpt_agent.messages[x].get("function_call").get("arguments"), strict=JSON_LOADS_STRICT)
                        args["message"] = text
                        memgpt_agent.messages[x].get("function_call").update(
                            {"arguments": json.dumps(args, ensure_ascii=JSON_ENSURE_ASCII)}
                        )
                        break

        # No skip options
        elif command.lower() == "wipe":
            # exit not supported on server.py
            raise ValueError(command)

        elif command.lower() == "heartbeat":
            input_message = system.get_heartbeat()
            self._step(user_id=user_id, agent_id=agent_id, input_message=input_message)

        elif command.lower() == "memorywarning":
            input_message = system.get_token_limit_warning()
            self._step(user_id=user_id, agent_id=agent_id, input_message=input_message)

    @LockingServer.agent_lock_decorator
    def user_message(self, user_id: uuid.UUID, agent_id: uuid.UUID, message: Union[str, Message]) -> None:
        """Process an incoming user message and feed it through the MemGPT agent"""
        if self.ms.get_user(user_id=user_id) is None:
            raise ValueError(f"User user_id={user_id} does not exist")
        if self.ms.get_agent(agent_id=agent_id, user_id=user_id) is None:
            raise ValueError(f"Agent agent_id={agent_id} does not exist")

        # Basic input sanitization
        if isinstance(message, str):
            if len(message) == 0:
                raise ValueError(f"Invalid input: '{message}'")

            # If the input begins with a command prefix, reject
            elif message.startswith("/"):
                raise ValueError(f"Invalid input: '{message}'")
            packaged_user_message = system.package_user_message(user_message=message)
        elif isinstance(message, Message):
            if len(message.text) == 0:
                raise ValueError(f"Invalid input: '{message.text}'")

            # If the input begins with a command prefix, reject
            elif message.text.startswith("/"):
                raise ValueError(f"Invalid input: '{message.text}'")
            packaged_user_message = message
        else:
            raise ValueError(f"Invalid input: '{message}'")

        # Run the agent state forward
        self._step(user_id=user_id, agent_id=agent_id, input_message=packaged_user_message)

    @LockingServer.agent_lock_decorator
    def system_message(self, user_id: uuid.UUID, agent_id: uuid.UUID, message: str) -> None:
        """Process an incoming system message and feed it through the MemGPT agent"""
        if self.ms.get_user(user_id=user_id) is None:
            raise ValueError(f"User user_id={user_id} does not exist")
        if self.ms.get_agent(agent_id=agent_id, user_id=user_id) is None:
            raise ValueError(f"Agent agent_id={agent_id} does not exist")

        # Basic input sanitization
        if not isinstance(message, str) or len(message) == 0:
            raise ValueError(f"Invalid input: '{message}'")

        # If the input begins with a command prefix, reject
        elif message.startswith("/"):
            raise ValueError(f"Invalid input: '{message}'")

        # Else, process it as a user message to be fed to the agent
        else:
            # Package the user message first
            packaged_system_message = system.package_system_message(system_message=message)
            # Run the agent state forward
            self._step(user_id=user_id, agent_id=agent_id, input_message=packaged_system_message)

    @LockingServer.agent_lock_decorator
    def run_command(self, user_id: uuid.UUID, agent_id: uuid.UUID, command: str) -> Union[str, None]:
        """Run a command on the agent"""
        if self.ms.get_user(user_id=user_id) is None:
            raise ValueError(f"User user_id={user_id} does not exist")
        if self.ms.get_agent(agent_id=agent_id, user_id=user_id) is None:
            raise ValueError(f"Agent agent_id={agent_id} does not exist")

        # If the input begins with a command prefix, attempt to process it as a command
        if command.startswith("/"):
            if len(command) > 1:
                command = command[1:]  # strip the prefix
        return self._command(user_id=user_id, agent_id=agent_id, command=command)

    def create_user(
        self,
        user_config: Optional[Union[dict, User]] = {},
    ):
        """Create a new user using a config"""
        if not isinstance(user_config, dict):
            raise ValueError(f"user_config must be provided as a dictionary")

        user = User(
            id=user_config["id"] if "id" in user_config else None,
        )
        self.ms.create_user(user)
        logger.info(f"Created new user from config: {user}")
        return user

    def create_agent(
        self,
        user_id: uuid.UUID,
        name: Optional[str] = None,
        preset: Optional[str] = None,
        persona: Optional[str] = None,
        human: Optional[str] = None,
        llm_config: Optional[LLMConfig] = None,
        embedding_config: Optional[EmbeddingConfig] = None,
        interface: Union[AgentInterface, None] = None,
        # persistence_manager: Union[PersistenceManager, None] = None,
        function_names: Optional[List[str]] = None,  # TODO remove
    ) -> AgentState:
        """Create a new agent using a config"""
        if self.ms.get_user(user_id=user_id) is None:
            raise ValueError(f"User user_id={user_id} does not exist")

        if interface is None:
            # interface = self.default_interface_cls()
            interface = self.default_interface

        # if persistence_manager is None:
        # persistence_manager = self.default_persistence_manager_cls(agent_config=agent_config)

        logger.debug(f"Attempting to find user: {user_id}")
        user = self.ms.get_user(user_id=user_id)
        if not user:
            raise ValueError(f"cannot find user with associated client id: {user_id}")

        # NOTE: you MUST add to the metadata store before creating the agent, otherwise the storage connectors will error on creation
        # TODO: fix this db dependency and remove
        # self.ms.create_agent(agent_state)

        try:
            preset_obj = self.ms.get_preset(name=preset if preset else self.config.preset, user_id=user_id)
            assert preset_obj is not None, f"preset {preset if preset else self.config.preset} does not exist"
            logger.debug(f"Attempting to create agent from preset:\n{preset_obj}")

            # Overwrite fields in the preset if they were specified
            preset_obj.human = human if human else self.config.human
            preset_obj.persona = persona if persona else self.config.persona

            llm_config = llm_config if llm_config else self.server_llm_config
            embedding_config = embedding_config if embedding_config else self.server_embedding_config

            # TODO remove (https://github.com/cpacker/MemGPT/issues/1138)
            if function_names is not None:
                available_tools = self.ms.list_tools(user_id=user_id)
                available_tools_names = [t.name for t in available_tools]
                assert all([f_name in available_tools_names for f_name in function_names])
                preset_obj.functions_schema = [t.json_schema for t in available_tools if t.name in function_names]
                print("overriding preset_obj tools with:", preset_obj.functions_schema)

            agent = Agent(
                interface=interface,
                preset=preset_obj,
                name=name,
                created_by=user.id,
                llm_config=llm_config,
                embedding_config=embedding_config,
                # gpt-3.5-turbo tends to omit inner monologue, relax this requirement for now
                first_message_verify_mono=True if (llm_config.model is not None and "gpt-4" in llm_config.model) else False,
            )
            save_agent(agent=agent, ms=self.ms)

            # FIXME: this is a hacky way to get the system prompts injected into agent into the DB
            # self.ms.update_agent(agent.agent_state)
        except Exception as e:
            logger.exception(e)
            try:
                self.ms.delete_agent(agent_id=agent.agent_state.id)
            except Exception as delete_e:
                logger.exception(f"Failed to delete_agent:\n{delete_e}")
            raise e

        save_agent(agent, self.ms)

        logger.info(f"Created new agent from config: {agent}")

        return agent.agent_state

    def delete_agent(
        self,
        user_id: uuid.UUID,
        agent_id: uuid.UUID,
    ):
        if self.ms.get_user(user_id=user_id) is None:
            raise ValueError(f"User user_id={user_id} does not exist")
        if self.ms.get_agent(agent_id=agent_id, user_id=user_id) is None:
            raise ValueError(f"Agent agent_id={agent_id} does not exist")

        # TODO: Make sure the user owns the agent
        agent = self.ms.get_agent(agent_id=agent_id, user_id=user_id)
        if agent is not None:
            self.ms.delete_agent(agent_id=agent_id)

    def initialize_default_presets(self, user_id: uuid.UUID):
        """Add default preset options into the metadata store"""
        presets.add_default_presets(user_id, self.ms)

    def create_preset(self, preset: Preset):
        """Create a new preset using a config"""
        if self.ms.get_user(user_id=preset.user_id) is None:
            raise ValueError(f"User user_id={preset.user_id} does not exist")

        self.ms.create_preset(preset)
        return preset

    def get_preset(
        self, preset_id: Optional[uuid.UUID] = None, preset_name: Optional[uuid.UUID] = None, user_id: Optional[uuid.UUID] = None
    ) -> Preset:
        """Get the preset"""
        return self.ms.get_preset(preset_id=preset_id, name=preset_name, user_id=user_id)

    def _agent_state_to_config(self, agent_state: AgentState) -> dict:
        """Convert AgentState to a dict for a JSON response"""
        assert agent_state is not None

        agent_config = {
            "id": agent_state.id,
            "name": agent_state.name,
            "human": agent_state.human,
            "persona": agent_state.persona,
            "created_at": agent_state.created_at.isoformat(),
        }
        return agent_config

    def list_agents(self, user_id: uuid.UUID) -> dict:
        """List all available agents to a user"""
        if self.ms.get_user(user_id=user_id) is None:
            raise ValueError(f"User user_id={user_id} does not exist")

        agents_states = self.ms.list_agents(user_id=user_id)
        agents_states_dicts = [self._agent_state_to_config(state) for state in agents_states]

        # TODO add a get_message_obj_from_message_id(...) function
        #      this would allow grabbing Message.created_by without having to load the agent object
        all_available_tools = self.ms.list_tools(user_id=user_id)

        for agent_state, return_dict in zip(agents_states, agents_states_dicts):

            # Get the agent object (loaded in memory)
            memgpt_agent = self._get_or_load_agent(user_id=user_id, agent_id=agent_state.id)

            # Add information about tools
            # TODO memgpt_agent should really have a field of List[ToolModel]
            #      then we could just pull that field and return it here
            return_dict["tools"] = [tool for tool in all_available_tools if tool.json_schema in memgpt_agent.functions]

            # Add information about memory (raw core, size of recall, size of archival)
            core_memory = memgpt_agent.memory
            recall_memory = memgpt_agent.persistence_manager.recall_memory
            archival_memory = memgpt_agent.persistence_manager.archival_memory
            memory_obj = {
                "core_memory": {
                    "persona": core_memory.persona,
                    "human": core_memory.human,
                },
                "recall_memory": len(recall_memory) if recall_memory is not None else None,
                "archival_memory": len(archival_memory) if archival_memory is not None else None,
            }
            return_dict["memory"] = memory_obj

            # Add information about last run
            # NOTE: 'last_run' is just the timestamp on the latest message in the buffer
            # Retrieve the Message object via the recall storage or by directly access _messages
            last_msg_obj = memgpt_agent._messages[-1]
            return_dict["last_run"] = last_msg_obj.created_at

            # Add information about attached sources
            sources_ids = self.ms.list_attached_sources(agent_id=agent_state.id)
            sources = [self.ms.get_source(source_id=s_id) for s_id in sources_ids]
            return_dict["sources"] = [vars(s) for s in sources]

        logger.info(f"Retrieved {len(agents_states)} agents for user {user_id}:\n{[vars(s) for s in agents_states]}")
        return {
            "num_agents": len(agents_states),
            "agents": agents_states_dicts,
        }

    def get_agent(self, user_id: uuid.UUID, agent_id: uuid.UUID):
        """Get the agent state"""
        return self.ms.get_agent(agent_id=agent_id, user_id=user_id)

    def get_user(self, user_id: uuid.UUID) -> User:
        """Get the user"""
        return self.ms.get_user(user_id=user_id)

    def get_agent_memory(self, user_id: uuid.UUID, agent_id: uuid.UUID) -> dict:
        """Return the memory of an agent (core memory + non-core statistics)"""
        if self.ms.get_user(user_id=user_id) is None:
            raise ValueError(f"User user_id={user_id} does not exist")
        if self.ms.get_agent(agent_id=agent_id, user_id=user_id) is None:
            raise ValueError(f"Agent agent_id={agent_id} does not exist")

        # Get the agent object (loaded in memory)
        memgpt_agent = self._get_or_load_agent(user_id=user_id, agent_id=agent_id)

        core_memory = memgpt_agent.memory
        recall_memory = memgpt_agent.persistence_manager.recall_memory
        archival_memory = memgpt_agent.persistence_manager.archival_memory

        memory_obj = {
            "core_memory": {
                "persona": core_memory.persona,
                "human": core_memory.human,
            },
            "recall_memory": len(recall_memory) if recall_memory is not None else None,
            "archival_memory": len(archival_memory) if archival_memory is not None else None,
        }

        return memory_obj

    def get_in_context_message_ids(self, user_id: uuid.UUID, agent_id: uuid.UUID) -> List[uuid.UUID]:
        """Get the message ids of the in-context messages in the agent's memory"""
        # Get the agent object (loaded in memory)
        memgpt_agent = self._get_or_load_agent(user_id=user_id, agent_id=agent_id)
        return [m.id for m in memgpt_agent._messages]

    def get_agent_message(self, agent_id: uuid.UUID, message_id: uuid.UUID) -> Message:
        """Get message based on agent and message ID"""
        agent_state = self.ms.get_agent(agent_id=agent_id)
        if agent_state is None:
            raise ValueError(f"Agent agent_id={agent_id} does not exist")
        user_id = agent_state.user_id

        # Get the agent object (loaded in memory)
        memgpt_agent = self._get_or_load_agent(user_id=user_id, agent_id=agent_id)

        message = memgpt_agent.persistence_manager.recall_memory.storage.get(message_id=message_id)
        return message

    def get_agent_messages(self, user_id: uuid.UUID, agent_id: uuid.UUID, start: int, count: int) -> list:
        """Paginated query of all messages in agent message queue"""
        if self.ms.get_user(user_id=user_id) is None:
            raise ValueError(f"User user_id={user_id} does not exist")
        if self.ms.get_agent(agent_id=agent_id, user_id=user_id) is None:
            raise ValueError(f"Agent agent_id={agent_id} does not exist")

        # Get the agent object (loaded in memory)
        memgpt_agent = self._get_or_load_agent(user_id=user_id, agent_id=agent_id)

        if start < 0 or count < 0:
            raise ValueError("Start and count values should be non-negative")

        if start + count < len(memgpt_agent._messages):  # messages can be returned from whats in memory
            # Reverse the list to make it in reverse chronological order
            reversed_messages = memgpt_agent._messages[::-1]
            # Check if start is within the range of the list
            if start >= len(reversed_messages):
                raise IndexError("Start index is out of range")

            # Calculate the end index, ensuring it does not exceed the list length
            end_index = min(start + count, len(reversed_messages))

            # Slice the list for pagination
            messages = reversed_messages[start:end_index]

            # Convert to json
            # Add a tag indicating in-context or not
            json_messages = [{**record.to_json(), "in_context": True} for record in messages]

        else:
            # need to access persistence manager for additional messages
            db_iterator = memgpt_agent.persistence_manager.recall_memory.storage.get_all_paginated(page_size=count, offset=start)

            # get a single page of messages
            # TODO: handle stop iteration
            page = next(db_iterator, [])

            # return messages in reverse chronological order
            messages = sorted(page, key=lambda x: x.created_at, reverse=True)

            # Convert to json
            # Add a tag indicating in-context or not
            json_messages = [record.to_json() for record in messages]
            in_context_message_ids = [str(m.id) for m in memgpt_agent._messages]
            for d in json_messages:
                d["in_context"] = True if str(d["id"]) in in_context_message_ids else False

        return json_messages

    def get_agent_archival(self, user_id: uuid.UUID, agent_id: uuid.UUID, start: int, count: int) -> list:
        """Paginated query of all messages in agent archival memory"""
        if self.ms.get_user(user_id=user_id) is None:
            raise ValueError(f"User user_id={user_id} does not exist")
        if self.ms.get_agent(agent_id=agent_id, user_id=user_id) is None:
            raise ValueError(f"Agent agent_id={agent_id} does not exist")

        # Get the agent object (loaded in memory)
        memgpt_agent = self._get_or_load_agent(user_id=user_id, agent_id=agent_id)

        # iterate over records
        db_iterator = memgpt_agent.persistence_manager.archival_memory.storage.get_all_paginated(page_size=count, offset=start)

        # get a single page of messages
        page = next(db_iterator, [])
        json_passages = [vars(record) for record in page]
        return json_passages

    def get_agent_archival_cursor(
        self,
        user_id: uuid.UUID,
        agent_id: uuid.UUID,
        after: Optional[uuid.UUID] = None,
        before: Optional[uuid.UUID] = None,
        limit: Optional[int] = 100,
        order_by: Optional[str] = "created_at",
        reverse: Optional[bool] = False,
    ):
        if self.ms.get_user(user_id=user_id) is None:
            raise ValueError(f"User user_id={user_id} does not exist")
        if self.ms.get_agent(agent_id=agent_id, user_id=user_id) is None:
            raise ValueError(f"Agent agent_id={agent_id} does not exist")

        # Get the agent object (loaded in memory)
        memgpt_agent = self._get_or_load_agent(user_id=user_id, agent_id=agent_id)

        # iterate over recorde
        cursor, records = memgpt_agent.persistence_manager.archival_memory.storage.get_all_cursor(
            after=after, before=before, limit=limit, order_by=order_by, reverse=reverse
        )
        json_records = [vars(record) for record in records]
        return cursor, json_records

    def get_all_archival_memories(self, user_id: uuid.UUID, agent_id: uuid.UUID) -> list:
        # TODO deprecate (not safe to be returning an unbounded list)
        if self.ms.get_user(user_id=user_id) is None:
            raise ValueError(f"User user_id={user_id} does not exist")
        if self.ms.get_agent(agent_id=agent_id, user_id=user_id) is None:
            raise ValueError(f"Agent agent_id={agent_id} does not exist")

        # Get the agent object (loaded in memory)
        memgpt_agent = self._get_or_load_agent(user_id=user_id, agent_id=agent_id)

        # Assume passages
        records = memgpt_agent.persistence_manager.archival_memory.storage.get_all()
        print("records:", records)

        return [dict(id=str(r.id), contents=r.text) for r in records]

    def insert_archival_memory(self, user_id: uuid.UUID, agent_id: uuid.UUID, memory_contents: str) -> uuid.UUID:
        if self.ms.get_user(user_id=user_id) is None:
            raise ValueError(f"User user_id={user_id} does not exist")
        if self.ms.get_agent(agent_id=agent_id, user_id=user_id) is None:
            raise ValueError(f"Agent agent_id={agent_id} does not exist")

        # Get the agent object (loaded in memory)
        memgpt_agent = self._get_or_load_agent(user_id=user_id, agent_id=agent_id)

        # Insert into archival memory
        # memory_id = uuid.uuid4()
        passage_ids = memgpt_agent.persistence_manager.archival_memory.insert(memory_string=memory_contents, return_ids=True)

        return [str(p_id) for p_id in passage_ids]

    def delete_archival_memory(self, user_id: uuid.UUID, agent_id: uuid.UUID, memory_id: uuid.UUID):
        if self.ms.get_user(user_id=user_id) is None:
            raise ValueError(f"User user_id={user_id} does not exist")
        if self.ms.get_agent(agent_id=agent_id, user_id=user_id) is None:
            raise ValueError(f"Agent agent_id={agent_id} does not exist")

        # Get the agent object (loaded in memory)
        memgpt_agent = self._get_or_load_agent(user_id=user_id, agent_id=agent_id)

        # Delete by ID
        # TODO check if it exists first, and throw error if not
        memgpt_agent.persistence_manager.archival_memory.storage.delete({"id": memory_id})

    def get_agent_recall_cursor(
        self,
        user_id: uuid.UUID,
        agent_id: uuid.UUID,
        after: Optional[uuid.UUID] = None,
        before: Optional[uuid.UUID] = None,
        limit: Optional[int] = 100,
        order_by: Optional[str] = "created_at",
        order: Optional[str] = "asc",
        reverse: Optional[bool] = False,
    ):
        if self.ms.get_user(user_id=user_id) is None:
            raise ValueError(f"User user_id={user_id} does not exist")
        if self.ms.get_agent(agent_id=agent_id, user_id=user_id) is None:
            raise ValueError(f"Agent agent_id={agent_id} does not exist")

        # Get the agent object (loaded in memory)
        memgpt_agent = self._get_or_load_agent(user_id=user_id, agent_id=agent_id)

        # iterate over records
        cursor, records = memgpt_agent.persistence_manager.recall_memory.storage.get_all_cursor(
            after=after, before=before, limit=limit, order_by=order_by, reverse=reverse
        )

        json_records = [record.to_json() for record in records]
        # TODO: mark what is in-context versus not
        return cursor, json_records

    def get_agent_config(self, user_id: uuid.UUID, agent_id: uuid.UUID) -> AgentState:
        """Return the config of an agent"""
        if self.ms.get_user(user_id=user_id) is None:
            raise ValueError(f"User user_id={user_id} does not exist")
        if self.ms.get_agent(agent_id=agent_id, user_id=user_id) is None:
            raise ValueError(f"Agent agent_id={agent_id} does not exist")

        # Get the agent object (loaded in memory)
        memgpt_agent = self._get_or_load_agent(user_id=user_id, agent_id=agent_id)
        return memgpt_agent.agent_state

    def get_server_config(self, include_defaults: bool = False) -> dict:
        """Return the base config"""

        def clean_keys(config):
            config_copy = config.copy()
            for k, v in config.items():
                if k == "key" or "_key" in k:
                    config_copy[k] = server_utils.shorten_key_middle(v, chars_each_side=5)
            return config_copy

        # TODO: do we need a seperate server config?
        base_config = vars(self.config)
        clean_base_config = clean_keys(base_config)
        clean_base_config["default_llm_config"] = vars(clean_base_config["default_llm_config"])
        clean_base_config["default_embedding_config"] = vars(clean_base_config["default_embedding_config"])
        response = {"config": clean_base_config}

        if include_defaults:
            default_config = vars(MemGPTConfig())
            clean_default_config = clean_keys(default_config)
            clean_default_config["default_llm_config"] = vars(clean_default_config["default_llm_config"])
            clean_default_config["default_embedding_config"] = vars(clean_default_config["default_embedding_config"])
            response["defaults"] = clean_default_config

        return response

    def get_available_models(self) -> list:
        """Poll the LLM endpoint for a list of available models"""

        credentials = MemGPTCredentials().load()

        try:
            model_options = get_model_options(
                credentials=credentials,
                model_endpoint_type=self.config.default_llm_config.model_endpoint_type,
                model_endpoint=self.config.default_llm_config.model_endpoint,
            )
            return model_options

        except Exception as e:
            logger.exception(f"Failed to get list of available models from LLM endpoint:\n{str(e)}")
            raise

    def update_agent_core_memory(self, user_id: uuid.UUID, agent_id: uuid.UUID, new_memory_contents: dict) -> dict:
        """Update the agents core memory block, return the new state"""
        if self.ms.get_user(user_id=user_id) is None:
            raise ValueError(f"User user_id={user_id} does not exist")
        if self.ms.get_agent(agent_id=agent_id, user_id=user_id) is None:
            raise ValueError(f"Agent agent_id={agent_id} does not exist")

        # Get the agent object (loaded in memory)
        memgpt_agent = self._get_or_load_agent(user_id=user_id, agent_id=agent_id)

        old_core_memory = self.get_agent_memory(user_id=user_id, agent_id=agent_id)["core_memory"]
        new_core_memory = old_core_memory.copy()

        modified = False
        if "persona" in new_memory_contents and new_memory_contents["persona"] is not None:
            new_persona = new_memory_contents["persona"]
            if old_core_memory["persona"] != new_persona:
                new_core_memory["persona"] = new_persona
                memgpt_agent.memory.edit_persona(new_persona)
                modified = True

        if "human" in new_memory_contents and new_memory_contents["human"] is not None:
            new_human = new_memory_contents["human"]
            if old_core_memory["human"] != new_human:
                new_core_memory["human"] = new_human
                memgpt_agent.memory.edit_human(new_human)
                modified = True

        # If we modified the memory contents, we need to rebuild the memory block inside the system message
        if modified:
            memgpt_agent.rebuild_memory()

        return {
            "old_core_memory": old_core_memory,
            "new_core_memory": new_core_memory,
            "modified": modified,
        }

    def rename_agent(self, user_id: uuid.UUID, agent_id: uuid.UUID, new_agent_name: str) -> dict:
        """Update the name of the agent in the database"""
        if self.ms.get_user(user_id=user_id) is None:
            raise ValueError(f"User user_id={user_id} does not exist")
        if self.ms.get_agent(agent_id=agent_id, user_id=user_id) is None:
            raise ValueError(f"Agent agent_id={agent_id} does not exist")

        # Get the agent object (loaded in memory)
        memgpt_agent = self._get_or_load_agent(user_id=user_id, agent_id=agent_id)

        current_name = memgpt_agent.agent_state.name
        if current_name == new_agent_name:
            raise ValueError(f"New name ({new_agent_name}) is the same as the current name")

        try:
            memgpt_agent.agent_state.name = new_agent_name
            self.ms.update_agent(agent=memgpt_agent.agent_state)
        except Exception as e:
            logger.exception(f"Failed to update agent name with:\n{str(e)}")
            raise ValueError(f"Failed to update agent name in database")

        return memgpt_agent.agent_state

    def delete_user(self, user_id: uuid.UUID):
        # TODO: delete user
        pass

    def delete_agent(self, user_id: uuid.UUID, agent_id: uuid.UUID):
        """Delete an agent in the database"""
        if self.ms.get_user(user_id=user_id) is None:
            raise ValueError(f"User user_id={user_id} does not exist")
        if self.ms.get_agent(agent_id=agent_id, user_id=user_id) is None:
            raise ValueError(f"Agent agent_id={agent_id} does not exist")

        # Verify that the agent exists and is owned by the user
        agent_state = self.ms.get_agent(agent_id=agent_id, user_id=user_id)
        if not agent_state:
            raise ValueError(f"Could not find agent_id={agent_id} under user_id={user_id}")
        if agent_state.user_id != user_id:
            raise ValueError(f"Could not authorize agent_id={agent_id} with user_id={user_id}")

        # First, if the agent is in the in-memory cache we should remove it
        # List of {'user_id': user_id, 'agent_id': agent_id, 'agent': agent_obj} dicts
        try:
            self.active_agents = [d for d in self.active_agents if str(d["agent_id"]) != str(agent_id)]
        except Exception as e:
            logger.exception(f"Failed to delete agent {agent_id} from cache via ID with:\n{str(e)}")
            raise ValueError(f"Failed to delete agent {agent_id} from cache")

        # Next, attempt to delete it from the actual database
        try:
            self.ms.delete_agent(agent_id=agent_id)
        except Exception as e:
            logger.exception(f"Failed to delete agent {agent_id} via ID with:\n{str(e)}")
            raise ValueError(f"Failed to delete agent {agent_id} in database")

    def authenticate_user(self) -> uuid.UUID:
        # TODO: Implement actual authentication to enable multi user setup
        return uuid.UUID(MemGPTConfig.load().anon_clientid)

    def api_key_to_user(self, api_key: str) -> uuid.UUID:
        """Decode an API key to a user"""
        user = self.ms.get_user_from_api_key(api_key=api_key)
        if user is None:
            raise HTTPException(status_code=403, detail="Invalid credentials")
        else:
            return user.id

    def create_api_key_for_user(self, user_id: uuid.UUID) -> Token:
        """Create a new API key for a user"""
        token = self.ms.create_api_key(user_id=user_id)
        return token

    def create_source(self, name: str, user_id: uuid.UUID) -> Source:  # TODO: add other fields
        """Create a new data source"""
        source = Source(
            name=name,
            user_id=user_id,
            embedding_model=self.config.default_embedding_config.embedding_model,
            embedding_dim=self.config.default_embedding_config.embedding_dim,
        )
        self.ms.create_source(source)
        assert self.ms.get_source(source_name=name, user_id=user_id) is not None, f"Failed to create source {name}"
        return source

    def delete_source(self, source_id: uuid.UUID, user_id: uuid.UUID):
        """Delete a data source"""
        source = self.ms.get_source(source_id=source_id, user_id=user_id)
        self.ms.delete_source(source_id)

        # delete data from passage store
        passage_store = StorageConnector.get_storage_connector(TableType.PASSAGES, self.config, user_id=user_id)
        passage_store.delete({"data_source": source.name})

        # TODO: delete data from agent passage stores (?)

    def load_data(
        self,
        user_id: uuid.UUID,
        connector: DataConnector,
        source_name: str,
    ):
        """Load data from a DataConnector into a source for a specified user_id"""
        # TODO: this should be implemented as a batch job or at least async, since it may take a long time

        # load data from a data source into the document store
        source = self.ms.get_source(source_name=source_name, user_id=user_id)
        if source is None:
            raise ValueError(f"Data source {source_name} does not exist for user {user_id}")

        # get the data connectors
        passage_store = StorageConnector.get_storage_connector(TableType.PASSAGES, self.config, user_id=user_id)
        # TODO: add document store support
        document_store = None  # StorageConnector.get_storage_connector(TableType.DOCUMENTS, self.config, user_id=user_id)

        # load data into the document store
        load_data(connector, source, self.config.default_embedding_config, passage_store, document_store)

    def attach_source_to_agent(self, user_id: uuid.UUID, agent_id: uuid.UUID, source_name: str):
        # attach a data source to an agent
        data_source = self.ms.get_source(source_name=source_name, user_id=user_id)
        if data_source is None:
            raise ValueError(f"Data source {source_name} does not exist for user_id {user_id}")

        # get connection to data source storage
        source_connector = StorageConnector.get_storage_connector(TableType.PASSAGES, self.config, user_id=user_id)

        # load agent
        agent = self._get_or_load_agent(user_id, agent_id)

        # attach source to agent
        agent.attach_source(data_source.name, source_connector, self.ms)

        return data_source

    def detach_source_from_agent(self, user_id: uuid.UUID, agent_id: uuid.UUID, source_name: str):
        # TODO: remove all passages coresponding to source from agent's archival memory
        raise NotImplementedError

    def list_attached_sources(self, agent_id: uuid.UUID):
        # list all attached sources to an agent
        return self.ms.list_attached_sources(agent_id)
