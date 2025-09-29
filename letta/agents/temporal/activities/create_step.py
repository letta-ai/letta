from temporalio import activity

from letta.agents.temporal.types import CreateStepParams, CreateStepResult
from letta.helpers.datetime_helpers import get_utc_timestamp_ns
from letta.schemas.enums import StepStatus
from letta.schemas.openai.chat_completion_response import UsageStatistics
from letta.schemas.step_metrics import StepMetrics
from letta.services.step_manager import StepManager


@activity.defn(name="create_step")
async def create_step(params: CreateStepParams) -> CreateStepResult:
    """
    Persist step to the database, update usage statistics, and record metrics.

    This activity saves the step to the database, updates its usage statistics,
    and records timing metrics.
    """
    step_manager = StepManager()

    # Determine status based on stop_reason
    status = StepStatus.ERROR if params.stop_reason == "error" else StepStatus.SUCCESS

    # Persist step to database
    persisted_step = await step_manager.log_step_async(
        actor=params.actor,
        agent_id=params.agent_state.id,
        provider_name=params.agent_state.llm_config.model_endpoint_type,
        provider_category=params.agent_state.llm_config.provider_category or "base",
        model=params.agent_state.llm_config.model,
        model_endpoint=params.agent_state.llm_config.model_endpoint,
        context_window_limit=params.agent_state.llm_config.context_window,
        usage=params.usage,
        provider_id=None,
        run_id=params.run_id,
        step_id=params.step_id,
        project_id=params.agent_state.project_id,
        status=status,
        allow_partial=True,
    )

    # Record step metrics
    await step_manager.record_step_metrics_async(
        actor=params.actor,
        step_id=persisted_step.id,
        llm_request_ns=params.llm_request_ns,
        tool_execution_ns=params.tool_execution_ns,
        step_ns=params.step_ns,
        agent_id=params.agent_state.id,
        run_id=params.run_id,
        project_id=params.agent_state.project_id,
        template_id=params.agent_state.template_id,
        base_template_id=params.agent_state.base_template_id,
        allow_partial=True,
    )

    return CreateStepResult(step=persisted_step)
