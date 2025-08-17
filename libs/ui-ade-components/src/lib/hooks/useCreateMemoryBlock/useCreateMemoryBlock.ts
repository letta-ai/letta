import type {
  CreateBlockTemplatePayloadSchema,
  contracts,
} from '@letta-cloud/sdk-web';
import {
  webApi,
  webApiQueryKeys,
  type BlockTemplateType,
} from '@letta-cloud/sdk-web';
import type { ServerInferResponses } from '@ts-rest/core';
import type { MemoryType } from '@letta-cloud/ui-component-library';
import {
  type AgentState,
  useBlocksServiceCreateBlock,
  UseAgentsServiceRetrieveAgentKeyFn, useAgentsServiceAttachCoreMemoryBlock
} from '@letta-cloud/sdk-core';
import { useCallback, useMemo } from 'react';
import { useADEPermissions } from '../useADEPermissions/useADEPermissions';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentAgent } from '../useCurrentAgent/useCurrentAgent';
import { useCurrentSimulatedAgentVariables } from '../useCurrentSimulatedAgent/useCurrentSimulatedAgent';
import { attachMemoryVariablesToBlockValue } from '@letta-cloud/utils-shared';
import type { z } from 'zod';

// Use the same payload schema for both agent and template blocks
// Agent blocks will omit projectId, template blocks will include it
export type AgentMemoryBlockPayload = Omit<
  z.infer<typeof CreateBlockTemplatePayloadSchema>,
  'projectId'
>;
export type TemplateMemoryBlockPayload = z.infer<
  typeof CreateBlockTemplatePayloadSchema
>;

interface UseCreateMemoryBlockOptions {
  memoryType: MemoryType;
  agentId?: string;
  lettaTemplateId?: string;
  agentTemplateId?: string;
  projectId: string;
  onSuccess?: (createdBlockLabel: string) => void;
  onError?: (error: Error) => void;
}

interface UseCreateAgentMemoryBlockOptions {
  agentId?: string;
  projectId: string;
  onSuccess?: (createdBlockLabel: string) => void;
  onError?: (error: Error) => void;
}

function useCreateAgentMemoryBlock(options: UseCreateAgentMemoryBlockOptions) {
  const { agentId, onSuccess, projectId, onError } = options;
  const [canCreateAgent] = useADEPermissions(ApplicationServices.CREATE_AGENT);

  const { mutate, isPending, isError, error } = useBlocksServiceCreateBlock();
  const { mutate: attachMemory, isPending: isAttaching, isError: errorAttaching } = useAgentsServiceAttachCoreMemoryBlock();


  const queryClient = useQueryClient();

  const handleCreate = useCallback(
    (payload: AgentMemoryBlockPayload) => {
      if (!canCreateAgent) {
        return;
      }

      if (!agentId) {
        return;
      }

      if (isPending) {
        return;
      }

      mutate(
        {
          requestBody: {
            label: payload.label,
            value: payload.value,
            limit: payload.limit,
            project_id: projectId,
            description: payload.description || '',
            preserve_on_migration: payload.preserveOnMigration,
            read_only: payload.readOnly,
          },
        },
        {
          onSuccess: (createdBlock) => {


            attachMemory({
              agentId,
              blockId: createdBlock.id || '',
            }, {
              onSuccess: () => {
                // Update agent state cache to add the new block
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

                    const newBlock = {
                      id: createdBlock.id,
                      label: createdBlock.label,
                      value: createdBlock.value,
                      limit: createdBlock.limit,
                      description: createdBlock.description,
                      preserve_on_migration: createdBlock.preserve_on_migration,
                      read_only: createdBlock.read_only,
                    };

                    return {
                      ...oldData,
                      memory: {
                        ...oldData.memory,
                        blocks: [...oldData.memory.blocks, newBlock],
                      },
                    };
                  },
                );
              }
            })

            onSuccess?.(createdBlock.label || '');
          },
          onError: (error) => {
            onError?.(error as Error);
          },
        },
      );
    },
    [
      projectId,
      agentId,
      mutate,
      canCreateAgent,
      isPending,
      queryClient,
      onSuccess,
      onError,
      attachMemory
    ],
  );

  return {
    handleCreate,
    isPending: isPending || isAttaching,
    isError: isError || errorAttaching,
    error,
  };
}

interface UseCreateTemplateMemoryBlockOptions {
  agentTemplateId?: string;
  lettaTemplateId: string;
  projectId?: string;
  onSuccess?: (createdBlockLabel: string) => void;
  onError?: (error: Error) => void;
}

