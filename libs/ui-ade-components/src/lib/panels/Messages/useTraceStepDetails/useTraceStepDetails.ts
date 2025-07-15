import type { AgentStepTrace, OtelTrace } from '@letta-cloud/types';
import { useMemo } from 'react';

export function useTraceStepDetails(stepId: string, traces: OtelTrace[]) {
  return useMemo(() => {
    return traces.find(
      (trace) =>
        trace['SpanName'] === 'agent_step' &&
        trace['SpanAttributes']?.step_id === stepId,
    ) as AgentStepTrace | undefined;
  }, [stepId, traces]);
}
