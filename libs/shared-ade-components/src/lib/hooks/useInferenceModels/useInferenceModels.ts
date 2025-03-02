import { useCurrentAgentMetaData } from '../useCurrentAgentMetaData/useCurrentAgentMetaData';
import { useModelsServiceListModels } from '@letta-cloud/letta-agents-api';
import { useMemo } from 'react';
import { webApi, webApiQueryKeys } from '@letta-cloud/web-api-client';

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
