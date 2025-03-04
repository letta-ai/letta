'use client';
import { cloudAPI, cloudQueryKeys } from '@letta-cloud/sdk-cloud-api';
import { useParams, usePathname } from 'next/navigation';
import { useAgentsServiceRetrieveAgent } from '@letta-cloud/sdk-core';
import { CURRENT_RUNTIME } from '@letta-cloud/config-runtime';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';

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

  const isChatPage = pathname.startsWith('/chat');

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

  if (isChatPage) {
    return {
      agentId: agentId,
      agentName: '',
      isTemplate: false,
      isLocal: false,
      isFromTemplate: false,
    };
  }

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
    const { data: deployedAgent } = cloudAPI.agents.getAgentById.useQuery({
      queryKey: cloudQueryKeys.agents.getAgentById(agentId),
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
