import { useQueryClient } from '@tanstack/react-query';
import { useCurrentAgent } from '../useCurrentAgent/useCurrentAgent';
import type { AgentState } from '@letta-web/letta-agents-api';
import {
  UseAgentsServiceGetAgentKeyFn,
  useAgentsServiceUpdateAgent,
} from '@letta-web/letta-agents-api';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useSyncUpdateCurrentAgent() {
  const currentAgent = useCurrentAgent();
  const queryClient = useQueryClient();
  const debouncer = useRef<ReturnType<typeof setTimeout>>();
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>();
  const [error, setError] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [isDebouncing, setIsDebouncing] = useState<boolean>(false);

  const { mutate: updateAgent } = useAgentsServiceUpdateAgent();

  const syncUpdateCurrentAgent = useCallback(
    (updater: (oldData: AgentState) => Partial<AgentState>) => {
      queryClient.setQueriesData<AgentState | undefined>(
        {
          queryKey: UseAgentsServiceGetAgentKeyFn({
            agentId: currentAgent.id,
          }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          const newAgentData = updater(oldData);

          setIsDebouncing(true);

          if (debouncer.current) {
            clearTimeout(debouncer.current);
          }

          debouncer.current = setTimeout(() => {
            setError(false);
            setIsUpdating(true);
            setIsDebouncing(false);

            updateAgent(
              {
                agentId: currentAgent.id,
                requestBody: {
                  id: currentAgent.id,
                  ...newAgentData,
                },
              },
              {
                onSuccess: () => {
                  setIsUpdating(false);
                  setLastUpdatedAt(new Date().toISOString());
                },
                onError: () => {
                  setIsUpdating(false);
                  setError(true);
                },
              }
            );
          }, 500);

          return {
            ...oldData,
            ...newAgentData,
          };
        }
      );
    },
    [currentAgent.id, queryClient, updateAgent]
  );

  useEffect(() => {
    return () => {
      if (debouncer.current) {
        clearTimeout(debouncer.current);
      }
    };
  }, []);

  return {
    syncUpdateCurrentAgent,
    isUpdating,
    isDebouncing,
    lastUpdatedAt,
    error,
  };
}
