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

  if (!agent?.id) {
    throw new Error(
      'This hook should be used within a page that server-side renders the agent data (1)'
    );
  }

  return {
    ...agent,
    name: agentName,
    id: agentId,
  };
}
