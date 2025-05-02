'use client';
import { cloudAPI, cloudQueryKeys } from '@letta-cloud/sdk-cloud-api';
import { useParams, usePathname } from 'next/navigation';
import { useAgentsServiceRetrieveAgent } from '@letta-cloud/sdk-core';
import { CURRENT_RUNTIME } from '@letta-cloud/config-runtime';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';

interface UseCurrentAgentMetaDataResponse {
  agentId: string;
  agentName: string;
  agentType: string;
  isFromTemplate: boolean;
  templateName?: string;
  isTemplate: boolean;
  isLocal: boolean;
  isSleeptimeAgent: boolean;
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
      agentType: '',
      isTemplate: false,
      isLocal: false,
      isFromTemplate: false,
      isSleeptimeAgent: false,
    };
  }

  if (isLocal) {
    return {
      agentId: agentId,
      agentName: localAgent?.data?.name || '',
      agentType: localAgent?.data?.agent_type || '',
      isTemplate: false,
      isLocal: true,
      isFromTemplate: false,
      isSleeptimeAgent: localAgent?.data?.enable_sleeptime || false,
    };
  }

  let agentName = '';
  let agentType = '';
  let isTemplate = false;
  let isFromTemplate = false;
  let isSleeptimeAgent = false;

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
    agentType =
      agentTemplate?.body.agentTemplates[0]?.agentState?.agent_type || '';
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
    agentType = deployedAgent?.body.agent_type || '';
    isFromTemplate = !!deployedAgent?.body.base_template_id;
    isSleeptimeAgent = deployedAgent?.body.enable_sleeptime || false;
  }

  return {
    agentId,
    agentName,
    agentType,
    templateName,
    isTemplate,
    isFromTemplate,
    isSleeptimeAgent,
    isLocal: false,
  };
}
