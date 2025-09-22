import { useTranslations } from '@letta-cloud/translations';
import {
  HStack,
  StatusIndicator,
  Typography,
} from '@letta-cloud/ui-component-library';
import { useServerStatus } from '../../../hooks/useServerStatus/useServerStatus';

interface ServerStatusProps {
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function ServerStatus(_props: ServerStatusProps) {
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
