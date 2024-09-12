import * as React from 'react';
import type { PropsWithChildren } from 'react';
import { VStack } from '../../framing/VStack/VStack';
import { HStack } from '../../framing/HStack/HStack';
import { Typography } from '../../core/Typography/Typography';

type DashboardPageSectionProps = PropsWithChildren<{
  actions?: React.ReactNode;
  fullHeight?: boolean;
  borderBottom?: boolean;
  title?: string;
}>;

export function DashboardPageSection(props: DashboardPageSectionProps) {
  const { children, actions, fullHeight, title, borderBottom } = props;

  return (
    <VStack
      paddingX="large"
      paddingY="medium"
      fullHeight={fullHeight}
      fullWidth
      borderBottom={borderBottom}
    >
      {title && (
        <HStack className="h-biHeight-lg" align="center" justify="spaceBetween">
          <Typography bold variant="heading2">
            {title}
          </Typography>
          <HStack>{actions}</HStack>
        </HStack>
      )}
      {children}
    </VStack>
  );
}
