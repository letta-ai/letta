import './AppHeader.css';
import {
  Button,
  HStack,
  Logo,
  StatusIndicator,
  Typography,
} from '@letta-cloud/ui-component-library';
import { useHealthServiceHealthCheck } from '@letta-cloud/sdk-core';
import { Link, useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import { useTranslations } from '@letta-cloud/translations';

function ServerStatus() {
  const t = useTranslations('AppHeader');

  const { data } = useHealthServiceHealthCheck(undefined, {
    refetchInterval: 2500,
  });

  return (
    <HStack
      className=" h-[42px]"
      align="center"
      borderLeft
      paddingLeft="large"
      fullHeight
      paddingX="small"
    >
      <StatusIndicator status={data ? 'active' : 'processing'} />
      <Typography variant="body3" bold>
        {data ? t('ServerStatus.connected') : t('ServerStatus.connecting')}
      </Typography>
    </HStack>
  );
}

function Navigation() {
  const t = useTranslations('AppHeader');

  return (
    <HStack className="disable-app-header" gap={false}>
      <Button
        size="small"
        target="_blank"
        label={t('Navigation.documentation')}
        color="tertiary"
        href="https://docs.letta.com/introduction"
      />
      <Button
        size="small"
        label={t('Navigation.apiReference')}
        color="tertiary"
        href="https://docs.letta.com/api-reference/agents/list"
        target="_blank"
      />
      <Button
        size="small"
        target="_blank"
        label={t('Navigation.cloud')}
        color="primary"
        href="https://app.letta.com"
      />
    </HStack>
  );
}

function AgentNavigation() {
  const location = useLocation();

  const agentId = useMemo(() => {
    // /agents/:id
    const regxp = new RegExp(/\/agents\/(.*)/);

    const match = regxp.exec(location.pathname);

    if (match) {
      return match[1];
    }

    return undefined;
  }, [location.pathname]);

  if (!agentId) {
    return null;
  }

  return (
    <>
      /
      <Typography variant="body2" bold>
        {agentId}
      </Typography>
    </>
  );
}

export function AppHeader() {
  const isWindows = window.electron.platform === 'win32';
  return (
    <div className="app-header">
      <HStack
        color="background"
        paddingLeft={isWindows ? 'medium' : 'xlarge'}
        paddingRight={isWindows ? 'small' : false}
        justify="spaceBetween"
        borderBottom
        align="center"
      >
        <HStack gap="large">
          {!isWindows && <div className="w-[60px] h-[42px] border-r" />}
          <HStack className="disable-app-header" align="center">
            <Link className="contents " to="/">
              <Logo size="small" />
              <Typography variant="body2" bold>
                Letta Desktop
              </Typography>
              {isWindows && <ServerStatus />}
            </Link>
            <AgentNavigation />
          </HStack>
        </HStack>
        <HStack align="center">
          <Navigation />
          {!isWindows && <ServerStatus />}
          {isWindows && <div className="w-[125px] h-[42px]" />}
        </HStack>
      </HStack>
    </div>
  );
}
