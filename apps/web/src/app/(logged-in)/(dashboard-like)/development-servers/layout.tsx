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
  ServerNavigationDropdown,
  IdentitiesIcon,
  HR,
} from '@letta-cloud/ui-component-library';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { webApi, webApiQueryKeys } from '$web/client';
import {
  LOCAL_PROJECT_SERVER_URL,
  SUPPORTED_LETTA_AGENTS_VERSIONS,
} from '$web/constants';
import { UpdateDevelopmentServerDetailsDialog } from './shared/UpdateDevelopmentServerDetailsDialog/UpdateDevelopmentServerDetailsDialog';
import { useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import type { ServerInferResponses } from '@ts-rest/core';
import {
  useFeatureFlag,
  type developmentServersContracts,
} from '$web/web-api/contracts';
import { useDevelopmentServerStatus } from '$web/client/hooks/useDevelopmentServerStatus/useDevelopmentServerStatus';
import semver from 'semver/preload';
import type { DevelopmentServerConfig } from '@letta-cloud/utils-client';

interface DeleteDevelopmentServerDialogProps {
  trigger: React.ReactNode;
  id: string;
}

function DeleteDevelopmentServerDialog(
  props: DeleteDevelopmentServerDialogProps,
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
                  (server) => server.id !== id,
                ),
              },
            };
          },
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

  return (
    <HStack align="center">
      <ServerStatusIndicator config={config} />
      <Typography bold variant="body2">
        {title}
      </Typography>
    </HStack>
  );
}

interface ServerStatusIndicatorProps {
  config: DevelopmentServerConfig;
}

function ServerStatusIndicator(props: ServerStatusIndicatorProps) {
  const { config } = props;
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

  return <StatusIndicator tooltipContent={statusText} status={status} />;
}

const localServerConfig: DevelopmentServerConfig = {
  id: 'local',
  name: 'Local',
  url: LOCAL_PROJECT_SERVER_URL,
  password: '',
};

interface NewDashboardLayoutProps {
  children: React.ReactNode;
}

function NewDashboardLayout(props: NewDashboardLayoutProps) {
  const { children } = props;

  const { data: remoteConnections } =
    webApi.developmentServers.getDevelopmentServers.useQuery({
      queryKey: webApiQueryKeys.developmentServers.getDevelopmentServers,
    });

  const t = useTranslations('development-servers/layout');

  const servers = useMemo(() => {
    if (!remoteConnections) {
      return [localServerConfig];
    }

    return [
      localServerConfig,
      ...remoteConnections.body.developmentServers,
    ].map((server) => ({
      id: server.id,
      name: server.name,
      url: server.url,
      statusIndicator: <ServerStatusIndicator config={server} />,
    }));
  }, [remoteConnections]);

  const { developmentServerId } = useParams<{ developmentServerId: string }>();

  const selectedServer = useMemo(() => {
    return servers.find((server) => server.id === developmentServerId);
  }, [servers, developmentServerId]);

  const { push } = useRouter();

  const items = useMemo(() => {
    return [
      {
        id: 'dashboard',
        icon: <SpaceDashboardIcon />,
        label: t('nav.dashboard'),
        href: `/development-servers/${developmentServerId}/dashboard`,
      },
      {
        id: 'agents',
        icon: <LettaInvaderOutlineIcon />,
        label: t('nav.agents'),
        href: `/development-servers/${developmentServerId}/agents`,
      },
      {
        id: 'identities',
        icon: <IdentitiesIcon />,
        label: t('nav.identities'),
        href: `/development-servers/${developmentServerId}/identities`,
      },
    ];
  }, [developmentServerId, t]);

  return (
    <DashboardWithSidebarWrapper
      baseUrl="/development-servers"
      returnOverride="/"
      navigationItems={[
        {
          override: (
            <HStack key={selectedServer?.url || ''} fullWidth paddingBottom="small">
              <ServerNavigationDropdown
                servers={servers}
                selectedServerUrl={selectedServer?.url || ''}
                onSelect={(server) => {
                  push(`/development-servers/${server.id}/dashboard`);
                }}
              />
            </HStack>
          ),
        },
        ...items,
        {
          override: <HR />,
        },
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
                color="tertiary"
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
        {
          id: 'identities',
          icon: <IdentitiesIcon />,
          label: t('nav.identities'),
          href: `/development-servers/${server.id}/identities`,
        },
      ],
    }));
  }, [remoteConnections, t]);

  const { isLoading: isLoadingFlag, data: isFlagEnabled } = useFeatureFlag(
    'NEW_DEVELOPMENT_SERVER',
  );

  if (!isLoadingFlag && isFlagEnabled) {
    return <NewDashboardLayout>{children}</NewDashboardLayout>;
  }

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
            {
              id: 'identities',
              icon: <IdentitiesIcon />,
              label: t('nav.identities'),
              href: `/development-servers/local/identities`,
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
