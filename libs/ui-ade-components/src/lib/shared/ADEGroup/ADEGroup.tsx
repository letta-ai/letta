'use client';
import { useState } from 'react';
import { HStack, Typography, VStack } from '@letta-cloud/ui-component-library';

interface ADEItem {
  content: React.ReactNode;
  title: React.ReactNode;
  id: string;
  badge?: React.ReactNode;
}

interface ADEGroupProps {
  items: ADEItem[];
  defaultTab?: number;
}

export function ADEGroup(props: ADEGroupProps) {
  const { items, defaultTab = 0 } = props;
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <VStack
      overflow="hidden"
      gap={false}
      color="background-grey"
      fullWidth
      fullHeight
    >
      <HStack gap={false}>
        {items.map(function (item, index) {
          return (
            <HStack
              data-testid={`tab:${item.id}`}
              fullWidth
              className="cursor-pointer"
              borderLeft={index !== 0}
              borderBottom={activeTab !== index}
              paddingX="small"
              paddingY="xsmall"
              color="background-grey"
              align="center"
              key={item.id}
              onClick={() => {
                setActiveTab(index);
              }}
            >
              <HStack align="center" gap="medium">
                <Typography
                  uppercase
                  bold
                  noWrap
                  overflow="ellipsis"
                  color={activeTab === index ? 'default' : 'muted'}
                  variant="body4"
                >
                  {item.title}
                </Typography>
                {item.badge}
              </HStack>
            </HStack>
          );
        })}
      </HStack>
      <VStack overflow="hidden" fullHeight fullWidth flex>
        {items[activeTab].content}
      </VStack>
    </VStack>
  );
}
