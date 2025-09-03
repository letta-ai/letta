'use client';

import React from 'react';
import {
  GroupAddIcon,
} from '@letta-cloud/ui-component-library';
import {
  AccountIcon,
  LogoutIcon,
  BirdIcon,
  KeyIcon,
  VStack,
  HStack,
  SwitchOrganizationIcon,
} from '@letta-cloud/ui-component-library';
import { useCurrentUser } from '$web/client/hooks';
import { webApi, webApiQueryKeys } from '$web/client';
import { useTranslations } from '@letta-cloud/translations';
import {
  DashboardNavigationButton
} from '../DashboardNavigationButton/DashboardNavigationButton';
import { ThemeSelector } from '$web/client/components/ThemeSelector/ThemeSelector';
import { LocaleSelector } from '$web/client/components/LocaleSelector/LocaleSelector';

function AdminNav() {
  const t = useTranslations(
    'components/DashboardLikeLayout/DashboardNavigation',
  );
  const user = useCurrentUser();

  const { data } = webApi.organizations.getCurrentOrganization.useQuery({
    queryKey: webApiQueryKeys.organizations.getCurrentOrganization,
    enabled: !!user?.activeOrganizationId,
  });

  if (!data?.body.isAdmin) {
    return null;
  }

  return (
    <DashboardNavigationButton
      id="admin"
      href="/admin"
      label={t('nav.admin')}
      icon={<BirdIcon />}
    />
  );
}

interface SecondaryMenuItemsProps {
  isMobile?: boolean;
}

export function SecondaryMenuItems(props: SecondaryMenuItemsProps) {
  const { isMobile } = props;
  const t = useTranslations(
    'components/DashboardLikeLayout/DashboardNavigation',
  );

  return (
    <VStack gap="medium">
      <VStack gap={false}>
        <VStack borderBottom gap={false}>
          {!isMobile && (
            <DashboardNavigationButton
              id="settings"
              href="/settings/organization/account"
              label={t('secondaryNav.account')}
              icon={<AccountIcon />}
            />
          )}
          <AdminNav />
          <DashboardNavigationButton
            id="api-keys"
            href="/api-keys"
            label={t('secondaryNav.apiKeys')}
            icon={<KeyIcon />}
          />
          <DashboardNavigationButton
            id="select-organization"
            href="/settings/organization/members"
            label={t('secondaryNav.addMembers')}
            icon={<GroupAddIcon />}
          />
          <DashboardNavigationButton
            id="select-organization"
            href="/select-organization"
            label={t('secondaryNav.switchOrganizations')}
            icon={<SwitchOrganizationIcon />}
          />
          <DashboardNavigationButton
            id="sign-out"
            preload={false}
            href="/signout"
            label={t('secondaryNav.signOut')}
            icon={<LogoutIcon />}
          />
        </VStack>
      </VStack>
      <HStack justify="spaceBetween" paddingX="small" align="center">
        <LocaleSelector />
        <ThemeSelector />
      </HStack>
    </VStack>
  );
}
