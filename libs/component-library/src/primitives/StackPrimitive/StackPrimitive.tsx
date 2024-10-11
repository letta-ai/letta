import type { FrameProps } from '../../lib/framing/Frame/Frame';
import { Frame } from '../../lib/framing/Frame/Frame';
import { cn } from '@letta-web/core-style-config';
import * as React from 'react';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import type { ElementRef } from 'react';
import { forwardRef } from 'react';
const stackVariants = cva('flex', {
  variants: {
    inline: {
      true: 'inline-flex',
    },
    gap: {
      false: 'gap-0',
      text: 'gap',
      small: 'gap-1',
      true: 'gap-2',
      medium: 'gap-3',
      large: 'gap-4',
      xlarge: 'gap-6',
      form: 'gap-4',
    },
    justify: {
      spaceBetween: 'justify-between',
      center: 'justify-center',
      end: 'justify-end',
      start: 'justify-start',
    },
    align: {
      start: 'items-start',
      center: 'items-center',
      end: 'items-end',
    },
    wrap: {
      true: 'flex-wrap',
    },
  },
  defaultVariants: {
    gap: true,
  },
});

export type StackPrimitiveProps = React.PropsWithChildren<
  FrameProps & VariantProps<typeof stackVariants>
>;

export const StackPrimitive = forwardRef<
  ElementRef<typeof Frame>,
  StackPrimitiveProps
>(function StackPrimitive(
  { className, justify, wrap, gap, children, ...props },
  ref
) {
  return (
    <Frame
      ref={ref}
      className={cn(stackVariants({ ...props, wrap, justify, gap, className }))}
      {...props}
    >
      {children}
    </Frame>
  );
});
