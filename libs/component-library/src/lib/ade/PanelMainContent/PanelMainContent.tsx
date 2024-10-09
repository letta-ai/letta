import * as React from 'react';
import { VStack } from '../../framing/VStack/VStack';

interface PanelElementsListProps {
  children: React.ReactNode;
}

export function PanelMainContent(props: PanelElementsListProps) {
  const { children } = props;

  return (
    <VStack overflow="auto" fullWidth gap="medium" collapseHeight>
      {children}
    </VStack>
  );
}
