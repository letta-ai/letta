import { useCurrentDevelopmentServerConfig } from '../useCurrentDevelopmentServerConfig/useCurrentDevelopmentServerConfig';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useMemo } from 'react';

interface APIHostConfig {
  url: string;
  headers: Record<string, string>;
}

interface UseCurrentAPIHostConfigOptions {
  isLocal?: boolean;
  attachApiKey?: boolean;
}

export function useCurrentAPIHostConfig(
  options: UseCurrentAPIHostConfigOptions = {},
): APIHostConfig {
  const { attachApiKey, isLocal } = options;

  const { data } = webApi.apiKeys.getAPIKey.useQuery({
    queryKey: webApiQueryKeys.apiKeys.getApiKey('first'),
    queryData: {
      params: {
        apiKeyId: 'first',
      },
    },
    enabled: attachApiKey,
  });

  const config = useCurrentDevelopmentServerConfig();

  const apiKey = useMemo(() => {
    if (attachApiKey) {
      return data?.body.apiKey || 'YOUR_API_KEY';
    }

    return 'YOUR_API_KEY';
  }, [data?.body.apiKey, attachApiKey]);

  if (isLocal) {
    return {
      url: config?.url || 'http://localhost:8283/',
      headers: {
        ...(config?.password
          ? {
              Authorization: `Bearer ${config.password}`,
              'X-BARE-PASSWORD': `password ${config.password}`,
            }
          : ''),
      },
    };
  }

  return {
    url: 'https://api.letta.com',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  };
}
