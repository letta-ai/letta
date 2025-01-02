'use client';
import React from 'react';
import { DashboardWithSidebarWrapper } from '@letta-web/component-library';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentUser } from '$web/client/hooks';

interface SettingsLayoutProps {
  children: React.ReactNode;
}

function SettingsLayout(props: SettingsLayoutProps) {
  const { children } = props;

  const t = useTranslations('settings/layout');

  const currentUser = useCurrentUser();

  return (
    <DashboardWithSidebarWrapper
      baseUrl="/settings"
      returnOverride="/"
      navigationItems={[
        {
          title: t('personal'),
          items: [
            {
              id: 'profile',
              label: t('profile'),
              href: '/settings/profile',
            },
            {
              id: 'account',
              label: t('account'),
              href: '/settings/account',
            },
          ],
        },
        ...(currentUser?.hasCloudAccess
          ? [
              {
                title: t('organization.root'),
                items: [
                  {
                    id: 'organization',
                    label: t('organization.general'),
                    href: '/settings/organization/general',
                  },
                  {
                    id: 'members',
                    label: t('organization.members'),
                    href: '/settings/organization/members',
                  },
                  {
                    id: 'billing',
                    label: t('organization.billing'),
                    href: '/settings/organization/billing',
                  },
                  {
                    id: 'integrations',
                    label: t('organization.integrations'),
                    href: '/settings/organization/integrations',
                  },
                  {
                    id: 'billing',
                    label: t('organization.environmentVariables'),
                    href: '/settings/organization/environment-variables',
                  },
                ],
              },
            ]
          : []),
      ]}
    >
      {children}
    </DashboardWithSidebarWrapper>
  );
}

export default SettingsLayout;
