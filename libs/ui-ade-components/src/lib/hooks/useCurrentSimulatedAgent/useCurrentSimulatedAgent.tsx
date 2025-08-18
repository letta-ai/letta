'use client';
import React, { useEffect, useRef } from 'react';
import type { contracts } from '@letta-cloud/sdk-web';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useCurrentAgentMetaData } from '../useCurrentAgentMetaData/useCurrentAgentMetaData';
import { useMemo } from 'react';
import {
  isAgentState,
  useAgentsServiceRetrieveAgent,
  UseAgentsServiceRetrieveAgentKeyFn,
} from '@letta-cloud/sdk-core';
import { useDebouncedCallback } from '@mantine/hooks';
import {
  synchronizeSimulatedAgentWithAgentTemplate,
  removeMetadataFromAgentTemplateResponse,
  removeMetadataFromBlockTemplate,
} from '@letta-cloud/utils-shared';
import { useIsMutating, useQueryClient } from '@tanstack/react-query';
import { isFetchError } from '@ts-rest/react-query/v5';
import {
  useCurrentAgentTemplate,
  useCurrentAgentTemplateQueryKey,
} from '../useCurrentAgentTemplate/useCurrentAgentTemplate';
import type { ServerInferResponses } from '@ts-rest/core';
import type { cloudContracts } from '@letta-cloud/sdk-cloud-api';
import { cloudQueryKeys } from '@letta-cloud/sdk-cloud-api';
import { useADEAppContext } from '../../../index';
import { isEqual } from 'lodash';
import { useCurrentTemplateSnapshot } from '../useCurrentTemplateSnapshot/useCurrentTemplateSnapshot';

interface SimulatedAgentProviderProps {
  children: React.ReactNode;
}

function SimulatedAgentProviderLogic(props: SimulatedAgentProviderProps) {
  const { children } = props;

  // immediately load snapshots
  useCurrentTemplateSnapshot('current');
  useCurrentTemplateSnapshot('latest');

  useSynchronizeSimulatedAgentWithAgentTemplate();

  // Compare template schema with current synchronized state to trigger sync when needed
  return children;
}

