from temporalio import Client

from letta.agents.base_agent_v2 import BaseAgentV2
from letta.agents.temporal.temporal_agent_workflow import TemporalAgentWorkflow
from letta.agents.temporal.types import WorkflowInputParams
from letta.constants import DEFAULT_MAX_STEPS
from letta.log import get_logger
from letta.schemas.agent import AgentState
from letta.schemas.letta_message import MessageType
from letta.schemas.letta_response import LettaResponse
from letta.schemas.letta_stop_reason import LettaStopReason, StopReasonType
from letta.schemas.message import MessageCreate
from letta.schemas.usage import LettaUsageStatistics
from letta.schemas.user import User
from letta.settings import settings


class TemporalAgent(BaseAgentV2):
    """
    Execute the agent loop on temporal.
    """

    def __init__(self, agent_state: AgentState, actor: User):
        self.agent_state = agent_state
        self.actor = actor
        self.logger = get_logger(agent_state.id)

    async def step(
        self,
        input_messages: list[MessageCreate],
        max_steps: int = DEFAULT_MAX_STEPS,
        run_id: str | None = None,
        use_assistant_message: bool = True,
        include_return_message_types: list[MessageType] | None = None,
        request_start_timestamp_ns: int | None = None,
    ) -> LettaResponse:
        """
        Execute the agent loop on temporal.
        """
        if not run_id:
            raise ValueError("run_id is required")

        client = await Client.connect(
            settings.temporal_endpoint,
            namespace=settings.temporal_namespace,
            api_key=settings.temporal_api_key,
            tls=True,
        )

        await client.start_workflow(
            TemporalAgentWorkflow.run,
            "agent_loop_async",
            id=run_id,
            task_queue="agent_loop_async_task_queue",
            arg=(
                WorkflowInputParams(
                    agent_state=self.agent_state,
                    messages=input_messages,
                    actor=self.actor,
                    max_steps=max_steps,
                    run_id=run_id,
                ),
            ),
        )

        return LettaResponse(
            messages=[],
            stop_reason=LettaStopReason(stop_reason=StopReasonType.end_turn.value),
            usage=LettaUsageStatistics(),
        )
