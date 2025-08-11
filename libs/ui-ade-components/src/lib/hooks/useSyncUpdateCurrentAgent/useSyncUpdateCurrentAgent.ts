import { useQueryClient } from '@tanstack/react-query';
import { useCurrentAgent } from '../useCurrentAgent/useCurrentAgent';
import type { AgentState } from '@letta-cloud/sdk-core';
import {
  UseAgentsServiceRetrieveAgentKeyFn,
  useAgentsServiceModifyAgent,
} from '@letta-cloud/sdk-core';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useSyncUpdateCurrentAgent(options?: {
  refreshOnSuccess?: boolean
}) {
  const currentAgent = useCurrentAgent();
  const queryClient = useQueryClient();
  const debouncer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>();
  const [error, setError] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [isDebouncing, setIsDebouncing] = useState<boolean>(false);

  const { mutate: updateAgent } = useAgentsServiceModifyAgent();

  const syncUpdateCurrentAgent = useCallback(
    (updater: (oldData: AgentState) => Partial<AgentState>) => {
      queryClient.setQueriesData<AgentState | undefined>(
        {
          queryKey: UseAgentsServiceRetrieveAgentKeyFn({
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

            const { memory: _memory, ...updateAgentData } = newAgentData;

            updateAgent(
              {
                agentId: currentAgent.id,
                requestBody: {
                  id: currentAgent.id,
                  ...updateAgentData,
                  reasoning: updateAgentData.llm_config?.enable_reasoner || updateAgentData.llm_config?.put_inner_thoughts_in_kwargs,
                  tool_exec_environment_variables:
                    updateAgentData.tool_exec_environment_variables
                      ? Object.fromEntries(
                          updateAgentData.tool_exec_environment_variables.map(
                            (item) => [item.key, item.value],
                          ),
                        )
                      : undefined,
                },
              },
              {
                onSuccess: () => {
                  setIsUpdating(false);
                  setLastUpdatedAt(new Date().toISOString());

                  if (options?.refreshOnSuccess) {
                    void queryClient.invalidateQueries({
                      queryKey: UseAgentsServiceRetrieveAgentKeyFn({
                        agentId: currentAgent.id,
                      }),
                    });
                  }
                },
                onError: () => {
                  setIsUpdating(false);
                  setError(true);
                },
              },
            );
          }, 500);

          return {
            ...oldData,
            ...newAgentData,
          };
        },
      );
    },
    [currentAgent.id, queryClient, updateAgent, options?.refreshOnSuccess],
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
