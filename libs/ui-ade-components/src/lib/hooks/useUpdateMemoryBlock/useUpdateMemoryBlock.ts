import type {
  UpdateBlockTemplatePayloadType,
  BlockTemplateType,
  contracts,
} from '@letta-cloud/sdk-web';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import type { MemoryType } from '@letta-cloud/ui-component-library';
import {
  type AgentState,
  useAgentsServiceModifyCoreMemoryBlock,
  UseAgentsServiceRetrieveAgentKeyFn,
} from '@letta-cloud/sdk-core';
import { useCallback, useMemo } from 'react';
import { useADEPermissions } from '../useADEPermissions/useADEPermissions';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentAgent } from '../useCurrentAgent/useCurrentAgent';
import { useCurrentSimulatedAgentVariables } from '../useCurrentSimulatedAgent/useCurrentSimulatedAgent';
import { attachMemoryVariablesToBlockValue } from '@letta-cloud/utils-shared';
import type { ServerInferResponses } from '@ts-rest/core';

type UseUpdateMemoryBlockPayload = Partial<UpdateBlockTemplatePayloadType>;

interface UseUpdateMemoryReturnValue {
  handleUpdate: (values: UseUpdateMemoryBlockPayload) => void;
  isPending: boolean;
  isError: boolean;
}

interface UseUpdateMemoryBlockOptions {
  memoryType: MemoryType;
  label: string;
  agentId?: string;
  blockId?: string;

  templateId?: string;
}

interface UseUpdateAgentMemoryBlockOptions {
  label: string;
  agentId?: string;
}

