import { useCurrentTestingAgentId } from '../useCurrentAgentId/useCurrentTestingAgentId';
import { useCurrentProjectId } from '../../../../../../../(dashboard-like)/projects/[projectId]/hooks';
import { webApi, webApiQueryKeys } from '$letta/client';

export function useCurrentTestingAgent() {
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

  return agentTesting.body;
}
