import { atom, useAtom } from 'jotai';
import { useEffect, useState } from 'react';
import { useDebouncedCallback } from '@mantine/hooks';

interface Status {
  isHealthy: boolean | null;
  isFetching: boolean;
}

const developmentServerStatusAtom = atom<Record<string, Status>>({});

export function useDevelopmentServerStatus(serverUrl: string) {
  const [developmentServerStatus, setDevelopmentServerStatus] = useAtom(
    developmentServerStatusAtom
  );
  const [isInitialFetch, setIsInitialFetch] = useState(true);

  const checkHealth = useDebouncedCallback(() => {
    if (!serverUrl) {
      return;
    }

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

    fetch(`${serverUrl}/v1/health`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Server is not healthy');
        }

        setDevelopmentServerStatus((prev) => ({
          ...prev,
          [serverUrl]: { isHealthy: true, isFetching: false },
        }));
      })
      .catch(() => {
        setDevelopmentServerStatus((prev) => ({
          ...prev,
          [serverUrl]: { isHealthy: false, isFetching: false },
        }));
      })
      .finally(() => {
        setIsInitialFetch(false);
      });
  }, 200);

  useEffect(() => {
    checkHealth();

    const interval = setInterval(() => {
      checkHealth();
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [checkHealth, serverUrl]);

  return {
    ...(developmentServerStatus[serverUrl] || {
      isHealthy: false,
      isFetching: false,
    }),
    isInitialFetch,
  };
}
