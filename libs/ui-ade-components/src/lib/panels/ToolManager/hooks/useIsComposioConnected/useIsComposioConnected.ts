import { useADEState } from '../../../../hooks/useADEState/useADEState';
import {
  COMPOSIO_KEY_NAME,
  webApi,
  webApiQueryKeys,
} from '@letta-cloud/sdk-web';
import { useToolsServiceListComposioApps } from '@letta-cloud/sdk-core';
import { useMemo } from 'react';

export function useIsComposioConnected() {
  const { isLocal } = useADEState();

  const { data: keyExistence, isLoading: isLoadingKey } =
    webApi.environmentVariables.getEnvironmentVariableByKey.useQuery({
      queryKey:
        webApiQueryKeys.environmentVariables.getEnvironmentVariableByKey(
          COMPOSIO_KEY_NAME,
        ),
      queryData: {
        params: {
          key: COMPOSIO_KEY_NAME,
        },
      },
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      enabled: !isLocal,
    });

  const { data: isLocalComposioConnected, isLoading: isLoadingLocal } =
    useToolsServiceListComposioApps({}, undefined, {
      enabled: isLocal,
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
    });

  const isConnected = useMemo(() => {
    return isLocal ? isLocalComposioConnected : keyExistence?.status === 200;
  }, [isLocal, isLocalComposioConnected, keyExistence?.status]);

  const isLoading = useMemo(() => {
    return isLoadingKey || isLoadingLocal;
  }, [isLoadingKey, isLoadingLocal]);

  return {
    isConnected,
    isLoading,
  };
}
