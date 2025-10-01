import {
  Typography,
  DashboardPageSection,
  DataTable,
  Badge,
  HStack,
  InfoTooltip,
  LettaCoinIcon,
} from '@letta-cloud/ui-component-library';
import React, { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from '@letta-cloud/translations';

interface PricingRow {
  category: 'standard' | 'premium';
  pricePerRequest: string;
  pricePerRequestMax: string;
  creditsPerRequest: number;
  creditsPerRequestMax: number;
}

export function ModelPricingTable() {
  const t = useTranslations('pages/models/ModelPricingTable');

  const pricingData: PricingRow[] = useMemo(
    () => [
      {
        category: 'standard',
        pricePerRequest: '$0.001',
        pricePerRequestMax: '$0.005',
        creditsPerRequest: 1,
        creditsPerRequestMax: 5,
      },
      {
        category: 'premium',
        pricePerRequest: '$0.020',
        pricePerRequestMax: '$0.100',
        creditsPerRequest: 20,
        creditsPerRequestMax: 100,
      },
    ],
    [],
  );

  const columns: Array<ColumnDef<PricingRow>> = useMemo(
    () => [
      {
        header: () => (
          <HStack gap="small">
            {t('columns.modelTier')}
            <InfoTooltip text={t('columns.modelTierTooltip')} />
          </HStack>
        ),
        accessorKey: 'category',
        cell: ({ row }) => {
          const { category } = row.original;

          if (category === 'standard') {
            return <Badge variant="chipStandard" content={t('tierLabels.standard')} border />;
          }

          return <Badge variant="chipPremium" content={t('tierLabels.premium')} border />;
        },
      },
      {
        header: () => (
          <HStack gap="small">
            {t('columns.pricePerRequest')}
            <InfoTooltip text={t('columns.pricePerRequestTooltip')} />
          </HStack>
        ),
        accessorKey: 'pricePerRequest',
        cell: ({ row }) => {
          const { category, pricePerRequest, creditsPerRequest } = row.original;
          const variant = category === 'standard' ? 'chipStandard' : 'chipPremium';

          return (
            <HStack gap="small" align="center">
              <Badge
                variant={variant}
                content={
                  <HStack gap="small" align="center">
                    <LettaCoinIcon size="xsmall" />
                    <span>{creditsPerRequest}</span>
                  </HStack>
                }
                border
              />
              <Typography variant="body2" color="lighter">
                ({pricePerRequest})
              </Typography>
            </HStack>
          );
        },
      },
      {
        header: () => (
          <HStack gap="small">
            {t('columns.pricePerRequestMax')}
            <InfoTooltip text={t('columns.pricePerRequestMaxTooltip')} />
          </HStack>
        ),
        accessorKey: 'pricePerRequestMax',
        cell: ({ row }) => {
          const { category, pricePerRequestMax, creditsPerRequestMax } = row.original;
          const variant = category === 'standard' ? 'chipStandard' : 'chipPremium';

          return (
            <HStack gap="small" align="center">
              <Badge
                variant={variant}
                content={
                  <HStack gap="small" align="center">
                    <LettaCoinIcon size="xsmall" />
                    <span>{creditsPerRequestMax}</span>
                  </HStack>
                }
                border
              />
              <Typography variant="body2" color="lighter">
                ({pricePerRequestMax})
              </Typography>
            </HStack>
          );
        },
      },
    ],
    [t],
  );

  return (
    <DashboardPageSection
      width="capped"
      title={t('title')}
      description={t('description')}
    >
      <DataTable columns={columns} data={pricingData} minHeight={150} />
    </DashboardPageSection>
  );
}
