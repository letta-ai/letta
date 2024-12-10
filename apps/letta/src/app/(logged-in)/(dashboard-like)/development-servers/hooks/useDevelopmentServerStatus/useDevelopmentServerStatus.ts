import { atom, useAtom } from 'jotai';
import { useEffect } from 'react';
import { useDebouncedCallback } from '@mantine/hooks';
import type { DevelopmentServerConfig } from '../../[developmentServerId]/hooks/useCurrentDevelopmentServerConfig/useCurrentDevelopmentServerConfig';
import type { HealthCheckResponse } from '@letta-web/letta-agents-api';

interface Status {
  isHealthy: boolean;
  version?: string;
}

const developmentServerStatusAtom = atom<Record<string, Status>>({});

export function useDevelopmentServerStatus(
  config?: DevelopmentServerConfig | null
) {
  const [developmentServerStatus, setDevelopmentServerStatus] = useAtom(
    developmentServerStatusAtom
  );
  const fetchStatus = useDebouncedCallback(
    async (config: DevelopmentServerConfig) => {
      try {
        const response = await fetch(`${config.url}/v1/health/`, {
          headers: {
            'Content-Type': 'application/json',
            ...(config?.password
              ? {
                  'X-BARE-PASSWORD': `password ${config.password}`,
                }
              : {}),
          },
        });

        if (response.status !== 200) {
          throw new Error('Failed to fetch health check');
        }

        const data: HealthCheckResponse = await response.json();

        console.log(data);
        setDevelopmentServerStatus((old) => ({
          ...old,
          [config.url]: {
            isHealthy: true,
            version: data.version,
          },
        }));
      } catch (_e) {
        return;
      }
    },
    500
  );

  useEffect(() => {
    if (config) {
      fetchStatus(config);
    }
  }, [config, fetchStatus]);

  return {
    ...(developmentServerStatus[config?.url || ''] || {
      isHealthy: false,
      isFetching: false,
    }),
  };
}
