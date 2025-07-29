import {
  IdentitiesService,
  useIdentitiesServiceListIdentities,
} from '@letta-cloud/sdk-core';
import { useCallback } from 'react';

interface UseQueryIdentities {
  projectId: string;
  valueType: 'id' | 'identifier_key';
}

export function useQueryIdentities(props: UseQueryIdentities) {
  const { projectId, valueType } = props;
  const { data: defaultIdentities } = useIdentitiesServiceListIdentities({
    projectId,
  });

  const handleLoadIdentities = useCallback(
    async (query: string) => {
      try {
        const response = await IdentitiesService.listIdentities({
          name: query,
        });

        return response.map((identity) => ({
          label: identity.name,
          value:
            valueType === 'identifier_key'
              ? identity.identifier_key
              : identity.id,
        }));
      } catch {
        return [];
      }
    },
    [valueType],
  );

  return {
    handleLoadIdentities,
    defaultIdentities,
  };
}
