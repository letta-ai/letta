'use client';

import { webApi, webApiQueryKeys } from '$letta/client';
import { useCurrentAgentMetaData } from '../useCurrentAgentMetaData/useCurrentAgentMetaData';
import { useCurrentAgent } from '../useCurrentAgent/useCurrentAgent';
import { useCurrentProject } from '../../../../../../../(dashboard-like)/projects/[projectSlug]/hooks';
import { useEffect, useMemo } from 'react';
import { toast } from '@letta-web/component-library';
import { useTranslations } from 'next-intl';

export function useCurrentSimulatedAgent() {
  const agentState = useCurrentAgent();
  const { id: agentId } = agentState;
  const { isTemplate } = useCurrentAgentMetaData();
  const { id: projectId } = useCurrentProject();
  const t = useTranslations('ADE/useCurrentSimulatedAgent');

  const { data: agentSession, isError } =
    webApi.agentTemplates.getAgentTemplateSimulatorSession.useQuery({
      queryKey: webApiQueryKeys.agentTemplates.getAgentTemplateSession({
        agentTemplateId: agentId,
        projectId,
      }),
      queryData: {
        params: {
          agentTemplateId: agentId,
          projectId,
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
