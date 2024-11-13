'use client';
import React from 'react';
import { LettaAgentsAPIWrapper } from '@letta-web/letta-agents-api';
import { useCurrentDevelopmentServerConfig } from '../../hooks/useCurrentDevelopmentServerConfig/useCurrentDevelopmentServerConfig';
import { LoadingEmptyStatusComponent } from '@letta-web/component-library';

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
