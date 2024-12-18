'use client';
import * as React from 'react';
import { HStack } from '../../framing/HStack/HStack';
import { VStack } from '../../framing/VStack/VStack';
import { Frame } from '../../framing/Frame/Frame';
import { useEffect, useMemo } from 'react';
import './DashboardWithSidebarWrapper.scss';
import type { SubnavigationData } from './useDashboardNavigationItems/useDashboardNavigationItems';
import { useDashboardNavigationItems } from './useDashboardNavigationItems/useDashboardNavigationItems';

interface DashboardWithSidebarWrapperProps {
  children: React.ReactNode;
  baseUrl: string;
  navigationItems: SubnavigationData['items'];
  returnOverride?: string;
  returnText?: string;
  projectTitle?: React.ReactNode;
}

export function DashboardWithSidebarWrapper(
  props: DashboardWithSidebarWrapperProps
) {
  const {
    navigationItems,
    baseUrl,
    returnText,
    returnOverride,
    projectTitle,
    children,
  } = props;

  const rootPath = useMemo(() => {
    if (returnOverride) {
      return returnOverride;
    }

    return baseUrl;
  }, [baseUrl, returnOverride]);

  const { setSubnavigationData } = useDashboardNavigationItems();

  useEffect(() => {
    setSubnavigationData(baseUrl, {
      items: navigationItems,
      title: projectTitle,
      returnPath: rootPath,
      returnText,
    });
  }, [
    baseUrl,
    navigationItems,
    projectTitle,
    returnText,
    rootPath,
    setSubnavigationData,
  ]);

  return (
    <Frame fullWidth>
      <HStack fullWidth>
        {/*{mounted &&*/}
        {/*  ReactDOM.createPortal(*/}
        {/*    <VStack fullWidth>*/}

        {/*      <Navigation projectTitle={projectTitle} items={navigationItems} />*/}
        {/*    </VStack>,*/}
        {/*    document.getElementById('subnavigation')!*/}
        {/*  )}*/}
        <VStack fullWidth>{children}</VStack>
      </HStack>
    </Frame>
  );
}
