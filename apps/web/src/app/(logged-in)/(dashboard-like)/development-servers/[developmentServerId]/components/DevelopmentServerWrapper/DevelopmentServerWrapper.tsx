'use client';
import React from 'react';
import { LettaAgentsAPIWrapper } from '@letta-cloud/letta-agents-api';
import { useCurrentDevelopmentServerConfig } from '@letta-cloud/helpful-client-utils';
import { LoadingEmptyStatusComponent } from '@letta-cloud/component-library';

interface DevelopmentServerWrapperProps {
  children: React.ReactNode;
}

export function DevelopmentServerWrapper(props: DevelopmentServerWrapperProps) {
  const { children } = props;
  const developmentServerConfig = useCurrentDevelopmentServerConfig();

  if (!developmentServerConfig) {
    return <LoadingEmptyStatusComponent emptyMessage="" isLoading />;
  }

  return (
    <LettaAgentsAPIWrapper
      baseUrl={developmentServerConfig.url}
      password={developmentServerConfig.password}
    >
      {children}
    </LettaAgentsAPIWrapper>
  );
}
