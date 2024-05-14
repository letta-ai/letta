import logging
import uuid
from abc import abstractmethod
from functools import wraps
from threading import Lock
from typing import Union, Callable, Optional

from fastapi import HTTPException

import memgpt.constants as constants
import memgpt.system as system
from memgpt.agent import Agent, save_agent

from memgpt.config import MemGPTConfig
from memgpt.credentials import MemGPTCredentials
from memgpt.data_types import (
    User,
    AgentState,
    LLMConfig,
    EmbeddingConfig,
    Message,
    Preset,
)
from memgpt.interface import AgentInterface  # abstract

from memgpt.interface import CLIInterface  # for printing to terminal
from memgpt.metadata import MetadataStore

logger = logging.getLogger(__name__)


class Server(object):
    """Abstract server class that supports multi-agent multi-user"""

    @abstractmethod
    def list_agents(self, user_id: uuid.UUID) -> dict:
        """List all available agents to a user"""
        raise NotImplementedError


    @abstractmethod
    def create_agent(
        self,
        user_id: uuid.UUID,
        agent_config: Union[dict, AgentState],
        interface: Union[AgentInterface, None],
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
    def set_initial_system_message(self, user_id: uuid.UUID, agnet_id: uuid.UUID, message: str) -> None:
        """Updates the system message at the start of the conversation"""
        raise NotImplementedError    
    
    def get_initial_system_message(self, user_id: uuid.UUID, agnet_id: uuid.UUID) -> str:
        """Get the system message at the start of the conversation"""
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

MAX_CHAINING_STEPS = 20
class SyncServer(LockingServer):
    """Simple single-threaded / blocking server process"""

    def __init__(
        self,
        default_interface: AgentInterface = CLIInterface(),
    ):
        """Server process holds in-memory agents that are being run"""

        # List of {'user_id': user_id, 'agent_id': agent_id, 'agent': agent_obj} dicts
        self.active_agents = []

        # The default interface that will get assigned to agents ON LOAD
        # self.default_interface_cls = default_interface_cls
        self.default_interface = default_interface

        # Initialize the connection to the DB
        self.config = MemGPTConfig.load()
        assert self.config.persona is not None, "Persona must be set in the config"
        assert self.config.human is not None, "Human must be set in the config"

        # TODO figure out how to handle credentials for the server
        self.credentials = MemGPTCredentials.load()

        self.server_llm_config = LLMConfig(
            model=self.config.default_llm_config.model,
            model_endpoint_type=self.config.default_llm_config.model_endpoint_type,
            model_endpoint=self.config.default_llm_config.model_endpoint,
            model_wrapper=self.config.default_llm_config.model_wrapper,
            context_window=self.config.default_llm_config.context_window,
        )
        self.server_embedding_config = EmbeddingConfig(
            embedding_endpoint_type=self.config.default_embedding_config.embedding_endpoint_type,
            embedding_endpoint=self.config.default_embedding_config.embedding_endpoint,
            embedding_dim=self.config.default_embedding_config.embedding_dim,
            # openai_key=self.credentials.openai_key,
        )

        # Initialize the metadata store
        self.ms = MetadataStore(self.config)

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
        next_input_message = input_message
        counter = 0
        while True:
            new_messages, heartbeat_request, function_failed, token_warning, tokens_accumulated = memgpt_agent.step(next_input_message)
            counter += 1

            # Chain stops
            if counter > MAX_CHAINING_STEPS:
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

        if command.lower() == "exit":
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
        
    def set_initial_system_message(self, user_id: uuid.UUID, agnet_id: uuid.UUID, message: str) -> None:
        """Updates the system message at the start of the conversation"""
        raise NotImplementedError    
    
    def get_initial_system_message(self, user_id: uuid.UUID, agnet_id: uuid.UUID) -> str:
        """Get the system message at the start of the conversation"""
        raise NotImplementedError

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
            preset_obj = self.ms.get_preset(preset_name=preset if preset else self.config.preset, user_id=user_id)
            assert preset_obj is not None, f"preset {preset if preset else self.config.preset} does not exist"
            logger.debug(f"Attempting to create agent from preset:\n{preset_obj}")

            # Overwrite fields in the preset if they were specified
            preset_obj.human = human if human else self.config.human
            preset_obj.persona = persona if persona else self.config.persona

            llm_config = llm_config if llm_config else self.server_llm_config
            embedding_config = embedding_config if embedding_config else self.server_embedding_config

            agent = Agent(
                interface=interface,
                preset=preset_obj,
                name=name,
                created_by=user.id,
                llm_config=llm_config,
                embedding_config=embedding_config,
            )
            save_agent(agent=agent, ms=self.ms)

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
        return self.ms.get_preset(preset_id=preset_id, preset_name=preset_name, user_id=user_id)

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
        logger.info(f"Retrieved {len(agents_states)} agents for user {user_id}:\n{[vars(s) for s in agents_states]}")
        return {
            "num_agents": len(agents_states),
            "agents": [self._agent_state_to_config(state) for state in agents_states],
        }

    def get_agent(self, user_id: uuid.UUID, agent_id: uuid.UUID):
        """Get the agent state"""
        return self.ms.get_agent(agent_id=agent_id, user_id=user_id)

    def get_user(self, user_id: uuid.UUID) -> User:
        """Get the user"""
        return self.ms.get_user(user_id=user_id)


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
