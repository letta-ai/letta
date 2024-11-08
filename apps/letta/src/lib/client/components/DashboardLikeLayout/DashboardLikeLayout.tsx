import type { ReactNode } from 'react';
import React from 'react';
import {
  Frame,
  HStack,
  UseDashboardNavigationItemsProvider,
  VStack,
} from '@letta-web/component-library';
import './DashboardLike.scss';
import {
  DashboardHeader,
  NavigationSidebar,
  SIDEBAR_OVERLAY_MOUNT_POINT_ID,
} from './DashboardNavigation/DashboardNavigation';

interface DashboardLikeLayoutProps {
  children: ReactNode;
  hideSidebar?: boolean;
}

export async function DashboardLikeLayout(props: DashboardLikeLayoutProps) {
  const { children, hideSidebar } = props;

  return (
    <UseDashboardNavigationItemsProvider>
      <div className="pageFadeIn">
        <VStack gap="small" fullHeight fullWidth>
          <DashboardHeader />
          <HStack gap={false} fullWidth>
            {!hideSidebar && <NavigationSidebar />}
            <Frame position="relative" fullWidth>
              {children}
            </Frame>
          </HStack>
          <div id={SIDEBAR_OVERLAY_MOUNT_POINT_ID} />
        </VStack>
      </div>
    </UseDashboardNavigationItemsProvider>
  );
}
