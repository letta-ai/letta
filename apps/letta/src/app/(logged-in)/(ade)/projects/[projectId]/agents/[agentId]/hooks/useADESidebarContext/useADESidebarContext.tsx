'use client';
import { createContext, useContext } from 'react';

interface AdeSidebarContextData {
  collapsed: boolean;
}

const AdeSidebarContext = createContext<AdeSidebarContextData>({
  collapsed: false,
});

export function useADESidebarContext() {
  return useContext(AdeSidebarContext);
}

interface ADESidebarProviderProps {
  children: React.ReactNode;
  collapsed?: boolean;
}

export function ADESidebarProvider(props: ADESidebarProviderProps) {
  const { children, collapsed = false } = props;

  return (
    <AdeSidebarContext.Provider value={{ collapsed }}>
      {children}
    </AdeSidebarContext.Provider>
  );
}
