import * as React from 'react';
import { Typography } from '../../core/Typography/Typography';
import { VStack } from '../../framing/VStack/VStack';

interface DashboardEmptyAreaProps {
  message: string;
  action?: React.ReactNode;
}

export function DashboardEmptyArea(props: DashboardEmptyAreaProps) {
  const { message, action } = props;
  return (
    <VStack fullHeight fullWidth className="border-dashed p-[1px]" border>
      <VStack
        className="fade-in-0"
        fullWidth
        border
        align="center"
        justify="center"
        fullHeight
        color="background-grey"
      >
        <Typography variant="body">{message}</Typography>
        {action}
      </VStack>
    </VStack>
  );
}
