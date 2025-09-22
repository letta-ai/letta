'use client';
import { useMemo } from 'react';
import { cloudAPI, cloudQueryKeys } from '@letta-cloud/sdk-cloud-api';
import { useParams, usePathname } from 'next/navigation';
import { useAgentsServiceRetrieveAgent } from '@letta-cloud/sdk-core';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useCurrentTemplate } from '../useCurrentTemplate/useCurrentTemplate';
import { useCurrentAgentTemplate } from '../useCurrentAgentTemplate/useCurrentAgentTemplate';
import { getIsLocalPlatform } from '@letta-cloud/utils-shared';

interface UseCurrentAgentMetaDataResponse {
  agentId: string;
  agentName: string;
  agentType: string;
  isFromTemplate: boolean;
  templateName?: string;
  isTemplate: boolean;
  isLocal: boolean;
  templateId?: string;
  isSleeptimeAgent: boolean;
}

// Helper hook for determining page context
function usePageContext() {
  const pathname = usePathname();

  const isChatPage = pathname.startsWith('/chat');
  const isLocal =
    pathname.startsWith('/development-servers') ||
    getIsLocalPlatform();

  return { isChatPage, isLocal };
}

// Hook for local agent data
function useLocalAgentData(agentId: string, enabled: boolean) {
  const localAgent = useAgentsServiceRetrieveAgent({ agentId }, undefined, {
    enabled,
  });

  return {
    agentName: localAgent?.data?.name || '',
    agentType: localAgent?.data?.agent_type || '',
    isSleeptimeAgent: localAgent?.data?.enable_sleeptime || false,
  };
}

// Hook for template agent data
function useTemplateAgentData() {
  const { template: agentTemplate } = useCurrentTemplate();
  const agentTemplateQuery = useCurrentAgentTemplate();
  const agentTemplateId = agentTemplateQuery.data?.body.id || '';

  const { data: agentSession } =
    webApi.simulatedAgents.getDefaultSimulatedAgent.useQuery({
      queryKey:
        webApiQueryKeys.simulatedAgents.getDefaultSimulatedAgent(agentTemplateId),
      queryData: {
        params: {
          agentTemplateId,
        },
      },
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      enabled: !!agentTemplateId,
    });

  const { data: agent } = useAgentsServiceRetrieveAgent(
    {
      agentId: agentSession?.body.agentId || '',
    },
    undefined,
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      enabled: !!agentSession?.body.agentId,
      refetchInterval: 2500,
    },
  );

  return {
    templateId: agentTemplateId || '',
    agentId: agentSession?.body.agentId || '',
    agentName: agentTemplate?.name || '',
    agentType: agent?.agent_type || '',
  };
}

// Hook for deployed agent data
function useDeployedAgentData(agentId: string, enabled: boolean) {
  const deployedQuery = cloudAPI.agents.getAgentById.useQuery({
    queryKey: cloudQueryKeys.agents.getAgentById(agentId),
    queryData: {
      params: {
        agent_id: agentId,
        include_relationships: [],
      },
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    enabled,
  });

  const deployedAgent = deployedQuery.data?.body;

  return {
    agentId: deployedAgent?.id || '',
    agentName: deployedAgent?.name || '',
    agentType: deployedAgent?.agent_type || '',
    isFromTemplate: !!deployedAgent?.base_template_id,
    isSleeptimeAgent: deployedAgent?.enable_sleeptime || false,
  };
}

// Main hook that orchestrates the subhooks
export function useCurrentAgentMetaData(): UseCurrentAgentMetaDataResponse {
  const { agentId: preAgentId, templateName } = useParams<{
    agentId: string;
    templateName: string;
    projectSlug: string;
    entityId?: string;
  }>();

  const { isChatPage, isLocal } = usePageContext();

  // Always call all hooks but conditionally enable them
  const localAgentData = useLocalAgentData(preAgentId, (isLocal && !isChatPage));
  const templateData = useTemplateAgentData();
  const deployedData = useDeployedAgentData(
    preAgentId,
    !isChatPage && !isLocal && !templateName,
  );

  return useMemo((): UseCurrentAgentMetaDataResponse => {
    // Early return for chat page
    if (isChatPage) {
      return {
        agentId: preAgentId,
        agentName: '',
        agentType: '',
        isTemplate: false,
        isLocal: false,
        isFromTemplate: false,
        isSleeptimeAgent: false,
      };
    }

    // Return local agent data
    if (isLocal) {
      return {
        agentId: preAgentId,
        agentName: localAgentData.agentName,
        agentType: localAgentData.agentType,
        isTemplate: false,
        isLocal: true,
        isFromTemplate: false,
        isSleeptimeAgent: localAgentData.isSleeptimeAgent,
      };
    }

    // Return template data
    if (templateName) {
      return {
        templateId: templateData.templateId,
        agentId: templateData.agentId,
        agentName: templateData.agentName,
        agentType: templateData.agentType,
        templateName,
        isTemplate: true,
        isFromTemplate: false,
        isSleeptimeAgent: false,
        isLocal: false,
      };
    }

    // Return deployed agent data
    return {
      agentId: deployedData.agentId,
      agentName: deployedData.agentName,
      agentType: deployedData.agentType,
      templateName,
      isTemplate: false,
      isFromTemplate: deployedData.isFromTemplate,
      isSleeptimeAgent: deployedData.isSleeptimeAgent,
      isLocal: false,
    };
  }, [
    isChatPage,
    isLocal,
    preAgentId,
    templateName,
    localAgentData.agentName,
    localAgentData.agentType,
    localAgentData.isSleeptimeAgent,
    templateData.templateId,
    templateData.agentId,
    templateData.agentName,
    templateData.agentType,
    deployedData.agentId,
    deployedData.agentName,
    deployedData.agentType,
    deployedData.isFromTemplate,
    deployedData.isSleeptimeAgent,
  ]);
}
