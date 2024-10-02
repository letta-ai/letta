'use client';
import type { AgentState } from '@letta-web/letta-agents-api';
import { useAgentsServiceGetAgent } from '@letta-web/letta-agents-api';
import { useCurrentAgentTemplate } from '../useCurrentAgentTemplate/useCurrentAgentTemplate';

export function useCurrentAgent() {
  const { id } = useCurrentAgentTemplate();

  const { data } = useAgentsServiceGetAgent({
    agentId: id,
  });

  if (!data?.id) {
    throw new Error(
      'This hook should be used within a page that server-side renders the agent data'
    );
  }

  return data as AgentState & { id: string };
}
