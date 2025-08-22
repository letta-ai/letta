import { useADEState } from '../useADEState/useADEState';
import { useModelsServiceListEmbeddingModels } from '@letta-cloud/sdk-core';
import { useMemo } from 'react';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';

export function useEmbeddingModels() {
  const { isLocal } = useADEState();

  const { data: localModelsList } = useModelsServiceListEmbeddingModels(
    {},
    undefined,
    {
      enabled: isLocal,
    },
  );

  const { data: serverModelsList } = webApi.models.listEmbeddingModels.useQuery(
    {
      queryKey: webApiQueryKeys.models.listEmbeddingModels,
      enabled: !isLocal,
    },
  );

  return useMemo(() => {
    return isLocal ? localModelsList : serverModelsList?.body;
  }, [isLocal, localModelsList, serverModelsList]);
}
