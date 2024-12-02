import { atom, useAtom } from 'jotai';
import { useEffect, useState } from 'react';
import { useDebouncedCallback } from '@mantine/hooks';
import type { DevelopmentServerConfig } from '../../[developmentServerId]/hooks/useCurrentDevelopmentServerConfig/useCurrentDevelopmentServerConfig';
import type { HealthCheckResponse } from '@letta-web/letta-agents-api';

interface Status {
  isHealthy: boolean | null;
  isFetching: boolean;
  version?: string;
}

const developmentServerStatusAtom = atom<Record<string, Status>>({});

export function useDevelopmentServerStatus(
  config?: DevelopmentServerConfig | null
) {
  const [developmentServerStatus, setDevelopmentServerStatus] = useAtom(
    developmentServerStatusAtom
  );
  const [isInitialFetch, setIsInitialFetch] = useState(true);

  const checkHealth = useDebouncedCallback(() => {
    if (!config) {
      return;
    }

    const { url: serverUrl, password } = config;

    const currentStatus = developmentServerStatus[serverUrl] || {
      isHealthy: null,
      isFetching: false,
    };

    if (currentStatus.isFetching) {
      return;
    }

    setDevelopmentServerStatus((prev) => ({
      ...prev,
      [serverUrl]: { ...currentStatus, isFetching: true },
    }));

    fetch(`${serverUrl}/v1/health`, {
      method: 'GET',
      headers: {
        ...(password ? { 'X-BARE-PASSWORD': `password ${password}` } : {}),
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Server is not healthy');
        }

        const data = (await response.json()) as HealthCheckResponse;

        setDevelopmentServerStatus((prev) => ({
          ...prev,
          [serverUrl]: {
            version: data.version,
            isHealthy: true,
            isFetching: false,
          },
        }));
      })
      .catch(() => {
        setTimeout(() => {
          setDevelopmentServerStatus((prev) => ({
            ...prev,
            [serverUrl]: { isHealthy: false, isFetching: false },
          }));
        }, 2500);
      })
      .finally(() => {
        setIsInitialFetch(false);
      });
  }, 200);

  useEffect(() => {
    if (!config) {
      return;
    }

    checkHealth();

    const interval = setInterval(() => {
      checkHealth();
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [checkHealth, config]);

  return {
    ...(developmentServerStatus[config?.url || ''] || {
      isHealthy: false,
      isFetching: false,
    }),
    isInitialFetch,
  };
}
