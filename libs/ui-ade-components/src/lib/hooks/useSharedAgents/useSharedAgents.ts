import { useBlocksServiceListAgentsForBlock } from '@letta-cloud/sdk-core';
import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { CURRENT_RUNTIME } from '@letta-cloud/config-runtime';
import { useADEState } from '../useADEState/useADEState';
import { useADEAppContext } from '../../AppContext/AppContext';
import { useCurrentAgent } from '../useCurrentAgent/useCurrentAgent';

export function useSharedAgents(blockId: string) {
  const { push } = useRouter();
  const { id } = useCurrentAgent();

  const { isLocal } = useADEState();
  const { projectSlug } = useADEAppContext();

  const handleMoveToAgent = useCallback(
    (agentId: string) => {
      if (CURRENT_RUNTIME === 'letta-desktop') {
        push(`/dashboard/agents/${agentId}`);

        return;
      }

      if (projectSlug) {
        if (!isLocal) {
          window.open(
            `${window.location.origin}/projects/${projectSlug}/agents/${agentId}`,
            '_blank',
          );
          return;
        }

        window.open(
          `${window.location.origin}${projectSlug}/agents/${agentId}`,
          '_blank',
        );
        return;
      }

      push('/agents');
    },
    [isLocal, projectSlug, push],
  );

  const { data: agents } = useBlocksServiceListAgentsForBlock(
    {
      blockId,
      includeRelationships: [],
    },
    undefined,
    {
      enabled: !!blockId,
    },
  );

  return useMemo(() => {
    if (!agents) {
      return [];
    }

    return agents
      .toSorted((a, b) => {
        if (a.id === id) return -1;
        if (b.id === id) return 1;
        return a.name.localeCompare(b.name);
      })
      .map((agent) => ({
        id: agent.id,
        name: agent.name,
        agentType: agent.agent_type,
        onClick() {
          handleMoveToAgent(agent.id);
        },
        isCurrentAgent: agent.id === id,
      }));
  }, [agents, handleMoveToAgent, id]);
}
