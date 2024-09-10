'use client';

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '@letta-web/core-style-config';

const PopoverRoot = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'center', sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'z-50 w-72 rounded-md border bg-popover text-popover-foreground outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export interface PopoverProps {
  trigger: React.ReactNode;
  triggerAsChild?: boolean;
  children: React.ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: 'center' | 'end' | 'start';
  offset?: number;
}

export function Popover(props: PopoverProps) {
  const {
    trigger,
    triggerAsChild,
    open,
    onOpenChange,
    defaultOpen,
    offset,
    align,
    children,
  } = props;

  return (
    <PopoverRoot
      open={open}
      onOpenChange={onOpenChange}
      defaultOpen={defaultOpen}
    >
      <PopoverTrigger asChild={triggerAsChild}>{trigger}</PopoverTrigger>
      <PopoverContent sideOffset={offset} align={align}>
        {children}
      </PopoverContent>
    </PopoverRoot>
  );
}
