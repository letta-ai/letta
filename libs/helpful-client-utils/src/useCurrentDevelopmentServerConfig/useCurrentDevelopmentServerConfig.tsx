'use client';
import { useParams } from 'next/navigation';
import { webApi, webApiQueryKeys } from '@letta-cloud/web-api-client';
import { useTranslations } from '@letta-cloud/translations';

export interface DevelopmentServerConfig {
  id: string;
  name: string;
  url: string;
  password: string;
}

export function useCurrentDevelopmentServerConfig(): DevelopmentServerConfig | null {
  const { developmentServerId } = useParams<{ developmentServerId: string }>();
  const t = useTranslations('development-servers/hooks');

  const isLocal =
    developmentServerId === 'local' || process.env.RUNTIME === 'desktop';

  const { data } = webApi.developmentServers.getDevelopmentServer.useQuery({
    queryKey:
      webApiQueryKeys.developmentServers.getDevelopmentServer(
        developmentServerId,
      ),
    queryData: {
      params: {
        developmentServerId,
      },
    },
    enabled: !isLocal && !!developmentServerId,
  });

  if (isLocal) {
    return {
      id: 'local',
      name: t('localAgents'),
      url: 'http://localhost:8283',
      password: '',
    };
  }

  if (!data) {
    return null;
  }

  return {
    id: data.body.developmentServer.id,
    name: data.body.developmentServer.name,
    url: data.body.developmentServer.url,
    password: data.body.developmentServer.password || '',
  };
}
