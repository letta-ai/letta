import { useCallback } from 'react';
import { useCurrentAgentMetaData } from '../useCurrentAgentMetaData/useCurrentAgentMetaData';
import { useCurrentSimulatedAgent } from '../useCurrentSimulatedAgent/useCurrentSimulatedAgent';
import { attachMemoryVariablesToBlockValue } from '@letta-cloud/utils-shared';
import {
  isAgentState,
  useAgentsServiceModifyCoreMemoryBlock,
  type AgentState,
  UseAgentsServiceRetrieveAgentKeyFn,
} from '@letta-cloud/sdk-core';
import { useQueryClient } from '@tanstack/react-query';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';

export function useUpdateSimulatedMemoryBlocksOnVariableInjection() {
  const { isTemplate, templateId } = useCurrentAgentMetaData();
  const { simulatedAgent } = useCurrentSimulatedAgent();
  const queryClient = useQueryClient();


  const { data: blockTemplates } =
    webApi.blockTemplates.getAgentTemplateBlockTemplates.useQuery({
      queryData: {
        params: { agentTemplateId: templateId || '' },
      },
      queryKey: webApiQueryKeys.blockTemplates.getAgentTemplateBlockTemplates(
        templateId || '',
      ),
      enabled: isTemplate,
    });
  const { mutate: modifyCoreMemoryBlock } =
    useAgentsServiceModifyCoreMemoryBlock();

  const updateMemoryBlocksOnVariableInjection = useCallback(
    (variables: Record<string, string>) => {
      if (!isTemplate) {
        return;
      }

      if (!blockTemplates?.body) {
        return;
      }

      if (!isAgentState(simulatedAgent)) {
        return;
      }


      const templateBlocks = blockTemplates.body.blockTemplates;

      const blockTemplateMap = templateBlocks.reduce(
        (acc, block) => {
          acc[block.label] = block;
          return acc;
        },
        {} as Record<string, typeof templateBlocks[number]>,
      );

      const memoryBlocks = simulatedAgent.memory?.blocks || [];

      if (memoryBlocks.length === 0) {
        return;
      }

      if (!simulatedAgent.id) {
        return;
      }

      const agentId = simulatedAgent.id;



      // Update each memory block with variables applied, but only if there's a change
      memoryBlocks.forEach((block) => {
        if (!agentId) {
          return;
        }

        if (!block.label) {
          return;
        }

        const blockTemplate = blockTemplateMap[block.label];

        const originalValue = block.value || '';
        const updatedValue = variables
          ? attachMemoryVariablesToBlockValue(blockTemplate.value, variables)
          : originalValue;

        // Only update if the value actually changed after variable injection
        if (originalValue === updatedValue) {
          return;
        }

        const requestBody = {
          value: updatedValue,
          description: block.description,
          limit: block.limit,
          read_only: block.read_only,
          preserve_on_migration: block.preserve_on_migration,
        };

        modifyCoreMemoryBlock({
          agentId: agentId,
          blockLabel: block.label || '',
          requestBody,
        });

        // Optimistic update
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
                blocks: oldData.memory.blocks.map((existingBlock) => {
                  if (existingBlock.label === block.label) {
                    return {
                      ...existingBlock,
                      ...requestBody,
                    };
                  }
                  return existingBlock;
                }),
              },
            };
          },
        );
      });
    },
    [isTemplate, simulatedAgent, modifyCoreMemoryBlock, queryClient, blockTemplates?.body],
  );

  return updateMemoryBlocksOnVariableInjection;
}
