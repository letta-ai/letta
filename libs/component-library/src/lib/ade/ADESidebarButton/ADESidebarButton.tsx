import * as React from 'react';
import { cn } from '@letta-web/core-style-config';
import { HStack } from '../../framing/HStack/HStack';
import { Slot } from '@radix-ui/react-slot';
import { Typography } from '../../core/Typography/Typography';

interface ADESidebarButtonProps {
  label: string;
  icon: React.ReactNode;
  preview?: React.ReactNode | undefined;
  isActive?: boolean;
  onClick?: () => void;
  inline?: boolean;
}

export function ADESidebarButton(props: ADESidebarButtonProps) {
  const { label, inline, icon, preview, isActive, onClick } = props;

  return (
    <HStack
      onClick={onClick}
      as="button"
      fullWidth={!inline}
      inline={inline}
      data-testid={`ade-navigate-to:${label}`}
      paddingX="small"
      paddingY="small"
      rounded
      className={cn(
        'hover:bg-background-grey-hover bg-background-grey cursor-pointer'
      )}
      color="transparent"
      align="center"
    >
      {isActive && (
        <div className="min-w-2 min-h-2 bg-background-black rounded-full" />
      )}
      <HStack wrap justify="spaceBetween" fullWidth gap={false}>
        <HStack align="center">
          <Slot className="w-3 h-3">{icon}</Slot>
          <Typography noWrap variant="body2">
            {label}
          </Typography>
        </HStack>
        {preview && (
          <HStack align="center">
            <Typography color="primary" variant="body2">
              {preview}
            </Typography>
          </HStack>
        )}
      </HStack>
    </HStack>
  );
}
