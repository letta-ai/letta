'use client';
import * as React from 'react';
import { VStack } from '../../framing/VStack/VStack';
import { HStack } from '../../framing/HStack/HStack';
import { useFormatters } from '@letta-cloud/utils-client';
import { Typography } from '../Typography/Typography';
import { useState } from 'react';

interface TimelineTraceItem {
  event: string;
  icon?: React.ReactNode;
  timestamp: string;
  duration?: number; // in nanoseconds
  details: React.ReactNode;
}

interface TimelineItemComponentProps {
  item: TimelineTraceItem;
}

function TimelineItemComponent(props: TimelineItemComponentProps) {
  const { item } = props;

  const { formatSmallDuration: _formatSmallDuration } = useFormatters();
  const [showDetails, setShowDetails] = useState(false);

  return (
    <VStack
      paddingY="xxsmall"
      color={showDetails ? 'background-grey2' : 'transparent'}
    >
      <HStack
        as="button"
        align="center"
        onClick={() => {
          setShowDetails(!showDetails);
        }}
      >
        <div className="w-1.5 h-1.5 bg-background-grey3 rounded-full" />
        {/*{item.duration && (*/}
        {/*  <div className="bg-background-grey2 px-2 rounded-sm w-[8ch] text-xs flex items-center justify-center">*/}
        {/*    {formatSmallDuration(item.duration)}*/}
        {/*  </div>*/}
        {/*)}*/}
        <HStack align="center">
          {item.icon && <HStack>{item.icon}</HStack>}
          <Typography variant="body2">{item.event}</Typography>
        </HStack>
      </HStack>
      {showDetails && <VStack>{item.details}</VStack>}
    </VStack>
  );
}

interface TimelineTraceProps {
  items: TimelineTraceItem[];
}

export function EventReplay(props: TimelineTraceProps) {
  const { items } = props;
  return (
    <VStack gap="text">
      {items.map((item, index) => (
        <TimelineItemComponent key={index} item={item} />
      ))}
    </VStack>
  );
}
