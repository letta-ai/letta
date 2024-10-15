import * as React from 'react';
import { VStack } from '../../framing/VStack/VStack';

interface PanelElementsListProps {
  children: React.ReactNode;
  variant?: 'default' | 'noPadding';
}

export function PanelMainContent(props: PanelElementsListProps) {
  const { children, variant } = props;

  return (
    <VStack
      padding={variant === 'noPadding' ? false : 'small'}
      overflow="auto"
      fullWidth
      gap="medium"
      collapseHeight
    >
      {children}
    </VStack>
  );
}
