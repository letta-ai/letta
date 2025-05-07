import type { ModelTiersType } from '@letta-cloud/types';
import { Badge, HStack, InfoTooltip } from '@letta-cloud/ui-component-library';
import React, { useMemo } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { useFormatters } from '@letta-cloud/utils-client';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { getUsageLimits } from '@letta-cloud/utils-shared';

interface ModelTierBadgeProps {
  tier: ModelTiersType;
}

export function ModelTierBadge(props: ModelTierBadgeProps) {
  const { tier } = props;
  const t = useTranslations('pages/models/ModelTierBadge');

  const { data: billingData } =
    webApi.organizations.getCurrentOrganizationBillingInfo.useQuery({
      queryKey: webApiQueryKeys.organizations.getCurrentOrganizationBillingInfo,
    });

  const billingTier = useMemo(() => {
    return billingData?.body.billingTier || 'free';
  }, [billingData]);

  const usage = useMemo(() => {
    return getUsageLimits(billingTier);
  }, [billingTier]);

  const { formatNumber } = useFormatters();

  if (tier === 'free') {
    return (
      <HStack>
        <Badge variant="success" content={t('standard.label')}></Badge>
        <InfoTooltip
          text={t('standard.tooltip', {
            requests:
              tier === 'free'
                ? formatNumber(usage.freeInferencesPerMonth)
                : t('infinite'),
          })}
        />
      </HStack>
    );
  }

  if (tier === 'premium') {
    return (
      <HStack>
        <Badge variant="info" content={t('premium.label')}></Badge>
        <InfoTooltip
          text={t('premium.tooltip', {
            requests: formatNumber(usage.premiumInferencesPerMonth),
          })}
        />
      </HStack>
    );
  }

  return (
    <HStack>
      <Badge variant="default" content={t('perInference.label')}></Badge>
      <InfoTooltip
        text={t('perInference.tooltip', {
          requests: t('infinite'),
        })}
      />
    </HStack>
  );
}
