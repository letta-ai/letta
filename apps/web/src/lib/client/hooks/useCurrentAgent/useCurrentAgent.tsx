'use client';
import { useAgentsServiceRetrieveAgent } from '@letta-cloud/letta-agents-api';
import { useCurrentAgentMetaData } from '@letta-cloud/shared-ade-components';

export function useCurrentAgent() {
  const { agentId, agentName, isLocal } = useCurrentAgentMetaData();

  const { data: agent } = useAgentsServiceRetrieveAgent(
    {
      agentId,
    },
    undefined,
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      refetchInterval: isLocal ? 5000 : false,
    },
  );

  return {
    ...agent,
    name: agentName,
    id: agentId,
  };
}
