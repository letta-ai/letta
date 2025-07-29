'use client';

import {
  DashboardWithSidebarWrapper,
  PlusIcon,
  LettaInvaderOutlineIcon,
  HStack,
  SpaceDashboardIcon,
  StatusIndicator,
  ServerNavigationDropdown,
  IdentitiesIcon,
  HR,
  CogIcon,
  TwoMemoryBlocksIcon,
} from '@letta-cloud/ui-component-library';
import React, { useMemo } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { webApi, webApiQueryKeys } from '$web/client';
import {
  LOCAL_PROJECT_SERVER_URL,
  SUPPORTED_LETTA_AGENTS_VERSIONS,
} from '$web/constants';
import { useParams, useRouter } from 'next/navigation';
import { useDevelopmentServerStatus } from '$web/client/hooks/useDevelopmentServerStatus/useDevelopmentServerStatus';
import semver from 'semver/preload';
import type { DevelopmentServerConfig } from '@letta-cloud/utils-client';
import { useFeatureFlag } from '@letta-cloud/sdk-web';

interface LocalProjectLayoutProps {
  children: React.ReactNode;
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

interface DashboardLayoutProps {
  children: React.ReactNode;
}

function DashboardLayout(props: DashboardLayoutProps) {
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
  const { data: isMemoryBlocksEnabled } = useFeatureFlag('MEMORY_BLOCK_VIEWER');

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
      ...(isMemoryBlocksEnabled
        ? [
            {
              id: 'blocks',
              icon: <TwoMemoryBlocksIcon />,
              label: t('nav.blocks'),
              href: `/development-servers/${developmentServerId}/blocks`,
            },
          ]
        : []),
      ...(developmentServerId !== 'local'
        ? [
            {
              id: 'settings',
              icon: <CogIcon />,
              label: t('nav.settings'),
              href: `/development-servers/${developmentServerId}/settings`,
            },
          ]
        : []),
    ];
  }, [isMemoryBlocksEnabled, developmentServerId, t]);

  return (
    <DashboardWithSidebarWrapper
      baseUrl="/development-servers"
      returnOverride="/"
      navigationItems={[
        {
          override: (
            <HStack
              key={selectedServer?.url || ''}
              fullWidth
              paddingBottom="small"
            >
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
          override: <HR key="hr" />,
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
  const { children } = props;

  return <DashboardLayout>{children}</DashboardLayout>;
}

export default LocalProjectLayout;
