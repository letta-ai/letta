'use server';
import type { ReactNode } from 'react';
import React from 'react';
import { Frame, HStack, VStack } from '@letta-web/component-library';
import './DashboardLike.scss';
import {
  DashboardHeader,
  NavigationSidebar,
} from './_components/DashboardHeader/DashboardHeader';

interface DashboardLikeLayoutProps {
  children: ReactNode;
}

export default async function DashboardLikeLayout(
  props: DashboardLikeLayoutProps
) {
  const { children } = props;

  return (
    <div className="pageFadeIn">
      <VStack gap={false} fullHeight fullWidth>
        <DashboardHeader />
        <HStack fullWidth>
          <NavigationSidebar />
          <VStack className="min-w-sidebar" />
          <Frame fullWidth>{children}</Frame>
        </HStack>
      </VStack>
    </div>
  );
}
