import * as React from 'react';
import { HStack } from '../../framing/HStack/HStack';
import { VStack } from '../../framing/VStack/VStack';

interface InputFilterProps {
  children?: React.ReactNode;
}

export function InputFilter({ children }: InputFilterProps) {
  return (
    <VStack gap={false}>
      <div className=" w-[1px] ml-[18px] h-[10px] left-0 bottom-[100%] bg-border"></div>
      <HStack
        align="start"
        border
        paddingX="small"
        paddingY="xxsmall"
        color="background-grey"
        justify="start"
        fullWidth
        borderTop
      >
        {children}
      </HStack>
    </VStack>
  );
}
