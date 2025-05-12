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
import { getUsageLimits } from '@letta-cloud/utils-shared';
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
      <CheckIcon color="success" />
      <Typography variant="body">{label}</Typography>
    </HStack>
  );
}

function FreePlanBenefits() {
  const t = useTranslations('components/PlanBenefits');

  const limits = getUsageLimits('free');

  const { formatFileSize, formatNumber } = useFormatters();

  return (
    <BenefitContainer>
      <Benefit label={t('free.agent', { limit: limits.agents })} />
      <Benefit
        label={t.rich('free.standardRequests', {
          limit: () => formatNumber(limits.freeInferencesPerMonth),
          link: (chunks) => <Link href="/models">{chunks}</Link>,
        })}
      />
      <Benefit
        label={t.rich('free.premiumRequests', {
          limit: () => formatNumber(limits.premiumInferencesPerMonth),
          link: (chunks) => <Link href="/models">{chunks}</Link>,
        })}
      />
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

  const limits = getUsageLimits('pro');

  const { formatFileSize, formatNumber } = useFormatters();

  return (
    <BenefitContainer>
      <Benefit label={t('pro.agent', { limit: formatNumber(limits.agents) })} />
      <Benefit
        label={t.rich('pro.standardRequests', {
          limit: () => formatNumber(limits.freeInferencesPerMonth),
          link: (chunks) => <Link href="/models">{chunks}</Link>,
        })}
      />
      <Benefit
        label={t.rich('pro.premiumModelUsage', {
          limit: () => formatNumber(limits.premiumInferencesPerMonth),
          link: (chunks) => <Link href="/models">{chunks}</Link>,
        })}
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
      <Benefit label={t('enterprise.agent')} />
      <Benefit
        label={t.rich('enterprise.standardRequests', {
          link: (chunks) => <Link href="/models">{chunks}</Link>,
        })}
      />
      <Benefit
        label={t.rich('enterprise.premiumModelUsage', {
          link: (chunks) => <Link href="/models">{chunks}</Link>,
        })}
      />
      <Benefit label={t('enterprise.storage')} />
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
