import { useQueryClient } from '@tanstack/react-query';
import { useCurrentGroup } from '../useCurrentGroup/useCurrentGroup';
import type {
  Group,
  GroupUpdate
} from '@letta-cloud/sdk-core';
import {
  UseGroupsServiceRetrieveGroupKeyFn,
  useGroupsServiceModifyGroup,
} from '@letta-cloud/sdk-core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { omit } from 'lodash';

// Define the manager config properties that can be updated
type ManagerConfigUpdate = {
  manager_agent_id?: string | null;
  termination_token?: string | null;
  max_turns?: number | null;
  sleeptime_agent_frequency?: number | null;
  max_message_buffer_length?: number | null;
  min_message_buffer_length?: number | null;
};

// Configuration for each manager type - defines which properties are supported
const MANAGER_CONFIG_FIELDS = {
  round_robin: ['max_turns'] as const,
  supervisor: ['manager_agent_id'] as const,
  dynamic: ['manager_agent_id', 'termination_token', 'max_turns'] as const,
  sleeptime: ['manager_agent_id', 'sleeptime_agent_frequency'] as const,
  voice_sleeptime: ['manager_agent_id', 'max_message_buffer_length', 'min_message_buffer_length'] as const,
} as const;

// Type guard to check if manager type is supported
function isSupportedManagerType(managerType: string): managerType is keyof typeof MANAGER_CONFIG_FIELDS {
  return managerType in MANAGER_CONFIG_FIELDS;
}

// Helper function to build manager config with only supported properties
function buildManagerConfig(
  managerType: keyof typeof MANAGER_CONFIG_FIELDS,
  updates: ManagerConfigUpdate
): GroupUpdate['manager_config'] {
  if (managerType === 'round_robin') {
    return {
      manager_type: managerType,
      ...(updates.max_turns !== undefined && { max_turns: updates.max_turns })
    };
  }

  if (managerType === 'supervisor') {
    return {
      manager_type: managerType,
      manager_agent_id: updates.manager_agent_id ?? null
    };
  }

  if (managerType === 'dynamic') {
    return {
      manager_type: managerType,
      ...(updates.manager_agent_id !== undefined && { manager_agent_id: updates.manager_agent_id }),
      ...(updates.termination_token !== undefined && { termination_token: updates.termination_token }),
      ...(updates.max_turns !== undefined && { max_turns: updates.max_turns })
    };
  }

  if (managerType === 'sleeptime') {
    return {
      manager_type: managerType,
      ...(updates.manager_agent_id !== undefined && { manager_agent_id: updates.manager_agent_id }),
      ...(updates.sleeptime_agent_frequency !== undefined && { sleeptime_agent_frequency: updates.sleeptime_agent_frequency })
    };
  }

  if (managerType === 'voice_sleeptime') {
    return {
      manager_type: managerType,
      ...(updates.manager_agent_id !== undefined && { manager_agent_id: updates.manager_agent_id }),
      ...(updates.max_message_buffer_length !== undefined && { max_message_buffer_length: updates.max_message_buffer_length }),
      ...(updates.min_message_buffer_length !== undefined && { min_message_buffer_length: updates.min_message_buffer_length })
    };
  }

  return { manager_type: managerType };
}

// Helper function to update local group cache
function updateLocalGroupCache(
  group: Group,
  managerType: keyof typeof MANAGER_CONFIG_FIELDS,
  updates: ManagerConfigUpdate
): Group {
  const managerConfig = buildManagerConfig(managerType, updates);
  const fieldsToUpdate = omit(managerConfig, 'manager_type');

  return {
    ...group,
    ...fieldsToUpdate
  };
}

export function useSyncUpdateCurrentGroup(options?: {
  refreshOnSuccess?: boolean
}) {
  const currentGroup = useCurrentGroup();
  const queryClient = useQueryClient();
  const debouncer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>();
  const [error, setError] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [isDebouncing, setIsDebouncing] = useState<boolean>(false);

  const { mutate: updateGroup } = useGroupsServiceModifyGroup();

  const syncUpdateCurrentGroup = useCallback(
    (updater: (oldData: Group) => ManagerConfigUpdate) => {
      if (!currentGroup) {
        return;
      }

      queryClient.setQueriesData<Group | undefined>(
        {
          queryKey: UseGroupsServiceRetrieveGroupKeyFn({
            groupId: currentGroup.id,
          }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          const managerConfigUpdates = updater(oldData);

          setIsDebouncing(true);

          if (debouncer.current) {
            clearTimeout(debouncer.current);
          }

          debouncer.current = setTimeout(() => {
            setError(false);
            setIsUpdating(true);
            setIsDebouncing(false);

            // Create the manager_config based on the group's manager_type and only include valid properties
            let manager_config: GroupUpdate['manager_config'] = null;

            // Only create manager_config if there are updates to apply
            const hasUpdates = Object.keys(managerConfigUpdates).length > 0;
            if (!hasUpdates) {
              return;
            }

            // Create manager config using helper function
            if (oldData.manager_type === 'swarm') {
              console.warn('Swarm manager type updates are not supported');
              return;
            }

            if (!isSupportedManagerType(oldData.manager_type)) {
              console.warn(`Unknown manager type: ${oldData.manager_type}`);
              return;
            }

            manager_config = buildManagerConfig(oldData.manager_type, managerConfigUpdates);

            const updateGroupData: GroupUpdate = {
              manager_config,
            };

            updateGroup(
              {
                groupId: currentGroup.id,
                requestBody: updateGroupData,
              },
              {
                onSuccess: () => {
                  setIsUpdating(false);
                  setLastUpdatedAt(new Date().toISOString());

                  if (options?.refreshOnSuccess) {
                    void queryClient.invalidateQueries({
                      queryKey: UseGroupsServiceRetrieveGroupKeyFn({
                        groupId: currentGroup.id,
                      }),
                    });
                  }
                },
                onError: () => {
                  setIsUpdating(false);
                  setError(true);
                },
              },
            );
          }, 500);

          // Update the local cache with the manager config changes using helper function
          if (isSupportedManagerType(oldData.manager_type)) {
            return updateLocalGroupCache(oldData, oldData.manager_type, managerConfigUpdates);
          }
          return oldData;
        },
      );
    },
    [currentGroup, queryClient, updateGroup, options?.refreshOnSuccess],
  );

  useEffect(() => {
    return () => {
      if (debouncer.current) {
        clearTimeout(debouncer.current);
      }
    };
  }, []);

  return {
    syncUpdateCurrentGroup,
    isUpdating,
    isDebouncing,
    lastUpdatedAt,
    error,
  };
}
