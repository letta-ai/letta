'use client';
import React, { useMemo } from 'react';
import {
  Badge,
  HStack,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { webApi, webApiQueryKeys } from '$web/client';
import { useTranslations } from '@letta-cloud/translations';

export function CurrentUserDetailsBlock() {
  const { data: user } = webApi.user.getCurrentUser.useQuery({
    queryKey: webApiQueryKeys.user.getCurrentUser,
  });
  const { data } = webApi.organizations.getCurrentOrganization.useQuery({
    queryKey: webApiQueryKeys.organizations.getCurrentOrganization,
  });

  const { data: billingData } =
    webApi.organizations.getCurrentOrganizationBillingInfo.useQuery({
      queryKey: webApiQueryKeys.organizations.getCurrentOrganizationBillingInfo,
    });

  const t = useTranslations('components/CurrentUserDetailsBlock');

  const tierCopy = useMemo(() => {
    switch (billingData?.body.billingTier) {
      case 'free':
        return t('subscription.free');
      case 'pro-legacy':
      case 'pro':
        return t('subscription.pro');
      case 'scale':
        return t('subscription.scale');
      case 'enterprise':
        return t('subscription.enterprise');
      default:
        return null;
    }
  }, [billingData?.body.billingTier, t]);

  const tierVariant = useMemo(() => {
    switch (billingData?.body.billingTier) {
      case 'free':
        return 'warning';
      case 'pro-legacy':
      case 'pro':
        return 'info';
      case 'scale':
        return 'info';
      case 'enterprise':
        return 'info';
      default:
        return null;
    }
  }, [billingData?.body.billingTier]);

  return (
    <HStack fullWidth justify="spaceBetween" padding="large" align="start">
      <VStack gap={false} fullWidth align="start">
        <Typography bold>{user?.body.name}</Typography>
        <Typography variant="body2" color="lighter">
          {data?.body.name || ''}
        </Typography>
      </VStack>
      {tierCopy && <Badge variant={tierVariant} border content={tierCopy} />}
    </HStack>
  );
}
