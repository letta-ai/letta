import React from 'react';
import type { webApiContracts } from '@letta-cloud/web-api-client';
import type { ServerInferResponseBody } from '@ts-rest/core';

export interface UserContextData {
  user?: ServerInferResponseBody<
    typeof webApiContracts.user.getCurrentUser,
    200
  >;
}

const UserContext = React.createContext<UserContextData | undefined>(undefined);

interface UserProviderProps {
  user?: UserContextData['user'];
  children: React.ReactNode;
}

export function UserProvider({ user, children }: UserProviderProps) {
  return (
    <UserContext.Provider value={{ user }}>{children}</UserContext.Provider>
  );
}

export function useADEUserContext() {
  const context = React.useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context.user;
}
