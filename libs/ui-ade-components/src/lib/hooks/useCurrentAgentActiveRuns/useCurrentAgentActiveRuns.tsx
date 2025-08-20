'use client';
import type { Job, JobStatus } from '@letta-cloud/sdk-core';
import {
  useRunsServiceListActiveRuns,
  UseRunsServiceListActiveRunsKeyFn,
} from '@letta-cloud/sdk-core';
import { useCurrentAgentMetaData } from '../useCurrentAgentMetaData/useCurrentAgentMetaData';
import { useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useCurrentAgentActiveRuns() {
  const { agentId } = useCurrentAgentMetaData();
  const queryClient = useQueryClient();

  const { data: activeRuns } = useRunsServiceListActiveRuns(
    {
      agentIds: agentId ? [agentId] : undefined,
    },
    undefined,
    {
      enabled: !!agentId,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      refetchInterval: 5000,
    },
  );

  const hasActiveRuns = useMemo(() => {
    return !!(activeRuns && activeRuns.length > 0);
  }, [activeRuns]);

  const setOptimisticActiveRun = useCallback(
    (runId?: string) => {
      if (!agentId) return;

      const queryKey = UseRunsServiceListActiveRunsKeyFn({
        agentIds: [agentId],
      });

      queryClient.setQueryData<Job[]>(queryKey, (old: Job[] | undefined) => {
        const existing = Array.isArray(old) ? old : [];
        const optimisticRun = {
          id: runId || `optimistic-${Date.now()}`,
          agent_id: agentId,
          status: 'running' as JobStatus,
          created_at: new Date().toISOString(),
        };
        return [...existing, optimisticRun];
      });
    },
    [agentId, queryClient],
  );

  const clearOptimisticActiveRuns = useCallback(() => {
    if (!agentId) return;

    const queryKey = UseRunsServiceListActiveRunsKeyFn({
      agentIds: [agentId],
    });

    void queryClient.invalidateQueries({ queryKey });
  }, [agentId, queryClient]);

  return useMemo(
    () => ({
      activeRuns: activeRuns || [],
      hasActiveRuns,
      setOptimisticActiveRun,
      clearOptimisticActiveRuns,
    }),
    [
      activeRuns,
      hasActiveRuns,
      setOptimisticActiveRun,
      clearOptimisticActiveRuns,
    ],
  );
}
