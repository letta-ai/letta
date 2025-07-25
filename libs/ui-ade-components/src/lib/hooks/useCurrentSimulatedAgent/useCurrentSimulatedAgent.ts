'use client';

import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useCurrentAgentMetaData } from '../useCurrentAgentMetaData/useCurrentAgentMetaData';
import { useCurrentAgent } from '../useCurrentAgent/useCurrentAgent';
import { useEffect, useMemo } from 'react';
import { toast } from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { UseAgentsServiceRetrieveAgentKeyFn } from '@letta-cloud/sdk-core';

export function useCurrentSimulatedAgent() {
  const agentState = useCurrentAgent();
  const { id: agentId } = agentState;
  const { isTemplate } = useCurrentAgentMetaData();
  const t = useTranslations('ADE/useCurrentSimulatedAgent');

  const { data: agentSession, isError } =
    webApi.agentTemplates.getAgentTemplateSimulatorSession.useQuery({
      queryKey: webApiQueryKeys.agentTemplates.getAgentTemplateSession({
        agentTemplateId: agentId,
      }),
      queryData: {
        params: {
          agentTemplateId: agentId,
        },
      },
      enabled: isTemplate,
      refetchInterval: 2500,
    });

  useEffect(() => {
    if (isError) {
      toast.error(t('error'));
    }
  }, [isError, t]);

  const agentIdToUse = useMemo(() => {
    if (isTemplate) {
      return agentSession?.body.agentId;
    }

    return agentId;
  }, [agentId, agentSession?.body.agentId, isTemplate]);

  return {
    agentSession,
    id: agentIdToUse || '',
  };
}

export function useCurrentSimulatedAgentQueryKey() {
  const { id: agentId } = useCurrentSimulatedAgent();

  return UseAgentsServiceRetrieveAgentKeyFn({
    agentId,
  });
}
