import { useTranslations } from '@letta-cloud/translations';
import { HealthService } from '@letta-web/letta-agents-api';
import {
  HStack,
  StatusIndicator,
  Typography,
} from '@letta-web/component-library';
import { useEffect, useRef, useState } from 'react';

interface ServerStatusProps {
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function ServerStatus(props: ServerStatusProps) {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const t = useTranslations('AppHeader');

  const { onConnect, onDisconnect } = props;
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function checkHealth() {
      try {
        const response = await HealthService.healthCheck();

        if (!response.version) {
          throw new Error('Invalid response');
        }

        if (!isConnected && onConnect) {
          onConnect();
        }

        setIsConnected(true);
      } catch (e) {
        if (isConnected && onDisconnect) {
          onDisconnect();
        }

        setIsConnected(false);
      }
    }
    void checkHealth();

    interval.current = setInterval(() => {
      void checkHealth();
    }, 2500);

    return () => {
      if (interval.current) {
        clearInterval(interval.current);
      }
    };
  }, [isConnected]);

  return (
    <HStack>
      <StatusIndicator status={isConnected ? 'active' : 'processing'} />
      <Typography variant="body3" bold>
        {isConnected
          ? t('ServerStatus.connected')
          : t('ServerStatus.connecting')}
      </Typography>
    </HStack>
  );
}
