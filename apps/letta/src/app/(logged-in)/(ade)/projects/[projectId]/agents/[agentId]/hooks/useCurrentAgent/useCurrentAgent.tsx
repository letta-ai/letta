import type { AgentState } from '@letta-web/letta-agents-api';
import { useAgentsServiceGetAgent } from '@letta-web/letta-agents-api';
import { useCurrentTestingAgent } from '../useCurrentTestingAgent/useCurrentTestingAgent';

export function useCurrentAgent() {
  const agentTesting = useCurrentTestingAgent();

  const { data } = useAgentsServiceGetAgent({
    agentId: agentTesting.agentId,
  });

  if (!data?.id) {
    throw new Error(
      'This hook should be used within a page that server-side renders the agent data'
    );
  }

  return data as AgentState & { id: string };
}
