'use server';
import type { ReactNode } from 'react';
import React from 'react';
import { Frame, VStack } from '@letta-web/component-library';
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
      <VStack
        overflowY="auto"
        overflowX="auto"
        gap={false}
        fullHeight
        fullWidth
      >
        <DashboardHeader />
        <Frame className="max-w-[1440px] mx-[auto]" fullWidth>
          {children}
        </Frame>
      </VStack>
    </div>
  );
}
