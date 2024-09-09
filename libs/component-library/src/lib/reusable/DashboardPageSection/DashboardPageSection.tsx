import * as React from 'react';
import type { PropsWithChildren } from 'react';
import { VStack } from '../../framing/VStack/VStack';
import { Typography } from '../../core/Typography/Typography';
import { HStack } from '../../framing/HStack/HStack';

type DashboardPageSectionProps = PropsWithChildren<{
  title?: string;
  actions?: React.ReactNode;
  borderBottom?: boolean;
}>;

export function DashboardPageSection(props: DashboardPageSectionProps) {
  const { children, actions, title, borderBottom } = props;

  return (
    <VStack padding="dashboard" fullWidth borderBottom={borderBottom}>
      {title && (
        <HStack className="h-biHeight-sm" align="center" justify="spaceBetween">
          <Typography variant="heading2">{title}</Typography>
          <HStack>{actions}</HStack>
        </HStack>
      )}
      {children}
    </VStack>
  );
}
