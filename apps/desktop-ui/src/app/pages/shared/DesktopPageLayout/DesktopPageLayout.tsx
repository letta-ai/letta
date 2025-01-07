import React from 'react';
import { HStack, Typography, VStack } from '@letta-cloud/component-library';

interface DesktopPageLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function DesktopPageLayout(props: DesktopPageLayoutProps) {
  const { title, subtitle, children, actions } = props;

  return (
    <VStack padding="xxlarge" fullHeight fullWidth>
      <VStack fullWidth>
        <HStack justify="spaceBetween">
          <VStack fullWidth>
            <Typography variant="heading2" overrideEl="h1">
              {title}
            </Typography>
            {subtitle && <Typography variant="heading6">{subtitle}</Typography>}
          </VStack>
          {actions}
        </HStack>
      </VStack>
      <VStack fullHeight fullWidth>
        {children}
      </VStack>
    </VStack>
  );
}
