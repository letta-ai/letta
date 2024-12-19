'use client';
import { webOriginSDKApi, webOriginSDKQueryKeys } from '$letta/client';
import { useParams, usePathname } from 'next/navigation';
import { useAgentsServiceGetAgent } from '@letta-web/letta-agents-api';
import { get } from 'lodash-es';

interface UseCurrentAgentMetaDataResponse {
  agentId: string;
  agentName: string;
  isFromTemplate: boolean;
  isTemplate: boolean;
  isLocal: boolean;
}

export function useCurrentAgentMetaData(): UseCurrentAgentMetaDataResponse {
  const pathname = usePathname();
  const { agentId: preAgentId, templateName } = useParams<{
    agentId: string;
    templateName: string;
  }>();

  let agentId = preAgentId;

  const startsWithLocalProject = pathname.startsWith('/development-servers');

  const localAgent = useAgentsServiceGetAgent(
    {
      agentId,
    },
    undefined,
    {
      enabled: startsWithLocalProject,
    }
  );

  if (pathname.startsWith('/development-servers')) {
    return {
      agentId: agentId,
      agentName: localAgent?.data?.name || '',
      isTemplate: false,
      isLocal: true,
      isFromTemplate: false,
    };
  }

  let agentName = '';
  let isTemplate = false;
  let isFromTemplate = false;

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
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
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
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
      });

    agentId = deployedAgent?.body.id || '';
    agentName = deployedAgent?.body.name || '';
    isFromTemplate = !!get(deployedAgent?.body.metadata_, 'parentTemplate');
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
    isFromTemplate,
    isLocal: false,
  };
}
