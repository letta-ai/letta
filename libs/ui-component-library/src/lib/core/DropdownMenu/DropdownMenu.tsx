'use client';

import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { CheckIcon, ChevronRightIcon, CircleIcon } from '../../icons';
import { cn } from '@letta-cloud/ui-styles';
import { Slot } from '@radix-ui/react-slot';
import Link from 'next/link';
import { Typography } from '../Typography/Typography';
import { HStack } from '../../framing/HStack/HStack';
import { VStack } from '../../framing/VStack/VStack';

const DropdownMenuBase = DropdownMenuPrimitive.Root;

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

const DropdownMenuGroup = DropdownMenuPrimitive.Group;

const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

const DropdownMenuSub = DropdownMenuPrimitive.Sub;

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean;
  }
>(({ className, inset, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      'flex cursor-default select-none items-center  px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent',
      inset && 'pl-8',
      className,
    )}
    {...props}
  >
    {children}
    <ChevronRightIcon className="ml-auto h-4 w-4" />
  </DropdownMenuPrimitive.SubTrigger>
));
DropdownMenuSubTrigger.displayName =
  DropdownMenuPrimitive.SubTrigger.displayName;

const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      'z-dialog min-w-[8rem] overflow-hidden border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
      className,
    )}
    {...props}
  />
));
DropdownMenuSubContent.displayName =
  DropdownMenuPrimitive.SubContent.displayName;

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-dialog min-w-[8rem] flex-col flex overflow-hidden border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        className,
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

interface DropdownMenuItemProps
  extends React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> {
  inset?: boolean;
  label: string;
  doNotCloseOnSelect?: boolean;
  href?: string;
  target?: string;
  endBadge?: React.ReactNode;
  badge?: React.ReactNode;
  preIcon?: React.ReactNode;
}

interface MaybeLinkProps {
  href?: string;
  target?: string;
  children: React.ReactNode;
}

function MaybeLink(props: MaybeLinkProps) {
  const { href, target, children } = props;

  if (href) {
    return (
      <Link href={href} target={target}>
        {children}
      </Link>
    );
  }

  return children;
}

interface DetailedDropdownMenuItemProps {
  label: string;
  doNotCloseOnSelect?: boolean;
  href?: string;
  onClick?: () => void;
  target?: string;
  preIcon?: React.ReactNode;
  description: string;
  ref?: React.Ref<HTMLDivElement>;
}

function DropdownDetailedMenuItem(props: DetailedDropdownMenuItemProps) {
  const {
    label,
    doNotCloseOnSelect,
    href,
    target,
    preIcon,
    description,
    ...rest
  } = props;

  return (
    <DropdownMenuPrimitive.Item
      onSelect={(event) => {
        if (doNotCloseOnSelect) {
          event.preventDefault();
        }
      }}
      className={cn(
        'relative flex gap-2  cursor-pointer select-none items-center px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-content data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      )}
      {...rest}
    >
      <MaybeLink target={target} href={href}>
        <HStack align="center">
          {preIcon && <Slot className="w-3">{preIcon}</Slot>}
          <VStack gap={false} align="start">
            <Typography align="left" variant="body2" bold>
              {label}
            </Typography>
            <Typography align="left" variant="body2" color="lighter">
              {description}
            </Typography>
          </VStack>
        </HStack>
      </MaybeLink>
    </DropdownMenuPrimitive.Item>
  );
}

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  DropdownMenuItemProps
>(
  (
    {
      className,
      inset,
      href,
      label,
      doNotCloseOnSelect,
      badge,
      endBadge,
      preIcon,
      ...props
    },
    ref,
  ) => {
    return (
      <DropdownMenuPrimitive.Item
        ref={ref}
        onSelect={(event) => {
          if (doNotCloseOnSelect) {
            event.preventDefault();
          }
        }}
        className={cn(
          'relative flex gap-2 w-full  cursor-pointer select-none items-center px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-content data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
          inset && 'pl-8',
          className,
        )}
        {...props}
      >
        <MaybeLink href={href}>
          <HStack fullWidth align="center">
            <HStack fullWidth align="center">
              {preIcon && <Slot className="w-3">{preIcon}</Slot>}
              <Typography variant="body2">{label}</Typography>
              {badge}
            </HStack>
            {endBadge}
          </HStack>
        </MaybeLink>
      </DropdownMenuPrimitive.Item>
    );
  },
);
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

interface DropdownMenuCheckboxItemProps
  extends React.ComponentPropsWithoutRef<
    typeof DropdownMenuPrimitive.CheckboxItem
  > {
  inset?: boolean;
  label: string;
  href?: string;
  target?: string;
  badge?: React.ReactNode;
  preIcon?: React.ReactNode;
}

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  DropdownMenuCheckboxItemProps
>(
  (
    {
      className,
      inset,
      checked,
      label,
      href,
      target,
      badge,
      preIcon,
      ...props
    },
    ref,
  ) => (
    <DropdownMenuPrimitive.CheckboxItem
      ref={ref}
      onSelect={(event) => {
        event.preventDefault();

      }}
      className={cn(
        'relative flex gap-1 cursor-pointer select-none items-center py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-content data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        inset && 'pl-12',
        className,
      )}
      checked={checked}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 p-1 border rounded-sm w-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon className="h-4 w-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      <MaybeLink href={href} target={target}>
        <HStack align="center">
          {preIcon && <Slot className="w-3">{preIcon}</Slot>}
          <Typography variant="body2">{label}</Typography>
          {badge}
        </HStack>
      </MaybeLink>
    </DropdownMenuPrimitive.CheckboxItem>
  ),
);
DropdownMenuCheckboxItem.displayName =
  DropdownMenuPrimitive.CheckboxItem.displayName;

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-content data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <CircleIcon className="h-2 w-2 fill-current" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
));
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean;
    text?: string;
    preIcon?: React.ReactNode;
  }
>(({ className, inset, text, preIcon, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn(
      'px-2 py-1.5 inline-flex gap-1 items-center text-sm cursor-pointer',
      inset && 'pl-8',
      className,
    )}
    {...props}
  >
    <Slot className="h-3">{preIcon}</Slot>
    {text}
  </DropdownMenuPrimitive.Label>
));
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-border', className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

function DropdownMenuShortcut({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn('ml-auto text-xs tracking-widest opacity-60', className)}
      {...props}
    />
  );
}
DropdownMenuShortcut.displayName = 'DropdownMenuShortcut';

interface DropdownMenuProps {
  trigger?: React.ReactNode;
  triggerAsChild?: boolean;
  className?: string;
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  sideOffset?: number;
  side?: 'bottom' | 'left' | 'right' | 'top';
  align?: 'center' | 'end' | 'start';
}

export function DropdownMenu(props: DropdownMenuProps) {
  const {
    open,
    side,
    onOpenChange,
    sideOffset,
    trigger,
    children,
    triggerAsChild,
    className,
    align,
  } = props;

  return (
    <DropdownMenuBase open={open} onOpenChange={onOpenChange}>
      {trigger && (
        <DropdownMenuTrigger asChild={triggerAsChild}>
          {trigger}
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent
        side={side}
        align={align}
        sideOffset={sideOffset}
        className={className}
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenuBase>
  );
}

export {
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
  DropdownDetailedMenuItem,
};
