import * as React from 'react';
import type { FrameProps } from '../../framing/Frame/Frame';
import { HStack } from '../../framing/HStack/HStack';

interface BadgeProps {
  content: string;
  color?: FrameProps['color'];
}

export function Badge(props: BadgeProps) {
  return (
    <HStack
      className="text-xs rounded-full px-4 py-1"
      color={props.color || 'background-grey'}
    >
      {props.content}
    </HStack>
  );
}
