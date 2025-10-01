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
    <VStack className="min-h-[178px]" color="background-grey2" border padding  flex>
      <HStack align="center" gap="small">
        <LettaCoinIcon size="small" />
        <HStack align="end" gap="small">
          {t.rich('stats', {
            remaining: () => (
              <Typography bold variant="heading4">
                {formatNumber(billingData?.body.recurrentCredits || 0)}
              </Typography>
            ),
            small: (chunks) => (
              <Typography className="pb-0.5" variant="body3">
                {chunks}
              </Typography>
            ),
            total: () => formatNumber(limit),
          })}
        </HStack>
      </HStack>
      <QuotaProgressBar
        max={limit}
        value={billingData.body.recurrentCredits}
      />
      <VStack gap={false}>
        <Typography bold>{t('label')}</Typography>
        <VStack>
          <Typography variant="body3" muted>
            {t('description', {
              credits: formatNumber(limit),
            })}
          </Typography>
          <Typography variant="body3" muted>
            {t('resetTime', {
              date: formatDate(billingData?.body.billingPeriodEnd || ''),
            })}
          </Typography>
        </VStack>
      </VStack>
    </VStack>
  );
}
