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
    animate: {
      true: 'transition-all duration-300',
    },
    transparent: {
      true: 'opacity-0',
    },
    fullHeight: {
      true: 'h-full',
      withMinHeight: 'min-h-full',
    },
    zIndex: {
      base: 'z-[0]',
      rightAboveZero: 'z-rightAboveZero',
      sidebarNavOverlay: 'z-sidebarNavOverlay',
      sidebarNav: 'z-sidebarNav',
      header: 'z-header',
      dialog: 'z-dialog',
      tooltip: 'z-tooltip',
      draggedItem: 'z-draggedItem',
    },
    collapseHeight: {
      true: 'h-0 flex-1',
    },
    flex: {
      true: 'flex-1',
    },
    color: {
      transparent: 'bg-transparent',
      background: 'bg-background text-background-content',
      'background-grey': 'bg-background-grey text-background-grey-content',
      'background-grey2': 'bg-background-grey2 text-background-grey2-content',
      'background-black': 'bg-background-black text-background-black-content',
      tertiary: 'bg-tertiary text-tertiary-content',
      success: 'bg-background-success text-background-success-content',
      destructive: 'bg-destructive text-destructive-content',
      primary: 'bg-primary text-primary-content',
      secondary: 'bg-secondary text-secondary-content',
      warning: 'bg-background-warning text-background-warning-content',
      'primary-light': 'bg-primary-light text-primary-light-content',
    },
    width: {
      centered: 'max-w-[800px]',
      largeContained: 'max-w-[1024px] w-full',
      contained: 'max-w-[610px] w-full',
      sidebar: 'w-sidebar',
    },
    height: {
      header: 'h-header',
      'header-sm': 'h-header-sm',
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
      xlarge: 'p-5',
      xxlarge: 'p-8',
    },
    paddingY: {
      xxsmall: 'py-1',
      xsmall: 'py-2',
      small: 'py-2.5',
      medium: 'py-3',
      large: 'py-4',
      true: 'py-5',
      xlarge: 'py-6',
      xxlarge: 'py-8',
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
      xxsmall: 'pt-1',
      small: 'pt-2.5',
      medium: 'pt-3',
      large: 'pt-4',
      true: 'pt-5',
      xlarge: 'pt-6',
      xxlarge: 'pt-8',
    },
    paddingBottom: {
      xxsmall: 'pb-1',
      xsmall: 'pb-2',
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
      xlarge: 'pl-6',
    },
    paddingRight: {
      xxsmall: 'pr-1',
      small: 'pr-2.5',
      medium: 'pr-3',
      large: 'pr-4',
      true: 'pr-5',
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
    position: {
      absolute: 'absolute',
      fixed: 'fixed',
      relative: 'relative',
    },
    collapseWidth: {
      true: 'w-0 flex-1',
    },
  },
  defaultVariants: {},
});

export type FrameProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof frameVariants> & {
    as?: React.ElementType;
    type?: string;
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
      transparent,
      borderX,
      borderRight,
      flex,
      borderLeft,
      borderTop,
      zIndex,
      borderBottom,
      padding,
      width,
      paddingY,
      animate,
      paddingX,
      collapseWidth,
      collapseHeight,
      paddingTop,
      position,
      paddingBottom,
      paddingLeft,
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
      zIndex,
      borderX,
      borderRight,
      collapseWidth,
      position,
      animate,
      width,
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
      flex,
      transparent,
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
