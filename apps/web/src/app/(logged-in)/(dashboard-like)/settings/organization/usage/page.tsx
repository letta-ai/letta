'use client';
import { useTranslations } from '@letta-cloud/translations';
import React, { useMemo } from 'react';
import {
  DashboardPageLayout,
  DashboardPageSection,
  HStack,
  Section,
  Skeleton,
  VStack,
} from '@letta-cloud/ui-component-library';
import { RecurringCreditsView } from './RecurringCreditsView/RecurringCreditsView';
import TransactionEvents from './TransactionEvents/TransactionEvents';
import { CreditBalanceView } from './CreditBalanceView/CreditBalanceView';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useUserHasPermission } from '$web/client/hooks';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import {
  FreePlanUpsellDetails,
  OldUsageView,
} from './OldUsageView/OldUsageView';
import { ViewAllQuotas } from '$web/client/components/CustomerQuotaView/CustomerQuotaView';
import { getUsageLimits } from '@letta-cloud/utils-shared';

function UsageTopSection() {
  const { data: billingData } =
    webApi.organizations.getCurrentOrganizationBillingInfo.useQuery({
      queryKey: webApiQueryKeys.organizations.getCurrentOrganizationBillingInfo,
    });

  if (!billingData) {
    return (
      <HStack fullWidth wrap>
        <Skeleton className="min-h-[225px] flex-1" />
        <Skeleton className="min-h-[225px] flex-1" />
      </HStack>
    );
  }

  if (
    billingData.body.billingTier === 'free' ||
    billingData.body.billingTier === 'pro'
  ) {
    return (
      <VStack gap="medium">
        {billingData.body.billingTier === 'free' && <FreePlanUpsellDetails />}

        <HStack fullWidth wrap gap="medium">
          <RecurringCreditsView />
          <CreditBalanceView />
        </HStack>
      </VStack>
    );
  }

  return <OldUsageView />;
}

function Limits() {
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

  return <ViewAllQuotas limits={limits} tier={billingTier} />;
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
        {canManageBilling && <UsageTopSection />}
        <Section title={t('creditsHistory')} actions={<Limits />}>
          <TransactionEvents />
        </Section>
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default Usage;
