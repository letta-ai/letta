import { useQueryClient } from '@tanstack/react-query';
import { useCurrentAgent } from '../useCurrentAgent/useCurrentAgent';
import type { AgentState } from '@letta-web/letta-agents-api';
import {
  UseAgentsServiceGetAgentKeyFn,
  useAgentsServiceUpdateAgent,
} from '@letta-web/letta-agents-api';
import { useCallback, useEffect, useRef } from 'react';

export function useSyncUpdateCurrentAgent() {
  const currentAgent = useCurrentAgent();
  const queryClient = useQueryClient();
  const debouncer = useRef<ReturnType<typeof setTimeout>>();

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

          if (debouncer.current) {
            clearTimeout(debouncer.current);
          }

          debouncer.current = setTimeout(() => {
            updateAgent({
              agentId: currentAgent.id,
              requestBody: {
                id: currentAgent.id,
                ...newAgentData,
              },
            });
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

  return { syncUpdateCurrentAgent };
}
