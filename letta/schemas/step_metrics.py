from typing import Optional

from pydantic import Field

from letta.schemas.letta_base import LettaBase


class StepMetricsBase(LettaBase):
    __id_prefix__ = "step"


class StepMetrics(StepMetricsBase):
    id: str = Field(..., description="The id of the step this metric belongs to (matches steps.id).")
    organization_id: Optional[str] = Field(None, description="The unique identifier of the organization.")
    provider_id: Optional[str] = Field(None, description="The unique identifier of the provider.")
    job_id: Optional[str] = Field(None, description="The unique identifier of the job.")
    agent_id: Optional[str] = Field(None, description="The unique identifier of the agent.")
    llm_request_ns: Optional[int] = Field(None, description="Time spent on LLM requests in nanoseconds.")
    tool_execution_ns: Optional[int] = Field(None, description="Time spent on tool execution in nanoseconds.")
    step_ns: Optional[int] = Field(None, description="Total time for the step in nanoseconds.")
    base_template_id: Optional[str] = Field(None, description="The base template ID that the step belongs to (cloud only).")
    template_id: Optional[str] = Field(None, description="The template ID that the step belongs to (cloud only).")
    project_id: Optional[str] = Field(None, description="The project that the step belongs to (cloud only).")
