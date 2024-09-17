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

export function LoadingEmptyStatusComponent(
  props: DashboardStatusComponentProps
) {
  const {
    emptyMessage,
    isError,
    errorMessage,
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
      return errorMessage || 'An error occurred, please contact support.';
    }

    return emptyMessage;
  }, [isLoading, isError, emptyMessage, loadingMessage, errorMessage]);

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
    <VStack
      fullHeight
      fullWidth
      className="min-h-[400px]"
      align="center"
      justify="center"
    >
      <VStack
        gap="xlarge"
        className="relative mt-[-50px] "
        align="center"
        justify="center"
      >
        <LettaLoader
          stopAnimation={!isLoading}
          color={stateColor}
          size="large"
        />
        <div className="max-w-[400px] text-center">
          {message || 'Reticulating splines...'}
        </div>
        <div className="absolute top-[100%] mt-4">{action}</div>
      </VStack>
    </VStack>
  );
}
