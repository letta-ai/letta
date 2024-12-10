'use client';

import {
  DashboardWithSidebarWrapper,
  PlusIcon,
  LettaInvaderOutlineIcon,
  HStack,
  Typography,
  SpaceDashboardIcon,
  StatusIndicator,
  Button,
  DotsHorizontalIcon,
  DropdownMenuItem,
  CogIcon,
  TrashIcon,
  DropdownMenu,
  Dialog,
} from '@letta-web/component-library';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { webApi, webApiQueryKeys } from '$letta/client';
import {
  LOCAL_PROJECT_SERVER_URL,
  SUPPORTED_LETTA_AGENTS_VERSIONS,
} from '$letta/constants';
import { UpdateDevelopmentServerDetailsDialog } from './shared/UpdateDevelopmentServerDetailsDialog/UpdateDevelopmentServerDetailsDialog';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import type { ServerInferResponses } from '@ts-rest/core';
import type { developmentServersContracts } from '$letta/web-api/development-servers/developmentServersContracts';
import { useDevelopmentServerStatus } from './hooks/useDevelopmentServerStatus/useDevelopmentServerStatus';
import type { DevelopmentServerConfig } from './[developmentServerId]/hooks/useCurrentDevelopmentServerConfig/useCurrentDevelopmentServerConfig';
import semver from 'semver/preload';

interface DeleteDevelopmentServerDialogProps {
  trigger: React.ReactNode;
  id: string;
}

function DeleteDevelopmentServerDialog(
  props: DeleteDevelopmentServerDialogProps
) {
  const t = useTranslations('development-servers/layout');
  const { trigger, id } = props;
  const queryClient = useQueryClient();
  const { push } = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const { mutate, isPending, isSuccess, isError } =
    webApi.developmentServers.deleteDevelopmentServer.useMutation({
      onSuccess: () => {
        queryClient.setQueriesData<
          ServerInferResponses<
            typeof developmentServersContracts.getDevelopmentServers,
            200
          >
        >(
          {
            queryKey: webApiQueryKeys.developmentServers.getDevelopmentServers,
            exact: true,
          },
          (oldData) => {
            if (!oldData) {
              return oldData;
            }

            return {
              ...oldData,
              body: {
                ...oldData.body,
                developmentServers: oldData.body.developmentServers.filter(
                  (server) => server.id !== id
                ),
              },
            };
          }
        );

        push('/development-servers/local/dashboard');
      },
    });

  const handleDelete = useCallback(() => {
    if (isPending || isSuccess) {
      return;
    }

    mutate({
      params: {
        developmentServerId: id,
      },
    });
  }, [isPending, isSuccess, mutate, id]);

  return (
    <Dialog
      trigger={trigger}
      isConfirmBusy={isPending || isSuccess}
      onConfirm={handleDelete}
      errorMessage={
        isError ? t('DeleteDevelopmentServerDialog.error') : undefined
      }
      title={t('DeleteDevelopmentServerDialog.title')}
      confirmText={t('DeleteDevelopmentServerDialog.confirm')}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
    >
      {t('DeleteDevelopmentServerDialog.description')}
    </Dialog>
  );
}

interface LocalProjectLayoutProps {
  children: React.ReactNode;
}

interface ServerStatusTitleProps {
  config: DevelopmentServerConfig;
  title: string;
}

function ServerStatusTitle(props: ServerStatusTitleProps) {
  const { config, title } = props;
  const t = useTranslations('development-servers/layout');

  const { isHealthy, version } = useDevelopmentServerStatus(config);

  const isNotCompatible = useMemo(() => {
    if (!version) {
      return false;
    }

    return !semver.satisfies(version, SUPPORTED_LETTA_AGENTS_VERSIONS);
  }, [version]);

  const status = useMemo(() => {
    if (!isHealthy) {
      return 'processing';
    }

    if (isNotCompatible) {
      return 'warning';
    }

    return 'active';
  }, [isHealthy, isNotCompatible]);

  const statusText = useMemo(() => {
    if (isNotCompatible) {
      return t('ServerStatusTitle.incompatible', {
        version: SUPPORTED_LETTA_AGENTS_VERSIONS,
        currentVersion: version,
      });
    }

    return isHealthy
      ? t('ServerStatusTitle.isHealthy')
      : t('ServerStatusTitle.connecting');
  }, [isHealthy, isNotCompatible, t, version]);

  return (
    <HStack align="center">
      <StatusIndicator tooltipContent={statusText} status={status} />
      <Typography bold variant="body2">
        {title}
      </Typography>
    </HStack>
  );
}

function LocalProjectLayout(props: LocalProjectLayoutProps) {
  const t = useTranslations('development-servers/layout');
  const { children } = props;

  const { data: remoteConnections } =
    webApi.developmentServers.getDevelopmentServers.useQuery({
      queryKey: webApiQueryKeys.developmentServers.getDevelopmentServers,
    });

  const additionalNavigationItems = useMemo(() => {
    if (!remoteConnections) {
      return [];
    }

    return remoteConnections.body.developmentServers.map((server) => ({
      title: server.name,
      titleOverride: (
        <HStack justify="spaceBetween" fullWidth>
          <ServerStatusTitle
            config={{
              password: server.password || '',
              url: server.url,
              id: server.id,
              name: server.name,
            }}
            title={server.name}
          />
          <DropdownMenu
            triggerAsChild
            trigger={
              <Button
                hideLabel
                color="tertiary-transparent"
                size="small"
                preIcon={<DotsHorizontalIcon />}
                label={t('settings')}
              />
            }
          >
            <UpdateDevelopmentServerDetailsDialog
              trigger={
                <DropdownMenuItem
                  preIcon={<CogIcon />}
                  doNotCloseOnSelect
                  label={t('updateDetails')}
                />
              }
              name={server.name}
              password={server.password || ''}
              url={server.url}
              id={server.id}
            />
            <DeleteDevelopmentServerDialog
              trigger={
                <DropdownMenuItem
                  preIcon={<TrashIcon />}
                  doNotCloseOnSelect
                  label={t('delete')}
                />
              }
              id={server.id}
            />
          </DropdownMenu>
        </HStack>
      ),
      items: [
        {
          id: server.id,
          icon: <LettaInvaderOutlineIcon />,
          label: t('nav.agents'),
          href: `/development-servers/${server.id}/agents`,
        },
      ],
    }));
  }, [remoteConnections, t]);

  return (
    <DashboardWithSidebarWrapper
      baseUrl="/development-servers"
      returnOverride="/"
      navigationItems={[
        {
          title: t('nav.local'),
          titleOverride: (
            <ServerStatusTitle
              config={{
                id: 'local',
                url: LOCAL_PROJECT_SERVER_URL,
                password: '',
                name: t('nav.local'),
              }}
              title={t('nav.local')}
            />
          ),
          items: [
            {
              id: 'dashboard',
              icon: <SpaceDashboardIcon />,
              label: t('nav.dashboard'),
              href: `/development-servers/local/dashboard`,
            },
            {
              id: 'agents',
              icon: <LettaInvaderOutlineIcon />,
              label: t('nav.agents'),
              href: `/development-servers/local/agents`,
            },
          ],
        },
        ...additionalNavigationItems,
        {
          id: 'create',
          icon: <PlusIcon />,
          label: t('nav.create'),
          href: '/development-servers/add',
        },
      ]}
    >
      {children}
    </DashboardWithSidebarWrapper>
  );
}

export default LocalProjectLayout;
