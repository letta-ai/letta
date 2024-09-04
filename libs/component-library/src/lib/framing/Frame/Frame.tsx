import * as React from 'react';
import type { PropsWithChildren } from 'react';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { cn } from '@letta-web/core-style-config';

const frameVariants = cva('', {
  variants: {
    fullWidth: {
      true: 'w-full',
    },
    fullHeight: {
      true: 'h-full',
    },
    color: {
      background: 'bg-background bg-background-content',
      'background-grey': 'bg-background-grey bg-background-grey-content',
      'background-greyer':
        'bg-background-greyer text-background-greyer-content',
      'background-black': 'bg-background-black text-background-black-content',
      tertiary: 'bg-tertiary text-tertiary-content',
    },
    borderColor: {
      true: 'border-border',
    },
    border: {
      true: 'border',
    },
    borderY: {
      true: 'border-t border-b',
    },
    borderX: {
      true: 'border-l border-r',
    },
    borderRight: {
      true: 'border-r',
    },
    borderLeft: {
      true: 'border-l',
    },
    borderTop: {
      true: 'border-t',
    },
    borderBottom: {
      true: 'border-b',
    },
    padding: {
      xxsmall: 'p-2.5',
      xsmall: 'p-3',
      small: 'p-4',
      true: 'p-5',
    },
    paddingY: {
      xxsmall: 'py-2.5',
      xsmall: 'py-3',
      small: 'py-4',
      true: 'py-5',
    },
    paddingX: {
      xxsmall: 'px-2.5',
      xsmall: 'px-3',
      small: 'px-4',
      true: 'px-5',
    },
    paddingTop: {
      xxsmall: 'pt-2.5',
      xsmall: 'pt-3',
      small: 'pt-4',
      true: 'pt-5',
    },
    paddingBottom: {
      xxsmall: 'pb-2.5',
      xsmall: 'pb-3',
      small: 'pb-4',
      true: 'pb-5',
    },
    paddingLeft: {
      xxsmall: 'pl-2.5',
      xsmall: 'pl-3',
      small: 'pl-4',
      true: 'pl-5',
    },
    paddingRight: {
      xxsmall: 'pr-2.5',
      xsmall: 'pr-3',
      small: 'pr-4',
      true: 'pr-5',
    },
    rounded: {
      true: 'rounded',
    },
  },
  defaultVariants: {},
});

export type FrameProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof frameVariants> & {
    as?: React.ElementType;
  };

export function Frame({
  className,
  children,
  as,
  ...props
}: PropsWithChildren<FrameProps>) {
  const {
    fullWidth,
    fullHeight,
    color,
    borderColor,
    border,
    borderY,
    borderX,
    rounded,
    borderRight,
    borderLeft,
    borderTop,
    borderBottom,
    padding,
    paddingY,
    paddingX,
    paddingTop,
    paddingBottom,
    paddingLeft,
    paddingRight,
    ...rest
  } = props;

  const frameVariantsClasses = frameVariants({
    fullWidth,
    fullHeight,
    color,
    borderColor,
    border,
    borderY,
    borderX,
    borderRight,
    rounded,
    borderLeft,
    borderTop,
    borderBottom,
    padding,
    paddingY,
    paddingX,
    paddingTop,
    paddingBottom,
    paddingLeft,
    paddingRight,
    className,
  });

  const Component = as || 'div';

  return (
    <Component className={cn(frameVariantsClasses)} {...rest}>
      {children}
    </Component>
  );
}
