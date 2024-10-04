import { webOriginSDKApi, webOriginSDKQueryKeys } from '$letta/client';
import { useParams } from 'next/navigation';

interface MetaDataParams {
  agentId: string;
  templateName: string;
}

export function useCurrentAgentMetaData() {
  // @ts-expect-error - this is valid
  const { templateName } = useParams<MetaDataParams>();
  // @ts-expect-error - this is valid
  let { agentId } = useParams<MetaDataParams>();
  let agentName = '';
  let isTemplate = false;

  if (templateName) {
    isTemplate = true;

    const { data: agentTemplate } = webOriginSDKApi.agents.listAgents.useQuery({
      queryKey: webOriginSDKQueryKeys.agents.listAgentsWithSearch({
        name: templateName,
        template: true,
      }),
      queryData: {
        query: {
          name: templateName,
          template: true,
        },
      },
    });

    agentId = agentTemplate?.body[0]?.id || '';
    agentName = agentTemplate?.body[0]?.name || '';
  } else {
    const { data: deployedAgent } =
      webOriginSDKApi.agents.getAgentById.useQuery({
        queryKey: webOriginSDKQueryKeys.agents.getAgentById(agentId),
        queryData: {
          params: {
            agent_id: agentId,
          },
        },
      });

    agentId = deployedAgent?.body.id || '';
    agentName = deployedAgent?.body.name || '';
  }

  if (!agentId) {
    throw new Error(
      'This hook should be used within a page that server-side renders the agent data'
    );
  }

  return {
    agentId,
    agentName,
    isTemplate,
  };
}
