'use client';
import React from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { cn } from '@letta-cloud/ui-styles';
import { Slot } from '@radix-ui/react-slot';
import { Typography } from '../Typography/Typography';
import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';

interface TabItemType {
  label: string;
  value: string;
  icon?: React.ReactNode;
  postIcon?: React.ReactNode;
}

const listVariant = cva('px-4 h-[28px] flex items-center gap-2 flex-row', {
  variants: {
    variant: {
      default:
        'border-b-2 border-b border-border pb-2 data-[state=active]:border-content pt-2',
      'bordered-background':
        'data-[state=active]:border data-[state=active]:border-b-0',
      chips: ' font-medium',
    },
    color: {
      default:
        'data-[state=active]:bg-background-grey2 data-[state=active]:border-b',
      dark: 'data-[state=active]:bg-dark-active data-[state=active]:text-dark-active-content',
    },
    size: {
      small: 'h-biHeight',
      xsmall: '',
      xxsmall: 'px-2 h-[24px]',
    },
    fullWidth: {
      true: 'flex-1 justify-center',
    },
  },
  defaultVariants: {
    variant: 'default',
    color: 'default',
  },
});

type TabAggregate = Tabs.TabsProps & VariantProps<typeof listVariant>;

interface TabGroupProps extends TabAggregate {
  items: TabItemType[];
  fullWidth?: boolean;
  upperCase?: boolean;

  extendBorder?: boolean;
  noBottomBorder?: boolean;
  border?: boolean;
  rightContent?: React.ReactNode;
}

export function TabGroup(props: TabGroupProps) {
  const {
    items,
    fullWidth,
    extendBorder,
    upperCase,
    value,
    color,
    variant = 'default',
    border,
    size = 'xsmall',
    defaultValue,
    onValueChange,
    rightContent,
  } = props;

  return (
    <Tabs.Root
      className={cn(fullWidth || extendBorder ? 'w-full' : '')}
      value={value}
      onClick={(e) => {
        e.stopPropagation();
      }}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
    >
      <Tabs.List
        className={cn(
          'flex items-end flex-row',
          border ? 'p-[2px] border' : '',
        )}
      >
        {items.map((item) => (
          <Tabs.Trigger
            className={cn(
              'px-4 h-[28px] flex items-center gap-2 flex-row ',
              listVariant({ variant, color, size, fullWidth }),
            )}
            onClick={(e) => {
              e.stopPropagation();
            }}
            key={item.value}
            value={item.value}
            data-testid={`tab-item:${item.value}`}
          >
            <Slot className="w-4 h-4">{item.icon}</Slot>
            <Typography
              variant={size === 'xsmall' ? 'body3' : 'body2'}
              uppercase={upperCase}
              className="whitespace-nowrap"
            >
              {item.label}
            </Typography>
            <Slot className="w-4 h-4">{item.postIcon}</Slot>
          </Tabs.Trigger>
        ))}
        {extendBorder && <div className="border-b flex-1">{rightContent}</div>}
      </Tabs.List>
    </Tabs.Root>
  );
}