export function useSynchronizeSimulatedAgentWithAgentTemplate() {
  const {
    isTemplate,
    templateName,
    templateId: agentTemplateId,
  } = useCurrentAgentMetaData();
  const currentAgentTemplateQueryKey = useCurrentAgentTemplateQueryKey();

  const { projectSlug } = useADEAppContext();
  const { simulatedAgent } = useCurrentSimulatedAgent();

  const queryClient = useQueryClient();
  // Fetch the current agent template schema for comparison
  const { data: agentTemplateSchema, error } = useCurrentAgentTemplate();

  const { data: blockTemplates } =
    webApi.blockTemplates.getAgentTemplateBlockTemplates.useQuery({
      queryData: {
        params: { agentTemplateId: agentTemplateId || '' },
      },
      queryKey: webApiQueryKeys.blockTemplates.getAgentTemplateBlockTemplates(
        agentTemplateId || '',
      ),
      enabled: !!(isTemplate && agentTemplateId),
    });

  const isNotFound = useMemo(() => {
    if (isFetchError(error)) {
      return false;
    }

    return error?.status === 404;
  }, [error]);

  const cachedTemplateBlocks = useRef(blockTemplates?.body.blockTemplates);

  const { mutate: syncDefaultSimulatedAgent, isPending: isSyncing } =
    webApi.simulatedAgents.syncDefaultSimulatedAgent.useMutation({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: currentAgentTemplateQueryKey,
        });
      },
      onError: () => {
        // On error, invalidate to ensure we have the correct state
        void queryClient.invalidateQueries({
          queryKey: currentAgentTemplateQueryKey,
        });
      },
    });

  const debounceSyncTemplate = useDebouncedCallback(
    syncDefaultSimulatedAgent,
    3000,
  );

  useEffect(() => {
    if (isSyncing) {
      return;
    }

    if (isNotFound && agentTemplateId) {
      // if not found, then we should attempt a synchronization
      debounceSyncTemplate({
        params: {
          agentTemplateId,
        },
      });
    }
  }, [agentTemplateId, isNotFound, isSyncing, debounceSyncTemplate]);

  useEffect(() => {
    if (isSyncing) {
      return;
    }

    if (!blockTemplates) {
      return;
    }

    if (blockTemplates?.body.blockTemplates && !cachedTemplateBlocks.current) {
      cachedTemplateBlocks.current = blockTemplates.body.blockTemplates;
      return;
    }

    if (!agentTemplateId || !isTemplate) {
      return;
    }

    if (!agentTemplateSchema?.body) {
      return;
    }

    if (!cachedTemplateBlocks.current) {
      return;
    }

    if (!isAgentState(simulatedAgent)) {
      return;
    }

    const cleanedBlockTemplates = blockTemplates.body.blockTemplates.map(removeMetadataFromBlockTemplate);

    // Synchronize current agent state to get comparable data structure
    const { agentTemplate } =
      synchronizeSimulatedAgentWithAgentTemplate({
        ...simulatedAgent,
        memory: {
          ...simulatedAgent,
          blocks: cleanedBlockTemplates,
        }
      });


    // Fast comparison to check if sync is needed
    const statesMatch =
      isEqual(
        blockTemplates.body.blockTemplates,
        cachedTemplateBlocks.current,
      ) &&
      isEqual(
        agentTemplate,
        removeMetadataFromAgentTemplateResponse(agentTemplateSchema.body),
      );

    if (statesMatch) {
      return;
    }


    cachedTemplateBlocks.current = blockTemplates.body.blockTemplates;

    // Optimistically update the query cache before sync
    const optimisticSchema = {
      ...agentTemplateSchema.body,
      ...agentTemplate,
    };

    void queryClient.setQueriesData<
      ServerInferResponses<
        typeof cloudContracts.templates.getTemplateSnapshot,
        200
      >
    >(
      {
        queryKey: cloudQueryKeys.templates.getTemplateSnapshot(
          projectSlug,
          `${templateName}:current`,
        ),
      },
      (oldData) => {
        if (!oldData) {
          return oldData;
        }

        if (oldData.body.type === 'classic') {
          return {
            ...oldData,
            body: {
              ...oldData.body,
              agents: [
                {
                  ...oldData.body.agents[0],
                  ...agentTemplate,
                },
              ],
              blocks: cleanedBlockTemplates,
            },
          };
        }

        return oldData;
      },
    );

    queryClient.setQueryData<
      ServerInferResponses<
        typeof contracts.templates.getAgentTemplateByEntityId,
        200
      >
    >(currentAgentTemplateQueryKey, {
      status: 200,
      body: optimisticSchema,
    });

    // Template schema has changed, trigger sync
    debounceSyncTemplate({
      params: {
        agentTemplateId,
      },
    });
  }, [
    simulatedAgent,
    agentTemplateId,
    agentTemplateSchema?.body,
    blockTemplates,
    debounceSyncTemplate,
    queryClient,
    isSyncing,
    isTemplate,
    currentAgentTemplateQueryKey,
    projectSlug,
    templateName,
  ]);
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
  const { templateId, agentId } = useCurrentAgentMetaData();

  const {
    data: agentSession,
    isError,
    isLoading,
  } = webApi.simulatedAgents.getDefaultSimulatedAgent.useQuery({
    queryKey: webApiQueryKeys.simulatedAgents.getDefaultSimulatedAgent(
      templateId || '',
    ),
    queryData: {
      params: {
        agentTemplateId: templateId || '',
      },
    },
    retry: false,
    enabled: !!templateId,
  });

  const isResyncing = useIsMutating({
    mutationKey: webApiQueryKeys.simulatedAgents.refreshSimulatedSession(agentSession?.body.id || ''),
  })

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
      enabled: !isResyncing && !!agentSession?.body.agentId,
      refetchInterval: 2500,
    },
  );

  return {
    isError,
    isLoading,
    isRefetchingAgent,
    refetchSimulatedAgent: refetch,
    simulatedAgent: agent,
    simulatedSession: agentSession,
    simulatedAgentId: agentSession?.body.id,
    id: agentId,
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
