import { useState, useCallback } from 'react';
import {
  Button,
  HStack,
  Typography,
  Tooltip,
  CheckIcon,
  CloseIcon,
  StatusIndicator,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';

interface TestConnectionButtonProps {
  url: string;
  token?: string;
}

export function TestConnectionButton({
  url,
  token,
}: TestConnectionButtonProps) {
  const [isTesting, setIsTesting] = useState(false);
  const [testingStatus, setTestingStatus] = useState<
    'auth_failed' | 'failed' | 'success' | null
  >(null);
  const t = useTranslations('Settings.TestConnectionButton');

  const testConnection = useCallback(async () => {
    setIsTesting(true);
    setTestingStatus(null);

    // Always wait at least 500ms to prevent flickering
    const startTime = Date.now();

    try {
      // Test the connection by trying to list agents with limit 1
      // This endpoint requires authentication if the server has it enabled
      const response = await fetch(`${url}/v1/agents?limit=1`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      // Calculate remaining time to reach minimum delay
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, 500 - elapsedTime);

      // Wait for remaining time if needed
      if (remainingTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingTime));
      }

      if (response.status === 401) {
        setTestingStatus('auth_failed');
      } else if (response.ok) {
        setTestingStatus('success');
      } else {
        setTestingStatus('failed');
      }
    } catch (_error) {
      // Network errors, connection refused, etc.
      // Still enforce minimum delay even on errors
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, 500 - elapsedTime);

      if (remainingTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingTime));
      }

      setTestingStatus('failed');
    } finally {
      setIsTesting(false);
    }
  }, [url, token]);

  return (
    <HStack
      align="center"
      justify="spaceBetween"
      padding="small"
      paddingRight
      border
      fullWidth
    >
      <Button
        type="button"
        color="secondary"
        busy={isTesting}
        label={t('label')}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void testConnection();
        }}
      />
      <HStack>
        {testingStatus === 'success' && (
          <Tooltip content={t('success.tooltip')}>
            <HStack>
              <CheckIcon color="positive" />
              <Typography variant="body2" bold>
                {t('success.label')}
              </Typography>
            </HStack>
          </Tooltip>
        )}
        {testingStatus === 'auth_failed' && (
          <Tooltip content={t('authFailed.tooltip')}>
            <HStack>
              <CloseIcon color="destructive" />
              <Typography variant="body2" bold>
                {t('authFailed.label')}
              </Typography>
            </HStack>
          </Tooltip>
        )}
        {testingStatus === 'failed' && (
          <Tooltip content={t('failed.tooltip')}>
            <HStack>
              <CloseIcon color="destructive" />
              <Typography variant="body2" bold>
                {t('failed.label')}
              </Typography>
            </HStack>
          </Tooltip>
        )}
        {!testingStatus && !isTesting && (
          <HStack gap="small" align="center">
            <StatusIndicator status="processing" />
            <Typography variant="body2" bold>
              {t('unconnected')}
            </Typography>
          </HStack>
        )}
        {isTesting && (
          <HStack gap="small" align="center">
            <StatusIndicator status="processing" />
            <Typography variant="body2" bold>
              {t('pending')}
            </Typography>
          </HStack>
        )}
      </HStack>
    </HStack>
  );
}
