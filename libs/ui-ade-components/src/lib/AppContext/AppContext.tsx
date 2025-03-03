import React from 'react';
import type { webApiContracts } from '@letta-cloud/sdk-web';
import type { ServerInferResponseBody } from '@ts-rest/core';

export interface UserContextData {
  user?: ServerInferResponseBody<
    typeof webApiContracts.user.getCurrentUser,
    200
  >;
}

const AppContext = React.createContext<
  | {
      user?: UserContextData['user'];
      projectId?: string;
    }
  | undefined
>(undefined);

interface AppProviderProps {
  user?: UserContextData['user'];
  projectId?: string;
  children: React.ReactNode;
}

export function AppContextProvider({
  user,
  projectId,
  children,
}: AppProviderProps) {
  return (
    <AppContext.Provider value={{ user, projectId }}>
      {children}
    </AppContext.Provider>
  );
}

export function useADEAppContext() {
  const context = React.useContext(AppContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return {
    user: context.user,
    projectId: context.projectId || '',
  };
}
