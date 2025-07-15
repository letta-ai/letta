'use client';
import { DashboardWithSidebarWrapper } from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { useUserHasPermission } from '$web/client/hooks';
import { ApplicationServices } from '@letta-cloud/service-rbac';

interface SettingsLayoutProps {
  children: React.ReactNode;
}

function SettingsLayout(props: SettingsLayoutProps) {
  const { children } = props;

  const t = useTranslations('settings/layout');

  const [canCRUDTheOrg] = useUserHasPermission(
    ApplicationServices.UPDATE_ORGANIZATION,
  );
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
          ],
        },
        {
          title: t('organization.root'),
          items: [
            ...(canCRUDTheOrg
              ? [
                  {
                    id: 'organization',
                    label: t('organization.general'),
                    href: '/settings/organization/account',
                  },
                ]
              : []),
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
              id: 'environment-variables',
              label: t('organization.environmentVariables'),
              href: '/settings/organization/environment-variables',
            },
          ],
        },
      ]}
    >
      {children}
    </DashboardWithSidebarWrapper>
  );
}

export default SettingsLayout;
