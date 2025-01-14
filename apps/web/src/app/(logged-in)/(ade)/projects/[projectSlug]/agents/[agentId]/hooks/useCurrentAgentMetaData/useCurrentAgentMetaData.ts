'use client';
import {
  webOriginSDKApi,
  webOriginSDKQueryKeys,
} from '@letta-cloud/letta-agents-api';
import { useParams, usePathname } from 'next/navigation';
import { useAgentsServiceGetAgent } from '@letta-cloud/letta-agents-api';
import { get } from 'lodash-es';
import { CURRENT_RUNTIME } from '@letta-cloud/runtime';

interface UseCurrentAgentMetaDataResponse {
  agentId: string;
  agentName: string;
  isFromTemplate: boolean;
  isTemplate: boolean;
  parentTemplateName?: string;
  isLocal: boolean;
}

export function useCurrentAgentMetaData(): UseCurrentAgentMetaDataResponse {
  const pathname = usePathname();
  const { agentId: preAgentId, templateName } = useParams<{
    agentId: string;
    templateName: string;
  }>();

  let agentId = preAgentId;

  const isLocal =
    pathname.startsWith('/development-servers') ||
    CURRENT_RUNTIME === 'letta-desktop';

  const localAgent = useAgentsServiceGetAgent(
    {
      agentId,
    },
    undefined,
    {
      enabled: isLocal,
    },
  );

  if (isLocal) {
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
  let parentTemplateName = '';

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
    isFromTemplate = !!get(deployedAgent?.body.metadata_, 'parentTemplateId');
    parentTemplateName = String(
      get(deployedAgent?.body.metadata_, 'parentTemplateName', ''),
    );
  }

  if (!agentId) {
    throw new Error(
      'This hook should be used within a page that server-side renders the agent data',
    );
  }

  return {
    agentId,
    agentName,
    isTemplate,
    parentTemplateName,
    isFromTemplate,
    isLocal: false,
  };
}
