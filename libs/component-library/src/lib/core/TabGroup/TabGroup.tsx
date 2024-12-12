'use client';
import React from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { cn } from '@letta-web/core-style-config';
import { Frame } from '../../framing/Frame/Frame';
import { Slot } from '@radix-ui/react-slot';
import { Typography } from '../../core/Typography/Typography';

interface TabGroupItemType {
  label: string;
  value: string;
  content: React.ReactNode;
  icon?: React.ReactNode;
}

interface TabGroupProps extends Tabs.TabsProps {
  items: TabGroupItemType[];
  fullWidth?: boolean;
}

export function TabGroup(props: TabGroupProps) {
  const { items, fullWidth, value, defaultValue, onValueChange } = props;

  return (
    <Frame className={cn(fullWidth ? 'w-full' : '')}>
      <Tabs.Root
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
      >
        <Tabs.List className="mb-2">
          {items.map((item) => (
            <Tabs.Trigger
              className={cn(
                'px-4 py-2 hover:font-medium border-b-2 data-[state=active]:font-medium data-[state=active]:border-b-2 data-[state=active]:border-content'
              )}
              value={item.value}
            >
              <Slot className="w-4 h-4">{item.icon}</Slot>
              <Typography variant="body2">{item.label}</Typography>
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {items.map((item) => (
          <Tabs.Content key={item.value} value={item.value}>
            {item.content}
          </Tabs.Content>
        ))}
      </Tabs.Root>
    </Frame>
  );
}
