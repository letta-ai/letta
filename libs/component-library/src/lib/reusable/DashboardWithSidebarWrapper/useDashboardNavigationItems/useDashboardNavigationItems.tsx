'use client';
import type { PropsWithChildren } from 'react';
import { useCallback } from 'react';
import { createContext, useContext, useState } from 'react';

type BaseRoute = string;

export interface SubNavigationItem {
  label: string;
  href: string;
  id: string;
  icon?: React.ReactNode;
  group?: string;
}

interface SubnavigationData {
  items: SubNavigationItem[];
  title: React.ReactNode;
  returnPath: string;
}

interface UseSubNavigationItemsContextData {
  subnavigationData: Record<BaseRoute, SubnavigationData>;
  setSubnavigationData: (baseRoute: BaseRoute, data: SubnavigationData) => void;
}

const UseSubNavigationDataContext =
  createContext<UseSubNavigationItemsContextData>({
    subnavigationData: {},
    setSubnavigationData: () => {
      return false;
    },
  });

export function useDashboardNavigationItems() {
  return useContext(UseSubNavigationDataContext);
}

export function UseDashboardNavigationItemsProvider({
  children,
}: PropsWithChildren<Record<never, string>>) {
  const [subnavigationData, _setSubnavigationData] = useState<
    UseSubNavigationItemsContextData['subnavigationData']
  >({});

  const setSubnavigationData = useCallback(
    (baseRoute: BaseRoute, data: SubnavigationData) => {
      _setSubnavigationData((prev) => ({
        ...prev,
        [baseRoute]: data,
      }));
    },
    []
  );

  return (
    <UseSubNavigationDataContext.Provider
      value={{ subnavigationData, setSubnavigationData }}
    >
      {children}
    </UseSubNavigationDataContext.Provider>
  );
}
