'use client';
import React, { useEffect, useRef } from 'react';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useCurrentAgentMetaData } from '../useCurrentAgentMetaData/useCurrentAgentMetaData';
import { useCurrentAgent } from '../useCurrentAgent/useCurrentAgent';
import { useMemo } from 'react';
import { toast } from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import {
  type AgentState,
  isAgentState,
  useAgentsServiceListAgentSources,
  useAgentsServiceRetrieveAgent,
  UseAgentsServiceRetrieveAgentKeyFn,
} from '@letta-cloud/sdk-core';
import { useDebouncedCallback } from '@mantine/hooks';
import { compareAgentStates } from '@letta-cloud/utils-shared';
import { isEqual } from 'lodash';

interface SimulatedAgentProviderProps {
  children: React.ReactNode;
}

function SimulatedAgentProviderLogic(props: SimulatedAgentProviderProps) {
  const t = useTranslations('ADE/AgentSimulator');

  const templateAgentState = useCurrentAgent();

  const agentTemplateId = templateAgentState.id;

  const { children } = props;

  const { simulatedAgentId } = useCurrentSimulatedAgent();

  // manages the simulated agent state

  const mounted = useRef(false);

  const agentStateStore = useRef<AgentState>(templateAgentState as AgentState);

  const variables = useCurrentSimulatedAgentVariables();
  const { mutate: updateSession } =
    webApi.simulatedAgents.refreshSimulatedSession.useMutation({
      onError: () => {
        toast.error(t('refreshError'));
      },
    });

  const { data: sourceList } = useAgentsServiceListAgentSources({
    agentId: templateAgentState.id || '',
  });

  const debounceUpdateSession = useDebouncedCallback(updateSession, 2000);

  useEffect(() => {
    if (!simulatedAgentId) {
      return;
    }

    // update session just in case
    if (!mounted.current) {
      debounceUpdateSession({
        params: {
          simulatedAgentId,
        },
      });
    }

    mounted.current = true;
  }, [simulatedAgentId, agentTemplateId, debounceUpdateSession, updateSession]);

  useEffect(() => {
    if (!simulatedAgentId) {
      return;
    }

    if (!isAgentState(templateAgentState)) {
      return;
    }

    // check if the agent state has changed
    if (compareAgentStates(templateAgentState, agentStateStore.current)) {
      return;
    }

    agentStateStore.current = templateAgentState;

    // update the existing session
    debounceUpdateSession({
      params: {
        simulatedAgentId,
      },
    });
  }, [
    agentTemplateId,
    simulatedAgentId,
    templateAgentState,
    debounceUpdateSession,
    sourceList,
  ]);

  const lastVariableState = useRef(variables);

  useEffect(() => {
    if (!simulatedAgentId) {
      return;
    }

    if (isEqual(lastVariableState.current, variables)) {
      return;
    }

    lastVariableState.current = variables;

    debounceUpdateSession({
      params: {
        simulatedAgentId,
      },
    });
  }, [debounceUpdateSession, simulatedAgentId, variables]);

  return children;
}

export function SimulatedAgentProvider(props: SimulatedAgentProviderProps) {
  const { children } = props;
  const { isTemplate } = useCurrentAgentMetaData();

  if (!isTemplate) {
    return children;
  }

  return <SimulatedAgentProviderLogic>{children}</SimulatedAgentProviderLogic>;
}

export function useCurrentSimulatedAgent() {
  const agentState = useCurrentAgent();
  const { id: agentId } = agentState;

  const { isTemplate, agentId: templateId } = useCurrentAgentMetaData();

  const {
    data: agentSession,
    isError,
    isLoading,
  } = webApi.simulatedAgents.getDefaultSimulatedAgent.useQuery({
    queryKey:
      webApiQueryKeys.simulatedAgents.getDefaultSimulatedAgent(templateId),
    queryData: {
      params: {
        agentTemplateId: agentId,
      },
    },
    retry: false,
    enabled: isTemplate,
  });

  const {
    data: agent,
    isFetching: isRefetchingAgent,
    refetch,
  } = useAgentsServiceRetrieveAgent(
    {
      agentId: agentSession?.body.agentId || '',
    },
    undefined,
    {
      enabled: !!agentSession?.body.agentId,
      refetchInterval: 2500,
    },
  );

  const agentIdToUse = useMemo(() => {
    if (isTemplate) {
      return agentSession?.body.agentId || '';
    }

    return agentId;
  }, [agentId, agentSession?.body.agentId, isTemplate]);

  return {
    isError,
    isLoading,
    isRefetchingAgent,
    refetchSimulatedAgent: refetch,
    simulatedAgent: agent,
    simulatedSession: agentSession,
    simulatedAgentId: agentSession?.body.id,
    id: agentIdToUse || '',
  };
}

export function useCurrentSimulatedAgentVariables() {
  const { simulatedAgentId } = useCurrentSimulatedAgent();

  const { data: variables } =
    webApi.simulatedAgents.getSimulatedAgentVariables.useQuery({
      queryKey: webApiQueryKeys.simulatedAgents.getSimulatedAgentVariables(
        simulatedAgentId || '',
      ),
      queryData: {
        params: {
          simulatedAgentId: simulatedAgentId || '',
        },
      },
      retry: false,
      enabled: !!simulatedAgentId,
    });

  return variables?.body;
}

export function useCurrentSimulatedAgentQueryKey() {
  const { id: agentId } = useCurrentSimulatedAgent();

  return UseAgentsServiceRetrieveAgentKeyFn({
    agentId,
  });
}
