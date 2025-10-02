'use client';
import { useTranslations } from 'next-intl';
import {
  Badge,
  HStack,
  InfoTooltip, LettaCoinIcon,
  Skeleton,
  Typography,
  WarningIcon
} from '@letta-cloud/ui-component-library';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import React from 'react';
import { AutoTopUpConfigurationDialog } from '$web/client/components/AutoTopUpConfigurationDialog';
import { useFormatters } from '@letta-cloud/utils-client';

export function AutoTopUpPreview() {
  const t = useTranslations('organization/usage/AutoTopUpPreview');

  const { data: autoTopUpConfig } =
    webApi.organizations.getAutoTopUpConfiguration.useQuery({
      queryKey: webApiQueryKeys.organizations.getAutoTopUpConfiguration,
    });

  const { data: billingData } =
    webApi.organizations.getCurrentOrganizationBillingInfo.useQuery({
      queryKey: webApiQueryKeys.organizations.getCurrentOrganizationBillingInfo,
    });

  const { formatNumber } = useFormatters();
  const isFreePlan = billingData?.body.billingTier === 'free';

  // Don't show anything for free plan users
  if (isFreePlan) {
    return null;
  }

  if (!autoTopUpConfig?.body ) {
    return <Skeleton className="bg-background-grey3 h-[18px] w-[250px]"  />;
  }

  if (!autoTopUpConfig?.body.enabled) {
    return (
      <AutoTopUpConfigurationDialog
        trigger={
          <button className="contents">
            <Badge
              content={t('disabled')}
              preIcon={<WarningIcon />}
              size="small"
              variant="warning"
            />
          </button>
        }
      />
    );
  }

  return (
    <HStack>
      <Typography variant="body3" color="lighter" noWrap>
        <HStack as="span" gap="small">
          {t.rich('enabled', {
            refillAmount: () => (
              <HStack as="span" gap="small">
                <LettaCoinIcon size="xsmall" />
                {formatNumber(autoTopUpConfig.body.refillAmount)}
              </HStack>
            ),
            credits: () => (
              <HStack as="span" gap="small">
                <LettaCoinIcon size="xsmall" />
                {formatNumber(autoTopUpConfig.body.threshold)}
              </HStack>
            ),
          })}
        </HStack>
      </Typography>
      <InfoTooltip text={t('tooltip')} />
    </HStack>
  );
}
