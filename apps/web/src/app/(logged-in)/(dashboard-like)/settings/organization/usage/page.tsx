'use client';
import { useTranslations } from '@letta-cloud/translations';
import React from 'react';
import {
  DashboardPageLayout,
  DashboardPageSection,
  HStack,
  Section, Skeleton,
  VStack
} from '@letta-cloud/ui-component-library';
import { RecurringCreditsView } from './RecurringCreditsView/RecurringCreditsView';
import TransactionEvents from './TransactionEvents/TransactionEvents';
import { CreditBalanceView } from './CreditBalanceView/CreditBalanceView';
import { useFeatureFlag, webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useUserHasPermission } from '$web/client/hooks';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { FreePlanUpsellDetails, OldUsageView } from './OldUsageView/OldUsageView';

function UsageTopSection() {

  const { data: billingData } =
    webApi.organizations.getCurrentOrganizationBillingInfo.useQuery({
      queryKey: webApiQueryKeys.organizations.getCurrentOrganizationBillingInfo,
    });
  const { data: isBillingV3Enabled } = useFeatureFlag('BILLING_V3');


  if (!billingData) {
    return (
      <HStack fullWidth wrap>
        <Skeleton className="min-h-[178px] flex-1" />
        <Skeleton className="min-h-[178px] flex-1" />
      </HStack>
    )
  }

  if ((isBillingV3Enabled && billingData.body.billingTier === 'free') || billingData.body.billingTier === 'pro') {
    return (
      <VStack>
        {billingData.body.billingTier === 'free' && <FreePlanUpsellDetails />}

        <HStack fullWidth wrap>

          <RecurringCreditsView />
          <CreditBalanceView />
        </HStack>
      </VStack>
    );
  }

  return (
    <OldUsageView />
  )

}


function Usage() {
  const t = useTranslations('organization/usage');

  const [canManageBilling] = useUserHasPermission(
    ApplicationServices.MANAGE_BILLING,
  );

  return (
    <DashboardPageLayout
      encapsulatedFullHeight
      subtitle={t('description')}
      title={t('title')}
    >
      <DashboardPageSection>

        {canManageBilling && (
          <UsageTopSection />
        )}
        <Section title={t('creditsHistory')}>
          <TransactionEvents />
        </Section>
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default Usage;
