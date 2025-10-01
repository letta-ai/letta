'use client';

import React, { useMemo } from 'react';
import {
  Button,
  ChevronRightIcon,
  HStack,
  LettaCoinIcon,
  Popover,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useFormatters } from '@letta-cloud/utils-client';
import Link from 'next/link';
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
    <HStack justify="spaceBetween" fullWidth>
      <HStack gap="small" align="center">
        <Typography variant="body2" color="lighter">
          {label}
        </Typography>
      </HStack>
      <Typography variant="body2" color="lighter">
        {value}
      </Typography>
    </HStack>
  );
}

export function CreditsPopover() {
  const t = useTranslations('components/CreditsPopover');
  const { formatNumber } = useFormatters();

  const { data: billingData } =
    webApi.organizations.getCurrentOrganizationBillingInfo.useQuery({
      queryKey: webApiQueryKeys.organizations.getCurrentOrganizationBillingInfo,
    });

  const tier = useMemo(() => {
    return billingData?.body.billingTier || 'free';
  }, [billingData?.body.billingTier]);

  // Purchased (one-off) credits
  const purchasedCredits = billingData?.body.totalCredits ?? 0;
  // Monthly included credits remaining
  const monthlyCreditsRemaining = billingData?.body.recurrentCredits ?? 0;
  // Total available = purchased + monthly remaining
  const availableCredits = purchasedCredits + monthlyCreditsRemaining;

  const showPurchasedRow = purchasedCredits > 0 || tier === 'pro';

  const triggerLabel = formatNumber(availableCredits, { maximumFractionDigits: 2 });

  return (
    <Popover
      align="end"
      triggerAsChild
      className="border-background-grey3-border"
      trigger={
        <Button
          size="xsmall"
          color="secondary"
          _use_rarely_className="!border-0"
          preIcon={<LettaCoinIcon size="xsmall" />}
          label={triggerLabel}
        />
      }
    >
      <VStack color="background-grey2" gap={false} padding>
        <HStack fullWidth align="center" paddingBottom="small">
          <Link target="_blank" href="/settings/organization/usage" color="tertiary">
            <HStack gap="small" align="center">
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
            <HStack gap="small" align="center">
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
              <HStack gap="small" align="center">
                <LettaCoinIcon size="xsmall" />
                <Typography variant="body2" color="lighter" bold overrideEl="span">
                  {formatNumber(purchasedCredits)}
                </Typography>
              </HStack>
            }
          />
        )}

        <VStack fullWidth paddingTop="small">
          {tier === 'free' ? (
            <UpgradePlanDialog
              trigger={
                <Button fullWidth size="small" color="primary" bold label={t('upgradeToPro')} />
              }
            />
          ) : null}

          {tier === 'pro' ? (
            <PurchaseCreditsDialog
              trigger={
                <Button fullWidth size="small" color="primary" bold label={t('buyCredits')} />
              }
            />
          ) : null}
        </VStack>
      </VStack>
    </Popover>
  );
}
