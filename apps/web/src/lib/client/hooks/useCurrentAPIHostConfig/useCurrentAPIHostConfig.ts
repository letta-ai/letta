import { useCurrentDevelopmentServerConfig } from '../../../../app/(logged-in)/(dashboard-like)/development-servers/[developmentServerId]/hooks/useCurrentDevelopmentServerConfig/useCurrentDevelopmentServerConfig';
import { useCurrentAgentMetaData } from '../../../../app/(logged-in)/(ade)/projects/[projectSlug]/agents/[agentId]/hooks/useCurrentAgentMetaData/useCurrentAgentMetaData';
import { environment } from '@letta-web/environmental-variables';
import { ACCESS_TOKEN_PLACEHOLDER } from '$web/client/components';
import { webApi, webApiQueryKeys } from '$web/client';
import { useMemo } from 'react';

interface APIHostConfig {
  url: string;
  headers: Record<string, string>;
}

interface UseCurrentAPIHostConfigOptions {
  attachApiKey?: boolean;
}

export function useCurrentAPIHostConfig(
  options: UseCurrentAPIHostConfigOptions = {}
): APIHostConfig {
  const { attachApiKey } = options;

  const { data } = webApi.apiKeys.getAPIKey.useQuery({
    queryKey: webApiQueryKeys.apiKeys.getApiKey('first'),
    queryData: {
      params: {
        apiKeyId: 'first',
      },
    },
    enabled: attachApiKey,
  });

  const { isLocal } = useCurrentAgentMetaData();
  const config = useCurrentDevelopmentServerConfig();

  const apiKey = useMemo(() => {
    if (attachApiKey) {
      return data?.body.apiKey || ACCESS_TOKEN_PLACEHOLDER;
    }

    return ACCESS_TOKEN_PLACEHOLDER;
  }, [data?.body.apiKey, attachApiKey]);

  if (isLocal) {
    return {
      url: config?.url || 'http://localhost:8283/',
      headers: {
        ...(config?.password
          ? { 'X-BARE-PASSWORD': `password ${config.password}` }
          : ''),
      },
    };
  }

  return {
    url: environment.NEXT_PUBLIC_CURRENT_HOST,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  };
}
