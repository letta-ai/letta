import { useTranslations } from '@letta-cloud/translations';
import {
  HStack,
  Typography,
  VStack,
  Button,
} from '@letta-cloud/ui-component-library';
import { useFeatureFlag, webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useMemo } from 'react';
import { getUsageLimits } from '@letta-cloud/utils-shared';
import { UpgradePlanDialog } from '$web/client/components/UpgradePlanDialog/UpgradePlanDialog';

interface RowProps {
  label: string;
  value: string;
}

function Row(props: RowProps) {
  const { label, value } = props;
  return (
    <HStack justify="spaceBetween" fullWidth>
      <Typography variant="body2"> {label}</Typography>
      <Typography variant="body2">{value}</Typography>
    </HStack>
  );
}

export function OrganizationUsageBlock() {
  const t = useTranslations('components/OrganizationUsageBlock');
  const { data: quotaData } =
    webApi.organizations.getOrganizationQuotas.useQuery({
      queryKey: webApiQueryKeys.organizations.getOrganizationQuotas,
    });

  const { data: billingData } =
    webApi.organizations.getCurrentOrganizationBillingInfo.useQuery({
      queryKey: webApiQueryKeys.organizations.getCurrentOrganizationBillingInfo,
    });
  const { data: isProPlanEnabled } = useFeatureFlag('PRO_PLAN');

  const billingTier = useMemo(() => {
    return billingData?.body.billingTier || 'free';
  }, [billingData?.body.billingTier]);

  const limits = useMemo(() => {
    return getUsageLimits(billingTier);
  }, [billingTier]);

  if (!isProPlanEnabled) {
    return;
  }

  if (!quotaData || !billingTier) {
    return null;
  }

  if (billingTier === 'enterprise') {
    return null;
  }

  return (
    <VStack fullWidth padding>
      <Typography variant="body2" bold>
        {t('title')}
      </Typography>
      <Row
        label={t('premiumModels.label')}
        value={t('premiumModels.usage', {
          total: limits.premiumInferencesPerMonth,
          used: quotaData.body.premiumModelRequests,
        })}
      />
      <Row
        label={t('standardModels.label')}
        value={t('standardModels.usage', {
          total: limits.freeInferencesPerMonth,
          used: quotaData.body.freeModelRequests,
        })}
      />
      {billingTier === 'free' && (
        <UpgradePlanDialog
          trigger={<Button fullWidth size="small" bold label={t('upgrade')} />}
        />
      )}
    </VStack>
  );
}
