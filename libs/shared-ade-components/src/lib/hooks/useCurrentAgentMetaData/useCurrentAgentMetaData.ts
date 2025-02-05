'use client';
import {
  webOriginSDKApi,
  webOriginSDKQueryKeys,
} from '@letta-cloud/letta-agents-api';
import { useParams, usePathname } from 'next/navigation';
import { useAgentsServiceRetrieveAgent } from '@letta-cloud/letta-agents-api';
import { CURRENT_RUNTIME } from '@letta-cloud/runtime';
import { webApi, webApiQueryKeys } from '@letta-cloud/web-api-client';

interface UseCurrentAgentMetaDataResponse {
  agentId: string;
  agentName: string;
  isFromTemplate: boolean;
  templateName?: string;
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

  const isLocal =
    pathname.startsWith('/development-servers') ||
    CURRENT_RUNTIME === 'letta-desktop';

  const localAgent = useAgentsServiceRetrieveAgent(
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

  if (templateName) {
    isTemplate = true;

    const { data: agentTemplate } =
      webApi.agentTemplates.listAgentTemplates.useQuery({
        queryKey: webApiQueryKeys.agentTemplates.listAgentTemplatesWithSearch({
          name: templateName,
        }),
        queryData: {
          query: {
            name: templateName,
          },
        },
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
      });

    agentId = agentTemplate?.body.agentTemplates[0]?.id || '';
    agentName = agentTemplate?.body.agentTemplates[0]?.name || '';
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
    isFromTemplate = !!deployedAgent?.body.base_template_id;
  }

  return {
    agentId,
    agentName,
    templateName,
    isTemplate,
    isFromTemplate,
    isLocal: false,
  };
}
