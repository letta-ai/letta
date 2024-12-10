'use client';
import { useAgentsServiceGetAgent } from '@letta-web/letta-agents-api';
import { useCurrentAgentMetaData } from '../useCurrentAgentMetaData/useCurrentAgentMetaData';

export function useCurrentAgent() {
  const { agentId, agentName, isLocal } = useCurrentAgentMetaData();

  const { data: agent } = useAgentsServiceGetAgent(
    {
      agentId,
    },
    undefined,
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      refetchInterval: isLocal ? 5000 : false,
    }
  );

  return {
    ...agent,
    name: agentName,
    id: agentId,
  };
}
