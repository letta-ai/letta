'use client';
import React from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { cn } from '@letta-web/core-style-config';
import { Frame } from '../../framing/Frame/Frame';
import { Typography } from '../../core/Typography/Typography';

interface TabGroupItemType {
  label: string;
  value: string;
  content: string;
  icon?: React.ReactNode;
}

interface TabGroupProps extends Tabs.TabsProps {
  items: TabGroupItemType[];
  border?: boolean;
  fullWidth?: boolean;
}

export function TabGroup(props: TabGroupProps) {
  const { items, border, fullWidth, value, defaultValue, onValueChange } =
    props;

  return (
    <Frame
      className={cn(
        border ? 'frame-border-hack' : '',
        fullWidth ? 'w-full' : ''
      )}
    >
      <Tabs.Root
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
      >
        <Tabs.List>
          {items.map((item) => (
            <Tabs.Trigger
              className={cn(
                'px-4 py-2 hover:font-medium border-b-2 border-gray-200 data-[state=active]:font-medium data-[state=active]:text-blue-600 data-[state=active]:border-b-2 data-[state=active]:border-gray-600'
              )}
              value={item.value}
            >
              {item.icon}
              <Typography variant="heading6" color="black">
                {item.label}
              </Typography>
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {items.map((item) => (
          <Tabs.Content value={item.value} className="p-4">
            <Typography variant="body2" align="left">
              {item.content}
            </Typography>
          </Tabs.Content>
        ))}
      </Tabs.Root>
    </Frame>
  );
}
