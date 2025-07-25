'use client';
import {
  useAgentsServiceRetrieveAgent,
  UseAgentsServiceRetrieveAgentKeyFn,
} from '@letta-cloud/sdk-core';
import { useCurrentAgentMetaData } from '../useCurrentAgentMetaData/useCurrentAgentMetaData';
import { useMemo } from 'react';

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

  return useMemo(
    () => ({
      ...agent,
      name: agentName,
      id: agentId,
    }),
    [agent, agentId, agentName],
  );
}

export function useCurrentAgentQueryKey() {
  const { agentId } = useCurrentAgentMetaData();

  return UseAgentsServiceRetrieveAgentKeyFn({
    agentId,
  });
}
