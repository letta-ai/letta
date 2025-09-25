import type {
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
import { useListMemories } from '../useListMemories/useListMemories';
import type { ServerInferResponses } from '@ts-rest/core';
import { useTranslations } from '@letta-cloud/translations';

interface UseUpdateMemoryBlockNamePayload {
  label: string;
}

interface UseUpdateMemoryBlockNameReturnValue {
  handleUpdate: (
    values: UseUpdateMemoryBlockNamePayload,
  ) => Promise<{ success: boolean; error?: string }>;
  isPending: boolean;
  isError: boolean;
}

interface UseUpdateMemoryBlockNameOptions {
  memoryType: MemoryType;
  currentLabel: string;
  agentId?: string;
  blockId?: string;
  templateId?: string;
  onSuccess?: () => void;
}

interface UseUpdateAgentMemoryBlockNameOptions {
  currentLabel: string;
  agentId?: string;
  onSuccess?: () => void;
  memoryType: MemoryType;
  templateId?: string;
}

export function useUpdateAgentMemoryBlockName(
  options: UseUpdateAgentMemoryBlockNameOptions,
) {
  const { currentLabel, agentId, onSuccess, memoryType, templateId } = options;
  const [canUpdateAgent] = useADEPermissions(ApplicationServices.UPDATE_AGENT);
  const t = useTranslations('components/RenameLabelDialog');

  const { mutateAsync, isPending, isError } =
    useAgentsServiceModifyCoreMemoryBlock();

  const queryClient = useQueryClient();

  const { memories } = useListMemories({
    memoryType,
    agentId: memoryType === 'templated' ? undefined : agentId,
    templateId: memoryType === 'templated' ? templateId : undefined,
  });

  const handleUpdate = useCallback(
    async (
      values: UseUpdateMemoryBlockNamePayload,
    ): Promise<{ success: boolean; error?: string }> => {
      if (!canUpdateAgent) {
        return { success: false, error: t('errors.noPermission') };
      }

      if (!agentId) {
        return { success: false, error: t('errors.agentIdRequired') };
      }

      if (isPending) {
        return { success: false, error: t('errors.updateInProgress') };
      }

      // Check if the new label conflicts with existing memory block labels
      const existingLabels =
        memories
          ?.map((block) => block.label)
          .filter((label) => label !== currentLabel) || [];
      if (existingLabels.includes(values.label)) {
        return {
          success: false,
          error: t('errors.labelExists', { label: values.label }),
        };
      }

      const requestBody = {
        label: values.label,
      };

      try {
        await mutateAsync({
          agentId: agentId,
          blockLabel: currentLabel,
          requestBody: requestBody,
        });

        // Update agent query data
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
                  if (block.label === currentLabel) {
                    return {
                      ...block,
                      label: values.label,
                    };
                  }

                  return block;
                }),
              },
            };
          },
        );

        onSuccess?.();
        return { success: true };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : t('errors.updateFailed');
        return { success: false, error: errorMessage };
      }
    },
    [
      agentId,
      mutateAsync,
      canUpdateAgent,
      isPending,
      currentLabel,
      memories,
      onSuccess,
      t,
      queryClient,
    ],
  );

  return {
    handleUpdate,
    isPending,
    isError,
  };
}

interface UseUpdateTemplateMemoryBlockNameOptions {
  currentLabel: string;
  templateId?: string;
  agentId?: string;
  blockId?: string;
  onSuccess?: () => void;
  memoryType: MemoryType;
}

function useUpdateTemplateMemoryBlockName(
  options: UseUpdateTemplateMemoryBlockNameOptions,
) {
  const { blockId, templateId, onSuccess, memoryType, currentLabel } = options;
  const [canUpdateTemplates] = useADEPermissions(
    ApplicationServices.UPDATE_BLOCK_TEMPLATES,
  );
  const t = useTranslations('components/RenameLabelDialog');

  const simulatedAgent = useCurrentAgent();

  const { handleUpdate: handleUpdateAgentMemoryBlockName } =
    useUpdateAgentMemoryBlockName(options);

  const handleUpdateSimulatedAgentMemoryBlockName = useCallback(
    (payload: UseUpdateMemoryBlockNamePayload) => {
      if (!simulatedAgent) {
        return;
      }

      handleUpdateAgentMemoryBlockName(payload);
    },
    [handleUpdateAgentMemoryBlockName, simulatedAgent],
  );

  const { mutateAsync, isPending, isError } =
    webApi.blockTemplates.updateBlockTemplate.useMutation();

  const queryClient = useQueryClient();

  const { memories } = useListMemories({
    memoryType,
    agentId: memoryType === 'templated' ? undefined : options.agentId,
    templateId: memoryType === 'templated' ? templateId : undefined,
  });

  const handleUpdate = useCallback(
    async (
      values: UseUpdateMemoryBlockNamePayload,
    ): Promise<{ success: boolean; error?: string }> => {
      if (!canUpdateTemplates) {
        return { success: false, error: t('errors.noPermissionTemplate') };
      }

      if (!blockId) {
        return { success: false, error: t('errors.blockIdRequired') };
      }

      if (isPending) {
        return { success: false, error: t('errors.updateInProgress') };
      }

      // Check if the new label conflicts with existing memory block labels
      const existingLabels =
        memories
          ?.map((block) => block.label)
          .filter((label) => label !== currentLabel) || [];
      if (existingLabels.includes(values.label)) {
        return {
          success: false,
          error: t('errors.labelExists', { label: values.label }),
        };
      }

      try {
        await mutateAsync({
          params: {
            blockTemplateId: blockId,
          },
          body: {
            label: values.label,
          },
        });

        handleUpdateSimulatedAgentMemoryBlockName(values);

        // Update single block template query
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
              label: values.label,
            };
          },
        );

        // Update agent template block templates list query
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
                  ...oldData.body,
                  blockTemplates: oldData.body.blockTemplates.map((block) => {
                    if (block.id === blockId) {
                      return {
                        ...block,
                        label: values.label,
                      };
                    }

                    return block;
                  }),
                },
              };
            },
          );
        }

        onSuccess?.();
        return { success: true };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : t('errors.updateFailed');
        return { success: false, error: errorMessage };
      }
    },
    [
      canUpdateTemplates,
      blockId,
      isPending,
      mutateAsync,
      handleUpdateSimulatedAgentMemoryBlockName,
      queryClient,
      templateId,
      onSuccess,
      memories,
      currentLabel,
      t,
    ],
  );

  return {
    handleUpdate,
    isPending,
    isError,
  };
}

export function useUpdateMemoryBlockName(
  options: UseUpdateMemoryBlockNameOptions,
): UseUpdateMemoryBlockNameReturnValue {
  const { memoryType } = options;

  const agentHook = useUpdateAgentMemoryBlockName({
    currentLabel: options.currentLabel,
    agentId: options.agentId,
    onSuccess: options.onSuccess,
    memoryType: options.memoryType,
    templateId: options.templateId,
  });

  const templateHook = useUpdateTemplateMemoryBlockName({
    currentLabel: options.currentLabel,
    agentId: options.agentId,
    templateId: options.templateId,
    blockId: options.blockId,
    onSuccess: options.onSuccess,
    memoryType: options.memoryType,
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