function useCreateTemplateMemoryBlock(
  options: UseCreateTemplateMemoryBlockOptions,
) {
  const { agentTemplateId, lettaTemplateId, projectId, onSuccess, onError } =
    options;
  const [canCreateTemplates] = useADEPermissions(
    ApplicationServices.CREATE_BLOCK_TEMPLATES,
  );

  const createMutation =
    webApi.blockTemplates.createBlockTemplate.useMutation();
  const attachMutation =
    webApi.blockTemplates.attachBlockToAgentTemplate.useMutation();

  const queryClient = useQueryClient();
  const simulatedAgent = useCurrentAgent();
  const agentVariables = useCurrentSimulatedAgentVariables();

  const handleCreateSimulatedAgentMemoryBlock = useCallback(
    (createdBlock: BlockTemplateType) => {
      if (!simulatedAgent) {
        return;
      }

      // Create the block in simulated agent memory
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

          const newBlock = {
            id: createdBlock.id,
            label: createdBlock.label,
            value: attachMemoryVariablesToBlockValue(
              createdBlock.value,
              agentVariables?.memoryVariables || {},
            ),
            limit: createdBlock.limit,
            description: createdBlock.description,
            preserve_on_migration: createdBlock.preserveOnMigration,
            read_only: createdBlock.readOnly,
          };

          return {
            ...oldData,
            memory: {
              ...oldData.memory,
              blocks: [...oldData.memory.blocks, newBlock],
            },
          };
        },
      );
    },
    [simulatedAgent, agentVariables, queryClient],
  );

  const handleCreate = useCallback(
    (payload: TemplateMemoryBlockPayload) => {
      if (!canCreateTemplates) {
        return;
      }

      if (!projectId) {
        return;
      }

      if (createMutation.isPending || attachMutation.isPending) {
        return;
      }

      // First create the block template
      createMutation.mutate(
        {
          body: {
            label: payload.label,
            value: payload.value,
            lettaTemplateId,
            limit: payload.limit,
            description: payload.description,
            preserveOnMigration: payload.preserveOnMigration,
            readOnly: payload.readOnly,
            projectId,
          },
        },
        {
          onSuccess: (createdBlock) => {
            // Invalidate block template queries
            void queryClient.invalidateQueries({
              queryKey: webApiQueryKeys.blockTemplates.getBlockTemplates,
            });

            // If templateId is provided, attach the block to the agent template
            if (agentTemplateId) {
              attachMutation.mutate(
                {
                  params: {
                    agentTemplateId: agentTemplateId,
                    blockTemplateId: createdBlock.body.id,
                  },
                },
                {
                  onSuccess: () => {
                    // Invalidate agent template block templates list
                    void queryClient.invalidateQueries({
                      queryKey:
                        webApiQueryKeys.blockTemplates.getAgentTemplateBlockTemplates(
                          agentTemplateId,
                        ),
                    });

                    // Optimistically add to agent template block templates list
                    queryClient.setQueriesData<
                      ServerInferResponses<
                        typeof contracts.blockTemplates.getAgentTemplateBlockTemplates,
                        200
                      >
                    >(
                      {
                        queryKey:
                          webApiQueryKeys.blockTemplates.getAgentTemplateBlockTemplates(
                            agentTemplateId,
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
                            blockTemplates: [
                              ...oldData.body.blockTemplates,
                              createdBlock.body,
                            ],
                          },
                        };
                      },
                    );

                    // Update simulated agent if exists
                    if (simulatedAgent) {
                      handleCreateSimulatedAgentMemoryBlock({
                        id: createdBlock.body.id,
                        createdAt: createdBlock.body.createdAt,
                        updatedAt: createdBlock.body.updatedAt,
                        label: createdBlock.body.label,
                        value: attachMemoryVariablesToBlockValue(
                          createdBlock.body.value,
                          agentVariables?.memoryVariables || {},
                        ),
                        limit: createdBlock.body.limit,
                        description: createdBlock.body.description,
                        preserveOnMigration:
                          createdBlock.body.preserveOnMigration,
                        readOnly: createdBlock.body.readOnly,
                      });
                    }

                    onSuccess?.(createdBlock.body.label);
                  },
                  onError: (error) => {
                    onError?.(error as Error);
                  },
                },
              );
            } else {
              // No template to attach to, just return the created block
              onSuccess?.(createdBlock.body.label);
            }
          },
          onError: (error) => {
            onError?.(error as Error);
          },
        },
      );
    },
    [
      canCreateTemplates,
      projectId,
      createMutation,
      attachMutation,
      lettaTemplateId,
      queryClient,
      agentTemplateId,
      simulatedAgent,
      onSuccess,
      handleCreateSimulatedAgentMemoryBlock,
      agentVariables?.memoryVariables,
      onError,
    ],
  );

  const isPending = createMutation.isPending || attachMutation.isPending;
  const isError = createMutation.isError || attachMutation.isError;
  const error = createMutation.error || attachMutation.error;

  return {
    handleCreate,
    isPending,
    isError,
    error: error as Error | null,
  };
}

export function useCreateMemoryBlock(options: UseCreateMemoryBlockOptions) {
  const { memoryType, projectId, onSuccess } = options;

  const agentHook = useCreateAgentMemoryBlock({
    agentId: options.agentId,
    onSuccess,
    projectId,
    onError: options.onError,
  });

  const templateHook = useCreateTemplateMemoryBlock({
    agentTemplateId: options.agentTemplateId,
    projectId,
    lettaTemplateId: options.lettaTemplateId || '',
    onSuccess,
    onError: options.onError,
  });

  // Return the appropriate hook based on memory type
  return useMemo(() => {
    if (memoryType === 'agent') {
      return {
        handleCreate: agentHook.handleCreate,
        isPending: agentHook.isPending,
        isError: agentHook.isError,
        error: agentHook.error,
      };
    } else if (memoryType === 'templated') {
      return {
        handleCreate: templateHook.handleCreate,
        isPending: templateHook.isPending,
        isError: templateHook.isError,
        error: templateHook.error,
      };
    }

    throw new Error(`Invalid memory type: ${memoryType}`);
  }, [memoryType, agentHook, templateHook]);
}
