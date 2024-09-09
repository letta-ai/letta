import * as React from 'react';
import { VStack } from '../../framing/VStack/VStack';
import { LettaLoader } from '../../core/LettaLoader/LettaLoader';
import { useMemo } from 'react';
import type { LogoBaseProps } from '../../marketing/Logo/Logo';

interface DashboardStatusComponentProps {
  loadingMessage?: string;
  emptyMessage: string;
  emptyAction?: React.ReactNode;
  errorMessage?: string;
  errorAction?: React.ReactNode;
  isLoading?: boolean;
  isError?: boolean;
}

export function DashboardStatusComponent(props: DashboardStatusComponentProps) {
  const {
    emptyMessage,
    isError,
    errorAction,
    loadingMessage,
    isLoading,
    emptyAction,
  } = props;

  const message = useMemo(() => {
    if (isLoading) {
      return loadingMessage;
    }

    if (isError) {
      return isError;
    }

    return emptyMessage;
  }, [isLoading, isError, emptyMessage, loadingMessage]);

  const action = useMemo(() => {
    if (isLoading) {
      return null;
    }

    if (isError) {
      return errorAction;
    }

    return emptyAction;
  }, [emptyAction, errorAction, isError, isLoading]);

  const stateColor: LogoBaseProps['color'] = useMemo(() => {
    if (isLoading) {
      return 'inherit';
    }

    if (isError) {
      return 'error';
    }

    return 'inherit';
  }, [isError, isLoading]);

  return (
    <VStack fullHeight fullWidth align="center" justify="center">
      <VStack
        gap="xlarge"
        className="relative mt-[-50px]"
        align="center"
        justify="center"
      >
        <LettaLoader
          stopAnimation={!isLoading}
          color={stateColor}
          size="large"
        />
        {message || 'Reticulating splines...'}
        <div className="absolute top-[100%] mt-4">{action}</div>
      </VStack>
    </VStack>
  );
}
