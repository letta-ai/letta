'use client';
import {
  useAgentsServiceRetrieveAgent,
  UseAgentsServiceRetrieveAgentKeyFn,
} from '@letta-cloud/sdk-core';
import { useCurrentAgentMetaData } from '../useCurrentAgentMetaData/useCurrentAgentMetaData';

export function useCurrentAgent() {
  const { agentId, agentName } = useCurrentAgentMetaData();

  const { data: agent } = useAgentsServiceRetrieveAgent(
    {
      agentId,
    },
    undefined,
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      refetchInterval: 5000,
    },
  );

  return {
    ...agent,
    name: agentName,
    id: agentId,
  };
}

export function useCurrentAgentQueryKey() {
  const { agentId } = useCurrentAgentMetaData();

  return UseAgentsServiceRetrieveAgentKeyFn({
    agentId,
  });
}
