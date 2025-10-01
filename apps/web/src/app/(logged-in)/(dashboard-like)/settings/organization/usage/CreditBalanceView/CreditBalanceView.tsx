'use client';
import { useTranslations } from 'next-intl';
import {
  Button,
  HStack,
  LettaCoinIcon,
  Typography,
  VStack,
  WalletIcon,
} from '@letta-cloud/ui-component-library';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import React, { useMemo } from 'react';
import { useFormatters } from '@letta-cloud/utils-client';
import { CancelPlanDialog } from '$web/client/components/CancelPlanDialog/CancelPlanDialog';
import { UpgradePlanDialog } from '$web/client/components/UpgradePlanDialog/UpgradePlanDialog';
import { PurchaseCreditsDialog } from '$web/client/components/PurchaseCreditsDialog/PurchaseCreditsDialog';
import { AutoTopUpConfigurationDialog } from '$web/client/components/AutoTopUpConfigurationDialog';
import { AutoTopUpPreview } from '../AutoTopUpPreview/AutoTopUpPreview';

function ManagePlanButton() {
  const t = useTranslations('organization/usage/CreditBalanceView');

  return (
    <Button
      color="secondary"
      size="small"
      href="/upgrade/support"
      label={t('manage')}
    />
  );
}

export function CreditBalanceView() {
  const t = useTranslations('organization/usage/CreditBalanceView');
  const { data: billingData } =
    webApi.organizations.getCurrentOrganizationBillingInfo.useQuery({
      queryKey: webApiQueryKeys.organizations.getCurrentOrganizationBillingInfo,
    });

  const { formatNumber } = useFormatters();
  const tier = useMemo(() => {
    return billingData?.body.billingTier || 'free';
  }, [billingData?.body.billingTier]);

  if (!billingData) {
    return null;
  }

  return (
    <VStack
      className="min-h-[225px]"
      color="background-grey"
      paddingX
      paddingBottom
      paddingTop="small"
      border
      gap="medium"
      align="start"
      position="relative"
      flex
    >

      <VStack gap="small">

        <HStack fullWidth align="center" gap="small">
          <div className="min-w-[1rem]">
            <LettaCoinIcon size="small" />
          </div>
          <HStack fullWidth align="end">
            <Typography noWrap>
              <Typography
                bold
                variant="heading3"
                overrideEl="span"
                noWrap
              >
                {formatNumber(billingData?.body.totalCredits || 0)}
              </Typography>
              <Typography
                overrideEl="span"
                noWrap
              >
                {t('creditBalanceSuffix')}
              </Typography>
            </Typography>
          </HStack>
        </HStack>
        <HStack>
          <AutoTopUpPreview />
        </HStack>
      </VStack>


      <HStack fullWidth paddingY="xxsmall">
        {tier === 'free' ? (
          <UpgradePlanDialog
            trigger={
              <Button
                size="small"
                label={t('upgrade')}
                color="secondary"
                preIcon={<WalletIcon />}
              />
            }
          />
        ) : (
          <HStack>
            <PurchaseCreditsDialog
              trigger={
                <Button
                  size="small"
                  bold
                  label={t('purchase')}
                  color="secondary"
                  preIcon={<WalletIcon />}
                />
              }
            />
            <AutoTopUpConfigurationDialog trigger={
              <Button type="button" size="small" label={t('autoTopUp')} color="tertiary" />
            } />
          </HStack>
        )}
      </HStack>
      <VStack gap="small" align="start">
        <Typography variant="body" bold>
          {t('label')}
        </Typography>
        <Typography variant="body3" color="lighter">
          {t('description')}
        </Typography>
        {tier === 'free' ? (
          <Typography variant="body3" color="lighter">
            {t('disabledOnFree')}
          </Typography>
        ) : (
          <HStack>
            <ManagePlanButton />
            <CancelPlanDialog
              trigger={
                <Button size="xsmall" label={t('cancel')} color="tertiary" />
              }
            />
          </HStack>
        )}
      </VStack>
    </VStack>
  );
}
