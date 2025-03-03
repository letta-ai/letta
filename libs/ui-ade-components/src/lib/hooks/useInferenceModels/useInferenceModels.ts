import { useCurrentAgentMetaData } from '../useCurrentAgentMetaData/useCurrentAgentMetaData';
import { useModelsServiceListModels } from '@letta-cloud/sdk-core';
import { useMemo } from 'react';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';

export function useInferenceModels() {
  const { isLocal } = useCurrentAgentMetaData();

  const { data: localModelsList } = useModelsServiceListModels(undefined, {
    enabled: isLocal,
  });

  const { data: serverModelsList } = webApi.models.listInferenceModels.useQuery(
    {
      queryKey: webApiQueryKeys.models.listInferenceModels,
      enabled: !isLocal,
    },
  );

  return useMemo(() => {
    return isLocal ? localModelsList : serverModelsList?.body;
  }, [isLocal, localModelsList, serverModelsList]);
}
