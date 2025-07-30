'use client';

import { use } from 'react';
import { useRef, useState, useEffect } from 'react';
import {
  Typography,
  VStack,
  Spinner,
  Badge,
  Button,
} from '@letta-cloud/ui-component-library';
import { useToolsServiceMcpOauthCallback } from '@letta-cloud/sdk-core';
import { useTranslations } from '@letta-cloud/translations';
import { AuthWrapper } from '../../../_components/AuthWrapper';

interface MCPOAuthCallbackPageProps {
  params: Promise<{
    sessionId: string;
  }>;
  searchParams: Promise<{
    code?: string;
    state?: string;
    error?: string;
    error_description?: string;
  }>;
}

export default function MCPOAuthCallbackPage({
  params,
  searchParams,
}: MCPOAuthCallbackPageProps) {
  const { sessionId } = use(params);
  const { code, state, error, error_description } = use(searchParams);
  const logoRef = useRef<HTMLDivElement>(null);
  const [hasSucceeded, setHasSucceeded] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const t = useTranslations('mcpOauthCallback');

  const { data, isLoading, isSuccess } = useToolsServiceMcpOauthCallback(
    {
      sessionId,
      code: code || undefined,
      state: state || undefined,
      error: error || undefined,
      errorDescription: error_description || undefined,
    },
    undefined,
    {
      // Disable automatic refetching for OAuth callback
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      retry: false,
      staleTime: Infinity,
      gcTime: Infinity,
    },
  );

  const responseData = data as {
    status?: string;
    message?: string;
    server_url?: string;
  };
  const isResponseSuccessful = responseData?.status === 'success';

  useEffect(() => {
    if (isSuccess && !error && code && isResponseSuccessful) {
      setHasSucceeded(true);
    }
  }, [isSuccess, responseData, error, code, isResponseSuccessful]);

  function handleCloseWindow() {
    window.close();
  }

  // Auto-close window after 10 seconds if successful
  useEffect(() => {
    if (hasSucceeded) {
      setCountdown(10);
      const timer = setTimeout(() => {
        window.close();
      }, 10000);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [hasSucceeded]);

  useEffect(() => {
    if (hasSucceeded && countdown > 0) {
      const interval = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);

      return () => {
        clearInterval(interval);
      };
    }
  }, [hasSucceeded, countdown]);

  if (isLoading) {
    return (
      <AuthWrapper showLogo={true} logoRef={logoRef}>
        <VStack align="center" position="relative" fullWidth gap="large">
          <VStack gap="large" align="center" fullWidth>
            <Typography variant="heading5" align="center">
              {t('processingAuthorization')}
            </Typography>
            <Spinner size="medium" />
          </VStack>
        </VStack>
      </AuthWrapper>
    );
  }

  if (hasSucceeded) {
    return (
      <AuthWrapper
        showLogo={true}
        logoRef={logoRef}
        headerContent={
          responseData?.server_url ? (
            <Badge content={responseData.server_url} variant="info" border />
          ) : null
        }
        footer={
          <VStack paddingTop="large">
            <Button
              label={
                t('closeWindow') + (countdown > 0 ? ` (${countdown})` : '')
              }
              onClick={handleCloseWindow}
              bold
              align="center"
              size="large"
              color="secondary"
            />
          </VStack>
        }
      >
        <VStack align="center" position="relative" fullWidth gap="large">
          <VStack gap="large" align="center">
            <Typography variant="heading5" align="center">
              {t('authorizationSuccessful')}
            </Typography>
            <Typography variant="body2" color="muted" align="center">
              {t('successMessage')}
            </Typography>
          </VStack>
        </VStack>
      </AuthWrapper>
    );
  }

  return (
    <AuthWrapper
      showLogo={true}
      logoRef={logoRef}
      footer={
        <VStack paddingTop="large">
          <Button
            label={t('closeWindow')}
            onClick={handleCloseWindow}
            bold
            align="center"
            size="large"
            color="secondary"
          />
        </VStack>
      }
    >
      <VStack align="center" position="relative" fullWidth gap="large">
        <VStack gap="large" align="center" fullWidth>
          <Typography variant="heading5" align="center">
            {t('authorizationFailed')}
          </Typography>
          <Typography variant="body2" color="destructive" align="center">
            {error_description ||
              error ||
              responseData?.message ||
              t('errorMessage')}
          </Typography>
          <Typography variant="body2" color="muted" align="center">
            {t('tryAgainMessage')}
          </Typography>
        </VStack>
      </VStack>
    </AuthWrapper>
  );
}
