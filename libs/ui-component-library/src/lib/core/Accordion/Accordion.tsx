'use client';

import * as React from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronDownIcon } from '../../icons';
import { cn } from '@letta-cloud/ui-styles';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';

type Themes = 'agentfile' | 'default' | 'destructive';

const accordionTriggerVariants = cva(
  'flex flex-1 px-4 w-full items-center justify-between py-2 font-medium transition-all  [&[data-state=open]>svg]:rotate-180',
  {
    variants: {
      theme: {
        destructive: 'border bg-destructive text-destructive-content',
        agentfile: 'text-sm font-bold p-3 bg-background-grey',
        default: 'text-sm font-semibold',
      },
    },
  },
);

const AccordionRoot = AccordionPrimitive.Root;

interface AccordionItemProps
  extends React.ComponentProps<typeof AccordionPrimitive.Item> {
  theme?: Themes;
}

function AccordionItem({
  className,
  ref,
  theme,
  ...props
}: AccordionItemProps) {
  return (
    <AccordionPrimitive.Item
      ref={ref}
      className={cn('gap-0 w-full', className)}
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
  theme,
  ...props
}: AccordionTriggerProps) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        ref={ref}
        className={cn(accordionTriggerVariants({ theme }), className)}
        {...props}
      >
        {children}
        <ChevronDownIcon className="h-4 w-4 shrink-0 transition-transform duration-200" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

const accordionContentVariants = cva(
  'overflow-hidden text-sm  transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down',
  {
    variants: {
      theme: {
        agentfile: 'p-3 text-sm',
        default: 'pb-4 pt-0',
        destructive: ' text-background-destructive-content',
      },
    },
  },
);

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
type AccordionContentProps = React.ComponentProps<
  typeof AccordionPrimitive.Content
> &
  VariantProps<typeof accordionContentVariants>;

function AccordionContent({
  className,
  children,
  ref,
  theme,
  ...props
}: AccordionContentProps) {
  return (
    <AccordionPrimitive.Content
      ref={ref}
      className={cn(accordionContentVariants({ theme }), className)}
      {...props}
    >
      {children}
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
  theme?: Themes;
}

export function Accordion({
  id,
  trigger,
  defaultOpen,
  children,
  theme,
}: AccordionProps) {
  return (
    <AccordionRoot
      className="w-full"
      defaultValue={defaultOpen ? id : ''}
      type="single"
      collapsible
    >
      <AccordionItem theme={theme} value={id}>
        <AccordionTrigger theme={theme}>{trigger}</AccordionTrigger>
        <AccordionContent theme={theme}>{children}</AccordionContent>
      </AccordionItem>
    </AccordionRoot>
  );
}
