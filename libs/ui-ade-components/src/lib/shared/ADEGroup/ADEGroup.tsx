'use client';
import { useState } from 'react';
import { HStack, Typography, VStack } from '@letta-cloud/ui-component-library';

interface ADEItem {
  content: React.ReactNode;
  title: string;
  id: string;
}

interface ADEGroupProps {
  items: ADEItem[];
}

export function ADEGroup(props: ADEGroupProps) {
  const { items } = props;
  const [activeTab, setActiveTab] = useState(0);

  return (
    <VStack
      overflow="hidden"
      gap={false}
      color="background"
      border
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
              padding="small"
              color={activeTab === index ? 'background' : 'background-grey'}
              key={item.id}
              onClick={() => {
                setActiveTab(index);
              }}
            >
              <Typography uppercase bold variant="body3">
                {item.title}
              </Typography>
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