export function useUpdateAgentMemoryBlock(options: UseUpdateAgentMemoryBlockOptions) {
  const { label, agentId } = options;
  const [canUpdateAgent] = useADEPermissions(ApplicationServices.UPDATE_AGENT);

  const { mutate, isPending, isError } =
    useAgentsServiceModifyCoreMemoryBlock();

  const queryClient = useQueryClient();

  const handleUpdate = useCallback(
    (values: UseUpdateMemoryBlockPayload) => {
      if (!canUpdateAgent) {
        return;
      }

      if (!agentId) {
        return;
      }

      if (isPending) {
        return;
      }

      const requestBody = {
        ...(values.description
          ? {
            description: values.description,
          }
          : {}),
        ...(values.readOnly
          ? {
            read_only: values.readOnly,
          }
          : {}),
        ...(values.preserveOnMigration
          ? {
            preserve_on_migration: values.preserveOnMigration,
          }
          : {}),
        label: values.label,
        ...(values.value
          ? {
            value: values.value,
          }
          : {}),
        ...(values.limit
          ? {
            limit: values.limit,
          }
          : {}),
      }

      mutate({
        agentId: agentId,
        blockLabel: label,
        requestBody: requestBody,
      });

      queryClient.setQueriesData<AgentState | undefined>(
        {
          queryKey: UseAgentsServiceRetrieveAgentKeyFn({
            agentId,
          }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return {
            ...oldData,
            memory: {
              ...oldData.memory,
              blocks: oldData.memory.blocks.map((block) => {
                if (block.label === label) {
                  return {
                    ...block,
                    ...requestBody,
                  };
                }

                return block;
              }),
            },
          };
        },
      );
    },
    [agentId, mutate, canUpdateAgent, isPending, label, queryClient],
  );

  return {
    handleUpdate,
    isPending,
    isError,
  };
}

interface UseUpdateTemplateMemoryBlockOptions {
  label: string;
  templateId?: string;
  agentId?: string;
  blockId?: string;
}

function useUpdateTemplateMemoryBlock(
  options: UseUpdateTemplateMemoryBlockOptions,
) {
  const { blockId, templateId } = options;
  const [canUpdateTemplates] = useADEPermissions(
    ApplicationServices.UPDATE_BLOCK_TEMPLATES,
  );

  const simulatedAgent = useCurrentAgent();
  const agentVariables = useCurrentSimulatedAgentVariables();

  const { handleUpdate: handleUpdateAgentMemoryBlock } =
    useUpdateAgentMemoryBlock(options);

  const handleUpdateSimulatedAgentMemoryBlock = useCallback(
    (payload: UseUpdateMemoryBlockPayload) => {
      if (!simulatedAgent) {
        return;
      }

      handleUpdateAgentMemoryBlock({
        ...payload,
        value: attachMemoryVariablesToBlockValue(
          payload.value || '',
          agentVariables?.memoryVariables || {},
        ),
      });
    },
    [agentVariables, handleUpdateAgentMemoryBlock, simulatedAgent],
  );

  const { mutate, isPending, isError } =
    webApi.blockTemplates.updateBlockTemplate.useMutation();

  const queryClient = useQueryClient();

  const handleUpdate = useCallback(
    (values: UseUpdateMemoryBlockPayload) => {
      if (!canUpdateTemplates) {
        return;
      }

      if (!blockId) {
        return;
      }

      if (isPending) {
        return;
      }

      mutate(
        {
          params: {
            blockTemplateId: blockId,
          },
          body: {
            ...typeof values.value === 'string'
              ? { value: values.value }
              : {},
            ...typeof values.limit === 'number'
              ? { limit: values.limit }
              : {},
            ...typeof values.description === 'string'
              ? { description: values.description }
              : {},
            ...typeof values.preserveOnMigration === 'boolean'
              ? { preserveOnMigration: values.preserveOnMigration }
              : {},
            ...typeof values.readOnly === 'boolean'
              ? { readOnly: values.readOnly }
              : {},
          },
        },
        {
          onSuccess: () => {
            // Invalidate block template queries to refetch updated data
            void queryClient.invalidateQueries({
              queryKey:
                webApiQueryKeys.blockTemplates.getBlockTemplate(blockId),
            });

            // Also invalidate list queries if needed
            void queryClient.invalidateQueries({
              queryKey: webApiQueryKeys.blockTemplates.getBlockTemplates,
            });

            // Invalidate agent template block templates list if templateId exists
            if (templateId) {
              void queryClient.invalidateQueries({
                queryKey:
                  webApiQueryKeys.blockTemplates.getAgentTemplateBlockTemplates(
                    templateId,
                  ),
              });
            }
          },
        },
      );

      handleUpdateSimulatedAgentMemoryBlock(values);

      // Optimistic update for single block template query
      queryClient.setQueriesData<BlockTemplateType | undefined>(
        {
          queryKey: webApiQueryKeys.blockTemplates.getBlockTemplate(blockId),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return {
            ...oldData,
            label: values.label ?? oldData.label,
            value: values.value ?? oldData.value,
            limit: values.limit ?? oldData.limit,
            description: values.description ?? oldData.description,
            preserveOnMigration:
              values.preserveOnMigration ?? oldData.preserveOnMigration,
            readOnly: values.readOnly ?? oldData.readOnly,
          };
        },
      );

      // Optimistic update for agent template block templates list query
      if (templateId) {
        queryClient.setQueriesData<
          ServerInferResponses<
            typeof contracts.blockTemplates.getAgentTemplateBlockTemplates,
            200
          >
        >(
          {
            queryKey:
              webApiQueryKeys.blockTemplates.getAgentTemplateBlockTemplates(
                templateId,
              ),
          },
          (oldData) => {
            if (!oldData) {
              return oldData;
            }

            return {
              ...oldData,
              body: {
                ...oldData.body.blockTemplates,
                blockTemplates: oldData.body.blockTemplates.map((block) => {
                  if (block.id === blockId) {
                    return {
                      ...block,
                      label: values.label ?? block.label,
                      value: values.value ?? block.value,
                      limit: values.limit ?? block.limit,
                      description: values.description ?? block.description,
                      preserveOnMigration:
                        values.preserveOnMigration ?? block.preserveOnMigration,
                      readOnly: values.readOnly ?? block.readOnly,
                    };
                  }

                  return block;
                }),
              },
            };
          },
        );
      }
    },
    [
      canUpdateTemplates,
      blockId,
      isPending,
      mutate,
      handleUpdateSimulatedAgentMemoryBlock,
      queryClient,
      templateId,
    ],
  );

  return {
    handleUpdate,
    isPending,
    isError,
  };
}

export function useUpdateMemoryBlock(
  options: UseUpdateMemoryBlockOptions,
): UseUpdateMemoryReturnValue {
  const { memoryType } = options;

  const agentHook = useUpdateAgentMemoryBlock({
    label: options.label,
    agentId: options.agentId,
  });

  const templateHook = useUpdateTemplateMemoryBlock({
    label: options.label,
    agentId: options.agentId,
    templateId: options.templateId,
    blockId: options.blockId,
  });

  // Return the appropriate hook based on memory type
  return useMemo(() => {
    if (memoryType === 'agent') {
      return agentHook;
    } else if (memoryType === 'templated') {
      return templateHook;
    }

    // Default fallback
    return agentHook;
  }, [memoryType, agentHook, templateHook]);
}
