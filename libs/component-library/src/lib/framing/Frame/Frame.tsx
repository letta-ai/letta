import * as React from 'react';
import type { PropsWithChildren } from 'react';
import { forwardRef } from 'react';
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
    collapseHeight: {
      true: 'h-0 flex-1',
    },
    color: {
      transparent: 'bg-transparent',
      background: 'bg-background text-background-content',
      'background-grey': 'bg-background-grey text-background-grey-content',
      'background-greyer':
        'bg-background-greyer text-background-greyer-content',
      'background-black': 'bg-background-black text-background-black-content',
      tertiary: 'bg-tertiary text-tertiary-content',
      primary: 'bg-primary text-primary-content',
    },
    width: {
      contained: 'max-w-[500px]',
      sidebar: 'w-sidebar',
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
      xxsmall: 'p-1',
      xsmall: 'p-2',
      small: 'p-2.5',
      medium: 'p-3',
      large: 'p-4',
      true: 'p-5',
    },
    paddingY: {
      xxsmall: 'py-1',
      xsmall: 'py-2',
      small: 'py-2.5',
      medium: 'py-3',
      large: 'py-4',
      true: 'py-5',
    },
    paddingX: {
      xxsmall: 'px-1',
      xsmall: 'px-2',
      small: 'px-2.5',
      medium: 'px-3',
      large: 'px-4',
      true: 'px-5',
      xlarge: 'px-6',
    },
    paddingTop: {
      small: 'pt-2.5',
      medium: 'pt-3',
      large: 'pt-4',
      true: 'pt-5',
      xlarge: 'pt-6',
      xxlarge: 'pt-8',
    },
    paddingBottom: {
      small: 'pb-2.5',
      medium: 'pb-3',
      large: 'pb-4',
      true: 'pb-5',
    },
    paddingLeft: {
      small: 'pl-2.5',
      medium: 'pl-3',
      large: 'pl-4',
      true: 'pl-5',
    },
    paddingRight: {
      small: 'pr-2.5',
      medium: 'pr-3',
      large: 'pr-4',
      true: 'pr-5',
    },
    rounded: {
      true: 'rounded',
    },
    overflow: {
      hidden: 'overflow-hidden',
      auto: 'overflow-auto',
    },
    overflowY: {
      hidden: 'overflow-y-hidden',
      auto: 'overflow-y-auto',
    },
    overflowX: {
      hidden: 'overflow-x-hidden',
      auto: 'overflow-x-auto',
    },
    flexHeight: {
      true: 1,
    },
    position: {
      absolute: 'absolute',
      fixed: 'fixed',
      relative: 'relative',
    },
  },
  defaultVariants: {},
});

export type FrameProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof frameVariants> & {
    as?: React.ElementType;
  };

export const Frame = forwardRef<HTMLElement, PropsWithChildren<FrameProps>>(
  function Frame({ className, children, as, ...props }, ref) {
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
      width,
      paddingY,
      paddingX,
      collapseHeight,
      paddingTop,
      position,
      paddingBottom,
      paddingLeft,
      flexHeight,
      paddingRight,
      overflow,
      overflowY,
      overflowX,
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
      flexHeight,
      position,
      width,
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
      overflow,
      collapseHeight,
      overflowY,
      overflowX,

      className,
    });

    const Component = as || 'div';

    return (
      <Component ref={ref} className={cn(frameVariantsClasses)} {...rest}>
        {children}
      </Component>
    );
  }
);
