import * as React from 'react';
import Link from 'next/link';
import { cn } from '@letta-cloud/ui-styles';
import { Skeleton } from '../../core/Skeleton/Skeleton';
import { VStack } from '../../framing/VStack/VStack';
import { HStack } from '../../framing/HStack/HStack';
import { Typography } from '../../core/Typography/Typography';

const BUTTON_HEIGHT = 'h-[30px]';

function LoadingState() {
  return <Skeleton className={cn(BUTTON_HEIGHT, 'w-full')} />;
}

export interface CardButtonProps {
  id: string;
  preIcon?: React.ReactNode;
  label?: string;
  url?: string; // if no url passed in, then it's loading
  shouldOpenNewTab?: boolean;
}

function CardInner(props: CardButtonProps) {
  const { id, url, preIcon, label } = props;

  return (
    <VStack
      key={id}
      fullWidth
      border
      padding="xxsmall"
      color="background-grey"
      paddingX="small"
      className={cn(
        url
          ? 'cursor-pointer hover:bg-gray-50 whitespace-nowrap'
          : 'cursor-default',
      )}
    >
      <HStack align="center">
        {preIcon}
        <Typography variant="body" overflow="ellipsis">
          {label}
        </Typography>
      </HStack>
    </VStack>
  );
}

export function CardButton(props: CardButtonProps) {
  const { url, shouldOpenNewTab } = props;

  if (!url) {
    return <LoadingState />;
  }

  if (shouldOpenNewTab) {
    return (
      <Link href={url} target="_blank">
        <CardInner {...props} />
      </Link>
    );
  }

  return (
    <Link href={url}>
      <CardInner {...props} />
    </Link>
  );
}
