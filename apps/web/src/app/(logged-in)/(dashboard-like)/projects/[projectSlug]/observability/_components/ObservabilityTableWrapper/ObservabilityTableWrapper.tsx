import * as React from 'react';

import { HStack, Typography, VStack } from '@letta-cloud/ui-component-library';

interface DashboardChartWrapperProps {
  title: string;
  children: React.ReactNode;
}

export function ObservabilityTableWrapper(props: DashboardChartWrapperProps) {
  const { title, children } = props;
  return (
    <VStack overflowY="auto" padding="medium" collapseHeight flex>
      <HStack
        align="center"
        justify="spaceBetween"
        padding="medium"
        paddingLeft="large"
      >
        <Typography variant="body2" bold>
          {title}
        </Typography>
      </HStack>
      <div className="px-3 pb-3 w-full h-full">
        <div className="w-full h-full">{children}</div>
      </div>
    </VStack>
  );
}
