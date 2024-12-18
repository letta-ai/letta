import * as React from 'react';
import { VStack } from '../../framing/VStack/VStack';
import { HStack } from '../../framing/HStack/HStack';

interface ADEPageProps {
  header: React.ReactNode;
  children?: React.ReactNode;
}

export function ADEPage(props: ADEPageProps) {
  return (
    <VStack
      overflow="hidden"
      color="background"
      className="w-[100vw] p-[8px] h-[100dvh]"
      fullHeight
      fullWidth
      gap
    >
      {props.header}
      <HStack
        collapseHeight
        overflowY="auto"
        fullWidth
        gap={false}
        className="flex-row-reverse"
      >
        {props.children}
      </HStack>
    </VStack>
  );
}
