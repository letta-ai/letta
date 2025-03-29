'use client';
import type { PropsWithChildren } from 'react';
import { useCallback } from 'react';
import { createContext, useContext, useState } from 'react';

type BaseRoute = string;

interface SubNavigationItem {
  label: string;
  href: string;
  id: string;
  icon?: React.ReactNode;
}

interface SubNavigationOverride {
  override: React.ReactNode;
}

interface SubNavigationGroup {
  title: string;
  titleOverride?: React.ReactNode;
  items: SubNavigationItem[];
}

type SubNavigationDataItem =
  | SubNavigationGroup
  | SubNavigationItem
  | SubNavigationOverride;

export function isSubNavigationGroup(
  item: SubNavigationDataItem,
): item is SubNavigationGroup {
  return Object.prototype.hasOwnProperty.call(item, 'title');
}

export function isSubNavigationOverride(
  item: SubNavigationDataItem,
): item is SubNavigationOverride {
  return Object.prototype.hasOwnProperty.call(item, 'override');
}

export interface SubnavigationData {
  items: SubNavigationDataItem[];
  title: React.ReactNode;
  returnPath: string;
  returnText?: string;
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
    [],
  );

  return (
    <UseSubNavigationDataContext.Provider
      value={{ subnavigationData, setSubnavigationData }}
    >
      {children}
    </UseSubNavigationDataContext.Provider>
  );
}
