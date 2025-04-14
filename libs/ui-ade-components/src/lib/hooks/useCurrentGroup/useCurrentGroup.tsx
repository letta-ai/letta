'use client';
import { useCurrentAgent } from '../useCurrentAgent/useCurrentAgent';
import { useGroupsServiceRetrieveGroup } from '@letta-cloud/sdk-core';

export function useCurrentGroup() {
  const agent = useCurrentAgent();

  const { data: group } = useGroupsServiceRetrieveGroup(
    {
      groupId: agent.multi_agent_group?.id || '',
    },
    undefined,
    {
      enabled: !!agent.multi_agent_group,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      refetchInterval: false,
    },
  );

  return group;
}
