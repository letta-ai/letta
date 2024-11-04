'use client';

import { useTranslations } from 'next-intl';
import {
  DashboardWithSidebarWrapper,
  SidebarTitle,
} from '@letta-web/component-library';
import React from 'react';
import { webApi, webApiQueryKeys } from '$letta/client';

interface OrganizationLayoutProps {
  children: React.ReactNode;
}

export function ClientSideOrganizationLayout(props: OrganizationLayoutProps) {
  const { children } = props;

  const t = useTranslations('organization/layout');
  const { data: organization } =
    webApi.organizations.getCurrentOrganization.useQuery({
      queryKey: webApiQueryKeys.organizations.getCurrentOrganization,
    });

  return (
    <DashboardWithSidebarWrapper
      baseUrl="/organization"
      returnOverride="/"
      projectTitle={<SidebarTitle name={organization?.body.name || ''} />}
      navigationItems={[
        {
          id: 'members',
          label: t('members'),
          href: '/organization/members',
        },
        {
          id: 'settings',
          label: t('settings'),
          href: '/organization/settings',
        },
      ]}
    >
      {children}
    </DashboardWithSidebarWrapper>
  );
}
