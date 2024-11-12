import React from 'react';
import { DashboardWithSidebarWrapper } from '@letta-web/component-library';
import { useTranslations } from 'next-intl';

interface SettingsLayoutProps {
  children: React.ReactNode;
}

function SettingsLayout(props: SettingsLayoutProps) {
  const { children } = props;

  const t = useTranslations('settings/layout');

  return (
    <DashboardWithSidebarWrapper
      baseUrl="/settings"
      returnOverride="/"
      navigationItems={[
        {
          id: 'profile',
          label: t('profile'),
          href: '/settings/profile',
          group: t('personal'),
        },
        {
          id: 'organization',
          label: t('organization.general'),
          href: '/settings/organization/general',
          group: t('organization.root'),
        },
        {
          id: 'members',
          label: t('organization.members'),
          href: '/settings/organization/members',
          group: t('organization.root'),
        },
      ]}
    >
      {children}
    </DashboardWithSidebarWrapper>
  );
}

export default SettingsLayout;
