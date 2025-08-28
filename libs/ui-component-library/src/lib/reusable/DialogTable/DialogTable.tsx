'use client';
import * as React from 'react';
import { VStack } from '../../framing/VStack/VStack';
import { HStack } from '../../framing/HStack/HStack';
import { Typography } from '../../core/Typography/Typography';
import { LoadingEmptyStatusComponent } from '../LoadingEmptyStatusComponent/LoadingEmptyStatusComponent';
import { Slot } from '@radix-ui/react-slot';
import { useMemo } from 'react';

export interface DialogTableItem {
  icon?: React.ReactNode;
  label: string;
  subtitle?: string;
  action: React.ReactNode;
}

interface DialogTableProps {
  items: DialogTableItem[];
  emptyMessage: string;
  errorMessage?: string;
  isLoading?: boolean;
  loadingMessage?: string;
  emptyAction?: React.ReactNode;
}

export function DialogTable(props: DialogTableProps) {
  const {
    items,
    emptyAction,
    errorMessage,
    emptyMessage,
    loadingMessage,
    isLoading,
  } = props;

  const showStatusComponent = useMemo(() => {
    return isLoading || items.length === 0 || errorMessage;
  }, [errorMessage, isLoading, items]);

  return (
    <VStack
      gap={false}
      overflowY={showStatusComponent ? 'hidden' : 'auto'}
      className="h-[400px]"
      border
    >
      {showStatusComponent ? (
        <LoadingEmptyStatusComponent
          emptyMessage={emptyMessage}
          errorMessage={errorMessage}
          emptyAction={emptyAction}
          loadingMessage={loadingMessage}
          isLoading={isLoading}
        />
      ) : (
        items.map((item, index) => (
          <HStack
            align="center"
            borderBottom
            key={index}
            gap={false}
            paddingY="small"
            paddingX="medium"
          >
            <HStack overflow="hidden" fullWidth justify="start">
              {item.icon && <Slot className="w-3">{item.icon}</Slot>}
              <VStack>
                <Typography noWrap align="left" fullWidth overflow="ellipsis">
                  {item.label}
                </Typography>
                {item.subtitle && (
                  <Typography
                    variant="body4"
                    color="muted"
                    noWrap
                    align="left"
                    fullWidth
                    overflow="ellipsis"
                  >
                    {item.subtitle}
                  </Typography>
                )}
              </VStack>
            </HStack>
            {item.action}
          </HStack>
        ))
      )}
    </VStack>
  );
}
