'use server';
import type { ReactNode } from 'react';
import React from 'react';
import { Frame, HStack, Logo, VStack } from '@letta-web/component-library';
import Link from 'next/link';
import { DashboardNavigation } from './DashboardNavigation';
import { DASHBOARD_HEADER_HEIGHT } from '$letta/client/common';

const SIDEBAR_WIDTH = 'w-[350px] min-w-[350px]';

function Sidebar() {
  return (
    <VStack
      align="center"
      gap={false}
      fullHeight
      borderRight
      className={SIDEBAR_WIDTH}
    >
      <HStack
        align="center"
        paddingX="small"
        fullWidth
        borderBottom
        className={DASHBOARD_HEADER_HEIGHT}
      >
        <Link href="/">
          <HStack fullWidth align="center">
            <Logo /> Letta
          </HStack>
        </Link>
      </HStack>
      <Frame as="nav" fullWidth fullHeight>
        <DashboardNavigation />
      </Frame>
    </VStack>
  );
}

interface DashboardLikeLayoutProps {
  children: ReactNode;
}

export default async function DashboardLikeLayout(
  props: DashboardLikeLayoutProps
) {
  const { children } = props;

  return (
    <div className="w-[100vw] h-[100vh]">
      <HStack gap={false} fullHeight fullWidth>
        <Sidebar />
        <Frame fullHeight fullWidth>
          {children}
        </Frame>
      </HStack>
    </div>
  );
}
