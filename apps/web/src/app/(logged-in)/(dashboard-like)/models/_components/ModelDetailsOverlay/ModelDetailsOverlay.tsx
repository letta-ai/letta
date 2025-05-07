import type { CostItemType } from '@letta-cloud/sdk-web';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useTranslations } from '@letta-cloud/translations';
import {
  HStack,
  InfoTooltip,
  Section,
  SideOverlay,
  SideOverlayHeader,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { ModelName } from '../ModelName/ModelName';
import { useFormatters } from '@letta-cloud/utils-client';
import { creditsToDollars, getUsageLimits } from '@letta-cloud/utils-shared';
import { ModelTierBadge } from '../ModelTierBadge/ModelTierBadge';
import type { ModelTiersType } from '@letta-cloud/types';
import { useMemo } from 'react';

interface CostsTableProps {
  model: CostItemType;
}

function ModelCostsTable(props: CostsTableProps) {
  const { model } = props;

  const t = useTranslations('pages/models/ModelDetailsOverlay');

  const { formatCurrency } = useFormatters();

  return (
    <Section
      title={t('ModelCostsTable.title')}
      description={t('ModelCostsTable.description')}
    >
      <VStack gap={false} border>
        <HStack padding="small" justify="spaceBetween" fullWidth>
          <HStack>
            <Typography variant="body4" bold uppercase color="muted">
              {t('ModelCostsTable.maxContextWindow')}
            </Typography>
            <InfoTooltip text={t('ModelCostsTable.maxContextWindowTooltip')} />
          </HStack>
          <Typography variant="body4" bold uppercase color="muted">
            {t('ModelCostsTable.costPerStep')}
          </Typography>
        </HStack>
        {Object.entries(model.costMap).map(([contextWindowSize, cost]) => (
          <HStack
            borderTop
            key={contextWindowSize}
            fullWidth
            justify="spaceBetween"
            padding="small"
          >
            <Typography variant="body2">{contextWindowSize}</Typography>
            <HStack gap="small" align="center">
              <Typography variant="body2">
                {formatCurrency(creditsToDollars(cost), {
                  minimumFractionDigits: 3,
                })}
              </Typography>
            </HStack>
          </HStack>
        ))}
      </VStack>
    </Section>
  );
}

interface ModelTypeViewProps {
  tier: ModelTiersType;
}

function ModelTypeView(props: ModelTypeViewProps) {
  const { tier } = props;
  const t = useTranslations('pages/models/ModelDetailsOverlay');

  const descriptionMap = useMemo(() => {
    return {
      free: t('ModelTypeView.types.standard'),
      premium: t('ModelTypeView.types.premium'),
      'per-inference': t('ModelTypeView.types.perInference'),
    };
  }, [t]);

  return (
    <Section
      title={t('ModelTypeView.title')}
      actions={<ModelTierBadge tier={tier} />}
    >
      {descriptionMap[tier]}
    </Section>
  );
}

interface UsageSummaryProps {
  type: ModelTiersType;
}

function UsageSummary(props: UsageSummaryProps) {
  const { type } = props;
  const { data: quotaData } =
    webApi.organizations.getOrganizationQuotas.useQuery({
      queryKey: webApiQueryKeys.organizations.getOrganizationQuotas,
    });

  const t = useTranslations('pages/models/ModelDetailsOverlay');

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

  const usageMap = useMemo(() => {
    return {
      free: quotaData?.body.freeModelRequests,
      premium: quotaData?.body.premiumModelRequests,
    };
  }, [quotaData]);

  return (
    <Section title={t('UsageSummary.title')}>
      <HStack fullWidth justify="spaceBetween">
        <HStack>{t('UsageSummary.base')}</HStack>
        <HStack>
          {!quotaData ? (
            <div />
          ) : (
            <Typography>
              {t('UsageSummary.value', {
                used: type === 'free' ? usageMap.free : usageMap.premium,
                total:
                  type === 'free'
                    ? limits.freeInferencesPerMonth
                    : limits.premiumInferencesPerMonth,
              })}
            </Typography>
          )}
        </HStack>
      </HStack>
    </Section>
  );
}

interface ModelDetailsOverlayProps {
  model: CostItemType;
  open: boolean;
  setOpen: (open: boolean) => void;
}

export function ModelDetailsOverlay(props: ModelDetailsOverlayProps) {
  const { model, setOpen, open } = props;

  const t = useTranslations('pages/models/ModelDetailsOverlay');

  return (
    <>
      <SideOverlay title={t('title')} isOpen={open} onOpenChange={setOpen}>
        <VStack gap={false}>
          <SideOverlayHeader>
            <ModelName modelName={model.modelName} brand={model.brand} />
          </SideOverlayHeader>
          <VStack padding>
            {model.tier && <ModelTypeView tier={model.tier} />}
            {model.tier && model.tier !== 'per-inference' && (
              <UsageSummary type={model.tier} />
            )}
            <ModelCostsTable model={model} />
          </VStack>
        </VStack>
      </SideOverlay>
    </>
  );
}
