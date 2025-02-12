'use client';
import React from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { cn } from '@letta-cloud/core-style-config';
import { Slot } from '@radix-ui/react-slot';
import { Typography } from '../Typography/Typography';

interface TabItemType {
  label: string;
  value: string;
  icon?: React.ReactNode;
  postIcon?: React.ReactNode;
}

interface TabGroupProps extends Tabs.TabsProps {
  items: TabItemType[];
  fullWidth?: boolean;
  upperCase?: boolean;
  extendBorder?: boolean;
  noBottomBorder?: boolean;
  variant?: 'border' | 'bordered-background' | 'more-spacing';
}

export function TabGroup(props: TabGroupProps) {
  const {
    items,
    fullWidth,
    extendBorder,
    upperCase,
    value,
    variant = 'border',
    defaultValue,
    onValueChange,
  } = props;

  return (
    <Tabs.Root
      className={cn(fullWidth || extendBorder ? 'w-full' : '')}
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
    >
      <Tabs.List className="flex flex-row">
        {items.map((item) => (
          <Tabs.Trigger
            className={cn(
              'px-4 h-[28px] flex items-center gap-2 flex-row ',
              variant === 'border'
                ? 'border-b-2 data-[state=active]:border-content'
                : '',
              variant === 'bordered-background'
                ? 'data-[state=active]:bg-background-grey2 data-[state=active]:border data-[state=active]:border-b-0 data-[state=active]:text-background-grey2-content'
                : '',
              variant === 'more-spacing'
                ? 'border-b-2 pb-2 data-[state=active]:border-content'
                : '',
              fullWidth ? 'flex-1 justify-center' : '',
            )}
            key={item.value}
            value={item.value}
            data-testid={`tab-item:${item.value}`}
          >
            <Slot className="w-4 h-4">{item.icon}</Slot>
            <Typography
              bold={variant !== 'more-spacing'}
              variant="body2"
              uppercase={upperCase}
              className="whitespace-nowrap"
            >
              {item.label}
            </Typography>
            <Slot className="w-4 h-4">{item.postIcon}</Slot>
          </Tabs.Trigger>
        ))}
        {extendBorder && <div className="border-b flex-1" />}
      </Tabs.List>
    </Tabs.Root>
  );
}
