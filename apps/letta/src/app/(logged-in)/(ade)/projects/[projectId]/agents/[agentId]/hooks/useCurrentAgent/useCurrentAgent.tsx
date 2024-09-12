import { useCurrentTestingAgentId } from '../useCurrentAgentId/useCurrentTestingAgentId';
import type { AgentState } from '@letta-web/letta-agents-api';
import { useAgentsServiceGetAgent } from '@letta-web/letta-agents-api';

export function useCurrentAgent() {
  const agentId = useCurrentTestingAgentId();

  const { data } = useAgentsServiceGetAgent({
    agentId,
  });

  if (!data?.id) {
    throw new Error(
      'This hook should be used within a page that server-side renders the agent data'
    );
  }

  return data as AgentState & { id: string };
}
