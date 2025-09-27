'use client';
import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useTranslations } from '@letta-cloud/translations';
import { CURRENT_RUNTIME } from '@letta-cloud/config-runtime';
import { useDesktopConfig } from '../useDesktopConfig/useDesktopConfig';

export interface DevelopmentServerConfig {
  id: string;
  name: string;
  url: string;
  password?: string;
}

export function useCurrentDevelopmentServerConfig(): DevelopmentServerConfig | null {
  const { developmentServerId } = useParams<{ developmentServerId: string }>();
  const t = useTranslations('development-servers/hooks');


  const { desktopConfig } = useDesktopConfig();


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
    enabled: !!developmentServerId ,
  });

  return useMemo((): DevelopmentServerConfig | null => {
    if (CURRENT_RUNTIME === 'letta-desktop') {
      let url = 'http://localhost:8283';
      let password = '';

      if (desktopConfig?.databaseConfig.type === 'local') {
        url = desktopConfig.databaseConfig.url || url;
        password = desktopConfig.databaseConfig.token || password;
      }

      return {
        id: 'local',
        name: t('localAgents'),
        url,
        password,
      }
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
  }, [data, desktopConfig, t]);
}
