import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { UseAgentsServiceRetrieveAgentKeyFn } from '@letta-cloud/sdk-core';
import type { AgentState, ToolType } from '@letta-cloud/sdk-core';

export interface OptimisticTool {
  id: string;
  name: string;
  tool_type: ToolType;
}

export function useOptimisticAgentTools(agentId: string) {
  const queryClient = useQueryClient();

  const addOptimisticTool = useCallback(
    (tool: OptimisticTool) => {
      queryClient.setQueriesData<AgentState | undefined>(
        {
          queryKey: UseAgentsServiceRetrieveAgentKeyFn({
            agentId,
          }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          if (
            oldData.tools?.some((existingTool) => existingTool.id === tool.id)
          ) {
            return oldData;
          }

          return {
            ...oldData,
            tools: [...(oldData.tools || []), tool],
          };
        },
      );
    },
    [queryClient, agentId],
  );

  const removeOptimisticTool = useCallback(
    (toolId: string) => {
      queryClient.setQueriesData<AgentState | undefined>(
        {
          queryKey: UseAgentsServiceRetrieveAgentKeyFn({
            agentId,
          }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return {
            ...oldData,
            tools: oldData.tools?.filter((tool) => tool.id !== toolId) || [],
          };
        },
      );
    },
    [queryClient, agentId],
  );

  const updateAgentTools = useCallback(
    (newAgentState: AgentState) => {
      queryClient.setQueriesData<AgentState | undefined>(
        {
          queryKey: UseAgentsServiceRetrieveAgentKeyFn({
            agentId: newAgentState.id,
          }),
        },
        () => newAgentState,
      );
    },
    [queryClient],
  );

  return {
    addOptimisticTool,
    removeOptimisticTool,
    updateAgentTools,
  };
}
