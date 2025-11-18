from enum import Enum
from typing import Annotated, List, Literal, Optional, Union

from pydantic import BaseModel, Field

from letta.schemas.enums import PrimitiveType
from letta.schemas.letta_base import LettaBase


class ManagerType(str, Enum):
    round_robin = "round_robin"
    supervisor = "supervisor"
    dynamic = "dynamic"
    sleeptime = "sleeptime"
    voice_sleeptime = "voice_sleeptime"
    swarm = "swarm"


class ManagerConfig(BaseModel):
    manager_type: ManagerType = Field(..., description="")


class GroupBase(LettaBase):
    __id_prefix__ = PrimitiveType.GROUP.value


class Group(GroupBase):
    id: str = Field(..., description="The id of the group. Assigned by the database.")
    manager_type: ManagerType = Field(..., description="")
    agent_ids: List[str] = Field(..., description="")
    description: str = Field(..., description="")
    project_id: Optional[str] = Field(None, description="The associated project id.")
    # Template fields
    template_id: Optional[str] = Field(None, description="The id of the template.")
    base_template_id: Optional[str] = Field(None, description="The base template id.")
    deployment_id: Optional[str] = Field(None, description="The id of the deployment.")
    shared_block_ids: List[str] = Field([], description="", deprecated=True)
    # Pattern fields
    manager_agent_id: Optional[str] = Field(None, description="")
    termination_token: Optional[str] = Field(None, description="")
    max_turns: Optional[int] = Field(None, description="")
    sleeptime_agent_frequency: Optional[int] = Field(None, description="")
    turns_counter: Optional[int] = Field(None, description="")
    last_processed_message_id: Optional[str] = Field(None, description="")
    max_message_buffer_length: Optional[int] = Field(
        None,
        description="The desired maximum length of messages in the context window of the convo agent. This is a best effort, and may be off slightly due to user/assistant interleaving.",
    )
    min_message_buffer_length: Optional[int] = Field(
        None,
        description="The desired minimum length of messages in the context window of the convo agent. This is a best effort, and may be off-by-one due to user/assistant interleaving.",
    )
    hidden: Optional[bool] = Field(
        None,
        description="If set to True, the group will be hidden.",
    )

    @property
    def manager_config(self) -> ManagerConfig:
        match self.manager_type:
            case ManagerType.round_robin:
                return RoundRobinManager(max_turns=self.max_turns)
            case ManagerType.supervisor:
                return SupervisorManager(manager_agent_id=self.manager_agent_id)
            case ManagerType.dynamic:
                return DynamicManager(
                    manager_agent_id=self.manager_agent_id,
                    termination_token=self.termination_token,
                    max_turns=self.max_turns,
                )
            case ManagerType.sleeptime:
                return SleeptimeManager(
                    manager_agent_id=self.manager_agent_id,
                    sleeptime_agent_frequency=self.sleeptime_agent_frequency,
                )
            case ManagerType.voice_sleeptime:
                return VoiceSleeptimeManager(
                    manager_agent_id=self.manager_agent_id,
                    max_message_buffer_length=self.max_message_buffer_length,
                    min_message_buffer_length=self.min_message_buffer_length,
                )


class RoundRobinManager(ManagerConfig):
    manager_type: Literal[ManagerType.round_robin] = Field(ManagerType.round_robin, description="")
    max_turns: Optional[int] = Field(None, description="")


class RoundRobinManagerUpdate(ManagerConfig):
    manager_type: Literal[ManagerType.round_robin] = Field(ManagerType.round_robin, description="")
    max_turns: Optional[int] = Field(None, description="")


class SupervisorManager(ManagerConfig):
    manager_type: Literal[ManagerType.supervisor] = Field(ManagerType.supervisor, description="")
    manager_agent_id: str = Field(..., description="")


class SupervisorManagerUpdate(ManagerConfig):
    manager_type: Literal[ManagerType.supervisor] = Field(ManagerType.supervisor, description="")
    manager_agent_id: Optional[str] = Field(..., description="")


