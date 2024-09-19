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
} from './_components/DashboardNavigation/DashboardNavigation';

interface DashboardLikeLayoutProps {
  children: ReactNode;
}

export default async function DashboardLikeLayout(
  props: DashboardLikeLayoutProps
) {
  const { children } = props;

  return (
    <UseDashboardNavigationItemsProvider>
      <div className="pageFadeIn">
        <VStack gap={false} fullHeight fullWidth>
          <DashboardHeader />
          <HStack fullWidth>
            <NavigationSidebar />
            <Frame fullWidth>{children}</Frame>
          </HStack>
          <div id={SIDEBAR_OVERLAY_MOUNT_POINT_ID} />
        </VStack>
      </div>
    </UseDashboardNavigationItemsProvider>
  );
}
