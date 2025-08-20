'use client';

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
      projectSlug?: string;
    }
  | undefined
>(undefined);

interface AppProviderProps {
  user?: UserContextData['user'];
  projectId?: string;
  projectSlug?: string;
  children: React.ReactNode;
}

export function AppContextProvider({
  user,
  projectId,
  children,
  projectSlug,
}: AppProviderProps) {
  return (
    <AppContext.Provider value={{ user, projectId, projectSlug }}>
      {children}
    </AppContext.Provider>
  );
}

export function useADEAppContext() {
  const context = React.useContext(AppContext);

  return {
    user: context?.user || undefined,
    projectId: context?.projectId || '',
    projectSlug: context?.projectSlug || '',
  };
}
