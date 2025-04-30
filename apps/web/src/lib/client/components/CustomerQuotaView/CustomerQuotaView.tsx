'use client';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import {
  ChevronDownIcon,
  Button,
  CloseIcon,
  HR,
  HStack,
  Popover,
  QuotaBlock,
  Section,
  Typography,
  VStack,
  Spinner,
  LoadingEmptyStatusComponent,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { getUsageLimits } from '@letta-cloud/utils-shared';
import { useMemo, useState } from 'react';
import { useNumberFormatter } from '@letta-cloud/utils-client';

interface QuotaRowProps {
  label: string;
  value?: number;
  max: number | string;
}

function QuotaRow(props: QuotaRowProps) {
  const { label, value, max } = props;
  const t = useTranslations('components/CustomerQuotaView');

  const { formatNumber } = useNumberFormatter();

  return (
    <HStack fullWidth align="center" justify="spaceBetween">
      <Typography noWrap variant="body2">
        {label}
      </Typography>
      <Typography variant="body2" noWrap align="right" overrideEl="span">
        {t.rich('QuotaRow.limit', {
          value: () =>
            typeof value === 'number'
              ? formatNumber(value, {
                  maximumFractionDigits: 2,
                })
              : '--',
          max: typeof max === 'number' ? formatNumber(max) : max,
        })}
      </Typography>
    </HStack>
  );
}

function GBToMB(value: number) {
  return value * 1024;
}

interface ViewAllQuotasProps {
  limits: ReturnType<typeof getUsageLimits>;
}

function ViewAllQuotas(props: ViewAllQuotasProps) {
  const { limits } = props;
  const [open, setIsOpen] = useState(false);

  const { formatFileSize } = useNumberFormatter();

  const t = useTranslations('components/CustomerQuotaView');
  const { data: allQuotasData } =
    webApi.organizations.getFullOrganizationQuotas.useQuery({
      queryKey: webApiQueryKeys.organizations.getFullOrganizationQuotas,
      enabled: open,
    });

  return (
    <Popover
      align="end"
      trigger={
        <Button
          color="tertiary"
          size="small"
          active={open}
          label={open ? t('ViewAllQuotas.close') : t('ViewAllQuotas.open')}
          preIcon={open ? <CloseIcon /> : <ChevronDownIcon />}
        />
      }
      open={open}
      onOpenChange={setIsOpen}
    >
      <VStack padding="small" gap="small" color="background-grey2">
        <QuotaRow
          label={t('ViewAllQuotas.agents')}
          value={allQuotasData?.body.agents}
          max={limits.agents}
        />
        <QuotaRow
          label={t('ViewAllQuotas.identities')}
          value={allQuotasData?.body.identities}
          max={limits.identities}
        />
        <QuotaRow
          label={t('ViewAllQuotas.dataSources')}
          value={allQuotasData?.body.dataSources}
          max={limits.dataSources}
        />
        <QuotaRow
          label={t('ViewAllQuotas.storage')}
          value={
            allQuotasData?.body.storage
              ? GBToMB(allQuotasData.body.storage)
              : undefined
          }
          max={`${formatFileSize(limits.storage, { unit: 'MB' })}MB`}
        />
        <QuotaRow
          label={t('ViewAllQuotas.templates')}
          value={allQuotasData?.body.templates}
          max={limits.templates}
        />
        <QuotaRow
          label={t('ViewAllQuotas.projects')}
          value={allQuotasData?.body.projects}
          max={limits.projects}
        />
      </VStack>
      {!allQuotasData && (
        <HStack padding="xsmall" borderTop>
          <Spinner size="small"></Spinner>
          <Typography variant="body2">{t('loading')}</Typography>
        </HStack>
      )}
    </Popover>
  );
}

export function CustomerQuotaView() {
  const { data: quotaData } =
    webApi.organizations.getOrganizationQuotas.useQuery({
      queryKey: webApiQueryKeys.organizations.getOrganizationQuotas,
    });

  const { data: billingData } =
    webApi.organizations.getCurrentOrganizationBillingInfo.useQuery({
      queryKey: webApiQueryKeys.organizations.getCurrentOrganizationBillingInfo,
    });

  const t = useTranslations('components/CustomerQuotaView');

  const billingTier = useMemo(() => {
    return billingData?.body.billingTier || 'free';
  }, [billingData?.body.billingTier]);

  const limits = useMemo(() => {
    return getUsageLimits(billingTier);
  }, [billingTier]);

  if (!quotaData) {
    return (
      <Section title={t('title')}>
        <VStack color="background-grey">
          <div className="h-[325px]">
            <LoadingEmptyStatusComponent
              isLoading
              loadingMessage={t('loading')}
              loaderVariant="grower"
            />
          </div>
        </VStack>
      </Section>
    );
  }

  return (
    <Section title={t('title')} actions={<ViewAllQuotas limits={limits} />}>
      <VStack border gap={false}>
        <QuotaBlock
          max={limits.premiumInferencesPerMonth}
          value={quotaData.body.premiumModelRequests}
          label={t('premiumModelUsage.label')}
        />
        <HR />
        <QuotaBlock
          max={
            billingTier === 'free' ? limits.freeInferencesPerMonth : 'infinite'
          }
          value={quotaData.body.freeModelRequests}
          label={t('freeModelUsage.label')}
        />
        <HR />
        <QuotaBlock
          max={limits.agents}
          value={quotaData.body.agents}
          label={t('agentUsage.label')}
        />
      </VStack>
    </Section>
  );
}
