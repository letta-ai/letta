import { useTranslations } from '@letta-cloud/translations';
import {
  Button,
  HStack,
  LettaLoader,
  RefreshIcon,
  Typography,
  VStack,
} from '@letta-cloud/component-library';
import type { ServerLogType } from '@letta-cloud/types';
import { useEffect, useRef, useState } from 'react';
import { useServerStatus } from '../../hooks/useServerStatus/useServerStatus';
import { DesktopPageLayout } from '../shared/DesktopPageLayout/DesktopPageLayout';

export function ServerStatus() {
  const t = useTranslations('ServerStatus');
  const [logs, setLogs] = useState<ServerLogType[]>([
    {
      message: 'Starting server...',
      timestamp: new Date().toISOString(),
      type: 'info',
    },
  ]);

  const scrollRef = useRef<HTMLDivElement>(null);

  const status = useServerStatus();

  function handleRestart() {
    if (!status) {
      return;
    }

    if (!Object.prototype.hasOwnProperty.call(window, 'lettaServer')) {
      return;
    }

    void window.lettaServer.restart();
    setLogs([
      {
        message: 'Restarting server...',
        timestamp: new Date().toISOString(),
        type: 'info',
      },
    ]);
  }

  useEffect(() => {
    if (!Object.prototype.hasOwnProperty.call(window, 'lettaServer')) {
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
    }, []);

    return () => {
      clearInterval(interval);
      window.lettaServer.onGetLogs(() => {
        return;
      });
    };
  }, []);

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
      icon={<LettaLoader size="small" variant="flipper" />}
      subtitle={t('subtitle')}
      title={t('title')}
      actions={
        <Button
          preIcon={<RefreshIcon />}
          color="tertiary"
          size="small"
          onClick={handleRestart}
          label={t('restart')}
        />
      }
    >
      <VStack
        ref={scrollRef}
        overflow="auto"
        padding="small"
        color="background-grey2"
        fullHeight
      >
        {logs.map((log, index) => (
          <HStack key={index}>
            <Typography color="muted" font="mono" variant="body2">
              [{log.timestamp}]
            </Typography>
            <Typography
              color={log.type === 'error' ? 'destructive' : 'default'}
              font="mono"
              variant="body2"
            >
              {log.message}
            </Typography>
          </HStack>
        ))}
      </VStack>
    </DesktopPageLayout>
  );
}
