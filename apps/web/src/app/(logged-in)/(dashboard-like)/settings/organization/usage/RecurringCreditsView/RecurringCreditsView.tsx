'use client';
import { useTranslations } from 'next-intl';
import {
  HStack,
  LettaCoinIcon,
  QuotaProgressBar,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useMemo } from 'react';
import { getRecurrentSubscriptionLimits } from '@letta-cloud/utils-shared';
import { useFormatters } from '@letta-cloud/utils-client';

export function RecurringCreditsView() {
  const t = useTranslations('organization/usage/RecurringCreditsView');
  const { data: billingData } =
    webApi.organizations.getCurrentOrganizationBillingInfo.useQuery({
      queryKey: webApiQueryKeys.organizations.getCurrentOrganizationBillingInfo,
    });

  const { formatNumber, formatDate } = useFormatters();
  const limit = useMemo(() => {
    return getRecurrentSubscriptionLimits({
      tier: billingData?.body.billingTier || 'free',
    });
  }, [billingData?.body.billingTier]);

  if (!billingData) {
    return null;
  }

  return (
    <VStack
      className="min-h-[178px]"
      color="background-grey"
      border
      padding
      gap="medium"
      align="start"
      flex
    >
      <HStack align="center" gap="small">
        <LettaCoinIcon size="small" />
        <Typography noWrap>
          <Typography
            bold
            variant="heading3"
            overrideEl="span"
            noWrap
          >
            {formatNumber(billingData?.body.recurrentCredits || 0)}
          </Typography>
          <Typography
            overrideEl="span"
            noWrap
          >
            {t('remainingSuffix', { limit: formatNumber(limit) })}
          </Typography>
        </Typography>
      </HStack>
      <HStack border fullWidth padding="xxsmall">
        <QuotaProgressBar
          max={limit}
          value={billingData.body.recurrentCredits}
          inverseColors
        />
      </HStack>
      <VStack gap="small" align="start">
        <Typography variant="body" bold>
          {t('label')}
        </Typography>
        <Typography variant="body3" color="lighter">
          {t('description', {
            credits: formatNumber(limit),
          })}
        </Typography>
        <Typography variant="body3" color="lighter">
          {t('resetTime', {
            date: formatDate(billingData?.body.billingPeriodEnd || ''),
          })}
        </Typography>
      </VStack>
    </VStack>
  );
}
