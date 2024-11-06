import type { ReactNode } from 'react';
import React from 'react';
import { DashboardLikeLayout } from '$letta/client/components';

interface DashboardLikeLayoutProps {
  children: ReactNode;
}

export default async function DashboardLikeLayoutLayout(
  props: DashboardLikeLayoutProps
) {
  const { children } = props;

  return <DashboardLikeLayout>{children}</DashboardLikeLayout>;
}
