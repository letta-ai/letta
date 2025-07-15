import type { OtelTrace } from '@letta-cloud/types';

export function getTTFTFromTrace(traces: OtelTrace[]) {
  const trace = traces.find(
    (trace) => trace.SpanName === 'time_to_first_token',
  );

  const ttfsIndex = trace?.['Events.Name']?.indexOf('time_to_first_token_ms');

  if (!trace || typeof ttfsIndex !== 'number' || ttfsIndex === -1) {
    return undefined;
  }

  if (trace['Events.Attributes'][ttfsIndex]) {
    if ('ttft_ms' in trace['Events.Attributes'][ttfsIndex]) {
      return parseFloat(trace['Events.Attributes'][ttfsIndex].ttft_ms);
    }
  }

  return undefined;
}
