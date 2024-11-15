'use client';

import {
  DashboardWithSidebarWrapper,
  PlusIcon,
} from '@letta-web/component-library';
import React, { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { webApi, webApiQueryKeys } from '$letta/client';

interface LocalProjectLayoutProps {
  children: React.ReactNode;
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
      id: server.id,
      label: server.name,
      group: t('nav.remote'),
      href: `/development-servers/${server.id}/agents`,
    }));
  }, [remoteConnections, t]);

  return (
    <DashboardWithSidebarWrapper
      baseUrl="/development-servers"
      returnOverride="/"
      navigationItems={[
        {
          id: 'dashboard',
          label: t('nav.dashboard'),
          href: `/development-servers/local/dashboard`,
        },
        {
          id: 'agents',
          label: t('nav.local'),
          href: `/development-servers/local/agents`,
        },
        ...additionalNavigationItems,
        {
          id: 'create',
          icon: <PlusIcon />,
          label: t('nav.create'),
          href: '/development-servers/add',
          group: t('nav.remote'),
        },
      ]}
    >
      {children}
    </DashboardWithSidebarWrapper>
  );
}

export default LocalProjectLayout;
