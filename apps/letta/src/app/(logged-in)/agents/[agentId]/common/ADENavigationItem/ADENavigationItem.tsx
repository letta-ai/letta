import React from 'react';
import {
  CaretRightIcon,
  Cross2Icon,
  HStack,
  Typography,
} from '@letta-web/component-library';

interface NavigationItemProps {
  title: string;
  preview?: React.ReactNode;
  onClick?: () => void;
  isActive?: boolean;
}

export function NavigationItem(props: NavigationItemProps) {
  const { title, isActive, onClick, preview } = props;

  return (
    <HStack
      paddingX="xxsmall"
      as="button"
      onClick={onClick}
      className="hover:bg-tertiary-hover cursor-pointer h-[37px]"
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
          {isActive ? (
            <Cross2Icon className="w-2.5" />
          ) : (
            <CaretRightIcon className="" />
          )}
        </HStack>
      </HStack>
    </HStack>
  );
}
