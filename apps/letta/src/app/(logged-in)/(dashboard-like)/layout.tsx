'use server';
import type { ReactNode } from 'react';
import React from 'react';
import { Frame, HStack } from '@letta-web/component-library';
import './DashboardLike.scss';
import { DashboardSidebar } from './_components/DashboardSidebar.tsx/DashboardSidebar';

interface DashboardLikeLayoutProps {
  children: ReactNode;
}

export default async function DashboardLikeLayout(
  props: DashboardLikeLayoutProps
) {
  const { children } = props;

  return (
    <div className="pageFadeIn w-[100vw] h-[100vh]">
      <HStack gap={false} fullHeight fullWidth>
        <DashboardSidebar />
        <Frame overflow="auto" fullHeight fullWidth>
          {children}
        </Frame>
      </HStack>
    </div>
  );
}
