import * as React from 'react';
import { HStack } from '../../framing/HStack/HStack';
import { Typography } from '../../core/Typography/Typography';
import { Skeleton } from '../../core/Skeleton/Skeleton';
import { cn } from '@letta-cloud/ui-styles';

interface DashboardChartWrapperProps {
  title: string;
  children: React.ReactNode;
  isLoading?: boolean;
}

export function DashboardChartWrapper(props: DashboardChartWrapperProps) {
  const { title, children, isLoading } = props;
  return (
    <div
      className={cn(
        'h-[300px] flex flex-col bg-background min-w-[250px] border w-full',
      )}
    >
      <HStack padding="medium">
        <Typography variant="body2" bold>
          {title}
        </Typography>
      </HStack>
      <div className="px-3 pb-3 w-full h-full">
        {isLoading ? (
          <Skeleton className="w-full h-full" />
        ) : (
          <div className="w-full h-full">{children}</div>
        )}
      </div>
    </div>
  );
}
