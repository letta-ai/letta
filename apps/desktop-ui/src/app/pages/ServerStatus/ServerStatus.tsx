import { useTranslations } from '@letta-cloud/translations';
import {
  Button,
  DesktopPageLayout,
  HStack,
  LettaLoader,
  LoadingEmptyStatusComponent,
  RefreshIcon,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { Link } from 'react-router-dom';
import type { ServerLogType } from '@letta-cloud/types';
import { useEffect, useRef, useState } from 'react';
import { useDesktopConfig } from '@letta-cloud/utils-client';

export function ServerStatus() {
  const t = useTranslations('ServerStatus');
  const { desktopConfig } = useDesktopConfig();
  const [logs, setLogs] = useState<ServerLogType[]>([
    {
      message: 'Connecting to server...',
      timestamp: new Date().toISOString(),
      type: 'info',
    },
  ]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const isEmbedded =
    desktopConfig?.databaseConfig.type === 'embedded' ||
    desktopConfig?.databaseConfig.type === 'external';

  function handleRestart() {
    if (!Object.prototype.hasOwnProperty.call(window, 'lettaServer')) {
      return;
    }

    void window.lettaServer.restart();
  }

  useEffect(() => {
    if (
      !isEmbedded ||
      !Object.prototype.hasOwnProperty.call(window, 'lettaServer')
    ) {
      return;
    }

    const interval = setInterval(() => {
      void window.lettaServer.getLogs();
    }, 250);

    window.lettaServer.onGetLogs((logs) => {
      if (logs.length === 0) {
        return;
      }

      setLogs(logs);
    });

    return () => {
      clearInterval(interval);
      window.lettaServer.onGetLogs(() => {
        return;
      });
    };
  }, [isEmbedded]);

  const prevLogTimestamp = useRef<string | null>(null);

  useEffect(() => {
    if (prevLogTimestamp?.current === logs[logs.length - 1]?.timestamp) {
      return;
    }

    prevLogTimestamp.current = logs[logs.length - 1]?.timestamp;

    if (scrollRef.current) {
      scrollRef.current.scrollTop += 100;
    }
  }, [logs]);

  const mounted = useRef(false);

  // scroll to bottom on page load
  useEffect(() => {
    if (logs.length < 2) {
      return;
    }

    if (mounted.current) {
      return;
    }

    mounted.current = true;

    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <DesktopPageLayout
      icon={<LettaLoader size="medium" variant="spinner3d" />}
      subtitle={t('subtitle')}
      title={t('title')}
      actions={
        isEmbedded && (
          <Button
            preIcon={<RefreshIcon />}
            color="tertiary"
            size="small"
            onClick={handleRestart}
            label={t('restart')}
          />
        )
      }
    >
      {isEmbedded ? (
        <VStack
          ref={scrollRef}
          overflow="auto"
          padding="small"
          color="background-grey2"
          fullHeight
          style={{ overflowX: 'hidden' }}
        >
          {logs.map((log, index) => (
            <HStack key={index} style={{ flexWrap: 'wrap' }}>
              <Typography
                color="muted"
                font="mono"
                variant="body2"
                style={{ flexShrink: 0 }}
              >
                [{log.timestamp}]
              </Typography>
              <Typography
                color={log.type === 'error' ? 'destructive' : 'default'}
                font="mono"
                variant="body2"
                style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
              >
                {log.message}
              </Typography>
            </HStack>
          ))}
        </VStack>
      ) : (
        <LoadingEmptyStatusComponent
          isLoading={false}
          emptyMessage={t('noLogsAvailable', {
            serverType:
              desktopConfig?.databaseConfig.type === 'cloud'
                ? 'Letta Cloud'
                : 'a self-hosted server',
          })}
          emptyAction={
            <Link to="/dashboard/settings">
              <Button label={t('goToSettings')} color="primary" />
            </Link>
          }
        />
      )}
    </DesktopPageLayout>
  );
}
