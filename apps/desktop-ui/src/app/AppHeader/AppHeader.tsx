import './AppHeader.css';
import {
  Button,
  DotsVerticalIcon,
  DownloadIcon,
  DropdownMenu,
  DropdownMenuItem,
  HStack,
  Logo,
  StatusIndicator,
  TrashIcon,
  Typography,
} from '@letta-cloud/ui-component-library';
import {
  useAgentsServiceRetrieveAgent,
  useHealthServiceCheckHealth,
} from '@letta-cloud/sdk-core';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import React, { useCallback, useMemo } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import {
  DeleteAgentDialog,
  ExportAgentButton,
} from '@letta-cloud/ui-ade-components';

function ServerStatus() {
  const t = useTranslations('AppHeader');

  const { data } = useHealthServiceCheckHealth(undefined, {
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
    <HStack className="disable-app-header" gap="medium">
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

interface AgentMenuProps {
  agentId: string;
}

function AgentMenu(props: AgentMenuProps) {
  const { agentId } = props;
  const t = useTranslations('AppHeader');

  const { data } = useAgentsServiceRetrieveAgent({
    agentId,
  });

  const navigate = useNavigate();

  const handleDeleteAgentSuccess = useCallback(() => {
    navigate('/dashboard/agents');
  }, [navigate]);

  return (
    <DropdownMenu
      align="end"
      triggerAsChild
      trigger={
        <Button
          size="small"
          preIcon={<DotsVerticalIcon />}
          label={t('AgentMenu.trigger')}
          hideLabel
          color="tertiary"
        />
      }
    >
      <DeleteAgentDialog
        agentId={agentId}
        agentName={data?.name || ''}
        trigger={
          <DropdownMenuItem
            doNotCloseOnSelect
            preIcon={<TrashIcon />}
            label={t('AgentMenu.delete')}
          />
        }
        onSuccess={handleDeleteAgentSuccess}
      />
      <ExportAgentButton
        trigger={
          <DropdownMenuItem
            preIcon={<DownloadIcon />}
            label={t('AgentMenu.export')}
          />
        }
      />
    </DropdownMenu>
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
      <AgentMenu agentId={agentId} />
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
            <Link className="contents " to="/dashboard/agents">
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
