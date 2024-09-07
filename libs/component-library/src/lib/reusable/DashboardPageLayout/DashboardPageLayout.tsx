import * as React from 'react';
import { VStack } from '../../framing/VStack/VStack';

interface DashboardPageLayoutProps {
  header: React.ReactNode;
  children: React.ReactNode;
}

export function DashboardPageLayout(props: DashboardPageLayoutProps) {
  return (
    <VStack gap={false} fullWidth fullHeight>
      {props.header}
      <VStack fullWidth collapseHeight>
        {props.children}
      </VStack>
    </VStack>
  );
}
