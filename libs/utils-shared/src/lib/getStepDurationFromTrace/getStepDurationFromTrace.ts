import type { AgentStepTrace } from '@letta-cloud/types';

export function getStepDurationFromTrace(
  traceStepDetails: AgentStepTrace | undefined,
) {
  const durationIndex = traceStepDetails?.['Events.Name'].indexOf('step_ms');

  if (
    !traceStepDetails ||
    typeof durationIndex !== 'number' ||
    durationIndex === -1
  ) {
    return undefined;
  }

  if (traceStepDetails['Events.Attributes'][durationIndex]) {
    if ('duration_ms' in traceStepDetails['Events.Attributes'][durationIndex]) {
      return parseFloat(
        traceStepDetails['Events.Attributes'][durationIndex].duration_ms,
      );
    }
  }

  return undefined;
}