class DynamicManager(ManagerConfig):
    manager_type: Literal[ManagerType.dynamic] = Field(ManagerType.dynamic, description="")
    manager_agent_id: str = Field(..., description="")
    termination_token: Optional[str] = Field("DONE!", description="")
    max_turns: Optional[int] = Field(None, description="")


class DynamicManagerUpdate(ManagerConfig):
    manager_type: Literal[ManagerType.dynamic] = Field(ManagerType.dynamic, description="")
    manager_agent_id: Optional[str] = Field(None, description="")
    termination_token: Optional[str] = Field(None, description="")
    max_turns: Optional[int] = Field(None, description="")


class SleeptimeManager(ManagerConfig):
    manager_type: Literal[ManagerType.sleeptime] = Field(ManagerType.sleeptime, description="")
    manager_agent_id: str = Field(..., description="")
    sleeptime_agent_frequency: Optional[int] = Field(None, description="")


class SleeptimeManagerUpdate(ManagerConfig):
    manager_type: Literal[ManagerType.sleeptime] = Field(ManagerType.sleeptime, description="")
    manager_agent_id: Optional[str] = Field(None, description="")
    sleeptime_agent_frequency: Optional[int] = Field(None, description="")


class VoiceSleeptimeManager(ManagerConfig):
    manager_type: Literal[ManagerType.voice_sleeptime] = Field(ManagerType.voice_sleeptime, description="")
    manager_agent_id: str = Field(..., description="")
    max_message_buffer_length: Optional[int] = Field(
        None,
        description="The desired maximum length of messages in the context window of the convo agent. This is a best effort, and may be off slightly due to user/assistant interleaving.",
    )
    min_message_buffer_length: Optional[int] = Field(
        None,
        description="The desired minimum length of messages in the context window of the convo agent. This is a best effort, and may be off-by-one due to user/assistant interleaving.",
    )


class VoiceSleeptimeManagerUpdate(ManagerConfig):
    manager_type: Literal[ManagerType.voice_sleeptime] = Field(ManagerType.voice_sleeptime, description="")
    manager_agent_id: Optional[str] = Field(None, description="")
    max_message_buffer_length: Optional[int] = Field(
        None,
        description="The desired maximum length of messages in the context window of the convo agent. This is a best effort, and may be off slightly due to user/assistant interleaving.",
    )
    min_message_buffer_length: Optional[int] = Field(
        None,
        description="The desired minimum length of messages in the context window of the convo agent. This is a best effort, and may be off-by-one due to user/assistant interleaving.",
    )


# class SwarmGroup(ManagerConfig):
#   manager_type: Literal[ManagerType.swarm] = Field(ManagerType.swarm, description="")


ManagerConfigUnion = Annotated[
    Union[RoundRobinManager, SupervisorManager, DynamicManager, SleeptimeManager, VoiceSleeptimeManager],
    Field(discriminator="manager_type"),
]


ManagerConfigUpdateUnion = Annotated[
    Union[RoundRobinManagerUpdate, SupervisorManagerUpdate, DynamicManagerUpdate, SleeptimeManagerUpdate, VoiceSleeptimeManagerUpdate],
    Field(discriminator="manager_type"),
]


class GroupCreate(BaseModel):
    agent_ids: List[str] = Field(..., description="")
    description: str = Field(..., description="")
    manager_config: ManagerConfigUnion = Field(RoundRobinManager(), description="")
    project_id: Optional[str] = Field(None, description="The associated project id.")
    shared_block_ids: List[str] = Field([], description="", deprecated=True)
    hidden: Optional[bool] = Field(
        None,
        description="If set to True, the group will be hidden.",
    )


class InternalTemplateGroupCreate(GroupCreate):
    """Used for Letta Cloud"""

    base_template_id: str = Field(..., description="The id of the base template.")
    template_id: str = Field(..., description="The id of the template.")
    deployment_id: str = Field(..., description="The id of the deployment.")


class GroupUpdate(BaseModel):
    agent_ids: Optional[List[str]] = Field(None, description="")
    description: Optional[str] = Field(None, description="")
    manager_config: Optional[ManagerConfigUpdateUnion] = Field(None, description="")
    project_id: Optional[str] = Field(None, description="The associated project id.")
    shared_block_ids: Optional[List[str]] = Field(None, description="", deprecated=True)
