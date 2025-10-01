'use client';

import React from 'react';
import {
  Avatar, BarChartIcon,
  Button,
  HStack,
  Popover,
  VStack
} from '@letta-cloud/ui-component-library';
import { useCurrentUser } from '$web/client/hooks';
import { CurrentUserDetailsBlock } from '$web/client/components';
import { OrganizationUsageBlock } from '$web/client/components/OrganizationUsageBlock/OrganizationUsageBlock';
import { SecondaryMenuItems } from '../SecondaryMenuItems/SecondaryMenuItems';
import { useFeatureFlag } from '@letta-cloud/sdk-web';
import {
  DashboardNavigationButton
} from '$web/client/components/DashboardLikeLayout/DashboardNavigation/DashboardNavigationButton/DashboardNavigationButton';
import { useTranslations } from '@letta-cloud/translations';

interface ProfilePopoverProps {
  size?: 'large' | 'medium' | 'small';
}

export function ProfilePopover(props: ProfilePopoverProps) {
  const user = useCurrentUser();
  const { size } = props;
  const { data: isBillingV3Enabled } = useFeatureFlag('BILLING_V3');

  const t = useTranslations('components/DashboardLikeLayout/DashboardNavigation');

  if (!user) {
    return null;
  }

  return (
    <Popover
      align="end"
      triggerAsChild
      /* eslint-disable-next-line react/forbid-component-props */
      className="border-background-grey3-border"
      trigger={
        <Button
          color="tertiary"
          label=""
          hideLabel
          _use_rarely_disableTooltip
          preIcon={
            <Avatar
              imageSrc={user?.imageUrl || ''}
              size={size}
              name={user?.name || ''}
              framed
            />
          }
        />
      }
    >
      <VStack color="background-grey2" gap={false}>
        <HStack borderBottom>
          <CurrentUserDetailsBlock />
        </HStack>
        {!isBillingV3Enabled ? (
          <HStack borderBottom>
            <OrganizationUsageBlock />
          </HStack>
        ) : (
          <HStack borderBottom>
            <DashboardNavigationButton
              id="usage"
              href="/settings/organization/usage"
              label={t('secondaryNav.usage')}
              icon={<BarChartIcon />}
            />
          </HStack>
        )}
        <VStack paddingBottom="small">
          <SecondaryMenuItems />
        </VStack>
      </VStack>
    </Popover>
  );
}
