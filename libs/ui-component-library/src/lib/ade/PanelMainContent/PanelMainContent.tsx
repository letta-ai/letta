import * as React from 'react';
import { VStack } from '../../framing/VStack/VStack';

interface PanelElementsListProps {
  children: React.ReactNode;
  variant?: 'default' | 'noPadding';
  gap?: 'large' | 'medium' | 'small';
}

export function PanelMainContent(props: PanelElementsListProps) {
  const { children, variant, gap = 'medium' } = props;

  return (
    <VStack
      padding={variant === 'noPadding' ? false : 'small'}
      overflow="hidden"
      zIndex="base"
      fullWidth
      gap={gap}

    >
      {children}
    </VStack>
  );
}
