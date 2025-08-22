import { useADEState } from '../useADEState/useADEState';
import { useModelsServiceListModels } from '@letta-cloud/sdk-core';
import { useMemo } from 'react';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';

export function useInferenceModels() {
  const { isLocal } = useADEState();

  const { data: localModelsList } = useModelsServiceListModels({}, undefined, {
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
