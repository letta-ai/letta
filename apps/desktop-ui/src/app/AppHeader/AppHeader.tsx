import './AppHeader.css';
import {
  HStack,
  Logo,
  StatusIndicator,
  Typography,
} from '@letta-web/component-library';
import { useTranslation } from 'react-i18next';
import { useHealthServiceHealthCheck } from '@letta-web/letta-agents-api';

function ServerStatus() {
  const { t, ...rest } = useTranslation('AppHeader', {
    keyPrefix: 'ServerStatus',
  });

  const { data } = useHealthServiceHealthCheck(undefined, {
    refetchInterval: 2500,
  });

  return (
    <HStack>
      <StatusIndicator status={data ? 'active' : 'processing'} />
      <Typography variant="body" bold>
        {data ? t('connected') : t('connecting')}
      </Typography>
    </HStack>
  );
}

export function AppHeader() {
  return (
    <div className="app-header pt-1 px-1">
      <HStack paddingX="xlarge" justify="spaceBetween" border align="center">
        <HStack gap={false}>
          <div className="w-[60px] h-[56px]" />
          <HStack align="center">
            <Logo size="small" />
            <Typography variant="body" bold>
              Letta Desktop
            </Typography>
          </HStack>
        </HStack>
        <ServerStatus />
      </HStack>
    </div>
  );
}
