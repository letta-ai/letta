import * as React from 'react';
import { VStack } from '../../framing/VStack/VStack';
import { HStack } from '../../framing/HStack/HStack';
import { Typography } from '../../core/Typography/Typography';

interface DashboardPageLayoutProps {
  icon?: React.ReactNode;
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function DashboardPageLayout(props: DashboardPageLayoutProps) {
  const { icon, title, actions } = props;

  return (
    <VStack gap={false} fullWidth fullHeight>
      <HStack
        align="center"
        as="header"
        wrap
        className="min-h-biHeight-lg"
        justify="spaceBetween"
        fullWidth
        paddingX="large"
        paddingTop="large"
      >
        <HStack align="center">
          {icon}
          <Typography variant="heading1" bold>
            {title}
          </Typography>
        </HStack>
        <HStack align="center">{actions}</HStack>
      </HStack>
      <VStack fullWidth collapseHeight>
        {props.children}
      </VStack>
    </VStack>
  );
}
