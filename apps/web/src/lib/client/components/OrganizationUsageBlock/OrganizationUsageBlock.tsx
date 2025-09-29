import { useTranslations } from '@letta-cloud/translations';
import {
  HStack,
  Typography,
  VStack,
  Button,
  ChevronRightIcon,
} from '@letta-cloud/ui-component-library';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useMemo } from 'react';
import { getUsageLimits } from '@letta-cloud/utils-shared';
import { UpgradePlanDialog } from '$web/client/components/UpgradePlanDialog/UpgradePlanDialog';
import Link from 'next/link';

interface RowProps {
  label: string;
  value: React.ReactNode | string;
}

function Row(props: RowProps) {
  const { label, value } = props;
  return (
    <HStack justify="spaceBetween" fullWidth>
      <Typography variant="body2" color="lighter">
        {' '}
        {label}
      </Typography>
      <Typography variant="body2" color="lighter">
        {value}
      </Typography>
    </HStack>
  );
}

export function OrganizationUsageBlock() {
  const t = useTranslations('components/OrganizationUsageBlock');
  const { data: quotaData } =
    webApi.organizations.getOrganizationQuotas.useQuery({
      queryKey: webApiQueryKeys.organizations.getOrganizationQuotas,
      refetchOnMount: true,
    });

  const { data: billingData } =
    webApi.organizations.getCurrentOrganizationBillingInfo.useQuery({
      queryKey: webApiQueryKeys.organizations.getCurrentOrganizationBillingInfo,
    });

  const billingTier = useMemo(() => {
    return billingData?.body.billingTier || 'free';
  }, [billingData?.body.billingTier]);

  const limits = useMemo(() => {
    return getUsageLimits(billingTier);
  }, [billingTier]);

  if (!quotaData || !billingTier) {
    return null;
  }

  if (billingTier === 'enterprise') {
    return null;
  }

  const usedPremiumModelRequests = Math.max(
    limits.premiumInferencesPerMonth - quotaData.body.premiumModelRequests,
    0,
  );

  const usedStandardModelRequests = Math.max(
    limits.freeInferencesPerMonth - quotaData.body.freeModelRequests,
    0,
  );

  return (
    <VStack fullWidth padding>
      <HStack fullWidth align="center">
        <Link
          target="_blank"
          href="/settings/organization/billing"
          color="tertiary"
        >
          <HStack gap="small">
            <Typography overrideEl="span" variant="body2" bold>
              {t('title')}
            </Typography>
            <ChevronRightIcon />
          </HStack>
        </Link>
      </HStack>
      <Row
        label={t('premiumModels.label')}
        value={t.rich('premiumModels.usage', {
          total: limits.premiumInferencesPerMonth,
          used: usedPremiumModelRequests,
          bold: (chunks) => (
            <Typography variant="body2" color="lighter" bold overrideEl="span">
              {chunks}
            </Typography>
          ),
        })}
      />
      <Row
        label={t('standardModels.label')}
        value={t.rich('standardModels.usage', {
          total: limits.freeInferencesPerMonth,
          used: usedStandardModelRequests,
          bold: (chunks) => (
            <Typography variant="body2" color="lighter" bold overrideEl="span">
              {chunks}
            </Typography>
          ),
        })}
      />
      {(billingTier === 'free' || billingTier === 'pro-legacy') && (
        <UpgradePlanDialog
          trigger={
            <Button
              fullWidth
              size="small"
              bold
              _use_rarely_className="mt-1"
              label={
                billingTier === 'pro-legacy' ? t('upgradeToScale') : t('upgradeToPro')
              }
            />
          }
        />
      )}
    </VStack>
  );
}
