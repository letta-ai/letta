import { useCurrentAgentMetaData } from '../useCurrentAgentMetaData/useCurrentAgentMetaData';
import { useModelsServiceListEmbeddingModels } from '@letta-cloud/letta-agents-api';
import { useMemo } from 'react';
import { webApi, webApiQueryKeys } from '@letta-cloud/web-api-client';

export function useEmbeddingModels() {
  const { isLocal } = useCurrentAgentMetaData();

  const { data: localModelsList } = useModelsServiceListEmbeddingModels(
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
