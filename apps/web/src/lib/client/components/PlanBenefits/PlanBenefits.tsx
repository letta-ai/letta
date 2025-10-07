'use client';
import type { BillingTiersType } from '@letta-cloud/types';
import { useTranslations } from '@letta-cloud/translations';
import {
  CheckIcon,
  HStack,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { getRecurrentSubscriptionLimits, getUsageLimits } from '@letta-cloud/utils-shared';
import { useFormatters } from '@letta-cloud/utils-client';

interface BenefitContainer {
  children: React.ReactNode;
}

function BenefitContainer(props: BenefitContainer) {
  return <VStack gap="large">{props.children}</VStack>;
}

interface BenefitProps {
  label: React.ReactNode;
}

function Benefit(props: BenefitProps) {
  const { label } = props;

  return (
    <HStack gap="large">
      <CheckIcon color="positive" />
      <Typography variant="body">{label}</Typography>
    </HStack>
  );
}

function FreePlanBenefits() {
  const t = useTranslations('components/PlanBenefits');
  const limit = getRecurrentSubscriptionLimits({
    tier: 'free'
  });

  const limits = getUsageLimits('free');

  const { formatFileSize, formatNumber } = useFormatters();

  return (
    <BenefitContainer>
      <Benefit
        label={t.rich('free.credits', {
          limit: () => formatNumber(limit),
        })}
      />
      <Benefit label={t('free.api')} />
      <Benefit label={t('free.ade')} />
      <Benefit label={t('free.templates', { limit: limits.templates })} />
      <Benefit
        label={t('free.storage', {
          limit: formatFileSize(limits.storage, {
            unit: 'GB',
            maximumFractionDigits: 0,
          }),
        })}
      />
    </BenefitContainer>
  );
}

function ProPlanBenefits() {
  const t = useTranslations('components/PlanBenefits');

  const limit = getRecurrentSubscriptionLimits({
    tier: 'pro'
  });

  const limits = getUsageLimits('pro');

  const { formatFileSize, formatNumber } = useFormatters();

  return (
    <BenefitContainer>
      <Benefit
        label={t.rich('pro.credits', {
          limit: () => formatNumber(limit),
        })}
      />
      <Benefit label={t('pro.overage')} />
      <Benefit label={t('pro.agent')} />
      <Benefit
        label={t('pro.templates', { limit: formatNumber(limits.templates) })}
      />
      <Benefit
        label={t('pro.storage', {
          limit: formatFileSize(limits.storage, {
            unit: 'GB',
            maximumFractionDigits: 0,
          }),
        })}
      />
    </BenefitContainer>
  );
}

function EnterprisePlanBenefits() {
  const t = useTranslations('components/PlanBenefits');

  return (
    <BenefitContainer>
      <Benefit label={t('enterprise.pricing')} />
      <Benefit label={t('enterprise.byok')} />
      <Benefit label={t('enterprise.oidc')} />
      <Benefit label={t('enterprise.rbac')} />
      <Benefit label={t('enterprise.support')} />
    </BenefitContainer>
  );
}

interface PlanBenefitsProps {
  billingTier: BillingTiersType;
}

export function PlanBenefits(props: PlanBenefitsProps) {
  switch (props.billingTier) {
    case 'free':
      return <FreePlanBenefits />;
    case 'pro':
      return <ProPlanBenefits />;
    case 'enterprise':
      return <EnterprisePlanBenefits />;
    default:
      return null;
  }
}
