import * as React from 'react';
import { VStack } from '../../framing/VStack/VStack';
import { LettaLoader } from '../../core/LettaLoader/LettaLoader';

interface DashboardLoaderProps {
  message?: string;
}

export function DashboardLoader(props: DashboardLoaderProps) {
  const { message } = props;

  return (
    <VStack gap="large" fullHeight fullWidth align="center" justify="center">
      <LettaLoader size="large" />
      {message || 'Reticulating splines...'}
    </VStack>
  );
}
