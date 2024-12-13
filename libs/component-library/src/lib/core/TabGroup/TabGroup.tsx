'use client';
import React from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { cn } from '@letta-web/core-style-config';
import { Slot } from '@radix-ui/react-slot';
import { Typography } from '../../core/Typography/Typography';

interface TabItemType {
  label: string;
  value: string;
  icon?: React.ReactNode;
  postIcon?: React.ReactNode;
}

interface TabGroupProps extends Tabs.TabsProps {
  items: TabItemType[];
  fullWidth?: boolean;
}

export function TabGroup(props: TabGroupProps) {
  const { items, fullWidth, value, defaultValue, onValueChange } = props;

  return (
    <Tabs.Root
      className={cn(fullWidth ? 'w-full' : '')}
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
    >
      <Tabs.List className="flex flex-row">
        {items.map((item) => (
          <Tabs.Trigger
            className={cn(
              'px-4 h-[28px] flex items-center gap-2 flex-row border-b-2 data-[state=active]:font-medium data-[state=active]:border-content',
              fullWidth ? 'flex-1 justify-center' : ''
            )}
            key={item.value}
            value={item.value}
            data-testid={`tab-item:${item.value}`}
          >
            <Slot className="w-4 h-4">{item.icon}</Slot>
            <Typography bold variant="body2">
              {item.label}
            </Typography>
            <Slot className="w-4 h-4">{item.postIcon}</Slot>
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs.Root>
  );
}
