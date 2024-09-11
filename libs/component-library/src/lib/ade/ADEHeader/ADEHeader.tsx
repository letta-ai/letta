import * as React from 'react';
import { HStack } from '../../framing/HStack/HStack';

interface ADEHeaderProps {
  children?: React.ReactNode;
}

export function ADEHeader(props: ADEHeaderProps) {
  return (
    <HStack
      justify="spaceBetween"
      align="center"
      padding="small"
      className="h-[48px] min-h-[48px]"
      fullWidth
      color="background-black"
    >
      {props.children}
    </HStack>
  );
}
