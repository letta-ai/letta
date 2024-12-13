import * as React from 'react';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { VStack } from '../../framing/VStack/VStack';
import { HStack } from '../../framing/HStack/HStack';
import { cn } from '@letta-web/core-style-config';
import { Slot } from '@radix-ui/react-slot';
import { Typography } from '../../core/Typography/Typography';

const messageWrapperVariants = cva('', {
  variants: {
    type: {
      code: 'bg-background-grey2',
      internalMonologue: 'bg-background-violet text-background-violet-content',
      default: 'bg-background',
    },
  },
  defaultVariants: {
    type: 'default',
  },
});

interface MessageWrapperProps
  extends VariantProps<typeof messageWrapperVariants> {
  header: {
    preIcon?: React.ReactNode;
    title: string;
    badge?: React.ReactNode;
  };
  children: React.ReactNode;
}

export function MessageWrapper({
  header,
  type,
  children,
}: MessageWrapperProps) {
  return (
    <VStack fullWidth gap={false}>
      <HStack>
        <HStack
          paddingX="small"
          paddingY="xxsmall"
          className={cn(messageWrapperVariants({ type }), 'h-[24px] text-xs')}
          gap="small"
          align="center"
        >
          <Slot
            className={cn(
              'w-3 h-3',
              type === 'code' ? 'text-text-secondary' : ''
            )}
          >
            {header.preIcon}
          </Slot>
          <HStack gap="medium" align="center">
            <Typography
              color={type === 'code' ? 'lighter' : 'default'}
              variant="body3"
              bold
            >
              {header.title}
            </Typography>
            {header.badge}
          </HStack>
        </HStack>
      </HStack>
      <VStack
        className={cn(
          messageWrapperVariants({ type }),
          type === 'code' ? 'bg-background border' : ''
        )}
        paddingY="small"
        paddingX="small"
      >
        {children}
      </VStack>
    </VStack>
  );
}
