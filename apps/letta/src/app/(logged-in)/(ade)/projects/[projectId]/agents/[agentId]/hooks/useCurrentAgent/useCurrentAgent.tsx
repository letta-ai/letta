import { useCurrentTestingAgentId } from '../useCurrentAgentId/useCurrentTestingAgentId';
import type { AgentState } from '@letta-web/letta-agents-api';
import { useAgentsServiceGetAgent } from '@letta-web/letta-agents-api';
import { webApi, webApiQueryKeys } from '$letta/client';
import { useCurrentProjectId } from '../../../../../../../(dashboard-like)/projects/[projectId]/hooks';

export function useCurrentAgent() {
  const testingAgentId = useCurrentTestingAgentId();
  const projectId = useCurrentProjectId();

  const { data: agentTesting } =
    webApi.projects.getProjectTestingAgent.useQuery({
      queryKey: webApiQueryKeys.projects.getProjectTestingAgent(
        projectId,
        testingAgentId
      ),
      queryData: {
        params: {
          projectId,
          testingAgentId,
        },
      },
    });

  if (!agentTesting?.body) {
    throw new Error(
      'This hook should be used within a page that server-side renders the agent data'
    );
  }

  const { data } = useAgentsServiceGetAgent({
    agentId: agentTesting?.body.agentId,
  });

  if (!data?.id) {
    throw new Error(
      'This hook should be used within a page that server-side renders the agent data'
    );
  }

  return data as AgentState & { id: string };
}
