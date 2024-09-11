import * as React from 'react';
import { VStack } from '../../framing/VStack/VStack';

interface PanelExpandedListProps {
  children: React.ReactNode;
}

export function PanelLastElement(props: PanelExpandedListProps) {
  const { children } = props;

  return (
    <VStack
      overflow="auto"
      padding="small"
      fullWidth
      gap="medium"
      collapseHeight
    >
      {children}
    </VStack>
  );
}
