'use client';
import type { Dispatch, SetStateAction } from 'react';
import { useMemo, useState } from 'react';
import React from 'react';

interface GlobalSessionSettingsContextType {
  showAPIKeysInCode: boolean;
  setShowAPIKeysInCode: Dispatch<SetStateAction<boolean>>;
}

const GlobalSessionSettingsContext = React.createContext<
  GlobalSessionSettingsContextType | undefined
>(undefined);

export function useGlobalSessionSettings() {
  const context = React.useContext(GlobalSessionSettingsContext);

  if (!context) {
    throw new Error(
      'useGlobalSessionSettings must be used within a GlobalSessionSettingsProvider'
    );
  }

  return context;
}

interface GlobalSessionSettingsProviderProps {
  children: React.ReactNode;
}

export function GlobalSessionSettingsProvider({
  children,
}: GlobalSessionSettingsProviderProps) {
  const [showAPIKeysInCode, setShowAPIKeysInCode] = useState(false);

  const value = useMemo(
    () => ({
      showAPIKeysInCode,
      setShowAPIKeysInCode,
    }),
    [showAPIKeysInCode]
  );

  return (
    <GlobalSessionSettingsContext.Provider value={value}>
      {children}
    </GlobalSessionSettingsContext.Provider>
  );
}
