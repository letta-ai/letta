import { useTranslations } from '@letta-cloud/translations';
import { HealthService } from '@letta-cloud/letta-agents-api';
import {
  HStack,
  StatusIndicator,
  Typography,
} from '@letta-cloud/component-library';
import { useEffect, useRef, useState } from 'react';
import { useServerStatus } from '../../../hooks/useServerStatus/useServerStatus';

interface ServerStatusProps {
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function ServerStatus(props: ServerStatusProps) {
  const isConnected = useServerStatus();
  const t = useTranslations('AppHeader');

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
