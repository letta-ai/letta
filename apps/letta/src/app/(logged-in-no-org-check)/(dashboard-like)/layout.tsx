import { DashboardLikeLayout } from '$letta/client/components';
import React, { type ReactNode } from 'react';

interface DashboardLikeLayoutProps {
  children: ReactNode;
}
export default async function DashboardLikeLayoutLayout(
  props: DashboardLikeLayoutProps
) {
  const { children } = props;

  return <DashboardLikeLayout hideSidebar>{children}</DashboardLikeLayout>;
}
