import type { AgentStepTrace } from '@letta-cloud/types';

export function getLettaProcessingDurationFromTrace(
  traceStepDetails: AgentStepTrace | undefined,
) {
  const durationIndex = traceStepDetails?.['Events.Name'].indexOf(
    'request_start_to_provider_request_start_ns',
  );

  if (
    !traceStepDetails ||
    typeof durationIndex !== 'number' ||
    durationIndex === -1
  ) {
    return undefined;
  }

  if (traceStepDetails['Events.Attributes'][durationIndex]) {
    if (
      'request_start_to_provider_request_start_ns' in
      traceStepDetails['Events.Attributes'][durationIndex]
    ) {
      return (
        parseFloat(
          traceStepDetails['Events.Attributes'][durationIndex]
            .request_start_to_provider_request_start_ns,
        ) / 1000000
      ); // Convert nanoseconds to milliseconds
    }
  }

  return undefined;
}
