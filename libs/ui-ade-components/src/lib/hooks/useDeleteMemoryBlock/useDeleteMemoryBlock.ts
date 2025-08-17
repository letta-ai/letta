import type { contracts } from '@letta-cloud/sdk-web';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import type { ServerInferResponses } from '@ts-rest/core';
import type { MemoryType } from '@letta-cloud/ui-component-library';
import {
  type AgentState,
  useBlocksServiceDeleteBlock,
  UseAgentsServiceRetrieveAgentKeyFn,
} from '@letta-cloud/sdk-core';
import { useCallback, useMemo } from 'react';
import { useADEPermissions } from '../useADEPermissions/useADEPermissions';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentAgent } from '../useCurrentAgent/useCurrentAgent';

interface UseDeleteMemoryBlockOptions {
  memoryType: MemoryType;
  blockId: string;
  agentId?: string;
  templateId?: string;
  onSuccess?: () => void;
}

interface UseDeleteMemoryBlockReturnValue {
  handleDelete: () => void;
  isPending: boolean;
  isError: boolean;
}

interface UseDeleteAgentMemoryBlockOptions {
  blockId: string;
  agentId?: string;
  onSuccess?: () => void;
}

function useDeleteAgentMemoryBlock(options: UseDeleteAgentMemoryBlockOptions) {
  const { blockId, agentId, onSuccess } = options;
  const [canDeleteAgent] = useADEPermissions(ApplicationServices.DELETE_AGENT);

  const { mutate, isPending, isError, reset } = useBlocksServiceDeleteBlock();

  const queryClient = useQueryClient();

  const handleDelete = useCallback(() => {
    if (!canDeleteAgent) {
      return;
    }

    if (!agentId) {
      return;
    }

    if (!blockId) {
      return;
    }

    if (isPending) {
      return;
    }

    mutate(
      { blockId },
      {
        onSuccess: () => {
          // Update agent state cache to remove the deleted block
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
                  blocks: oldData.memory.blocks.filter(
                    (block) => block.id !== blockId,
                  ),
                },
              };
            },
          );

          onSuccess?.();
        },
      },
    );
  }, [
    blockId,
    agentId,
    mutate,
    canDeleteAgent,
    isPending,
    queryClient,
    onSuccess,
  ]);

  return {
    handleDelete,
    isPending,
    isError,
    reset,
  };
}

interface UseDeleteTemplateMemoryBlockOptions {
  blockId: string;
  templateId?: string;
  onSuccess?: () => void;
}

function useDeleteTemplateMemoryBlock(
  options: UseDeleteTemplateMemoryBlockOptions,
) {
  const { blockId, templateId, onSuccess } = options;
  const [canDeleteTemplates] = useADEPermissions(
    ApplicationServices.DELETE_BLOCK_TEMPLATES,
  );

  const { mutate, isPending, isError } =
    webApi.blockTemplates.deleteBlockTemplate.useMutation();

  const queryClient = useQueryClient();
  const simulatedAgent = useCurrentAgent();

  const handleDeleteSimulatedAgentMemoryBlock = useCallback(() => {
    if (!simulatedAgent?.memory?.blocks) {
      return;
    }

    // Find and remove the block from simulated agent memory
    queryClient.setQueriesData<AgentState | undefined>(
      {
        queryKey: UseAgentsServiceRetrieveAgentKeyFn({
          agentId: simulatedAgent.id,
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
            blocks: oldData.memory.blocks.filter(
              (block) => block.id !== blockId,
            ),
          },
        };
      },
    );
  }, [blockId, simulatedAgent, queryClient]);

  const handleDelete = useCallback(() => {
    if (!canDeleteTemplates) {
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
      },
      {
        onSuccess: () => {
          // Invalidate block template queries
          void queryClient.invalidateQueries({
            queryKey: webApiQueryKeys.blockTemplates.getBlockTemplate(blockId),
          });

          void queryClient.invalidateQueries({
            queryKey: webApiQueryKeys.blockTemplates.getBlockTemplates,
          });

          // Update agent template block templates list if templateId exists
          if (templateId) {
            void queryClient.invalidateQueries({
              queryKey:
                webApiQueryKeys.blockTemplates.getAgentTemplateBlockTemplates(
                  templateId,
                ),
            });

            // Optimistically remove from agent template block templates list
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
                    blockTemplates: oldData.body.blockTemplates.filter(
                      (block) => block.id !== blockId,
                    ),
                  },
                };
              },
            );
          }

          // Update simulated agent if exists
          if (simulatedAgent) {
            handleDeleteSimulatedAgentMemoryBlock();
          }

          onSuccess?.();
        },
      },
    );
  }, [
    blockId,
    templateId,
    mutate,
    canDeleteTemplates,
    isPending,
    queryClient,
    onSuccess,
    simulatedAgent,
    handleDeleteSimulatedAgentMemoryBlock,
  ]);

  return {
    handleDelete,
    isPending,
    isError,
  };
}

export function useDeleteMemoryBlock(
  options: UseDeleteMemoryBlockOptions,
): UseDeleteMemoryBlockReturnValue {
  const { memoryType, onSuccess } = options;

  const agentHook = useDeleteAgentMemoryBlock({
    blockId: options.blockId,
    agentId: options.agentId,
    onSuccess,
  });

  const templateHook = useDeleteTemplateMemoryBlock({
    blockId: options.blockId,
    templateId: options.templateId,
    onSuccess,
  });

  // Return the appropriate hook based on memory type
  return useMemo(() => {
    if (memoryType === 'agent') {
      return {
        handleDelete: agentHook.handleDelete,
        isPending: agentHook.isPending,
        isError: agentHook.isError,
      };
    } else if (memoryType === 'templated') {
      return {
        handleDelete: templateHook.handleDelete,
        isPending: templateHook.isPending,
        isError: templateHook.isError,
      };
    }

    throw new Error(`Invalid memory type: ${memoryType}`);
  }, [memoryType, agentHook, templateHook]);
}
