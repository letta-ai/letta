import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { HealthService } from '@letta-cloud/letta-agents-api';

const ServerStatusContext = createContext<boolean>(false);

export function useServerStatus() {
  return useContext(ServerStatusContext);
}

interface ServerStatusProviderProps {
  children: React.ReactNode;
}

export function ServerStatusProvider(props: ServerStatusProviderProps) {
  const [status, setStatus] = useState(false);
  const { children } = props;

  const interval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function checkHealth() {
      try {
        const response = await HealthService.healthCheck();

        if (!response.version) {
          throw new Error('Invalid response');
        }

        setStatus(true);
      } catch (e) {
        setStatus(false);
      }
    }
    void checkHealth();

    interval.current = setInterval(() => {
      void checkHealth();
    }, 2500);

    return () => {
      if (interval.current) {
        clearInterval(interval.current);
      }
    };
  }, []);

  return (
    <ServerStatusContext.Provider value={status}>
      {children}
    </ServerStatusContext.Provider>
  );
}
