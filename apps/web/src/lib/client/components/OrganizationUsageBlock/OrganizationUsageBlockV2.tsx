import { HStack, LettaCoinIcon, Typography, VStack, Button, ChevronRightIcon } from '@letta-cloud/ui-component-library';
import { useFormatters } from '@letta-cloud/utils-client';
import Link from 'next/link';
import React, { useMemo } from 'react';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { PurchaseCreditsDialog } from '$web/client/components/PurchaseCreditsDialog/PurchaseCreditsDialog';
import { UpgradePlanDialog } from '$web/client/components/UpgradePlanDialog/UpgradePlanDialog';
import { useTranslations } from '@letta-cloud/translations';

interface RowProps {
  label: string;
  value: React.ReactNode | string;
}

function Row(props: RowProps) {
  const { label, value } = props;
  return (
    <HStack as="span" justify="spaceBetween" fullWidth>
      <Typography variant="body2" color="lighter">
        {label}
      </Typography>
      <Typography variant="body2" color="lighter">
        {value}
      </Typography>
    </HStack>
  );
}

export function OrganizationUsageBlockV2() {
  const t = useTranslations('components/OrganizationUsageBlockV2');
  const { formatNumber } = useFormatters();

  const { data: billingData } =
    webApi.organizations.getCurrentOrganizationBillingInfo.useQuery({
      queryKey: webApiQueryKeys.organizations.getCurrentOrganizationBillingInfo,
    });

  const tier = useMemo(() => {
    return billingData?.body.billingTier || 'free';
  }, [billingData?.body.billingTier]);

  if (!billingData) return null;

  const purchasedCredits = billingData.body.totalCredits ?? 0;
  const monthlyCreditsRemaining = billingData.body.recurrentCredits ?? 0;
  const showPurchasedRow = purchasedCredits > 0 || tier === 'pro';

  return (
    <VStack fullWidth padding>
      <HStack fullWidth align="center">
        <Link target="_blank" href="/settings/organization/usage" color="tertiary">
          <HStack gap="small">
            <Typography overrideEl="span" variant="body2" bold>
              {t('title')}
            </Typography>
            <ChevronRightIcon />
          </HStack>
        </Link>
      </HStack>

      <Row
        label={t('monthlyCredits')}
        value={
          <HStack as="span" gap="small">
            <LettaCoinIcon size="xsmall" />
            <Typography variant="body2" color="lighter" bold overrideEl="span">
              {formatNumber(monthlyCreditsRemaining)}
            </Typography>
          </HStack>
        }
      />

      {showPurchasedRow && (
        <Row
          label={t('purchasedCredits')}
          value={
            <HStack as="span" gap="small">
              <LettaCoinIcon size="xsmall" />
              <Typography variant="body2" color="lighter" bold overrideEl="span">
                {formatNumber(purchasedCredits)}
              </Typography>
            </HStack>
          }
        />
      )}

      <VStack gap="small" fullWidth paddingTop="small">
        {tier === 'free' ? (
          <UpgradePlanDialog
            trigger={<Button fullWidth size="small" color="primary" bold label={t('upgradeToPro')} />}
          />
        ) : null}
        {tier === 'pro' ? (
          <PurchaseCreditsDialog
            trigger={<Button fullWidth size="small" color="primary" bold label={t('buyCredits')} />}
          />
        ) : null}
      </VStack>
    </VStack>
  );
}
