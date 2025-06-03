'use client';

import * as React from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronDownIcon } from '../../icons';
import { cn } from '@letta-cloud/ui-styles';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';

const accordionTriggerVariants = cva(
  'flex flex-1 px-4 w-full items-center justify-between py-2 font-medium transition-all  [&[data-state=open]>svg]:rotate-180',
  {
    variants: {},
  },
);

const AccordionRoot = AccordionPrimitive.Root;

function AccordionItem({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      ref={ref}
      className={cn(' w-full', className)}
      {...props}
    />
  );
}

AccordionItem.displayName = 'AccordionItem';

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
type AccordionTriggerProps = React.ComponentProps<
  typeof AccordionPrimitive.Trigger
> &
  VariantProps<typeof accordionTriggerVariants>;

function AccordionTrigger({
  className,
  children,
  ref,
  ...props
}: AccordionTriggerProps) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        ref={ref}
        className={cn(accordionTriggerVariants(), className)}
        {...props}
      >
        {children}
        <ChevronDownIcon className="h-4 w-4 shrink-0 transition-transform duration-200" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

function AccordionContent({
  className,
  children,
  ref,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      ref={ref}
      className="overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
      {...props}
    >
      <div className={cn('pb-4 pt-0', className)}>{children}</div>
    </AccordionPrimitive.Content>
  );
}

AccordionContent.displayName = AccordionPrimitive.Content.displayName;

interface AccordionProps {
  id: string;
  trigger: React.ReactNode;
  fullWidth?: boolean;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function Accordion({
  id,
  trigger,
  defaultOpen,
  children,
}: AccordionProps) {
  return (
    <AccordionRoot
      className="w-full"
      defaultValue={defaultOpen ? id : ''}
      type="single"
      collapsible
    >
      <AccordionItem value={id}>
        <AccordionTrigger>{trigger}</AccordionTrigger>
        <AccordionContent>{children}</AccordionContent>
      </AccordionItem>
    </AccordionRoot>
  );
}
