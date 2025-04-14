import { useCurrentAgent } from '../useCurrentAgent/useCurrentAgent';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type AgentState,
  UseAgentsServiceRetrieveAgentKeyFn,
  useAgentsServiceModifyCoreMemoryBlock,
} from '@letta-cloud/sdk-core';
import { useQueryClient } from '@tanstack/react-query';
import { useDebouncedValue } from '@mantine/hooks';

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

  const originalMemory = useRef(value);

  const {
    mutate,
    error,
    isPending: isUpdating,
  } = useAgentsServiceModifyCoreMemoryBlock();

  const updateMessageLock = useRef(false);

  const [localValue, setLocalValue] = useState(value || '');

  const [valueToSave, setValueToSave] = useState(value || '');

  const [debouncedValueToSave] = useDebouncedValue(valueToSave, 500);

  useEffect(() => {
    if (debouncedValueToSave === value) {
      return;
    }

    mutate(
      {
        agentId: id,
        blockLabel: label,
        requestBody: {
          value: debouncedValueToSave,
        },
      },
      {
        onSuccess: () => {
          queryClient.setQueriesData<AgentState | undefined>(
            {
              queryKey: UseAgentsServiceRetrieveAgentKeyFn({
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
                    value: debouncedValueToSave,
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
            },
          );

          updateMessageLock.current = false;
          setLastUpdatedAt(new Date().toISOString());
        },
        onError: () => {
          updateMessageLock.current = false;
        },
      },
    );
  }, [debouncedValueToSave, id, label, mutate, queryClient, value]);

  const handleChange = useCallback((nextValue: string) => {
    setLocalValue(nextValue);
    originalMemory.current = nextValue;

    updateMessageLock.current = true;
    setValueToSave(nextValue);
  }, []);

  useEffect(() => {
    if (updateMessageLock.current) {
      return;
    }

    if (value !== localValue) {
      setLocalValue(value || '');
    }
  }, [localValue, value]);

  return {
    value: localValue,
    onChange: handleChange,
    hasChangedRemotely: originalMemory.current !== localValue,
    error,
    lastUpdatedAt,
    isUpdating,
  };
}
