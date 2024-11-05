'use client';
import React from 'react';
import { HStack, Typography, VStack } from '@letta-web/component-library';

interface CenteredPageCardProps {
  title: string;
  children: React.ReactNode;
}

export function CenteredPageCard(props: CenteredPageCardProps) {
  const { title, children } = props;

  return (
    <VStack fullHeight fullWidth padding align="center" justify="center">
      <VStack gap={false} border width="contained">
        <HStack borderBottom padding>
          <Typography variant="heading5" bold>
            {title}
          </Typography>
        </HStack>
        {children}
      </VStack>
    </VStack>
  );
}
