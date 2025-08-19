import React from 'react';
import { VStack, HStack, Skeleton } from '@letta-cloud/ui-component-library';

export function SkeletonFileView() {
  return (
    <VStack
      className="fileview bg-background/80 backdrop-blur-sm"
      position="relative"
      border="transparent"
      padding="small"
      style={{ margin: 0 }}
    >
      <HStack align="center" justify="spaceBetween">
        <Skeleton className="h-[16px] w-full bg-background-grey2/60 max-w-[65%] animate-pulse" />
        <Skeleton className="h-[20px] w-[60px] bg-background-grey2/60 rounded-sm animate-pulse" />
      </HStack>
      <HStack align="center" justify="spaceBetween">
        <HStack gap="medium" align="center">
          <Skeleton className="h-[16px] w-[40px] bg-background-grey2/60 animate-pulse" />
          <Skeleton className="h-[16px] w-[30px] bg-background-grey2/60 animate-pulse" />
        </HStack>
      </HStack>
    </VStack>
  );
}
