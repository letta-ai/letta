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
import { DashboardTransition } from './DashboardTransition/DashboardTransition';

interface DashboardLikeLayoutProps {
  children: ReactNode;
  hideSidebar?: boolean;
}

export async function DashboardLikeLayout(props: DashboardLikeLayoutProps) {
  const { children, hideSidebar } = props;

  return (
    <UseDashboardNavigationItemsProvider>
      <div className="pageFadeIn overflow-x-hidden">
        <VStack gap="small" fullHeight fullWidth>
          <DashboardHeader />
          <HStack gap={false} fullWidth>
            {!hideSidebar && <NavigationSidebar />}

            <Frame position="relative" overflow="hidden" fullWidth>
              <DashboardTransition alwaysFullscreenBox={hideSidebar}>
                {children}
              </DashboardTransition>
            </Frame>
          </HStack>
          <div id={SIDEBAR_OVERLAY_MOUNT_POINT_ID} />
        </VStack>
      </div>
    </UseDashboardNavigationItemsProvider>
  );
}
