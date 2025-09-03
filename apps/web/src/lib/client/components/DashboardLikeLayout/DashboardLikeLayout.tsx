import type { ReactNode } from 'react';
import React from 'react';
import {
  Frame,
  HStack,
  VStack,
} from '@letta-cloud/ui-component-library';
import './DashboardLike.scss';
import {
  NavigationSidebar,
} from './DashboardNavigation/DashboardNavigation';
import { DashboardTransition } from './DashboardTransition/DashboardTransition';
import { IntercomSetup } from '$web/client/components/IntercomSetup/IntercomSetup';
import {
  DashboardHeader,
  SIDEBAR_OVERLAY_MOUNT_POINT_ID
} from '$web/client/components/DashboardLikeLayout/DashboardNavigation';

interface DashboardLikeLayoutProps {
  children: ReactNode;
  hideSidebar?: boolean;
}

export async function DashboardLikeLayout(props: DashboardLikeLayoutProps) {
  const { children, hideSidebar } = props;

  return (
    <>
      <IntercomSetup showLauncher={true} />
      <div className="pageFadeIn overflow-x-hidden">
        <div className="dashboard h-full fixed z-[-1]"></div>
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
    </>
  );
}
