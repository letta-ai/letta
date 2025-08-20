'use client';

import * as React from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { CaretDownIcon, ChevronDownIcon } from '../../icons';
import { cn } from '@letta-cloud/ui-styles';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';

type Themes = 'ade' | 'agentfile' | 'default' | 'destructive';

const accordionTriggerVariants = cva(
  'flex flex-1  w-full items-center justify-between  font-medium transition-all  [&[data-state=open]>svg]:rotate-180',
  {
    variants: {
      theme: {
        ade: 'px-3 py-2',
        agentfile: 'text-sm font-bold p-3 bg-background-grey px-4 py-2',
        destructive: 'border bg-destructive text-destructive-content px-4 py-2',
        default: 'text-sm font-semibold px-4',
        minimal: '',
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
  VariantProps<typeof accordionTriggerVariants> & {
    caretType?: 'arrow' | 'chevron';
  };

function AccordionTrigger({
  className,
  children,
  ref,
  theme,
  caretType,
  id,
  ...props
}: AccordionTriggerProps) {
  return (
    <AccordionPrimitive.Header
      className="flex">
      <AccordionPrimitive.Trigger
        ref={ref}
        data-testid={`accordion-trigger-${id}`}

        className={cn(accordionTriggerVariants({ theme }), className)}
        {...props}
      >
        {children}
        {caretType === 'chevron' ? (
          <ChevronDownIcon className="h-4 w-4 shrink-0 transition-transform duration-200" />
        ) : (
          <CaretDownIcon className="h-4 w-4 shrink-0 transition-transform duration-200" />
        )}
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
        ade: '',
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
  caretType?: 'arrow' | 'chevron';
  theme?: Themes;
}

export function Accordion({
  id,
  trigger,
  defaultOpen,
  children,
  caretType,
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
        <AccordionTrigger id={id} caretType={caretType} theme={theme}>
          {trigger}
        </AccordionTrigger>
        <AccordionContent theme={theme}>{children}</AccordionContent>
      </AccordionItem>
    </AccordionRoot>
  );
}
