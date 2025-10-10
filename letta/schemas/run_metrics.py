from typing import Optional

from pydantic import Field

from letta.schemas.letta_base import LettaBase


class RunMetricsBase(LettaBase):
    __id_prefix__ = "run"


class RunMetrics(RunMetricsBase):
    id: str = Field(..., description="The id of the run this metric belongs to (matches runs.id).")
    organization_id: Optional[str] = Field(None, description="The unique identifier of the organization.")
    agent_id: Optional[str] = Field(None, description="The unique identifier of the agent.")
    project_id: Optional[str] = Field(None, description="The project that the run belongs to (cloud only).")
    run_start_ns: Optional[int] = Field(None, description="The timestamp of the start of the run in nanoseconds.")
    run_ns: Optional[int] = Field(None, description="Total time for the run in nanoseconds.")
    num_steps: Optional[int] = Field(None, description="The number of steps in the run.")
    template_id: Optional[str] = Field(None, description="The template ID that the run belongs to (cloud only).")
    base_template_id: Optional[str] = Field(None, description="The base template ID that the run belongs to (cloud only).")
