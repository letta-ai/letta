'use client';

import React from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '../../icons';
import { HStack } from '../../framing/HStack/HStack';
import { Typography } from '../Typography/Typography';

export interface SortableHeaderProps<T extends string = string> {
  children: React.ReactNode;
  sortKey: T;
  currentSortBy?: T;
  currentSortDirection?: 'asc' | 'desc';
  onSort: (sortKey: T) => void;
}

export function SortableHeader<T extends string = string>({
  children,
  sortKey,
  currentSortBy,
  currentSortDirection = 'desc',
  onSort,
}: SortableHeaderProps<T>) {
  const isActive = currentSortBy === sortKey;

  return (
    <HStack
      as="button"
      onClick={() => {
        onSort(sortKey);
      }}
      align="center"
      gap="small"
    >
      <Typography>{children}</Typography>
      {isActive &&
        (currentSortDirection === 'asc' ? (
          <ChevronUpIcon />
        ) : (
          <ChevronDownIcon />
        ))}
    </HStack>
  );
}
