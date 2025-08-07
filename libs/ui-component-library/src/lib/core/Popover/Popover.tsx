'use client';

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '@letta-cloud/ui-styles';

const PopoverRoot = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

interface PopoverContentProps
  extends React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> {
  align?: 'center' | 'end' | 'start';
  autoWidth?: boolean;
}

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  PopoverContentProps
>(
  (
    { className, align = 'center', autoWidth, sideOffset = 4, ...props },
    ref,
  ) => (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-dialog border shadow-lg bg-popover text-popover-foreground outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          autoWidth ? 'w-auto' : 'w-72',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  ),
);
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export interface PopoverProps {
  trigger: React.ReactNode;
  triggerAsChild?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  children: React.ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: 'center' | 'end' | 'start';
  side?: 'bottom' | 'left' | 'right' | 'top';
  className?: string;
  offset?: number;

  autoWidth?: boolean;
}

export function Popover(props: PopoverProps) {
  const {
    trigger,
    triggerAsChild,
    open,
    onOpenChange,
    onMouseLeave,
    onMouseEnter,
    defaultOpen,
    offset,
    align,
    children,
    side,
    className,
    autoWidth = false,
  } = props;

  return (
    <PopoverRoot
      open={open}
      onOpenChange={onOpenChange}
      defaultOpen={defaultOpen}
    >
      <PopoverTrigger asChild={triggerAsChild}>{trigger}</PopoverTrigger>
      <PopoverContent
        onMouseLeave={onMouseLeave}
        autoWidth={autoWidth}
        onMouseEnter={onMouseEnter}
        sideOffset={offset}
        align={align}
        side={side}
        className={className}
      >
        {children}
      </PopoverContent>
    </PopoverRoot>
  );
}
