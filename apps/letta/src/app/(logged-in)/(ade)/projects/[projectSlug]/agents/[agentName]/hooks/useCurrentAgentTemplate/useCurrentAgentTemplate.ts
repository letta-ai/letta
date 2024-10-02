import { webApi, webApiQueryKeys } from '$letta/client';
import { useParams } from 'next/navigation';

export function useCurrentAgentTemplate() {
  const { agentName } = useParams<{ agentName: string }>();

  const { data: agentTesting } =
    webApi.projects.getTestingAgentByIdOrName.useQuery({
      queryKey: webApiQueryKeys.projects.getTestingAgentByIdOrName(agentName),
      queryData: {
        query: {
          lookupBy: 'name',
        },
        params: {
          lookupValue: agentName,
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
