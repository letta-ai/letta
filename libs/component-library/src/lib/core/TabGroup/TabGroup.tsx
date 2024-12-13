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
      <Tabs.List>
        {items.map((item) => (
          <Tabs.Trigger
            className={cn(
              'px-4 py-2 border-b-2 data-[state=active]:font-medium data-[state=active]:border-content'
            )}
            key={item.value}
            value={item.value}
          >
            <Slot className="w-4 h-4">{item.icon}</Slot>
            <Typography bold uppercase variant="body2">
              {item.label}
            </Typography>
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs.Root>
  );
}
