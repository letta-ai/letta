import { useTranslations } from '@letta-cloud/translations';
import {
  Typography,
  DashboardPageSection,
  DataTable,
  HStack,
  isBrandKey,
  InfoTooltip,
  ChevronRightIcon,
  brandKeyToOwnerMap,
} from '@letta-cloud/ui-component-library';
import React, { useMemo, useState } from 'react';
import {
  type CostItemType,
  webApi,
  webApiQueryKeys,
} from '@letta-cloud/sdk-web';
import type { ColumnDef } from '@tanstack/react-table';
import type { UsageLimits } from '@letta-cloud/utils-shared';
import { creditsToDollars, getUsageLimits } from '@letta-cloud/utils-shared';
import { useFormatters } from '@letta-cloud/utils-client';
import { ModelName } from '../ModelName/ModelName';
import { ModelDetailsOverlay } from '../ModelDetailsOverlay/ModelDetailsOverlay';
import { ModelTierBadge } from '../ModelTierBadge/ModelTierBadge';

interface BaseCostCellProps {
  tier: CostItemType['tier'];
  costMap: CostItemType['costMap'];
  usage: UsageLimits;
}

function BaseCostCell(props: BaseCostCellProps) {
  const { tier, costMap } = props;
  const t = useTranslations('pages/models/LettaManagedModels');

  const { formatCurrency } = useFormatters();

  const baseCost = useMemo(() => {
    return Object.entries(costMap)
      .map(([contextWindowSize, cost]) => ({
        contextWindowSize,
        cost,
      }))
      .sort((a, b) => {
        return Number(a.contextWindowSize) - Number(b.contextWindowSize);
      });
  }, [costMap]);

  if (tier === 'free') {
    return <ModelTierBadge tier="free" />;
  }

  if (tier === 'premium') {
    return <ModelTierBadge tier="premium" />;
  }

  if (!baseCost[0]) {
    return <Typography>{t('BaseCostCell.notSupported')}</Typography>;
  }

  return (
    <HStack>
      {t('BaseCostCell.perStep', {
        cost: formatCurrency(creditsToDollars(baseCost[0].cost), {
          maximumFractionDigits: 3,
        }),
      })}
      <InfoTooltip text={t('BaseCostCell.perStepInfo')} />
    </HStack>
  );
}

export function LettaManagedModels() {
  const t = useTranslations('pages/models/LettaManagedModels');

  const { data: costs, isLoading } = webApi.costs.getStepCosts.useQuery({
    queryKey: webApiQueryKeys.costs.getStepCosts,
  });

  const stepCosts = useMemo(() => {
    if (!costs) {
      return [];
    }

    return costs.body.stepCosts.sort((a, b) => {
      // free tier then all premium, then others

      const tierPriority: Record<string, number> = {
        free: 1,
        premium: 2,
      };

      const aPriority = tierPriority[a.tier || 'per-inference'] || 3;
      const bPriority = tierPriority[b.tier || 'per-inference'] || 3;

      // secondary priority
      const modelPriority: Record<string, number> = {
        openai: 1,
        claude: 2,
        gemini: 3,
      };

      if (aPriority === bPriority) {
        const aModelPriority = modelPriority[a.brand] || 4;
        const bModelPriority = modelPriority[b.brand] || 4;

        return aModelPriority - bModelPriority;
      }

      return aPriority - bPriority;
    });
  }, [costs]);

  const { data: billingData, isLoading: billingLoading } =
    webApi.organizations.getCurrentOrganizationBillingInfo.useQuery({
      queryKey: webApiQueryKeys.organizations.getCurrentOrganizationBillingInfo,
    });

  const billingTier = useMemo(() => {
    return billingData?.body.billingTier || 'free';
  }, [billingData]);

  const usage = useMemo(() => {
    return getUsageLimits(billingTier);
  }, [billingTier]);

  const [selectedModel, setSelectedModel] = useState<CostItemType | null>(null);

  const columns: Array<ColumnDef<CostItemType>> = useMemo(
    () => [
      {
        header: t('columns.name'),
        accessorKey: 'modelName',
        cell: ({ row }) => {
          const { modelName, brand } = row.original;
          return (
            <HStack gap="medium" align="center">
              <ModelName modelName={modelName} brand={brand} />
            </HStack>
          );
        },
      },
      {
        header: t('columns.brand'),
        accessorKey: 'brand',
        cell: ({ row }) => {
          const { brand } = row.original;

          return (
            <Typography>
              {!isBrandKey(brand) ? brand : brandKeyToOwnerMap[brand]}
            </Typography>
          );
        },
      },
      {
        header: t('columns.baseCost'),
        cell: ({ row }) => {
          const { tier, costMap } = row.original;

          return <BaseCostCell usage={usage} costMap={costMap} tier={tier} />;
        },
      },
      {
        id: 'actions',
        meta: {
          style: {
            columnAlign: 'right',
          },
        },
        cell: () => <ChevronRightIcon color="muted" />,
      },
    ],
    [t, usage],
  );

  return (
    <DashboardPageSection width="capped" title={t('title')} description={t('description')}>
      {selectedModel && (
        <ModelDetailsOverlay
          model={selectedModel}
          open={!!selectedModel}
          setOpen={(open) => {
            if (!open) {
              setSelectedModel(null);
            }
          }}
        />
      )}
      <DataTable
        onRowClick={(row) => {
          setSelectedModel(row);
        }}
        minHeight={500}
        isLoading={isLoading || billingLoading}
        columns={columns}
        data={stepCosts}
      />
    </DashboardPageSection>
  );
}
