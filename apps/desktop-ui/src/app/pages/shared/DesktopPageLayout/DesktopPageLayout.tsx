import React from 'react';
import { HStack, Typography, VStack } from '@letta-cloud/component-library';
import { Slot } from '@radix-ui/react-slot';

interface DesktopPageLayoutProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function DesktopPageLayout(props: DesktopPageLayoutProps) {
  const { title, icon, subtitle, children, actions } = props;

  return (
    <VStack overflow="hidden" fullHeight gap={false} fullWidth>
      <VStack>
        <HStack
          borderBottom
          align="center"
          paddingY="small"
          paddingX="medium"
          fullWidth
          justify="spaceBetween"
        >
          <HStack gap="medium" align="center" fullWidth>
            <Slot className="w-5 h-5">{icon}</Slot>
            <VStack gap={false}>
              <Typography align="left" bold overrideEl="h1">
                {title}
              </Typography>
              {subtitle && (
                <Typography align="left" variant="body2" color="muted">
                  {subtitle}
                </Typography>
              )}
            </VStack>
          </HStack>
          {actions}
        </HStack>
      </VStack>
      <VStack overflow="hidden" fullHeight fullWidth>
        {children}
      </VStack>
    </VStack>
  );
}
