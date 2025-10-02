import { useTranslations } from '@letta-cloud/translations';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useMemo } from 'react';
import {
  Button,
  HR,
  HStack,
  Section,
  VStack,
} from '@letta-cloud/ui-component-library';
import { PlanBenefits } from '$web/client/components/PlanBenefits/PlanBenefits';
import type { BillingTiersType } from '@letta-cloud/types';
import { UpgradePlanDialog } from '$web/client/components/UpgradePlanDialog/UpgradePlanDialog';
import { BillingTierBadge } from '$web/client/components/BillingTierBadge/BillingTierBadge';
import { CancelPlanDialog } from '$web/client/components/CancelPlanDialog/CancelPlanDialog';

interface PlanActionsProps {
  billingTier: BillingTiersType;
}

function PlanActions(props: PlanActionsProps) {
  const { billingTier } = props;
  const t = useTranslations('organization/settings/CurrentPlan');

  if (billingTier === 'free') {
    return (
      <UpgradePlanDialog
        trigger={
          <Button bold color="secondary" label={t('UpgradeButton.trigger')} />
        }
      />
    );
  }

  if (billingTier === 'pro' || billingTier === 'pro-legacy') {
    return (
      <>
        <Button
          color="secondary"
          size="small"
          href="/upgrade/support"
          label={t('ManageButton.trigger')}
        />
        <CancelPlanDialog
          trigger={
            <Button size="small" label={t('CancelButton.trigger')} color="tertiary" />
          }
        />
      </>
    );
  }

  return null;
}

export function CurrentPlan() {
  const t = useTranslations('organization/settings/CurrentPlan');

  const { data } =
    webApi.organizations.getCurrentOrganizationBillingInfo.useQuery({
      queryKey: webApiQueryKeys.organizations.getCurrentOrganizationBillingInfo,
    });

  const billingTier = useMemo(() => {
    if (!data?.body.billingTier) {
      return null;
    }

    return data.body.billingTier;
  }, [data?.body.billingTier]);


  if (!billingTier) {
    return null;
  }

  return (
    <>
      <Section
        title={
          <HStack align="center" gap="medium" as="span">
            {t.rich('title', {
              plan: () => (
                <BillingTierBadge size="large" />
              ),
            })}
          </HStack>
        }
      >
        <VStack paddingY="medium">
          <PlanBenefits billingTier={billingTier} />
        </VStack>
        <HStack>
          <PlanActions billingTier={billingTier} />
        </HStack>
      </Section>
      <HR />
    </>
  );
}
