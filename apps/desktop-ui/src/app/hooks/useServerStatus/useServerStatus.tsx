import { createContext, useContext } from 'react';
import { useHealthServiceHealthCheck } from '@letta-cloud/sdk-core';

const ServerStatusContext = createContext<boolean>(false);

export function useServerStatus() {
  return useContext(ServerStatusContext);
}

interface ServerStatusProviderProps {
  children: React.ReactNode;
}

export function ServerStatusProvider(props: ServerStatusProviderProps) {
  const { children } = props;

  const { data: status } = useHealthServiceHealthCheck();

  return (
    <ServerStatusContext.Provider value={!!status?.status}>
      {children}
    </ServerStatusContext.Provider>
  );
}
