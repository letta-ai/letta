import type { AgentStepTrace } from '@letta-cloud/types';
import { useMemo } from 'react';
import { getStepDurationFromTrace } from '@letta-cloud/utils-shared';

export function useStepDuration(stepDetails?: AgentStepTrace) {
  return useMemo(() => {
    return getStepDurationFromTrace(stepDetails);
  }, [stepDetails]);
}
