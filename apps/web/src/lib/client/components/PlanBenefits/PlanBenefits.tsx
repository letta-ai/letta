'use client';
import type { BillingTiersType } from '@letta-cloud/types';
import { useTranslations } from '@letta-cloud/translations';
import {
  CheckIcon,
  HStack,
  Link,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { getRecurrentSubscriptionLimits, getUsageLimits } from '@letta-cloud/utils-shared';
import { useFormatters } from '@letta-cloud/utils-client';
import { useFeatureFlag } from '@letta-cloud/sdk-web';

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
  const { data: isBillingV3Enabled } = useFeatureFlag('BILLING_V3');

  const limits = getUsageLimits('free');

  const { formatFileSize, formatNumber } = useFormatters();

  if (isBillingV3Enabled) {
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

  return (
    <BenefitContainer>
      <Benefit
        label={t.rich('free.premiumRequests', {
          limit: () => formatNumber(limits.premiumInferencesPerMonth),
          link: (chunks) => <Link href="/models">{chunks}</Link>,
        })}
      />
      <Benefit
        label={t.rich('free.standardRequests', {
          limit: () => formatNumber(limits.freeInferencesPerMonth),
          link: (chunks) => <Link href="/models">{chunks}</Link>,
        })}
      />
      <Benefit label={t('free.agent', { limit: limits.agents })} />
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

function ProLegacyPlanBenefits() {
  const t = useTranslations('components/PlanBenefits');

  const limits = getUsageLimits('pro-legacy');

  const { formatFileSize, formatNumber } = useFormatters();

  return (
    <BenefitContainer>
      <Benefit
        label={t.rich('pro-legacy.premiumModelUsage', {
          limit: () => formatNumber(limits.premiumInferencesPerMonth),
          link: (chunks) => <Link href="/models">{chunks}</Link>,
        })}
      />
      <Benefit
        label={t.rich('pro-legacy.standardRequests', {
          limit: () => formatNumber(limits.freeInferencesPerMonth),
          link: (chunks) => <Link href="/models">{chunks}</Link>,
        })}
      />
      <Benefit label={t('pro-legacy.agent', { limit: formatNumber(limits.agents) })} />
      <Benefit
        label={t('pro-legacy.templates', { limit: formatNumber(limits.agents) })}
      />
      <Benefit
        label={t('pro-legacy.storage', {
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

function ScalePlanBenefits() {
  const t = useTranslations('components/PlanBenefits');

  const limits = getUsageLimits('scale');

  const { formatFileSize, formatNumber } = useFormatters();

  return (
    <BenefitContainer>
      <Benefit
        label={t.rich('scale.premiumModelUsage', {
          limit: () => formatNumber(limits.premiumInferencesPerMonth),
          link: (chunks) => <Link href="/models">{chunks}</Link>,
        })}
      />
      <Benefit
        label={t.rich('scale.standardRequests', {
          limit: () => formatNumber(limits.freeInferencesPerMonth),
          link: (chunks) => <Link href="/models">{chunks}</Link>,
        })}
      />
      <Benefit
        label={t('scale.agent', { limit: formatNumber(limits.agents) })}
      />
      <Benefit
        label={t('scale.templates', { limit: formatNumber(limits.agents) })}
      />
      <Benefit
        label={t('scale.storage', {
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
    case 'pro-legacy':
      return <ProLegacyPlanBenefits />;
    case 'pro':
      return <ProPlanBenefits />;
    case 'enterprise':
      return <EnterprisePlanBenefits />;
    case 'scale':
      return <ScalePlanBenefits />;
    default:
      return null;
  }
}
