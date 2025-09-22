import './AppHeader.css';
import {
  Button,
  DotsVerticalIcon,
  DownloadIcon,
  DropdownMenu,
  DropdownMenuItem,
  HStack,
  Logo,
  TrashIcon,
  Typography,
} from '@letta-cloud/ui-component-library';
import {
  useAgentsServiceRetrieveAgent,
} from '@letta-cloud/sdk-core';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import React, { useCallback, useMemo } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import {
  DeleteAgentDialog,
  ExportAgentButton,
} from '@letta-cloud/ui-ade-components';


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
        href="https://docs.letta.com/api-reference"
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
    navigate('/');
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
  return (
    <div className="app-header">
      <HStack
        color="background"
        justify="spaceBetween"
        padding="small"
        borderBottom
        align="center"
      >
        <HStack gap="large">
          <HStack className="disable-app-header" align="center">
            <Link className="contents " to="/">
              <Logo size="small" />
              <Typography variant="body2" bold>
                Letta Enterprise
              </Typography>
            </Link>
            <AgentNavigation />
          </HStack>
        </HStack>
        <HStack align="center">
          <Navigation />
        </HStack>
      </HStack>
    </div>
  );
}
