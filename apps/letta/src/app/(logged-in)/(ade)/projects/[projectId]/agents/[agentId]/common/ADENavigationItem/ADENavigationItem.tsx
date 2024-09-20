import React from 'react';
import {
  CaretRightIcon,
  Cross2Icon,
  HStack,
  Typography,
} from '@letta-web/component-library';
import { cn } from '@letta-web/core-style-config';

interface NavigationItemProps {
  title: string;
  preview?: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
}

export function ADENavigationItem(props: NavigationItemProps) {
  const { title, active, onClick, preview } = props;

  return (
    <HStack fullWidth align="center" paddingX="small">
      <HStack
        fullWidth
        data-testid={`ade-navigate-to:${title}`}
        paddingX="small"
        as="button"
        rounded
        onClick={onClick}
        className={cn(
          'hover:bg-tertiary-hover cursor-pointer h-[37px]',
          active ? 'bg-primary text-primary-content hover:bg-primary-hover' : ''
        )}
        color="transparent"
        justify="spaceBetween"
        align="center"
      >
        <div>
          <Typography variant="body2">{title}</Typography>
        </div>
        <HStack align="center">
          <Typography variant="body2" color="muted">
            {preview}
          </Typography>
          <HStack align="center" className="w-3">
            {active ? (
              <Cross2Icon className="w-2.5" />
            ) : (
              <CaretRightIcon className="" />
            )}
          </HStack>
        </HStack>
      </HStack>
    </HStack>
  );
}
