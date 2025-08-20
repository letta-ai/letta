import {
  webApi,
  webApiQueryKeys,
  type BlockTemplateType,
} from '@letta-cloud/sdk-web';
import type { MemoryType } from '@letta-cloud/ui-component-library';
import {
  type Block,
  useAgentsServiceRetrieveAgent,
} from '@letta-cloud/sdk-core';
import { useMemo } from 'react';
import { useADEPermissions } from '../useADEPermissions/useADEPermissions';
import { ApplicationServices } from '@letta-cloud/service-rbac';

interface UseListMemoriesOptions {
  memoryType: MemoryType;
  agentId?: string;
  templateId?: string;
}

interface UseListMemoriesReturnValue {
  isNotLoaded: boolean;
  memories: Array<Block | BlockTemplateType>;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  hasNextPage?: boolean;
}

interface UseListAgentMemoriesOptions {
  agentId?: string;
}

function useListAgentMemories(
  options: UseListAgentMemoriesOptions,
): UseListMemoriesReturnValue {
  const { agentId } = options;
  const [canReadAgent] = useADEPermissions(ApplicationServices.READ_AGENT);

  const {
    data: agentData,
    isLoading,
    isError,
    refetch,
  } = useAgentsServiceRetrieveAgent(
    {
      agentId: agentId || '',
    },
    undefined,
    {
      enabled: Boolean(canReadAgent && agentId),
    },
  );

  const memories = useMemo(() => {
    if (!agentData?.memory?.blocks) {
      return [];
    }
    // Transform agent blocks to ensure consistent structure
    return agentData.memory.blocks.map(
      (block): Block => ({
        ...block,
        id: block.id || '',
        label: block.label || '',
        value: block.value || '',
        limit: block.limit || 1,
        description: block.description || '',
        preserve_on_migration: block.preserve_on_migration || false,
        read_only: block.read_only || false,
      }),
    );
  }, [agentData]);

  return {
    isNotLoaded: !agentId || !agentData,
    memories,
    isLoading,
    isError,
    refetch,
  };
}

interface UseListTemplateMemoriesOptions {
  templateId?: string;
}

function useListTemplateMemories(
  options: UseListTemplateMemoriesOptions,
): UseListMemoriesReturnValue {
  const { templateId } = options;
  const [canReadTemplates] = useADEPermissions(
    ApplicationServices.READ_BLOCK_TEMPLATES,
  );

  // Only get blocks associated with the specific template
  const {
    data: agentTemplateBlocksData,
    isLoading,
    isError,
    refetch,
  } = webApi.blockTemplates.getAgentTemplateBlockTemplates.useQuery({
    queryKey: webApiQueryKeys.blockTemplates.getAgentTemplateBlockTemplates(
      templateId || '',
    ),
    queryData: {
      params: {
        agentTemplateId: templateId || '',
      },
    },
    enabled: Boolean(canReadTemplates && templateId),
  });

  const memories = useMemo(() => {
    if (!templateId || !agentTemplateBlocksData) {
      return [];
    }
    return agentTemplateBlocksData.body.blockTemplates;
  }, [templateId, agentTemplateBlocksData]);

  return {
    isNotLoaded: !templateId || !agentTemplateBlocksData,
    memories,
    isLoading,
    isError,
    refetch,
  };
}

export function useListMemories(
  options: UseListMemoriesOptions,
): UseListMemoriesReturnValue {
  const { memoryType } = options;

  const agentHook = useListAgentMemories({
    agentId: options.agentId,
  });

  const templateHook = useListTemplateMemories({
    templateId: options.templateId,
  });

  // Return the appropriate hook based on memory type
  return useMemo(() => {
    if (memoryType === 'agent') {
      return agentHook;
    } else if (memoryType === 'templated') {
      return templateHook;
    }

    throw new Error(`Invalid memory type: ${memoryType}`);
  }, [memoryType, agentHook, templateHook]);
}
