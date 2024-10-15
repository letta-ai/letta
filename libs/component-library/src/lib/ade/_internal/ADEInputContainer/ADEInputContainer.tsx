import * as React from 'react';
import { VStack } from '../../../framing/VStack/VStack';
import type { PropsWithChildren } from 'react';
import type { InputContainerProps } from '../../../core/Form/Form';

export function ADEInputContainer(
  props: PropsWithChildren<InputContainerProps>
) {
  const { children, fullHeight } = props;

  return (
    <VStack
      padding="small"
      fullHeight={fullHeight}
      fullWidth
      className="bg-background"
    >
      {children}
    </VStack>
  );
}
