import { useCurrentAgentId } from '../useCurrentAgentId/useCurrentAgentId';
import { useCurrentProjectId } from '../../../../../../../(dashboard-like)/projects/[projectId]/hooks';
import { webApi, webApiQueryKeys } from '$letta/client';

export function useCurrentAgentTemplate() {
  const agentTemplateId = useCurrentAgentId();
  const projectId = useCurrentProjectId();

  const { data: agentTesting } =
    webApi.projects.getProjectAgentTemplate.useQuery({
      queryKey: webApiQueryKeys.projects.getProjectAgentTemplate(
        projectId,
        agentTemplateId
      ),
      queryData: {
        params: {
          projectId,
          agentTemplateId,
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
