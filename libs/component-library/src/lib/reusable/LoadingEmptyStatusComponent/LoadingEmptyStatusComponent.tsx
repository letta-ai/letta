import * as React from 'react';
import { VStack } from '../../framing/VStack/VStack';
import type { LettaLoaderProps } from '../../core/LettaLoader/LettaLoader';
import { LettaLoader } from '../../core/LettaLoader/LettaLoader';
import { useMemo } from 'react';
import type { LogoBaseProps } from '../../marketing/Logo/Logo';
import { cn } from '@letta-web/core-style-config';

interface LoadingEmptyStatusComponentProps {
  loadingMessage?: string;
  emptyMessage?: string;
  emptyAction?: React.ReactNode;
  errorMessage?: string;
  errorAction?: React.ReactNode;
  loaderVariant?: LettaLoaderProps['variant'];
  noMinHeight?: boolean;
  className?: string;
  hideText?: boolean;
  isLoading?: boolean;
  isError?: boolean;
}

export function LoadingEmptyStatusComponent(
  props: LoadingEmptyStatusComponentProps
) {
  const {
    emptyMessage,
    isError,
    errorMessage,
    noMinHeight,
    errorAction,
    loaderVariant,
    hideText,
    loadingMessage,
    isLoading,
    className,
    emptyAction,
  } = props;

  const message = useMemo(() => {
    if (isLoading) {
      return loadingMessage;
    }

    if (isError) {
      return errorMessage || 'An error occurred, please contact support.';
    }

    if (emptyMessage) {
      return emptyMessage;
    }

    return;
  }, [isLoading, isError, emptyMessage, loadingMessage, errorMessage]);

  const action = useMemo(() => {
    if (isLoading) {
      return null;
    }

    if (isError) {
      return errorAction;
    }

    if (emptyAction) {
      return emptyAction;
    }

    return;
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
      className={cn(noMinHeight ? '' : 'min-h-[400px]', className)}
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
          variant={loaderVariant}
          stopAnimation={!isLoading}
          color={stateColor}
          size="large"
        />
        {!hideText && (
          <div className="max-w-[400px] text-sm text-muted	 text-center">
            {message || 'Reticulating splines...'}
          </div>
        )}
        <div className="absolute top-[100%] mt-4">{action}</div>
      </VStack>
    </VStack>
  );
}
