'use client';
import { useAgentsServiceGetAgent } from '@letta-web/letta-agents-api';
import { useCurrentAgentMetaData } from '../useCurrentAgentMetaData/useCurrentAgentMetaData';

export function useCurrentAgent() {
  const { agentId, agentName } = useCurrentAgentMetaData();

  const { data: agent } = useAgentsServiceGetAgent(
    {
      agentId,
    },
    undefined,
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
    }
  );

  return {
    ...agent,
    name: agentName,
    id: agentId,
  };
}
