import type { FrameProps } from '../../lib/Frame/Frame';
import { Frame } from '../../lib/Frame/Frame';
import { cn } from '@letta-web/core-style-config';
import * as React from 'react';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';

const stackVariants = cva('flex', {
  variants: {
    gap: {
      text: 'gap',
      small: 'gap-3',
      true: 'gap-4',
    },
  },
  defaultVariants: {
    gap: true,
  },
});

export type StackPrimitiveProps = React.PropsWithChildren<
  FrameProps & VariantProps<typeof stackVariants>
>;

export function StackPrimitive({
  className,
  gap,
  children,
  ...props
}: StackPrimitiveProps) {
  return (
    <Frame className={cn(stackVariants({ gap, className }))} {...props}>
      {children}
    </Frame>
  );
}
