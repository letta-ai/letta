import * as React from 'react';
import { VStack } from '../../framing/VStack/VStack';
import './IndeterminateProgress.scss';
import { HStack } from '../../framing/HStack/HStack';

interface IndeterminateProgressProps {
  content?: string;
  statusMessage?: string;
}

export function IndeterminateProgress(props: IndeterminateProgressProps) {
  const { content, statusMessage } = props;

  return (
    <HStack
      fullWidth
      className="relative h-[16px] border-primary overflow-hidden rounded-full"
      align="center"
      border
      rounded
    >
      <HStack
        className="px-2 text-xs font-medium h-[16px] rounded-full absolute z-[1] bg-primary text-primary-content"
        borderRight
      >
        {content || 'Loading'}
      </HStack>
      <VStack className="h-[20px] rounded relative overflow-hidden" fullWidth>
        <div className="progress1 absolute" />
        <div className="progress1 absolute left-[100%]" />
        <div className="progress2 absolute" />
        <div className="progress2 absolute left-[100%]" />
      </VStack>
      <HStack
        className="px-2 text-xs h-[16px] rounded-full  absolute right-0 z-[1] bg-background text-content font-medium"
        borderRight
      >
        {statusMessage || 'Indeterminate time'}
      </HStack>
    </HStack>
  );
}
