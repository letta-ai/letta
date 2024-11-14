import { useCurrentAgent } from '../useCurrentAgent/useCurrentAgent';
import { useSyncUpdateCurrentAgent } from '../useSyncUpdateCurrentAgent/useSyncUpdateCurrentAgent';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface UseUpdateMemoryPayload {
  type: 'memory' | 'system';
  label?: string;
}

export function useUpdateMemory(payload: UseUpdateMemoryPayload) {
  const { type, label } = payload;
  const { memory, system } = useCurrentAgent();
  const { syncUpdateCurrentAgent, error, lastUpdatedAt, isUpdating } =
    useSyncUpdateCurrentAgent();

  const value = useMemo(() => {
    if (type === 'system') {
      return system;
    }

    return memory?.memory?.[label || '']?.value;
  }, [type, memory?.memory, label, system]);

  const [localValue, setLocalValue] = useState(value || '');

  const handleChange = useCallback(
    (nextValue: string) => {
      setLocalValue(nextValue);

      if (type === 'system') {
        syncUpdateCurrentAgent(() => ({
          system: nextValue,
        }));

        return;
      }

      syncUpdateCurrentAgent((prev) => ({
        memory: {
          ...prev.memory,
          memory: {
            ...prev.memory?.memory,
            [label || '']: {
              ...prev.memory?.memory?.[label || ''],
              value: nextValue,
            },
          },
        },
      }));
    },
    [label, syncUpdateCurrentAgent, type]
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
