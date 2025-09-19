from temporalio import activity

from letta.agents.temporal.types import CreateStepParams, CreateStepResult
from letta.schemas.enums import StepStatus
from letta.schemas.openai.chat_completion_response import UsageStatistics
from letta.services.step_manager import StepManager


@activity.defn(name="create_step")
async def create_step(params: CreateStepParams) -> CreateStepResult:
    """
    Persist step to the database.

    This activity saves the step to the database and returns the persisted step
    with their assigned IDs and timestamps.
    """
    step_manager = StepManager()

    # Persist step to database
    persisted_step = await step_manager.log_step_async(
        actor=params.actor,
        agent_id=params.agent_state.id,
        provider_name=params.agent_state.llm_config.model_endpoint_type,
        provider_category=params.agent_state.llm_config.provider_category or "base",
        model=params.agent_state.llm_config.model,
        model_endpoint=params.agent_state.llm_config.model_endpoint,
        context_window_limit=params.agent_state.llm_config.context_window,
        usage=UsageStatistics(completion_tokens=0, prompt_tokens=0, total_tokens=0),
        provider_id=None,
        job_id=params.run_id,
        step_id=params.step_id,
        project_id=params.agent_state.project_id,
        status=StepStatus.SUCCESS,
    )

    return CreateStepResult(step=persisted_step)
