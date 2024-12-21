import type { ReactNode } from 'react';
import React from 'react';
import { DashboardLikeLayout } from '$web/client/components';

interface DashboardLikeLayoutProps {
  children: ReactNode;
}

export default async function DashboardLikeLayoutLayout(
  props: DashboardLikeLayoutProps
) {
  const { children } = props;

  return <DashboardLikeLayout>{children}</DashboardLikeLayout>;
}
