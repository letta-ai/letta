import type { FrameProps } from '../../lib/framing/Frame/Frame';
import { Frame } from '../../lib/framing/Frame/Frame';
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
    justify: {
      spaceBetween: 'justify-between',
      center: 'justify-center',
    },
    align: {
      center: 'items-center',
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
    <Frame className={cn(stackVariants({ ...props, className }))} {...props}>
      {children}
    </Frame>
  );
}
