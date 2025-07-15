import type { OtelTrace } from '@letta-cloud/types';
import { useMemo } from 'react';
import { getTTFTFromTrace } from '@letta-cloud/utils-shared';

export function useTotalTraceDuration(traces: OtelTrace[]) {
  const timeToFirstToken = useMemo(() => {
    return getTTFTFromTrace(traces);
  }, [traces]);

  const stepDurations = useMemo(() => {
    const stepsTraces = traces.filter(
      (trace) => trace['SpanName'] === 'agent_step',
    );

    return stepsTraces.reduce((acc, trace) => {
      const durationIndex = trace['Events.Name'].indexOf('step_ms');

      if (durationIndex !== -1 && trace['Events.Attributes'][durationIndex]) {
        if ('duration_ms' in trace['Events.Attributes'][durationIndex]) {
          const duration = parseFloat(
            trace['Events.Attributes'][durationIndex].duration_ms,
          );
          acc += duration;
        }
      }

      return acc;
    }, 0);
  }, [traces]);

  return useMemo(() => {
    if (stepDurations === undefined || timeToFirstToken === undefined) {
      return undefined;
    }
    return stepDurations + timeToFirstToken;
  }, [stepDurations, timeToFirstToken]);
}
