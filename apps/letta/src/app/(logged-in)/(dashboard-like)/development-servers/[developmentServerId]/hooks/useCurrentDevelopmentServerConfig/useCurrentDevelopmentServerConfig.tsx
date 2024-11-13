'use client';
import { useParams } from 'next/navigation';
import { webApi, webApiQueryKeys } from '$letta/client';
import { useTranslations } from 'next-intl';
import { LOCAL_PROJECT_SERVER_URL } from '$letta/constants';

export function useCurrentDevelopmentServerConfig() {
  const { developmentServerId } = useParams<{ developmentServerId: string }>();
  const t = useTranslations('development-servers/hooks');

  const isLocal = developmentServerId === 'local';

  const { data } = webApi.developmentServers.getDevelopmentServer.useQuery({
    queryKey:
      webApiQueryKeys.developmentServers.getDevelopmentServer(
        developmentServerId
      ),
    queryData: {
      params: {
        developmentServerId,
      },
    },
    enabled: !isLocal,
  });

  if (isLocal) {
    return {
      id: 'local',
      name: t('localAgents'),
      url: LOCAL_PROJECT_SERVER_URL,
      password: '',
    };
  }

  if (!data) {
    return null;
  }

  return data.body.developmentServer;
}
