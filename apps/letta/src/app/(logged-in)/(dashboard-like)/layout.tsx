'use server';
import type { ReactNode } from 'react';
import React from 'react';
import { Frame, HStack, VStack } from '@letta-web/component-library';
import './DashboardLike.scss';
import { DashboardHeader } from './_components/DashboardHeader/DashboardHeader';

interface DashboardLikeLayoutProps {
  children: ReactNode;
}

export default async function DashboardLikeLayout(
  props: DashboardLikeLayoutProps
) {
  const { children } = props;

  return (
    <div className="pageFadeIn w-[100vw] h-[100vh]">
      <VStack overflow="auto" gap={false} fullHeight fullWidth>
        <HStack
          align="center"
          fullWidth
          borderBottom
          color="primary"
          justify="start"
          className="min-h-[64px] h-[64px]"
        >
          <DashboardHeader />
        </HStack>
        <Frame className="max-w-[1440px] mx-[auto]" fullHeight fullWidth>
          {children}
        </Frame>
      </VStack>
    </div>
  );
}
