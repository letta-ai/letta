'use client';
import React from 'react';
import { HStack, VStack } from '@letta-cloud/ui-component-library';
import { useGlobalSystemWarning } from '$web/client/hooks/useGlobalSystemWarning/useGlobalSystemWarning';
import { NavigationMenu } from '$web/client/components/DashboardLikeLayout/DashboardNavigation/NavigationMenu/NavigationMenu';
import './DashboardNavigation.scss';

export function NavigationSidebar() {
  const systemWarning = useGlobalSystemWarning();

  return (
    <>
      {/* eslint-disable-next-line react/forbid-component-props */}
      <VStack className="min-w-[180px] h-full max-w-[180px] hidden visibleSidebar:block" />
      <VStack
        overflowY="hidden"
        position="fixed"
        justify="spaceBetween"
        color="background-grey"
        fullHeight
        zIndex="rightAboveZero"
        /* eslint-disable-next-line react/forbid-component-props */
        className={`top-0 min-w-[180px] h-[100dvh] max-w-[180px] invisible visibleSidebar:visible ${systemWarning ? 'system-warning-sidebar' : ''}`}
      >
        <VStack fullHeight gap={false}  paddingY="xsmall" >
          {/* eslint-disable-next-line react/forbid-component-props */}
          <HStack className="h-header min-h-header" />
          <VStack
            fullHeight
            overflowY="auto"
            paddingLeft="large"
            paddingRight="small"
            /* eslint-disable-next-line react/forbid-component-props */
            className="main-sidebar border-background-grey3-border"
          >
            <NavigationMenu />
          </VStack>
        </VStack>
      </VStack>
    </>
  );
}
