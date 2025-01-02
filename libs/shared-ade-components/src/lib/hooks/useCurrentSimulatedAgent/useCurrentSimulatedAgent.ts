'use client';

import { webApi, webApiQueryKeys } from '@letta-cloud/web-api-client';
import { useCurrentAgentMetaData } from '../useCurrentAgentMetaData/useCurrentAgentMetaData';
import { useCurrentAgent } from '../useCurrentAgent/useCurrentAgent';
import { useEffect, useMemo } from 'react';
import { toast } from '@letta-web/component-library';
import { useTranslations } from '@letta-cloud/translations';

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
