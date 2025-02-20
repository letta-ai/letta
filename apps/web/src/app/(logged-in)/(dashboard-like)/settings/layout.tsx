'use client';
import { DashboardWithSidebarWrapper } from '@letta-cloud/component-library';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentUser, useUserHasPermission } from '$web/client/hooks';
import { useFeatureFlag } from '@letta-cloud/web-api-client';
import { ApplicationServices } from '@letta-cloud/rbac';

interface SettingsLayoutProps {
  children: React.ReactNode;
}

function SettingsLayout(props: SettingsLayoutProps) {
  const { children } = props;

  const t = useTranslations('settings/layout');

  const currentUser = useCurrentUser();

  const { isLoading: isLoadingModelProviders, data: isModelProvidersEnabled } =
    useFeatureFlag('ALLOW_MODEL_PROVIDER_CONFIGURATION');
  const { isLoading: isLoadingBilling, data: isBillingProviderEnabled } =
    useFeatureFlag('BILLING');
  const showModelProviders =
    !isLoadingModelProviders && isModelProvidersEnabled;

  const [canManageBilling] = useUserHasPermission(
    ApplicationServices.MANAGE_BILLING,
  );

  const showBilling =
    !isLoadingBilling && isBillingProviderEnabled && canManageBilling;

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
                  ...(canCRUDTheOrg
                    ? [
                        {
                          id: 'organization',
                          label: t('organization.general'),
                          href: '/settings/organization/general',
                        },
                      ]
                    : []),
                  {
                    id: 'members',
                    label: t('organization.members'),
                    href: '/settings/organization/members',
                  },
                  ...(showBilling
                    ? [
                        {
                          id: 'billing',
                          label: t('organization.billing'),
                          href: '/settings/organization/billing',
                        },
                      ]
                    : []),
                  {
                    id: 'integrations',
                    label: t('organization.integrations'),
                    href: '/settings/organization/integrations',
                  },
                  {
                    id: 'environemnt-variables',
                    label: t('organization.environmentVariables'),
                    href: '/settings/organization/environment-variables',
                  },
                  {
                    id: 'usage',
                    label: t('organization.usage'),
                    href: '/settings/organization/usage',
                  },
                  {
                    id: 'rate-limits',
                    label: t('organization.rateLimits'),
                    href: '/settings/organization/rate-limits',
                  },
                  {
                    id: 'cost-explorer',
                    label: t('organization.costExplorer'),
                    href: '/settings/organization/cost-explorer',
                  },
                  ...(showModelProviders
                    ? [
                        {
                          id: 'model-providers',
                          label: t('organization.modelProviders'),
                          href: '/settings/organization/model-providers',
                        },
                      ]
                    : []),
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
