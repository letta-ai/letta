import { useCurrentAgent } from '../useCurrentAgent/useCurrentAgent';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type AgentState,
  UseAgentsServiceGetAgentKeyFn,
  useAgentsServiceUpdateAgentMemoryBlockByLabel,
} from '@letta-web/letta-agents-api';
import { useQueryClient } from '@tanstack/react-query';

interface UseUpdateMemoryPayload {
  label: string;
}

export function useUpdateMemory(payload: UseUpdateMemoryPayload) {
  const { label } = payload;
  const { memory, id } = useCurrentAgent();
  const queryClient = useQueryClient();

  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>();

  const value = useMemo(() => {
    if (!memory) {
      return '';
    }

    return memory.blocks.find((block) => block.label === label)?.value;
  }, [memory, label]);

  const {
    mutate,
    error,
    isPending: isUpdating,
  } = useAgentsServiceUpdateAgentMemoryBlockByLabel();

  const [localValue, setLocalValue] = useState(value || '');

  const handleChange = useCallback(
    (nextValue: string) => {
      setLocalValue(nextValue);

      queryClient.setQueriesData<AgentState | undefined>(
        {
          queryKey: UseAgentsServiceGetAgentKeyFn({
            agentId: id,
          }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          const newMemory = oldData.memory.blocks.map((block) => {
            if (block.label === label) {
              return {
                ...block,
                value: nextValue,
              };
            }

            return block;
          });

          return {
            ...oldData,
            memory: {
              ...oldData.memory,
              blocks: newMemory,
            },
          };
        }
      );

      mutate(
        {
          agentId: id,
          blockLabel: label,
          requestBody: {
            value: nextValue,
          },
        },
        {
          onSuccess: () => {
            setLastUpdatedAt(new Date().toISOString());
          },
        }
      );
    },
    [id, label, mutate, queryClient]
  );

  useEffect(() => {
    if (value !== localValue) {
      setLocalValue(value || '');
    }
  }, [localValue, value]);

  return {
    value: localValue,
    onChange: handleChange,
    error,
    lastUpdatedAt,
    isUpdating,
  };
}
